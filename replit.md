# Tabula Medica

Tabula Medica is a PWA that centralizes and simplifies patient health records from various EHR platforms, providing a unified, compliant, and patient-friendly view of health data with AI-powered interactions.

## Run & Operate

*   **Install Dependencies**: `npm install`
*   **Run Development Server**: `npm run dev`
*   **Build**: `npm run build`
*   **Typecheck**: `npm run typecheck`
*   **Codegen (Drizzle)**: `npm run generate`
*   **DB Push (Drizzle)**: `npm run db:push`
*   **Required Env Vars**: `RESEND_API_KEY`, `NETWORK_ALERT_EMAIL`, `RESEND_FROM_EMAIL` (for email alerts and MFA security notifications — without `RESEND_API_KEY` no MFA confirmation email is sent, and `GET /api/auth/mfa/status` reports `securityEmailConfigured: false`); optional `APP_PUBLIC_URL` and `SUPPORT_EMAIL` for the links in those emails; GCP credentials for Secret Manager fallback; `AI_DEFAULT_PROVIDER=vertex` (defaults to OpenAI fallback if unset — OpenAI standard tier has **no BAA** and must not touch PHI; Vertex AI runs under the existing GCP BAA and is the HIPAA-compliant default).

## Stack

*   **Frontend**: React, TypeScript, Wouter (routing), TanStack Query (server state), Shadcn/ui, Radix primitives, Tailwind CSS.
*   **Backend**: Express.js, TypeScript, Drizzle ORM (for schema and migrations), in-memory storage.
*   **Mobile**: Expo React Native (for native apps), Capacitor (web app wrapper).
*   **Database**: SQLite (development), PostgreSQL (production via Drizzle ORM).
*   **Validation**: Zod.
*   **Build Tool**: Vite.
*   **Runtime**: Node.js (latest LTS).

## Where things live

*   **Web Application**: `client/`
*   **Backend API**: `server/`
*   **Mobile Application**: `tabula-medica-mobile/`
*   **Shared Utilities/Types**: `shared/`
*   **Database Schema**: `server/db/schema.ts`
*   **API Contracts**: Defined implicitly by `server/routes/*`
*   **UI Components**: `client/src/components/`
*   **Unified Health Summary Panel**: `client/src/components/unified-summary-panel.tsx`
*   **Strategic Planning Docs**: `docs/`
*   **Security Policy**: `client/public/.well-known/security.txt`

## Architecture decisions

*   **Monorepo Strategy**: Unifies web, mobile, and Capacitor code to simplify development and deployment workflows.
*   **Mobile-First PWA**: Designed for touch interaction and installability, ensuring a consistent experience across devices.
*   **FHIR R4 + SMART on FHIR**: Chosen for secure, standardized EHR connectivity and interoperability.
*   **AI-Driven Functionality**: Central to the user experience, providing medical explanations, summaries, and multilingual interaction.
*   **GCP Secret Manager Fallback**: Implements a robust fallback to Replit secrets on GCP authentication failure to prevent logging floods and ensure service continuity.
*   **Region-based Feature Gating**: Allows for different functionalities for US and International users based on regulatory and market needs.

## Product

*   **Unified Health Records**: Aggregates and simplifies patient data from various EHRs.
*   **AI-Powered Health Assistant**: Provides medical term explanations, document summaries, and multilingual voice access.
*   **Patient Portal**: Features an AI Health Summary, engagement hub, and personalized education content.
*   **Symptom Checker**: Guides users through a triage process with AI-backed urgency assessment.
*   **Secure & Compliant**: Implements layered security (HIPAA, SOC 2, HITRUST) and granular access controls.
*   **Telehealth Integration**: Supports video consultations.
*   **FHIR R4 API**: Provides USCDI V3 compliant endpoints for external data exchange.
*   **Document Extraction Pipeline**: Processes medical documents with multi-model AI extraction and human-in-the-loop validation.
*   **Financial Tools**: Includes insurance learning, drug savings, and uninsured discount platforms.
*   **Internationalization**: Supports 19 UI languages and over 50 voice/AI languages.

## User preferences

*   I prefer clear and concise communication.
*   I appreciate detailed explanations when technical topics are discussed.
*   I prefer to be asked before any major changes are made to the codebase.
*   I expect iterative development with regular updates.
*   I prefer functional programming paradigms where applicable.

## Gotchas

*   **Dependency security overrides**: The `package.json` `overrides` block pins transitive dependencies to mitigate `npm audit` vulnerabilities. Always re-run `npm audit` and add new overrides after bumping dependencies or adding new ones. Confirm all consumers have upgraded before removing an override.
*   **Public Page Routing**: New public-facing pages must be explicitly added to `publicClinicalRoutes`, `publicLegalRoutes`, or `publicAuthRoutes` in `client/src/App.tsx` or they will silently render the `LandingPage` for logged-out users.
*   **Operational Email PHI**: Email content for operational alerts (via Resend or SMTP) MUST remain PHI-free, even though Resend is BAA-eligible.

## Pointers

*   **Auth0 Documentation**: For authentication and SSO configurations.
*   **FHIR R4 Specification**: For details on healthcare data interoperability standards.
*   **Drizzle ORM Documentation**: For database schema definition, migrations, and queries.
*   **React, TypeScript, Vite, Tailwind CSS Documentation**: For core frontend development guidance.
*   **OpenAI API Documentation**: For AI model integration details.
*   **WCAG 2.1 Guidelines**: For accessibility standards.
*   **HIPAA, SOC 2, HITRUST Compliance Frameworks**: For security and compliance requirements.
*   **GCP Healthcare API Documentation**: For integration with Google Cloud Platform healthcare services.