# Sudden Death Answers — TabulaMedica PHR Integration Spec

**Covers checklist item T** in `docs/sudden-death-answers-az-todo.md`.
**Status:** Functional spec for engineering scoping — not yet built or estimated.

---

## Goal
Wire Sudden Death Answers case data into the existing TabulaMedica PHR product so that results, records review, and family risk information live where the family and their other providers already look.

## Integration points

### 1. Family graph
- Link the decedent's record to living relatives already in TabulaMedica PHR (spouse, children, siblings, parents) where those relatives are also platform users or have been added as family-graph nodes.
- When a genetic finding is identified, surface a **risk flag** on each linked relative's record (not the raw genetic report — a flag plus a prompt to discuss cascade testing with a genetic counselor).

### 2. Legacy vault
- Store the final case report (PMCT/PMCTA read, toxicology result, genetics result, records-review summary) in the decedent's legacy vault, accessible to the authorized next-of-kin/executor per existing vault permissions.
- Confirm existing vault access-control model supports the "authorized party" role used in the consent forms (`docs/sudden-death-answers-consent-forms.md`) — may need a new role if the current model doesn't match funeral-context authorization.

### 3. ICD-10 coding
Tag case records with the relevant ICD-10-CM codes so they integrate with existing PHR reporting/analytics:
- **R99** — Ill-defined and unknown cause of mortality (default at intake, before evaluation)
- **R96.0** — Instantaneous death
- **I46.1** — Sudden cardiac death, so described
- **R95** — Sudden infant death syndrome (only if applicable — confirm this service's age scope excludes infants, per the launch brief's 18-65 focus; likely not used)

Update the record's ICD-10 code once a probable or definite cause is established, moving off R99 where possible.

### 4. Records-review workflow
- Build (or reuse existing PHR clinician-review tooling) a workflow for the reviewing cardiologist/pathologist to pull the decedent's existing TabulaMedica PHR records (prior ECGs, medications, visit history) alongside the new case data.
- Confirm access controls: reviewing clinician needs read access to the decedent's historical PHR data scoped to this case, not open-ended access.

## Data model additions (rough scope)
- New entity: `SuddenDeathCase` — links to decedent's existing PHR profile, holds case status, consent records, vendor references (lab/imaging case IDs), and result documents.
- New relationship: `SuddenDeathCase` → `FamilyGraphNode` (one-to-many) for cascade-testing risk flags.
- New document type in legacy vault: `SuddenDeathCaseReport`.

## Open items for engineering
1. Confirm whether the existing family-graph and legacy-vault data models can be extended without a breaking migration.
2. Confirm access-control model can represent "authorized next-of-kin acting for a deceased user" as distinct from the deceased user's own historical permissions.
3. Estimate build effort — this spec assumes existing PHR infrastructure is reused, not a new system built from scratch.

**Next step:** review with engineering lead for effort estimate before committing this to the 120-day launch timeline.
