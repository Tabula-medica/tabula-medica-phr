# RVU calculation and per-provider productivity

Medicare Physician Fee Schedule pricing, and wRVU productivity attributed per
provider.

---

## The formula

```
allowed = [ (wRVU × workGPCI)
          + (peRVU × peGPCI)
          + (mpRVU × mpGPCI) ] × conversionFactor
```

Three separately geographically-adjusted components, then one national dollar
multiplier. The order matters: each component takes **its own** GPCI, so summing
the RVUs first and adjusting once produces a different — and wrong — number. A
test pins that distinction.

Pricing applies, in order:

1. **Row selection** — a modifier-specific row (`26` professional, `TC`
   technical) when the file has one, else the global row. The professional and
   technical components of an imaging study carry genuinely different RVUs, and
   collapsing them onto the global row overpays one and underpays the other.
2. **Site of service** — facility vs non-facility practice expense. The same
   office visit pays materially less in a hospital outpatient department because
   the hospital is separately paid for the overhead. Picking the wrong column is
   a large, silent error, so every priced line reports which one it used and what
   the other would have been.
3. **Payment modifiers** — see below.
4. **Multiple-procedure reduction** — across the session's lines.
5. **Units**, then **GPCI**, then **conversion factor**.

### Modifiers

Priced automatically, because these are national policy that applies the same way
to every code:

| Modifier | Effect |
|---|---|
| `50` bilateral | 150% — **only** when the code's bilateral indicator is `1` |
| `80` / `81` / `82` assistant | 16% |
| `AS` non-physician assistant | 85% of the 16% |
| `62` co-surgeon | 62.5% each |

Guarded, not blindly applied. Modifier `50` on a code already priced as bilateral
would overpay by half, so the code's own indicator is checked first and the line
carries a note saying the rule was *not* applied. Same for an assistant modifier
on a code whose assistant-surgery indicator is `1` (never payable).

**Refused rather than guessed:** `52` (reduced services), `53` (discontinued),
`54`/`55` (split surgical care), `66` (team surgery). Their effect depends on the
individual code's global package or on carrier discretion — there is no national
percentage. Those lines price without a factor and are **flagged for manual
review**. A flagged line gets looked at; a quietly-guessed one does not.

### Multiple-procedure reduction

Highest-valued procedure at 100%, each subsequent one at 50%. Ranking is by
**adjusted RVU, not input order** — billing systems do not sort, and reducing
whichever line happened to arrive first underpays the major procedure. Only codes
whose multiple-procedure indicator is `2` participate; E/M visits and add-on codes
are never reduced.

---

## Why there is no price out of the box

The Relative Value File (~10,000 rows), the GPCI file and the conversion factor
are **not bundled**. They load from the official CMS release via
`PFS_RVU_TABLES_PATH`.

CMS revises the Relative Value File *quarterly* (RVU26A, RVU26B, …) and the
conversion factor is occasionally amended mid-year by legislation. A fee schedule
priced with last year's conversion factor produces a number that looks entirely
normal and is wrong on every line, with no visible symptom.

Validation rejects, among others:

- tables spanning **mismatched years**
- a non-positive conversion factor
- duplicate code+modifier rows
- unrecognised PFS status indicators
- **implausible GPCIs** — values cluster near 1.0, so anything outside `0.3–3.0`
  is almost always a decimal-point or column-offset error in the import, and it
  would scale every claim in that locality

### Refusals, not defaults

| Situation | Behaviour |
|---|---|
| No tables loaded | `not-priced`, `tables-not-loaded` |
| Code absent from the file | `not-priced`, `code-not-in-fee-schedule` |
| Status `B`/`N`/`I`/`X` (bundled, non-covered…) | `not-priced`, `code-not-separately-payable` |
| Unknown locality | `not-priced`, `locality-not-found` — **not** a GPCI of 1.0 |

An unpriced line is reported with its reason and credits nobody. It is never
silently dropped from a total.

### CPT is licensed

RVU *values* are US Government work and freely usable. CPT **code descriptors**
are AMA copyright and require a license. Descriptors are optional throughout —
the engine works on codes alone, and nothing here ships a descriptor.

---

## Per-provider productivity

Reported in **work RVU only**. Not total RVU, not dollars.

Work RVU is the one component that reflects what the clinician did. Practice
expense reflects what the practice spent; malpractice reflects what it insured. A
"productivity" figure built on total RVU rewards a physician for working somewhere
with expensive overhead and penalises one who moves a case to a facility setting
— neither of which is about their work. Total RVU and allowed amount are still
reported, labelled as context.

### Attribution is the hard part

Two NPIs appear on a claim line: who **performed** the service (rendering) and who
it was **billed under** (billing). Usually identical. When they differ, it is
almost always **incident-to** billing — an APP's visit billed under a supervising
physician's NPI to obtain 100% rather than 85% of the fee schedule.

- Attribute by **billing NPI** → the physician is credited with work they did not
  do, and the APP shows near-zero productivity. On wRVU-based compensation the APP
  is underpaid for real work, and the physician's numbers cannot be compared to
  any external benchmark.
- Attribute by **rendering NPI** → credit follows the work.

Default is **rendering**. Either way, every line where the two differ is reported
individually in `attributionDiscrepancies`, and the caveats name the total wRVU
affected. A practice can choose billing-NPI attribution; what it cannot have is
the choice being invisible.

`POST /api/rvu/productivity/compare` runs both bases over the same sessions and
returns `shifts` — the wRVU that moves between named providers. Seeing the actual
number settles the argument faster than any explanation of incident-to rules.

### Normalisation

- **`workRvuPerFte`** — the only cross-provider comparable. Returns **null** when
  clinical FTE is unknown, rather than defaulting to 1.0, which would turn a
  half-time clinician into an apparent underperformer.
- **`workRvuPerEncounterDay`** — robust to period length and to FTE gaps.
- **`encounterDays`** counts distinct dates of service, not lines.

### Caveats travel with the numbers

Every report carries them inline: attribution basis and how much wRVU it moves,
providers missing an FTE, lines with no NPI that credit nobody, unpriced lines,
and — for periods under 90 days — a warning that annualising a short sample
amplifies vacation, call schedules and case-mix noise into apparent performance
differences.

**No benchmark percentiles.** MGMA and AMGA data are licensed products.
Comparing to a remembered or approximated percentile is worse than not comparing
at all, so the report says so and supplies none.

---

## Endpoints

US only, gated on `TEFCA_ENABLED` — the Physician Fee Schedule is a Medicare
construct, and an "RVU" computed elsewhere is a number with no payer behind it.

```
GET  /api/rvu/model                  loaded table status, conversion factor, provenance
POST /api/rvu/price                  price one session's lines (MPPR applied across them)
POST /api/rvu/productivity           per-provider wRVU for a period
POST /api/rvu/productivity/compare   the same sessions under both attribution bases
```

## Configuration

```bash
export PFS_RVU_TABLES_PATH=/etc/tabula/cms-pfs-2026.json
```

A JSON file matching `RawPfsTables` in
`server/services/rvu/pfs-tables.ts`: the Relative Value File rows, the GPCI rows,
and the conversion factor, each stamped with its source and year. The conversion
from the CMS release lives outside this process, so the judgement calls in it sit
in a reviewed artifact rather than a server boot path.

---

## Limitations, stated rather than buried

- **No CMS tables bundled.** Pricing is unavailable until a deployment supplies
  the official release. A deliberate refusal.
- **Facility/non-facility comes from the caller**, not from a place-of-service
  code lookup. A production integration should derive it from POS on the claim.
- **Global-period logic is not implemented.** A post-op visit inside a 90-day
  global is not separately payable, and this engine will price it if asked. The
  global period is loaded and available on each row; enforcing it needs the
  original surgery date, which is claim-history state this module does not hold.
- **Site-of-service differential, sequestration, and the MPPR for diagnostic
  imaging and therapy** (which use different percentages from the surgical rule)
  are not modelled.
- **Anesthesia is out of scope** — it is priced on base units plus time, not on
  the RVU formula at all.
