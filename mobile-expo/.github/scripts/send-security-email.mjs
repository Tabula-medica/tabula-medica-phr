#!/usr/bin/env node
// Sends a security CVE alert email via SendGrid.
//
// Invoked from .github/workflows/security-alerts.yml only when a NEW
// tracking issue is opened (see `steps.issue.outputs.created`), so dedup
// matches the GitHub-issue dedup: one email per CVE batch until the
// tracking issue is closed (i.e. the CVE is fixed) and a fresh scan
// reopens it.
//
// Required env (all provided by the workflow):
//   SENDGRID_API_KEY            SendGrid API key with `mail.send` scope.
//   SECURITY_ALERT_EMAIL_TO     Comma-separated list of recipients
//                               (e.g. security-oncall@tabulamedica.health).
//   SECURITY_ALERT_EMAIL_FROM   Verified sender (defaults to
//                               security-alerts@tabulamedica.health).
//   ISSUE_URL, ISSUE_TITLE      Tracking issue created by the workflow.
//   RUN_URL, COMMIT_SHA         Workflow context for the email body.
//   CRITICAL, HIGH              CVE counts for the body.
//
// CLI flags:
//   --subject <str>             Email subject line.
//   --advisories <file>         Plain-text advisory list to include.
//   --kind <npm|container>      Used to phrase the body's source line.

import fs from 'node:fs';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : '';
}

const subject = arg('--subject') || '[security] new high/critical CVEs on main';
const advisoriesPath = arg('--advisories') || '';
const kind = arg('--kind') || 'npm';

const {
  SENDGRID_API_KEY,
  SECURITY_ALERT_EMAIL_TO,
  SECURITY_ALERT_EMAIL_FROM,
  ISSUE_URL = '',
  ISSUE_TITLE = '',
  RUN_URL = '',
  COMMIT_SHA = '',
  CRITICAL = '0',
  HIGH = '0',
} = process.env;

if (!SENDGRID_API_KEY || !SECURITY_ALERT_EMAIL_TO) {
  console.log('[send-security-email] SENDGRID_API_KEY or SECURITY_ALERT_EMAIL_TO missing; skipping email send.');
  process.exit(0);
}

const fromEmail = SECURITY_ALERT_EMAIL_FROM || 'security-alerts@tabulamedica.health';
const recipients = SECURITY_ALERT_EMAIL_TO.split(',').map((s) => s.trim()).filter(Boolean);

const advisories = advisoriesPath && fs.existsSync(advisoriesPath)
  ? fs.readFileSync(advisoriesPath, 'utf8').trim()
  : '(advisory list unavailable)';

const sourceLine = kind === 'container'
  ? 'Daily Trivy scan of the production `Dockerfile`'
  : 'Daily `npm audit --omit=dev`';

const textBody = [
  `${sourceLine} on commit ${COMMIT_SHA} detected new high/critical CVEs:`,
  '',
  `  Critical: ${CRITICAL}`,
  `  High:     ${HIGH}`,
  '',
  `Tracking issue: ${ISSUE_TITLE}`,
  `  ${ISSUE_URL}`,
  '',
  `Workflow run:  ${RUN_URL}`,
  '',
  'High/Critical advisories:',
  advisories,
  '',
  'This email fires once per CVE batch when the tracking issue is first',
  'opened. Close the issue once the offending packages are upgraded;',
  'the next scheduled scan will reopen it (and resend this email) if',
  'high/critical CVEs remain.',
].join('\n');

const escape = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const htmlBody = `
<p><strong>${escape(sourceLine)}</strong> on commit <code>${escape(COMMIT_SHA)}</code> detected new high/critical CVEs:</p>
<ul>
  <li>Critical: <strong>${escape(CRITICAL)}</strong></li>
  <li>High: <strong>${escape(HIGH)}</strong></li>
</ul>
<p>Tracking issue: <a href="${escape(ISSUE_URL)}">${escape(ISSUE_TITLE)}</a><br/>
Workflow run: <a href="${escape(RUN_URL)}">${escape(RUN_URL)}</a></p>
<h3>High/Critical advisories</h3>
<pre>${escape(advisories)}</pre>
<p><em>This email fires once per CVE batch when the tracking issue is first opened. Close the issue once the offending packages are upgraded; the next scheduled scan will reopen it (and resend this email) if high/critical CVEs remain.</em></p>
`.trim();

const payload = {
  personalizations: [{ to: recipients.map((email) => ({ email })) }],
  from: { email: fromEmail, name: 'Tabula Medica Security Alerts' },
  subject,
  content: [
    { type: 'text/plain', value: textBody },
    { type: 'text/html', value: htmlBody },
  ],
};

const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${SENDGRID_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

if (!res.ok) {
  const errBody = await res.text().catch(() => '');
  console.error(`[send-security-email] SendGrid responded ${res.status}: ${errBody}`);
  process.exit(1);
}

console.log(`[send-security-email] Sent ${kind} CVE alert to ${recipients.join(', ')} (status ${res.status}).`);
