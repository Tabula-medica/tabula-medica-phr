# Health Radio (healonda.com) — Rebuild Spec

**Status:** Draft for review. Not approved, not started.
**Author:** Claude Code session `claude/universal-health-radio-app-3rigk6`
**Date:** 2026-08-17

---

## 1. Why the app is down

| Fact | Value |
| --- | --- |
| Where it lived | Replit app `@rajivka4/Health-Radio` |
| Published domain | `healonda.com` |
| Replit deployment ID | `0fa6e83e-897f-49f2-9ec6-96435f691935` |
| Deployment status | **`suspended`** — serving no traffic |
| Last updated | 2026-07-19 |
| Replit account | **No longer held** |

The app is not broken in the sense of having a bug. Its only host was a Replit
deployment, that deployment is suspended, and the Replit account is gone. The
suspension is therefore permanent and the source code is unrecoverable through
any channel available to us.

**There is no copy in this repository.** A full-tree search of
`tabula-medica-phr` for `healonda` and every variant of "health radio" returns
zero matches across code, docs, and `.local/deliverables`. Every `radio` hit in
the repo is either `radiology` or Radix's `react-radio-group`. The branch
`claude/universal-health-radio-app-3rigk6` sits at `origin/main` with no commits.

**Conclusion:** rebuilding from scratch is the only path. This document scopes
that rebuild.

---

## 2. Open questions — these block the build

I never saw the original application. Everything in §3 is inference from the
name and the domain. These questions need real answers before any code is
written, because different answers produce materially different products.

### Product

1. **What did Health Radio actually do?** Candidate readings, all consistent
   with the name:
   - a *directory* of third-party health/wellness radio streams and podcasts;
   - an *original programming* platform — your own recorded health shows;
   - a *live broadcast* tool letting clinicians stream to patients;
   - an *AI audio* product turning health content into listenable segments.
2. **What does "universal" mean?** Global station coverage? Multi-language?
   Cross-platform (web + iOS + Android)? Or "universal health" as in universal
   healthcare — a policy/advocacy angle?
3. **Who were the users, and was it free?** Public and anonymous, or
   account-gated? Any payments or subscriptions?
4. **Was there a backend?** Station lists, show metadata, user favourites,
   uploaded audio files — was any of that stored server-side, and is any of it
   worth trying to reconstruct?
5. **Relationship to Tabula Medica.** Independent consumer brand, or intended to
   feed into the PHR? This determines repo, deployment, and legal posture.
6. **Web only, or was there a mobile app?**

### Infrastructure — verify before planning further

7. **Do you still control the `healonda.com` domain?** This is the single most
   important question in this document. If the domain was registered *through*
   Replit rather than at an independent registrar, it may have been lost along
   with the account. Everything below assumes you hold the registrar login and
   can change DNS. **Please confirm this first** — if the domain is gone, the
   rebuild needs a new name and the scope changes.

---

## 3. Assumed product definition

> **ASSUMPTION — not verified.** Replace this section once §2 is answered.

Health Radio is a public, free, browser-based streaming audio app that
aggregates health and wellness radio stations and podcast programming into a
browsable directory, playable through a persistent in-page player. "Universal"
is read as *global coverage across regions and languages*.

Everything in §4–§6 follows from this assumption. If it is wrong, §4 is wrong.

---

## 4. Proposed v1 scope

**In scope**

- Station/show directory with metadata: name, description, language, region,
  topic tags, stream URL, artwork.
- Browse by category and language; text search across the directory.
- Persistent audio player that survives navigation — play/pause, volume,
  now-playing, buffering and error states.
- Favourites, stored client-side (`localStorage`) so v1 needs no accounts.
- Responsive layout, installable as a PWA.
- A `/health` endpoint (required by the deploy health gate — see §6).

**Explicitly out of scope for v1**

- User accounts, login, server-side profiles.
- Payments or subscriptions.
- Native iOS/Android builds.
- Live broadcasting or user audio uploads.
- Any integration with the PHR, and any handling of PHI whatsoever.

---

## 5. Architecture

Reuse the stack this org already runs and deploys successfully, rather than
introducing a new one:

- **Client** — React 18 + TypeScript, Vite, Tailwind, `wouter` for routing.
- **Server** — Express, bundled by esbuild to a single `dist/index.cjs`
  (the pattern in `script/build.ts`).
- **Container** — multi-stage `node:20-slim` Dockerfile, non-root user,
  `PORT=8080` (mirrors the existing `Dockerfile`).
- **Persistence** — none in v1. The directory ships as a versioned JSON/seed
  file. If persistence is needed later: Postgres + Drizzle, in **its own**
  database instance.

### Hard architectural rule

**Health Radio must not share a service or a database with the PHR.**

The `tabula-medica-phr` Cloud Run service carries a HIPAA/PHI posture: it
attaches the Cloud SQL PHI instance `tabula-medica-db`, enforces a strict CSP,
gates auth through GCIP/Firebase, and its `cloudbuild.yaml` runs medical-safety
and CDS-compliance checks on every deploy. A public consumer radio app has no
business inside that blast radius — it would inherit compliance obligations it
does not need and widen the attack surface of a system holding patient records.

**Recommendation: separate repository, separate Cloud Run service, same GCP
project.** Sharing the project keeps billing, IAM, and Secret Manager
consolidated without coupling the runtimes.

Note that this spec file currently lives in the PHR repo only because that is
the repository this session is scoped to. It should move to the new repo once
one exists.

---

## 6. Deployment plan

Grounded in the infrastructure this repo already uses.

| Setting | Value |
| --- | --- |
| GCP project | `united-planet-485003-n7` |
| Region | `us-central1` |
| New Cloud Run service | `health-radio` (new — do **not** reuse `tabula-medica-phr`) |
| Port | `8080` |
| Cloud SQL | **none attached** in v1 |
| Ingress / auth | `--ingress all --allow-unauthenticated` |
| Min instances | `0` — see cost note below |

**Promotion pattern.** Copy the discipline in `deploy.sh`: deploy a
`--no-traffic` candidate with a `candidate` tag, poll `GET /health` until it
returns 200, and only then run `gcloud run services update-traffic --to-latest`.
That repo learned the hard way that a plain `gcloud run deploy` on a
pinned-traffic service creates a revision serving 0% of traffic; the same trap
applies here.

**Cost note.** The PHR runs `--min-instances 1` to avoid cold starts on a
clinical app. A low-traffic consumer radio app should run `--min-instances 0` —
otherwise you pay for an always-warm instance serving nobody.

**Domain.** Create a Cloud Run domain mapping for `healonda.com` and
`www.healonda.com`, then update the registrar's DNS to Google's records. DNS
currently points at Replit and must be repointed. **Gated on question 7.**

**Secrets.** Via Secret Manager, as the PHR does. v1 should need none.

---

## 7. Risks

**Content licensing — highest risk.** Restreaming or aggregating third-party
radio streams is a real legal question, not a technical one. Only streams you
have the right to link or embed can ship. This needs resolving before build, not
after launch, and it may materially reshape §4 (e.g. toward original programming
or an explicitly link-out-only directory).

**Loss of the domain.** See question 7. Blocks the deployment plan entirely.

**Medical content liability.** Health audio content needs a clear disclaimer and
must not stray into clinical decision support. The PHR repo enforces NO-CDS
markers in CI for exactly this reason; the same discipline should carry over.

**Rebuilding blind.** Without knowing what the original did, a rebuild risks
producing a different product than the one that existed. §2 exists to close
that gap.

---

## 8. Milestones

| # | Milestone | Exit criteria |
| --- | --- | --- |
| M0 | Scope locked | §2 answered; §3 replaced with the real definition; licensing position settled |
| M1 | Skeleton deployed | New repo; Express+React skeleton; `/health` returns 200; live on Cloud Run at `healonda.com` |
| M2 | Core product | Directory, categories, search, working persistent player |
| M3 | Polish | Responsive pass, PWA install, error/empty/buffering states, favourites |
| M4 | Optional | Accounts, server-side favourites, native wrappers — only if wanted |

M0 is the current blocker. Nothing after it can start until §2 is answered.
