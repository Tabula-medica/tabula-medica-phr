/**
 * ACP — State Rules & Printable Directive (patient-facing, PHR).
 *
 * Self-contained panel that reads the patient's already-entered directive + goals, shows the
 * execution rules for their state of residence (from the SHARED engine — same JSON pack the
 * Tabula EHR uses), and generates a signable OR unsigned "share with provider" directive as a
 * printable document (browser print-to-PDF). No server call, no provider plugin. Draft-only and
 * never asserts legal validity — every state is counsel-unverified until legal review.
 */
import { useMemo } from "react";
import { executionRequirements } from "@/acp/stateRules.mjs";
import { normalize, contentHash } from "@/acp/directive.mjs";
import { renderDirectiveHtml } from "@/acp/renderHtml.mjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

type AnyRec = Record<string, any>;

function mapCodeStatus(arr: string[] | undefined): string {
  const s = new Set((arr || []).map((x) => String(x).toUpperCase()));
  if (s.has("DNR") && s.has("DNI")) return "DNR/DNI";
  if (s.has("DNR")) return "DNR";
  if (s.has("DNI")) return "DNI";
  if (s.has("FULL CODE") || s.has("FULL")) return "Full Code";
  return "";
}

export function AcpStateRules({ directive, goals, patientName = "" }: { directive: AnyRec; goals: AnyRec; patientName?: string }) {
  const state: string = directive?.state || "";
  const rules = useMemo(() => (state && state !== "not-required" ? executionRequirements(state) : null), [state]);

  function buildDoc() {
    return normalize({
      stateOfResidence: state,
      patientName,
      healthcareAgent: { name: directive?.poaAgentName, relationship: directive?.poaAgentRelationship, phone: directive?.poaAgentPhone },
      alternateAgent: { name: directive?.poaAlternateName, phone: directive?.poaAlternatePhone },
      codeStatus: mapCodeStatus(goals?.codeStatus),
      treatmentPreferences: goals?.treatmentPreferences,
      familyPrimaryGoalOfCare: goals?.familyPrimaryGoalOfCare,
      goalsOfCare: goals?.goalsOfCare,
      additionalWishes: directive?.endOfLifeWishes,
      sourceApp: "phr",
    });
  }

  async function makePdf(variant: "signable" | "unsigned_provider") {
    const doc = buildDoc();
    const r = executionRequirements(doc.patient.state_of_residence);
    const html = renderDirectiveHtml(doc, r, { variant, contentHash: await contentHash(doc) });
    const w = window.open("", "_blank");
    if (!w) { alert("Please allow pop-ups to generate your directive document."); return; }
    w.document.open(); w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { try { w.print(); } catch { /* user can print manually */ } }, 350);
  }

  if (!rules) {
    return (
      <Card data-testid="acp-state-rules">
        <CardHeader><CardTitle className="text-base">Make it official in your state</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Select your state of residence above to see exactly what your state requires (witnesses, notary) and to generate a signable directive.</p></CardContent>
      </Card>
    );
  }

  const method = rules.either_witnesses_or_notary
    ? `${rules.witnesses_required} witness(es) OR a notary`
    : `${rules.witnesses_required} witness(es)${rules.notary_required ? " AND a notary" : ""}`;

  return (
    <Card data-testid="acp-state-rules">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Make it official in {rules.state_name}
          {!rules.counsel_verified && <Badge variant="outline" className="text-amber-700 border-amber-300">draft · pending legal review</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="font-medium">{rules.form_name}</div>
        <div className="text-muted-foreground">{rules.statutory_citation}</div>
        <ul className="space-y-1">
          <li><b>To sign:</b> {method}.</li>
          {rules.witness_qualification_note && <li className="text-muted-foreground">Witness rule: {rules.witness_qualification_note}</li>}
          <li className="text-muted-foreground">
            Electronic signature: {rules.electronic_signature_allowed ? "allowed" : "no"} ·
            Remote online notary: {rules.remote_online_notarization_allowed ? "allowed" : "no"} ·
            Portable orders: {rules.polst_program?.available ? rules.polst_program.name : "—"}
          </li>
        </ul>
        {rules.is_fallback && (
          <Alert><AlertDescription>Your exact state isn’t individually confirmed yet — showing conservative defaults. Please review with your care team or an attorney.</AlertDescription></Alert>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={() => makePdf("signable")} data-testid="button-acp-pdf-signable">Generate signable directive</Button>
          <Button size="sm" variant="outline" onClick={() => makePdf("unsigned_provider")} data-testid="button-acp-pdf-provider">Unsigned copy for my provider</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          This puts your own wishes into a document. It is not legal advice and becomes legally effective only when you complete your state’s signing/witness/notary steps. Advance care planning is always voluntary.
        </p>
      </CardContent>
    </Card>
  );
}

export default AcpStateRules;
