# Revenue cycle — capability, scenarios, and why

**Status:** positioning and capability reference, not a build spec
**Branch context:** `claude/world-ehr-next-gen-mjfx8x` (PR #58)
**Scope:** the US product; every transaction and statute named here is US-specific

---

## 0 · What this document is

A revenue-cycle outsourcing vendor sent a cold email listing twenty-three
services in four buckets, with a paragraph of promised outcomes underneath. The
email itself is unremarkable. The list is not: it is a reasonably complete
inventory of everything that happens to a clinical encounter between the moment
a patient gives their name at the desk and the moment the last dollar is either
collected or written off. Using it as a checklist is a legitimate use of a
sales email, and that is what this document does.

For each of the twenty-three services it answers four questions. What actually
happens at that point — the transaction, the standard, the actor, the artefact.
Every scenario that can occur there, the happy path and then everything that
goes wrong, because the scenarios are where the money and the compliance risk
both live. Where Tabula Medica stands today, labelled **Built**, **Partial**, or
**Not built**, with file paths. And our why: the principle that governs how we
would build it, or what we would refuse to build badly.

It is written for the team, to be used in build planning and in conversations
with RCM partners and buyers. It is not marketing and it is not a rebuttal of
the vendor. The tally at the end is four Partial and nineteen Not built, with
nothing fully Built. That ratio is the honest answer, and the document is
stronger for stating it than for hiding it inside adjectives.

**The through-line.** A revenue-cycle claim is an assertion to a payer, and
most of them — Medicare, Medicaid, Medicare Advantage, TRICARE, the federal
employee plans — are also assertions to the federal government. This codebase
already treats that seriously everywhere it touches money. The care-management
engine refuses to round nineteen minutes up to twenty. It refuses to pick the
higher-paying of two conflicting codes. It will not ship an unverified rule
table. It emits candidates rather than bills. The RVU engine computes no dollar
figure without an operator-supplied CMS file. None of that is caution for its
own sake; it comes from a specific observation about how RCM automation
actually fails. The ordinary failure mode is not fraud. It is a well-formed,
plausible claim that the current rules do not support — and on the way out of
the building that claim is indistinguishable from a correct one. Every
principle in this document is a variation on refusing to manufacture that
claim.

---

## 1 · Build, buy, or partner — three different decisions

The vendor's list flattens twenty-three very different things into one
proposition: *outsource all of it*. They are not one thing. Some of it is
commodity labour, some of it is a network connection nobody should build twice,
and some of it is the exact seam where the clinical record meets the claim —
which is product surface, and the only part where an EHR has a structural
advantage over a billing shop.

| Decision | What falls here | Why |
|---|---|---|
| **Own (build)** | Charge capture from the attested note; coding candidates with their evidence; documentation-support gates; the refusal logic; patient-facing estimates and statements; reporting with honestly defined metrics | This is where a clinical fact becomes a financial assertion. Whoever controls that transformation controls whether the claim is true. We already own the upstream half — the note, the care plan, the time entries, the diagnosis list — and the coding engines that turn them into candidates. Handing the transformation to a third party means the party with the least knowledge of the encounter decides what it asserts. |
| **Partner (network)** | Clearinghouse transport for every X12 transaction: 270/271, 276/277, 278, 837P/837I, 835, 999/TA1, 277CA; payer EDI enrollment; companion-guide edits; ERA/EFT enrollment; real-time eligibility endpoints | A clearinghouse is a payer connection, maintained payer by payer, with per-payer enrollment paperwork, per-payer companion guides, and per-payer quirks. Nobody builds this a second time. The February 2024 Change Healthcare outage is the case for choosing a partner whose failure mode we have thought about, not for building our own. |
| **Buy (labour)** | Insurance-A/R phone follow-up; appeal assembly; manual EOB keying; statement printing and mailing; early-out patient balance work; insurance discovery lookups | Commodity work, priced per claim or per FTE, and rightly so. The caveat is that labour carries judgement, and the judgement is where the risk sits: a follow-up team incentivised on A/R days will write off; a resubmission team incentivised on clean-claim rate will "fix" claims. Buy the labour, keep the decision rules, and keep the audit trail of what the labour changed. |

Two lines cut across all three. First, **the artefacts stay ours**: every 837
we send, every 277CA and 835 we receive, every appeal letter, every 271
snapshot. A vendor who holds the acknowledgements holds our proof of timely
filing. Second, **nothing that changes what a claim asserts is delegated
without a named human on our side attesting to it** — a rule this codebase
already applies to notes and to coding candidates, and which does not become
optional because the person doing the work is in a different company.

The seam we should own is small and specific. It is the path from an attested
note to a set of claim lines, with every line carrying a pointer back to the
evidence that supports it. The care-management engine already produces that
shape (`candidates`, `refused`, `conflicts`, each with reasons). Extending the
same shape to the whole professional claim is the product. Everything after the
claim leaves the building is transport and labour.

---

## 2 · Due diligence on the specific vendor

Standard vendor diligence, not an allegation. Any RCM vendor touching claims is
a HIPAA business associate handling protected health information at scale, and
these questions apply to every such engagement.

**What the email itself shows.** The mail provider flagged the sending domain
as newly registered. The signature names *InMerica BizSol LLC*, a Montana LLC;
the sending mailbox belongs to *Inmerica Solutech Pvt Ltd*, a private limited
company, which is an Indian corporate form. Those are two different legal
entities in two jurisdictions. Nothing about that is improper — offshore
delivery with a US contracting entity is the normal structure for this
industry — but it means the first question has a non-obvious answer.

**Questions that must be answered before a call, in writing:**

1. **Which legal entity signs the BAA**, and is it the same entity that
   performs the work? A BAA with a Montana LLC does not bind an Indian company
   unless the flow-down is explicit.
2. **Where is the work actually performed** — the physical location of the
   people who will see PHI, hold our payer-portal credentials, and read our
   patients' EOBs.
3. **Does PHI leave the US, and under what safeguards?** HIPAA does not
   prohibit offshore processing, but the business associate is fully liable,
   and several Medicaid programmes and Medicare Advantage contracts impose
   offshore-subcontractor attestation or outright restrictions — verify for
   each payer contract we hold.
4. **Subcontractor flow-down.** Who else touches the data, and does each of
   them sign a BAA with terms at least as strict as ours?
5. **The vendor's own breach-notification obligations** — timeline, content,
   and who pays for notification and credit monitoring when the breach is
   theirs.
6. **OIG exclusion screening** of the entity and every individual who touches a
   federal claim. A practice that submits claims prepared by an excluded person
   has its own exposure.
7. **Credentials.** Whether the vendor will hold our payer-portal logins,
   clearinghouse submitter ID, and EFT enrollment — and how they are revoked on
   termination.
8. **Data return and deletion on termination**, including the acknowledgement
   files that constitute our timely-filing evidence.
9. **Insurance**: cyber and errors-and-omissions cover, with limits.
10. **References** from practices of similar size and specialty, contacted
    directly.

A vendor who answers all ten crisply is a normal vendor. A vendor who cannot
answer the first one is not ready to be sent a single patient record.

---

## 3 · Patient Access & Front-End Services

### 1. Patient Registration & Demographic Verification

**What actually happens here.** Registration is the creation of the identity
and coverage record that every downstream transaction will copy. The artefact
is the patient/subscriber record: legal name as it appears on the insurance
card, date of birth, sex as the payer records it, address, the subscriber's
identity where the patient is a dependent, the relationship code between them,
the member ID and group number, the payer and its clearinghouse payer ID, plan
effective dates, and the guarantor for patient balances. On the professional
claim this becomes the subscriber and patient loops of the 837P (subscriber and
patient are separate loops precisely because they are often different people);
on paper it is the CMS-1500, maintained by NUCC, or the UB-04, maintained by
NUBC. Registration also collects the compliance paperwork: assignment of
benefits, signature on file, the Notice of Privacy Practices acknowledgement,
financial-responsibility consent, and for Medicare the Medicare Secondary Payer
questionnaire. Verification means checking each field against a source — the
scanned card, a 271 response, the MBI format rules, a USPS-normalised address —
rather than against the patient's memory.

**Every scenario that can occur.**

- *Clean:* new patient, card in hand, name and DOB match the card and the 271,
  subscriber is the patient, one payer, address deliverable.
- *Name drift:* married name versus card name; hyphenation; a middle name the
  payer stores as part of the first name; transliterated names with multiple
  spellings; suffix (Jr/Sr) present on one side only. Each is a rejection or a
  "subscriber not found" waiting to happen.
- *DOB transposition* (day/month), or DOB correct but sex recorded differently
  from the payer's file, which triggers payer age/sex edits on sex-specific
  services. Transgender patients hit this routinely; the claim needs the
  payer-recognised override (on Medicare, modifier `KX`; on institutional
  claims, the NUBC condition code for this case) and the registration record
  needs to carry both what the patient is and what the payer has on file.
- *Patient is a dependent:* subscriber is a spouse, a parent, an ex-spouse
  under a court order, or a deceased subscriber whose coverage continued.
  Wrong relationship code is a rejection.
- *Newborn:* on the mother's coverage for a limited period, often with no
  member ID yet; claims must be filed under the mother's ID with the correct
  relationship, and the window is plan-specific — verify.
- *Minor with a guarantor* who is not the subscriber; a minor who is emancipated
  or is seeking confidential services where state law restricts what a
  statement to the guarantor may disclose.
- *Duplicate record:* the patient already exists under a slightly different
  name, so two charts and two A/R balances accrue; or two patients are merged
  who are not the same person, which is a clinical safety event, not a
  billing one.
- *Address undeliverable* or a PO box a payer rejects; patient moved; patient
  homeless with no address to put in a required field.
- *Coverage recorded from a stale card* — the plan changed at open enrollment
  and the patient did not mention it.
- *Multiple coverages* not disclosed at registration, so coordination of
  benefits is discovered by a denial.
- *Medicare beneficiary presents the red-white-blue card* but is actually
  enrolled in a Medicare Advantage plan; traditional Medicare will deny, and
  the MA plan's timely-filing clock has been running.
- *MSP questionnaire wrong* — working aged with an employer plan, disability
  with a large-employer plan, ESRD in the coordination period, liability or
  workers' compensation for the condition treated. Filing Medicare primary when
  it is secondary is a recoverable overpayment.
- *Self-pay or uninsured*, which since the No Surprises Act triggers the
  good-faith-estimate obligation at scheduling.
- *Workers' compensation / auto / liability:* a different payer, a claim
  number instead of a member ID, an adjuster, and state-specific fee schedules
  and forms.
- *Language and accessibility:* the patient cannot read the financial
  consent; Section 1557 language-access obligations apply to the forms.
- *Signature on file missing* — assignment of benefits absent, so the payer
  pays the patient, not the practice.
- *Deceased patient* (registration for a final claim; statements to an estate).
- *Identity fraud:* the person presenting is not the cardholder.

**Where Tabula Medica actually stands: Partial.** The patient demographic
record is the product's core object, and the international work added real
identifier validation — Verhoeff for ABHA, modulus-11 for the NHS number — in
`shared/jurisdictions.ts`, with the principle that structural validity is not
identity. What does not exist is the coverage half of registration: there is no
subscriber/dependent model, no relationship code, no payer or payer-ID record,
no plan effective dates, no guarantor, no MSP questionnaire, no assignment of
benefits, and no verification of any of it against a payer. The demographic
record can be verified against a national identifier; it cannot be verified
against an insurer.

**Our why.** Registration is the one place where an error is cheap to fix and
everywhere else it is expensive. Every downstream artefact copies this record,
so a wrong relationship code at the desk becomes a rejection, a resubmission,
a timely-filing risk, and a patient statement to the wrong person. The
principle from the passport work applies directly: **verify against a source,
and say which source.** A registration field should carry where it came from —
the scanned card, the 271, the patient's word — the same way a passport carries
its assurance level, because the coder and the follow-up team will need to
know which fields were checked and which were taken on trust. We would not
build a registration screen that lets a required field be satisfied by a
placeholder, for the same reason the care-plan model refuses a checkbox in
place of a plan.

### 2. Insurance Eligibility & Benefits Verification

**What actually happens here.** A 270 eligibility inquiry goes from the
practice, via a clearinghouse, to the payer, and a 271 response comes back.
Both are HIPAA-mandated transaction standards under 45 CFR Part 162 (ASC X12
005010), and the CAQH CORE operating rules layer response-time and content
requirements on top. The 271 carries EB segments — coverage active or
inactive, plan name, the service-type codes it answers for, and where the payer
supports it, deductible, remaining deductible, copay, coinsurance, out-of-pocket
status, and in-network versus out-of-network splits — plus AAA segments when
the request itself failed (subscriber not found, invalid ID, payer down).
Verification happens at scheduling, again within a short window before the
visit, and ideally again on the date of service, because coverage changes
between those points. For Medicare, the source is the MAC's eligibility system
via the same transactions or the HETS interface; for Medicaid, the state
eligibility system, with managed-care assignment on top.

**Every scenario that can occur.**

| Scenario | What it looks like | What it does downstream |
|---|---|---|
| Active, benefits detailed | EB active, deductible and copay returned | The clean path; still a snapshot, not a guarantee of payment |
| Active, generic only | 271 answers "active" for the general health-plan service type and nothing else | Patient responsibility unknown at the desk; estimate cannot be given honestly |
| Inactive / terminated | EB inactive, sometimes with a termination date | Bill the patient or find other coverage; if not caught, a denial in weeks |
| Retroactively terminated | 271 said active on the DOS; the plan later terminates back to a date before it, typically for non-payment of premium | Paid claim recouped; the practice discovers it in an 835 takeback months later |
| Not yet effective | Plan effective date after the DOS | Denial; patient may have a prior plan still active |
| Marketplace grace period | Subsidised enrollee behind on premium; the plan may pend claims during the later part of the grace period and deny them if coverage lapses | Claim sits in "pending" and then fails; the length and pend rules need verification against the plan |
| Traditional Medicare | Part A only, Part B only, or both; Part B enrollment date | Part-B-only services to a Part-A-only beneficiary are the patient's |
| Medicare Advantage | Beneficiary is in an MA plan; traditional Medicare 271 shows MA enrollment | Bill the MA plan under its rules, network, auth requirements, and timely-filing window |
| Medicare Secondary Payer | Employer group plan, disability with a large employer, ESRD coordination period, liability, workers' comp | Medicare must be billed second, with the primary's adjudication attached |
| Hospice election | Beneficiary has elected hospice | Services related to the terminal condition bill to the hospice, not Part B; unrelated services need the payer-recognised modifier — verify which |
| SNF Part A stay | Beneficiary is in a covered SNF stay | Many Part B services are consolidated into the SNF's payment and must be billed to the SNF |
| Dual eligible / QMB | Medicare plus Medicaid; QMB status | The practice may not bill the patient for Medicare cost-sharing at all; Medicaid is payer of last resort and may pay nothing further |
| Medicaid FFS vs managed care | State assigns the patient to an MCO, sometimes retroactively | Wrong payer; MCO has its own network and auth rules |
| Retroactive Medicaid | Eligibility granted after the DOS with a look-back | A self-pay balance becomes a Medicaid claim, with Medicaid's timely-filing and balance-billing rules |
| Primary / secondary / tertiary | Two or more plans, including a spouse's | Birthday rule for dependants, employer-plan-first for working aged, and the secondary needs the primary's 835 adjustments on the 837 |
| Capitated | Patient is assigned to a capitated group; the visit is covered by the capitation payment | A fee-for-service claim is not payable; encounter reporting still required |
| Fee-for-service, deductible not met | Active coverage, high deductible, nothing met | Nearly the whole allowed amount becomes patient responsibility; the front desk should know before the visit |
| Out-of-network | Provider not in the plan's network; OON benefits may exist or not | Different allowed amount, balance-billing rules, and No Surprises Act protections in specific settings |
| Referral-required HMO | Plan needs a PCP referral on file | The 271 may not say so; the denial will |
| Payer ID mismatch | The clearinghouse payer ID chosen does not route to the entity that holds this member | "Subscriber not found" even though coverage is real |
| Member ID format drift | Prefix added or dropped; leading zeros stripped by a spreadsheet; MBI with an ambiguous character; a plan that migrated ID formats | Same |
| Name / DOB mismatch | Payer's file differs from the card | Same; and the "fix" of editing the patient record to match the payer is how a chart drifts from the person |
| Coverage under a different subscriber | Patient is a dependent; the inquiry was sent as subscriber | AAA rejection; retry with subscriber details |
| Real-time endpoint down | Payer or clearinghouse unavailable; batch 270 overnight instead | Visit proceeds on stale information; must be re-verified before the claim goes |
| Payer not on the clearinghouse | Small plan, union fund, or TPA with no EDI eligibility | Phone or portal verification, which must be recorded with who, when, and what was said |
| Workers' comp / auto | No 271 at all; verification is with an adjuster | Claim number, authorisation, and jurisdiction-specific fee schedule |
| Coverage active, provider not credentialed | The patient is covered but the rendering provider is not enrolled with this payer | Denial for provider not enrolled — an eligibility problem on the other side of the table |

**Where Tabula Medica actually stands: Not built.** There is no 270/271, no
clearinghouse connection, no payer connection, and no eligibility or enrollment
verification of any kind. One filename must not mislead:
`server/services/care-management/eligibility.ts` is the care-management coding
engine's prerequisite evaluator — "documented facts in, billable candidates
out" — and has nothing to do with insurance eligibility. The care-management
docs already state that whether the patient is enrolled is a fact the caller
asserts and the module cannot verify. That remains true product-wide.

**Our why.** A 271 is a snapshot with a timestamp, from a system that
disclaims its own answers, and the practice acts on it anyway. That is fine as
long as the product never lets a snapshot pretend to be more than it is.
Concretely: **store the 271, not a boolean.** A field that reads `eligible:
true` loses the date it was checked, the service type it was checked for, and
whether benefit detail was actually returned or the payer answered "active"
and nothing more. Those are the three things a denial appeal will need, and
the three things the desk needs to give an honest estimate. This is the same
argument the passport verification makes when it returns `keyTrust` and a
caveat instead of a bare `valid` — a caller that reads the boolean and stops
is exactly how these systems fail. When we build eligibility, the response
object carries the whole 271, the check time, and a plain statement of what
was and was not answered; a screen that reduces it to a green tick is refused.

### 3. Prior Authorization & Referral Support

**What actually happens here.** For a service the plan gates, the practice
asks permission before performing it. The HIPAA standard transaction is the
278 request and response, but in practice most prior authorisation runs
through payer portals, fax, and phone, and through delegated
utilisation-management vendors that hold the decision for a category of service
(imaging, specialty drugs, sleep studies, genetic testing). The
CMS Interoperability and Prior Authorization final rule (CMS-0057-F) requires
impacted payers — Medicare Advantage, Medicaid and CHIP managed care and FFS,
and Marketplace QHPs — to expose a FHIR-based Prior Authorization API built on
the HL7 Da Vinci PAS, CRD, and DTR implementation guides, with compliance dates
in the 2026–2027 range and decision-time limits — verify the exact dates and
timeframes against the rule. The artefact is an authorisation number tied to a
member, a provider, a service (CPT/HCPCS), a site, a date range, and a unit
count. A "referral" in the RCM sense is the plan's referral authorisation from
a PCP to a specialist, which HMO-type plans require on the claim; it is not
the clinical referral letter.

**Every scenario that can occur.**

- *Not required:* the service is not on the plan's list. Lists change by plan,
  by product line within a plan, and by year.
- *Required and obtained, matching:* number on file, matching CPT, site,
  provider NPI, date range, and units.
- *Obtained for the wrong thing:* CPT changed intra-procedure (diagnostic to
  therapeutic); a different laterality; more units than approved; a different
  rendering provider or facility than named; the DOS fell outside the window
  because the procedure was rescheduled.
- *Expired* before the service.
- *Obtained, then denied anyway:* an authorisation is not a guarantee of
  payment; the payer can still deny for medical necessity, eligibility at
  DOS, or coding.
- *Retroactive authorisation:* some plans allow it within a window after an
  emergency or when eligibility was unknown; most do not.
- *Emergency exception:* no auth needed for emergency care, but the plan
  decides whether it was an emergency, and the No Surprises Act governs the
  OON case.
- *Peer-to-peer* requested; the physician's time is unbilled and the window is
  short.
- *Denied on step therapy* (including Part B drugs under some MA plans): the
  plan wants a cheaper alternative tried first.
- *Referral required, none on file:* HMO patient seen by a specialist without
  the PCP's referral number.
- *Referral on file for a different specialist* or an exhausted visit count.
- *Delegated entity:* the auth lives with a medical group or IPA, not the
  payer, and the 278 goes to the wrong place.
- *Plan changed mid-course:* a multi-visit treatment authorised by plan A
  continues under plan B.
- *Gold-carding:* state or plan programmes exempt providers with high approval
  rates from auth for specific services; the exemption has conditions and can
  be lost.
- *Payer portal outage* on the day the auth is due; the rescheduled procedure
  falls outside the window.
- *Authorisation obtained by a vendor* under our credentials, with the record
  held in their system rather than ours.
- *Auth number transcribed wrong* on the claim — a rejection with a correct
  authorisation sitting in a drawer.

**Where Tabula Medica actually stands: Not built.** No 278, no
prior-authorisation workflow, no authorisation record, no payer-rule tables.
`server/services/provider-directory/referral-composer.ts` generates a
*clinical* referral from an NPPES search — the letter to the specialist — and
should not be mistaken for payer referral support. What the product does have
is relevant to the near future: an extensive FHIR R4 surface (gateway,
validation, profile validation, terminology, SMART App Launch), which is the
substrate the CMS-0057-F Prior Authorization API is built on.

**Our why.** Prior authorisation is where the clinical record is asked to
justify itself in advance, and the two failure modes are opposite. One is not
asking, which costs a denial. The other is *manufacturing the justification*
— restating the note in the language of the plan's criteria until it passes.
The second is the one an automated system drifts toward, because it is
rewarded every time. Our position is the one the ambient scribe already takes:
**nothing is populated without evidence**, and a prior-auth request is built
from the attested note by pointer, not by paraphrase. The DTR questionnaire
answers should be fillable only from record elements that exist, with the gap
shown to the clinician rather than papered over. The FHIR rule makes this
buildable as product rather than as portal labour, and it is the one part of
this line we should own; the phone and fax work around it is labour to buy.

### 4. Insurance Discovery

**What actually happens here.** For a patient recorded as self-pay, or whose
coverage cannot be verified, discovery is the search for coverage the patient
did not present: batch 270 probes across many payers using demographics alone,
vendor databases assembled from prior claim traffic, Medicaid eligibility
checks including retroactive grants, Medicare entitlement checks, and
third-party liability (auto, workers' compensation, other liable parties).
The regulatory shape matters: Medicaid is the payer of last resort and states
run their own TPL programmes; Medicare Secondary Payer rules make Medicare
last in defined situations; and a payer discovered after the fact still has a
timely-filing window that has been running since the DOS.

**Every scenario that can occur.**

- *Coverage found, active on the DOS:* the ideal — a self-pay balance becomes
  a claim.
- *Coverage found, but not active on the DOS.*
- *Coverage found, timely filing already lapsed:* the practice has coverage
  and no claim; some payers accept proof of the discovery date as good cause,
  most do not.
- *Coverage found for a different person* with the same name and DOB — a
  false match that, if billed, is a claim for services not rendered to that
  member.
- *Coverage found, patient did not want it used:* a patient who chose to
  self-pay for confidentiality has a HIPAA right to restrict disclosure to the
  plan when they pay in full; discovery must not override it.
- *Medicaid found retroactively:* the balance already collected from the
  patient must be refunded, because Medicaid balance-billing prohibitions
  apply once eligible.
- *QMB found:* cost-sharing already collected from the patient must be
  refunded.
- *Medicare found, but the patient is in an MA plan* (see line 2).
- *Third-party liability found:* an auto carrier or a liability claim; the
  bill goes there, and Medicare and Medicaid must be told, because of MSP and
  TPL recovery rules.
- *Multiple coverages found* — now coordination of benefits applies.
- *Nothing found:* the patient remains self-pay; the search itself is a
  disclosure of PHI to every payer probed and must be minimum-necessary.
- *Discovery vendor contingency fee* on recovered amounts, which shapes what
  the vendor bothers to find.

**Where Tabula Medica actually stands: Not built.** No insurance discovery, no
batch eligibility, no TPL logic.

**Our why.** Discovery is a search for a payer to assert something to, which
makes it the line where the assertion is most likely to be made to the wrong
party. **A discovered coverage is a lead, not a payer, until a 271 for that
member on that DOS says otherwise** — and the claim built on it must carry
the discovery source, so that a false match can be traced back and refunded.
This is labour and data to buy, from a vendor with real payer traffic; it is
not something we would build. What we would build is the gate: no claim
leaves on a discovered coverage without a confirming eligibility response
stored beside it, and no patient who elected self-pay restriction is probed.

### 5. Charge Capture & Coding Support

**What actually happens here.** Charge capture is the conversion of a
documented encounter into billable lines: CPT or HCPCS Level II codes with
modifiers, units, ICD-10-CM diagnoses in sequence with pointers from each line
to the diagnoses that justify it, place of service (CMS POS codes), date of
service, rendering, billing, referring, and supervising providers by NPI, and
for facilities the chargemaster line with its revenue code. The professional
side traditionally ran on a superbill or encounter form; the facility side on
a chargemaster. Coding support in the front-end bucket means helping the
clinician land on the right code at the point of documentation — E/M level by
MDM or total time under the current office/outpatient rules, the correct
diagnosis specificity, the modifiers a same-day E/M and procedure require —
rather than the retrospective coding of line 7. Code sets move on a schedule:
ICD-10-CM annually on 1 October, CPT annually on 1 January, HCPCS quarterly,
and the payment rules that sit under them with each PFS final rule.

**Every scenario that can occur.**

- *Documented and charged, matching:* note signed, one line per service,
  units right, modifiers right, diagnoses pointed.
- *Documented, not charged:* a procedure in the note with no line — the pure
  leakage case the vendor sells against.
- *Charged, not documented:* a line with no supporting note, or a note that
  was templated in and never edited. This is the false claim case.
- *Charged before the note is signed:* the claim asserts a service the
  clinician has not yet attested; a later edit to the note orphans the charge.
- *Wrong units:* drug J-codes whose unit is a milligram fraction rather than
  a vial; time-based codes without documented time; a bilateral procedure
  billed as two lines instead of a modifier.
- *Wrong DOS* — the encounter spanned midnight; the charge entered the day
  after.
- *Wrong POS:* office versus facility, and telehealth (POS 02 versus 10,
  modifier 95, and audio-only), where Medicare's telehealth coverage has been
  extended repeatedly by legislation and the status on the DOS needs
  verification.
- *Wrong rendering provider:* the charge lands under the supervising
  physician for a service the NP performed, which is only correct under
  incident-to or split/shared rules, each with conditions (physician presence,
  established plan of care, the substantive-portion rule and modifier for
  split/shared) that the note must satisfy.
- *E/M plus procedure, same day:* modifier 25 asserts a significant,
  separately identifiable E/M; if the note only documents the procedure's
  pre-work, it is not.
- *E/M in a global period:* the 0-, 10-, or 90-day global surgical package
  bundles the visit unless modifier 24 (unrelated) is genuinely supported.
- *Preventive plus problem-oriented same day* (an annual wellness visit and a
  sick E/M) — allowed with modifier 25 when the problem work is real.
- *Discontinued or reduced procedure* (modifiers 52, 53, 73, 74).
- *Non-covered service without an ABN:* Medicare requires an Advance
  Beneficiary Notice before the service for a likely-non-covered item; a claim
  after the fact carries `GA` (ABN on file), `GY` (statutorily excluded), or
  `GZ` (expected denial, no ABN), and the last one means the practice eats it.
- *NDC required* (Medicaid and some commercial plans require the NDC alongside
  the J-code).
- *Reference-lab pass-through* — who bills the lab work depends on Medicare's
  anti-markup and direct-billing rules.
- *Self-pay patient:* what price is the charge? The No Surprises Act
  good-faith estimate already given constrains it.
- *Charge lag:* the encounter is a week old and the charge has not been
  entered; every day is a day of timely-filing window spent.
- *Duplicate charge* from a re-entered encounter.
- *Code set rolled over between DOS and charge entry* — a code valid in
  September, deleted in October.
- *Scribe- or AI-drafted note:* the charge is built from text the clinician
  has not yet attested.
- *Care management and RPM:* monthly charges that depend on time thresholds,
  device-day counts, consent, and a care plan (see `docs/care-management-coding.md`).

**Where Tabula Medica actually stands: Partial.** This is the line where the
product has the most, and it is worth being precise about what.
`server/services/care-management/` turns documented facts into *candidates*
for CCM, complex CCM, PCM, APCM, RPM, and care planning, with refusals, unused
minutes, and unresolved conflicts, exposed at
`POST /api/care-management/evaluate`. `server/services/risk-adjustment/`
does the same for CMS-HCC v28. `server/services/rvu/` prices a code once the
operator loads the CMS Relative Value File and attributes wRVUs per provider.
`server/services/clinical-catalog/` supplies a diagnosis pick list and
guideline-driven lab panels. `server/services/ambient-scribe/` builds a
structured note where every element is evidence-linked and the bundle will not
emit without attestation. What is missing is the charge itself: there is no
claim-line object, no CPT/HCPCS charge for an E/M or a procedure, no modifier
logic, no diagnosis pointers, no POS, no charge-lag tracking, no chargemaster,
and no path from an attested note to an 837 line. The pieces that exist are
the ones that decide *whether* a code is supported; nothing yet decides *what
to bill*.

**Our why.** This is the seam, and the reason the whole document exists.
Charge capture is where a clinical fact becomes a financial assertion, and the
engines already here were built around one rule for that moment: **the system
checks arithmetic and prerequisites, and it cannot know whether the work was
done.** So it proposes, it never bills; it floors time and reports the
remainder; it refuses a code whose prerequisite is undocumented instead of
warning and proceeding; and it surfaces a conflict rather than resolving it
toward revenue. Extending charge capture to the full encounter means keeping
that shape — a candidate line carrying pointers to the evidence in the
attested note, a refusal that names what is missing, and a modifier that is
proposed with its justification rather than appended by default. The generic
EHR's charge capture is a superbill with checkboxes; the generic RCM vendor's
is a coder reading the note after the fact. Ours is the note itself, producing
lines it can defend, and refusing lines it cannot. That is the only version of
"reduce leakage" that does not also increase what is claimed without support.

---

## 4 · Claims & Billing Management

### 6. Accurate Charge Entry

**What actually happens here.** Charge entry is the keying or interface of
captured charges into the billing system, producing the claim before it is
scrubbed. In an integrated system it is an interface from the EHR; in the
outsourced model it is a person reading superbills or encounter summaries and
typing. The artefact is the pre-claim: header (patient, subscriber, payer,
billing provider, accept-assignment indicator, prior-auth number, referring
provider), lines (CPT/HCPCS, modifiers, units, charge amount from the fee
schedule, diagnosis pointers, DOS, POS, rendering NPI), and the claim frequency
code that says whether this is an original, a replacement, or a void. The
charge amount is the practice's fee, which is not the expected payment — a
distinction that matters at posting and in variance analysis.

**Every scenario that can occur.**

- *Straight-through:* interface delivers the charge; no human retyping.
- *Manual keying error:* transposed CPT digits, a modifier on the wrong line,
  units of 10 for 1, the wrong patient's encounter.
- *Wrong fee-schedule amount:* the charge master has last year's fee, or a
  zero, which some payers reject and others pay at zero.
- *Missing referring provider* on services that require one (diagnostic
  tests, DME, consults under some plans).
- *Missing prior-auth number* when one exists.
- *Wrong billing entity:* a group with multiple TINs or locations; the claim
  goes out under the wrong NPI/TIN pair and pays to the wrong bank account, or
  is denied for provider not enrolled at that location.
- *Accept-assignment indicator wrong* on a non-participating provider's
  Medicare claim.
- *Diagnosis pointer omitted*, so the line has no medical-necessity link.
- *Claim frequency wrong:* a correction sent as a new original creates a
  duplicate; an original sent as a replacement with no payer control number
  is rejected.
- *Batch entered against the wrong DOS* after a schedule change.
- *Charge entered for a cancelled visit* that was never removed from the
  schedule.
- *Entry backlog:* the vendor's turnaround SLA is met on average and missed on
  the claims that matter.
- *Post-entry edit to the note* that invalidates the charge already keyed.
- *Interface failure:* charges silently not transmitted, discovered by a
  month-end reconciliation of encounters to charges — or not discovered.

**Where Tabula Medica actually stands: Not built.** No claim object, no charge
entry, no fee schedule, no billing-provider configuration. `server/billing-routes.ts`
is Stripe-based SaaS subscription billing — plans, entitlements, seats,
invoices, webhooks — for charging customers for the software. It has nothing
to do with medical claims and should never be described as if it did.

**Our why.** "Accurate" here has a precise meaning: **the claim says what the
attested record says, and nothing else.** Manual charge entry is a transcription
step, and transcription is where content changes without anyone deciding to
change it. If we build this, it is as an interface from the attested note to
the claim, not as a keying screen — and the reconciliation that matters is
encounters-to-charges, run every day, so that a charge that never left is
visible before its timely-filing window is. A keyed claim with no pointer back
to a note is a claim we cannot defend; the product should not be able to
produce one.

### 7. Medical Coding Support

**What actually happens here.** Certified coders (CPC, CCS, and specialty
credentials) review the documentation and assign or validate CPT, HCPCS Level
II, ICD-10-CM, and modifiers; on the inpatient side, ICD-10-PCS and MS-DRG
assignment. Coding is governed by the ICD-10-CM Official Guidelines, CPT
guidelines and the AMA's E/M rules, CMS's NCCI policy manual, and — for
clinical documentation improvement — the AHIMA/ACDIS compliant-query practice
brief, which sets the line between a legitimate query to the provider and a
leading one. The audit regime is dense: MAC Targeted Probe and Educate,
Recovery Audit Contractors, CERT, UPIC, OIG audits, and commercial payer
post-payment review; the legal backstop is the False Claims Act, whose
"knowingly" standard includes reckless disregard, and the identified-overpayment
rule requiring report and return within the statutory window (60 days under
the ACA — verify against current CMS text).

**Every scenario that can occur.**

- *Documentation supports the code as charged.*
- *Documentation supports a lower code:* the note describes low MDM, the
  charge says moderate. Downcode, and note the pattern by provider.
- *Documentation supports a higher code:* the clinician under-coded. Upcoding
  to what is documented is legitimate; the pattern is worth reporting but
  carries no compliance exposure the other way — except that systematic
  undercoding is itself a data-integrity problem for risk adjustment and
  quality reporting.
- *Documentation is ambiguous:* a query is needed. A compliant query presents
  the clinical indicators and asks an open question; a query that suggests
  the answer — "would you agree this was sepsis?" — is the thing OIG writes
  reports about.
- *Provider disagrees with the coder.* The provider is the one attesting; the
  disagreement is recorded, not overruled silently.
- *Coder changes a code without the provider seeing it.* The claim now asserts
  something the attester did not attest.
- *Unspecified diagnosis* where the note contains specificity (laterality,
  type, stage, 7th-character encounter type).
- *Excludes1 conflict* between two diagnoses; sequencing wrong for the
  service.
- *Chronic conditions listed but not addressed* — the HCC question: was the
  condition monitored, evaluated, assessed, or treated in this encounter, or
  just carried forward on the problem list?
- *"History of" coded as active*, or the reverse.
- *Cloned notes:* copy-forward text that supports a level the visit did not
  earn.
- *Template-driven documentation* that ticks every review-of-systems box
  regardless of what happened — a pre-2021 artefact still present in many
  charts.
- *New versus established patient* under the three-year rule across the
  group's specialties.
- *Consultation codes* not recognised by Medicare and several commercial
  plans.
- *Modifier 59 versus the X{E,P,S,U} modifiers*, and the NCCI pair where the
  modifier indicator forbids any bypass.
- *Screening versus diagnostic* (colonoscopy that found a polyp; mammogram
  after a symptom) — different codes, different patient cost-sharing, and a
  frequent patient complaint.
- *Prolonged services* with time documented, or not.
- *Coding to coverage:* selecting a diagnosis because the LCD lists it, rather
  than because the patient has it. This is the specific abuse a
  "denial-avoidance" coding tool is built to commit.
- *AI-suggested codes* accepted without review, at scale, with the same error
  in every chart.
- *Coder productivity incentives* (charts per hour) that reward accepting the
  charge as entered.
- *Code set version:* the note is coded with a code valid at the time of
  coding, not on the DOS.
- *Retrospective coding for risk adjustment* — a chart review that adds
  diagnoses to prior encounters, which is a RAF assertion (see
  `docs/hcc-v28-and-ecw.md`).

**Where Tabula Medica actually stands: Partial.** The product has three
purpose-built coding engines and a documentation pipeline, and no
general-purpose coder. `server/services/care-management/` evaluates
CCM/PCM/APCM/RPM/G0506 against nine enumerated care-plan elements, consent,
condition counts, device days, and MDM, and refuses with a named reason.
`server/services/risk-adjustment/` maps diagnoses to CMS-HCC v28 with the
tables supplied by the operator (`HCC_V28_TABLES_PATH`), and includes
documentation-gap and suspect-condition logic (`documentation-gaps.ts`,
`suspect-rules.ts`) and an AI reviewer that runs under the BAA-safe helper.
`server/services/clinical-catalog/diagnosis-catalog.ts` is a diagnosis pick
list. `server/services/ambient-scribe/note-builder.ts` produces a note whose
every element points at evidence in the transcript. There is no E/M leveller,
no procedure coder, no ICD-10-CM guideline engine, no Excludes1 checking, no
NCCI/MUE tables, no LCD/NCD checking, and no query workflow. The shipped
care-management catalog is a development seed marked `verified: false`; every
candidate carries `unverifiedRules: true` until an operator loads a rule file
that asserts `verified: true` and names its source.

**Our why.** Coding support is the line where the vendor's promise and the
compliance risk are the same sentence. "Improve coding accuracy" can mean
*bring the code down to the documentation* or *bring the documentation up to
the code*, and a service paid on collections has one of those as its natural
gradient. The engines here were built against that gradient explicitly.
**A candidate is not a bill. A conflict is reported, not resolved. An
undocumented prerequisite is a refusal, not a warning. A rule table nobody has
verified is a seed wearing a filename.** Each of those is a refusal to
manufacture the document an audit will ask for. The differentiator is not
that we code better than a certified coder — we do not, and we do not claim
to — it is that the coding step in this product cannot be pointed at revenue
and told to optimise, because the outputs are proposals with their evidence
attached and the human who attests is the human who is liable. We will add
E/M levelling and procedure coding on the same terms: the level is derived
from what the attested note contains, the derivation is shown, and the
clinician can disagree with it in the record.

### 8. Electronic Claims Submission

**What actually happens here.** The claim is serialised as an 837P
(professional) or 837I (institutional) under the HIPAA transaction standards
(45 CFR Part 162, X12 005010), wrapped in ISA/GS interchange and functional
group envelopes, and transmitted — almost always to a clearinghouse, which
validates it, translates it to each payer's companion-guide flavour, and
forwards it. Medicare requires electronic submission under the Administrative
Simplification Compliance Act with narrow exceptions. Three acknowledgements
come back, at three levels: a **TA1** for the interchange envelope, a **999**
for the functional group's syntactic acceptance or rejection, and a **277CA**
for each claim's business-level acceptance or rejection with a payer-assigned
claim control number. A claim is "received" by the payer at the 277CA accept,
not at transmission; everything before that is transport. The claim frequency
code distinguishes an original from a replacement (with the payer's original
control number attached) and a void. Attachments have no mandated standard;
payers accept a PWK indicator with fax or portal upload.

**Every scenario that can occur.**

- *Accepted at all three levels:* TA1 clean, 999 accepted, 277CA accepted with
  a payer ICN. The claim is now in adjudication.
- *TA1 rejection:* envelope problem — wrong submitter ID, wrong receiver,
  malformed control numbers. The entire batch is not received.
- *999 rejection:* syntax — a segment out of order, a data element too long,
  an invalid code value. The group is rejected; every claim in it is not
  received.
- *999 accepted with errors:* partial; some transaction sets rejected.
- *277CA rejected:* business edits — subscriber not found, NPI not enrolled,
  invalid taxonomy, DOS outside coverage, missing referring NPI, invalid
  diagnosis pointer, duplicate of a claim already on file. Not received, and
  not adjudicated.
- *Clearinghouse rejection before the payer:* the clearinghouse's own edits
  or its companion-guide translation failed; the payer never saw it.
- *No acknowledgement at all:* the batch was sent and nothing came back. This
  is the worst case, because the practice believes the claims are in process
  and the timely-filing clock is running on claims nobody has.
- *Acknowledgement received but never reconciled:* the 277CA rejection sits
  in a folder; the claim ages in A/R as "submitted".
- *Duplicate submission:* a resend of an accepted claim; denied as duplicate,
  and a pattern of duplicates draws payer attention.
- *Corrected claim sent wrong:* frequency 7 without the payer's control
  number, or an original resent for a correction, creating a duplicate. Some
  payers — Medicare Part B MACs among them — do not treat a frequency-7
  replacement as the correction path for professional claims and require a
  reopening instead; verify with the MAC.
- *Void needed:* the service was not rendered, or was billed to the wrong
  patient; a frequency-8 void must go, not a silent write-off.
- *Secondary claim:* the 837 must carry the primary's adjudication (the
  adjustment segments from the primary's 835) in the other-payer loop; a
  secondary claim without them is rejected or pended.
- *Crossover:* Medicare forwards to Medigap or Medicaid automatically under
  a COBA agreement; a manual secondary submission on top duplicates it.
- *Attachment required:* the payer wants records; the PWK indicator says they
  are coming by fax, and they must actually be sent.
- *Paper claim required:* a payer with no EDI, or a claim type the payer does
  not accept electronically; CMS-1500 or UB-04 printed, with different
  timely-filing proof.
- *Payer ID changed* after a merger; claims route to the old entity.
- *Clearinghouse outage* for days or weeks; claims queue, and every one of
  them ages against its filing window.
- *Submitter ID revoked* or password expired at the clearinghouse or the
  MAC's EDI gateway.
- *Batch contains a claim the vendor edited* to pass an edit — content changed
  in transit without the attester knowing.

**Where Tabula Medica actually stands: Not built.** No 837P, no 837I, no
clearinghouse adapter, no envelope generation, no TA1/999/277CA handling, no
submitter or trading-partner configuration. The care-management docs state it
in one line: "No claim submission, no 837, no clearinghouse. Candidates only."
That is true of the whole product.

**Our why.** Submission is the moment the assertion leaves. Two principles.
First, **transport is partnered, never built** — a clearinghouse is a
maintained set of payer relationships, and building it is building a second
clearinghouse. Second, and this is the one we own: **every claim sent has its
acknowledgement chain stored beside it, and a claim without a 277CA accept is
not "submitted", it is "unacknowledged".** The status vocabulary in the product
must refuse to collapse those. The passport work returns `unverified-issuer`
rather than a bare success because a caller that reads the boolean and stops
is how the scheme fails; a claim status of "sent" that hides "no
acknowledgement received" fails in exactly the same way, with a timely-filing
denial as the consequence. The 277CA is also our proof of timely filing, which
is why the artefacts stay ours regardless of who operates the connection.

### 9. Claim Scrubbing & Quality Checks

**What actually happens here.** Before submission, the claim is run through
edits that predict what the clearinghouse and payer would reject or deny:
X12 syntax; payer companion-guide requirements; NPI, taxonomy, and enrollment
checks; ICD-10-CM validity on the DOS and billable-code (leaf) status; CPT
validity on the DOS; NCCI procedure-to-procedure edits with their modifier
indicators; Medically Unlikely Edits with their adjudication indicators;
LCD/NCD medical-necessity pairing of diagnosis to procedure; modifier
validity and modifier-to-code compatibility; age and sex edits; POS-to-code
consistency; global-period checks; timely-filing checks; duplicate detection
against claims already sent; and payer-specific rules (referring provider
required, NDC required, auth number required). The scrubber produces a pass, a
list of edits to fix, or — in the dangerous implementations — auto-corrections.

**Every scenario that can occur.**

- *Passes clean.*
- *Fails on a true error* (invalid code on DOS, missing required field) that
  the biller fixes from the record.
- *Fails on a false positive:* the scrubber's rule is stale or wrong for this
  payer; the biller overrides. Overrides need a reason and a name.
- *Passes a claim that will deny:* the scrubber cannot see medical necessity
  in the note, only the code pairing; a clean pairing on an unsupported
  service passes.
- *NCCI pair hit, modifier indicator 1:* a modifier *may* be appropriate if
  the services were genuinely distinct. The scrubber cannot know; a human
  must, from the note.
- *NCCI pair hit, modifier indicator 0:* no modifier is permitted; the
  column-two code is bundled, and the "fix" is to remove the line, not to
  add 59.
- *MUE exceeded:* units above the MUE; the adjudication indicator decides
  whether the excess is denied per line or per DOS, and whether a modifier
  can justify it. Splitting the units across lines to evade a per-line MUE is
  a documented abuse.
- *LCD/NCD mismatch:* the diagnosis on the claim is not one the coverage
  determination lists. The correct responses are: the patient has a listed
  condition and the note says so (recode from the note); the patient does not
  and an ABN was obtained (bill with `GA`); the patient does not and no ABN
  exists (`GZ`, expect denial). The incorrect response, which is the one a
  denial-avoidance tool will suggest, is to pick a listed diagnosis.
- *Auto-correction:* the scrubber appends modifier 25 or 59, changes a POS,
  or drops a diagnosis to clear an edit — content changed by a rule with no
  attester.
- *Rule table stale:* NCCI updates quarterly, LCDs change on the MAC's
  schedule, payer edits change by bulletin; a scrubber that was right in
  January is wrong in April in ways nobody sees.
- *Payer-specific edit missing:* the scrubber is generic; the payer rejects.
- *Scrubber SLA versus timely filing:* claims held in the scrubber's queue
  awaiting a human are aging.
- *Quality sampling:* a post-scrub audit of a sample of claims against the
  notes, which is the only check that catches the "well-formed and
  unsupported" claim.

**Where Tabula Medica actually stands: Not built.** No claim scrubber, no
NCCI/MUE edit engine, no LCD/NCD checking, no payer rule tables. The
FHIR validation surface (profile validation, terminology) validates FHIR
resources, not X12 claims, and should not be described as a scrubber.

**Our why.** A scrubber is a machine for producing claims that pass. That is
its whole purpose, and it is why a scrubber is the most dangerous component in
the revenue cycle: it optimises for the property — *passes the payer's edits*
— that a well-formed unsupported claim shares with a correct one. The line we
would hold is that **a scrubber may refuse, and may explain, and may never
change the content of a claim.** No auto-modifier, no auto-diagnosis
substitution, no unit splitting. Every edit it raises is a question to the
person who can answer it from the record, and every override carries a name
and a reason. The rule tables it runs on are loaded by the operator with a
version and a source, on the same terms as `CARE_MGMT_RULES_PATH`,
`HCC_V28_TABLES_PATH`, and `PFS_RVU_TABLES_PATH` — because a scrubber running
last quarter's NCCI is confidently wrong, and the care-management doc has
already said what that produces: a claim that is well-formed, plausible, and
asserts something the current rules do not support.

### 10. Clearinghouse Management

**What actually happens here.** The clearinghouse relationship is operational
work that never finishes: EDI enrollment with each payer that requires it
(Medicare, Medicaid, and the large Blues require per-provider or per-group
enrollment for 837 submission and separately for 835/ERA receipt); trading
partner and submitter IDs; payer ID lists that differ between clearinghouses
for the same payer; companion-guide edits; batch schedules; the
acknowledgement files (TA1, 999, 277CA) for every batch; ERA (835) routing;
EFT enrollment, often through CAQH EnrollHub or the payer's own form; and
eligibility (270/271) and claim status (276/277) routing through the same
connection. When a provider joins, leaves, or adds a location, every payer
enrollment has to change. When a clearinghouse merges, is acquired, or goes
down, every one of these has to be re-established.

**Every scenario that can occur.**

- *Steady state:* batches go, acknowledgements return and are reconciled,
  835s route to the right practice.
- *Enrollment not complete for a payer:* claims rejected as "submitter not
  authorised" for weeks after go-live, or 835s going to the previous billing
  vendor.
- *New provider added:* claims under their NPI reject until enrollment is
  done, and their first months of claims sit near the filing limit.
- *Payer ID drift:* clearinghouse A's ID for a payer is not clearinghouse
  B's; a migration silently misroutes.
- *Acknowledgement backlog:* 277CA files downloaded but never worked.
- *Batch missing:* sent from the practice, never received by the clearinghouse
  (SFTP failure, file naming, a certificate expiry).
- *Clearinghouse-side edit change* that starts rejecting a claim pattern that
  was fine last week.
- *ERA enrollment tied to the vendor:* the outsourced biller enrolled ERAs to
  their own clearinghouse account; on termination, the 835s keep going there.
- *EFT enrollment to the wrong account* — payments to a vendor's or prior
  owner's bank.
- *Virtual credit card payments:* a payer pays by VCC, taking a processing fee
  from the practice; HHS has said providers may demand EFT instead — verify
  the current guidance and the payer's process.
- *Clearinghouse outage:* days to weeks of no transport; claims queue and
  age; ERAs stop; the practice cannot see what is paid. The 2024 Change
  Healthcare event is the reference case.
- *Clearinghouse breach:* the clearinghouse is a business associate, and its
  breach is a notification event for every practice on it.
- *Clearinghouse acquired or product sunset:* migration with full
  re-enrollment.
- *Multiple clearinghouses* (one for claims, another for eligibility, a
  third the lab uses) — reconciliation across them.
- *Direct submission to Medicare* (through the MAC's gateway) alongside
  clearinghouse submission for everything else — two sets of credentials
  and acknowledgements.

**Where Tabula Medica actually stands: Not built.** No clearinghouse
integration or adapter, no enrollment records, no trading-partner
configuration. The EHR connectors in `server/services/ehr/` (including the
eCW client) are clinical-data connectors, not clearinghouse connections.

**Our why.** This is the clearest partner-not-build line in the list, and the
principle is about ownership rather than construction. **The practice's
identity at the payer — enrollment, submitter ID, ERA and EFT routing — is the
practice's, never the vendor's.** A biller who holds those holds the
practice's cash and its proof of filing, and the termination scenario is a
hostage situation that nobody planned. Whichever clearinghouse we partner
with, the product's job is to be the system of record for the enrollment
state, the acknowledgement chain, and the routing — so that a change of
vendor is a change of labour, not a change of identity.

### 11. Rejected Claim Resolution

**What actually happens here.** A rejection is a claim the payer (or the
clearinghouse) refused to accept into adjudication — a 999 syntax failure, a
277CA business rejection, or a clearinghouse pre-edit. It is not a denial. A
denial is an adjudicated claim the payer decided not to pay, and it comes back
on an 835 with CARC/RARC codes and appeal rights. A rejected claim has never
been "received", which is why, for most payers, a rejected claim provides no
timely-filing protection: the clock runs as if nothing was sent. Resolution
means reading the rejection reason (the claim status category and claim
status codes on the 277CA, which are a different code set from CARC/RARC),
fixing the underlying data, and resubmitting — as a new original, because the
payer has no record of the first.

**Every scenario that can occur.**

- *Data fix, resubmit, accepted:* member ID corrected from the card; referring
  NPI added.
- *Rejection reason opaque:* a payer-specific code with no useful text;
  resolution requires a phone call.
- *Rejection is wrong:* the payer's edit is at fault (a valid code it has not
  loaded); resolution is escalation to the payer and a documented workaround.
- *Repeated rejection:* the same claim rejected three times with three
  different reasons as each fix uncovers the next.
- *Registration root cause:* the rejection is fixed on the claim and not in
  the patient record, so every subsequent claim rejects the same way.
- *Enrollment root cause:* provider not enrolled; nothing on the claim can fix
  it.
- *Rejection at the clearinghouse* the practice never sees because the vendor
  works it and does not report it.
- *Resubmission after the filing limit:* the rejection was worked too late;
  the first submission was never "received"; the claim is now a timely-filing
  denial with no proof to appeal on — unless the practice can show the payer
  itself caused the delay.
- *Resubmission that changes content:* the "fix" alters DOS, units, or a
  diagnosis to clear the edit rather than to match the record.
- *Resubmission of a rejected claim as a corrected claim (frequency 7)* —
  wrong, because there is no original on file; rejected again.
- *Rejection misfiled as a denial* and sent through the appeals process,
  which the payer cannot act on because there is no claim.
- *Void-and-rebill needed* when the rejected claim was partially accepted
  (some lines) — payer-specific.

**Where Tabula Medica actually stands: Not built.** No 277CA or 999 handling,
no rejection worklist, no resubmission path.

**Our why.** The distinction between rejected and denied is a distinction
between "not yet asserted" and "asserted and refused", and a system that
blurs them produces two kinds of harm: rejections that age silently into
timely-filing losses, and rejections "fixed" by changing what the claim says.
Our rule is that **the resubmitted claim is regenerated from the record, not
edited in place.** If the fix is a registration field, the fix happens in
registration and the claim is rebuilt; if the fix would change a clinical
element, it goes back to the attester. The rejection itself, the fix, and who
made it are kept, because the pattern of rejections by reason and by source
is the most useful front-end quality signal a practice has — and it is the one
an outsourced vendor has the least incentive to show.

---

## 5 · Denial & A/R Management

### 12. Denial Identification & Root-Cause Analysis

**What actually happens here.** Denials arrive on the 835 remittance advice
(and on paper EOBs), as adjustments coded with a **group code** — `CO`
contractual obligation, `PR` patient responsibility, `OA` other adjustment,
`PI` payer-initiated — a **Claim Adjustment Reason Code** (CARC) giving the
reason, and often a **Remittance Advice Remark Code** (RARC) adding detail.
CARC and RARC are maintained under X12 with CMS as a major user. Identification
means parsing every zero-pay and partial-pay line, classifying it, and routing
it; root-cause analysis means tracing the denial back through the claim to
the step that produced it — registration, eligibility, authorisation, coding,
charge entry, submission, or the payer's own error — and to the person or
process at that step. A denial rate is only meaningful with a stated
denominator (claims, lines, or dollars) and a stated definition of "denial"
(first-pass zero-pay lines, or after appeal), and the HFMA MAP Keys exist
because vendors define these differently.

**Every scenario that can occur.**

| Class | Typical codes (illustrative, verify current lists) | Root cause usually sits in |
|---|---|---|
| Not a denial at all | `CO-45` charge exceeds fee schedule; `PR-1/2/3` deductible, coinsurance, copay | Nowhere — contractual write-off and patient responsibility; counting these as denials inflates the rate |
| Eligibility | coverage terminated, patient not found, not effective on DOS | Registration and eligibility (lines 1–2) |
| Coordination of benefits | `CO-22` covered by another payer; MSP; Medicaid last-resort | Registration and eligibility |
| Authorisation | `CO-197` precertification absent; auth mismatch | Prior auth (line 3) |
| Medical necessity | `CO-50` not deemed medically necessary; LCD/NCD | Coding and documentation (lines 5, 7), or a payer policy the practice disagrees with |
| Bundling | `CO-97` included in another service; NCCI | Coding (line 7); often correct and not appealable |
| Coding / modifier | `CO-4` modifier inconsistent; invalid code; age/sex | Coding, charge entry |
| Missing information | `CO-16` with a RARC saying what | Charge entry, attachments |
| Timely filing | `CO-29` | Submission and rejection handling (lines 8, 11), or unacknowledged batches |
| Duplicate | `CO-18` | Resubmission discipline |
| Provider enrollment | provider not eligible / not enrolled on DOS | Credentialing, clearinghouse enrollment (line 10) |
| Non-covered service | statutory exclusion; benefit not covered | Registration (benefits), ABN handling |
| Maximum benefit reached | visit limit; annual cap | Eligibility detail the 271 may not carry |
| Payer error | denied in contradiction to the contract or the payer's own policy | The payer; appeal |
| Post-payment recoupment | previously paid, taken back in a later 835 (reversal + corrected pair, or a provider-level adjustment) | Retroactive eligibility, audit, payer reprocessing |
| Downcoding | paid at a lower E/M level than billed under a payer downcoding programme | Documentation; contest with the note |
| Partial denial | some lines paid, others denied | Line-level analysis required; claim-level metrics hide it |
| Soft vs hard | resolvable by resubmission vs requiring appeal or write-off | Determines the worklist |
| Silent denial | a line paid at zero with no CARC, or a claim missing from the 835 entirely | Reconciliation (line 19) |

Root-cause failure modes of their own: attributing every denial to "coding"
because that is where it is discovered rather than where it originated;
counting contractual adjustments as denials; measuring denials at the claim
level when the losses are at the line level; a denial taxonomy that is the
vendor's, not the payer's, so that the same CARC is categorised differently
by different staff; and — the important one — treating the denial as the
error rather than considering that the denial may be *correct*, and the
claim should not have been sent.

**Where Tabula Medica actually stands: Not built.** No 835 ingestion, no
CARC/RARC handling, no denial taxonomy, no root-cause attribution.
`server/services/claims-analysis.ts` (wired into
`server/preventive-care-routes.ts`) computes approval and denial rates,
by-category, by-status, by-provider, and monthly trends over claim-shaped
records already in the database. It is descriptive analytics with no payer
connection, no submission path, and no write-back; it cannot identify a
denial because nothing feeds it one, and it should not be described as denial
management. One flag for the team: it constructs an OpenAI client directly
rather than routing through `server/lib/baa-chat.ts`, and OpenAI's standard
tier carries no BAA under this repo's own stated policy, so anything sent
through that path needs review before it goes anywhere near identified data.

**Our why.** A denial is the payer's counter-assertion, and half the value of
denial analysis is in taking it seriously as one. **A denial engine that
treats every denial as an error to be overturned is an appeals-generation
machine; a denial engine that asks first whether the payer was right is a
quality system.** The root cause that matters most is the one upstream of
the claim — the missing 271, the unattested note, the auth for the wrong
CPT — because that is the one that prevents the next denial rather than
fighting this one. We would build the taxonomy on the payer's codes
(CARC/RARC, group codes, the 277CA status codes for rejections), keyed to the
step in our own pipeline that produced the claim, so that a denial is
attributed to a registration field or a note element and not to a
department. And the denominator is stated on every rate, because a rate whose
denominator can be chosen is a number that can be made to say anything.

### 13. Denial Appeals & Reconsiderations

**What actually happens here.** The formal contest of an adjudicated denial.
The route depends on the payer. **Traditional Medicare** has five levels:
redetermination by the MAC, reconsideration by a Qualified Independent
Contractor, a hearing before an Administrative Law Judge, review by the
Medicare Appeals Council, and judicial review — each with its own filing
window and, at the upper levels, amount-in-controversy thresholds adjusted
annually (verify the current windows and thresholds against the Medicare
Claims Processing Manual). Clerical errors go through the separate
**reopening** process rather than appeal. **Medicare Advantage** runs an
organisation determination and plan reconsideration, with unfavourable
reconsiderations forwarded automatically to the Independent Review Entity,
then the ALJ path. **Medicaid** varies by state and MCO, with a state fair
hearing at the end. **Commercial ERISA plans** are governed by the Department
of Labor's claims-procedure regulation — the plan must offer a full and fair
review with stated timelines, and the provider appeals as the member's
authorised representative or assignee, which anti-assignment clauses in the
plan document can defeat; after internal appeals, the ACA's external review
process may apply. Non-ERISA commercial plans (individual market, government
and church plans) follow state insurance law. The artefact is an appeal
letter with the claim, the denial, the records, and the argument, filed
within the window, with proof of filing.

**Every scenario that can occur.**

- *Overturned at first level:* the records were sufficient; paid, often with
  interest where prompt-pay statutes apply.
- *Upheld:* the denial stands; decide whether to escalate, and whether the
  dollar amount justifies it.
- *Partially overturned.*
- *Appeal window missed* — the denial sat in a queue.
- *Wrong route:* an appeal filed where a reopening or corrected claim was
  needed; a corrected claim sent where an appeal was needed (some payers treat
  a corrected claim as a withdrawal of the appeal).
- *Appeal filed without records,* or with records that do not support the
  claim, which converts a denial into an audit trigger.
- *Appeal argues the code should be something else* — that is a corrected
  claim, not an appeal, and the correction must come from the attester.
- *Medical-necessity appeal* needing a physician letter and the physician's
  time.
- *Timely-filing appeal* needing proof of timely submission — the 277CA
  accept, or the payer's own rejection showing it was received.
- *Payer-error appeal* where the payer's policy or the contract was
  misapplied — the strongest appeals and the least often filed, because the
  labour cannot see the contract.
- *Peer-to-peer* before a formal appeal.
- *Anti-assignment clause:* the plan refuses to recognise the provider's
  standing; the member must appeal.
- *ERISA preemption* of a state prompt-pay or external-review right.
- *Reopening within the window* for a clerical error, avoiding the appeal
  levels entirely.
- *Recoupment appeal:* a post-payment audit finding, with its own process
  (rebuttal, then appeal) and its own clock.
- *Mass denial* of a pattern of claims by one payer, warranting a project
  rather than individual appeals.
- *Appeal template filed at volume* with the same boilerplate regardless of
  the denial — the vendor's productivity metric met, the appeal lost.
- *Cost exceeds value:* the appeal labour costs more than the claim; the
  write-off is the rational choice, and it should be recorded as one, not
  hidden as "resolved".

**Where Tabula Medica actually stands: Not built.** No appeals workflow, no
appeal record, no route-by-payer logic, no letter assembly.

**Our why.** An appeal is the one document in the revenue cycle addressed to
a person who will read it critically, and it is the one place where "improve
the record" is a temptation with a name: a late addendum, a note "clarified"
after the denial. **The appeal argues from the record as it stood; it does
not improve it.** What we would build is assembly, not authorship: the denial,
the claim, the 277CA, the 271, the attested note as of the DOS, and the
contract term or coverage policy the denial contradicts, gathered by pointer
so that every attachment is provably the artefact that existed. The argument
is a human's — a physician for medical necessity, a biller for
administrative denials — and the deadline tracking is the product's. Bulk
appeal generation, where a template is filed against every denial of a
type regardless of merit, is something we would not build, because it makes
the appeals channel a claims channel.

### 14. Insurance A/R Follow-Up & Aging A/R Management

**What actually happens here.** After submission, every claim is either paid,
denied, rejected, pending, or missing, and the work is to know which and act.
The 276 claim status inquiry and 277 response are the HIPAA transactions for
asking a payer where a claim is; payer portals and phone calls do the rest.
Aging is measured from DOS or from submission date in buckets (0–30, 31–60,
61–90, 91–120, over 120 days), by payer, and the standard metrics are days in
A/R and the percentage over 90 days. State prompt-pay statutes require payers
to pay or deny a clean claim within a period that varies by state and by
whether the claim was electronic, with interest on late payments — verify
per state; Medicare has its own floor and ceiling for payment timing. The
worklist is prioritised by dollars, by filing-deadline risk, and by payer.
Write-offs are classified: contractual, timely filing, small balance,
administrative, bad debt.

**Every scenario that can occur.**

- *Paid within the prompt-pay window:* no follow-up needed.
- *Pending:* 277 says in process; a legitimate wait, until it is not.
- *Pended for information:* the payer wants records or a COB questionnaire
  from the *patient*, who never returned it; the claim will deny.
- *Additional Documentation Request* from a Medicare contractor, with a
  response window; silence is a denial.
- *Claim not on file:* the payer has no record; the practice believed it was
  submitted. Check the 277CA; if there is none, this is an unacknowledged
  batch and the filing clock is the only thing that matters.
- *Paid, not posted:* the money arrived and the 835 was not applied, so the
  claim ages in A/R while the cash sits unapplied.
- *Paid to the patient:* non-assigned claim; the practice must collect from
  the patient.
- *Paid to the wrong provider or location.*
- *Paid at the wrong amount:* an underpayment (line 15), which a follow-up
  team working "open balance" will often write off to the contractual bucket.
- *Recouped:* a takeback in a later 835, sometimes for a claim from years ago,
  sometimes against an unrelated patient's payment.
- *Denied, not worked:* the 835 was posted, the denial was categorised, and
  nobody picked it up.
- *Denied, appealed, pending appeal* — a separate aging track.
- *Payer offset* — the payer nets a recoupment against current payments and
  the current claims look underpaid.
- *Secondary never billed* because the primary's 835 was not posted with the
  detail the secondary needs.
- *Timely filing exhausted* while in follow-up — the definitional failure of
  this line.
- *Write-off to flatter the metric:* aged claims written off as "timely
  filing" or "small balance" to bring days-in-A/R down before a report.
- *Payer portal or phone queue* as the only path, with hold times that make
  each claim cost more than it is worth.
- *Follow-up notes* held in the vendor's system, so the practice cannot see
  what was said or promised.
- *Provider left the practice* and their claims age with nobody owning them.

**Where Tabula Medica actually stands: Not built.** No A/R aging, no
worklist, no 276/277, no follow-up engine, no write-off classification.
`server/services/claims-analysis.ts` can compute totals by status over
records it is given, which is a report, not a follow-up system.

**Our why.** A/R follow-up is labour, and it is the labour whose incentives
most directly shape the numbers a practice sees. Days in A/R is improved by
collecting faster and by writing off sooner, and a vendor paid on the metric
does not distinguish. **Every write-off is a decision with a category, a
reason, an amount, and a name — and a write-off of a claim that was never
acknowledged is a timely-filing loss, not a contractual adjustment.** The
product's role is to make the worklist from the acknowledgement chain and
the 835 rather than from the vendor's notes, so that "claim not on file" is
computed, not discovered, and so that the aging report cannot be improved by
reclassification. Buy the phone work; own the worklist and the write-off
ledger.

### 15. Underpayment Identification

**What actually happens here.** An underpayment is a paid claim paid at less
than the contracted amount. Detecting it requires an expected amount, which
requires modelling the contract: a fee schedule (a percentage of the Medicare
PFS for a given year, a per-code schedule, a per-diem or case rate for
facilities), carve-outs, multiple-procedure reductions, bilateral and
assistant-surgeon rules, site-of-service differentials, modifier reductions,
and for Medicare the PFS calculation itself (RVUs × GPCIs × conversion factor)
plus the sequestration reduction and any legislated adjustments — verify the
current rate and the year's conversion factor against the CMS files. The
expected amount is compared to the 835's paid amount plus the patient
responsibility, and the difference is either explained by a CARC or is an
underpayment to contest.

**Every scenario that can occur.**

- *Paid as expected.*
- *Underpaid, payer loaded the wrong fee schedule* (last year's, another
  product line's, the wrong site of service).
- *Underpaid, modifier reduction misapplied* (a reduction for a modifier the
  claim did not carry; a bilateral paid as unilateral).
- *Underpaid, multiple-procedure reduction applied to a code exempt from it.*
- *Underpaid, downcoded* under a payer's E/M downcoding programme — paid at a
  lower level than billed; contest with the note.
- *Underpaid, bundled* when the contract or NCCI does not bundle.
- *Underpaid by sequestration* — correct for Medicare; a variance model that
  does not know about it flags every Medicare claim.
- *Underpaid by an offset* — the difference is a recoupment on another claim,
  visible in the provider-level adjustment segment of the 835.
- *Underpaid by interest miscalculation* on a late payment.
- *Overpaid* — the same model finds these, and they are the practice's
  obligation (line 21).
- *No contract on file:* out-of-network, paid at the plan's allowed amount
  with balance-billing rules deciding what the patient owes; No Surprises Act
  IDR for the protected cases.
- *Contract on file, terms ambiguous:* "percentage of Medicare" without a
  year; a carve-out list nobody kept.
- *Contract amended by payer bulletin* the practice never saw.
- *Expected amount wrong because the charge was wrong:* the variance is real,
  the fault is ours.
- *Capitated patient* paid fee-for-service in error, or vice versa.
- *Payer pays the contracted rate on the wrong code* because their system
  crosswalked ours.
- *Underpayment below the cost of pursuing it,* individually, but material
  in aggregate across a payer — which is a contract-negotiation input, not a
  claim-level task.

**Where Tabula Medica actually stands: Not built.** No contract or
fee-schedule modelling, no expected-payment calculation against a contract,
no 835 to compare against, so no underpayment detection. One ingredient
exists: `server/services/rvu/` computes the Medicare PFS allowed amount
(`rvu-calculator.ts`) once an operator loads the Relative Value File, GPCI
file, and conversion factor via `PFS_RVU_TABLES_PATH` — with row selection
for `26`/`TC`, units, and the correct component-wise GPCI application. That
is the expected-amount side for one payer; without a paid-amount side it
detects nothing.

**Our why.** An underpayment is the one financial assertion in this list that
runs in our favour — we are asserting to the payer that *they* owe *us* — and
the standard for it should be identical to the one we hold for claims:
**the expected amount comes from a named contract term or a named CMS file,
with a version, or it is not an expected amount.** The RVU engine already
refuses to price without the operator's file and will not run on a
conversion factor it was not given; the same posture extends to contracts. A
variance model built on approximations flags noise, and staff learn to ignore
it, which is how real underpayments hide. This is a build for us, because
the contract model is also what an honest patient estimate and an honest
variance report need — the three share one source of truth.

### 16. Timely Filing & Claim Resolution

**What actually happens here.** Every payer sets a deadline after the DOS by
which the claim must be received. Medicare's is one calendar year from the
date of service. Commercial deadlines are set by contract and vary widely;
Medicaid and MCO deadlines are set by state and plan. Secondary claims often
run from the primary's adjudication date. Corrected claims and appeals have
their own windows. "Received" means accepted into adjudication — a 277CA
accept, or the payer's own record — not transmitted. Exceptions exist and
are narrow: retroactive eligibility, payer or administrative error, MSP
situations, and for Medicare a defined set of good-cause conditions. Proof of
timely filing is the acknowledgement file; without it there is no appeal.

**Every scenario that can occur.**

- *Filed and accepted within the window.*
- *Filed within the window, rejected, resubmitted after it:* not received in
  time; the rejection is no defence unless the payer's own error caused it.
- *Transmitted within the window, never acknowledged:* no proof; usually a
  loss.
- *Accepted within the window, then a corrected claim needed after it:*
  correction windows are payer-specific and sometimes run from the original
  adjudication.
- *Secondary claim late* because the primary paid late or the primary's 835
  was posted late.
- *Coverage discovered late* (line 4) with the window already gone.
- *Retroactive eligibility* — a recognised exception, with its own proof
  requirements.
- *Payer changed the window* by contract amendment.
- *Provider enrollment completed late*, so early claims were rejected until
  after the window — sometimes recoverable as payer/administrative delay,
  sometimes not.
- *Charge lag* consumed the window before the claim was ever built.
- *Clearinghouse outage* consumed it; some payers granted extensions after
  the 2024 event, most required a request.
- *Claim held for a scrubber edit* nobody worked.
- *Wrong payer billed first;* by the time the right payer is identified, the
  window is gone. MSP and COB errors are the common case.
- *Timely-filing denial appealed with proof* and overturned.
- *Timely-filing write-off* — the loss category that is entirely the
  practice's or the vendor's fault, and the one most often misfiled under
  "contractual" so it does not appear as such.

**Where Tabula Medica actually stands: Not built.** No filing-deadline
tracking, no per-payer window configuration, no acknowledgement retention,
no deadline-driven worklist.

**Our why.** Timely filing is arithmetic on dates the system already knows —
DOS, payer, acknowledgement — and a loss to it is the purest form of
avoidable leakage because no clinical or coding judgement is involved. It is
also the loss that most tempts a false fix: a resubmission with an altered
DOS, or a "corrected" claim that pretends an original existed. **The
deadline is computed from the payer's rule and the 277CA, and a claim past
its deadline is written off as a timely-filing loss with that label, or
appealed with proof — never resubmitted with a different story.** Storing
every acknowledgement is what makes the appeal possible; refusing to alter
the claim is what makes the write-off honest.

### 17. Outstanding Balance Recovery

**What actually happens here.** Once adjudication assigns patient
responsibility, or the patient is self-pay, the balance is the patient's, and
recovery runs through statements (line 20), payment plans, early-out vendors,
and eventually collection agencies. The legal envelope is thick: the Fair Debt
Collection Practices Act governs third-party collectors; the TCPA governs
autodialled and prerecorded calls and texts to mobile numbers; state
collection and consumer-protection statutes add more; credit-reporting
treatment of medical debt has changed repeatedly at the bureau, CFPB, and
state level and must be verified for the current state; for tax-exempt
hospitals, IRS section 501(r) requires a financial assistance policy and
restricts extraordinary collection actions — that provision does not reach
independent physician practices, but state charity-care laws sometimes do.
Some balances may not be collected at all: Medicare cost-sharing from a QMB
beneficiary; anything from a Medicaid patient beyond the state's permitted
cost-sharing; balance bills covered by the No Surprises Act for OON emergency
and certain OON services at in-network facilities; amounts above a good-faith
estimate for a self-pay patient, who can dispute through the patient-provider
dispute resolution process when the bill exceeds the estimate by more than
the regulatory threshold (verify the current figure). Routine waiver of
copays and deductibles for insured patients is a beneficiary-inducement and
anti-kickback problem; hardship waivers must be individual and documented.

**Every scenario that can occur.**

- *Paid at the visit* (copay) or on the first statement.
- *Paid on a plan* over months.
- *Disputed:* the patient believes insurance should have paid; the answer is
  usually an eligibility or COB event upstream, and the patient is the only
  one who can fix a COB questionnaire.
- *Balance is wrong:* the secondary had not yet paid; the contractual
  adjustment was not applied; the patient was billed the charge instead of the
  allowed amount.
- *Balance is not collectable by law* (QMB, Medicaid, NSA-protected,
  GFE-exceeded).
- *Balance belongs to a guarantor* who is not the patient, with restrictions
  on what the statement may disclose (minors' confidential services, state
  law).
- *Deceased patient:* claim against the estate, with probate rules.
- *Bankruptcy:* automatic stay; collection must stop.
- *Hardship:* financial-assistance policy, applied consistently and
  documented.
- *Patient unreachable:* return mail, wrong phone; skip-tracing has its own
  legal limits.
- *Sent to collections* with the fee, the agency's conduct, and the
  reputational effect of a credit report.
- *Sent to collections wrongly* — a balance the insurer later paid, or one
  that was not the patient's.
- *Small balance* below the cost of a statement, written off as such.
- *Refund owed instead* — the patient overpaid (line 21).
- *Payment taken by card and then the payer paid* — a credit.
- *Prompt-pay discount* for self-pay, permissible when structured correctly.
- *Third-party liability* — the balance belongs to an auto or liability
  carrier, and the patient's attorney holds a lien.

**Where Tabula Medica actually stands: Not built.** No patient balance
ledger, no payment plans, no collections integration, no patient-responsibility
estimation. The product's patient-facing engagement surface
(`server/services/engagement/`, `server/health-summary-share-routes.ts`)
delivers health summaries with a consent gate and channel rules — the plumbing
for patient communication exists, and none of it carries a balance.

**Our why.** This is the assertion made to the patient, and it is the one
where the product's identity as a PHR matters. A statement is the patient's
record of what their care cost, and a balance that is wrong — because a
secondary had not paid, because a QMB flag was missed, because the charge was
billed instead of the allowed amount — is an assertion the patient has the
least ability to check. **A patient balance is presented only after the last
payer has adjudicated, only at the allowed amount, and never for an amount
the law says they do not owe** — and the product computes those conditions
rather than trusting a vendor's statement run. Early-out labour and
collections agencies are things to buy; the decision of what a patient is
asked to pay is not.

---

## 6 · Payment & Revenue Management

### 18. Electronic & Manual Payment Posting

**What actually happens here.** Payments arrive as an 835 electronic
remittance advice paired with an EFT (the CCD+ bank transaction carrying a
reassociation trace number that matches the 835's TRN segment), or as a paper
EOB with a check, or a virtual card. Posting applies each 835 claim (CLP) and
service line (SVC) to the matching claim and line in the billing system:
paid amount, allowed amount, the adjustment segments (CAS) with group code
and CARC, and the resulting patient responsibility. Provider-level
adjustments (PLB) carry recoupments, interest, and forwarding balances that
belong to no single claim. Posting is what triggers secondary billing (with
the primary's CAS data), patient statements (with PR amounts), and the
denial worklist (with zero-pay CARCs). Medicare requires EFT for enrolled
providers; the CAQH CORE operating rules govern 835/EFT pairing.

**Every scenario that can occur.**

- *Auto-posted, matched:* every CLP matches a claim, every SVC a line, EFT
  matches the 835 total.
- *835 claim not found:* the payer's control number or the patient account
  number does not match anything — a claim submitted by a previous vendor, a
  claim for a different practice on a shared TIN, or a corrupted account
  number.
- *Line-level mismatch:* the payer split or combined lines, so SVC segments
  do not map one-to-one.
- *Partial payment:* some lines paid, some denied, some pended; each posts
  differently.
- *Zero-pay 835:* the entire remittance is denials; still must be posted so
  the denials exist in the system.
- *Reversal and correction pair:* the payer reprocesses a claim as a negative
  CLP and a new positive one; posting only the positive doubles the payment.
- *Recoupment in PLB:* money taken from this 835 for a claim on an earlier
  one; posting must hit the earlier claim, and the current claims must not
  appear underpaid.
- *Interest in PLB:* prompt-pay interest, which is income and not a claim
  payment.
- *Forwarding balance:* a negative 835 carried to the next remittance.
- *Capitation payment* with no claims attached.
- *Takeback for a patient the practice no longer has* — years-old.
- *835 arrives, EFT does not* (or the reverse), or the amounts differ.
- *Paper EOB, manual keying:* every field above, by hand, with the errors
  that implies — PR amounts posted as contractual, CARCs omitted, the wrong
  patient.
- *Posting adjustments to the wrong bucket:* a denial posted as a contractual
  write-off disappears from the denial rate and the appeals queue at once.
- *Patient responsibility posted that the practice may not collect* (QMB,
  contract terms).
- *Secondary payment posted as primary,* or the primary's adjustment applied
  twice.
- *Unapplied cash:* payment received, claim unknown, money sitting in a
  suspense account past month-end.
- *Duplicate 835* downloaded twice and posted twice.
- *Posting lag:* the claim ages in A/R while its payment sits unposted; the
  secondary's filing window runs.
- *Virtual card posted at the gross amount* while the fee reduced the net.

**Where Tabula Medica actually stands: Not built.** No 835 ingestion, no
posting, no payment ledger, no PLB handling, no unapplied-cash handling.
`server/billing-routes.ts` handles Stripe webhooks for SaaS subscription
invoices, which is a different kind of payment for a different kind of
thing.

**Our why.** Posting is the one step in the cycle where nothing is asserted
to anyone — it is the practice recording what the payer said — and that is
exactly why it must be literal. **The 835 is posted as received, in full,
including reversals, PLBs, and zero-pay lines, and every adjustment keeps
the payer's group code and CARC rather than the practice's interpretation
of it.** A posting step that recategorises — denial to contractual, PR to
write-off — is the mechanism by which a denial rate and an A/R report become
fiction while every individual entry looks reasonable. Manual EOB keying is
labour to buy, with the same rule and a sample audit against the paper. The
835 file itself is retained; the posted ledger is a view of it, and a
reconciliation can always be re-run from the source.

### 19. ERA/EOB Reconciliation

**What actually happens here.** Three things must agree: what the bank
received (EFT deposits, checks, card settlements), what the payer said it
paid (835s and paper EOBs), and what was posted to patient accounts. The
reassociation trace number links each EFT to its 835. Reconciliation runs
daily for cash and at month-end for close, and produces the exceptions:
deposits without a remittance, remittances without a deposit, amounts that
differ, postings that do not sum to the remittance. It is a financial
control as much as a billing task — the point where embezzlement, lost
checks, and vendor errors become visible.

**Every scenario that can occur.**

- *Balanced:* deposit = 835 total = posted total, for every remittance.
- *Deposit, no 835:* the payer sent money and the ERA went to a different
  clearinghouse account (usually a prior vendor's) or was never enrolled.
- *835, no deposit:* the EFT went to a different bank account (an old one,
  the vendor's, a fraudulent enrollment change), or is delayed.
- *Amounts differ:* a PLB not posted; bank fees; a virtual card fee; a
  partial deposit.
- *Paper check with no EOB* or an EOB with no check.
- *Lockbox scanning errors* — a check applied to the wrong practice.
- *Posted total does not match the 835* — a claim skipped, a line double
  posted, a reversal missed.
- *Timing:* the 835 arrives in one month and the EFT in the next, so month-end
  is out of balance by design; the close needs an accrual.
- *Payer sends one EFT for several 835s* or one 835 for several EFTs.
- *Refund checks issued by the practice* not netted correctly.
- *Patient payments* (cards at the desk, portal, mailed checks) reconciled
  separately, and often not at all.
- *Card processor settlement* differs from the sum of transactions by fees
  and chargebacks.
- *Unclaimed deposit* sitting for months as unapplied cash and then
  "resolved" by a bulk adjustment.
- *Reconciliation performed by the same vendor that posts,* with no
  independent check.

**Where Tabula Medica actually stands: Not built.** No 835, no EFT record,
no bank feed, no reconciliation. The Stripe webhook verification in
`server/billing-routes.ts` is reconciliation of SaaS subscription payments,
not of medical remittances.

**Our why.** Reconciliation is where a practice finds out whether the numbers
in every other report are true, and it is the control that an outsourced
model most often leaves with the party it is supposed to check. **The party
that posts does not reconcile; the reconciliation runs from the bank and the
835 files, not from the posted ledger; and an unreconciled difference is an
open item with an owner, never a bulk adjustment.** This is a build for us —
not the bank connection, which is commodity, but the three-way match as a
standing report that a practice owner can read without the vendor's help.
The product already holds the principle that a signed document must be
byte-identical to what was issued; the same idea applied to money is that
the ledger must be re-derivable from the remittance files at any time.

### 20. Patient Statement Management

**What actually happens here.** After adjudication assigns patient
responsibility — or for self-pay patients, after the visit — a statement is
produced: an itemised account of services, charges, payer payments and
adjustments, patient payments, and the balance due, with payment options.
Statements run in cycles (typically a fixed number of statements at fixed
intervals before the balance moves to another process), by mail, by
electronic delivery where the patient consented, and by text-to-pay under
TCPA consent rules. The content is regulated in pieces: Section 1557
language-access requirements; state plain-language and itemisation rules;
the No Surprises Act's good-faith-estimate linkage for self-pay patients;
HIPAA's minimum-necessary standard for what a guarantor's statement may
show; and the hospital price-transparency rules for facilities. A statement
is also a disclosure — to whoever opens the envelope.

**Every scenario that can occur.**

- *Correct statement, paid.*
- *Statement before the secondary paid,* showing a balance that later
  vanishes — the most common patient complaint, and a trust cost.
- *Statement at charge rather than allowed amount* for an insured patient.
- *Statement for a balance the law says is not owed* (line 17).
- *Statement to the wrong address,* returned, or worse, delivered.
- *Statement to a guarantor* disclosing a minor's confidential visit or a
  spouse's care the patient asked to keep private.
- *Statement to a patient who requested restricted communication* (a
  different address, no calls at work) — a HIPAA right that must be honoured.
- *Deceased patient's statement* addressed to them.
- *Language:* the patient does not read English; the statement is not
  available otherwise.
- *Itemisation absent:* a single line "balance due" with no way for the
  patient to check it.
- *Statement disputes* handled by a vendor who cannot see the claim.
- *Electronic statement* to an email or phone the patient did not consent to
  receive PHI at.
- *Text-to-pay* without the required consent.
- *Payment link phishing risk* — the practice's statements train patients to
  click links in texts.
- *Statement cycles continuing after a payment plan was agreed,* or after
  bankruptcy.
- *Statement showing a credit* the practice has not refunded.
- *Self-pay statement that exceeds the good-faith estimate.*

**Where Tabula Medica actually stands: Not built.** No statements, no
statement cycle, no patient-responsibility calculation. What exists is
adjacent and relevant: `server/services/engagement/` has a consent store,
send gate, quiet-hours logic, jurisdiction and language handling, and SMS and
WhatsApp channels with per-channel content ceilings (the engagement docs
record that Meta signs no BAA, so US WhatsApp carries no patient-specific
content), and `server/health-summary-share-routes.ts` issues patient-facing
share links. That is a compliant delivery layer with nothing financial to
deliver.

**Our why.** The statement is the assertion made to the patient, and the
patient is the party in this whole cycle with the least information and the
most at stake. The engagement layer already encodes the rule that a message
carries no more than its channel's consent and BAA status allow; a statement
inherits that and adds a second rule: **a statement is issued from the
adjudicated ledger, itemised to the line, at the allowed amount, after the
last payer, with the consent and restrictions the patient has recorded
applied before delivery.** A PHR that shows a patient their own record and
then sends them a bill they cannot reconcile against it has undone its
reason for existing. When we build this, the statement is a view of the same
ledger the patient can already see — not a document a vendor generates from
an export.

### 21. Credit Balance Review

**What actually happens here.** A credit balance is an account where
payments exceed the amount owed. Sources: a patient copay collected and then
the deductible turned out to be met; a patient paying a statement the
secondary then also paid; two payers both paying primary; a payer paying
twice; a payer paying more than the contract; a posting error that is not a
real credit at all. Obligations follow from the source. An overpayment by
Medicare or Medicaid is an identified overpayment that must be reported and
returned within the statutory window (60 days under the ACA — verify against
current CMS text), and retaining it knowingly is a reverse false claim under
the False Claims Act; providers paid under Part A file the quarterly Medicare
Credit Balance Report (CMS-838), which physician practices do not. Commercial
overpayments are governed by contract and by state law, which often sets a
window after which a payer may no longer recoup. Patient overpayments are
refunded, and unrefunded amounts eventually fall under state unclaimed-property
(escheat) law.

**Every scenario that can occur.**

- *True patient credit:* refund to the patient, or apply to another open
  balance with their agreement.
- *True payer credit, Medicare/Medicaid:* voluntary refund with the
  contractor's form, within the window, or through the 835's own recoupment
  if the payer catches it first.
- *True payer credit, commercial:* refund per contract; or wait for
  recoupment, which the contract may or may not allow after a period.
- *Two primaries:* one must be refunded and the claim resent to it as
  secondary.
- *Not a credit:* a posting error — a payment on the wrong account, a
  contractual adjustment posted as a payment, a reversal missed. Fix the
  posting, refund nothing.
- *Credit on one encounter, debit on another,* same patient — netting is
  permissible with the patient's knowledge, not silently.
- *Credit from a payer that no longer exists* or a patient who cannot be
  found — escheat.
- *Credit older than the recoupment window* — the payer cannot take it back;
  whether the practice may keep it is a state-law and contract question,
  and the answer for government payers is no.
- *Credit balances "cleaned up" by writing them off* to a revenue account,
  which converts an obligation into income.
- *Small credits below a refund threshold* — a policy needed, and escheat
  still applies in aggregate.
- *Credit created by a card refund that failed.*
- *Credit created by a duplicate 835 posting* (line 18).
- *Refund issued to the wrong party* — patient instead of payer, creating a
  new receivable.
- *Refund issued, then the payer recoups anyway* — a double loss to chase.

**Where Tabula Medica actually stands: Not built.** No credit balance
handling, no refund workflow, no overpayment reporting.

**Our why.** A credit balance is the one place where the assertion is
reversed — the practice holds money that is someone else's — and the failure
mode is not error but inertia: credits are nobody's priority because they
cost money to resolve. The law does not share that view for government
payers. **A credit balance is an obligation with a clock, and the product
treats it like a denial in reverse: identified automatically from the
ledger, classified by source, and worked to a refund, a corrected posting,
or an escheat filing — never to a write-off.** This is the same refusal to
resolve a conflict in favour of revenue that the coding engine makes, on the
payment side.

### 22. Payment Variance Analysis

**What actually happens here.** Variance analysis compares expected to actual
at the population level, where underpayment identification (line 15) works
claim by claim. It needs the same contract model, and it answers different
questions: is a payer systematically paying below contract on a code family;
did a fee-schedule year change get loaded on both sides; is a downcoding
programme active; is a specific modifier being reduced; are sequestration and
interest accounted for; how does actual reimbursement per wRVU compare across
payers. Its output is a contract-negotiation input and a payer-dispute file
as much as a worklist.

**Every scenario that can occur.**

- *No variance* beyond explained adjustments.
- *Systematic underpayment on one payer, one code family* — a contract-load
  error at the payer or a policy change; a formal dispute under the contract.
- *Variance from our own fee schedule* — the charge master is out of date, so
  the expected amount is wrong.
- *Variance from a payer's crosswalk* of our codes to theirs.
- *Downcoding programme detected* as a level shift in E/M payments.
- *Variance from patient-responsibility shift* — the payer paid less because
  more moved to the deductible; not an underpayment.
- *Variance from bundling policy* — the payer's edit set differs from NCCI.
- *Variance from site of service* — facility versus office differential.
- *Variance from timing* — a payment that spans a fee-schedule change.
- *Variance in Medicare from the annual PFS update,* the conversion-factor
  change, and any mid-year legislative adjustment.
- *Variance from MPPR, bilateral, or assistant-surgeon rules* applied
  differently by payer.
- *Out-of-network variance,* where there is no expected amount and the
  comparison is to the plan's stated allowed methodology or to NSA qualifying
  payment amounts — verify the applicable rule.
- *Variance that is an overpayment* (line 21).
- *Variance analysis that is right and unactionable* because the contract
  has no dispute mechanism with teeth.
- *Variance model built on charges rather than contract* — reporting
  "collection rate" against charges, which says nothing about contract
  performance.

**Where Tabula Medica actually stands: Not built.** No contract model and no
835, so no variance analysis. The expected-amount ingredient for Medicare
exists in `server/services/rvu/` as described under line 15, and
`provider-productivity.ts` attributes wRVUs per provider — reported, per its
docs, in work RVU only, not total RVU and not dollars.

**Our why.** Variance analysis is the report that tells a practice whether
its contracts are being honoured, and a report with a soft denominator tells
it whatever the author wants. **Expected amounts come from a versioned
contract or a versioned CMS file; the variance report names which; and
"collection rate against charges" is reported as what it is — a number
about our fee schedule, not about the payer.** The RVU engine's stance that
the conversion factor and RVU file are the operator's and carry a version is
the template. This is a build, downstream of the contract model, and it is
worth building because it is the single most useful artefact a practice can
bring to a contract negotiation — and the one an outsourced vendor, paid on
collections rather than on contract performance, has no reason to produce.

### 23. Revenue Reporting & Performance Monitoring

**What actually happens here.** The standard metrics — clean-claim rate
(first-pass acceptance), first-pass resolution rate, denial rate, days in
A/R, A/R over 90 days, net collection rate (collected ÷ (charges −
contractual adjustments)), gross collection rate (collected ÷ charges), cost
to collect, charge lag, time to bill, and unbilled encounters — each have
multiple definitions in the industry, which is why the HFMA MAP Keys exist.
Reporting means computing them from the acknowledgement chain, the 835s,
the ledger, and the encounter schedule, with stated definitions, by payer,
by provider, by location, and over time, and reconciling them to the
financial close. Performance monitoring means watching the leading
indicators (unacknowledged batches, unworked rejections, unposted cash,
approaching filing deadlines) rather than the lagging ones.

**Every scenario that can occur.**

- *Metrics defined, sourced, reconciled to the close.*
- *Denial rate on a chosen denominator* — lines versus claims versus dollars;
  first-pass versus final.
- *Denial rate that excludes rejections* (they are "not denials"), so the
  front-end failure is invisible.
- *Days in A/R improved by write-offs* (line 14).
- *Net collection rate flattered by reclassifying timely-filing losses as
  contractual adjustments.*
- *Clean-claim rate measured at the clearinghouse* rather than at the payer's
  277CA, or measured after the scrubber auto-corrected.
- *Charge lag hidden* because the metric starts at charge entry, not at the
  encounter.
- *Unbilled encounters not measured at all,* because the billing system
  does not know the schedule.
- *Provider productivity reported in dollars* that depend on payer mix rather
  than in wRVUs.
- *Payer-mix shift* explaining a collection change that is reported as a
  performance change.
- *Metrics computed by the vendor* on the vendor's definitions, from the
  vendor's system, delivered as a PDF.
- *A dashboard with no reconciliation* to the bank or the general ledger.
- *Trend broken by a system migration* — a new billing system restarts every
  aging clock.
- *Benchmarks quoted without a source* (MGMA, HFMA, the vendor's own
  clients) or for a different specialty.
- *Reporting used for compliance* — coding distribution by provider (E/M bell
  curves), modifier-25 and -59 rates, which are the same reports a payer's
  audit selection uses.

**Where Tabula Medica actually stands: Partial.** Two pieces exist and are
honestly scoped. `server/services/rvu/provider-productivity.ts` reports
per-provider productivity in work RVU, which is the payer-independent measure
of clinical output and the right basis for comparing providers.
`server/services/claims-analysis.ts` computes totals, approval/denial rate,
by-category/status/provider breakdowns, monthly trends, and top diagnoses
and procedures over claim-shaped records it is given — retrospective
descriptive analytics with no feed from any payer, no acknowledgement
chain, no 835, and no ledger. None of the revenue-cycle metrics above can be
computed from what the product holds today, because the product holds none
of the source artefacts; the wRVU report and the claims analytics are inputs
to a future reporting layer, not that layer.

**Our why.** Every metric on this list can be improved by changing the
definition, and the vendor's outcomes paragraph (section 7) is a list of
metrics whose definitions the vendor controls. **A reported number carries
its definition, its denominator, its source artefacts, and its reconciliation
to cash, or it is not reported.** The care-management engine returns
`unusedMinutes` and `refused` alongside `candidates` so that the reader sees
what was not counted as well as what was; a revenue report holds to the same
standard — write-offs by category beside collections, rejections beside
denials, unbilled encounters beside charges. The reporting layer is a build
for us because it is the practice owner's only independent view of the
labour they bought, and its value is exactly its independence from the party
being measured.

---

## 7 · The promised outcomes, as a group

The vendor lists six: improved clean-claim performance; fewer avoidable
denials; faster A/R resolution and higher collection rates; lower outstanding
A/R and revenue leakage; reduced internal administrative workload; greater
visibility into billing performance.

They are all real outcomes of doing the twenty-three things well, and none of
them is a differentiator, because every RCM vendor claims all six. Three
observations.

**Four of the six are metrics, and the vendor defines them.** Clean-claim
rate depends on where it is measured and whether the scrubber altered the
claim. Denial rate depends on the denominator and on whether rejections and
contractual adjustments are in or out. A/R days can be reduced by writing
off. Collection rate against charges is a statement about the fee schedule.
A practice evaluating these promises should ask for the definitions in
writing before the numbers, and for the source artefacts the numbers are
computed from — which is section 6, line 23, in one sentence.

**Two of the six can be achieved by increasing what is claimed.** Fewer
denials and less leakage are both improved by a claim that asserts more and
passes edits — coding to the LCD, modifier 25 by default, a diagnosis added
for specificity the note does not contain. That is the failure mode this
document opened with: not fraud, a plausible claim the rules do not support,
produced at scale by a process rewarded for it. The outcomes are legitimate
only when they come from the front-end work — verified eligibility,
acknowledged submission, correct registration — and from denials that were
prevented by not sending the claim, which no vendor's dashboard counts.

**"Reduced internal workload" moves the judgement, not just the labour.** The
work that leaves the practice is keying, calling, and posting, which is right.
What can leave with it, unnoticed, is the decision about what the claim says,
the classification of every write-off, the categorisation of every
adjustment, and custody of the acknowledgements — and those are the things a
practice cannot delegate, because the practice is the one attesting and the
one liable. The honest form of this outcome is "reduced labour, retained
judgement", and it requires the product to hold the judgement in a form the
practice can see.

Visibility, the sixth, is the one we agree with most and the one the vendor
model delivers least: a report from the party being evaluated is a
self-assessment.

---

## 8 · What we would build first, and what we would never build

### Sequence, by dependency

Nothing downstream works without a real eligibility path and a real 837
path, and nothing in denial or payment management works without an 835.
The sequence follows the data.

1. **Coverage record and eligibility (lines 1–2), via a clearinghouse
   partner.** The subscriber/dependent model, payer and payer-ID record,
   plan dates, and the 270/271 round trip with the full 271 stored. This is
   the first assertion and the one every later step copies. Nothing else
   can be tested honestly until a real 271 exists in the database.
2. **The claim line from the attested note (lines 5–6), and the 837P with
   its acknowledgement chain (lines 8, 10).** A claim-line object carrying
   evidence pointers; the professional claim assembled from it; the 837P
   emitted through the partner; TA1, 999, and 277CA received, stored, and
   reconciled per batch; a status vocabulary that cannot say "submitted"
   without an acknowledgement. This is the seam we own, joined to the
   transport we partner.
3. **835 ingestion and literal posting (lines 18–19).** Every CLP, SVC, CAS,
   PLB, and TRN, posted as received, with the file retained and the three-way
   reconciliation as a standing report. Everything after this is derived from
   the 835, so it comes before any of it.
4. **Denial taxonomy and worklist, from real 835s (lines 11–12, 14, 16).**
   CARC/RARC-keyed, attributed to the pipeline step that produced the claim,
   with rejections tracked separately and filing deadlines computed from
   payer rules and the 277CA. A denial engine built before this has no data
   to learn from; it is a taxonomy with no denials in it.
5. **Contract model, then underpayment and variance (lines 15, 22), and the
   patient-responsibility calculation behind estimates and statements (lines
   17, 20).** One versioned source of expected amounts serving all three,
   with the RVU engine as the Medicare component.
6. **Scrubbing as refusal-only edits on operator-loaded tables (line 9),**
   after enough 277CA and 835 history exists to know which edits matter for
   our payers — and never as auto-correction.
7. **Prior authorisation on the FHIR Prior Authorization API (line 3),**
   where the CMS-0057-F timeline and our existing FHIR surface meet, with
   DTR answers filled only from record elements that exist.
8. **Credit balances and reporting (lines 21, 23)** as views over the ledger
   built in steps 3–5, with definitions and denominators stated.

Insurance discovery (line 4), appeals authoring (line 13), A/R phone
follow-up (line 14), manual EOB keying (line 18), statement printing (line
20), and collections (line 17) are labour and data to buy at every stage,
under the rules above.

### What we would never build

Each of these silently increases what is claimed, and each is something a
tool in this category has shipped as a feature.

- **Auto-appended modifiers** — 25, 59, or the X modifiers added by rule to
  clear an NCCI edit, without a human reading the note.
- **Diagnosis substitution to satisfy an LCD/NCD** or any payer coverage
  list. A diagnosis is a clinical finding, not a routing key.
- **Time rounding** in any time-based code, or any prerequisite inferred from
  context. The care-management engine's rules are product-wide.
- **Silent selection of the higher-paying code** where two are supported and
  mutually exclusive. Conflicts are reported.
- **Unit splitting** across lines or dates to evade an MUE.
- **Auto-resubmission that changes claim content.** A resubmitted claim is
  regenerated from the record; a content change goes to the attester.
- **Retroactive documentation** — any addendum, note edit, or ABN dated to
  support a claim after the denial.
- **Write-off reclassification** to improve a metric; and any "resolve all"
  action on aged A/R, credit balances, or unapplied cash.
- **Bulk appeal generation** from templates regardless of merit.
- **Copay and deductible waiver as a default** for insured patients.
- **Statements before the last payer has adjudicated,** or for amounts the
  law says are not owed.
- **Any rule table bundled without a version and a source,** whether NCCI,
  LCD, a fee schedule, or a payer edit set. The rule that a file without
  `verified: true` and a named source is "a seed wearing a filename" applies
  to every table in the revenue cycle.
- **A boolean where the artefact belongs** — `eligible: true` in place of
  the 271, `submitted` in place of the 277CA, `resolved` in place of the
  write-off record.

---

## 9 · Not built — stated rather than implied

- **No X12 EDI of any kind.** No 270/271, no 278, no 837P or 837I, no 835,
  no 276/277, no 277CA, no 999 or TA1.
- **No clearinghouse integration or adapter**, no payer connection, no EDI
  trading-partner or enrollment setup.
- **No claim object, no charge entry, no fee schedule, no chargemaster.**
- **No claim scrubber, no NCCI/MUE edit engine, no LCD/NCD checking.**
- **No E/M leveller, no procedure coder, no ICD-10-CM guideline engine, no
  query workflow.** The coding engines that exist are care management
  (`server/services/care-management/`), CMS-HCC v28
  (`server/services/risk-adjustment/`), and PFS RVU pricing
  (`server/services/rvu/`), each requiring an operator-supplied, versioned
  table, each emitting candidates or amounts and never a bill.
- **No denial taxonomy, no CARC/RARC handling, no appeals workflow.**
- **No A/R aging, no worklist, no follow-up engine, no filing-deadline
  tracking, no write-off ledger.**
- **No payment posting, no ERA reconciliation, no bank or EFT feed, no
  credit balance handling, no refund workflow.**
- **No patient statements, no patient-responsibility estimation, no
  good-faith-estimate generation, no payment plans, no collections
  integration.**
- **No contract or fee-schedule modelling**, so no underpayment or variance
  detection.
- **No eligibility or enrollment verification of any kind.**
  `server/services/care-management/eligibility.ts` is code-prerequisite
  evaluation, not insurance eligibility.
- **No prior-authorisation workflow.** The clinical referral composer in
  `server/services/provider-directory/` is not payer referral support.
- **No insurance discovery.**
- **`server/billing-routes.ts` is SaaS subscription billing** (Stripe) and
  has nothing to do with medical claims.
- **`server/services/claims-analysis.ts` is descriptive analytics** over
  claim-shaped records with no payer connection, no submission path, and no
  write-back; its direct OpenAI call needs review before it touches
  identified data.
- **No revenue-cycle metrics** — clean-claim rate, denial rate, days in A/R,
  net collection rate — can be computed from the product today, because the
  product holds none of the source artefacts they are computed from.
- **Every number in this document that names a window, a threshold, a rate,
  or a date is marked for verification** against the controlling document:
  the payer contract, the plan's SPD, the CMS Relative Value File and PFS
  final rule, the MAC's LCD, the Medicare Claims Processing Manual, the
  current CARC/RARC lists, and the CMS-0057-F rule text.
