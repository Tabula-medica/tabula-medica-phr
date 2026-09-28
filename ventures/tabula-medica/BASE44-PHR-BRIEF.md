# Tabula Medica PHR — Base44 Vibe-Coding Brief

> **Version:** 2026-09-27  
> **Purpose:** Feed this entire file to Base44 at the start of any vibe-coding session. It defines what Base44 owns (UI + marketing), what it never touches (PHI + clinical logic), and the exact API surface it calls.

---

## 1. Product Identity

**App name:** Tabula Medica PHR  
**Tagline:** *Your health story, owned by you.*  
**Elevator pitch:** A HIPAA-compliant personal health record that lets patients collect records from any provider, see their full medical timeline, and share securely with their care team — on mobile and web, free.

### Domains
| Surface | Domain | Notes |
|---------|--------|-------|
| Marketing / master brand | `tabulamedica.com` | Public, no login required |
| US PHR app (TEFCA-enabled) | `tabulamedica.us` | Logged-in patients |
| Global PHR app (no TEFCA) | `tabulamedica.world` | Logged-in patients |
| Patient portal | `my.tabulamedica.com` | Redirect to `.us` or `.world` |
| iOS app | App Store 6758421617 | Native Expo RN, v65.1 |

### Brand tokens
| Token | Value |
|-------|-------|
| Primary navy | `#0A1628` |
| Accent teal | `#0891b2` |
| Accent green | `#2FAE7E` |
| Cream / bg | `#F7F4EC` |
| White | `#FFFFFF` |
| Font (heading) | `Inter`, 700 |
| Font (body) | `Inter`, 400 |
| Border radius | `12px` (cards), `8px` (inputs), `24px` (pill buttons) |
| Shadow | `0 2px 12px rgba(10,22,40,.08)` |

---

## 2. Architecture Boundary — READ THIS FIRST

```
┌─────────────────────────────────────────────────┐
│  BASE44 ZONE  (what you build here)              │
│                                                   │
│  • Marketing pages (tabulamedica.com)             │
│  • UI shell: nav, layouts, loading states         │
│  • Non-PHI forms: contact, waitlist, newsletter   │
│  • App screens: timeline view, settings, profile  │
│    — rendered from JSON returned by GCP API       │
│  • Auth redirect triggers (launch GCIP browser)   │
│  • Subscription / pricing UI (no payment logic)   │
│                                                   │
│  Base44 backend / DB:  UI STATE ONLY              │
│    → session token (opaque string, no PHI inside) │
│    → theme preference, notification flags         │
│    → waitlist signups (name + email, no clinical) │
└────────────────┬────────────────────────────────-┘
                 │  HTTPS proxy calls only
                 │  Bearer: {gcip_id_token}
                 ▼
┌─────────────────────────────────────────────────┐
│  GCP ZONE  (Tabula Medica backend — NOT here)    │
│                                                   │
│  • All PHI: clinical records, labs, vitals, Dx   │
│  • GCIP authentication (Identity Platform)        │
│  • Cloud SQL: patient DB                          │
│  • Vertex AI: clinical summaries (PHI via GCP)   │
│  • TEFCA / Carequality / Blue Button connections  │
│  • FHIR resources, ICD codes, medications        │
└─────────────────────────────────────────────────┘
```

### Hard rules for Base44 AI / vibe coding
1. **Never store PHI in Base44 entities.** No diagnosis, medication, lab value, provider name, visit note, or date-of-service in any Base44 table.
2. **Never call an AI model with PHI.** All AI calls that touch clinical data route through GCP Vertex — never through Base44's `InvokeLLM` or any other direct LLM call.
3. **Never build authentication logic.** Auth is GCIP. Base44 launches the system browser to the GCIP sign-in URL; the ID token comes back via deep link. Store the opaque Bearer string, nothing else.
4. **Never hardcode patient data for demo.** Demo/guest mode data comes from `GET /api/mobile/demo` on GCP.
5. **Every API call that touches health data passes the Bearer token** from the GCIP session. If 401, clear local session and prompt re-login.

---

## 3. GCP API Contract (Base44 calls these)

**Base URL:** `https://api.tabulamedica.us` (US) / `https://api.tabulamedica.world` (global)  
**Auth header:** `Authorization: Bearer {gcip_id_token}` + `X-Requested-With: XMLHttpRequest`

### 3.1 Auth endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/mobile/auth/gcip/session` | Exchange GCIP ID token → server session. Body: `{}`. Returns `{id, email, role, needsOnboarding}`. |
| DELETE | `/api/mobile/auth/session` | Sign out (invalidate server session). |
| GET | `/api/me` | Current user profile (non-PHI: `{id, email, displayName, avatarUrl, planTier}`). |

### 3.2 Records & Timeline (read-only display)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/records/summary` | Summary counts: `{totalRecords, sources, lastUpdated, alertCount}`. No clinical content. |
| GET | `/api/records/timeline` | Paginated timeline events. Returns `{events: [{id, date, type, title, sourceOrg, iconKey}], cursor}`. **`title` is display text, not raw clinical data.** |
| GET | `/api/records/timeline/:id` | Detail for one timeline event. Returns rendered HTML snippet for display only. |
| GET | `/api/records/sources` | Connected data sources: `{id, name, logoUrl, status, lastSync}[]`. |
| POST | `/api/records/sources/connect` | Start a new source connection (returns OAuth redirect URL). |

### 3.3 Sharing
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sharing/links` | Create a time-limited share link. Body: `{expiresIn, scope}`. Returns `{shareUrl, expiresAt}`. |
| GET | `/api/sharing/links` | List active share links. |
| DELETE | `/api/sharing/links/:id` | Revoke a share link. |

### 3.4 Notifications & Alerts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | Non-PHI notification list: `{id, title, body, read, createdAt}[]`. |
| PATCH | `/api/notifications/:id` | Mark as read. |

### 3.5 Subscription
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/subscription/status` | `{tier, validUntil, receiptVerified}`. |
| POST | `/api/subscription/verify` | Submit App Store / Play receipt for verification. |

### 3.6 Demo (no auth required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mobile/demo` | Sample timeline + summary for guest/reviewer mode. No PHI. |

### 3.7 Marketing / waitlist (public, no auth)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/public/waitlist` | `{email, firstName, useCase}` → added to waitlist. |
| POST | `/api/public/contact` | `{name, email, message}` → contact form submission. |

---

## 4. GCIP Auth Flow

Base44 should implement this exact flow — no variation:

```
1. User taps "Sign In" or "Create Account"
2. Base44 constructs the GCIP sign-in URL:
   https://identitytoolkit.googleapis.com/...
   OR the hosted UI at:
   https://united-planet-485003-n7-9f345.firebaseapp.com/__/auth/handler
   with redirect_uri = deep link back to the app

3. Launch URL in SYSTEM browser (not WebView / in-app browser)
   — React Native: Linking.openURL() or expo-auth-session
   — Web: window.location = url

4. User authenticates (email/password, Google, etc.)

5. GCIP redirects back with ?idToken=... (deep link / callback)

6. App calls POST /api/mobile/auth/gcip/session with Bearer idToken
   Header: Authorization: Bearer {idToken}
   Header: X-Requested-With: XMLHttpRequest
   Body: {}

7. On 200 response → store session (opaque server session ID, no PHI)
   On 401/403 → show error, do not retry automatically

8. All subsequent API calls use the same Bearer idToken
   Refresh: when idToken expires (1hr), call GCIP refresh token endpoint
   (handled by Firebase SDK or manual refresh token grant)
```

**Demo account** (for App Store review): `appreview@tabulamedica.us` / `AppReview!2026`

---

## 5. Pages to Build

### 5A. Marketing Site — `tabulamedica.com`

These pages are public, zero PHI, full SEO. Build them as a fast static site.

#### 5A.1 Home `/`
- Hero: "Your health story, owned by you." + CTA "Get the free app" + "Learn more"
- Feature grid (3 cols): Connect any provider · Full timeline · Share securely
- Social proof strip: "65,000+ patients trust Tabula"
- How it works: 3 steps (Connect → See your history → Share with your doctor)
- App store badges: App Store + Google Play (link to store pages)
- Final CTA: waitlist email capture
- Footer: Privacy · Terms · © 2026 Tabula Medica LLC

#### 5A.2 Features `/features`
- Deep dive on each feature with screenshots/mockups
- Timeline view · Source connections · AI summary · Sharing · Mobile + web
- Comparison table: Free vs Pro tiers

#### 5A.3 Security & Privacy `/security`
- HIPAA compliance badge section
- GCP / SOC 2 overview (no specifics that need legal review)
- PHI-on-GCP diagram (simplified architecture)
- "We never sell your data" plain-language pledge

#### 5A.4 Pricing `/pricing`
- Free tier: unlimited records, 5 source connections
- Pro ($9.99/yr): unlimited sources, AI summaries, priority support, share links
- FAQ accordion
- Both tiers CTA → app store

#### 5A.5 About `/about`
- Mission statement
- Team (placeholder — fill in later)
- Backed by / built on GCP + HIPAA

#### 5A.6 Contact `/contact`
- Form: name, email, message → POST `/api/public/contact`
- For providers / partnerships / press sections

#### 5A.7 Blog `/blog`
- Static blog index + post template
- First 3 posts: "What is a PHR?", "HIPAA and you", "Connecting your records"

#### 5A.8 Legal
- `/privacy` — Privacy Policy (placeholder, Trevor-gated)
- `/terms` — Terms of Service (placeholder, Trevor-gated)

---

### 5B. App UI Shell — `tabulamedica.us` / `tabulamedica.world`

These screens render data returned by the GCP API. Base44 handles layout, navigation, loading states, and empty states — NOT the clinical content itself.

#### 5B.1 Onboarding flow (pre-auth)
- Splash: animated Tabula logo + tagline
- Screen 1: "What is Tabula?" — 3 feature cards, swipe
- Screen 2: "Connect once, see everything" — source logos grid
- Screen 3: CTA — "Sign in" / "Create account" / "Explore without account"

#### 5B.2 Guest / Demo mode
- Shows sample timeline from `GET /api/mobile/demo`
- Banner: "You're in demo mode — Sign in to see your real records"
- All interaction prompts → sign-in

#### 5B.3 Dashboard (post-login home)
- Greeting: "Hello, {displayName}"
- Summary cards: Total Records · Connected Sources · Alerts
- Quick actions: + Connect Source · Share · View Timeline
- Recent events (last 5 from timeline, title + date + iconKey only)

#### 5B.4 Timeline `/timeline`
- Infinite scroll list grouped by year/month
- Each event: date chip · icon (by `iconKey`) · `title` · `sourceOrg`
- Tap → detail sheet (renders HTML snippet from GCP, read-only iframe-like)
- Filter bar: type (Lab / Imaging / Visit / Medication / Immunization / Other)
- Search bar → filters displayed events client-side by title

#### 5B.5 Sources `/sources`
- List of connected sources with logo, name, status badge, last sync time
- "+ Connect a source" → launches GCP OAuth redirect
- Empty state: "No sources connected yet — add your first provider"

#### 5B.6 Share `/share`
- Active share links list (from `/api/sharing/links`)
- Create new link: select scope (full / recent 90 days) + expiry (24h / 7d / 30d)
- Shows shareable URL with copy button + QR code
- Revoke button per link

#### 5B.7 Notifications `/notifications`
- List of non-PHI notifications: title, body, timestamp, unread dot
- Tap → mark read

#### 5B.8 Profile & Settings `/settings`
- Display name, avatar upload (to GCP, not Base44)
- Subscription status badge + "Upgrade" CTA
- Notification preferences (local toggle state synced to GCP)
- Legal: Privacy Policy · Terms of Service (link out)
- Sign out

#### 5B.9 Subscription `/subscription`
- Current plan display
- Upgrade card: Pro $9.99/yr — feature list
- "Upgrade" → App Store In-App Purchase (native) or Stripe (web)
- Receipt verification → POST `/api/subscription/verify`

#### 5B.10 Error / Auth states
- 401 expired session: "Your session expired. Tap to sign back in." → restart GCIP flow
- Offline: banner "You're offline — showing cached data"
- Empty timeline: illustration + "Connect your first provider to see your records"

---

## 6. Non-PHI Base44 Data Models (UI state only)

These are the ONLY entities Base44 should store in its database:

```
WaitlistEntry {
  id: uuid
  email: string (unique)
  firstName: string
  useCase: string
  createdAt: datetime
  source: string  // 'home_hero' | 'pricing' | 'blog_cta'
}

ContactSubmission {
  id: uuid
  name: string
  email: string
  message: string
  createdAt: datetime
  status: 'new' | 'replied'
}

UISession {
  id: uuid
  gcipIdToken: string  // opaque, no PII decoded here
  displayName: string
  avatarUrl: string
  planTier: 'free' | 'pro'
  createdAt: datetime
  expiresAt: datetime
}

UserPreference {
  sessionId: uuid (FK UISession)
  theme: 'light' | 'dark' | 'system'
  notificationsEnabled: boolean
  marketingEmails: boolean
}
```

**No other entities.** Any screen that needs health data fetches it from GCP at render time.

---

## 7. Component Library

Build these reusable components before screens:

| Component | Props | Notes |
|-----------|-------|-------|
| `<TabulaButton>` | variant (primary/secondary/ghost), size, loading | Navy primary, teal outline secondary |
| `<TabulaCard>` | title, subtitle, iconKey, badge | Cream bg, navy border |
| `<TimelineEvent>` | date, iconKey, title, sourceOrg, onTap | Left-line chronological layout |
| `<SourceBadge>` | name, logoUrl, status | status = connected/pending/error |
| `<ShareLink>` | url, expiresAt, scope, onRevoke | Shows QR + copy button |
| `<AlertBanner>` | variant (info/warn/error), message, onDismiss | Teal info, amber warn, red error |
| `<AppStoreBadge>` | store (ios/android) | Links to real store pages |
| `<SectionHero>` | headline, sub, ctaLabel, ctaHref, imgSrc | Home page hero pattern |
| `<PricingCard>` | tier, price, features[], isPopular, ctaLabel | Pro has navy border accent |
| `<EmptyState>` | illustration, title, body, ctaLabel, ctaHref | Used throughout app shell |

---

## 8. Routing

### Marketing site (`tabulamedica.com`)
```
/                → Home
/features        → Features
/security        → Security & Privacy
/pricing         → Pricing
/about           → About
/blog            → Blog index
/blog/:slug      → Blog post
/contact         → Contact
/privacy         → Privacy Policy
/terms           → Terms of Service
```

### App (`tabulamedica.us` / `tabulamedica.world`)
```
/                → Onboarding (if no session) or Dashboard
/demo            → Guest demo mode
/dashboard       → Post-login home
/timeline        → Full timeline
/timeline/:id    → Event detail (renders GCP HTML)
/sources         → Connected sources
/sources/connect → Start source connection
/share           → Share links
/notifications   → Notifications
/settings        → Profile & settings
/subscription    → Subscription management
/auth/callback   → GCIP callback (exchange token)
/auth/signout    → Clear session → /
```

---

## 9. Integration Pattern — How Base44 calls GCP

Use a single API client helper. All health-data calls go through this, never direct fetch:

```javascript
// base44 api client pattern (pseudo-code for Base44 to implement)

const GCP_BASE = "https://api.tabulamedica.us"; // or .world based on host

async function gcpFetch(path, options = {}) {
  const session = await getLocalSession(); // from UISession entity
  const resp = await fetch(GCP_BASE + path, {
    ...options,
    headers: {
      "Authorization": `Bearer ${session.gcipIdToken}`,
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (resp.status === 401) {
    clearLocalSession();
    redirectToSignIn();
    return null;
  }
  return resp.json();
}
```

Never inline fetch calls in components. Always use `gcpFetch`.

---

## 10. What NOT to Build in Base44

| Temptation | Why not |
|------------|---------|
| Clinical AI summaries | PHI → Vertex on GCP only |
| Store labs / vitals / Dx | PHI stays in Cloud SQL |
| ICD/CPT code lookup | Clinical logic on GCP |
| FHIR resource editor | Clinical layer on GCP |
| Payment processing | Stripe webhooks on GCP backend |
| Provider directory | Separate uninsurance.care product |
| GCIP user management | Firebase console + GCP |
| CDS (clinical decision support) | Gated on counsel, lives on GCP |
| Push notification delivery | GCP → FCM/APNs pipeline |
| Audit logs | HIPAA audit trail on GCP Cloud Logging |

---

## 11. Mobile Parity Notes

The iOS native app (`repos/tabula-phr-app`, Expo SDK 57, v65.1) uses the exact same GCP API. Any new endpoints added to this brief must be added to both the web Base44 UI and the native app's `src/lib/api.js`.

App Store listing: ASC App ID `6758421617`, bundle `app.replit.tabulamedica`, EAS project `b7759aff-1d26-4892-85f2-c70ed2ae8827`.

Android: Google Play — same API, Play Console under `rajivka2`.

---

## 12. Session Kickoff Prompt

When starting a new Base44 vibe-coding session, paste this as the first message:

> "I'm building the **Tabula Medica PHR** — a HIPAA-compliant personal health record. Load the brief in this file for full context. For this session, focus on: [NAME SPECIFIC PAGES/SCREENS]. Remember: PHI lives on GCP, Base44 owns UI + marketing only. Never store clinical data in Base44 entities. Use the gcpFetch pattern for all health-data API calls. Use brand tokens: navy `#0A1628`, teal `#0891b2`, green `#2FAE7E`, cream `#F7F4EC`."

Then name exactly what you want built.

---

*End of brief. Keep this file updated as the product evolves. PHI policy is immutable.*
