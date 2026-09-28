# Counsel Engagement — SAWD compliance items (DRAFT for owner to send)

> Draft only. Review, fill the placeholders, and send from your own account. Not legal advice.
> Attachments to include: this file's four items, plus links to the relevant policy drafts in
> `soc2/policies/` (data-privacy, incident-response, vendor-third-party-risk, encryption).

---

**To:** [attorney name] <[email]>
**From:** Rajiv Aggarwal
**Subject:** SAWD — tax/fintech compliance sign-offs needed (§7216, Circular 230, GLBA/WISP, AI data-use)

Hi [name],

We're taking SAWD (our tax-preparation + family-wealth platform) through a SOC 2 readiness
process and preparing for live e-file. Four items need your review before we can charge clients,
transmit returns, or attest to our data partners. Context you'll want: we hold **EFIN 102371** and
**PTIN P03495946**; the platform links bank data (via Plaid), processes payments (Stripe), stores
tax documents, and uses AI (Anthropic Claude via Google Vertex, and Google Gemini) in the
data-handling path.

**1. IRC §7216 / §6713 taxpayer-consent framework.**
Please confirm the exact consent language and format we must present before (a) using or
disclosing tax-return information for anything beyond preparing the return, and (b) routing that
information to our AI subprocessors and to Plaid/Stripe. We understand consent must follow the form
and content of **Rev. Proc. 2013-14** (separate, signed, specific-purpose, with the required
statutory notices). Two sub-questions: does our AI-assisted processing constitute a "use" that needs
consent, and does it implicate any **disclosure** to a third party (the AI vendor) that needs a
separate §7216 disclosure consent? We need approved language we can version and timestamp.

**2. Circular 230.**
Confirm our practitioner obligations (due diligence, data safeguarding, advertising/solicitation
rules) are satisfied by our current workflow, and whether any of our AI-generated outputs require
practitioner review before they reach the client.

**3. GLBA Safeguards Rule / WISP.**
We have a Written Information Security Program in draft (`soc2/policies/`). Please confirm it meets
the FTC Safeguards Rule requirements for a financial institution of our size (qualified individual,
risk assessment, access controls, encryption, MFA, vendor oversight, incident response) and flag
anything missing before we formally adopt it.

**4. AI data-use / Zero-Data-Retention + breach notification.**
(a) Confirm whether our data-processing terms with Anthropic (via Vertex) and Google (Gemini)
establish **zero data retention / no-training** on customer and tax data, and whether those DPAs are
sufficient §7216-compatible subprocessor arrangements. (b) Review the **breach-notification matrix**
in our incident-response policy against applicable state breach-notification statutes and **IRS Pub.
4557 / FTC Safeguards** reporting triggers, and confirm our notification timelines and recipients.

Happy to walk through any of this on a call. What's your availability this week, and can you give a
rough estimate for the four items?

Thanks,
Rajiv
