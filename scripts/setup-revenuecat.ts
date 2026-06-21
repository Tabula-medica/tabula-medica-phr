async function getRevenueCatToken(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;
  if (!xReplitToken) throw new Error("X-Replit-Token not found");
  const res = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=revenuecat`,
    { headers: { Accept: "application/json", "X-Replit-Token": xReplitToken } }
  );
  const data: any = await res.json();
  const conn = data.items?.[0];
  const token =
    conn?.settings?.access_token ||
    conn?.settings?.oauth?.credentials?.access_token;
  if (!token) throw new Error("No RevenueCat access token found");
  return token;
}

async function rcFetch(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.revenuecat.com/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

async function main() {
  const token = await getRevenueCatToken();
  console.log("✓ Got RevenueCat OAuth token\n");

  // 1. List projects
  const projectsRes = await rcFetch(token, "/projects");
  console.log("Projects response status:", projectsRes.status);
  if (projectsRes.status !== 200) {
    console.log("Projects body:", JSON.stringify(projectsRes.body, null, 2));
    process.exit(1);
  }
  const projects = projectsRes.body.items || [];
  console.log(`Found ${projects.length} project(s):`);
  for (const p of projects) {
    console.log(`  - ${p.name} (id: ${p.id})`);
  }
  console.log();

  if (projects.length === 0) {
    console.log("✗ No projects found. Please create one in RevenueCat dashboard first.");
    process.exit(1);
  }

  const project = projects.find((p: any) =>
    p.name?.toLowerCase().includes("tabula")
  ) || projects[0];
  console.log(`Using project: ${project.name} (${project.id})\n`);

  // 2. List existing apps
  const appsRes = await rcFetch(token, `/projects/${project.id}/apps`);
  console.log("Apps response status:", appsRes.status);
  if (appsRes.status !== 200) {
    console.log("Apps body:", JSON.stringify(appsRes.body, null, 2));
    process.exit(1);
  }
  const apps = appsRes.body.items || [];
  console.log(`Found ${apps.length} existing app(s):`);
  for (const a of apps) {
    console.log(`  - ${a.name} | type: ${a.type} | bundleId: ${a.bundle_id || a.package_name || "n/a"}`);
  }
  console.log();

  // 3. Create iOS app if missing
  let iosApp = apps.find((a: any) => a.type === "app_store");
  if (!iosApp) {
    console.log("Creating iOS app...");
    const r = await rcFetch(token, `/projects/${project.id}/apps`, {
      method: "POST",
      body: JSON.stringify({
        name: "Tabula Medica iOS",
        type: "app_store",
        app_store: { bundle_id: "health.tabulamedica.app" },
      }),
    });
    console.log("  iOS create status:", r.status);
    console.log("  Response:", JSON.stringify(r.body, null, 2).slice(0, 800));
    if (r.status === 201 || r.status === 200) iosApp = r.body;
  } else {
    console.log("✓ iOS app already exists:", iosApp.id);
  }

  // 4. Create Android app if missing
  let androidApp = apps.find((a: any) => a.type === "play_store");
  if (!androidApp) {
    console.log("\nCreating Android app...");
    const r = await rcFetch(token, `/projects/${project.id}/apps`, {
      method: "POST",
      body: JSON.stringify({
        name: "Tabula Medica Android",
        type: "play_store",
        play_store: { package_name: "health.tabulamedica.app" },
      }),
    });
    console.log("  Android create status:", r.status);
    console.log("  Response:", JSON.stringify(r.body, null, 2).slice(0, 800));
    if (r.status === 201 || r.status === 200) androidApp = r.body;
  } else {
    console.log("✓ Android app already exists:", androidApp.id);
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Project ID: ${project.id}`);
  console.log(`iOS app id: ${iosApp?.id || "FAILED"}`);
  console.log(`iOS public API key: ${iosApp?.app_specific_api_key || iosApp?.public_api_key || iosApp?.api_key || "(check API Keys page)"}`);
  console.log(`Android app id: ${androidApp?.id || "FAILED"}`);
  console.log(`Android public API key: ${androidApp?.app_specific_api_key || androidApp?.public_api_key || androidApp?.api_key || "(check API Keys page)"}`);
  console.log("\nFull iOS app object:", JSON.stringify(iosApp, null, 2));
  console.log("\nFull Android app object:", JSON.stringify(androidApp, null, 2));
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
