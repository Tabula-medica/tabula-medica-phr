# Sudden Death Answers — Ops Playbook: On-Call, SLAs, Chain of Custody

**Covers checklist items O, Q, and S** in `docs/sudden-death-answers-az-todo.md`.
**Status:** Draft SOP, ready for staffing/tooling decisions.

---

## On-call coordination (item O)

- **Coverage model:** 24/7 on-call rotation required — sudden deaths don't happen on business hours, and the embalming/cremation window (typically 24-72h) doesn't wait.
- **First-contact SLA:** coordinator returns a referral (from funeral home, hospital, or direct family contact) within **30 minutes**, any hour.
- **Dispatch SLA:** sample collection dispatched within **4 hours** of family authorization (consent signed), sooner if the burial/cremation window is tight.
- **Staffing model options to evaluate:** in-house on-call coordinator(s) vs. contracted mobile phlebotomy/mortuary-tech network vs. hybrid (in-house intake, contracted collection). Recommend starting hybrid for launch metro #1 to avoid overhiring before volume is proven.
- **Escalation path:** define who the on-call coordinator calls if a funeral home, imaging partner, or lab is unresponsive — should not be improvised in the moment.

## Turnaround SLAs and QC dashboard (item Q)

| Stage | Target SLA | Tracked by |
|---|---|---|
| First contact response | 30 min | Coordinator log |
| Collection dispatch | 4 hours from consent | Coordinator log |
| PMCT/PMCTA read | 24-48 hours | Imaging partner |
| Toxicology result | 1-2 weeks | Reference lab |
| Genetics result | 2-6 weeks | Reference lab |
| Report delivered to family | Within 24h of last result received | Coordinator log |

**Dashboard requirements (build once volume justifies it — spreadsheet is fine at launch):**
- Case-level tracker: dates for each stage above, SLA met/missed flag.
- Monthly rollup: % of cases meeting each SLA, average time per stage.
- Escalation trigger: any case exceeding SLA by >50% gets a manual review of what went wrong (vendor delay, logistics, etc.).

## Chain of custody (item S)

- Every sample gets a barcode or sequential case ID at the point of collection (see kit spec, `docs/sudden-death-answers-kit-spec.md`).
- Chain-of-custody form travels with the sample from collection → courier → lab receipt; lab confirms receipt against the form.
- Digital log (even a simple shared spreadsheet at launch) records: case ID, collector name/time, courier pickup time, lab receipt time/confirmation.
- Any gap in custody (sample not receipted within expected transit window) triggers an immediate call to the courier and lab — do not wait for the next daily check.
- Retention: keep chain-of-custody records per the HIPAA decedent retention period noted in `docs/sudden-death-answers-hipaa-data-policy.md`.

**Open dependency:** finalize actual staffing numbers and dashboard tooling once metro #1 partner contracts (funeral home, imaging, lab) are signed and expected case volume is estimated.
