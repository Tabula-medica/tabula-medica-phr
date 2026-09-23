import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FileImage,
  Scan,
  Quote,
  BookOpen,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Info,
  ShieldCheck,
  Stethoscope,
  Brain,
  Heart,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { clickable } from "@/lib/a11y";

interface TranslatedImagingReport {
  id: string;
  originalReportId: string;
  whatWasScanned: {
    modality: string;
    bodyPart: string;
    description: string;
  };
  keyFindings: Array<{
    finding: string;
    quote: string;
    explanation: string;
  }>;
  impression: {
    quote: string;
    plainLanguage: string;
  };
  scaryTermDefinitions: Array<{
    term: string;
    definition: string;
    reassurance: string;
  }>;
  disclaimer: string;
  generatedAt: string;
}

const modalityIcons: Record<string, typeof Scan> = {
  "CT Scan": Scan,
  "MRI": Brain,
  "X-Ray": FileImage,
  "Ultrasound": Heart,
  "PET Scan": Eye,
};

function TranslatedReportView({ report }: { report: TranslatedImagingReport }) {
  const ModalityIcon = modalityIcons[report.whatWasScanned.modality] || Scan;

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-primary/10">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <ModalityIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">{report.whatWasScanned.modality} - {report.whatWasScanned.bodyPart}</p>
            <p className="text-sm text-muted-foreground mt-1">{report.whatWasScanned.description}</p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Quote className="h-4 w-4 text-blue-500" />
          <span className="font-medium">Key Findings</span>
        </div>
        <div className="space-y-3">
          {report.keyFindings.map((finding, i) => (
            <div key={i} className="p-3 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{finding.finding}</Badge>
              </div>
              <blockquote 
                className="border-l-2 border-primary/30 pl-3 text-sm italic text-muted-foreground"
                data-testid={`text-finding-quote-${i}`}
              >
                "{finding.quote}"
              </blockquote>
              <p className="text-sm" data-testid={`text-finding-explanation-${i}`}>{finding.explanation}</p>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Stethoscope className="h-4 w-4 text-green-500" />
          <span className="font-medium">Impression (Summary)</span>
        </div>
        <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/20 space-y-2">
          <blockquote 
            className="border-l-2 border-green-500/50 pl-3 text-sm italic text-muted-foreground"
            data-testid="text-impression-quote"
          >
            "{report.impression.quote}"
          </blockquote>
          <p className="text-sm font-medium text-green-800 dark:text-green-300" data-testid="text-impression-plain">
            {report.impression.plainLanguage}
          </p>
        </div>
      </div>

      <Separator />

      {report.scaryTermDefinitions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-purple-500" />
            <span className="font-medium">Medical Terms Explained</span>
          </div>
          <Accordion type="single" collapsible className="space-y-2">
            {report.scaryTermDefinitions.map((term, i) => (
              <AccordionItem key={i} value={`term-${i}`} className="border rounded-lg px-3">
                <AccordionTrigger className="hover:no-underline py-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-mono">{term.term}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <p className="text-sm mb-2">{term.definition}</p>
                  <div className="flex items-start gap-2 p-2 rounded bg-blue-50 dark:bg-blue-900/20">
                    <ShieldCheck className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 dark:text-blue-300">{term.reassurance}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 flex items-start gap-2" data-testid="text-disclaimer">
        <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
        <p className="text-xs text-yellow-800 dark:text-yellow-300 font-medium">
          {report.disclaimer}
        </p>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Translated on {new Date(report.generatedAt).toLocaleDateString()}
      </p>
    </div>
  );
}

function ReportCard({ report, onView }: { report: TranslatedImagingReport; onView: () => void }) {
  const ModalityIcon = modalityIcons[report.whatWasScanned.modality] || Scan;

  return (
    <div 
      className="p-4 rounded-lg border hover-elevate cursor-pointer"
      {...clickable(onView)}
      data-testid={`card-imaging-report-${report.id}`}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <ModalityIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <p className="font-medium">{report.whatWasScanned.modality} - {report.whatWasScanned.bodyPart}</p>
          <p className="text-sm text-muted-foreground">
            {new Date(report.generatedAt).toLocaleDateString()}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

export function ImagingReportTranslator() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<TranslatedImagingReport | null>(null);
  const [showTranslate, setShowTranslate] = useState(false);
  const [reportText, setReportText] = useState("");

  const { data: reports, isLoading } = useQuery<TranslatedImagingReport[]>({
    queryKey: ["/api/imaging-reports/translated"],
    enabled: open,
  });

  const translateMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest("POST", "/api/imaging-reports/translate", {
        reportText: text,
      });
      if (!response.ok) throw new Error("Translation failed");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/imaging-reports/translated"] });
      setSelectedReport(data.report);
      setShowTranslate(false);
      setReportText("");
      toast({
        title: "Report Translated",
        description: "Your imaging report has been translated into plain language.",
      });
    },
    onError: () => {
      toast({
        title: "Translation Failed",
        description: "Unable to translate report. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-imaging-translator">
          <FileImage className="h-4 w-4" />
          Imaging Translator
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5 text-primary" />
            Imaging Report Translator
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {selectedReport ? (
            <div className="space-y-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedReport(null)}
                data-testid="button-back-to-list"
              >
                Back to list
              </Button>
              <ScrollArea className="h-[500px] pr-4">
                <TranslatedReportView report={selectedReport} />
              </ScrollArea>
            </div>
          ) : showTranslate ? (
            <div className="space-y-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowTranslate(false)}
                data-testid="button-cancel-translate"
              >
                Cancel
              </Button>
              <div className="space-y-2">
                <p className="text-sm font-medium">Paste your radiology report:</p>
                <Textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="Paste the text of your imaging/radiology report here..."
                  className="min-h-[200px] text-sm"
                  data-testid="textarea-report-input"
                />
                <div className="p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                  <p className="font-medium mb-1">What we'll do:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Identify what was scanned</li>
                    <li>Extract key findings in plain language</li>
                    <li>Explain medical terms in simple words</li>
                    <li>Provide reassuring context</li>
                  </ul>
                </div>
              </div>
              <Button 
                onClick={() => translateMutation.mutate(reportText)}
                disabled={!reportText.trim() || translateMutation.isPending}
                className="w-full gap-2"
                data-testid="button-translate-report"
              >
                <Sparkles className="h-4 w-4" />
                {translateMutation.isPending ? "Translating..." : "Translate Report"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Button 
                onClick={() => setShowTranslate(true)} 
                className="w-full gap-2"
                data-testid="button-new-translation"
              >
                <Sparkles className="h-4 w-4" />
                Translate New Report
              </Button>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4" />
                <span>Previously translated reports</span>
              </div>

              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
              ) : reports && reports.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {reports.map((report) => (
                      <ReportCard 
                        key={report.id} 
                        report={report} 
                        onView={() => setSelectedReport(report)} 
                      />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileImage className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="font-medium">No translated reports yet</p>
                  <p className="text-sm text-muted-foreground">Paste a radiology report to get started</p>
                </div>
              )}

              <div className="p-3 rounded-lg bg-primary/10">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-medium text-foreground">Understand Your Imaging Results</p>
                    <p className="text-muted-foreground">
                      Our translator breaks down radiology reports into simple language, 
                      explains medical terms, and helps you feel informed before your next appointment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ImagingTranslatorCard() {
  return (
    <Card data-testid="card-imaging-translator">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileImage className="h-5 w-5 text-primary" />
          Imaging Translator
        </CardTitle>
        <CardDescription>Understand your radiology reports</CardDescription>
      </CardHeader>
      <CardContent>
        <ImagingReportTranslator />
        <p className="text-xs text-muted-foreground mt-2">
          Plain-language explanations of CT, MRI, X-ray, and ultrasound reports
        </p>
      </CardContent>
    </Card>
  );
}
