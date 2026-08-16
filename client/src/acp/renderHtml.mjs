/**
 * Advance Care Planning — printable HTML renderer (portable ESM).
 *
 * The patient apps (PHR / World EHR) don't have the provider-only Canvas plugin, so they render
 * the directive to HTML here and let the browser print-to-PDF (or display it). Same two variants
 * as the server PDF: "signable" (state-driven signature/witness/notary blocks) and
 * "unsigned_provider" (a share-with-provider banner, no signature lines). Escapes all content.
 */

import { toSections } from "./directive.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function signatureBlock(rules) {
  const n = rules.witnesses_required;
  const rule = rules.either_witnesses_or_notary
    ? `Complete EITHER ${n} qualified witness signature(s) OR notarization below.`
    : (rules.notary_required
        ? `Complete ${n} qualified witness signature(s) AND notarization below.`
        : `Complete ${n} qualified witness signature(s) below.`);
  const lines = ['<div class="acp-line">Patient signature / Date</div>'];
  for (let i = 1; i <= n; i++) lines.push(`<div class="acp-line">Witness ${i} — signature / printed name / date</div>`);
  if (rules.notary_required || rules.either_witnesses_or_notary)
    lines.push('<div class="acp-line">Notary Public — signature / commission # / date</div>');
  return `<section class="acp-exec"><h2>Signatures &amp; Execution</h2><p class="acp-strong">${esc(rule)}</p>${
    rules.witness_qualification_note ? `<p class="acp-note">Witness rule: ${esc(rules.witness_qualification_note)}</p>` : ""
  }${lines.join("")}</section>`;
}

/**
 * @param {object} doc  normalized directive (directive.normalize)
 * @param {object} rules stateRules.executionRequirements(state)
 * @param {{variant?: "signable"|"unsigned_provider", contentHash?: string}} [opts]
 * @returns {string} a standalone HTML document string
 */
export function renderDirectiveHtml(doc, rules, opts = {}) {
  const variant = opts.variant || "signable";
  const body = toSections(doc, rules).map((s) =>
    `<section><h2>${esc(s.heading)}</h2>${s.lines.map((l) => `<p>${esc(l)}</p>`).join("")}</section>`
  ).join("");

  const banners = [];
  if (variant === "unsigned_provider")
    banners.push('<div class="acp-banner acp-warn">UNSIGNED — FOR PROVIDER REVIEW. NOT A LEGAL DOCUMENT.</div>');
  if (!rules.counsel_verified)
    banners.push('<div class="acp-banner">DRAFT — this state’s execution rules are pending legal (counsel) verification.</div>');

  const style = `
    body{font:14px/1.5 -apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#0f1b2d;max-width:720px;margin:24px auto;padding:0 18px}
    h1{font-size:22px;margin:0 0 2px} h2{font-size:14px;border-bottom:1px solid #e6ebf3;padding-bottom:4px;margin:18px 0 6px}
    p{margin:3px 0} .acp-sub{color:#64748b;font-size:12.5px}
    .acp-banner{background:#eef2f8;border-radius:8px;padding:8px 12px;margin:8px 0;font-weight:700;font-size:12.5px}
    .acp-warn{background:#fff6ec;color:#b45309}
    .acp-line{border-top:1px solid #0f1b2d;margin-top:34px;padding-top:4px;font-size:11px;color:#64748b}
    .acp-strong{font-weight:700} .acp-note{color:#64748b;font-size:12px}
    .acp-foot{color:#94a3b8;font-size:11px;margin-top:24px;border-top:1px solid #e6ebf3;padding-top:8px}
    @media print{body{margin:0}}`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Advance Directive</title><style>${style}</style></head>
<body>
<h1>Advance Directive</h1>
<p class="acp-sub">${esc(rules.form_name || "Living Will + Healthcare Power of Attorney")} · ${esc(rules.statutory_citation || "")}</p>
${banners.join("")}
${body}
${variant === "signable" ? signatureBlock(rules) : ""}
<section><h2>Important</h2><p>${esc(rules.disclaimer || "This document records your wishes. It is not legal or medical advice. It becomes legally effective only when executed under your state’s rules.")}</p></section>
<div class="acp-foot">Tabula Medica ACP${opts.contentHash ? " · " + esc(opts.contentHash.slice(0, 23)) + "…" : ""} · DRAFT — not legal or medical advice</div>
</body></html>`;
}
