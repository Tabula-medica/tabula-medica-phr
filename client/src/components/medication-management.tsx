import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Quote,
  MessageCircleQuestion,
  ChevronRight,
  ExternalLink,
  Bell,
  Calendar,
  User,
  Building2,
  RefreshCw,
  BookOpen,
  Clock,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";

interface ActiveMedication {
  id: string;
  name: string;
  genericName: string;
  dosage: string;
  frequency: string;
  prescriber: string;
  startDate: string;
  lastFillDate?: string;
  refillsRemaining?: number;
  pharmacy?: string;
  quote: string;
  source: string;
  sourceDate: string;
  sourceLink: string;
}

interface MedicationEducation {
  medicationId: string;
  medicationName: string;
  whatItMeans: string;
  commonUses: string;
  howItWorks: string;
  discussionPrompts: string[];
  quote: string;
  source: string;
}

interface MedicationReminder {
  id: string;
  type: "refill" | "adherence" | "appointment";
  medicationId: string;
  medicationName: string;
  message: string;
  dueDate?: string;
  sourceLink: string;
}

interface MedicationManagementResponse {
  activeMedications: ActiveMedication[];
  educationalInfo: MedicationEducation[];
  reminders: MedicationReminder[];
  summary: {
    totalMedications: number;
    prescribers: string[];
    lastUpdated: string;
  };
  disclaimer: string;
}

const reminderTypeIcons: Record<string, React.ReactNode> = {
  refill: <RefreshCw className="h-4 w-4" />,
  adherence: <Clock className="h-4 w-4" />,
  appointment: <Calendar className="h-4 w-4" />,
};

const reminderTypeColors: Record<string, string> = {
  refill: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  adherence: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  appointment: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

function MedicationCard({ medication, education }: { medication: ActiveMedication; education?: MedicationEducation }) {
  return (
    <AccordionItem value={medication.id} className="border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline" data-testid={`accordion-medication-${medication.id}`}>
        <div className="flex items-center gap-3 text-left w-full">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Pill className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{medication.name} {medication.dosage}</p>
            <p className="text-xs text-muted-foreground truncate">{medication.frequency}</p>
          </div>
          {medication.refillsRemaining !== undefined && medication.refillsRemaining <= 2 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              {medication.refillsRemaining} refills
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pt-2">
          {/* Quote */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <Quote className="h-3 w-3" />
              From your records:
            </p>
            <div className="p-3 rounded-lg bg-muted/50 border-l-2 border-primary">
              <p className="text-sm italic">"{medication.quote}"</p>
              <p className="text-xs text-muted-foreground mt-1">
                ({medication.source}, {medication.sourceDate})
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Prescriber:</span>
            </div>
            <span className="truncate">{medication.prescriber}</span>

            {medication.pharmacy && (
              <>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Pharmacy:</span>
                </div>
                <span className="truncate">{medication.pharmacy}</span>
              </>
            )}

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Started:</span>
            </div>
            <span>{medication.startDate}</span>

            {medication.lastFillDate && (
              <>
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Last filled:</span>
                </div>
                <span>{medication.lastFillDate}</span>
              </>
            )}

            {medication.refillsRemaining !== undefined && (
              <>
                <div className="flex items-center gap-2">
                  <Pill className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Refills left:</span>
                </div>
                <span>{medication.refillsRemaining}</span>
              </>
            )}
          </div>

          {/* Educational info */}
          {education && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                Educational Information:
              </p>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 space-y-2">
                <p className="text-sm"><strong>What it means:</strong> {education.whatItMeans}</p>
                <p className="text-sm"><strong>Common uses:</strong> {education.commonUses}</p>
                <p className="text-sm"><strong>How it works:</strong> {education.howItWorks}</p>
                <p className="text-xs text-muted-foreground italic">
                  Source: {education.source}
                </p>
              </div>
            </div>
          )}

          {/* Discussion prompts */}
          {education && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <MessageCircleQuestion className="h-3 w-3" />
                Things your clinician might suggest discussing:
              </p>
              <ul className="space-y-1">
                {education.discussionPrompts.map((prompt, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    {prompt}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Source link */}
          <Link href={medication.sourceLink}>
            <Button variant="outline" size="sm" className="w-full" data-testid={`link-medication-${medication.id}`}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View Full Medication Record
            </Button>
          </Link>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function ReminderCard({ reminder }: { reminder: MedicationReminder }) {
  return (
    <Card className="border-l-4 border-l-primary" data-testid={`card-reminder-${reminder.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${reminderTypeColors[reminder.type]}`}>
            {reminderTypeIcons[reminder.type]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">
                {reminder.type}
              </Badge>
              {reminder.medicationName && (
                <span className="text-sm font-medium">{reminder.medicationName}</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{reminder.message}</p>
                      </div>
          <Link href={reminder.sourceLink}>
            <Button variant="ghost" size="icon" data-testid={`link-reminder-${reminder.id}`}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function MedicationManagementCard() {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<MedicationManagementResponse>({
    queryKey: ["/api/medication-management"],
    enabled: open,
  });

  return (
    <Card className="border-primary/20" data-testid="card-medication-management">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Pill className="h-5 w-5 text-primary" />
          Medication Management
        </CardTitle>
        <CardDescription>
          Track medications, learn about them, and view reminders
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" data-testid="button-manage-medications">
              <Sparkles className="h-4 w-4 mr-2" />
              Manage Medications
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-primary" />
                Medication Management
              </DialogTitle>
              <DialogDescription>
                View your medications, learn about them, and see reminders from your records.
              </DialogDescription>
            </DialogHeader>

            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : data ? (
              <Tabs defaultValue="medications" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="medications" data-testid="tab-medications">
                    <Pill className="h-4 w-4 mr-2" />
                    Active ({data.activeMedications.length})
                  </TabsTrigger>
                  <TabsTrigger value="reminders" data-testid="tab-reminders">
                    <Bell className="h-4 w-4 mr-2" />
                    Reminders ({data.reminders.length})
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 mt-4">
                  <TabsContent value="medications" className="m-0">
                    <div className="space-y-4 pr-4">
                      {/* Summary */}
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium">Your Medication Summary</p>
                          <Badge variant="secondary">{data.summary.totalMedications} medications</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {data.summary.prescribers.map((prescriber, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              <User className="h-3 w-3 mr-1" />
                              {prescriber}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      {/* Medications list */}
                      <Accordion type="multiple" className="space-y-2">
                        {data.activeMedications.map((med) => {
                          const education = data.educationalInfo.find(e => e.medicationId === med.id);
                          return (
                            <MedicationCard
                              key={med.id}
                              medication={med}
                              education={education}
                            />
                          );
                        })}
                      </Accordion>

                      {/* Disclaimer */}
                      <div className="p-2 rounded-lg bg-muted/50 border">
                        <p className="text-xs text-muted-foreground text-center">
                          Informational only. Not medical advice.
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="reminders" className="m-0">
                    <div className="space-y-4 pr-4">
                      {/* Info banner */}
                      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                          These reminders are based on your medication records. They are informational only and do not replace instructions from your healthcare provider.
                        </p>
                      </div>

                      {/* Reminders list */}
                      <div className="space-y-3">
                        {data.reminders.map((reminder) => (
                          <ReminderCard key={reminder.id} reminder={reminder} />
                        ))}
                      </div>

                      {data.reminders.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No reminders at this time</p>
                        </div>
                      )}

                      {/* Disclaimer */}
                      <div className="p-2 rounded-lg bg-muted/50 border">
                        <p className="text-xs text-muted-foreground text-center">
                          Informational only. Not medical advice.
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            ) : null}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export function MedicationManagementPage() {
  const { data, isLoading } = useQuery<MedicationManagementResponse>({
    queryKey: ["/api/medication-management"],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Unable to load medication data.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Pill className="h-6 w-6 text-primary" />
          Medication Management
        </h1>
        <p className="text-muted-foreground mt-1">
          View your medications, learn about them, and see reminders from your records.
        </p>
      </div>

      <Tabs defaultValue="medications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="medications" data-testid="page-tab-medications">
            <Pill className="h-4 w-4 mr-2" />
            Active Medications ({data.activeMedications.length})
          </TabsTrigger>
          <TabsTrigger value="reminders" data-testid="page-tab-reminders">
            <Bell className="h-4 w-4 mr-2" />
            Reminders ({data.reminders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="medications" className="space-y-4">
          {/* Summary card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Your Medication Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    {data.summary.totalMedications}
                  </Badge>
                  <span className="text-sm text-muted-foreground">Active medications</span>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="flex flex-wrap gap-2">
                  {data.summary.prescribers.map((prescriber, i) => (
                    <Badge key={i} variant="outline">
                      <User className="h-3 w-3 mr-1" />
                      {prescriber}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Medications */}
          <Accordion type="multiple" className="space-y-2">
            {data.activeMedications.map((med) => {
              const education = data.educationalInfo.find(e => e.medicationId === med.id);
              return (
                <MedicationCard
                  key={med.id}
                  medication={med}
                  education={education}
                />
              );
            })}
          </Accordion>

          {/* Disclaimer */}
          <Card className="bg-muted/50">
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground text-center">
                Informational only. Not medical advice.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reminders" className="space-y-4">
          {/* Info banner */}
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <CardContent className="py-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-800 dark:text-blue-300">
                These reminders are based on your medication records. They are informational only and do not replace instructions from your healthcare provider.
              </p>
            </CardContent>
          </Card>

          {/* Reminders */}
          <div className="space-y-3">
            {data.reminders.map((reminder) => (
              <ReminderCard key={reminder.id} reminder={reminder} />
            ))}
          </div>

          {data.reminders.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No reminders at this time</p>
              </CardContent>
            </Card>
          )}

          {/* Disclaimer */}
          <Card className="bg-muted/50">
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground text-center">
                Informational only. Not medical advice.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
