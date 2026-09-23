# ABDM Ambient AI Voice-to-Text — requirement to implementation

Written against the National Health Authority's open call for Expression of
Interest of **2 September 2026**, "Ambient AI-enabled Voice-to-Text (VTT)
Solutions under ABDM".

> **What this document is not based on.** The EOI PDF at
> `abdm.gov.in/strapicms/uploads/Approved_EOI_23c23c1141.pdf` is blocked by this
> environment's egress policy and **has not been read**. Everything below is
> mapped against the requirements as stated in NHA's covering email. The PDF
> will carry the evaluation criteria, the submission format, the deadline, the
> definition of "open-source" being applied, and the specifics of "NHA-approved
> infrastructure" — none of which are known here. **Read it before submitting.**
> Where this document guesses at NHA's intent, it says so.

---

## 1 · The two categories, and which one we are

NHA invites applicants under either or both:

| Category | What it is | Us |
|---|---|---|
| **Standalone Voice Scribe** | Ambient VTT producing structured documentation | Yes — `server/services/ambient-scribe/` is self-contained and has no dependency on the rest of the PHR beyond the FHIR types |
| **EMR with Voice Scribe** | An EMR with VTT integrated, populating documentation in place | Yes — the same module writes into this repository's own record store and emits an ABDM OP Consultation Record |

Applying under both is the honest answer, and the module was deliberately built
so that it is: the scribe pipeline is pure functions over a transcript, and the
EMR integration is the thin layer that persists and exchanges the result.

---

## 2 · Requirement-by-requirement

### "capture doctor-patient conversations"

`server/services/ambient-scribe/transcript.ts`.

The capture itself is the speech provider's job. What this module owns is the
step everyone underestimates: turning anonymous diarisation tags into **roles**.

Providers return "speaker 0" and "speaker 1". They do not return "doctor" and
"patient", and the gap between those is where the most damaging scribe error
lives, because it produces output that reads perfectly:

- Patient says *"I think it's just acidity"* → attributed to the clinician, it
  becomes an assessment. It was a guess.
- Clinician says *"stop the ibuprofen"* → attributed to the patient, it becomes
  a reported history of having stopped it. The note now shows a drug
  discontinued that the patient is still taking.

So roles are **established, not inferred**. The clinician identifies their own
voice once at session start. Absent that, every turn is `unknown` and the note
builder is constrained accordingly (§ "who said it", below). There is no
"first speaker is the doctor" heuristic: in a real OPD the first voice is as
often the attendant settling the patient into the chair.

`companion` is a first-class role alongside `patient`, because a relative,
attendant or interpreter in the room is the norm in Indian outpatient practice
and attributing their words to the patient produces a history the patient never
gave.

### "support multilingual clinical documentation"

`shared/india-languages.ts`, `server/services/ambient-scribe/language-support.ts`.

All **22 Eighth Schedule languages** are in the registry, including the four
added by the Constitution (Ninety-Second Amendment) Act, 2003 — Bodo, Dogri,
Maithili, Santali — with ISO 639 codes, endonyms, ISO 15924 scripts, text
direction, and a candidate BCP-47 speech tag each. English is carried
separately and flagged `eighthSchedule: false`, so a count of the
constitutional languages stays correct.

**Three capabilities are resolved separately**, because "supported" is not one
property and a single boolean fails dangerously:

| Capability | Source of truth | Failure if wrong |
|---|---|---|
| speech input | `SCRIBE_SPEECH_LANGUAGES` (operator-set) | Fluent transcript of words nobody said |
| written copy | the string tables themselves | Reader gets English, and is told so |
| code-mixing | declared per session, checked | English drug names mangled |

A recogniser handed audio in a language it does not model **does not error** —
it returns confident text. So an unset speech allow-list refuses every language
rather than defaulting. This is the same posture the engagement module already
takes for portal-link origins and TRAI DLT sender ids.

**Code-mixing is treated as the normal case, not an error.** "Aapko blood
pressure ki dawai continue karni hai" is one clause with three English clinical
tokens inside Hindi grammar. Term matching runs over the raw mixed text rather
than over a language-segmented one, because the segmentation splits exactly
where the clinical terms are. `COMMON_CODE_MIXES` records the pairs a
deployment should expect.

**Script handling is not cosmetic.** Kashmiri, Sindhi and Urdu are right-to-left
Perso-Arabic; a mixed-direction line containing a dose ("10 mg") can reorder
visually, which is a medication-safety problem rather than a typography one.
Kashmiri, Sindhi and Manipuri each have a substantial second script, recorded
explicitly and never inferred.

#### Written copy: 17 of 22, and the five that were not guessed

`INDIA_COPY_COVERAGE` in `server/services/engagement/summary-strings.ts` is
derived from the string table itself, so it cannot drift from reality.

- **Present (17):** Assamese, Bengali, Dogri, Gujarati, Hindi, Kannada, Konkani,
  Maithili, Malayalam, Marathi, Nepali, Odia, Punjabi, Sanskrit, Tamil, Telugu,
  Urdu. *(Five of these — Nepali, Maithili, Dogri, Konkani, Sanskrit — were
  added by this work.)*
- **Absent (5):** Bodo, Kashmiri, Manipuri, Santali, Sindhi.

The five were left absent deliberately. Every string in that table is
safety-critical in one specific way: the empty states must say "nothing was
recorded", and the failure mode is a clinician reading them as "there are none".
A translation that drifts by one word inverts the sentence — a reader seeing
what looks like "no allergies" prescribes into an unrecorded anaphylaxis. Three
of the five use scripts outside the families this repository already carries
(Ol Chiki for Santali, Meitei Mayek for Manipuri), adding a rendering failure on
top of a semantic one.

`summaryStrings()` falls back to English and **reports the fallback**, so the
reader gets a warning they may not read rather than one that lies to them.

> **Scoped work for the pilot.** Closing these five is native
> clinical-linguist authoring plus review — not a translation-API call. So is
> verifying the 17 that exist: they are hand-written, and hand-written is not
> the same as reviewed by a native clinical speaker. This is a concrete,
> costable work item and it is offered as one rather than hidden.

### "accurately interpret medical terminology"

`server/services/ambient-scribe/terminology.ts`.

Three failure modes that a lexicon built for US English does not encounter:

1. **Brand names are the vocabulary.** Nobody says "paracetamol" — they say
   Crocin, Dolo, Calpol. A generic-only lexicon misses most drugs mentioned in
   most Indian consultations while appearing to work, because the few generics
   it catches make the output look populated.
2. **The clinical nouns are in a different language from the sentence.**
   Handled by matching over raw mixed text.
3. **Negation carries the clinical meaning, and Indian languages negate after
   the noun.** English puts it before ("no fever"); Hindi puts it after
   ("bukhar nahi"). A pre-term-only negation list catches the English and misses
   the Hindi, putting a denied symptom into the note. Both positions are
   handled, in Devanagari, Tamil, Bengali and Latin transliteration.

**No terminology ships for production use.** The same posture as the CMS RVU and
HCC v28 tables elsewhere in this repository. A deployment loads its terminology
from `SCRIBE_TERMINOLOGY_PATH` — for ABDM that means the NRCeS SNOMED CT India
edition and the ABDM value sets, which are versioned, licensed and revised on
their own schedule. `SEED_TERMS` exists to exercise the pipeline in development;
when no terminology file is loaded, terms still match but **no code is
attached**. An uncoded item is a true statement of what was said; an item
carrying a code guessed from a development seed is a false statement about what
it means.

### "generate structured, editable and interoperable ABDM-enabled health records"

`server/services/ambient-scribe/note-builder.ts`,
`server/services/ambient-scribe/abdm-bundle.ts`.

**Structured** — SOAP sections, typed items, one coarse `NoteItemKind`
taxonomy. Deliberately coarse: a finer one would invite the extractor to assert
distinctions the audio does not support.

**Editable** — the draft is the editable artefact and stays editable right up to
attestation. Edits and removals are counted into the attestation record, because
zero edits across a clinic day is itself a signal worth being able to see.

**Interoperable** — a FHIR R4 document Bundle shaped for the ABDM OP
Consultation Record, reusing `shared/ips.ts` types rather than a parallel FHIR
model.

> **What is asserted and what is not.** The NRCeS profile URLs and the
> composition type code (SNOMED CT 371530004, "Clinical consultation report")
> are recorded from the implementation guide and **have not been validated
> against a bundled copy of the IG**. `Composition.type` is emitted because a
> Composition without one fails validation everywhere. **Section codes are
> omitted unless the deployment supplies a validated IG map**, because they are
> optional in base FHIR and a wrong section code is worse than none: the
> receiving system files content under the wrong heading and the error is
> invisible, whereas a missing code degrades to "a titled section", which a
> human reads correctly. `bundleAssurance` reports which case produced the
> bundle — `titles-only` or `ig-validated-codes` — rather than leaving a caller
> to infer it from an absent field.

---

## 3 · The three properties the module is actually built around

### A draft is not a record

The output of transcription plus extraction is a `ScribeNoteDraft`, and a draft
is inert: not a clinical record, not in the chart, not exchangeable. It becomes
a record only when a **named clinician attests it**.

`buildOpConsultBundle` throws rather than returns without an attestation. Every
consumer downstream — another hospital, an insurer under NHCX, the patient's own
PHR — reads `Composition.author` and takes it at face value, so that field must
name a human who actually reviewed the content.

The store enforces the same thing under concurrency: `attest` is a conditional
UPDATE, so a double submit produces one attestation and one conflict rather than
two signatures on one note.

### Every clinical claim cites its source

Each `NoteItem` carries `evidence`: the transcript spans it came from. `item()`
throws on an empty evidence array, so **there is no code path that constructs an
unevidenced item**. A model cannot contribute a plausible-sounding finding that
nobody said.

A model may still phrase these items into prose. It operates on the closed list
the deterministic builder produces and cannot add to it — the same containment
the HCC opportunity finder uses. A hallucination can make the output less
useful; it cannot make it false.

The evidence ships **with** the draft on review, not behind a second call:
attestation is only meaningful if review is cheap, and a provenance trail that
costs a request per line gets skipped.

### Who said it determines what it is

| Said by | *"It's type 2 diabetes"* becomes |
|---|---|
| clinician | an assessment |
| patient | a reported belief, in the subjective section |
| unknown | **not an assessment**, and marked for confirmation |

When roles were never established, `assessment` and `plan` are **not populated
at all**. This makes the scribe materially less useful without a clinician
identifying their voice, which is the correct incentive: the alternative is a
plan section assembled from sentences that may have been the patient's
suggestions.

### And: absence is recorded as absence

The rule this repository already applies to an empty allergy list, applied to
every section. `SectionStatus` distinguishes:

- `not-discussed` — *"Not discussed in this consultation. This is absence of
  information, not a negative finding."*
- `explicitly-negative` — the clinician asked and the answer was no.

Silence in a recording is indistinguishable from a question never asked, which
makes a scribe *more* exposed to this confusion than a form is. "Chest pain
nahi hai" produces **"Denies chest pain"** — not silence, and not "chest pain".

---

## 4 · Consent, residency and retention

### Recording consent is not messaging consent

`server/services/ambient-scribe/consent.ts`, `scribe_consents` table.

Deliberately not folded into `engagement_consents`. That answers "may we text
this number". This answers "may we capture this room" — the patient's voice,
their name spoken aloud, whatever a relative volunteers, and in a partitioned
OPD the audible remainder of somebody else's consultation.

Under **DPDP s.5 the notice is constitutive**: consent given without a compliant
notice is not defective consent, it is not consent. So the consent record
declares which s.5 elements the delivered notice covered, and a missing element
**refuses**.

**No notice text ships.** A DPDP notice must name *this* Data Fiduciary, *this*
grievance officer, and the route to the Data Protection Board — facts this
repository does not know and must not invent. A plausible-looking notice with a
placeholder where the accountable entity should be is worse than none, because
it looks discharged.

`purpose` is a closed union with one member. Quality review, teaching and model
training are each a different purpose under s.6 needing their own consent, and
the type system prevents the first record from quietly serving the second
question.

**Withdrawal (s.6(6)) is prospective, and the line is attestation:**

| | Audio | Draft | Attested note |
|---|---|---|---|
| Withdrawn before attestation | destroyed | destroyed | — |
| Withdrawn after attestation | destroyed | — | **retained** |

An attested note is a clinical record of care that was actually delivered, held
under medical-records retention rather than on consent. Deleting it would
destroy the treating clinician's record of a consultation that happened, which
serves nobody — least of all the patient, whose next clinician needs it.

The **transcript** goes in both cases. It is the verbatim capture of the room,
the same category as the audio, and "we kept a recording of everything you said
because you had already signed the note" is not a reading of withdrawal anyone
would accept. The cost is real and is reported rather than hidden: the retained
note's evidence links no longer resolve, and `GET /session/:id` says so instead
of returning silently empty provenance.

**Withdrawal acts at the moment it is recorded.** `POST /api/scribe/consent`
with `state=withdrawn` destroys the patient's unattested transcripts and drafts
across every session in two set-based updates, and returns the counts of what
was actually destroyed. An earlier version returned a `withdrawalEffect` object
asserting `deleteDraft: true` and destroyed nothing, leaving the content to be
purged only if some later request happened to re-check — during which window it
could be attested and exported. A response that asserts a destruction which did
not happen is worse than one that says nothing, because it closes the question.

**Every handler that reads or finalises a session re-checks consent** — reading
the draft back, attesting it, and exporting it as an ABDM document, not only
session start and transcript submission. Withdrawal purges the content anyway,
so in practice these find nothing to serve; they are the second line for a
draft written in the window between a withdrawal landing and the request
arriving. "The other check already handles it" is how the first gap got there.

### Residency: a BAA does not answer this question

`server/services/ambient-scribe/residency.ts`.

The EOI specifies deployment on **NHA-approved infrastructure**. That is not a
deployment detail for whoever writes the Terraform — it is a property every
inference request must satisfy, enforceable only immediately before the request.

**The live hazard, named precisely:** this repository's BAA-safe AI helper
(`server/lib/baa-chat.ts`) defaults to Vertex AI in `us-central1`. That default
is *correct* for the US product — Vertex runs under the existing Google BAA,
which is what HIPAA requires. Applied unchanged to an Indian consultation it
sends a recording of an Indian patient's voice to Iowa. Nothing in the existing
code would stop it, nothing would log it as unusual, and the feature would work
perfectly.

A BAA is a US instrument. It answers a HIPAA question and says nothing about
where a Data Fiduciary may process personal data under the DPDP Act, or about
what NHA has approved. So residency is checked as its own condition:
`SCRIBE_RESIDENCY_REGIONS_IN` names the approved regions, **an unset list
refuses**, and the check runs before any audio is accepted rather than on the
way out — a check that runs after the data has crossed a border has already
lost. A test pins that `us-central1` is refused for an `IN` session.

### Retention

| Artefact | Life |
|---|---|
| Audio | 24 h after attestation (`AUDIO_RETENTION_HOURS`) — and no column references it |
| Unattested draft | 72 h (`DRAFT_TTL_HOURS`), then it expires |
| Attested note | Medical-records retention |

Audio is working material. Keeping it alongside the note would build a
voice-biometric corpus nobody consented to, one consultation at a time.

A session longer than 90 minutes is **refused** — far more likely a recorder
left running between patients than a long appointment, and that is a privacy
incident rather than an edge case.

---

## 5 · API

All routes require a signed-in **clinic staff** account
(`requireClinicStaff`). Rate-limited to 30/min, tighter than the general API
limiter, because each call carries a consultation transcript.

```
GET  /api/scribe/capabilities        what this deployment can actually do
POST /api/scribe/consent             capture, or withdraw and destroy
POST /api/scribe/session             start — three gates, all refusing
POST /api/scribe/session/:id/draft   transcript in, evidence-linked draft out
GET  /api/scribe/session/:id         draft plus the words behind each item
POST /api/scribe/session/:id/attest  a named clinician signs
POST /api/scribe/session/:id/bundle  attested note → ABDM OP Consultation Record
```

All five session routes re-check consent. The two that build content refuse
outright; the three that read or finalise it serve the attested note and
nothing else.

`/capabilities` exists so a client can grey out languages that will refuse,
rather than letting a clinician start a consultation and discover mid-visit that
the scribe will not run.

**Why a role check is sufficient here** — and it is not, elsewhere. This branch
already had to refuse clinic-initiated share minting because a role check is not
a treatment-relationship check. The scribe is a different shape: **a session
does not open an existing record.** It creates new content from a conversation
in the room the caller is standing in, so a clinician fabricating a session for
a patient they are not treating gains nothing they could not have typed. Reading
back *is* where the asymmetry returns, so `GET /session/:id` is restricted to
the clinician who created it, and a session belonging to someone else answers
404 rather than 403 — a distinguishable 403 would confirm the id exists.

Session start runs three gates in this order, each refusing rather than
defaulting:

1. **Residency** — first, before anything reads or writes patient data.
2. **Consent** — with the DPDP s.5 notice behind it.
3. **Language** — unset speech allow-list refuses everything.

---

## 6 · Storage

Two tables, Postgres from the first commit — not a `Map` with a comment
promising a database later. That mistake was made twice on this branch (the
engagement consent registry and the share-grant registry were both
process-local while every deploy script ran `--max-instances=10`), and here it
would be worse: a withdrawn consent held in one process means nine other
instances happily record a patient who has said stop, and the audio exists by
the time anyone notices.

| Table | Contents |
|---|---|
| `scribe_consents` | Recording consent, notice version and elements, withdrawal |
| `scribe_sessions` | Encrypted transcript, encrypted draft, attestation, region, retention timestamps |

`transcript` and `draft` are the most identifying payloads this application
stores and are encrypted jsonb via the existing `phiDb` / `encryptPhiRow` path,
registered in `server/security/phi-column-map.ts`. `attestation` being null is
the difference between a draft and a clinical record.

---

## 7 · Test coverage: 87 tests

Weighted towards refusals, because every defect this module is designed against
produces output that *looks correct*.

Pinned directly: the 22-language count and the four 92nd-Amendment additions;
RTL for the Perso-Arabic three; copy coverage derived from the table rather than
hand-kept; no new empty-state string collapsing into its attested-none
counterpart; unset allow-list refusing; no silent fallback to Hindi or English;
`us-central1` refused for `IN`; every DPDP s.5 element required; withdrawal
effects on both sides of attestation; post-positional negation; brand-name and
code-mixed matching; a patient's diagnosis never becoming an assessment; no
assessment or plan without established roles; denial recorded as denial;
`not-discussed` distinguished from `explicitly-negative`; unattested bundle
build throwing; withdrawal destroying unattested content at the moment it is
recorded, retaining an attested note while destroying its transcript, and
leaving another patient's sessions untouched; a stale grant never overwriting
a newer withdrawal, with the unique index asserted at the schema level; section codes omitted without a validated IG map; note text
escaped rather than becoming markup; one attestation winning and the second
conflicting; purge refusing behind an attestation.

> **What the tests do not cover.** The suite has no database, so the store runs
> against an in-memory double that is faithful to the contract and **cannot**
> exercise the concurrency guarantee — under a single-threaded double an atomic
> UPDATE and a read-modify-write are indistinguishable. The rules are tested;
> the races are not.

---

## 8 · Not built — stated rather than implied

Anything below would have to be built or procured for a pilot. None of it is
hidden behind a green test suite.

- **No speech provider is wired.** The module takes a transcript and returns a
  note. Choosing and integrating an ASR engine that runs on NHA-approved
  infrastructure — which for a serious deployment likely means an on-premise or
  in-country model rather than a cloud endpoint — is the first pilot task.
  `SCRIBE_SPEECH_LANGUAGES` refuses everything until it is done.
- **No audio ingestion or storage path.** Retention is specified and the
  timestamps exist; the deletion job does not.
- **Terminology is not bundled.** NRCeS SNOMED CT India edition needs licensing
  and loading.
- **ABDM profile URLs and the composition type code are unvalidated** against
  the published IG (§ 2).
- **Five of 22 languages have no written copy** (§ 2).
- **The 17 that exist are unreviewed** by native clinical speakers.
- **No ABDM linkage.** This emits a bundle; linking it to an ABHA address and
  serving it over the HIP flows is separate work. Sandbox bridge onboarding is
  in progress separately.
- **The EOI PDF has not been read** (top of this document).

---

## 9 · Why this shape, in one paragraph

An ambient scribe's entire risk profile is that it is *fluent*. It does not fail
loudly: it produces a well-formed note attributing the patient's guess to the
doctor, recording a denied symptom as present, transcribing a language it does
not know, or filing a machine's reading of a conversation as a clinician's
record. Every one of those reads correctly on the page and changes care. So the
design choice repeated throughout this module is to make the system refuse in
the cases where it cannot be sure, and to make the refusals visible: an unset
allow-list transcribes nothing, an unestablished role builds no plan, an
unvalidated IG emits no section codes, an unattested draft is not exchangeable,
and an empty section says it is empty rather than saying nothing is wrong.
