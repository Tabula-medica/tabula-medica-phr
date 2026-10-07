import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import type { IntakeFormAssignment, IntakeFormTemplate } from "@shared/patient-operations";

function useToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("token");
}

type AnswerValue = string | boolean;

export default function IntakeFormPage() {
  const token = useToken();
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});

  const assignmentQuery = useQuery<{ assignment: IntakeFormAssignment; template: IntakeFormTemplate }>({
    queryKey: ["/api/patient-operations/intake", token],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`/api/patient-operations/intake/${token}`);
      if (!res.ok) throw new Error((await res.json()).error ?? "This link is not valid.");
      return res.json();
    },
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/patient-operations/intake/${token}/submit`, { answers });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.detail ?? body.error ?? "Could not submit this form.");
      }
      return res.json();
    },
  });

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md" data-testid="card-intake-missing-token">
          <CardHeader>
            <CardTitle>Missing link</CardTitle>
            <CardDescription>This page needs the link your clinic sent you — please open that link again.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (assignmentQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" data-testid="status-intake-loading" />
      </div>
    );
  }

  if (assignmentQuery.isError || !assignmentQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md" data-testid="card-intake-error">
          <CardHeader>
            <CardTitle>Link not available</CardTitle>
            <CardDescription>{(assignmentQuery.error as Error)?.message ?? "This link has already been used or has expired."}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { assignment, template } = assignmentQuery.data;

  if (assignment.status === "submitted" || submitMutation.isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md" data-testid="card-intake-submitted">
          <CardHeader>
            <CardTitle>Thank you</CardTitle>
            <CardDescription>Your form has been submitted securely. You can close this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (assignment.status === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md" data-testid="card-intake-expired">
          <CardHeader>
            <CardTitle>Link expired</CardTitle>
            <CardDescription>This intake link is no longer valid. Please ask your clinic to send a new one.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen justify-center p-4 py-10">
      <Card className="w-full max-w-xl" data-testid="card-intake-form">
        <CardHeader>
          <CardTitle>{template.title}</CardTitle>
          <CardDescription>{template.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {template.fields.map((field) => (
            <div key={field.id} className="space-y-1.5" data-testid={`field-${field.id}`}>
              {field.type === "boolean" ? (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={field.id}
                    checked={Boolean(answers[field.id])}
                    onCheckedChange={(checked) => setAnswers((prev) => ({ ...prev, [field.id]: checked === true }))}
                    data-testid={`input-${field.id}`}
                  />
                  <Label htmlFor={field.id}>
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                  </Label>
                </div>
              ) : (
                <>
                  <Label htmlFor={field.id}>
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                  </Label>
                  {field.type === "textarea" ? (
                    <Textarea
                      id={field.id}
                      value={(answers[field.id] as string) ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))}
                      data-testid={`input-${field.id}`}
                    />
                  ) : field.type === "select" ? (
                    <select
                      id={field.id}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={(answers[field.id] as string) ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))}
                      data-testid={`input-${field.id}`}
                    >
                      <option value="" disabled>
                        Select...
                      </option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={field.id}
                      type={field.type === "date" ? "date" : "text"}
                      value={(answers[field.id] as string) ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))}
                      data-testid={`input-${field.id}`}
                    />
                  )}
                </>
              )}
            </div>
          ))}

          {submitMutation.isError && (
            <p className="text-sm text-destructive" data-testid="text-intake-submit-error">
              {(submitMutation.error as Error).message}
            </p>
          )}

          <Button
            className="w-full"
            disabled={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
            data-testid="button-submit-intake"
          >
            {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
