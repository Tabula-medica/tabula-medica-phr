# The complete chart/notes summarization connector

**Status:** built
**Scope:** cross-source (any EHR connection, Fasten Health, this app's own PHR entries)

---

## 1. What this is

A connector that summarizes a person's *entire* chart — across every source
connected for them, not just one EHR connection — behind one evaluation:

```
GET  /api/complete-chart-summary/facts?unifiedPatientId=      deterministic facts, no AI
POST /api/complete-chart-summary/generate                     facts + AI-organized narrative
```

It exists because "summarize the chart" and "summarize one connection's
patient row" are different problems in this codebase, and every existing
summarizer solved the second one. An eCW connection and a Fasten
Health-aggregated import for the same real person land as two different
`Patient` rows, joined only by a shared `unifiedPatientId`
(`server/services/patient-identity-resolution.ts`). Nothing before this
connector queried at that join — `ai-chart-insights-service.ts`'s
`gatherPatientData(patientId)` and `aiPatientProfileSummaryService.ts` both
operate on one `patientId`. A "complete" summary that only sees one
connection's rows is not complete; it just looks complete.

## 2. Why it should be trusted more than a generic AI EHR summarizer

The generic pitch in this space is "AI reads the chart and writes you a
summary." The failure mode is that the AI is also the one deciding what the
chart contains, and a fluent, confident summary of the wrong facts is
indistinguishable from a correct one until someone re-reads the source
records — which is the whole reason the summary was requested in the first
place. This connector is split into two stages specifically to make that
failure impossible rather than merely unlikely:

- **`fact-gatherer.ts` is pure and deterministic.** No AI, no judgement.
  Given a `unifiedPatientId`, it resolves every linked `Patient` row and
  unions problems, medications, labs, vitals, allergies, immunizations,
  family history, uploaded documents, and clinical notes/records across all
  of them, each tagged with exactly which connection and platform it came
  from. This is the closed set — the only facts that exist as far as the
  rest of the pipeline is concerned.
- **`narrative-builder.ts` may only phrase and cite the closed set.** The
  same containment `risk-adjustment/hcc-ai-reviewer.ts` uses for HCC
  suggestions: the model receives the fact list and must return, per
  section, the exact fact ids that support each sentence. Any id it returns
  that is not in the set it was given is discarded in code — not merely
  discouraged in the prompt — and a section built entirely from discarded
  ids is dropped rather than shown. A hallucination can make the summary
  less complete; it cannot make it say something the chart does not.

Nothing here is a diagnosis or a clinical recommendation. Every response
restates that, on the same terms as `/api/care-management/evaluate` and
`/api/medicare-care-gaps/evaluate`.

## 3. What "complete" actually covers, and what it does not

| Source | Covered | Notes |
|---|---|---|
| This app's own PHR entries | Yes | Same tables as everything else; no separate path. |
| Fasten Health aggregated records | Yes | `server/auth/fasten-import.ts` already writes into the same unified tables under `unifiedPatientId`, confirmed real (HMAC-verified webhook, host-allowlisted download, the same FHIR mappers the direct-EHR path uses). This connector only had to query across it, not build new ingestion for it. |
| eCW (or any other connected EHR) | Structurally yes, practically depends on real sync | `server/services/ehr-integration-service.ts`'s `syncConnection`/`fetchFhirResource` already pulls eCW's DocumentReference/Encounter/Condition/etc. into the same tables once a connection has a **real, non-mock access token**. |
| eCW specifically, live | **Not yet exercised against a real tenant** | Per `docs/hcc-v28-and-ecw.md`, eCW's backend-services token exchange is spec-conformant and unit-tested but has never round-tripped against a registered app + JWKS + authorized practice. Build this connector's demo/dev data through Fasten or manual entry; treat a live eCW sync as a deployment prerequisite, not something this connector adds. |

**A defect to know about before relying on continuous eCW sync:**
`ehr-integration-service.ts`'s `refreshToken()` is currently a stub — it
never calls the real token endpoint, it just replaces the token with another
`mock_...` string. `fetchFhirResource` treats any `mock_`-prefixed token as
"no real token" and falls back to synthetic/empty data. The practical
consequence: once a connection's initial OAuth token expires, every
subsequent sync for that connection **silently degrades to empty or mock
data**, for every platform including eCW, with nothing in this connector's
output distinguishing that from "the chart is genuinely thin." This
connector does not paper over that — it reads whatever `fetchChartFacts`
finds in storage, honestly, and is only as complete as what actually landed
there. Fixing `refreshToken` is a prerequisite for depending on long-lived
eCW sync, not something this connector's scope includes.

## 4. What is deliberately reused, not rebuilt

- **Cross-source identity** — `storage.getPatientsByUnifiedId()` and the six
  existing `*ByUnifiedPatient` storage getters (medical records, medications,
  vitals, lab results, allergies, problems) already union across every
  `Patient` row for a person. `fact-gatherer.ts` composes the three that
  don't have a `*ByUnifiedPatient` getter yet (immunizations, family history,
  uploaded documents) the same way those six do internally — resolve the
  patient rows, then union each row's own records — rather than adding three
  more storage methods for a one-connector need.
- **The PHI-safe AI call** — `ai-gateway.ts`'s `generatePhiSafeText`, the
  same module `ai-chart-insights-service.ts` and
  `clinical-summary-translation.ts` use, never `ai-provider.ts`'s
  OpenAI-switchable path. The `<UNTRUSTED_PATIENT_DATA>` prompt-injection
  defense text is copied from `ai-chart-insights-service.ts` verbatim.
- **The closed-candidate-list discipline** — copied in structure from
  `risk-adjustment/hcc-ai-reviewer.ts` (deterministic list in, AI ranks/
  annotates, invented ids discarded in code) and from
  `ambient-scribe/note-builder.ts` (a fact/item cannot be constructed without
  evidence). Neither `aiPatientProfileSummaryService.ts` nor
  `ai-chart-insights-service.ts` do this today — their narratives and
  `dataSourcesUsed` metadata are unlinked prose — so this is the specific
  differentiator, not duplicated work.
- **Provenance per fact** — the lightweight `{platform, facilityName,
  ehrConnectionId}` shape `client/src/components/provenance-badge.tsx`
  already uses in production, not `data-lineage-service.ts` (confirmed to be
  a disconnected demo backed by an in-memory sample, never written to by any
  real ingestion path).

## 5. What is deliberately *not* built on

- **`aiPatientProfileSummaryService.ts`** — its route
  (`POST /api/patient-profile-summary/generate`) silently falls back to a
  fabricated demo patient (`getSamplePatientData()`) whenever the caller
  doesn't supply a fully-formed profile in the request body, and nothing in
  this codebase assembles that profile from real storage. Building on it
  would inherit that landmine.
- **`server/services/data-lineage-service.ts`** — well-typed, but its only
  data is `initializeSampleData()`'s fabricated seed, and no real ingestion
  path writes to it. Extending it would produce provenance that looks real
  and isn't.
- **`server/services/ai-fhir-data-lake-analytics-service.ts`** — a
  population-health demo generator (its trend forecasting literally calls
  `Math.random()`), not a per-patient data source despite the name.

## 6. Limitations, stated rather than buried

- **eCW live sync is unverified.** See §3. This connector will summarize
  whatever eCW data actually lands in storage, and cannot detect that a sync
  quietly degraded to mock data because of the `refreshToken` stub.
- **Uploaded-document text is whatever `aiExtractedData.extractedFields`
  captured**, not the document's full text — a fact built from an upload
  without extracted fields says so rather than inventing content.
- **No per-fact clinical significance ranking.** Every fact is presented
  once, deterministically; the AI narrative organizes and phrases but does
  not decide that one lab result matters more than another beyond which
  section it belongs in.
- **Immunizations, family history, and uploaded documents are composed at
  request time** (patient rows resolved, then each row's own records
  unioned) rather than via a dedicated `*ByUnifiedPatient` storage method —
  functionally equivalent to the six that have one, just not memoized at the
  storage layer.
