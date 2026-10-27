Medica Unified Record is a production-ready mobile solution by Tabula Medica LLC. It serves as a centralized, secure hub for healthcare data, providing patients and providers with instant access to critical medical history through a high-performance mobile interface.

🚀 Production Features
Live Unified Dashboard: Real-time synchronization of comprehensive health records.

Enterprise-Grade Security: Fully implemented privacy protocols and encrypted data handling for HIPAA-compliant standards.

Biometric Authentication: Secure, easy access via fingerprint or facial recognition.

Provider Portal Integration: Seamless data sharing and communication between clinical staff and patients.

🛠 Production Stack
Mobile Engine: React Native (Expo) – Optimized for iOS and Android.

Cloud Infrastructure: Google Cloud Run

API Layer: Secure RESTful endpoints (Express/TypeScript).

Database: Scalable, encrypted PostgreSQL storage.

📦 Deployment & Access
The Medica Unified Record is now live.

Web Portal: https://tabulamedica.health

Mobile: Available via Expo Go (scan QR code to access).

🛡 Security & Compliance
This application is built with a "Security First" architecture. We employ end-to-end encryption for all data in transit and at rest, ensuring that Tabula Medica LLC maintains the highest standards of medical data integrity.

📩 Contact & Support
We are committed to providing a reliable experience. If you encounter any issues or have questions regarding the Medica Unified Record, please reach out via the following channels:

Support Email: support@tabulamedica.health

Technical Issues: Please open an Issue on this repository.

General Inquiries: Visit our contact page at tabulamedica.health/contact

Security Vulnerabilities: To report a sensitive security concern, please email security@tabulamedica.health directly.

## Project export

From the project root, run:

```sh
bash scripts/export-project.sh
# Recommended for external recipients:
bash scripts/export-project.sh --safe-mode
```

Both commands produce `tabula-medica.zip` in the project root. Requires Bash,
`find`, and `zip`. Each successful run replaces the archive from scratch, so
previously included files cannot linger when switching to safe mode. A failed
export leaves the previous archive unchanged; do not share it as a new export.

The script maintains the exclusion list: all `*.p8`, `*.p12`,
`*.mobileprovision`, `credentials.json`, `appstore-api-key.p8`, and `.env*`
files are excluded at every depth, as are `deploy.sh`, other common private
key/service-account files, existing ZIPs, Git history, local agent/session
metadata, dependencies, build outputs, uploads, and logs. Symlinks are omitted.
Common tool credential files (including `.npmrc`, `.netrc`, `.pypirc`, and
`.git-credentials`) and private configuration directories (`.ssh/`, `.aws/`,
`.azure/`, `.gnupg/`, `.kube/`, and `.docker/`) are excluded in both modes.
Safe mode additionally omits every `attached_assets/` directory, including
chat logs that may contain reviewer passwords.

This is a filename-based safeguard, not a secret scanner. Normal mode retains
attachments; safe mode does not guarantee that arbitrary source files or other
documents are free of secrets or patient data. Review the archive before sharing.
This script does not change Replit's built-in download/export behavior.

🧪 Running Tests Locally

Before pushing, run the same checks CI will enforce:

- `npm test` — runs the Jest suite (client + upgrade-prompt flows). Configured by `jest.config.js` / `jest.setup.js`. This is a required CI step on every pull request and push to `main`, and a deploy gate for Cloud Run — failing tests block the build and the deploy.
- `npm run test:server` — runs the server-side regression tests (auth + AI-policy guardrails) under `server/__tests__/`.
- `npm run check:types` — TypeScript type-check.
- `npm run lint` — Expo lint.

🔁 Post-Deploy Smoke Test (run after every backend publish)

After every production publish of the backend, run the auth-flow smoke test
to catch sign-in regressions BEFORE the App Store reviewer does. The script
verifies the four checks the reviewer's flow depends on: `/api/health`
reports the database as connected, the reviewer's email/password login
succeeds (both with the exact credentials and with whitespace + mixed-case
email, which guards the email-normalization fix from build 63), and the
Sign in with Apple endpoint rejects a bogus token with the
`APPLE_IDENTITY_TOKEN_INVALID` error code.

Run it locally:

```
REVIEWER_EMAIL='appreview@tabulamedica.health' \
REVIEWER_PASSWORD='<password from .local/reviewer-reply-build23.md>' \
node scripts/post-deploy-smoke.mjs
```

Or trigger it from GitHub: Actions → "Post-Deploy Smoke (Production)" →
Run workflow. The job uses the `REVIEWER_EMAIL` and `REVIEWER_PASSWORD`
repo secrets and exits non-zero on any failure.
