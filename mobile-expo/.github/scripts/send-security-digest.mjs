#!/usr/bin/env node
// Sends a weekly digest of unresolved security alerts via SendGrid.
//
// Invoked from the `weekly-digest` job in
// `.github/workflows/security-alerts.yml`. Complements the per-detection
// emails sent by `send-security-email.mjs`: those page on-call only on
// first detection of a new CVE batch (mirroring the GitHub-issue dedup),
// which keeps the inbox quiet but means a CVE that sits open for weeks
// goes silent after day 1. This digest fires on a weekly schedule and
// lists every currently-open tracking issue labelled `security,automated`
// so unresolved CVEs stay visible without reintroducing daily noise.
//
// Required env (all provided by the workflow):
//   SENDGRID_API_KEY            SendGrid API key with `mail.send` scope.
//   SECURITY_ALERT_EMAIL_TO     Comma-separated list of recipients.
//   SECURITY_ALERT_EMAIL_FROM   Verified sender (defaults to
//                               security-alerts@tabulamedica.health).
//   ISSUES_JSON                 Path to a JSON file containing the open
//                               issues to summarise. Each entry must
//                               carry { number, title, html_url,
//                               created_at, updated_at, last_comment_at? }.
//   RUN_URL                     Workflow run URL (for the footer).
//   REPO_URL                    Repo URL (for the "all open alerts" link).
//
// Skips silently (exit 0, no error) when SENDGRID_API_KEY or
// SECURITY_ALERT_EMAIL_TO is not configured, matching the behaviour of
// the per-detection email step.

import fs from 'node:fs';

const {
  SENDGRID_API_KEY,
  SECURITY_ALERT_EMAIL_TO,
  SECURITY_ALERT_EMAIL_FROM,
  ISSUES_JSON = '',
  RUN_URL = '',
  REPO_URL = '',
} = process.env;

if (!SENDGRID_API_KEY || !SECURITY_ALERT_EMAIL_TO) {
  console.log('[send-security-digest] SENDGRID_API_KEY or SECURITY_ALERT_EMAIL_TO missing; skipping digest send.');
  process.exit(0);
}

if (!ISSUES_JSON || !fs.existsSync(ISSUES_JSON)) {
  console.error(`[send-security-digest] ISSUES_JSON path "${ISSUES_JSON}" not found.`);
  process.exit(1);
}

const issues = JSON.parse(fs.readFileSync(ISSUES_JSON, 'utf8'));
if (!Array.isArray(issues)) {
  console.error('[send-security-digest] ISSUES_JSON must contain a JSON array.');
  process.exit(1);
}

const fromEmail = SECURITY_ALERT_EMAIL_FROM || 'security-alerts@tabulamedica.health';
const recipients = SECURITY_ALERT_EMAIL_TO.split(',').map((s) => s.trim()).filter(Boolean);

const today = new Date();
const ageDays = (iso) => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((today.getTime() - t) / 86_400_000));
};
const fmtDate = (iso) => {
  if (!iso) return 'never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return d.toISOString().slice(0, 10);
};
const fmtAge = (iso) => {
  const n = ageDays(iso);
  if (n === null) return 'unknown';
  if (n === 0) return 'today';
  if (n === 1) return '1 day';
  return `${n} days`;
};

const subject = `[security] Weekly digest: ${issues.length} unresolved alert${issues.length === 1 ? '' : 's'}`;

if (issues.length === 0) {
  const textBody = [
    'Weekly security-alert digest',
    '',
    'No open issues labelled `security,automated` at this time.',
    '',
    `All open security alerts: ${REPO_URL}/issues?q=is%3Aissue+is%3Aopen+label%3Asecurity+label%3Aautomated`,
    `Digest workflow run: ${RUN_URL}`,
    '',
    'This digest fires every Monday at 13:00 UTC. Tracking issues are deduplicated by title;',
    'closing one re-arms the per-detection email pager for that CVE batch.',
  ].join('\n');

  const htmlBody = `
<p><strong>Weekly security-alert digest</strong></p>
<p>No open issues labelled <code>security,automated</code> at this time.</p>
<p><a href="${REPO_URL}/issues?q=is%3Aissue+is%3Aopen+label%3Asecurity+label%3Aautomated">All open security alerts</a><br/>
<a href="${RUN_URL}">Digest workflow run</a></p>
<p><em>This digest fires every Monday at 13:00 UTC. Tracking issues are deduplicated by title; closing one re-arms the per-detection email pager for that CVE batch.</em></p>
`.trim();

  await send({ subject: '[security] Weekly digest: 0 unresolved alerts', textBody, htmlBody });
  process.exit(0);
}

const sorted = [...issues].sort((a, b) => {
  const aAge = ageDays(a.created_at) ?? -1;
  const bAge = ageDays(b.created_at) ?? -1;
  return bAge - aAge;
});

const escape = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const textLines = sorted.map((i) => {
  const age = fmtAge(i.created_at);
  const lastActivity = i.last_comment_at || i.updated_at || i.created_at;
  return `  #${i.number} — ${i.title}
    age:           ${age} (opened ${fmtDate(i.created_at)})
    last activity: ${fmtDate(lastActivity)}
    link:          ${i.html_url}`;
});

const textBody = [
  `Weekly security-alert digest — ${issues.length} unresolved tracking issue${issues.length === 1 ? '' : 's'}`,
  '',
  'These GitHub issues (labelled `security,automated`) are still open. Each was originally paged',
  'to this alias on first detection; this weekly digest is the visibility backstop while they remain',
  'unresolved.',
  '',
  ...textLines,
  '',
  `All open security alerts: ${REPO_URL}/issues?q=is%3Aissue+is%3Aopen+label%3Asecurity+label%3Aautomated`,
  `Digest workflow run: ${RUN_URL}`,
  '',
  'This digest fires every Monday at 13:00 UTC. Close a tracking issue once the offending package',
  'is upgraded; the next scheduled scan will reopen it (and re-page) if the CVE is still present.',
].join('\n');

const htmlRows = sorted.map((i) => {
  const lastActivity = i.last_comment_at || i.updated_at || i.created_at;
  return `<tr>
  <td><a href="${escape(i.html_url)}">#${escape(i.number)}</a></td>
  <td>${escape(i.title)}</td>
  <td>${escape(fmtAge(i.created_at))}<br/><small>opened ${escape(fmtDate(i.created_at))}</small></td>
  <td>${escape(fmtDate(lastActivity))}</td>
</tr>`;
}).join('\n');

const htmlBody = `
<p><strong>Weekly security-alert digest — ${escape(issues.length)} unresolved tracking issue${issues.length === 1 ? '' : 's'}</strong></p>
<p>These GitHub issues (labelled <code>security,automated</code>) are still open. Each was originally paged
to this alias on first detection; this weekly digest is the visibility backstop while they remain unresolved.</p>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
  <thead>
    <tr><th>Issue</th><th>Title</th><th>Age</th><th>Last activity</th></tr>
  </thead>
  <tbody>
    ${htmlRows}
  </tbody>
</table>
<p><a href="${escape(REPO_URL)}/issues?q=is%3Aissue+is%3Aopen+label%3Asecurity+label%3Aautomated">All open security alerts</a><br/>
<a href="${escape(RUN_URL)}">Digest workflow run</a></p>
<p><em>This digest fires every Monday at 13:00 UTC. Close a tracking issue once the offending package is upgraded;
the next scheduled scan will reopen it (and re-page) if the CVE is still present.</em></p>
`.trim();

await send({ subject, textBody, htmlBody });

async function send({ subject, textBody, htmlBody }) {
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
    console.error(`[send-security-digest] SendGrid responded ${res.status}: ${errBody}`);
    process.exit(1);
  }

  console.log(`[send-security-digest] Sent weekly digest (${issues.length} issues) to ${recipients.join(', ')} (status ${res.status}).`);
}
