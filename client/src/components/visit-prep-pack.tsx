import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  HelpCircle,
  FileText,
  CheckCircle2,
  ClipboardList,
  Briefcase,
  AlertTriangle,
  Sparkles,
  Calendar,
  User,
  Stethoscope,
} from "lucide-react";

interface PrepItem {
  id: string;
  text: string;
  category: string;
  priority: "high" | "medium" | "low";
  reason?: string;
}

interface VisitPrepPack {
  appointmentId: string;
  appointmentType: string;
  provider: string;
  specialty: string;
  scheduledDate: string;
  questionsToAsk: PrepItem[];
  itemsToConfirm: PrepItem[];
  documentsTooBring: PrepItem[];
  generatedAt: string;
  disclaimer: string;
}

interface Appointment {
  id: string;
  type: string;
  provider: string;
  specialty: string;
  scheduledDate: string;
}

interface PatientContext {
  conditions: string[];
  medications: string[];
  recentLabResults: { name: string; value: string; date: string }[];
  allergies: string[];
}

interface VisitPrepPackButtonProps {
  appointment: Appointment;
  patientContext?: PatientContext;
  variant?: "button" | "icon";
}

const priorityConfig = {
  high: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "High Priority" },
  medium: { color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300", label: "Medium" },
  low: { color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", label: "Low" },
};

const categoryIcons: Record<string, typeof HelpCircle> = {
  medications: ClipboardList,
  conditions: AlertTriangle,
  "follow-up": Calendar,
  lifestyle: User,
  general: HelpCircle,
  allergies: AlertTriangle,
  "contact-info": User,
  insurance: Briefcase,
  records: FileText,
  identification: User,
  "medical-records": FileText,
  device: ClipboardList,
};

function PrepItemCard({ item }: { item: PrepItem }) {
  const Icon = categoryIcons[item.category] || HelpCircle;
  const priority = priorityConfig[item.priority];

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card/50" data-testid={`prep-item-${item.id}`}>
      <div className="flex-shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm">{item.text}</p>
        {item.reason && (
          <p className="text-xs text-muted-foreground">{item.reason}</p>
        )}
      </div>
      <Badge className={`flex-shrink-0 text-xs ${priority.color}`}>
        {priority.label}
      </Badge>
    </div>
  );
}

function PrepPackContent({ prepPack }: { prepPack: VisitPrepPack }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium text-primary">Walk into visits prepared</p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-2 rounded-lg bg-muted/50">
          <Stethoscope className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{prepPack.specialty}</p>
        </div>
        <div className="p-2 rounded-lg bg-muted/50">
          <User className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{prepPack.provider}</p>
        </div>
        <div className="p-2 rounded-lg bg-muted/50">
          <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{new Date(prepPack.scheduledDate).toLocaleDateString()}</p>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={["questions", "confirm", "bring"]} className="space-y-2">
        <AccordionItem value="questions" className="border rounded-lg px-3">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Questions You May Want to Ask</span>
              <Badge variant="secondary" className="ml-2">{prepPack.questionsToAsk.length}</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ScrollArea className="max-h-64">
              <div className="space-y-2 pb-2">
                {prepPack.questionsToAsk.map((item) => (
                  <PrepItemCard key={item.id} item={item} />
                ))}
              </div>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="confirm" className="border rounded-lg px-3">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Items to Confirm</span>
              <Badge variant="secondary" className="ml-2">{prepPack.itemsToConfirm.length}</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ScrollArea className="max-h-64">
              <div className="space-y-2 pb-2">
                {prepPack.itemsToConfirm.map((item) => (
                  <PrepItemCard key={item.id} item={item} />
                ))}
              </div>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="bring" className="border rounded-lg px-3">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Bring These Documents</span>
              <Badge variant="secondary" className="ml-2">{prepPack.documentsTooBring.length}</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ScrollArea className="max-h-64">
              <div className="space-y-2 pb-2">
                {prepPack.documentsTooBring.map((item) => (
                  <PrepItemCard key={item.id} item={item} />
                ))}
              </div>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="p-3 rounded-lg bg-muted/50 border">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {prepPack.disclaimer}
        </p>
      </div>
    </div>
  );
}

function PrepPackSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

export function VisitPrepPackButton({ appointment, patientContext, variant = "button" }: VisitPrepPackButtonProps) {
  const [open, setOpen] = useState(false);
  const [prepPack, setPrepPack] = useState<VisitPrepPack | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/visit-prep/generate", {
        appointmentId: appointment.id,
        appointmentType: appointment.type,
        provider: appointment.provider,
        specialty: appointment.specialty,
        scheduledDate: appointment.scheduledDate,
        patientContext: patientContext || {
          conditions: [],
          medications: [],
          recentLabResults: [],
          allergies: [],
        },
      });
      return response.json();
    },
    onSuccess: (data) => {
      setPrepPack(data);
    },
  });

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !prepPack && !generateMutation.isPending) {
      generateMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button variant="ghost" size="icon" data-testid="button-visit-prep-icon">
            <ClipboardList className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-visit-prep">
            <ClipboardList className="h-3.5 w-3.5" />
            Prepare for Visit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Visit Prep Pack
          </DialogTitle>
          <DialogDescription>
            Personalized preparation guide for your upcoming appointment
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-2">
          {generateMutation.isPending ? (
            <PrepPackSkeleton />
          ) : generateMutation.isError ? (
            <div className="p-4 text-center text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
              <p>Failed to generate prep pack. Please try again.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => generateMutation.mutate()}
                data-testid="button-retry-prep"
              >
                Retry
              </Button>
            </div>
          ) : prepPack ? (
            <PrepPackContent prepPack={prepPack} />
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function VisitPrepPackCard({ appointment, patientContext }: { appointment: Appointment; patientContext?: PatientContext }) {
  const [prepPack, setPrepPack] = useState<VisitPrepPack | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/visit-prep/generate", {
        appointmentId: appointment.id,
        appointmentType: appointment.type,
        provider: appointment.provider,
        specialty: appointment.specialty,
        scheduledDate: appointment.scheduledDate,
        patientContext: patientContext || {
          conditions: [],
          medications: [],
          recentLabResults: [],
          allergies: [],
        },
      });
      return response.json();
    },
    onSuccess: (data) => {
      setPrepPack(data);
    },
  });

  return (
    <Card data-testid="card-visit-prep">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Visit Prep Pack</CardTitle>
          </div>
          {!prepPack && !generateMutation.isPending && (
            <Button
              variant="default"
              size="sm"
              onClick={() => generateMutation.mutate()}
              data-testid="button-generate-prep"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Generate
            </Button>
          )}
        </div>
        <CardDescription>
          Walk into visits prepared with personalized questions and checklists
        </CardDescription>
      </CardHeader>
      <CardContent>
        {generateMutation.isPending ? (
          <PrepPackSkeleton />
        ) : generateMutation.isError ? (
          <div className="p-4 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
            <p className="text-sm">Failed to generate prep pack.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => generateMutation.mutate()}
              data-testid="button-retry-prep-card"
            >
              Retry
            </Button>
          </div>
        ) : prepPack ? (
          <PrepPackContent prepPack={prepPack} />
        ) : (
          <div className="p-6 text-center text-muted-foreground border rounded-lg border-dashed">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Click Generate to create your personalized prep pack</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
