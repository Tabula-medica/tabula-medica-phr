# Sudden Death Answers — HIPAA & Decedent Data Handling Policy (Draft)

**Covers checklist item H** in `docs/sudden-death-answers-az-todo.md`.
**Status:** Draft for counsel review (see `docs/sudden-death-answers-counsel-brief.md`) — not a final compliance document.

---

## Decedent PHI protection period
Decedent protected health information remains protected under HIPAA for **50 years after death** (45 CFR 160.103). All policies below apply for the full 50-year window, not just during active case handling.

## Data flows requiring a BAA (checklist item V)
1. **Reference lab** (Labcorp/Invitae, GeneDx, or Blueprint Genetics) — receives specimens and generates genetic results.
2. **Imaging partner** — receives referral information and produces PMCT/PMCTA studies.
3. **Toxicology lab** (may be same as reference lab or separate) — receives specimens and produces results.
4. **Courier** — handles physical specimens; confirm whether courier needs a BAA or falls under a conduit exception (ask counsel).
5. **TabulaMedica PHR platform** — stores records-review data, family graph links, and legacy vault entries.

No specimen, referral, or record should move to any of the above until its BAA is executed. Track BAA status in `docs/sudden-death-answers-lab-rfp-template.md` and `docs/sudden-death-answers-funeral-imaging-outreach.md` tracking tables.

## Minimum necessary principle
- Funeral home partners receive only what's needed for referral and logistics coordination — never clinical results or genetic data.
- Coordinators access case data on a need-to-know basis; genetic results are handled only by clinical staff (genetic counselor, reviewing cardiologist/pathologist) and the family.

## Retention
- Chain-of-custody records, consent forms, and case files: retain per the 50-year decedent PHI window, in a HIPAA-compliant storage system.
- Physical specimens: retain per lab partner's standard policy (confirm with each lab); note any family right-to-destroy request process.

## Family/relative data (cascade testing)
Cascade testing for living relatives creates records for living individuals, which are subject to standard (not decedent) HIPAA rules — treat with the full standard PHI protections, including right of access and amendment.

## Breach and incident response
- Define an incident-response contact and process before go-live — who gets notified internally, what the notification timeline is to affected families under HIPAA breach notification rules, and how vendor breaches (lab, imaging, courier) get surfaced to TabulaMedica.

## Open items for counsel
1. Confirm whether TabulaMedica is a covered entity, business associate, or hybrid entity in this service model.
2. Confirm courier BAA/conduit-exception status.
3. Confirm state-level data-privacy law overlays (e.g., state genetic privacy statutes) beyond HIPAA for the launch metros.
4. Review and finalize retention schedule and breach-notification procedure.
