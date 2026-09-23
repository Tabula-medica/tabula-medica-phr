import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  FileText,
  Upload,
  Quote,
  BookOpen,
  MessageCircleQuestion,
  ChevronRight,
  Calendar,
  Building,
  Sparkles,
  FileCheck,
  Stethoscope,
  Pill,
  Activity,
  AlertTriangle,
  TestTube,
  CheckCircle,
  Database,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TutorialCard } from "@/components/onboarding";
import { TranslateButton } from "@/components/translate-button";
import { clickable } from "@/lib/a11y";

interface DocumentQuote {
  text: string;
  section: string;
  pageNumber?: number;
}

interface DocumentSummarySection {
  title: string;
  explanation: string;
  quotes: DocumentQuote[];
  questionsForClinician: string[];
}

interface DocumentSummary {
  documentId: string;
  documentName: string;
  documentType: string;
  documentDate: string;
  source: string;
  overallSummary: string;
  sections: DocumentSummarySection[];
  keyTerms: Array<{
    term: string;
    definition: string;
    whereInDocument: string;
  }>;
  disclaimer: string;
}

interface ExtractedDiagnosis {
  id: string;
  name: string;
  icdCode?: string;
  quote: string;
  section: string;
  status?: string;
}

interface ExtractedMedication {
  id: string;
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  quote: string;
  section: string;
}

interface ExtractedProcedure {
  id: string;
  name: string;
  cptCode?: string;
  date?: string;
  quote: string;
  section: string;
}

interface ExtractedAllergy {
  id: string;
  allergen: string;
  reaction?: string;
  severity?: string;
  quote: string;
  section: string;
}

interface ExtractedLabResult {
  id: string;
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  date?: string;
  quote: string;
  section: string;
}

interface ExtractedEntities {
  documentId: string;
  documentName: string;
  diagnoses: ExtractedDiagnosis[];
  medications: ExtractedMedication[];
  procedures: ExtractedProcedure[];
  allergies: ExtractedAllergy[];
  labResults: ExtractedLabResult[];
  extractedAt: string;
  disclaimer: string;
}

interface AutoPopulateResult {
  success: boolean;
  populatedEntities: {
    diagnoses: number;
    medications: number;
    procedures: number;
    allergies: number;
    labResults: number;
  };
  errors: string[];
  timestamp: string;
}

function SummarySection({ section }: { section: DocumentSummarySection }) {
  return (
    <AccordionItem value={section.title} className="border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline" data-testid={`accordion-section-${section.title}`}>
        <div className="flex items-center gap-2 text-left">
          <BookOpen className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium">{section.title}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pt-2">
          {/* Part 1: Quote First (protects us) */}
          {section.quotes.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Quote className="h-3 w-3" />
                Quote:
              </p>
              <div className="space-y-2">
                {section.quotes.map((quote, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/50 border-l-2 border-primary">
                    <p className="text-sm italic">"{quote.text}"</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ({quote.section}
                      {quote.pageNumber && `, Page ${quote.pageNumber}`})
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Part 2: Explain terminology */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Explain:</p>
            <p className="text-sm">{section.explanation}</p>
          </div>

          {/* Part 3: Questions for Clinician */}
          {section.questionsForClinician.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <MessageCircleQuestion className="h-3 w-3" />
                Questions to ask your clinician:
              </p>
              <ul className="space-y-1">
                {section.questionsForClinician.map((q, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function EntityCard({ 
  icon: Icon, 
  label, 
  quote, 
  section, 
  details 
}: { 
  icon: React.ElementType; 
  label: string; 
  quote: string; 
  section: string;
  details?: React.ReactNode;
}) {
  return (
    <div className="p-3 rounded-lg border">
      <div className="flex items-start gap-2 mb-2">
        <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-sm">{label}</p>
          {details}
        </div>
      </div>
      <div className="pl-6">
        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
          <Quote className="h-3 w-3" />
          Quote:
        </p>
        <p className="text-xs italic bg-muted/50 p-2 rounded border-l-2 border-primary">
          "{quote}"
        </p>
        <p className="text-xs text-muted-foreground mt-1">({section})</p>
      </div>
    </div>
  );
}

export function DocumentSummaryCard() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("summary");

  // Sample document list
  const documents = [
    { id: "doc-1", name: "Visit Summary - Jan 2024", type: "Visit Summary", date: "2024-01-15", source: "Primary Care Clinic" },
    { id: "doc-2", name: "Lab Results - Jan 2024", type: "Lab Report", date: "2024-01-10", source: "Quest Diagnostics" },
    { id: "doc-3", name: "Discharge Summary - Dec 2023", type: "Discharge Summary", date: "2023-12-20", source: "Springfield Hospital" },
  ];

  const { data: summary, isLoading } = useQuery<DocumentSummary>({
    queryKey: ["/api/documents", selectedDocumentId, "summary"],
    queryFn: async () => {
      const res = await fetch(`/api/documents/${selectedDocumentId}/summary`);
      if (!res.ok) throw new Error("Failed to get summary");
      return res.json();
    },
    enabled: !!selectedDocumentId && open,
  });

  const { data: entities, isLoading: entitiesLoading } = useQuery<ExtractedEntities>({
    queryKey: ["/api/documents", selectedDocumentId, "entities"],
    queryFn: async () => {
      const res = await fetch(`/api/documents/${selectedDocumentId}/entities`);
      if (!res.ok) throw new Error("Failed to extract entities");
      return res.json();
    },
    enabled: !!selectedDocumentId && open && activeTab === "entities",
  });

  const autoPopulateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/documents/${selectedDocumentId}/auto-populate`);
      return await res.json() as AutoPopulateResult;
    },
    onSuccess: (data) => {
      const total = 
        data.populatedEntities.diagnoses + 
        data.populatedEntities.medications + 
        data.populatedEntities.procedures + 
        data.populatedEntities.allergies + 
        data.populatedEntities.labResults;
      toast({
        title: "Records Updated",
        description: `${total} items from this document have been added to your health records.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conditions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/allergies"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to populate records. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSelectDocument = (docId: string) => {
    setSelectedDocumentId(docId);
    setActiveTab("summary");
  };

  const totalEntities = entities 
    ? entities.diagnoses.length + entities.medications.length + entities.procedures.length + entities.allergies.length + entities.labResults.length
    : 0;

  return (
    <Card data-testid="card-document-summary">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          Document Summaries
        </CardTitle>
        <CardDescription>AI summaries of your health documents</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" data-testid="button-view-documents">
              <Sparkles className="h-4 w-4 mr-2" />
              Summarize Documents
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Document Summary
              </DialogTitle>
              <DialogDescription>
                Select a document to see a quote-based summary with explanations.
              </DialogDescription>
            </DialogHeader>

            {!selectedDocumentId ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Select a document to summarize:</p>
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-lg border hover-elevate cursor-pointer"
                    {...clickable(() => handleSelectDocument(doc.id))}
                    data-testid={`document-${doc.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <FileCheck className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium">{doc.name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {doc.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {doc.source}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline">{doc.type}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : summary ? (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="w-full justify-start mb-2">
                  <TabsTrigger value="summary" data-testid="tab-summary">
                    <FileText className="h-4 w-4 mr-2" />
                    Summary
                  </TabsTrigger>
                  <TabsTrigger value="entities" data-testid="tab-entities">
                    <Database className="h-4 w-4 mr-2" />
                    Extracted Data
                    {totalEntities > 0 && (
                      <Badge variant="secondary" className="ml-2">{totalEntities}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1">
                  <TabsContent value="summary" className="m-0">
                    <div className="space-y-4 pr-4">
                      {/* Document Header */}
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium">{summary.documentName}</h3>
                          <Badge variant="secondary">{summary.documentType}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {summary.documentDate}
                          </span>
                          <span className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {summary.source}
                          </span>
                        </div>
                      </div>

                      {/* Overall Summary */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">This document shows:</p>
                        <p className="text-sm" data-testid="text-overall-summary">{summary.overallSummary}</p>
                      </div>

                      <Separator />

                      {/* Sections */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Document sections:</p>
                        <Accordion type="multiple" className="space-y-2">
                          {summary.sections.map((section, i) => (
                            <SummarySection key={i} section={section} />
                          ))}
                        </Accordion>
                      </div>

                      {/* Key Terms */}
                      {summary.keyTerms.length > 0 && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Terms explained:</p>
                            <div className="space-y-2">
                              {summary.keyTerms.map((term, i) => (
                                <div key={i} className="p-3 rounded-lg border" data-testid={`term-${i}`}>
                                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                    <Quote className="h-3 w-3" />
                                    Quote:
                                  </p>
                                  <p className="text-sm italic mb-2">"{term.whereInDocument}"</p>
                                  <p className="text-xs text-muted-foreground mb-1">Explain:</p>
                                  <p className="text-sm"><span className="font-medium">{term.term}</span> — {term.definition}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setSelectedDocumentId(null)}
                          className="flex-1"
                          data-testid="button-back-to-documents"
                        >
                          Back to Documents
                        </Button>
                        <TranslateButton
                          documentId={summary.documentId}
                          documentType="discharge_summary"
                          originalTitle={summary.documentName}
                          originalContent={summary.overallSummary}
                          variant="outline"
                          className="flex-1"
                        />
                      </div>

                      {/* Disclaimer */}
                      <div className="p-2 rounded-lg bg-muted/50 border">
                        <p className="text-xs text-muted-foreground text-center">
                          {summary.disclaimer}
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="entities" className="m-0">
                    <div className="space-y-4 pr-4">
                      {/* Document Header */}
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium">{summary.documentName}</h3>
                          <Badge variant="secondary">{summary.documentType}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Medical entities extracted from this document with quote attribution.
                        </p>
                      </div>

                      {entitiesLoading ? (
                        <div className="space-y-3">
                          <Skeleton className="h-20" />
                          <Skeleton className="h-20" />
                          <Skeleton className="h-20" />
                        </div>
                      ) : entities ? (
                        <>
                          {/* Auto-populate button */}
                          <Button
                            onClick={() => autoPopulateMutation.mutate()}
                            disabled={autoPopulateMutation.isPending || totalEntities === 0}
                            className="w-full"
                            data-testid="button-auto-populate"
                          >
                            {autoPopulateMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-2" />
                            )}
                            Add {totalEntities} Items to Health Records
                          </Button>

                          {/* Diagnoses */}
                          {entities.diagnoses.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                <Stethoscope className="h-3 w-3" />
                                Diagnoses ({entities.diagnoses.length})
                              </p>
                              <div className="space-y-2">
                                {entities.diagnoses.map((diag) => (
                                  <EntityCard
                                    key={diag.id}
                                    icon={Stethoscope}
                                    label={diag.name}
                                    quote={diag.quote}
                                    section={diag.section}
                                    details={
                                      <div className="flex gap-2 mt-1">
                                        {diag.icdCode && <Badge variant="outline" className="text-xs">{diag.icdCode}</Badge>}
                                        {diag.status && <Badge variant="secondary" className="text-xs">{diag.status}</Badge>}
                                      </div>
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Medications */}
                          {entities.medications.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                <Pill className="h-3 w-3" />
                                Medications ({entities.medications.length})
                              </p>
                              <div className="space-y-2">
                                {entities.medications.map((med) => (
                                  <EntityCard
                                    key={med.id}
                                    icon={Pill}
                                    label={med.name}
                                    quote={med.quote}
                                    section={med.section}
                                    details={
                                      <p className="text-xs text-muted-foreground">
                                        {[med.dosage, med.frequency, med.route].filter(Boolean).join(" • ")}
                                      </p>
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Procedures */}
                          {entities.procedures.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                Procedures ({entities.procedures.length})
                              </p>
                              <div className="space-y-2">
                                {entities.procedures.map((proc) => (
                                  <EntityCard
                                    key={proc.id}
                                    icon={Activity}
                                    label={proc.name}
                                    quote={proc.quote}
                                    section={proc.section}
                                    details={
                                      <div className="flex gap-2 mt-1">
                                        {proc.cptCode && <Badge variant="outline" className="text-xs">{proc.cptCode}</Badge>}
                                        {proc.date && <span className="text-xs text-muted-foreground">{proc.date}</span>}
                                      </div>
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Allergies */}
                          {entities.allergies.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Allergies ({entities.allergies.length})
                              </p>
                              <div className="space-y-2">
                                {entities.allergies.map((allergy) => (
                                  <EntityCard
                                    key={allergy.id}
                                    icon={AlertTriangle}
                                    label={allergy.allergen}
                                    quote={allergy.quote}
                                    section={allergy.section}
                                    details={
                                      <div className="flex gap-2 mt-1">
                                        {allergy.reaction && <Badge variant="outline" className="text-xs">{allergy.reaction}</Badge>}
                                        {allergy.severity && <Badge variant="secondary" className="text-xs">{allergy.severity}</Badge>}
                                      </div>
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Lab Results */}
                          {entities.labResults.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                <TestTube className="h-3 w-3" />
                                Lab Results ({entities.labResults.length})
                              </p>
                              <div className="space-y-2">
                                {entities.labResults.map((lab) => (
                                  <EntityCard
                                    key={lab.id}
                                    icon={TestTube}
                                    label={lab.testName}
                                    quote={lab.quote}
                                    section={lab.section}
                                    details={
                                      <div className="text-xs text-muted-foreground">
                                        <span className="font-medium">{lab.value} {lab.unit}</span>
                                        {lab.referenceRange && <span className="ml-2">(Ref: {lab.referenceRange})</span>}
                                      </div>
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : null}

                      {/* Back Button */}
                      <Button
                        variant="outline"
                        onClick={() => setSelectedDocumentId(null)}
                        className="w-full"
                        data-testid="button-back-to-documents-entities"
                      >
                        Back to Documents
                      </Button>

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
