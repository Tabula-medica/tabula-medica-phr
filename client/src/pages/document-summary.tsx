import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Loader2,
  Quote,
  Pill,
  Calendar,
  AlertCircle,
  ChevronRight,
  Globe,
  Building2,
  ClipboardList,
  AlertTriangle,
} from "lucide-react";
import { AiSummaryFeedback } from "@/components/ai-summary-feedback";

interface DocumentSummary {
  language: string;
  document_type: string;
  provenance: {
    source: string;
    date: string;
    record_id: string;
  };
  what_this_is: string;
  key_points: string[];
  medications_mentioned: string[];
  follow_up_items_as_written: string[];
  quoted_evidence: Array<{
    quote: string;
    location_hint?: string;
    source: string;
    date: string;
    record_id: string;
  }>;
  limitations: string[];
  disclaimer: string;
}

const DOCUMENT_TYPES = [
  { value: "discharge_summary", label: "Discharge Summary" },
  { value: "clinic_note", label: "Clinic Note" },
  { value: "referral_letter", label: "Referral Letter" },
  { value: "lab_report", label: "Lab Report" },
  { value: "imaging_report", label: "Imaging Report" },
  { value: "procedure_note", label: "Procedure Note" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "zh-CN", label: "中文" },
  { value: "vi", label: "Tiếng Việt" },
  { value: "ar", label: "العربية" },
  { value: "fr", label: "Français" },
  { value: "ko", label: "한국어" },
  { value: "pt", label: "Português" },
];

export default function DocumentSummaryPage() {
  const [documentText, setDocumentText] = useState("");
  const [documentType, setDocumentType] = useState("discharge_summary");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [sourceSystem, setSourceSystem] = useState("");
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split("T")[0]);
  const [recordId, setRecordId] = useState("");
  const [summary, setSummary] = useState<DocumentSummary | null>(null);

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/translation/document-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLanguage,
          documentType,
          documentText,
          provenance: {
            sourceSystem: sourceSystem || "Unknown Source",
            documentDate,
            recordId: recordId || `DOC-${Date.now()}`,
          },
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setSummary(data.data);
      }
    },
  });

  const handleGenerateSummary = () => {
    if (documentText.trim()) {
      generateSummaryMutation.mutate();
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
          <FileText className="h-7 w-7 text-primary" />
          Document Summary
        </h1>
        <p className="text-muted-foreground">
          Generate AI-powered summaries of medical documents with quote-first grounding
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-document-input">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Document Input
            </CardTitle>
            <CardDescription>
              Paste your document text and configure summary options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Document Type</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger data-testid="select-document-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Summary Language</Label>
                <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                  <SelectTrigger data-testid="select-language">
                    <Globe className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Source System</Label>
                <Input
                  placeholder="e.g., Fasten Health"
                  value={sourceSystem}
                  onChange={(e) => setSourceSystem(e.target.value)}
                  data-testid="input-source-system"
                />
              </div>
              <div className="space-y-2">
                <Label>Document Date</Label>
                <Input
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  data-testid="input-document-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Record ID</Label>
                <Input
                  placeholder="e.g., DOC-12345"
                  value={recordId}
                  onChange={(e) => setRecordId(e.target.value)}
                  data-testid="input-record-id"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Document Text</Label>
              <Textarea
                placeholder="Paste the document text here..."
                className="min-h-[300px] font-mono text-sm"
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
                data-testid="textarea-document"
              />
            </div>

            <Button
              onClick={handleGenerateSummary}
              disabled={!documentText.trim() || generateSummaryMutation.isPending}
              className="w-full"
              data-testid="button-generate-summary"
            >
              {generateSummaryMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Summary...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Summary
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="card-document-summary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Summary Output
            </CardTitle>
            <CardDescription>
              AI-generated document summary with source citations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!summary ? (
              <div className="text-center py-12 text-muted-foreground">
                Enter document text and click Generate Summary to see results
              </div>
            ) : (
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{summary.document_type}</Badge>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      {summary.provenance.source}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {summary.provenance.date}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">What This Document Is</h4>
                    <p className="text-sm text-muted-foreground">{summary.what_this_is}</p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <ChevronRight className="h-4 w-4 text-green-500" />
                      Key Points
                    </h4>
                    <ul className="space-y-2">
                      {summary.key_points.map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Pill className="h-4 w-4 text-pink-500" />
                      Medications Mentioned
                    </h4>
                    <ul className="space-y-2">
                      {summary.medications_mentioned.map((med, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <span>{med}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-500" />
                      Follow-up Items (As Written)
                    </h4>
                    <ul className="space-y-2">
                      {summary.follow_up_items_as_written.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {summary.quoted_evidence.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Quote className="h-4 w-4 text-purple-500" />
                        Source Citations
                      </h4>
                      <div className="space-y-3">
                        {summary.quoted_evidence.map((evidence, i) => (
                          <div key={i} className="bg-muted/30 rounded-lg p-3 border-l-2 border-purple-500">
                            <p className="text-sm italic">"{evidence.quote}"</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {evidence.location_hint && `Section: ${evidence.location_hint} | `}
                              Source: {evidence.source} | Date: {evidence.date}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {summary.limitations.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        Limitations
                      </h4>
                      <ul className="space-y-1">
                        {summary.limitations.map((limitation, i) => (
                          <li key={i} className="text-sm text-muted-foreground">
                            {limitation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {summary.disclaimer}
                    </AlertDescription>
                  </Alert>

                  <AiSummaryFeedback
                    feedbackType="document_summary"
                    summaryId={`doc-${summary.provenance.record_id}`}
                  />
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
