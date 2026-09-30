# Sudden Death Answers — Regulatory Monitoring, Jurisdiction Tree, Family Action Plan, Claims Review

**Covers checklist items F, G, J, and U** in `docs/sudden-death-answers-az-todo.md`.

---

## F — FDA/LDT regulatory monitoring memo

**Current status to verify at each review:** the FDA's laboratory-developed test (LDT) final rule was vacated 31 Mar 2025 (E.D. Tex., *ACLA v. FDA*); FDA did not appeal. The Enhancing CLIA Act of 2026 is pending in Congress and would affect the reference-lab model this service relies on.

**Review cadence:** quarterly, and immediately on any news of a new FDA rulemaking or congressional action on LDTs/CLIA.

**Review checklist each quarter:**
- [ ] Confirm no new FDA LDT rulemaking has been proposed or finalized.
- [ ] Check status of the Enhancing CLIA Act of 2026 (introduced / committee / floor vote / passed).
- [ ] Confirm all reference-lab partners remain CLIA/CAP certified with no lapses.
- [ ] Flag any change immediately to counsel (`docs/sudden-death-answers-counsel-brief.md` contact) rather than waiting for the next scheduled review.

## J — ME/coroner jurisdiction decision tree (staff quick reference)

```
Has the medical examiner (ME) or coroner been notified of the death?
│
├── No, and death does not meet mandatory-reporting criteria
│     → Family/next-of-kin may authorize directly. Proceed with consent forms.
│
├── Yes, ME/coroner reviewed and DECLINED jurisdiction
│     → Document decline (case number or written confirmation). Proceed with consent forms.
│
├── Yes, ME/coroner RELEASED body WITHOUT performing autopsy
│     → Document release (release form or logged verbal confirmation, per
│       consent form item 2). Proceed with consent forms.
│
└── Yes, ME/coroner has RETAINED jurisdiction (autopsy pending or performed)
      → Do NOT proceed with independent collection. This case is outside
        scope until/unless the ME/coroner's office releases it. Offer to
        stay in touch with the family for genetic/cascade counseling only,
        once any ME findings are available.
```

**Staff rule:** when in doubt about which branch applies, do not proceed — call the on-call coordinator's escalation contact (see `docs/sudden-death-answers-ops-playbook.md`) before collecting anything. Getting this wrong is a legal risk, not just an operational one.

## G — Genetic counseling & family action plan template

Used after a genetic finding (probable or definite) is returned, to structure the family conversation:

1. **Explain the finding in plain language** — what gene/condition, what it means for how the decedent died, and what "variant of uncertain significance" vs. "pathogenic/likely pathogenic" means if relevant.
2. **Identify at-risk relatives** — first-degree relatives (children, siblings, parents) are the priority; use the TabulaMedica PHR family graph (`docs/sudden-death-answers-phr-integration-spec.md`) to identify who's already in the system.
3. **Offer cascade testing** — $299/relative per the pricing sheet; explain that a negative cascade result for a known familial variant is generally reassuring, while a positive result means preventive screening (ECG/echo, cardiology referral) is appropriate.
4. **Offer screening even without genetic testing** — if the family declines cascade testing, still recommend baseline cardiology screening for first-degree relatives given the family history alone.
5. **Document the conversation and offer** in the case file, whether or not the family accepts — this matters both for care continuity and for showing the honest-resolution-rate commitment was followed through with concrete next steps.
6. **Follow-up timing** — check in at 2-4 weeks, not immediately, respecting the grief timeline (same principle as the NPS survey timing in the KPI plan).

## U — Marketing/consumer claims self-audit checklist

Run this against `docs/sudden-death-answers-website-copy.md` and any new marketing material before publishing:

- [ ] Does the copy state the 13-30% definite-genetic-cause range accurately, without rounding up or dropping the "truly unexplained cases" qualifier?
- [ ] Does the copy clearly list what the service **cannot** reliably detect (pulmonary embolism without contrast, myocarditis, early infarct, some channelopathies)?
- [ ] Does the copy avoid implying this is a legal substitute for an autopsy in ME/coroner-jurisdiction cases?
- [ ] Does the copy avoid implying insurance coverage or guaranteed reimbursement?
- [ ] Does any specific number or claim trace back to a cited source in `docs/molecular-autopsy-service-launch-brief.md`'s Sources section? If not sourced, remove or soften it.
- [ ] Has this exact claims set been reviewed by counsel and, ideally, a clinician not involved in writing the marketing copy (fresh-eyes check)?

**Recommendation:** re-run this checklist any time the resolution-rate figures are updated from real case data (see `docs/sudden-death-answers-kpi-plan.md` early-warning thresholds).
