import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { FieldCaption } from "@/components/ui/field-caption";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Languages, 
  FileText,
  ArrowRight,
  Loader2,
  Copy,
  Check,
  BookOpen,
  FileSearch,
  Clock,
  AlertCircle,
  Sparkles,
  Shield,
  AlertTriangle,
  Info,
} from "lucide-react";
import { MedicalDisclaimer, VerifyWithClinicianBanner } from "@/components/translation/MedicalDisclaimer";
import { SourceGroundedSummary } from "@/components/translation/SourceGroundedSummary";
import { clickable } from "@/lib/a11y";

interface Language {
  code: string;
  name: string;
  locale: string;
}

interface TranslatedSection {
  originalText: string;
  translatedText: string;
  sectionType?: string;
}

interface GlossaryTerm {
  term: string;
  originalTerm: string;
  definition: string;
}

interface TranslationResult {
  originalContent: string;
  translatedContent: string;
  sourceLanguage: string;
  sourceLanguageName: string;
  targetLanguage: string;
  targetLanguageName: string;
  documentType: string;
  sections: TranslatedSection[];
  medicalTermsGlossary: GlossaryTerm[];
  summary: string;
  confidence: number;
  processingTimeMs: number;
}

interface GuardrailTranslationResult {
  translatedText: string;
  originalText: string;
  sourceDocument: {
    name: string;
    date: string;
    source: string;
    id?: string;
  };
  highlightedSentences: Array<{
    original: string;
    translated: string;
    index: number;
  }>;
  disclaimer: string;
  verifyBanner?: string;
  isHighRisk: boolean;
  targetLanguage: string;
}

const DOCUMENT_TYPES = [
  { value: "clinical_note", label: "Clinical Note", description: "Provider visit notes" },
  { value: "lab_report", label: "Lab Report", description: "Laboratory results" },
  { value: "discharge_summary", label: "Discharge Summary", description: "Hospital discharge" },
  { value: "prescription", label: "Prescription", description: "Medication orders" },
  { value: "imaging_report", label: "Imaging Report", description: "X-ray, MRI, CT results" },
  { value: "general", label: "General Document", description: "Other medical documents" },
];

const SAMPLE_DOCUMENTS: Record<string, { language: string; content: string }> = {
  spanish_lab: {
    language: "es",
    content: `INFORME DE LABORATORIO
Paciente: María García
Fecha: 15/01/2024

HEMOGRAMA COMPLETO
- Hemoglobina: 12.5 g/dL (Normal: 12.0-16.0)
- Hematocrito: 38% (Normal: 36-46%)
- Leucocitos: 7,200/uL (Normal: 4,500-11,000)
- Plaquetas: 250,000/uL (Normal: 150,000-400,000)

PERFIL LIPÍDICO
- Colesterol total: 195 mg/dL (Deseable: <200)
- HDL: 55 mg/dL (Normal: >40)
- LDL: 120 mg/dL (Óptimo: <100)
- Triglicéridos: 145 mg/dL (Normal: <150)

CONCLUSIÓN: Resultados dentro de parámetros normales.`,
  },
  french_note: {
    language: "fr",
    content: `NOTE CLINIQUE
Patient: Jean Dupont
Date de consultation: 20/01/2024

MOTIF DE CONSULTATION:
Le patient se présente pour un contrôle de routine de son hypertension artérielle.

ANTÉCÉDENTS:
- Hypertension artérielle diagnostiquée il y a 5 ans
- Diabète de type 2 depuis 3 ans
- Pas d'allergies médicamenteuses connues

EXAMEN PHYSIQUE:
- Tension artérielle: 135/85 mmHg
- Pouls: 72 bpm, régulier
- Poids: 82 kg

PLAN:
Continuer le traitement actuel. Contrôle dans 3 mois.`,
  },
  german_prescription: {
    language: "de",
    content: `REZEPT
Patient: Hans Müller
Geburtsdatum: 15.03.1965
Datum: 22.01.2024

MEDIKAMENTE:

1. Metformin 500 mg
   Dosierung: 2x täglich zu den Mahlzeiten
   Menge: 60 Tabletten

2. Lisinopril 10 mg
   Dosierung: 1x täglich morgens
   Menge: 30 Tabletten

3. Atorvastatin 20 mg
   Dosierung: 1x täglich abends
   Menge: 30 Tabletten

HINWEISE:
- Regelmäßige Blutzuckerkontrolle empfohlen
- Nächste Kontrolle in 4 Wochen`,
  },
};

export default function DocumentTranslationPage() {
  const { toast } = useToast();
  const [sourceLanguage, setSourceLanguage] = useState<string>("auto");
  const [targetLanguage, setTargetLanguage] = useState<string>("en");
  const [documentType, setDocumentType] = useState<string>("general");
  const [documentContent, setDocumentContent] = useState<string>("");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [guardrailResult, setGuardrailResult] = useState<GuardrailTranslationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("input");
  const [documentName, setDocumentName] = useState<string>("");

  const { data: languagesData } = useQuery<{ success: boolean; data: { tier1: Language[]; tier2: Language[]; all: Language[] } }>({
    queryKey: ["/api/translation/languages"],
  });

  const languages = languagesData?.data?.all || [];

  const validateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/translation/validate", { text: documentContent });
      return await res.json() as { success: boolean; data: { isAllowed: boolean; violations: string[]; containsHighRiskContent: boolean; highRiskTermsFound: string[]; preservedClinicalTerms: string[] } };
    },
    onSuccess: (data) => {
      if (!data.data.isAllowed) {
        toast({
          title: "Content Warning",
          description: `Found ${data.data.violations.length} safety violations that will be handled.`,
          variant: "destructive",
        });
      } else if (data.data.containsHighRiskContent) {
        toast({
          title: "High-Risk Content",
          description: `Detected sensitive medical terms: ${data.data.highRiskTermsFound.slice(0, 3).join(", ")}`,
        });
      }
    },
  });

  const guardrailTranslateMutation = useMutation({
    mutationFn: async () => {
      const sourceDocument = {
        name: documentName || DOCUMENT_TYPES.find(t => t.value === documentType)?.label || "Medical Document",
        date: new Date().toISOString().split("T")[0],
        source: "Patient Records",
      };
      const res = await apiRequest("POST", "/api/translation/translate", {
        text: documentContent,
        targetLanguage,
        sourceDocument,
      });
      const data = await res.json();
      return data.data as GuardrailTranslationResult;
    },
    onSuccess: (data) => {
      setGuardrailResult(data);
      setActiveTab("result");
      toast({
        title: "Translation Complete",
        description: data.isHighRisk 
          ? "High-risk content detected. Please verify with your clinician."
          : "Document translated with safety guardrails.",
      });
    },
    onError: (error) => {
      console.error("Guardrail translation failed:", error);
      toast({
        title: "Translation Failed",
        description: "Could not translate the document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const guardrailSummarizeMutation = useMutation({
    mutationFn: async () => {
      const sourceDocument = {
        name: documentName || DOCUMENT_TYPES.find(t => t.value === documentType)?.label || "Medical Document",
        date: new Date().toISOString().split("T")[0],
        source: "Patient Records",
      };
      const res = await apiRequest("POST", "/api/translation/summarize", {
        text: documentContent,
        targetLanguage,
        sourceDocument,
      });
      const data = await res.json();
      return data.data as GuardrailTranslationResult;
    },
    onSuccess: (data) => {
      setGuardrailResult(data);
      setActiveTab("result");
      toast({
        title: "Summary Complete",
        description: "Document summarized with safety guardrails.",
      });
    },
    onError: (error) => {
      console.error("Guardrail summary failed:", error);
      toast({
        title: "Summary Failed",
        description: "Could not summarize the document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const loadSampleDocument = (key: string) => {
    const sample = SAMPLE_DOCUMENTS[key];
    if (sample) {
      setDocumentContent(sample.content);
      setSourceLanguage(sample.language);
      toast({
        title: "Sample Loaded",
        description: "Sample document loaded. Click Translate to see the result.",
      });
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const handleTranslate = () => {
    if (!documentContent.trim()) {
      toast({
        title: "No Content",
        description: "Please enter or paste document content to translate.",
        variant: "destructive",
      });
      return;
    }
    setGuardrailResult(null);
    guardrailTranslateMutation.mutate();
  };

  const handleSummarize = () => {
    if (!documentContent.trim()) {
      toast({
        title: "No Content",
        description: "Please enter or paste document content to summarize.",
        variant: "destructive",
      });
      return;
    }
    setGuardrailResult(null);
    guardrailSummarizeMutation.mutate();
  };

  const handleValidate = () => {
    if (!documentContent.trim()) {
      toast({
        title: "No Content",
        description: "Please enter or paste document content to validate.",
        variant: "destructive",
      });
      return;
    }
    validateMutation.mutate();
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <Languages className="h-7 w-7 text-primary" />
          Document Translation
        </h1>
        <p className="text-muted-foreground">
          Translate medical documents from any language to English. Get AI-powered medical term explanations and summaries.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              Source Language
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
              <SelectTrigger data-testid="select-source-language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {documentContent && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleValidate}
                disabled={validateMutation.isPending}
                className="w-full"
                data-testid="button-validate-content"
              >
                {validateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4 mr-1" />
                )}
                Check Safety
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              Target Language
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
              <SelectTrigger data-testid="select-target-language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Document Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger data-testid="select-document-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="input" className="flex items-center gap-2" data-testid="tab-input">
                <FileText className="h-4 w-4" />
                Document Input
              </TabsTrigger>
              <TabsTrigger 
                value="result" 
                className="flex items-center gap-2" 
                disabled={!result}
                data-testid="tab-result"
              >
                <Languages className="h-4 w-4" />
                Translation Result
              </TabsTrigger>
            </TabsList>

            <TabsContent value="input" className="space-y-4 mt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FieldCaption>Document Content</FieldCaption>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadSampleDocument("spanish_lab")}
                      data-testid="button-sample-spanish"
                    >
                      Spanish Lab
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadSampleDocument("french_note")}
                      data-testid="button-sample-french"
                    >
                      French Note
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadSampleDocument("german_prescription")}
                      data-testid="button-sample-german"
                    >
                      German Rx
                    </Button>
                  </div>
                </div>
                <Textarea
                  placeholder="Paste or type your medical document content here..."
                  value={documentContent}
                  onChange={(e) => setDocumentContent(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                  data-testid="textarea-document-content"
                />
                <p className="text-xs text-muted-foreground">
                  {documentContent.length} characters
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleTranslate}
                  disabled={!documentContent.trim() || guardrailTranslateMutation.isPending || guardrailSummarizeMutation.isPending}
                  size="lg"
                  data-testid="button-translate"
                >
                  {guardrailTranslateMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Translating...
                    </>
                  ) : (
                    <>
                      <Languages className="h-5 w-5 mr-2" />
                      Translate
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleSummarize}
                  disabled={!documentContent.trim() || guardrailTranslateMutation.isPending || guardrailSummarizeMutation.isPending}
                  size="lg"
                  variant="secondary"
                  data-testid="button-summarize"
                >
                  {guardrailSummarizeMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Summarizing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Summarize
                    </>
                  )}
                </Button>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Safety Guardrails Active:</strong> Translations are HIPAA-compliant. Medical advice and treatment recommendations are blocked.
                </AlertDescription>
              </Alert>
            </TabsContent>

            <TabsContent value="result" className="space-y-4 mt-4">
              {guardrailResult && (
                <div className="space-y-4">
                  <SourceGroundedSummary
                    translatedText={guardrailResult.translatedText}
                    originalText={guardrailResult.originalText}
                    sourceDocument={guardrailResult.sourceDocument}
                    highlightedSentences={guardrailResult.highlightedSentences}
                    disclaimer={guardrailResult.disclaimer}
                    verifyBanner={guardrailResult.verifyBanner}
                    isHighRisk={guardrailResult.isHighRisk}
                    targetLanguage={guardrailResult.targetLanguage}
                    onViewOriginal={() => setActiveTab("input")}
                  />

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setGuardrailResult(null);
                        setActiveTab("input");
                      }}
                      className="flex-1"
                      data-testid="button-new-translation-guardrail"
                    >
                      New Translation
                    </Button>
                    <Button
                      onClick={() => copyToClipboard(guardrailResult.translatedText)}
                      className="flex-1"
                      data-testid="button-copy-guardrail-result"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Translation
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {result && !guardrailResult && (
                <>
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <Badge variant="secondary" className="text-sm">
                      {result.sourceLanguageName} → {result.targetLanguageName}
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      <Clock className="h-3 w-3 mr-1" />
                      {result.processingTimeMs}ms
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      <Check className="h-3 w-3 mr-1" />
                      {Math.round(result.confidence * 100)}% confidence
                    </Badge>
                  </div>

                  {result.summary && (
                    <Card className="bg-primary/5 border-primary/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          AI Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{result.summary}</p>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span>Original ({result.sourceLanguageName})</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(result.originalContent)}
                            data-testid="button-copy-original"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-64">
                          <pre className="text-sm whitespace-pre-wrap font-mono">
                            {result.originalContent}
                          </pre>
                        </ScrollArea>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span>Translated ({result.targetLanguageName})</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(result.translatedContent)}
                            data-testid="button-copy-translated"
                          >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-64">
                          <pre className="text-sm whitespace-pre-wrap font-mono">
                            {result.translatedContent}
                          </pre>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>

                  {result.medicalTermsGlossary.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          Medical Terms Glossary
                        </CardTitle>
                        <CardDescription>
                          Key medical terms from the document with explanations
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {result.medicalTermsGlossary.map((term, index) => (
                            <div
                              key={index}
                              className="p-3 rounded-lg bg-muted/50 space-y-1"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{term.term}</span>
                                {term.originalTerm !== term.term && (
                                  <Badge variant="outline" className="text-xs">
                                    {term.originalTerm}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {term.definition}
                              </p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setResult(null);
                        setActiveTab("input");
                      }}
                      className="flex-1"
                      data-testid="button-new-translation"
                    >
                      New Translation
                    </Button>
                    <Button
                      onClick={() => copyToClipboard(result.translatedContent)}
                      className="flex-1"
                      data-testid="button-copy-result"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Translation
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Supported Document Types
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {DOCUMENT_TYPES.map((type) => (
              <div
                key={type.value}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  documentType === type.value
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
                {...clickable(() => setDocumentType(type.value))}
                data-testid={`doctype-${type.value}`}
              >
                <p className="font-medium text-sm">{type.label}</p>
                <p className="text-xs text-muted-foreground">{type.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-safety-compliance">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Safety Compliance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                Allowed Actions
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Translate document text</li>
                <li>Summarize content</li>
                <li>Explain medical definitions</li>
                <li>Preserve clinical terms</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Blocked Actions
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>"You should..." recommendations</li>
                <li>"This means you need treatment"</li>
                <li>Urgency instructions ("Go to ER")</li>
                <li>Dosage adjustments</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <MedicalDisclaimer languageCode={targetLanguage} variant="footer" />
    </div>
  );
}
