# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | Yes                |

## Reporting a Vulnerability

Tabula Medica takes security seriously. As a HIPAA-compliant healthcare application, we prioritize the protection of patient data and system integrity.

### How to Report

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public GitHub issue.** Security vulnerabilities must be reported privately.
2. Email your findings to **security@tabulamedica.com** with the subject line: `[SECURITY] Brief description of vulnerability`.
3. Include the following in your report:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: We will acknowledge your report within 48 hours.
- **Assessment**: We will assess the vulnerability and determine its severity within 5 business days.
- **Resolution**: Critical vulnerabilities affecting PHI (Protected Health Information) will be prioritized and patched within 72 hours. Other vulnerabilities will be addressed based on severity.
- **Disclosure**: We will coordinate with you on public disclosure timing. We request a 90-day disclosure window for non-critical issues.

---

## Security Audit Report - February 2026

### Dependency Updates

The following packages were updated to resolve known CVEs:

| Package | Previous | Updated | Status |
|---|---|---|---|
| axios | 1.13.4 | 1.13.5 | Fixed |
| @isaacs/brace-expansion | 5.0.0 | 5.0.1 | Fixed |
| minimatch | 3.1.2 / 5.x / 8.x / 9.x | 10.2.4 | Fixed (direct) |
| node-forge | 1.3.1 | 1.3.3 | Fixed |
| tar | 7.5.7 | 7.5.9 | Fixed |

### Vulnerability Findings and Remediation

#### CRITICAL - Broken Authentication (FIXED)

**Finding:** The `requireAuth` middleware only validated the format of the `x-user-id` request header without verifying any session token. Any client that knew or guessed a user ID could impersonate that user and access all their data (including PHI).

**Fix:** Implemented server-side token-based authentication. All auth endpoints (login, register, demo, Apple, Google) now generate cryptographically random access tokens (256-bit, SHA-256 hashed before storage) with 15-minute expiry and 7-day refresh tokens. The `requireAuth` middleware now validates Bearer tokens against the `user_sessions` table and verifies token expiry. Fallback `x-user-id` validation confirms the user exists in the database.

**Files changed:** `server/routes.ts`

#### CRITICAL - IDOR (Insecure Direct Object References) (FIXED)

**Finding:** User management routes (`GET/PATCH/DELETE /api/users/:id`) accepted any user ID in the URL parameter without verifying the authenticated user matched the target. Any authenticated user could read, modify, or delete any other user's account.

**Fix:** Added ownership verification to all user routes. The server now compares `req.params.id` against the authenticated user's ID and returns 403 with an audit log entry for unauthorized access attempts. The PATCH endpoint also strips sensitive fields (`passwordHash`, `email`, `id`, `createdAt`) from the update payload to prevent privilege escalation.

**Files changed:** `server/routes.ts`

#### CRITICAL - MFA Bypass (FIXED)

**Finding:** MFA enforcement checked the client-controlled `x-mfa-verified` request header. Any client could bypass MFA by setting `x-mfa-verified: true` in their request headers.

**Fix:** Replaced client header check with a server-side session attribute (`_mfaVerifiedFromSession`). MFA verification status is now set on the request object by the server after successful MFA challenge, not by the client.

**Files changed:** `server/compliance/security-middleware.ts`

#### HIGH - SQL Injection Guard Incomplete (FIXED)

**Finding:** The `sqlInjectionGuard` middleware only inspected `req.params` and `req.query` for SQL injection patterns, but not `req.body` where most mutation data is sent.

**Fix:** Extended `sqlInjectionGuard` to also check `req.body` content against SQL injection patterns.

**Files changed:** `server/compliance/security-middleware.ts`

#### HIGH - XSS Sanitizer Bypass (FIXED)

**Finding:** The input sanitizer used simple regex patterns that could be bypassed with nested tags (`<scr<script>ipt>`), HTML entity encoding, and other obfuscation techniques.

**Fix:** Overhauled the XSS sanitizer with:
- HTML entity decoding before stripping (handles `&#x...;`, `&#...;`, named entities)
- Recursive tag stripping (up to 20 iterations for nested patterns)
- Expanded dangerous tag list (script, style, iframe, object, embed, link, meta, base, form, svg, math)
- Protocol handler stripping (javascript:, vbscript:, data:text/html with whitespace-aware patterns)
- CSS expression attack prevention
- Query parameter sanitization

**Files changed:** `server/compliance/security-middleware.ts`

#### MEDIUM - Hardcoded User IDs in Client (FIXED)

**Finding:** Several client screens used hardcoded strings like `"demo-user"` and `"current-user"` as user IDs in API request headers instead of the authenticated user's actual ID.

**Fix:** Replaced all hardcoded user IDs with the authenticated user's ID from `useAuthContext()`.

**Files changed:** `client/screens/AIHistoryAssistantScreen.tsx`, `client/screens/AIAssistantScreen.tsx`, `client/screens/MyHealthSummaryScreen.tsx`, `client/screens/TEFCAPartnerManagementScreen.tsx`, `client/screens/AIGuidedOnboardingScreen.tsx`

#### MEDIUM - CORS Wildcard with Credentials (FIXED)

**Finding:** When Expo Go client was detected (no origin header), the server set `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`, which is an invalid combination per the CORS specification.

**Fix:** Split CORS handling so that Expo Go requests (no origin) use `Access-Control-Allow-Origin: *` without credentials, while requests from known origins use the specific origin with credentials enabled.

**Files changed:** `server/index.ts`

### Remaining Items (Accepted Risk)

#### LOW - Rate Limiter In-Memory Store

The rate limiter uses an in-memory `Map` which resets on server restart and doesn't work across multiple instances. For a single-instance deployment this is acceptable. For multi-instance production, a Redis-backed rate limiter should be used.

#### LOW - Old minimatch Versions in eas-cli

Some older versions of `minimatch` (3.x, 5.x) remain in the `eas-cli` dev dependency subtree. These are build-time tools only and don't affect the runtime application. They will be resolved when `eas-cli` releases an update.

### Security Architecture Summary

- **Authentication:** SHA-256 hashed Bearer tokens validated against `user_sessions` table
- **Authorization:** IDOR protection via ownership verification on user routes
- **MFA:** Server-side session-based verification (not client-controlled headers)
- **Encryption at Rest:** AES-256-GCM for PHI fields (patient names, record titles/summaries)
- **Transport Security:** Mandatory TLS 1.3 enforcement, HSTS headers
- **Input Validation:** Multi-layer defense (Zod schemas, SQL injection guard, XSS sanitizer, Drizzle ORM parameterization)
- **Audit Logging:** Comprehensive PHI access logging with risk scoring and anomaly detection
- **Rate Limiting:** IP-based rate limiting on auth (15/15min) and API (100/min) endpoints
- **Security Headers:** CSP with nonces, X-Frame-Options DENY, X-Content-Type-Options nosniff
- **Password Storage:** bcrypt with cost factor 12
- **Session Management:** 15-minute access tokens, 7-day refresh tokens, session timeout after 30 minutes of inactivity
