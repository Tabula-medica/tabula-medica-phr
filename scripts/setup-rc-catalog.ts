/**
 * Sets up the RevenueCat product catalog for Tabula Medica:
 *  - Entitlements: pro, family
 *  - Web (rc_billing) products: pro_monthly $9.99, pro_annual $99, family_monthly $19.99, family_annual $199
 *  - Default offering with $rc_monthly and $rc_annual packages
 *  - Attaches web products to entitlements
 *
 * iOS/Android products must be created in App Store Connect / Google Play Console
 * first (Apple/Google requirement). Once they exist, attach them via the dashboard
 * or extend this script with their store_identifier.
 */
async function getToken(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
  const r = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=revenuecat`,
    { headers: { Accept: "application/json", "X-Replit-Token": xReplitToken! } }
  );
  const d: any = await r.json();
  const c = d.items?.[0];
  return c?.settings?.access_token || c?.settings?.oauth?.credentials?.access_token;
}

const PROJ = "projcd6e3a57";
const WEB_APP = "appa3f2d8b814";

const t = await getToken();

async function rc(path: string, init: RequestInit = {}) {
  const r = await fetch(`https://api.revenuecat.com/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${t}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let body: any; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

async function ensureEntitlement(lookup_key: string, display_name: string) {
  const list = await rc(`/projects/${PROJ}/entitlements`);
  const existing = (list.body.items || []).find((e: any) => e.lookup_key === lookup_key);
  if (existing) {
    console.log(`✓ Entitlement '${lookup_key}' already exists (${existing.id})`);
    return existing;
  }
  const r = await rc(`/projects/${PROJ}/entitlements`, {
    method: "POST",
    body: JSON.stringify({ lookup_key, display_name }),
  });
  if (r.status >= 200 && r.status < 300) {
    console.log(`✓ Created entitlement '${lookup_key}' (${r.body.id})`);
    return r.body;
  }
  console.log(`✗ Failed to create entitlement '${lookup_key}':`, r.status, JSON.stringify(r.body).slice(0, 400));
  return null;
}

interface ProductSpec {
  store_identifier: string;
  display_name: string;
  amount_micros: number; // e.g. 9.99 USD = 9_990_000
  period: { unit: "month" | "year"; value: number };
}

async function ensureWebProduct(spec: ProductSpec) {
  const list = await rc(`/projects/${PROJ}/products?app_id=${WEB_APP}`);
  const existing = (list.body.items || []).find((p: any) => p.store_identifier === spec.store_identifier);
  if (existing) {
    console.log(`✓ Web product '${spec.store_identifier}' already exists (${existing.id})`);
    return existing;
  }
  const body = {
    app_id: WEB_APP,
    store_identifier: spec.store_identifier,
    type: "subscription",
    display_name: spec.display_name,
    subscription: {
      duration: `P${spec.period.value}${spec.period.unit === "month" ? "M" : "Y"}`,
    },
  };
  const r = await rc(`/projects/${PROJ}/products`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (r.status >= 200 && r.status < 300) {
    console.log(`✓ Created web product '${spec.store_identifier}' (${r.body.id})`);
    return r.body;
  }
  console.log(`✗ Failed to create web product '${spec.store_identifier}':`, r.status, JSON.stringify(r.body).slice(0, 600));
  return null;
}

async function setProductPrice(productId: string, amount_micros: number) {
  const r = await rc(`/projects/${PROJ}/products/${productId}/prices`, {
    method: "POST",
    body: JSON.stringify({
      currency: "USD",
      amount_micros,
    }),
  });
  if (r.status >= 200 && r.status < 300) {
    console.log(`  ✓ Price set: $${(amount_micros / 1_000_000).toFixed(2)}`);
  } else {
    console.log(`  · Price set response ${r.status}:`, JSON.stringify(r.body).slice(0, 400));
  }
}

async function attachProductToEntitlement(entitlementId: string, productId: string, label: string) {
  const r = await rc(
    `/projects/${PROJ}/entitlements/${entitlementId}/actions/attach_products`,
    { method: "POST", body: JSON.stringify({ product_ids: [productId] }) }
  );
  if (r.status >= 200 && r.status < 300) {
    console.log(`  ✓ Attached ${label} to entitlement`);
  } else {
    console.log(`  · Attach response ${r.status}:`, JSON.stringify(r.body).slice(0, 400));
  }
}

async function ensureOffering(lookup_key: string, display_name: string) {
  const list = await rc(`/projects/${PROJ}/offerings`);
  const existing = (list.body.items || []).find((o: any) => o.lookup_key === lookup_key);
  if (existing) {
    console.log(`✓ Offering '${lookup_key}' already exists (${existing.id})`);
    return existing;
  }
  const r = await rc(`/projects/${PROJ}/offerings`, {
    method: "POST",
    body: JSON.stringify({ lookup_key, display_name }),
  });
  if (r.status >= 200 && r.status < 300) {
    console.log(`✓ Created offering '${lookup_key}' (${r.body.id})`);
    return r.body;
  }
  console.log(`✗ Offering '${lookup_key}' failed:`, r.status, JSON.stringify(r.body).slice(0, 400));
  return null;
}

async function ensurePackage(offeringId: string, lookup_key: string, display_name: string, productId: string) {
  const list = await rc(`/projects/${PROJ}/offerings/${offeringId}/packages`);
  const existing = (list.body.items || []).find((p: any) => p.lookup_key === lookup_key);
  if (existing) {
    console.log(`  ✓ Package '${lookup_key}' already exists (${existing.id})`);
    return existing;
  }
  const r = await rc(`/projects/${PROJ}/offerings/${offeringId}/packages`, {
    method: "POST",
    body: JSON.stringify({
      lookup_key,
      display_name,
      position: lookup_key === "$rc_annual" ? 1 : 2,
      products: [{ product_id: productId, eligibility_criteria: "all" }],
    }),
  });
  if (r.status >= 200 && r.status < 300) {
    console.log(`  ✓ Created package '${lookup_key}' (${r.body.id})`);
    return r.body;
  }
  console.log(`  ✗ Package '${lookup_key}' failed:`, r.status, JSON.stringify(r.body).slice(0, 600));
  return null;
}

async function main() {
  console.log("=== Tabula Medica RevenueCat Catalog Setup ===\n");

  console.log("1. Entitlements");
  const proEnt = await ensureEntitlement("pro", "Pro");
  const familyEnt = await ensureEntitlement("family", "Family");

  console.log("\n2. Web Products (Stripe-backed)");
  const products: Record<string, any> = {};
  const specs: ProductSpec[] = [
    { store_identifier: "tm_pro_monthly", display_name: "Tabula Medica Pro (Monthly)", amount_micros: 9_990_000, period: { unit: "month", value: 1 } },
    { store_identifier: "tm_pro_annual", display_name: "Tabula Medica Pro (Annual)", amount_micros: 99_000_000, period: { unit: "year", value: 1 } },
    { store_identifier: "tm_family_monthly", display_name: "Tabula Medica Family (Monthly)", amount_micros: 19_990_000, period: { unit: "month", value: 1 } },
    { store_identifier: "tm_family_annual", display_name: "Tabula Medica Family (Annual)", amount_micros: 199_000_000, period: { unit: "year", value: 1 } },
  ];
  for (const spec of specs) {
    const p = await ensureWebProduct(spec);
    if (p) {
      await setProductPrice(p.id, spec.amount_micros);
      products[spec.store_identifier] = p;
    }
  }

  console.log("\n3. Attach products to entitlements");
  if (proEnt) {
    if (products["tm_pro_monthly"]) await attachProductToEntitlement(proEnt.id, products["tm_pro_monthly"].id, "pro_monthly");
    if (products["tm_pro_annual"]) await attachProductToEntitlement(proEnt.id, products["tm_pro_annual"].id, "pro_annual");
  }
  if (familyEnt) {
    if (products["tm_family_monthly"]) await attachProductToEntitlement(familyEnt.id, products["tm_family_monthly"].id, "family_monthly");
    if (products["tm_family_annual"]) await attachProductToEntitlement(familyEnt.id, products["tm_family_annual"].id, "family_annual");
  }

  console.log("\n4. Default Offering (Pro tier)");
  const proOffering = await ensureOffering("default", "Tabula Medica Pro");
  if (proOffering) {
    if (products["tm_pro_annual"]) await ensurePackage(proOffering.id, "$rc_annual", "Annual", products["tm_pro_annual"].id);
    if (products["tm_pro_monthly"]) await ensurePackage(proOffering.id, "$rc_monthly", "Monthly", products["tm_pro_monthly"].id);
  }

  console.log("\n5. Family Offering");
  const famOffering = await ensureOffering("family", "Tabula Medica Family");
  if (famOffering) {
    if (products["tm_family_annual"]) await ensurePackage(famOffering.id, "$rc_annual", "Annual", products["tm_family_annual"].id);
    if (products["tm_family_monthly"]) await ensurePackage(famOffering.id, "$rc_monthly", "Monthly", products["tm_family_monthly"].id);
  }

  console.log("\n=== Done ===");
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
