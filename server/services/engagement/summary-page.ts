/**
 * The pages the share link serves. Pure — strings in, HTML out.
 *
 * Extracted from the route file for the same reason `inbound-auth.ts` was:
 * security-relevant logic living inline in a handler is logic nobody
 * unit-tests. What is security-relevant here is not obvious until it goes
 * wrong, so it is worth naming:
 *
 *   - **What the GET page may contain.** Messaging platforms fetch a link to
 *     build a preview, so the page a GET returns is delivered to WhatsApp,
 *     iMessage, Slack or a mail scanner rather than to the recipient. It must
 *     therefore hold no PHI at all, and `interstitialPage` is what enforces
 *     that.
 *   - **The title.** A page title is what an unfurl displays and what a
 *     browser writes into history. Every page here uses the same generic
 *     title, so the patient's name never reaches either.
 *   - **Escaping.** Allergen names, medication names and problem names are
 *     patient-entered free text rendered into HTML for a third party.
 *
 * No scripts, no external resources, inline CSS only — the token sits in the
 * URL path, and any external fetch would leak it in a `Referer` header.
 */

import { escapeXhtml } from "../world/ips-generator";
import type { HealthSummary } from "@shared/health-summary";
import { summaryStrings } from "./summary-strings";


const PAGE_CSS = `
:root{color-scheme:light dark;--bg:#fff;--fg:#111;--muted:#555;--line:#e3e3e3;--warn-bg:#fff4e5;--warn-fg:#7a4100;--warn-line:#f0b357}
@media(prefers-color-scheme:dark){:root{--bg:#151719;--fg:#f2f2f2;--muted:#a8a8a8;--line:#31353a;--warn-bg:#3a2a10;--warn-fg:#ffcf8f;--warn-line:#8a5f1d}}
*{box-sizing:border-box}
body{margin:0;padding:1.5rem 1rem 3rem;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:38rem;margin:0 auto}
h1{font-size:1.35rem;margin:0 0 .25rem}
h2{font-size:1.05rem;margin:2rem 0 .5rem;padding-bottom:.3rem;border-bottom:1px solid var(--line)}
.meta{color:var(--muted);font-size:.85rem;margin:0 0 1.25rem}
.warn{background:var(--warn-bg);color:var(--warn-fg);border:1px solid var(--warn-line);border-radius:8px;padding:.7rem .85rem;margin:.5rem 0;font-weight:600}
ul{list-style:none;margin:0;padding:0}
li{padding:.55rem 0;border-bottom:1px solid var(--line)}
li:last-child{border-bottom:0}
.primary{font-weight:600}
.secondary{color:var(--muted);font-size:.9rem}
.status{display:inline-block;margin-left:.4rem;padding:.05rem .4rem;border:1px solid var(--line);border-radius:4px;font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}
.empty{color:var(--muted);font-style:italic}
footer{margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--line);color:var(--muted);font-size:.85rem}
form{margin-top:1rem;display:flex;flex-direction:column;gap:.5rem;max-width:14rem}
label{font-size:.85rem}
input{padding:.6rem .7rem;font-size:1.25rem;letter-spacing:.25em;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg)}
button{padding:.6rem .9rem;font-size:1rem;border:1px solid var(--line);border-radius:8px;background:var(--fg);color:var(--bg);cursor:pointer}
`;

function shell(title: string, bodyHtml: string, lang: string, dir: "ltr" | "rtl"): string {
  return `<!doctype html><html lang="${escapeXhtml(lang)}" dir="${dir}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="referrer" content="no-referrer">
<title>${escapeXhtml(title)}</title><style>${PAGE_CSS}</style></head><body><main>${bodyHtml}</main></body></html>`;
}

/** Scripts from `languages.ts`' RTL set. Getting this wrong makes Urdu unreadable. */
const RTL = new Set(["ar", "ur", "fa", "he"]);

export function errorPage(failure: string, detail: string): string {
  const heading =
    failure === "pin-locked"
      ? "This link is closed"
      : "This link is no longer available";
  return shell(
    GENERIC_TITLE,
    `<h1>${escapeXhtml(heading)}</h1><p class="meta">${escapeXhtml(detail)}</p>` +
      `<p class="meta">Ask the person who sent it for a new one.</p>`,
    "en",
    "ltr",
  );
}

/**
 * PIN entry. The form POSTs to the same path, so the PIN travels in a request
 * body rather than a URL — access logs, proxy logs and browser history all
 * record the request line, and a PIN sitting in any of them is a PIN that no
 * longer protects anything.
 *
 * `autocomplete="off"` and `inputmode="numeric"` because this is a one-time
 * code read off a message, not a credential a password manager should keep.
 */
export function pinPage(token: string, error: string | null): string {
  const action = `/s/${encodeURIComponent(token)}`;
  const body =
    `<h1>Enter the PIN</h1>` +
    `<p class="meta">The person who shared this summary was given a 6-digit PIN.</p>` +
    (error ? `<p class="warn">${escapeXhtml(error)}</p>` : "") +
    `<form method="post" action="${escapeXhtml(action)}">` +
    `<label class="secondary" for="pin">PIN</label>` +
    `<input id="pin" name="pin" type="text" inputmode="numeric" pattern="[0-9]*" ` +
    `maxlength="6" autocomplete="off" autofocus>` +
    `<button type="submit">Open summary</button>` +
    `</form>`;
  return shell(GENERIC_TITLE, body, "en", "ltr");
}

/**
 * The page a GET returns. Deliberately says almost nothing.
 *
 * No patient name, no section names, no indication that the token is even
 * real — a link preview generator gets this and learns nothing beyond the
 * fact that somebody shared a health summary, which is what the notification
 * already said in plain text. The button POSTs, and only a POST redeems.
 */
export function interstitialPage(token: string): string {
  const action = `/s/${encodeURIComponent(token)}`;
  const body =
    `<h1>Shared health summary</h1>` +
    `<p class="meta">Someone has shared a health summary with you. It opens once you ` +
    `continue, and the link may expire or be revoked by the person who sent it.</p>` +
    `<form method="post" action="${escapeXhtml(action)}">` +
    `<button type="submit">Open summary</button>` +
    `</form>`;
  return shell(GENERIC_TITLE, body, "en", "ltr");
}

/**
 * Every page title is this, including the summary itself.
 *
 * The title is what a link preview shows and what a browser writes into
 * history. Putting the patient's name there disclosed it to any unfurler that
 * fetched the page and to anyone who later scrolled that history.
 */
export const GENERIC_TITLE = "Shared health summary";

export function summaryPage(
  summary: HealthSummary,
  expiresAt: string,
  language: string,
): string {
  const { strings } = summaryStrings(language);
  const dir = RTL.has(summary.language) ? "rtl" : "ltr";

  const warnings = summary.warnings
    .map((w) => `<p class="warn">${escapeXhtml(w)}</p>`)
    .join("");

  const sections = summary.sections
    .map((section) => {
      const body = section.emptyState
        ? `<p class="empty">${escapeXhtml(section.emptyState.text)}</p>`
        : `<ul>${section.lines
            .map((line) => {
              const secondary = line.secondary
                ? `<div class="secondary">${escapeXhtml(line.secondary)}</div>`
                : "";
              const status = line.status
                ? `<span class="status">${escapeXhtml(line.status)}</span>`
                : "";
              return `<li><div class="primary">${escapeXhtml(line.primary)}${status}</div>${secondary}</li>`;
            })
            .join("")}</ul>`;
      return `<h2>${escapeXhtml(section.heading)}</h2>${body}`;
    })
    .join("");

  const body =
    `<h1>${escapeXhtml(summary.patientName)}</h1>` +
    `<p class="meta">${escapeXhtml(strings.generatedLabel)}: ${escapeXhtml(summary.generatedAt)}` +
    ` &middot; ${escapeXhtml(strings.expiresLabel)}: ${escapeXhtml(expiresAt)}</p>` +
    warnings +
    sections +
    `<footer>${escapeXhtml(summary.disclaimer)}</footer>`;

  return shell(GENERIC_TITLE, body, summary.language, dir);
}
