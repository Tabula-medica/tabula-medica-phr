import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Calendar,
  Clock,
  User,
  Video,
  MapPin,
  Sparkles,
  FileText,
  Thermometer,
  Pill,
  TestTube,
  CheckCircle2,
  ChevronRight,
  CalendarPlus,
  Stethoscope,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { clickable } from "@/lib/a11y";

interface HealthContext {
  recentSymptoms: Array<{ name: string; severity: number; date: string }>;
  activeConditions: string[];
  recentLabFlags: Array<{ testName: string; value: string; date: string }>;
  currentMedications: string[];
}

interface AppointmentSuggestion {
  date: string;
  timeSlot: string;
  provider: string;
  specialty: string;
  visitType: "in-person" | "telehealth";
  reason: string;
  contextSummary: string;
  disclaimer: string;
}

interface AppointmentAssistantResponse {
  suggestions: AppointmentSuggestion[];
  healthContext: HealthContext;
  contextForClinician: string;
  disclaimer: string;
  generatedAt: string;
}

interface AppointmentRequest {
  concern: string;
  urgencyLevel: "routine" | "soon" | "urgent";
  preferredDates: string[];
  telehealth: boolean;
  additionalNotes?: string;
}

function HealthContextSummary({ context }: { context: HealthContext }) {
  return (
    <div className="space-y-3">
      {context.recentSymptoms.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
            <Thermometer className="h-3 w-3" />
            Recent Symptoms
          </p>
          <div className="flex flex-wrap gap-1">
            {context.recentSymptoms.map((s, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {s.name} ({s.severity}/10)
              </Badge>
            ))}
          </div>
        </div>
      )}

      {context.activeConditions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
            <FileText className="h-3 w-3" />
            Active Conditions
          </p>
          <div className="flex flex-wrap gap-1">
            {context.activeConditions.map((c, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {c}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {context.currentMedications.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
            <Pill className="h-3 w-3" />
            Current Medications
          </p>
          <div className="flex flex-wrap gap-1">
            {context.currentMedications.map((m, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {m}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {context.recentLabFlags.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
            <TestTube className="h-3 w-3" />
            Recent Lab Values
          </p>
          <div className="flex flex-wrap gap-1">
            {context.recentLabFlags.map((l, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {l.testName}: {l.value}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onSelect,
  selected,
}: {
  suggestion: AppointmentSuggestion;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
        selected ? "border-primary bg-primary/5" : "hover:border-primary/50"
      }`}
      {...clickable(onSelect)}
      data-testid={`card-suggestion-${suggestion.date}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="font-medium">
              {format(new Date(suggestion.date), "EEEE, MMM d, yyyy")}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground mb-2">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {suggestion.timeSlot}
            </div>
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {suggestion.provider}
            </div>
            <div className="flex items-center gap-1">
              <Stethoscope className="h-3 w-3" />
              {suggestion.specialty}
            </div>
            <div className="flex items-center gap-1">
              {suggestion.visitType === "telehealth" ? (
                <Video className="h-3 w-3" />
              ) : (
                <MapPin className="h-3 w-3" />
              )}
              {suggestion.visitType === "telehealth" ? "Telehealth" : "In-Person"}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
        </div>

        {selected && (
          <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
        )}
      </div>
    </div>
  );
}

export function AppointmentAssistantCard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"request" | "suggestions" | "confirm">("request");
  const [concern, setConcern] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [telehealth, setTelehealth] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AppointmentSuggestion | null>(null);
  const [response, setResponse] = useState<AppointmentAssistantResponse | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getPreferredDates = () => {
    const dates: string[] = [];
    for (let i = 1; i <= 14; i++) {
      const date = addDays(new Date(), i);
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        dates.push(format(date, "yyyy-MM-dd"));
        if (dates.length >= 5) break;
      }
    }
    return dates;
  };

  const suggestionsMutation = useMutation({
    mutationFn: async (request: AppointmentRequest) => {
      const res = await apiRequest("POST", "/api/appointment-assistant/suggestions", request);
      return res.json();
    },
    onSuccess: (data: AppointmentAssistantResponse) => {
      setResponse(data);
      setStep("suggestions");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not get appointment suggestions. Please try again.",
        variant: "destructive",
      });
    },
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSuggestion || !response) return;
      const res = await apiRequest("POST", "/api/appointment-assistant/book", {
        suggestion: selectedSuggestion,
        concern,
        contextForClinician: response.contextForClinician,
        additionalNotes,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Appointment Requested",
        description: "Your appointment request has been submitted with health context for your clinician.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not submit appointment request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGetSuggestions = () => {
    if (!concern.trim()) {
      toast({
        title: "Please enter your concern",
        description: "Tell us what you'd like to discuss with your clinician.",
        variant: "destructive",
      });
      return;
    }

    suggestionsMutation.mutate({
      concern,
      urgencyLevel: "routine",
      preferredDates: getPreferredDates(),
      telehealth,
      additionalNotes: additionalNotes || undefined,
    });
  };

  const handleClose = () => {
    setOpen(false);
    setStep("request");
    setConcern("");
    setAdditionalNotes("");
    setTelehealth(false);
    setSelectedSuggestion(null);
    setResponse(null);
  };

  return (
    <Card data-testid="card-appointment-assistant">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarPlus className="h-5 w-5 text-primary" />
          AI Appointment Assistant
        </CardTitle>
        <CardDescription>Smart scheduling with health context</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={(o) => o ? setOpen(true) : handleClose()}>
          <DialogTrigger asChild>
            <Button className="w-full" data-testid="button-open-appointment-assistant">
              <Sparkles className="h-4 w-4 mr-2" />
              Request Appointment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarPlus className="h-5 w-5 text-primary" />
                {step === "request" && "Request an Appointment"}
                {step === "suggestions" && "Choose a Time"}
                {step === "confirm" && "Confirm Appointment"}
              </DialogTitle>
              <DialogDescription>
                {step === "request" && "Tell us what you'd like to discuss"}
                {step === "suggestions" && "AI-suggested times based on your preferences"}
                {step === "confirm" && "Review details before submitting"}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 pr-4">
              {step === "request" && (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="concern">What would you like to discuss?</Label>
                    <Textarea
                      id="concern"
                      placeholder="e.g., Follow up on recent lab results, discuss fatigue symptoms..."
                      value={concern}
                      onChange={(e) => setConcern(e.target.value)}
                      className="min-h-[80px]"
                      data-testid="input-concern"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Additional notes (optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Any other details for your clinician..."
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      className="min-h-[60px]"
                      data-testid="input-notes"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="telehealth" className="flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      Prefer telehealth visit
                    </Label>
                    <Switch
                      id="telehealth"
                      checked={telehealth}
                      onCheckedChange={setTelehealth}
                      data-testid="switch-telehealth"
                    />
                  </div>

                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                      <Sparkles className="h-3 w-3" />
                      Your recent health data will be shared with your clinician
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Recent symptoms, conditions, medications, and lab results will be 
                      automatically included for context.
                    </p>
                  </div>
                </div>
              )}

              {step === "suggestions" && response && (
                <div className="space-y-4 py-4">
                  <Accordion type="single" collapsible defaultValue="context">
                    <AccordionItem value="context">
                      <AccordionTrigger className="text-sm" data-testid="accordion-health-context">
                        <span className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Health Context (auto-populated)
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <HealthContextSummary context={response.healthContext} />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <div>
                    <p className="text-sm font-medium mb-3">Suggested Times</p>
                    <div className="space-y-3">
                      {response.suggestions.map((suggestion, i) => (
                        <SuggestionCard
                          key={i}
                          suggestion={suggestion}
                          selected={selectedSuggestion === suggestion}
                          onSelect={() => setSelectedSuggestion(suggestion)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === "confirm" && selectedSuggestion && response && (
                <div className="space-y-4 py-4">
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <p className="font-medium mb-2">Appointment Details</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(selectedSuggestion.date), "EEEE, MMM d")}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {selectedSuggestion.timeSlot}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {selectedSuggestion.provider}
                      </div>
                      <div className="flex items-center gap-1">
                        {selectedSuggestion.visitType === "telehealth" ? (
                          <Video className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                        )}
                        {selectedSuggestion.visitType === "telehealth" ? "Telehealth" : "In-Person"}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Your Concern</p>
                    <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
                      {concern}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      Context for Clinician
                    </p>
                    <div className="p-3 bg-muted/30 rounded-lg text-sm whitespace-pre-wrap">
                      {response.contextForClinician}
                    </div>
                  </div>
                </div>
              )}

              {suggestionsMutation.isPending && (
                <div className="space-y-4 py-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles className="h-4 w-4 animate-pulse" />
                    Finding optimal appointment times...
                  </div>
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              )}

              <div className="p-2 rounded-lg bg-muted/50 border mt-4">
                <p className="text-xs text-muted-foreground text-center">
                  Informational only. Not medical advice. Scheduling assistance only.
                </p>
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2 sm:gap-0">
              {step === "request" && (
                <Button
                  onClick={handleGetSuggestions}
                  disabled={suggestionsMutation.isPending || !concern.trim()}
                  data-testid="button-get-suggestions"
                >
                  <ChevronRight className="h-4 w-4 mr-1" />
                  Get Suggestions
                </Button>
              )}

              {step === "suggestions" && (
                <>
                  <Button variant="outline" onClick={() => setStep("request")}>
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep("confirm")}
                    disabled={!selectedSuggestion}
                    data-testid="button-continue-confirm"
                  >
                    Continue
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </>
              )}

              {step === "confirm" && (
                <>
                  <Button variant="outline" onClick={() => setStep("suggestions")}>
                    Back
                  </Button>
                  <Button
                    onClick={() => bookMutation.mutate()}
                    disabled={bookMutation.isPending}
                    data-testid="button-submit-request"
                  >
                    {bookMutation.isPending ? "Submitting..." : "Submit Request"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
