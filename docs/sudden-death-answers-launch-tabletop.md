# Sudden Death Answers — Pre-Launch Tabletop Exercise

**Covers checklist item Z** in `docs/sudden-death-answers-az-todo.md`.
**Status:** Ready to run once vendor contracts (lab, imaging, one funeral-home partner) are in place. This is the last gate before accepting a real case.

---

## Purpose
Run one full mock case end-to-end, on paper and by phone/email with real vendors (using test/dummy patient data, clearly marked), to find gaps before a real grieving family is involved.

## Mock scenario
A 42-year-old previously healthy adult dies suddenly at home. Medical examiner declines the case (recent normal cardiology visit on file). Funeral home refers the family same day. Family wants answers but has requested burial within 48 hours per religious practice.

## Walk through every stage

- [ ] **Referral received.** Funeral home "refers" the mock case. Time-stamp it. Confirm on-call coordinator responds within the 30-minute SLA.
- [ ] **Intake call.** Run the actual intake script (`docs/sudden-death-answers-intake-script.md`) with a team member role-playing the family member. Note anything that felt scripted, confusing, or rushed.
- [ ] **Consent.** Walk through all four consent forms (`docs/sudden-death-answers-consent-forms.md`) as if signing them live. Confirm the honest-resolution-rate disclosure gets its own initials, not buried.
- [ ] **ME/coroner jurisdiction check.** Confirm the coordinator can correctly apply the jurisdiction decision tree and documents the ME's release status per the consent form.
- [ ] **Collection dispatch.** Confirm a kit (`docs/sudden-death-answers-kit-spec.md`) can actually be dispatched and collection performed within the 4-hour SLA, including a mock chain-of-custody form filled out completely.
- [ ] **Imaging.** Contact the imaging partner (real vendor, mock case clearly flagged as a test) and confirm they can actually schedule a scan within the 24-48h SLA — don't assume, confirm.
- [ ] **Lab submission.** Confirm the courier and lab receipt process works, using the lab's actual intake process (test/dummy sample or a walkthrough call if a physical dummy run isn't feasible).
- [ ] **Results and report.** Confirm the case-tracking log (`docs/sudden-death-answers-ops-playbook.md`) captures every stage timestamp, and that a mock report can be assembled and delivered to the "family."
- [ ] **PHR integration.** If the integration from `docs/sudden-death-answers-phr-integration-spec.md` is built by this point, confirm the mock case data actually flows into a test PHR record.

## After the exercise
1. Document every SLA miss, every unclear step, and every vendor response-time surprise.
2. Fix the highest-impact gaps before accepting a real case — do not launch with known gaps in the consent, jurisdiction, or chain-of-custody steps specifically, since those carry the most legal and human risk.
3. Re-run a second tabletop if the first surfaced major gaps in any of those three areas.
4. Get explicit sign-off from counsel (consent/jurisdiction steps) and clinical leadership (intake script, results delivery) before the first real case.

**This is the last checklist item by design** — everything else in `docs/sudden-death-answers-az-todo.md` should be closed or actively in progress before running this.
