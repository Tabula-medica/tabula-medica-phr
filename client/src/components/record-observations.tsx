import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Pill,
  TrendingUp,
  Quote,
  MessageCircleQuestion,
  ChevronRight,
  Calendar,
  Building,
  Sparkles,
  ClipboardList,
  Activity,
} from "lucide-react";

interface MedicationObservation {
  type: "medication_list";
  medications: Array<{
    name: string;
    dosage: string;
    source: string;
    date: string;
  }>;
  discussionPrompts: string[];
  disclaimer: string;
}

interface FindingObservation {
  type: "finding";
  quote: string;
  source: string;
  date: string;
  category: string;
  explanation: string;
  discussionPrompts: string[];
}

interface RecordObservations {
  medicationObservations: MedicationObservation | null;
  findingObservations: FindingObservation[];
  disclaimer: string;
}

function MedicationSection({ observation }: { observation: MedicationObservation }) {
  return (
    <div className="space-y-4">
      {/* Quote-first: List medications */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
          <Quote className="h-3 w-3" />
          Quote:
        </p>
        <p className="text-xs text-muted-foreground mb-2">Your records show these medications:</p>
        <div className="space-y-2">
          {observation.medications.map((med, i) => (
            <div key={i} className="p-3 rounded-lg bg-muted/50 border-l-2 border-primary">
              <div className="flex items-center gap-2">
                <Pill className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">{med.name}</span>
                <Badge variant="outline" className="text-xs">{med.dosage}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                ({med.source}, {med.date})
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Discussion prompts */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
          <MessageCircleQuestion className="h-3 w-3" />
          Questions to ask your clinician:
        </p>
        <ul className="space-y-1">
          {observation.discussionPrompts.map((prompt, i) => (
            <li key={i} className="text-sm flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              {prompt}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FindingSection({ observation }: { observation: FindingObservation }) {
  return (
    <AccordionItem value={observation.quote} className="border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline" data-testid={`accordion-finding-${observation.category}`}>
        <div className="flex items-center gap-2 text-left">
          <Activity className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium">{observation.category}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pt-2">
          {/* Quote-first */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <Quote className="h-3 w-3" />
              Quote:
            </p>
            <div className="p-3 rounded-lg bg-muted/50 border-l-2 border-primary">
              <p className="text-sm italic">"{observation.quote}"</p>
              <p className="text-xs text-muted-foreground mt-1">
                ({observation.source}, {observation.date})
              </p>
            </div>
          </div>

          {/* What this shows */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">This shows:</p>
            <p className="text-sm">{observation.explanation}</p>
          </div>

          {/* Discussion prompts */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <MessageCircleQuestion className="h-3 w-3" />
              Questions to ask your clinician:
            </p>
            <ul className="space-y-1">
              {observation.discussionPrompts.map((prompt, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  {prompt}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function RecordObservationsCard() {
  const [open, setOpen] = useState(false);

  const { data: observations, isLoading } = useQuery<RecordObservations>({
    queryKey: ["/api/record-observations"],
    enabled: open,
  });

  return (
    <Card data-testid="card-record-observations">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardList className="h-5 w-5 text-primary" />
          Record Observations
        </CardTitle>
        <CardDescription>What your records show</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" data-testid="button-view-observations">
              <Sparkles className="h-4 w-4 mr-2" />
              View Observations
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Record Observations
              </DialogTitle>
              <DialogDescription>
                This shows items from your health records with discussion prompts.
              </DialogDescription>
            </DialogHeader>

            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : observations ? (
              <ScrollArea className="flex-1">
                <div className="space-y-6 pr-4">
                  {/* Medication Observations */}
                  {observations.medicationObservations && (
                    <div>
                      <h3 className="font-medium flex items-center gap-2 mb-3">
                        <Pill className="h-4 w-4 text-primary" />
                        Medications Listed
                      </h3>
                      <MedicationSection observation={observations.medicationObservations} />
                    </div>
                  )}

                  {observations.medicationObservations && observations.findingObservations.length > 0 && (
                    <Separator />
                  )}

                  {/* Finding Observations */}
                  {observations.findingObservations.length > 0 && (
                    <div>
                      <h3 className="font-medium flex items-center gap-2 mb-3">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        What Your Records Show
                      </h3>
                      <Accordion type="multiple" className="space-y-2">
                        {observations.findingObservations.map((finding, i) => (
                          <FindingSection key={i} observation={finding} />
                        ))}
                      </Accordion>
                    </div>
                  )}

                  {/* Disclaimer */}
                  <div className="p-2 rounded-lg bg-muted/50 border">
                    <p className="text-xs text-muted-foreground text-center">
                      {observations.disclaimer}
                    </p>
                  </div>
                </div>
              </ScrollArea>
            ) : null}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
