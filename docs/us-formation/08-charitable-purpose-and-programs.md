# 08 · Charitable purpose and programme descriptions

This is the single most-reused text in the whole project. It goes, near-verbatim, into:

- Article THIRD of the Delaware certificate of incorporation (`02`)
- Article I of the bylaws (`03`)
- Form 1023-EZ Part III, the mission description field (`07`)
- The website "About" page that Google reviews (`09`)
- Candid/GuideStar, Benevity and every corporate giving portal
- Every grant application you will ever write

Write it once, get it right, then never re-improvise it. Inconsistency between your
certificate, your 1023 and your website is a real audit flag.

---

## The purpose statement

> **Kinbridge Global, Inc. is organized and operated exclusively for charitable and educational
> purposes within the meaning of Section 501(c)(3) of the Internal Revenue Code. The
> organization advances literacy, health-record access, community welfare, and the
> preservation of language and culture in underserved communities, providing its programmes
> free of charge to the people it serves. It pursues these purposes through original
> educational media for children, freely available tools that give patients custody of their
> own health records, direct community welfare services, and the documentation and open
> licensing of cultural and linguistic heritage.**

Three sentences: what it is, who it serves, how. Note the two load-bearing phrases —
*"exclusively for charitable and educational purposes within the meaning of Section
501(c)(3)"* is required language, and *"free of charge to the people it serves"* is the
sentence that pre-empts the commercial-purpose question before anyone asks it.

## One-line version

For bios, footers, and the 1023-EZ mission field if it truncates:

> **Kinbridge Global, Inc. builds free educational, health and cultural resources for underserved
> communities.**

## NTEE code

Form 1023-EZ asks for one three-character NTEE code that best describes your activities.
It is not binding — you can report differently on the 990 later — but it determines which
foundation databases and corporate giving portals surface you, so it is worth a minute.

| Code | Category | Case for it |
|---|---|---|
| **B92** *(recommended)* | Remedial Reading & Reading Encouragement | Katha.kids is the highest-volume, most fundable and most publicly legible programme. Literacy is one of the best-funded categories in US philanthropy, and this code puts you in front of those funders. |
| P20 | Human Service Organizations — Multipurpose | The most *accurate* code for a genuine four-programme umbrella. Also the vaguest, and vague codes surface in fewer targeted searches. |
| E70 | Public Health | Only if UHR becomes the flagship. Do not pick this now. |

**Use B92** unless you expect UHR to dominate within the first two years.

## Exempt-purpose checkboxes (1023-EZ Part III)

Check **Charitable** and **Educational**. Both, not one — charitable covers Noorjyoti's
welfare work and UHR's patient services; educational covers Katha.kids and Unraj. Leave
Scientific, Testing for Public Safety, Amateur Sports, and Prevention of Cruelty unchecked.

---

## Programme descriptions

Use these verbatim on the website and in applications. Each is written to be obviously
charitable on its face, because a reviewer skims.

### Katha.kids — children's stories and literacy

> Katha.kids produces and freely distributes original illustrated and audio stories for
> children, with an emphasis on Indian languages and on children who lack access to
> age-appropriate reading material in their mother tongue. All content is published at no
> cost through open web, podcast and video channels, and is made available to schools and
> public libraries for classroom use without licensing fees.

### UHR — health-record access

> UHR provides individuals with free tools to obtain, consolidate and control their own
> medical records. The programme exists to correct an access imbalance: patients are
> entitled to their health information but frequently cannot practically obtain it. UHR
> charges patients nothing, and the individual retains sole authority over who may view
> their records and for what purpose.

### Noorjyoti — community welfare

> Noorjyoti delivers direct welfare services to underserved communities, including
> assistance in accessing public benefit programmes for which residents are eligible but
> unenrolled. Services are provided free of charge and without regard to religion, caste,
> gender or ability to pay.

### Unraj — language and cultural heritage

> Unraj documents and preserves regional languages, oral traditions and cultural material
> at risk of loss, and publishes the resulting archive under open licences so that it
> remains freely available to researchers, educators and descendant communities in
> perpetuity.

---

## What NOT to say

Two phrasings will cost you months if a reviewer reads them:

**Never describe UHR as monetising, licensing, selling or brokering patient data** — not
even de-identified, not even for research, not even at cost. Under 501(c)(3) that reads as
unrelated business income at best and a substantial non-exempt purpose at worst. There is
existing code in this repository (`server/services/ai-fhir-data-monetization-service.ts`
and `server/ai-fhir-data-monetization-routes.ts`) that values and lists de-identified
patient datasets for sale. **Resolve that before you file** — remove it, rebuild it as
no-fee research sharing under ethics-committee governance, or move it into a separate
for-profit that licenses to the charity at arm's length. An IRS reviewer who finds a
"data marketplace" on the website of an applicant claiming charitable status will ask, and
the answer had better already be true.

**Never describe any programme as a product, service tier, customer base or market.** The
vocabulary you use about yourself becomes evidence about your purpose.
