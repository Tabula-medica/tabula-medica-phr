# Competitor teardown: SAWD and the AI-finance / neobank landscape

Date checked: 2026-10-13. Method: public, logged-out pages only (Firecrawl scrape/search, WebSearch). No logins, no PII, no code changes.
Legend: **[V]** verified on a cited public page; **[S]** secondary source only; **[E]** estimate or inference by the analyst. Nothing here is legal advice (see section 4).

## 1. Summary

1. **SAWD is not a bank.** sawd.ai ("SAWD, Inc.", Delaware C-Corp, "Software as a Wealth Device") is an AI tax-prep and household-ledger product. It uses Plaid for read-only bank links, a CPA-in-the-loop model, and an immutable hash-chained ledger. It holds no deposits, and the site shows no card, charter, or partner-bank claims [V: sawd.ai]. The brief's "AI finance/bank product" framing is wrong. Its real competitors are Monarch, Copilot, TurboTax and Kubera, not Chime. It explicitly benchmarks itself against Monarch, Quicken and Kubera [V].
2. **SAWD marketing has internal inconsistencies [V]**: page meta says "CPA review and sign-off coming soon", while the body says "Returns signed by CPAs 100%" and "Now live" for federal + VA/MD/DC. "Fifty-four features" appear to include many that are demo-mode (the page is labeled "Demo mode"). SOC 2 Type II is only "audit planned Q4 2026". Treat its claims as unverified, and do not copy its "bank-grade" or blockchain-anchoring language.
3. **Agent/MCP access is now table stakes in the category.** Copilot Money has an agent plus MCP waitlist [V]. Rillet ships "Aura MCP" for reads and writes into the GL from Claude, Salesforce and Snowflake [V]. Monarch's official MCP exists but is **paused** (partner data-portability dispute) [V]. This is the clearest whitespace and risk signal.
4. **Charter model is shifting from partner-bank to own-charter.** Mercury got OCC conditional approval for Mercury Bank, N.A. (Apr 2026) [V]. Revolut got OCC conditional approval (reported 2026-09-03) [S, Reuters]. Wise's OCC trust-charter application was denied (reported Jul 2026) [S]. The partner-bank (BaaS) model still carries FDIC "pass-through" caveats and Synapse/Evolve-type counterparty risk [S].
5. **Real NY-based players** (verified HQ or major NY presence): Ramp (NYC), Rillet (NYC), Current (NYC), Lili (NYC per its own site), Public (NYC, [S]), Revolut US (NYC address on OCC filing). Others (Mercury, Brex, Found, Varo, SoFi, Albert, Step, Novo, Relay) are **not** NY-HQ'd, or could not be verified as such. See matrix.
6. **For Tabula Medica:** the useful lessons are product patterns (auditable AI, agent/MCP surface, household/multi-entity, rules + AI categorization), not a banking build. Do not pursue a bank-like product without counsel (section 4). SAWD's site also references a sister mark "SAID" (patient-controlled medical records) which could overlap with this product category. See gap #10.

## 2. Feature / pricing matrix

Prices as shown on public pages on 2026-10-13 and subject to change. "n/v" means not verified on a public page.

| Company | HQ / NY presence | Target user | AI categorization | Agent / MCP / API | Multi-entity | Bank / charter model | Pricing |
|---|---|---|---|---|---|---|---|
| **SAWD** (sawd.ai) | n/v; site timezone metadata America/New_York [E, weak] | Households, taxes + wealth | Yes: "AI scans every transaction", IRS-category tagging, rules engine, receipt capture [V] | In-app "Copilot" with reasoning log; Slack/Sheets/Calendar integrations; no public API/MCP found [V] | Household members, spouses, heirs, business entities, multi-currency [V, marketing] | **None.** Plaid read-only links; Stripe billing; no deposits [V] | Free 7-day trial; price not shown in scraped markdown (FAQ collapsed) [V/gap] |
| **Copilot Money** | n/v (Apple-native; pricing page lists Brooklyn example only) | Individuals, Apple-ecosystem | Yes: "AI learns your spending patterns and tags every transaction" [V] | Agent + **MCP on waitlist** (agent.copilot.money) [V]; no public API found | Not advertised | None (aggregator) | **$7.92/mo, $95/yr billed yearly**; 1-month free trial [V] |
| **Monarch Money** | n/v | Individuals, couples, small side-business | Yes: auto-categorize + advanced rules [V] | AI Assistant on all plans [V]; **official MCP paused** since a partner data-portability question [V]; community MCPs use password login [S] | Plus: separate P&L per business; partner add free; read-only pro share [V] | None (aggregator, 13,000+ institutions) | **Core $99.99/yr ($14.99/mo); Plus $199.99/yr**; 7-day trial; money-back guarantee [V] |
| **Rillet** | NYC HQ [S: Tracxn, FinTech Futures]; SF office too | Mid-market/enterprise finance teams | AI coding, accruals, ASC 606 from contracts [V] | **Aura MCP** (reads+writes), Aura agents, API/integrations [V] | Yes: multi-entity, intercompany, consolidation [V] | None (ERP, not a bank) | Not public ("request a demo") [V]. Raised $100M Series C at $1B (Aug 2026) [S] |
| **Ramp** | NYC, 28 W 23rd St [S] | Companies of all sizes | AI coding, AP agents, OCR [V] | AI agents; API/MCP not stated on pricing page [V] | Yes (entities) [E] | No charter. Cards issued by Sutton Bank and Celtic Bank, Members FDIC [S: Ramp disclosures via search] | Free $0; Plus $15/user/mo (+ platform fee); Enterprise custom [V] |
| **Brex** | SF [E]; acquired by Capital One, closed 2026-04-07 [V] | Startups, mid-market | AI custom rules, compliance audit [V] | Brex API on all tiers; no MCP stated [V] | Yes [E] | Now inside Capital One group; pre-deal was partner-bank issuing [E] | Essentials $0; Premium $12/user/mo; Enterprise custom [V] |
| **Mercury** | SF [S] | Startups | AI data extraction in Bill Pay [V] | Invoicing API, Payments API [V] | Multiple accounts/entities [E] | **Partner banks today** (Choice Financial Group, Column N.A., Members FDIC) [V]; **OCC conditional approval for Mercury Bank, N.A.** (Apr 2026) [V] | $0; Plus $29.90/mo ($23.95 annual); Pro $299/mo ($239.90 annual) [V] |
| **Novo** | Miami (NY office listed) [S] | Small business, freelancers | n/v | n/v | n/v | Not a bank; Middlesex Federal Savings, F.A., Member FDIC [S] | n/v (marketed as no monthly fee [E]) |
| **Found** | SF [E]; partner Piermont Bank is NY-based [S] | Freelancers/self-employed (tax tools) | n/v | n/v | n/v | Not a bank; Piermont Bank, Member FDIC [S] | n/v |
| **Relay** | Third parties say Toronto, unverified; US-focused [S] | Small business | n/v | n/v | Multiple accounts (marketing) [E] | Not a bank; Thread Bank, Member FDIC; sweep to "up to $3M" [S] | n/v |
| **Lili** | **NY** (PO Box 1809, New York; "headquartered in New York") [V: lili.co] | Freelancers/self-employed | n/v | n/v | n/v | Not a bank; Sunrise Banks, N.A. on lili.co, Choice Financial on LinkedIn (**conflicting** [V]) | n/v |
| **Current** | **NYC** [S: Wikipedia] | Consumers, gig workers, teens | n/v | n/v | n/v | Not a bank; partners Choice Financial Group and Cross River Bank [V: current.com privacy policy] | n/v |
| **Aspiration** | Not NY (CA) [E] | Consumers (green banking) | n/a | n/a | n/a | **Bankrupt (2025)**; co-founder Sanberg sentenced to 14 years [S]. **Exclude from forward-looking comparison.** | n/a |
| **Step** | Not verified (sources conflict: Austin vs Redwood City) [S] | Teens/young adults | n/v | n/v | n/v | Not a bank; Evolve Bank & Trust; acquired by Beast Industries [S] | n/v |
| **Varo** | SF [S] | Consumers | n/v | n/v | n/v | **Holds its own OCC national bank charter** (opened Aug 2020) [S] | n/v |
| **SoFi** | SF [E, not verified]; SoFi Bank N.A. OCC-approved Jan 2022, based Utah [S] | Consumers | n/v | n/v | n/v | **Own national bank charter** (via Golden Pacific) [S] | n/v |
| **Revolut US** | US filings use NYC addresses (10004/10006) [V: OCC filing] | Consumers | n/v | n/v | n/v | **Conditional OCC approval** to form Revolut Bank US, N.A. (reported 2026-09-03; FDIC/Fed approvals pending) [S: Reuters] | n/v |
| **N26 US** | Berlin; US business **closed Jan 2022** (~500k accounts) [S: CNBC/Reuters] | n/a | n/a | n/a | n/a | n/a (exited) | n/a |
| **Wise** | London; Wise US Inc at 30 W 26th St, NYC [S] | International transfers | n/a | n/v | n/v | Licensed money transmitter (state by state), not a bank. OCC national trust-bank application **denied** (Jul 2026), citing a 2025 consent order ($4.2M multistate settlement incl. NYDFS) [S] | n/v |
| **Public** | NYC [S] | Retail investors | n/a | n/v | n/v | Broker-dealer Open to the Public Investing, Inc.; FINRA/SIPC member [S]; not a bank | n/v |
| **Albert** | LA [E, unverified] | Consumers | n/v | n/v | n/v | Not verified | n/v |

Rows with "n/v" were not verified because the first-pass scrape budget was prioritized to the three named companies plus Ramp, Brex and Mercury. Firecrawl hit rate limits partway through. Re-run for the n/v cells before using externally.

## 3. Top 10 gaps / opportunities for Tabula Medica (verdicts)

Context: Tabula Medica is a HIPAA PHR, not a finance app. "Opportunity" means a transferable pattern or a positioning gap.

| # | Gap / opportunity | Source of insight | Verdict | Rationale |
|---|---|---|---|---|
| 1 | **Auditable AI ("ask why, see the log")** | SAWD Copilot reasoning log; Rillet "every entry, every reason" [V] | **Adopt** | Fits `ai-governance-framework.md` and a HIPAA audit story. Log model, prompt version, sources (no PHI in logs). |
| 2 | **Agent/MCP access to user data** | Copilot waitlist; Rillet Aura MCP; Monarch MCP (paused) [V] | **Adapt** | Patient-owned data via an MCP-style read surface is differentiating, but only with BAA-compliant paths. PHI must not flow to non-BAA models (`phi-ai-guard.sh`). Monarch's pause shows data-source licensing risk; ours is patient-owned and FHIR-sourced, a stronger position. Scope read-only first. |
| 3 | **Household / multi-entity view** (spouses, dependents, heirs) | SAWD "household CFO"; Monarch "add partner free" [V] | **Adapt** | Caregiver and proxy access for family health records. Needs HIPAA authorization and minor/proxy rules per state. Check existing proxy features before building. |
| 4 | **Rules + AI hybrid categorization with one-click recategorize and audit** | SAWD, Monarch, Copilot [V] | **Adapt** | Map to document and problem-list categorization: AI suggests, human approves, rules persist. |
| 5 | **"AI prepares, human signs"** (CPA-in-the-loop) | SAWD [V] | **Adapt** | Clinician-in-the-loop for summaries or abstraction. Do not claim clinical sign-off unless a licensed clinician actually reviews. |
| 6 | **Immutable / tamper-evident audit trail** | SAWD hash chain, "Base L2 anchor" [V] | **Adapt (hash chain only)** | A hash-chained access log is cheap and HIPAA-relevant. **Skip** the blockchain anchoring: marketing gloss, raises PHI-adjacent and regulatory questions. |
| 7 | **Dead-man's switch / legacy access** | SAWD "Legacy Vault" [V] | **Adapt, later** | Emergency and successor access to a PHR is a real need, but it is legally sensitive (HIPAA personal representative rules). Counsel first. |
| 8 | **Subscription pricing anchors** | Copilot $95/yr; Monarch $99.99 / $199.99/yr [V] | **Adopt as benchmark** | Consumer willingness-to-pay is about $100 to $200/yr for a premium, ad-free, "we never sell your data" app. The privacy-first, no-ads framing is a proven message. |
| 9 | **Own-charter / BaaS banking build** | Mercury, Revolut conditional charters; Wise denial [V/S] | **Skip** | Out of scope and regulatory-heavy. No fit with a PHR. Revisit only for payments adjacent features (see section 4), never as core. |
| 10 | **Positioning collision: SAWD's sister mark "SAID" ("patient-controlled medical records")** | sawd.ai family-of-marks section [V] | **Investigate** | The site claims USPTO filings (Class 9/36/42) for "Software as an Insurance Device" in direct-pay healthcare and patient-controlled records. Have counsel check for trademark and positioning overlap, and see whether SAID is a related entity. Do not engage the company without direction. |

Marketing claims to avoid copying (per CLAUDE.md): "bank-grade", "SOC 2" (SAWD correctly says only "planned"), "post-quantum", "zero-knowledge" unless independently provable. Use "aligned with" language only.

## 4. Regulatory notes for any bank-like product (needs counsel review)

These are orientation notes from public sources, **not legal conclusions**. All items need review by qualified banking/fintech counsel and, for NY, NYDFS-specific counsel before any product decision.

1. **Partner-bank / BaaS ("fintech, not a bank") model.** Observed disclosures: Mercury says "not an FDIC-insured bank"; services via Choice Financial Group and Column N.A. [V]. Novo, Found, Relay, Lili, Current, Step, Ramp all use similar wording with different partner banks [S/V]. Deposit insurance is **pass-through** and covers failure of the *bank*, not the fintech (Mercury page states this [V]). FDIC risk articles flag limits for non-bank platforms [S]. The 2024 Synapse bankruptcy and partner-bank issues (e.g., Evolve) are the cautionary precedent [S]. Treat partner choice, ledger reconciliation, and end-user fund recordkeeping as major due diligence items.
2. **Own charter.** OCC national bank conditional approvals took about 4 months for Mercury (applied 2025-12-19, conditional approval announced 2026-04-27) [V], with FDIC and Federal Reserve approvals still required afterwards [V]. Revolut applied 2026-03-04/05 and reportedly got conditional approval 2026-09-03 [S]. Wise's trust charter was denied, reportedly citing a prior AML consent order [S]. Conditional approval is not final authority to operate.
3. **State money transmission.** Wise US Inc operates under state-by-state money transmitter licenses plus FinCEN MSB registration [S: Wise legal page via search]. In New York, money transmission is licensed under Banking Law Article XIII-B (Part 406, etc.) [S: secondary guides]. Timelines of 12 to 24+ months and surety-bond requirements are quoted by commercial guides and are **unverified**; confirm with NYDFS primary sources.
4. **NYDFS BitLicense (23 NYCRR Part 200)** applies to "virtual currency business activity" involving NY or NY residents; it is separate from the money transmitter license, and licensees also face the NYDFS Cybersecurity Regulation (Part 500) [S: commercial guides; the NY Comptroller audit page confirms the program exists]. Relevant only if crypto features are offered. SAWD's "crypto dashboard" is tracking only, which is a different analysis. Confirm via counsel.
5. **AML/BSA exposure.** NYDFS and five other regulators settled with Wise US for $4.2M over AML program deficiencies (Jul 2025) [S: NYDFS press release listing]. Any money-movement product needs an AML program, KYC/CIP and sanctions screening, usually inherited from the bank partner but still examined at the program-manager level.
6. **Tax-prep adjacent (SAWD-style).** IRS preparer rules (PTIN, Form 8879, e-file provider status) apply to the *filing* component, per SAWD's own description [V]. Not relevant to Tabula Medica unless tax features are added.
7. **Interaction with HIPAA.** A bank-like or payments feature touching payment for care could mix GLBA and HIPAA regimes. Do not combine financial account data and PHI in one store without counsel and a data-flow review. Aggregators (Plaid) are not in the current BAA chain [E].
8. **Claims discipline.** Do not use "bank", "FDIC-insured" or "SOC 2" in copy unless true. See SAWD's own hedge ("audit planned") for the acceptable pattern.

## 5. Sources (all checked 2026-10-13 unless noted)

Primary pages scraped (logged-out):
- SAWD: https://sawd.ai
- Copilot Money: https://www.copilot.money ; agent page https://agent.copilot.money/
- Monarch pricing: https://www.monarch.com/pricing ; MCP status https://help.monarch.com/hc/en-us/articles/50207234679956-Monarch-MCP-Connector
- Rillet: https://www.rillet.com ; https://www.rillet.com/product/aura-ai
- Ramp pricing: https://ramp.com/pricing
- Mercury pricing: https://mercury.com/pricing
- Brex pricing: https://www.brex.com/pricing

Search-derived (secondary; verify before external use):
- Rillet funding and NYC HQ: https://www.rillet.com/blog/rillet-raises-100m-series-c-at-1b-valuation-to-build-accounting-superintelligence ; https://tracxn.com/d/companies/rillet/__Rz1MMAsME_mL7iTWytJzOc1urfvqa8jnNoUYjm3H_W8 ; https://www.fintechfutures.com/venture-capital-funding/rillet-raises-70m-series-b
- Brex acquisition: https://www.capitalone.com/about/newsroom/capital-one-completes-acquisition-of-brex/
- Mercury charter: https://www.bankingdive.com/news/mercury-nabs-conditional-occ-charter/818674/ ; https://www.occ.gov/topics/charters-and-licensing/interpretations-and-decisions/2026/cd1372.pdf (the search snippet did not name the applicant; confirm that CD #1372 is Mercury's)
- Revolut: https://www.revolut.com/en-US/news/revolut_files_u_s_bank_charter_application_names_new_u_s_ceo/ ; https://www.reuters.com/business/finance/revolut-wins-conditional-us-banking-license-2026-09-03/ ; https://www.occ.gov/topics/charters-and-licensing/digital-assets-licensing-applications/revolut-bank.pdf
- Wise: https://wise.com/us/legal/state-licenses ; https://paymentexpert.com/2026/07/24/wise-us-banking-licence-denied-occ/ ; https://www.dfs.ny.gov/reports_and_publications/press_releases/pr20250709
- Current: https://en.wikipedia.org/wiki/Current_(financial_services_company) ; https://current.com/privacy_policy/
- Lili: https://lili.co/ ; https://lili.co/business-banking ; https://www.linkedin.com/company/hellofromlili
- Aspiration: https://courthousenews.com/co-founder-of-green-bank-gets-14-years-for-defrauding-lenders-investors/ ; https://www.bankingdive.com/news/aspiration-co-founder-wire-fraud-plead-guilty/758787/
- N26 US exit: https://www.cnbc.com/2021/11/18/german-digital-bank-n26-to-withdraw-from-the-us.html ; https://www.reuters.com/business/german-online-bank-n26-exit-north-american-market-2021-11-18/
- Public: https://public.com/disclosures/annual-disclosure-2026
- Found: https://www.found.com/help/getting-started/is-found-fdic-insured
- Novo: https://www.novo.co/help/what-is-novo
- Relay: https://relayfi.com/about ; https://bankwith.relayfi.com/incfile
- Varo: https://davispolk.com/insights/client-update/occ-grants-conditional-national-bank-charter-mobile-only-bank
- SoFi: https://occ.gov/news-issuances/news-releases/2022/nr-occ-2022-4.html
- Step: https://www.arkansasbusiness.com/article/mrbeast-step-acquisition-evolve-bank/
- Ramp issuer disclosure (via search summary of ramp.com pages): https://ramp.com/lovefinance
- NYDFS BitLicense / money transmitter orientation (commercial guides, low confidence): https://cryptoslate.com/crypto-laws/bitlicense-23-nycrr-part-200/ ; https://www.osc.ny.gov/state-agencies/audits/2024/01/02/virtual-currency-licensing
- FDIC BankFind, Choice Financial Group: https://banks.data.fdic.gov/bankfind-suite/bankfind/details/9423

Not verified or not covered: SAWD pricing (FAQ collapsed in scrape), Albert, SoFi HQ, Novo/Found/Relay/Lili/Current/Step/Varo pricing and AI/API features, Monarch/Copilot HQ, Ramp/Brex MCP details beyond pricing pages, any primary NYDFS licensing text. Several 403s from the lowercase Firecrawl server and 429 rate limits limited coverage.
