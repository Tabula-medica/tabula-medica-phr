# CrowdStrike 2026 → Portfolio Hardening Plan

**Scope:** Tabula Medica PHR (this repo, HIPAA), Uninsurance (PIPL + US state law), sawd.ai (financial / tax data), Universal Health Radio (media + accounts), katha.kids (COPPA).
**Status:** Tabula Medica controls shipped in this branch. Sibling-app items are a port list (section 5).

> Source note. The `share.google` link supplied with the request is blocked from the build network, so this plan is built from CrowdStrike's public 2026 material: the **2026 Global Threat Report** (Feb 2026), the **2026 Threat Hunting Report** (Aug 2026, Black Hat), the **Fal.Con 2026** announcements (Aug 31 – Sep 3, 2026: Falcon Guardian / AI Detection & Response, Falcon platform on the Anthropic Claude Marketplace, Google Cloud Agent Gateway integration, agentic SOC), and the **"Healthcare Cybersecurity in 2026: 5 Priorities"** white paper. If the shared link points at a different artefact, the mapping in section 1 is the place to add it.

---

## 1. What CrowdStrike is telling us in 2026

| # | Finding (CrowdStrike, 2026) | Why it matters for our apps | Control family |
|---|---|---|---|
| F1 | **82% of intrusions were malware-free**; valid-account abuse was 35% of cloud incidents. Adversaries move with stolen credentials, trusted identity flows and approved SaaS integrations. | Our apps are Cloud Run + Firebase/GCIP + Vertex + Stripe + Resend. Nothing an EDR sees. The only observable is *how a valid session is used*. | Identity / session |
| F2 | **Vishing intrusions doubled** in H1 2026 vs H2 2025 (CORDIAL SPIDER, SNARKY SPIDER impersonating IT, then AiTM phishing pages). **OAuth device-code phishing up 15×.** | Help-desk style flows (password reset, "verify your account", caregiver invitations) are our vishing surface. Token → session exchanges must be rate-limited and *visible*. | Identity / recovery flows |
| F3 | **Account takeover → data exfiltration in under 5 minutes** in observed cases. | Detection that lands in stdout or a weekly review is useless. Security signals must reach a SIEM in seconds. | Telemetry / SIEM |
| F4 | **AI-enabled threats up 89%**; malicious prompt injection observed at **90+ organisations**; AI development platforms abused. Falcon Guardian's answer: discover AI agents, watch prompts at runtime, connect prompts to downstream actions, enforce policy. | Tabula Medica alone has ~100 AI route modules; several are agentic (FHIR write, export, share, care-team messaging). Uninsurance and sawd.ai have AI chat/agent surfaces over regulated data. | AI runtime (AIDR) |
| F5 | **88% of vulnerability exploitation began within 48 hours of a public PoC.** | Weekly Dependabot leaves a multi-day window. Scanning must be per-PR **and** daily, with a fail-the-build posture on high/critical. | Supply chain |
| F6 | **Cloud-conscious intrusions +37%** (state-nexus +266%); fake-CAPTCHA lures +563%. | Cloud identity (service accounts, deploy tokens, EAS/Expo, Replit secrets) is a first-class target, and users will be lured to paste credentials. | Cloud / secrets |
| F7 | Healthcare 2026 priorities: **AI, identity, cloud, supply chain, adversary TTPs**; individual assessments per data plane (on-prem / IaaS / SaaS). | Our "data planes" are Cloud Run, Cloud SQL, GCS, Firebase, Vertex, Stripe, Resend, Fasten, and the App Store / Play pipelines. Each needs its own control statement. | Governance |

Sources: [2026 Global Threat Report](https://www.crowdstrike.com/en-us/press-releases/2026-crowdstrike-global-threat-report/) · [2026 Threat Hunting Report](https://www.crowdstrike.com/en-us/blog/crowdstrike-2026-threat-hunting-report/) · [Falcon Guardian launch](https://www.crowdstrike.com/en-us/press-releases/crowdstrike-unveils-falcon-guardian-ai-agent-security/) · [Falcon on Anthropic Claude Marketplace](https://www.crowdstrike.com/en-us/press-releases/crowdstrike-brings-falcon-platform-to-anthropic-claude-marketplace/) · [Healthcare Cybersecurity in 2026](https://www.crowdstrike.com/en-us/resources/white-papers/healthcare-cybersecurity-in-2026/) · [Healthcare industry observations](https://www.crowdstrike.com/en-us/blog/crowdstrike-services-healthcare-industry-observations/) · [Falcon Next-Gen SIEM HEC ingestion](https://developer.crowdstrike.com/ngsiem/data-ingestion/)

---

## 2. Control matrix across the portfolio

Legend: ✅ shipped in this branch · 🔁 port from this repo · 🆕 app-specific work · — not applicable

| Control | Tabula Medica (HIPAA) | Uninsurance (PIPL / US) | sawd.ai (GLBA / IRS 4557) | Universal Health Radio | katha.kids (COPPA) |
|---|---|---|---|---|---|
| **Session binding** (UA / country / network drift → alert, optional terminate) | ✅ `server/security/session-binding.ts` | 🔁 same file; PIPL: keep country in telemetry only, never persist | 🔁 enforce mode from day 1 (financial data, few mobile roamers) | 🔁 monitor mode; protect publisher / admin accounts | 🔁 monitor; child accounts are parent-managed |
| **Session-exchange rate limits + 429 telemetry** | ✅ `sessionExchangeRateLimiter` on GCIP web/mobile exchange and Fasten link | 🔁 apply to WeChat / phone-OTP login exchange | 🔁 apply to Plaid link + login | 🔁 apply to login | 🔁 apply to parent login |
| **AI runtime guard (AIDR)** — input injection scoring, output exfil scan, monitor → enforce | ✅ `server/security/ai-runtime-guard.ts` on `/api/ai*`, multimodal, summaries | 🔁 route pattern → benefits-navigator chat; add zh-CN rule set (see §5) | 🔁 route pattern → CFO / tax agents; add tool-coercion rules for `transaction`, `wire`, `1099` | 🔁 if AI show-notes / script generation exists | 🔁 story-generation prompts; COPPA: never log child text |
| **Security events → SIEM (HEC)** | ✅ `server/security/siem-forwarder.ts`, fan-out from `logSecurityEvent` and 401/403 | 🔁 | 🔁 | 🔁 | 🔁 |
| **Per-PR + daily dependency scan** (`npm audit --audit-level=high` + OSV-Scanner, both blocking) | ✅ `.github/workflows/security-scan.yml`; first run forced medplum 5.x, fast-uri, nanoid, qs, browserslist, postcss-selector-parser fixes and one documented ignore (stream-json via firebase-tools) | 🔁 | 🔁 | 🔁 | 🔁 |
| **PHI/PII-free telemetry allowlist** | ✅ denylist built from `PHI_FIELD_NAMES` | 🆕 build a `PII_FIELD_NAMES` (姓名, 手机号, 身份证) equivalent | 🆕 SSN, EIN, account numbers, routing numbers | 🆕 email, handle | 🆕 child name, DOB, school |
| **Recovery / help-desk flow hardening** (F2) | 🆕 add cooling-off + out-of-band confirm for email change, caregiver grant, export | 🆕 same for phone-number change | 🆕 same for payout/bank change | 🆕 publisher role grant | 🆕 parent email change |
| **Cloud identity hygiene** (F6) | 🆕 rotate `GCP_SERVICE_ACCOUNT_KEY` to Workload Identity; retire mobile-Replit EAS creds (roadmap item AF) | 🆕 | 🆕 | 🆕 | 🆕 |

---

## 3. What shipped in this branch (Tabula Medica)

### 3.1 New modules

| File | Purpose | Default |
|---|---|---|
| `server/security/siem-forwarder.ts` | Ships security events to a Splunk-HEC-compatible collector (Falcon Next-Gen SIEM, LogScale, Splunk). Allowlisted envelope, PHI-key denylist, value truncation, bounded queue, batching, 5 s timeout, warn-once on failure. | **Off** until `SIEM_HEC_URL` + `SIEM_HEC_TOKEN` are set |
| `server/security/ai-runtime-guard.ts` | 30 weighted injection rules across 8 categories (instruction override, role hijack, system-prompt probe, tool coercion, exfiltration, delimiter spoof, encoding/obfuscation, safety bypass). Unicode normalisation (zero-width, tag chars, NFKC). Output-side scan for image beacons / data URIs / credentials. Express middleware on AI routes. | **Monitor** (`AI_GUARD_MODE=monitor`) |
| `server/security/session-binding.ts` | Binds a PHI-free fingerprint (UA hash, /24 or /64 network hash, country) to the session; flags drift. UA or country change = high; network-only = medium and never enforced. | **Monitor** (`SESSION_BINDING_MODE=monitor`) |
| `.github/workflows/security-scan.yml` | `npm audit --omit=dev --audit-level=high` + OSV-Scanner (all severities, pinned binary), both blocking, on PR, push to `main`, and daily 06:17 UTC; runs the three new security test suites. Documented exceptions live in `osv-scanner.toml`. | On |

### 3.2 Modified

- `server/security/api-protection.ts` — every auth limiter now emits `auth_rate_limited` via `logSecurityEvent`; new `sessionExchangeRateLimiter` (40 / 15 min / IP) on `/api/auth/gcip/session`, `/api/mobile/auth/gcip/session`, `/api/auth/fasten/verify`.
- `server/security/gcp-audit-logger.ts` — `logSecurityEvent` and the 401/403 path fan out to the SIEM forwarder.
- `server/replit_integrations/auth/replitAuth.ts` — mounts `sessionBindingMiddleware()` and `aiRuntimeGuard()` right after `passport.session()`.
- `server/security/index.ts` — exports the new surface.
- `threat_model.md`, `replit.md` — new threat categories and env vars.

### 3.3 New security event types (all PHI-free)

`auth_rate_limited` · `session_binding_anomaly` · `session_binding_terminated` · `ai_prompt_injection_detected` · `ai_prompt_injection_blocked` · `ai_output_exfiltration_pattern` (plus existing `unauthorized_access` / `forbidden_access` now forwarded).

### 3.4 Environment variables

| Var | Values | Notes |
|---|---|---|
| `SIEM_HEC_URL` | `https://<connector-id>.ingest.<region>.crowdstrike.com/services/collector/event` (copy from the HEC connector page) | https only; forwarder disabled otherwise |
| `SIEM_HEC_TOKEN` | connector API key | store in Secret Manager, not `.env` |
| `SIEM_BATCH_SIZE` / `SIEM_FLUSH_MS` | default 25 / 2000 | |
| `SIEM_HOST_LABEL` | default `K_SERVICE` or `tabula-medica-web` | |
| `AI_GUARD_MODE` | `off` \| `monitor` \| `enforce` | default monitor |
| `SESSION_BINDING_MODE` | `off` \| `monitor` \| `enforce` | default monitor |

### 3.5 Rollout (monitor → enforce)

1. Deploy with defaults (monitor). Watch `ai_prompt_injection_detected` and `session_binding_anomaly` for 7 days.
2. Tune: any rule id that fires on benign clinical text more than ~1% of the time gets its weight lowered in `INJECTION_RULES`.
3. Flip `SESSION_BINDING_MODE=enforce` first (UA/country only — low false-positive), then `AI_GUARD_MODE=enforce`.
4. Add the SIEM detections in §4.3 before flipping enforce, so the SOC sees what enforcement is doing.

---

## 4. SIEM integration runbook (Falcon Next-Gen SIEM)

### 4.1 Connector

1. Falcon console → **Next-Gen SIEM → Data connectors → Add connector → HEC / HTTP Event Collector**. Name it `tabula-medica-security`.
2. Copy the **API URL** and **API key** shown once on the connector page.
3. Put both in GCP Secret Manager (`siem-hec-url`, `siem-hec-token`) and expose to Cloud Run via `--set-secrets=SIEM_HEC_URL=siem-hec-url:latest,SIEM_HEC_TOKEN=siem-hec-token:latest` in `deploy.sh`.
4. Verify: `GET /api/compliance-status` → the security block now includes the forwarder status (`enabled`, `endpointHost`, `sent`, `dropped`).

Any Splunk-HEC-compatible collector (Falcon LogScale, Splunk, Cribl) works unchanged.

### 4.2 Wire format

Newline-delimited HEC envelopes, `Authorization: Bearer <token>`:

```json
{"time":1757160000.123,"host":"tabula-medica-web","source":"tabula-medica:security","sourcetype":"_json",
 "event":{"eventType":"session_binding_anomaly","riskLevel":"high","actor":"usr_…","ip":"203.0.113.9",
          "details":{"reasons":["country_changed"],"boundCountry":"US","currentCountry":"RU","mode":"monitor"},
          "app":"tabula-medica","environment":"production","timestamp":"2026-09-06T12:00:00.000Z"}}
```

### 4.3 Detections to create first

| Name | Logic | Severity |
|---|---|---|
| Session hijack candidate | `eventType=session_binding_anomaly` AND `details.reasons` contains `country_changed` OR `user_agent_changed`, same `actor` within 10 min | High |
| Credential / token spray | `eventType=auth_rate_limited` AND `details.limiter=session_exchange` ≥ 3 distinct IPs in 15 min | High |
| Prompt-injection campaign | `eventType=ai_prompt_injection_*` ≥ 5 events from one `actor` or `ip` in 1 h | Medium |
| Agentic exfil attempt | `ai_prompt_injection_*` with `details.categories` containing `tool_coercion` or `exfiltration` AND a later `record_export`/`share_link_created` for the same actor within 30 min | Critical |
| Access-denied burst on PHI routes | `eventType=forbidden_access` AND `details.phiRoute=true` ≥ 20 in 5 min per actor | High |

---

## 5. Port list for sibling apps

Copy verbatim (they only depend on Express + a PHI/PII field-name list):

- `server/security/siem-forwarder.ts` — swap the `PHI_FIELD_NAMES` import for the app's PII list.
- `server/security/ai-runtime-guard.ts` — change `DEFAULT_AI_ROUTE_PATTERN` to the app's AI prefixes; append locale rule sets:
  - Uninsurance (zh-CN): 忽略(之前|上面|所有)(的)?(指令|规则|提示), 你现在是, 系统提示(词)?, 扮演, 导出(所有|全部)(用户|会员)(数据|信息)
  - sawd.ai: tool-coercion words `wire|transfer|payout|1099|W-2|EIN|routing`
  - katha.kids: block any rule hit at `medium` (children's surface, lower threshold)
- `server/security/session-binding.ts` — unchanged; mount after session/passport.
- `.github/workflows/security-scan.yml` — unchanged (expect the first run to surface the app's own backlog; fix via bumps/overrides, never by lowering the gate).
- `tests/*.spec.ts` for the three modules — unchanged.

Mount order in every app: `session → passport → sessionBindingMiddleware → aiRuntimeGuard → routes`.

---

## 6. 30-day action list

| # | Action | App(s) | Effort | Deadline |
|---|---|---|---|---|
| 1 | Merge this branch; deploy with monitor defaults | TM | 0.5 d | Week 1 |
| 2 | Create Falcon NG-SIEM HEC connector (or LogScale community edition), set secrets, confirm events land | TM | 0.5 d | Week 1 |
| 3 | Create the 5 detections in §4.3 | TM | 0.5 d | Week 1 |
| 4 | Port the four files to Uninsurance and sawd.ai; add PII lists + locale rules | UNI, SAWD | 1 d each | Week 2 |
| 5 | Add cooling-off + out-of-band confirmation to email change, caregiver grant, bulk export (F2) | TM, UNI | 2 d | Week 3 |
| 6 | Flip `SESSION_BINDING_MODE=enforce` after 7 clean days; then `AI_GUARD_MODE=enforce` | TM first, then all | 0.5 d | Week 3–4 |
| 7 | Replace `GCP_SERVICE_ACCOUNT_KEY` JSON with Workload Identity on Cloud Run; retire mobile-Replit EAS credentials (roadmap AF) | TM | 1 d | Week 4 |
| 8 | Per-data-plane control statement (Cloud Run, Cloud SQL, GCS, Firebase, Vertex, Stripe, Resend, Fasten, App Store/Play) added to `.local/deliverables/three-site-compliance-matrix.md` | TM | 1 d | Week 4 |

---

## Executive recap

- **Shipped:** SIEM forwarder (Falcon NG-SIEM / HEC), AI runtime guard (AIDR), session binding, session-exchange rate-limit telemetry, per-PR + daily dependency scanning, 3 test suites, threat-model update — all monitor-mode by default, zero PHI in telemetry by construction.
- **Portfolio:** every control is a drop-in port for Uninsurance, sawd.ai, UHR and katha.kids; §5 lists the exact files and the per-app adaptations.
- **Your next action:** create the HEC connector, drop the URL/token into Secret Manager, deploy, and watch the two anomaly event types for a week before flipping to enforce.
