const isProduction = process.env.NODE_ENV === "production" || !!process.env.REPLIT_DEPLOYMENT;

const UNINSURANCE_ORIGIN = process.env.UNINSURANCE_ORIGIN || "";

const PRODUCTION_ORIGINS = [
  "https://app.tabulamedica.health",
  "https://tabulamedica.health",
  "https://www.tabulamedica.health",
  "https://uninsurance.care",
  "https://www.uninsurance.care",
  "https://app.uninsurance.care",
];

const DEV_DOMAINS = [
  "localhost",
  "127.0.0.1",
  ".replit.dev",
  ".replit.app",
  ".repl.co",
];

export function getCorsAllowlist(): (string | RegExp)[] {
  if (isProduction) {
    const defaults: (string | RegExp)[] = [
      ...PRODUCTION_ORIGINS,
      /^https:\/\/[a-z0-9-]+\.tabulamedica\.health$/,
      /^https:\/\/[a-z0-9-]+\.uninsurance\.care$/,
    ];

    if (UNINSURANCE_ORIGIN) {
      defaults.push(UNINSURANCE_ORIGIN);
    }

    const replitSlug = process.env.REPL_SLUG || process.env.REPLIT_DEV_DOMAIN;
    if (replitSlug) {
      defaults.push(`https://${replitSlug}`);
    }

    const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS;
    if (allowedOrigins) {
      const custom = allowedOrigins.split(",").map(o => o.trim()).filter(Boolean);
      return [...defaults, ...custom];
    }

    return defaults;
  }

  const defaults: (string | RegExp)[] = [
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    /\.replit\.dev$/,
    /\.replit\.app$/,
    /\.repl\.co$/,
    /tabulamedica\.health$/,
    /uninsurance\.care$/,
  ];

  if (UNINSURANCE_ORIGIN) {
    defaults.push(UNINSURANCE_ORIGIN);
  }

  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS;
  if (allowedOrigins) {
    const custom = allowedOrigins.split(",").map(o => o.trim()).filter(Boolean);
    return [...defaults, ...custom];
  }

  return defaults;
}

export function validateCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return false;

  const allowlist = getCorsAllowlist();

  for (const allowed of allowlist) {
    if (typeof allowed === "string" && origin === allowed) {
      return true;
    }
    if (allowed instanceof RegExp && (allowed as RegExp).test(origin)) {
      return true;
    }
  }

  if (!isProduction) {
    try {
      const url = new URL(origin);
      return DEV_DOMAINS.some(domain => {
        if (domain.startsWith(".")) {
          return url.hostname.endsWith(domain) || url.hostname === domain.slice(1);
        }
        return url.hostname === domain;
      });
    } catch {
      return false;
    }
  }

  return false;
}
