import fs from "fs";
import path from "path";

let LOGO_BASE64 = "";
try {
  const logoBuffer = fs.readFileSync(path.resolve("client/public/logo.png"));
  LOGO_BASE64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
} catch {
  LOGO_BASE64 = "/logo.png";
}

const SITE_URL = "https://app.tabulamedica.health";
const BRAND_NAME = "Tabula Medica";

interface SsrPageOptions {
  title: string;
  description: string;
  canonical: string;
  body: string;
  schemaJson?: string;
  breadcrumbs?: { name: string; url: string }[];
  ogImage?: string;
  noindex?: boolean;
}

function breadcrumbHtml(crumbs: { name: string; url: string }[]): string {
  if (!crumbs || crumbs.length === 0) return "";
  const items = crumbs
    .map(
      (c, i) =>
        `<li style="display:inline;${i > 0 ? 'margin-left:4px;' : ''}">` +
        (i < crumbs.length - 1
          ? `<a href="${c.url}" style="color:#3366E8;text-decoration:none;">${c.name}</a>`
          : `<span style="color:#6b7280;">${c.name}</span>`) +
        `${i < crumbs.length - 1 ? ' <span style="color:#9ca3af;margin-left:4px;">›</span>' : ""}` +
        `</li>`
    )
    .join("");
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url.startsWith("http") ? c.url : `${SITE_URL}${c.url}`,
    })),
  };
  return `<nav aria-label="Breadcrumb" style="margin-bottom:24px;"><ol style="list-style:none;padding:0;margin:0;font-size:14px;">${items}</ol></nav><script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

function headerHtml(): string {
  return `<header style="position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:14px 32px;border-bottom:1px solid #e5e7eb;background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);">
  <a href="/" style="display:flex;align-items:center;text-decoration:none;">
    <img src="${LOGO_BASE64}" alt="${BRAND_NAME}" style="height:36px;" loading="eager" width="36" height="36" />
  </a>
  <nav style="display:flex;align-items:center;gap:20px;font-size:14px;">
    <a href="/providers" style="color:#6b7280;text-decoration:none;">Providers</a>
    <a href="/learn" style="color:#6b7280;text-decoration:none;">Learn</a>
    <a href="/free-care" style="color:#6b7280;text-decoration:none;">Find Care</a>
    <a href="/conditions" style="color:#6b7280;text-decoration:none;">Conditions</a>
    <a href="/drug-savings" style="color:#6b7280;text-decoration:none;">Drug Savings</a>
    <a href="/api/login" style="color:#fff;background:#3366E8;padding:8px 16px;border-radius:8px;text-decoration:none;font-weight:500;">Log In</a>
  </nav>
</header>`;
}

function footerHtml(): string {
  return `<footer style="border-top:1px solid #e5e7eb;padding:32px;max-width:1024px;margin:0 auto;">
  <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:32px;margin-bottom:24px;">
    <div>
      <h4 style="font-weight:600;margin-bottom:12px;font-size:14px;color:#111827;">Resources</h4>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;">
        <a href="/providers" style="color:#6b7280;text-decoration:none;">Provider Directory</a>
        <a href="/learn" style="color:#6b7280;text-decoration:none;">Medical Glossary</a>
        <a href="/conditions" style="color:#6b7280;text-decoration:none;">Condition Guides</a>
      </div>
    </div>
    <div>
      <h4 style="font-weight:600;margin-bottom:12px;font-size:14px;color:#111827;">Savings</h4>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;">
        <a href="/free-care" style="color:#6b7280;text-decoration:none;">Free &amp; Low-Cost Care</a>
        <a href="/drug-savings" style="color:#6b7280;text-decoration:none;">Drug Savings</a>
        <a href="/faq" style="color:#6b7280;text-decoration:none;">FAQ</a>
      </div>
    </div>
    <div>
      <h4 style="font-weight:600;margin-bottom:12px;font-size:14px;color:#111827;">Legal</h4>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;">
        <a href="/privacy-policy" style="color:#6b7280;text-decoration:none;">Privacy Policy</a>
        <a href="/terms-of-service" style="color:#6b7280;text-decoration:none;">Terms of Service</a>
        <a href="/about/security" style="color:#6b7280;text-decoration:none;">Security</a>
      </div>
    </div>
  </div>
  <div style="text-align:center;color:#9ca3af;font-size:12px;">
    &copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved. HIPAA compliant. Not medical advice.
  </div>
</footer>`;
}

export function ssrHtmlShell(opts: SsrPageOptions): string {
  const ogImage = opts.ogImage || `${SITE_URL}/logo.png`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeAttr(opts.description)}" />
<link rel="canonical" href="${opts.canonical}" />
${opts.noindex ? '<meta name="robots" content="noindex,follow" />' : ""}
<meta property="og:title" content="${escapeAttr(opts.title)}" />
<meta property="og:description" content="${escapeAttr(opts.description)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${opts.canonical}" />
<meta property="og:image" content="${ogImage}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:site_name" content="${BRAND_NAME}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeAttr(opts.title)}" />
<meta name="twitter:description" content="${escapeAttr(opts.description)}" />
<link rel="icon" type="image/png" href="/favicon.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
${opts.schemaJson ? `<script type="application/ld+json">${opts.schemaJson}</script>` : ""}
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;color:#111827;background:#fff;line-height:1.6;}
a{color:#3366E8;}
a:hover{text-decoration:underline;}
.container{max-width:1024px;margin:0 auto;padding:32px 24px;}
h1{font-size:2rem;font-weight:700;margin-bottom:16px;line-height:1.2;}
h2{font-size:1.5rem;font-weight:600;margin:32px 0 12px;color:#111827;}
h3{font-size:1.125rem;font-weight:600;margin:24px 0 8px;color:#374151;}
p{margin-bottom:16px;color:#374151;}
.card{background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:16px;}
.badge{display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:500;background:#EEF2FF;color:#3366E8;}
.cta-btn{display:inline-block;padding:12px 24px;background:#3366E8;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;}
.cta-btn:hover{background:#2855c5;text-decoration:none;}
.grid{display:grid;gap:16px;}
@media(min-width:640px){.grid-2{grid-template-columns:repeat(2,1fr);}.grid-3{grid-template-columns:repeat(3,1fr);}}
table{width:100%;border-collapse:collapse;margin:16px 0;}
th,td{padding:12px;text-align:left;border-bottom:1px solid #e5e7eb;font-size:14px;}
th{font-weight:600;background:#f9fafb;color:#374151;}
.highlight{background:linear-gradient(135deg,#EEF2FF,#DBEAFE);border:1px solid #BFDBFE;border-radius:12px;padding:24px;margin:24px 0;}
</style>
</head>
<body>
${headerHtml()}
<main class="container">
${breadcrumbHtml(opts.breadcrumbs || [])}
${opts.body}
<div style="margin:48px 0;text-align:center;" class="highlight">
  <h2 style="margin-top:0;">Take Control of Your Health Records</h2>
  <p>Unified, summarized, deduplicated, and shareable — all in one place.</p>
  <a href="/api/login" class="cta-btn">Get Started</a>
</div>
</main>
${footerHtml()}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export { SITE_URL, BRAND_NAME, LOGO_BASE64 };
