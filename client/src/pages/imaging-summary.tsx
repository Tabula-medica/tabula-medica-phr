import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileImage,
  Loader2,
  AlertCircle,
  Quote,
  Eye,
  FileText,
  Globe,
  Calendar,
  Building2,
  AlertTriangle,
  Scan,
} from "lucide-react";
import { AiSummaryFeedback } from "@/components/ai-summary-feedback";

interface ImagingQuotedEvidence {
  quote: string;
  source: string;
  date: string;
  record_id: string;
}

interface ImagingReportSummary {
  language: string;
  study: {
    modality: string;
    body_part: string;
  };
  provenance: {
    source: string;
    date: string;
    record_id: string;
  };
  impression_as_written: string[];
  key_findings_as_written: string[];
  comparison_as_written: string[];
  quoted_evidence: ImagingQuotedEvidence[];
  limitations: string[];
  disclaimer: string;
}

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

const MODALITIES = [
  { value: "X-Ray", label: "X-Ray" },
  { value: "CT", label: "CT Scan" },
  { value: "MRI", label: "MRI" },
  { value: "Ultrasound", label: "Ultrasound" },
  { value: "PET", label: "PET Scan" },
  { value: "Mammogram", label: "Mammogram" },
  { value: "Fluoroscopy", label: "Fluoroscopy" },
  { value: "Nuclear Medicine", label: "Nuclear Medicine" },
  { value: "Other", label: "Other" },
];

const BODY_PARTS = [
  { value: "Chest", label: "Chest" },
  { value: "Abdomen", label: "Abdomen" },
  { value: "Pelvis", label: "Pelvis" },
  { value: "Head/Brain", label: "Head/Brain" },
  { value: "Spine", label: "Spine" },
  { value: "Extremity", label: "Extremity (Arm/Leg)" },
  { value: "Heart", label: "Heart" },
  { value: "Breast", label: "Breast" },
  { value: "Neck", label: "Neck" },
  { value: "Other", label: "Other" },
];

export default function ImagingSummaryPage() {
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [modality, setModality] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [reportText, setReportText] = useState("");
  const [sourceSystem, setSourceSystem] = useState("");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [recordId, setRecordId] = useState("");
  const [result, setResult] = useState<ImagingReportSummary | null>(null);

  const summarizeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/translation/imaging-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLanguage,
          modality,
          body_part: bodyPart,
          report_text: reportText,
          source_system: sourceSystem,
          report_date: reportDate,
          record_id: recordId,
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setResult(data.data);
      }
    },
  });

  const isValid = modality && bodyPart && reportText && sourceSystem && recordId;

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
          <FileImage className="h-7 w-7 text-primary" />
          Imaging Report Summary
        </h1>
        <p className="text-muted-foreground">
          Get a quote-first summary of your imaging report (impression-focused, no interpretation beyond the report)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-imaging-input">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Scan className="h-5 w-5" />
                  Imaging Report Input
                </CardTitle>
                <CardDescription>
                  Enter your imaging report details
                </CardDescription>
              </div>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger className="w-[140px]" data-testid="select-language">
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
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[550px] pr-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Modality *</Label>
                    <Select value={modality} onValueChange={setModality}>
                      <SelectTrigger data-testid="select-modality">
                        <SelectValue placeholder="Select modality..." />
                      </SelectTrigger>
                      <SelectContent>
                        {MODALITIES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Body Part *</Label>
                    <Select value={bodyPart} onValueChange={setBodyPart}>
                      <SelectTrigger data-testid="select-body-part">
                        <SelectValue placeholder="Select body part..." />
                      </SelectTrigger>
                      <SelectContent>
                        {BODY_PARTS.map((bp) => (
                          <SelectItem key={bp.value} value={bp.value}>
                            {bp.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Report Text *</Label>
                  <Textarea
                    placeholder="Paste the full imaging report text here..."
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    className="min-h-[200px]"
                    data-testid="textarea-report"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Source System *</Label>
                    <Input
                      placeholder="e.g., RadNet"
                      value={sourceSystem}
                      onChange={(e) => setSourceSystem(e.target.value)}
                      data-testid="input-source"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Report Date</Label>
                    <Input
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      data-testid="input-date"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Record ID *</Label>
                  <Input
                    placeholder="e.g., IMG-2024-001"
                    value={recordId}
                    onChange={(e) => setRecordId(e.target.value)}
                    data-testid="input-record-id"
                  />
                </div>

                <Button
                  onClick={() => summarizeMutation.mutate()}
                  disabled={!isValid || summarizeMutation.isPending}
                  className="w-full"
                  data-testid="button-summarize"
                >
                  {summarizeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Summary...
                    </>
                  ) : (
                    <>
                      <FileImage className="h-4 w-4 mr-2" />
                      Summarize Report
                    </>
                  )}
                </Button>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card data-testid="card-imaging-summary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Summary
            </CardTitle>
            <CardDescription>
              Impression-focused summary with quoted findings
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="text-center py-12 text-muted-foreground">
                Enter report details and click Summarize to see the summary
              </div>
            ) : (
              <ScrollArea className="h-[550px] pr-4">
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center gap-2" data-testid="section-study-info">
                    <Badge variant="secondary" data-testid="badge-modality">
                      <FileImage className="h-3 w-3 mr-1" />
                      {result.study.modality}
                    </Badge>
                    <Badge variant="outline" data-testid="badge-body-part">
                      {result.study.body_part}
                    </Badge>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
                      <Building2 className="h-3 w-3" />
                      <span data-testid="text-source">{result.provenance.source}</span>
                      <Calendar className="h-3 w-3" />
                      <span data-testid="text-date">{result.provenance.date}</span>
                      <span className="text-xs" data-testid="text-record-id">ID: {result.provenance.record_id}</span>
                    </div>
                  </div>

                  {result.impression_as_written.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <Eye className="h-4 w-4 text-primary" />
                        Impression (as written)
                      </h4>
                      <div className="p-3 bg-muted/50 rounded-lg" data-testid="text-impression">
                        {result.impression_as_written.map((imp, i) => (
                          <p key={i} className="text-sm italic" data-testid={`text-impression-${i}`}>"{imp}"</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.key_findings_as_written.length > 0 && (
                    <div className="space-y-2" data-testid="section-findings">
                      <h4 className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        Key Findings (as written)
                      </h4>
                      <ul className="space-y-1">
                        {result.key_findings_as_written.map((finding, i) => (
                          <li key={i} className="text-sm flex items-start gap-2" data-testid={`text-finding-${i}`}>
                            <span className="text-muted-foreground">•</span>
                            <span>"{finding}"</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.comparison_as_written.length > 0 && (
                    <div className="space-y-2" data-testid="section-comparison">
                      <h4 className="font-medium flex items-center gap-2">
                        <Scan className="h-4 w-4 text-orange-500" />
                        Comparison (as written)
                      </h4>
                      <ul className="space-y-1">
                        {result.comparison_as_written.map((comp, i) => (
                          <li key={i} className="text-sm italic" data-testid={`text-comparison-${i}`}>"{comp}"</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.quoted_evidence.length > 0 && (
                    <div className="space-y-2" data-testid="section-evidence">
                      <h4 className="font-medium flex items-center gap-2">
                        <Quote className="h-4 w-4 text-green-500" />
                        Quoted Evidence
                      </h4>
                      <div className="space-y-2">
                        {result.quoted_evidence.map((ev, i) => (
                          <div key={i} className="p-3 bg-muted/30 rounded-lg text-sm" data-testid={`evidence-${i}`}>
                            <p className="italic" data-testid={`text-evidence-quote-${i}`}>"{ev.quote}"</p>
                            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              <span data-testid={`text-evidence-source-${i}`}>{ev.source}</span>
                              <Calendar className="h-3 w-3" />
                              <span data-testid={`text-evidence-date-${i}`}>{ev.date}</span>
                              <span data-testid={`text-evidence-id-${i}`}>ID: {ev.record_id}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.limitations.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        Limitations
                      </h4>
                      <ul className="space-y-1">
                        {result.limitations.map((lim, i) => (
                          <li key={i} className="text-sm text-muted-foreground">
                            {lim}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Alert data-testid="alert-disclaimer">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm" data-testid="text-disclaimer">
                      {result.disclaimer}
                    </AlertDescription>
                  </Alert>

                  <AiSummaryFeedback
                    feedbackType="imaging_summary"
                    summaryId={`imaging-${result.provenance.record_id}`}
                  />
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-imaging-summary-disclaimer" />
    </div>
  );
}