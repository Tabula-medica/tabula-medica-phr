# Care-management coding — RPM, CCM, PCM, APCM, care plan

Built from an Optelle Health CCM/PCM superbill: the paper form a care
coordinator fills in at the end of a service period, a grid of codes with
checkboxes and a physician signature line reading *"I hereby attest to the
accuracy of the information provided above."*

That form is the honest statement of the problem. Every failure mode this
module exists to prevent is a plausible outcome of filling it in slightly
wrong, at 6pm on the last day of the month, from memory.

> **Read this before using any code in here.** The shipped catalog is a
> **development seed**, marked `verified: false`, and every candidate built
> from it carries `unverifiedRules: true`. It was compiled from secondary
> familiarity with the code families and corroborated only for the four CCM and
> PCM entries the superbill itself lists. It has **not** been reconciled
> against a current CPT release or a Physician Fee Schedule final rule. The
> APCM G-codes are the most recent entries and the most likely to be wrong.

---

## 1 · Why this is not a spreadsheet

These codes are claims to the federal government. The HCC engine in this
repository carries the line *"a RAF score is a payment claim"*; it applies
harder here. A RAF coefficient error produces a wrong number. A
care-management coding error produces a claim asserting that a specific
quantity of a specific kind of work happened in a specific month — and that
assertion is signed.

Care management is among the most actively audited areas in Medicare, and the
recurring findings are not exotic:

| Recurring audit finding | What the module does |
|---|---|
| Time billed that was not documented | Time is an input carrying a source; never inferred |
| 19 minutes billed as 20 | Thresholds floor, always. Leftover minutes are reported |
| No comprehensive care plan on file | An absent or incomplete plan blocks every code requiring one |
| Consent never obtained | No consent documented refuses the month |
| CCM and PCM both billed for one patient | Same-period conflicts are computed and surfaced |
| 99454 billed without 16 days of readings | Device-day count is required and checked |
| The same minutes counted twice | Attribution is explicit; overlap refuses everything |

---

## 2 · Nothing here is a bill

`evaluateCoding` emits **candidates** — proposals to a human coder, each
carrying the facts that produced it. The same distinction the ambient scribe
draws between a draft and an attested note, for the same reason: the system can
check arithmetic and prerequisites, and it cannot know whether the twenty
minutes were really spent.

Every response repeats that on the wire rather than trusting the client to
remember it. A candidate list that looks like a claim will eventually be
treated as one.

---

## 3 · The three rules that shape the engine

### Time is never rounded up

Nineteen minutes of clinical staff time is not twenty. This is obvious stated
plainly and is the single most common route from an honest month to a false
claim — not fabrication, but a coder seeing 19 and thinking *that's basically
the threshold*.

Add-on increments floor too. Forty-five minutes of CCM staff time is
`99490` + **one** unit of `99439`, with five minutes reported as unbilled — not
two units. Where a documented increment exceeds the code's unit cap, the excess
is refused explicitly: *"billing the extra would be a claim the code does not
support, however real the time was."*

### An undocumented prerequisite refuses the code

It does not warn and then proceed. Consent, a care plan, the condition count,
sixteen device days, moderate-to-high MDM — each either is on file or is not.

Two of these are **derived from counts rather than checkboxes**, so a practice
cannot tick "two or more chronic conditions" on a form while the record shows
one. Where a count is simply unknown, the prerequisite stays unmet: unknown is
not a synonym for satisfied.

Complex CCM is the sharpest case. Sixty minutes of staff time clears its time
threshold, but without moderate-or-high MDM documented the month is CCM, not
complex CCM — **the engine will not upgrade on time alone.**

### The engine never resolves a conflict in favour of revenue

Where two codes are mutually exclusive and both are supported by the documented
facts — CCM by staff time and CCM by practitioner time, in a month that had
both — it emits both and reports the conflict. It does not pick.

An automated system that silently chose the higher-paying option would be a
machine for upcoding, and it would be right often enough that nobody checked. A
test pins this directly.

**The one exception is APCM's three levels**, and it is safe precisely because
it is not a preference: the level follows from the condition count and
beneficiary status, so there is nothing to drift toward. Unknown condition
count proposes no level at all.

---

## 4 · The care plan is a first-class object

*"Was there a comprehensive care plan?"* is the question these audits turn on,
and it is the one a checkbox on a superbill cannot answer. The form this was
built from has a `CCM FIRST 20 MINS` box and a signature line; nothing on it
records whether a plan exists, what is in it, or whether anyone opened it this
month. A practice can complete that form honestly every month and still be
unable to produce the document an auditor asks for first.

So the plan is modelled with nine enumerated elements — problem list, expected
outcome, measurable goals, planned interventions, medication management, care
team, community services, information sharing, review schedule — and an
incomplete plan **blocks** the dependent codes. The refusal names what is
missing, which is the difference between a blocker a coder can clear and one
they will override.

Two further distinctions:

- **Electronic and available** is checked separately. A plan that cannot be
  reached by whoever takes the after-hours call is not doing the thing the
  requirement exists for.
- **Existence is not activity.** A plan written at enrolment and never revisited
  satisfies a naive presence check while describing a patient who has since
  changed. `reviewedDuringPeriod` reports whether anything happened to it this
  month, as an advisory rather than a hard block — whether monitoring alone
  (which leaves no timestamp) satisfies the requirement is a reading this module
  declines to make on a practice's behalf.

---

## 5 · The families

| Program | Shape | Codes in the seed |
|---|---|---|
| **CCM** | 2+ chronic conditions; staff time *or* practitioner time, not both | `99490` +`99439`; `99491` +`99437` |
| **Complex CCM** | As CCM plus moderate/high MDM and more time | `99487` +`99489` |
| **PCM** | One complex chronic condition | `99424` +`99425`; `99426` +`99427` |
| **APCM** | Monthly bundle, **no time threshold**, stratified by condition count and QMB status | `G0556` / `G0557` / `G0558` |
| **RPM** | Device setup, supply, and management time | `99453`, `99454`, `99457` +`99458`, `99091` |
| **Care planning** | One-time add-on at the initiating visit | `G0506` |

`99490`/`99439` and `99426`/`99427` are the four entries the source superbill
lists directly (as *CCM FIRST 20 MINS* / *CCM ADDNTL 20 MINS* and *PCM FIRST 30
MINS* / *PCM ADDNTL 30 MIN*), so those are the corroborated ones.

**APCM deserves particular care.** It is the only family with no time threshold
at all — which is its point, and also its hazard. With no minutes to clear, the
prerequisites are the *only* thing standing between a patient and a monthly
claim, which makes enforcing them the entire job.

**RPM and CCM can both be billed in one month** — the work is genuinely
different — but the same minutes may never serve both. Attribution is explicit
on each time entry, so a double count surfaces as one source id appearing under
two programs, and that refuses the whole evaluation rather than just the
overlapping code.

---

## 6 · No rule set is bundled for production

The same posture as `PFS_RVU_TABLES_PATH` and `HCC_V28_TABLES_PATH`, for a
sharper reason. CPT descriptors and time thresholds are revised annually; HCPCS
G-codes for care management have been added, redefined and retired inside a
single rule cycle; and what may be billed alongside what is set by the PFS
final rule and then modified by MAC-level edits that differ by jurisdiction.

A catalog compiled once and shipped does not fail loudly when it goes stale. It
produces a claim that is well-formed, plausible, and asserts something the
current rules do not support — the shape of a false claim, indistinguishable
from a correct one on the way out.

```
CARE_MGMT_RULES_PATH      operator-verified rule set; must assert verified:true and a source
CARE_MGMT_PLAN_ELEMENTS   narrow the required care-plan elements deliberately
```

A file that does not assert `verified: true` **and** name its source is
rejected outright: *"otherwise it is a seed wearing a filename."* Absence of a
file is a supported state — the engine still runs and still reasons — but
everything it produces is marked unverified, and `GET /api/care-management/rules`
says so before anyone tries.

---

## 7 · API

Clinic staff only (`requireClinicStaff`). This is a clinician-facing billing
tool: it acts on a patient rather than for the caller.

```
GET  /api/care-management/rules          what rule set is loaded, and is it verified
GET  /api/care-management/plan-elements  what a care plan must contain here
POST /api/care-management/evaluate       documented facts in, candidates out
```

`evaluate` takes facts **in the body rather than a patient id**, deliberately. A
route that loaded the month's time entries itself would be asserting that
whatever it found in the database *is* the documented care-management time — and
the gap between "minutes logged in a system" and "minutes documented as care
management" is exactly where these claims go wrong. The caller states the facts
it is prepared to stand behind; the engine checks them.

Response carries `candidates`, `refused` (each with a reason), `conflicts`
(unresolved, by design), `unusedMinutes`, `advisories`, `unverifiedRules`, and
the disclaimer.

---

## 8 · Test coverage: 42 tests

Weighted to refusals. Directly pinned: 19 minutes not becoming 20; partial
increments floored with the remainder reported; unit caps refusing the excess
and saying so; staff and practitioner time kept in separate pools so 15 + 15
makes neither threshold; consent, care plan, condition count, device days, MDM
and initiating visit each refusing when absent; complex CCM not upgrading on
time alone; APCM level selected from facts and proposing nothing when the count
is unknown; CCM-vs-PCM and CCM-vs-APCM conflicts reported rather than resolved;
the engine not preferring the higher-paying of two conflicting codes; one time
entry claimed by two programs refusing everything; RPM and CCM coexisting when
the work is separate; exclusion symmetry across the whole catalog; and an
operator file without a verification assertion being rejected.

Two of these were verified to be real tests rather than decorative, by breaking
the behaviour and watching them fail: making the engine round time up (two
tests fail) and breaking exclusion symmetry in the catalog (one test fails).

---

## 9 · Not built — stated rather than implied

- **No payment amounts.** Pricing is the RVU engine's job and needs the CMS
  Relative Value File; nothing here computes money.
- **No rule set verified against a current CPT release or PFS final rule.**
  This is the gating item before any real use.
- **No claim submission, no 837, no clearinghouse.** Candidates only.
- **No MAC-level edit reconciliation.** Same-period rules vary by jurisdiction
  and the catalog carries one set.
- **CPT II quality codes are not modelled.** The source superbill also carries
  a quality axis — medication review `G8427`, BP `G8752`/`G8753`, HbA1c
  `3044F`–`3046F`, LDL `3048F`–`3050F`, depression screening `G8431`/`G8510`,
  functional status `1170F`, BMI `Z68.x` — which is a separate reporting
  concern from care-management billing and is not implemented.
- **No enrolment or eligibility check.** Whether the patient is enrolled and
  whether the practitioner has an established relationship are prerequisites
  the caller asserts; the module cannot verify them.
