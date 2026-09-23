import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
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
  FlaskConical,
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Globe,
  Calendar,
  Building2,
  AlertTriangle,
} from "lucide-react";
import { AiSummaryFeedback } from "@/components/ai-summary-feedback";

interface LabInput {
  id: string;
  name: string;
  value: string;
  unit: string;
  reference_range: string;
  date: string;
  flag: string;
  source: string;
  record_id: string;
}

interface LabExplanation {
  test_name: string;
  date: string;
  value: string;
  reference_range: string;
  general_meaning: string;
  as_flagged_in_record: string;
  source: string;
  record_id: string;
}

interface LabExplanationResult {
  language: string;
  lab_explanations: LabExplanation[];
  questions_to_ask: string[];
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

const FLAG_OPTIONS = [
  { value: "none", label: "Not provided" },
  { value: "High", label: "High" },
  { value: "Low", label: "Low" },
  { value: "Normal", label: "Normal" },
  { value: "Critical", label: "Critical" },
];

function createEmptyLab(): LabInput {
  return {
    id: crypto.randomUUID(),
    name: "",
    value: "",
    unit: "",
    reference_range: "",
    date: new Date().toISOString().split("T")[0],
    flag: "",
    source: "",
    record_id: "",
  };
}

function getFlagIcon(flag: string) {
  switch (flag.toLowerCase()) {
    case "high":
      return <TrendingUp className="h-4 w-4 text-red-500" />;
    case "low":
      return <TrendingDown className="h-4 w-4 text-blue-500" />;
    case "normal":
      return <Minus className="h-4 w-4 text-green-500" />;
    case "critical":
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    default:
      return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function getFlagBadgeVariant(flag: string): "default" | "secondary" | "destructive" | "outline" {
  switch (flag.toLowerCase()) {
    case "high":
    case "critical":
      return "destructive";
    case "low":
      return "secondary";
    case "normal":
      return "default";
    default:
      return "outline";
  }
}

export default function LabExplanationPage() {
  const [labs, setLabs] = useState<LabInput[]>([createEmptyLab()]);
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [optionalSnippet, setOptionalSnippet] = useState("");
  const [result, setResult] = useState<LabExplanationResult | null>(null);

  const explainMutation = useMutation({
    mutationFn: async () => {
      const validLabs = labs.filter(l => l.name && l.value && l.unit && l.source && l.record_id);
      const res = await fetch("/api/translation/lab-explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLanguage,
          labs: validLabs.map(l => ({
            name: l.name,
            value: l.value,
            unit: l.unit,
            reference_range: l.reference_range,
            date: l.date,
            flag: l.flag === "none" ? undefined : l.flag || undefined,
            source: l.source,
            record_id: l.record_id,
          })),
          optionalRecordSnippet: optionalSnippet || undefined,
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

  const addLab = () => {
    setLabs([...labs, createEmptyLab()]);
  };

  const removeLab = (id: string) => {
    if (labs.length > 1) {
      setLabs(labs.filter(l => l.id !== id));
    }
  };

  const updateLab = (id: string, field: keyof LabInput, value: string) => {
    setLabs(labs.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const hasValidLabs = labs.some(l => l.name && l.value && l.unit && l.source && l.record_id);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
          <FlaskConical className="h-7 w-7 text-primary" />
          Lab Result Explanation
        </h1>
        <p className="text-muted-foreground">
          Get plain-language explanations of your lab results (educational only, not diagnostic)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-lab-input">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5" />
                  Lab Results Input
                </CardTitle>
                <CardDescription>
                  Enter your lab results to get explanations
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
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-6">
                {labs.map((lab, index) => (
                  <div key={lab.id} className="p-4 border rounded-lg space-y-4" data-testid={`lab-entry-${index}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">Lab #{index + 1}</span>
                      {labs.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLab(lab.id)}
                          data-testid={`button-remove-lab-${index}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 space-y-1">
                        <FieldCaption className="text-xs">Test Name *</FieldCaption>
                        <Input aria-label="Test Name *"
                          placeholder="e.g., Glucose, Hemoglobin"
                          value={lab.name}
                          onChange={(e) => updateLab(lab.id, "name", e.target.value)}
                          data-testid={`input-name-${index}`}
                        />
                      </div>

                      <div className="space-y-1">
                        <FieldCaption className="text-xs">Value *</FieldCaption>
                        <Input aria-label="Value *"
                          placeholder="e.g., 95"
                          value={lab.value}
                          onChange={(e) => updateLab(lab.id, "value", e.target.value)}
                          data-testid={`input-value-${index}`}
                        />
                      </div>

                      <div className="space-y-1">
                        <FieldCaption className="text-xs">Unit *</FieldCaption>
                        <Input aria-label="Unit *"
                          placeholder="e.g., mg/dL"
                          value={lab.unit}
                          onChange={(e) => updateLab(lab.id, "unit", e.target.value)}
                          data-testid={`input-unit-${index}`}
                        />
                      </div>

                      <div className="space-y-1">
                        <FieldCaption className="text-xs">Reference Range</FieldCaption>
                        <Input aria-label="Reference Range"
                          placeholder="e.g., 70-100"
                          value={lab.reference_range}
                          onChange={(e) => updateLab(lab.id, "reference_range", e.target.value)}
                          data-testid={`input-range-${index}`}
                        />
                      </div>

                      <div className="space-y-1">
                        <FieldCaption className="text-xs">Flag</FieldCaption>
                        <Select value={lab.flag} onValueChange={(v) => updateLab(lab.id, "flag", v)}>
                          <SelectTrigger aria-label="Flag" data-testid={`select-flag-${index}`}>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {FLAG_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <FieldCaption className="text-xs">Date</FieldCaption>
                        <Input aria-label="Date"
                          type="date"
                          value={lab.date}
                          onChange={(e) => updateLab(lab.id, "date", e.target.value)}
                          data-testid={`input-date-${index}`}
                        />
                      </div>

                      <div className="space-y-1">
                        <FieldCaption className="text-xs">Source</FieldCaption>
                        <Input aria-label="Source"
                          placeholder="e.g., Quest Diagnostics"
                          value={lab.source}
                          onChange={(e) => updateLab(lab.id, "source", e.target.value)}
                          data-testid={`input-source-${index}`}
                        />
                      </div>

                      <div className="col-span-2 space-y-1">
                        <FieldCaption className="text-xs">Record ID</FieldCaption>
                        <Input aria-label="Record ID"
                          placeholder="e.g., LAB-2024-001"
                          value={lab.record_id}
                          onChange={(e) => updateLab(lab.id, "record_id", e.target.value)}
                          data-testid={`input-record-id-${index}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Button variant="outline" onClick={addLab} className="w-full" data-testid="button-add-lab">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Lab
                </Button>

                <div className="space-y-2">
                  <Label htmlFor="lab-explanation-additional-context-optional" className="text-sm">Additional Context (Optional)</Label>
                  <Textarea id="lab-explanation-additional-context-optional"
                    placeholder="Paste any additional context from your health record..."
                    value={optionalSnippet}
                    onChange={(e) => setOptionalSnippet(e.target.value)}
                    className="min-h-[80px]"
                    data-testid="textarea-context"
                  />
                </div>

                <Button
                  onClick={() => explainMutation.mutate()}
                  disabled={!hasValidLabs || explainMutation.isPending}
                  className="w-full"
                  data-testid="button-explain"
                >
                  {explainMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Explanations...
                    </>
                  ) : (
                    <>
                      <FlaskConical className="h-4 w-4 mr-2" />
                      Explain Lab Results
                    </>
                  )}
                </Button>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card data-testid="card-lab-explanation">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Explanations
            </CardTitle>
            <CardDescription>
              Plain-language explanations of your lab results
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="text-center py-12 text-muted-foreground">
                Enter lab results and click Explain to see explanations
              </div>
            ) : (
              <ScrollArea className="h-[550px] pr-4">
                <div className="space-y-6">
                  {result.lab_explanations.map((lab, i) => (
                    <div key={i} className="p-4 border rounded-lg space-y-3" data-testid={`explanation-${i}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium">{lab.test_name}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            {lab.date}
                            <Building2 className="h-3 w-3 ml-2" />
                            {lab.source}
                          </div>
                        </div>
                        <Badge variant={getFlagBadgeVariant(lab.as_flagged_in_record)}>
                          {getFlagIcon(lab.as_flagged_in_record)}
                          <span className="ml-1">{lab.as_flagged_in_record}</span>
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Value:</span>
                          <p className="font-medium">{lab.value}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Reference Range:</span>
                          <p className="font-medium">{lab.reference_range}</p>
                        </div>
                      </div>

                      <div>
                        <span className="text-sm text-muted-foreground">What this test measures:</span>
                        <p className="text-sm mt-1">{lab.general_meaning}</p>
                      </div>
                    </div>
                  ))}

                  {result.questions_to_ask.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <HelpCircle className="h-4 w-4 text-blue-500" />
                        Questions to Ask Your Clinician
                      </h4>
                      <ul className="space-y-2">
                        {result.questions_to_ask.map((question, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-muted-foreground">{i + 1}.</span>
                            <span>{question}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.limitations.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        Limitations
                      </h4>
                      <ul className="space-y-1">
                        {result.limitations.map((limitation, i) => (
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
                      {result.disclaimer}
                    </AlertDescription>
                  </Alert>

                  <AiSummaryFeedback
                    feedbackType="lab_explanation"
                    summaryId={`lab-${result.lab_explanations[0]?.record_id || Date.now()}`}
                  />
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-lab-explanation-disclaimer" />
    </div>
  );
}