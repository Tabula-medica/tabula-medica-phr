# US Formation Pack — Delaware 501(c)(3)

Everything needed to stand up the umbrella charity in the United States, in filing order.
India (Section 8, 12A/80G, CSR-1, FCRA) is deliberately **out of scope here** — see
`../NONPROFIT_AND_FREE_MARKETING_PLAYBOOK.md` §1 when you come back to it.

**Decisions already made:** Delaware nonstock corporation · Form 1023-EZ · neutral umbrella
name with Katha.kids, UHR, Noorjyoti and Unraj as programme brands underneath.

> These are working drafts, not legal advice. Have a nonprofit attorney read
> `02`, `03` and `04` before you file. Every form field cited was verified against public
> sources in August 2026, but IRS and Delaware pages could not be fetched directly from
> this environment — **confirm each field against the live form before submitting.**

---

## Before anything: replace the placeholder

Every document uses `[[ORG_NAME]]` for the legal name and `[[STATE]]` for your operating
state. Pick the name (`01`), clear it, then find-and-replace across the folder:

```bash
grep -rl '\[\[ORG_NAME\]\]' docs/us-formation/ | xargs sed -i 's/\[\[ORG_NAME\]\]/Your Chosen Name, Inc./g'
```

---

## The sequence

Each step blocks the next. Do not reorder — the 1023-EZ requires you to attest that your
certificate of incorporation already contains specific clauses, and Google requires an IRS
determination letter that requires the EIN that requires the incorporation.

| # | Step | Cost | Time | Doc |
|---|---|---:|---|---|
| 1 | Clear and pick the legal name | $0 | 1 day | `01` |
| 2 | Recruit 3 unrelated directors | $0 | 1–7 days | `03` §3 |
| 3 | Appoint a Delaware registered agent | $50–125/yr | 1 day | below |
| 4 | File the Certificate of Incorporation | $109 | 1–5 days | `02` |
| 5 | Get the EIN (free, instant, online) | $0 | 1 hour | `06` |
| 6 | Adopt bylaws + conflict-of-interest policy at the organizational meeting | $0 | 1 day | `03` `04` `05` |
| 7 | Open the bank account | $0 | 1–7 days | below |
| 8 | Publish the website | domain ~$70/yr | 3–10 days | `09` |
| 9 | File Form 1023-EZ on Pay.gov | $275 | 2–6 weeks to decision | `07` |
| 10 | Determination letter arrives → activate everything the same day | $0 | 1 day | `10` |

**Realistic total: $434–509 and 5–10 weeks** from today to a live $10,000/month Google Ad
Grant. Steps 1–8 are entirely within your control and can be done in about two weeks; step
9 is the only real wait.

---

## Two things you must supply that aren't in these documents

**A Delaware registered agent.** Delaware requires a registered office in-state. You cannot
be your own agent unless you have a physical Delaware address. Commercial agents run
roughly $50–125/year (Harvard Business Services, Northwest Registered Agent, CSC and
Cogency all serve this market). Pick one before step 4 — you need their name and Delaware
street address to complete the certificate.

**Your operating state.** Delaware is where the entity is *chartered*, not where it
*operates*. Wherever the organisation is actually run from, you will likely need to
foreign-qualify there and register to solicit donations there. This is the one open item I
could not close without knowing where you are based.

> **Good news on Delaware itself:** Delaware is one of roughly eleven states with **no
> charitable-solicitation registration requirement**. The state Attorney General has general
> oversight, but there is no registry to join and no annual charity filing. That removes an
> entire compliance workstream — it just does not extend to your operating state.

---

## Bank account checklist

Bring all of these or you will be sent away:

- Certified copy of the Certificate of Incorporation (order it with the filing, +$50)
- EIN confirmation letter (CP 575, or the online PDF)
- Adopted bylaws
- The board resolution from `05` authorising the account and naming signatories
- Government photo ID for every signatory
- The organisation's address and phone

Ask specifically for a **non-profit checking account** — most banks waive monthly fees for
501(c)(3)s, though many will want the determination letter before applying the waiver. Open
the account before the determination arrives anyway; you can ask for the waiver later.

---

## Annual obligations, once you exist

| What | When | Cost |
|---|---|---|
| Delaware annual report (exempt corporation) | by **1 March** each year | $25 |
| IRS **Form 990-N** e-Postcard (while gross receipts ≤ $50,000) | 15th day of the 5th month after fiscal year end — **15 May** for a 31 December year end | $0 |
| Registered agent renewal | anniversary | $50–125 |
| Board meeting + minutes | at least annually per the bylaws | $0 |
| Conflict-of-interest annual statements | annually | $0 |

**Miss Form 990-N three years running and your exemption is automatically revoked.** It
takes about four minutes to file. Put it in a calendar today.

---

## Files

| File | What it is |
|---|---|
| `01-umbrella-name.md` | Name shortlist, clearance checklist, DBA registration |
| `02-certificate-of-incorporation.md` | Ready-to-file Delaware nonstock certificate with the IRS-required clauses |
| `03-bylaws.md` | Full bylaws draft |
| `04-conflict-of-interest-policy.md` | IRS-model conflict-of-interest policy and annual statement |
| `05-organizational-meeting-minutes.md` | First board meeting minutes and resolutions |
| `06-ein-application.md` | Field-by-field answers for the online EIN application |
| `07-form-1023-ez-answers.md` | Field-by-field answers for Form 1023-EZ, plus the eligibility worksheet |
| `08-charitable-purpose-and-programs.md` | The purpose statement and four programme descriptions, reused everywhere |
| `09-website-requirements.md` | What the site must contain to pass Google Ad Grants review |
| `10-day-one-after-determination.md` | The same-day activation sequence for ~$155k/yr of free tooling |
