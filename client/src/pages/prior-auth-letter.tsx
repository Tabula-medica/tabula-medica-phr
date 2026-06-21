import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, FileText, Copy, Check, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageGate } from "@/components/page-gate";

interface FormState {
  medicationOrProcedure: string;
  medicalCondition: string;
  insurancePlan: string;
  patientName: string;
  priorTreatmentsTried: string;
  denialReason: string;
}

interface GenerateResponse {
  letter: string;
  generatedBy: "ai" | "template";
  generatedAt: string;
  disclaimer: string;
}

const initialForm: FormState = {
  medicationOrProcedure: "",
  medicalCondition: "",
  insurancePlan: "",
  patientName: "",
  priorTreatmentsTried: "",
  denialReason: "",
};

export default function PriorAuthLetter() {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: async (payload: FormState) => {
      const res = await apiRequest("POST", "/api/prior-auth-letter/generate", payload);
      return (await res.json()) as GenerateResponse;
    },
    onSuccess: (data) => {
      setResult(data);
      setCopied(false);
    },
    onError: (err: any) => {
      toast({
        title: "Could not generate letter",
        description: err?.message || "Please try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.medicationOrProcedure.trim() || !form.medicalCondition.trim()) {
      toast({
        title: "Missing required fields",
        description: "Please fill in the medication/procedure and medical condition.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(form);
  };

  const onCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.letter);
    setCopied(true);
    toast({ title: "Letter copied to clipboard" });
    setTimeout(() => setCopied(false), 2500);
  };

  const onDownload = () => {
    if (!result) return;
    const blob = new Blob([result.letter], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prior-auth-letter-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onReset = () => {
    setForm(initialForm);
    setResult(null);
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8" data-testid="page-prior-auth-letter">
      <PageGate feature="prior_auth" />
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <FileText className="h-7 w-7 text-primary" />
          Prior Authorization Letter Generator
        </h1>
        <p className="mt-2 text-muted-foreground">
          When your insurance denies a medication or procedure your doctor recommends, you have the right to appeal. We'll help you draft a clear, professional letter you can send to your insurance company or hand to your provider.
        </p>
      </div>

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          This generates a <strong>draft letter</strong> based on what you enter. It is not medical or legal advice. Always review with your physician before sending.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Your information</CardTitle>
          <CardDescription>
            Required fields are marked with an asterisk. The more detail you provide, the stronger the letter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="medicationOrProcedure">
                  Medication or procedure needed <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="medicationOrProcedure"
                  data-testid="input-medication-or-procedure"
                  placeholder="e.g. Ozempic 1mg, MRI of lower back"
                  value={form.medicationOrProcedure}
                  onChange={(e) => setForm({ ...form, medicationOrProcedure: e.target.value })}
                  maxLength={200}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="medicalCondition">
                  Medical condition / diagnosis <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="medicalCondition"
                  data-testid="input-medical-condition"
                  placeholder="e.g. Type 2 diabetes, chronic lower back pain"
                  value={form.medicalCondition}
                  onChange={(e) => setForm({ ...form, medicalCondition: e.target.value })}
                  maxLength={500}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patientName">Your name (optional)</Label>
                <Input
                  id="patientName"
                  data-testid="input-patient-name"
                  placeholder="Jane Doe"
                  value={form.patientName}
                  onChange={(e) => setForm({ ...form, patientName: e.target.value })}
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="insurancePlan">Insurance plan (optional)</Label>
                <Input
                  id="insurancePlan"
                  data-testid="input-insurance-plan"
                  placeholder="e.g. Blue Cross Blue Shield PPO"
                  value={form.insurancePlan}
                  onChange={(e) => setForm({ ...form, insurancePlan: e.target.value })}
                  maxLength={200}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priorTreatmentsTried">Treatments already tried (optional)</Label>
              <Textarea
                id="priorTreatmentsTried"
                data-testid="input-prior-treatments"
                placeholder="e.g. Tried metformin for 6 months with insufficient blood-sugar control. Tried physical therapy 3x/week for 8 weeks without lasting improvement."
                value={form.priorTreatmentsTried}
                onChange={(e) => setForm({ ...form, priorTreatmentsTried: e.target.value })}
                maxLength={1000}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="denialReason">Reason your insurance gave for denying (optional)</Label>
              <Textarea
                id="denialReason"
                data-testid="input-denial-reason"
                placeholder="e.g. 'Not medically necessary' or 'Step therapy required'"
                value={form.denialReason}
                onChange={(e) => setForm({ ...form, denialReason: e.target.value })}
                maxLength={500}
                rows={2}
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={mutation.isPending} data-testid="button-generate">
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  "Generate letter"
                )}
              </Button>
              {(result || mutation.isPending) && (
                <Button type="button" variant="outline" onClick={onReset} data-testid="button-reset">
                  Start over
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card className="mt-6" data-testid="card-result">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Your draft letter</CardTitle>
              <CardDescription>
                Generated {result.generatedBy === "ai" ? "by AI" : "from template"} on{" "}
                {new Date(result.generatedAt).toLocaleString()}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onCopy} data-testid="button-copy">
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" variant="outline" onClick={onDownload} data-testid="button-download">
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre
              className="whitespace-pre-wrap rounded-md bg-muted p-4 font-sans text-sm leading-relaxed"
              data-testid="text-letter-output"
            >
              {result.letter}
            </pre>
            <p className="mt-4 text-xs text-muted-foreground" data-testid="text-disclaimer">
              {result.disclaimer}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
