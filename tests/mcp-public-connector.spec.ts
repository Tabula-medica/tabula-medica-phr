import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createPublicConnector, freeCareText, drugSavingsText } from "../server/mcp/public-connector";
import { registerPublicMcpRoute, PUBLIC_MCP_PATH } from "../server/mcp/public-connector-route";

type TextResult = { content: { type: string; text: string }[]; isError?: boolean; structuredContent?: Record<string, unknown> };

async function connect() {
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await createPublicConnector().connect(serverT);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientT);
  return client;
}

describe("public MCP connector: tools", () => {
  let client: Client;
  beforeAll(async () => {
    client = await connect();
  });
  afterAll(async () => {
    await client.close();
  });

  it("exposes only read-only public tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "compare_drug_prices",
      "find_free_care",
      "list_drugs",
      "list_free_care_states",
      "list_medicare_gcodes",
    ]);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
  });

  it("every tool input is a closed enum, so there is no free-text field for PHI", async () => {
    const { tools } = await client.listTools();
    for (const t of tools) {
      for (const prop of Object.values(t.inputSchema.properties ?? {}) as { type?: string; enum?: unknown[] }[]) {
        expect(prop.enum, `${t.name} has a non-enum input`).toBeDefined();
      }
    }
  });

  it("find_free_care returns plain-language text and structured data", async () => {
    const r = (await client.callTool({ name: "find_free_care", arguments: { state: "texas" } })) as TextResult;
    expect(r.isError).toBeFalsy();
    expect(r.content[0].text).toContain("# Free and low-cost care in Texas");
    expect(r.content[0].text).toContain("has not expanded Medicaid");
    expect(r.structuredContent?.abbr).toBe("TX");
  });

  it("rejects a state outside the enum instead of echoing free text", async () => {
    const r = (await client.callTool({ name: "find_free_care", arguments: { state: "John Doe 1980-01-01" } })) as TextResult;
    expect(r.isError).toBe(true);
    expect(JSON.stringify(r)).not.toContain("Has not expanded");
  });

  it("compare_drug_prices includes prices, tips, and the prescriber caution", async () => {
    const r = (await client.callTool({ name: "compare_drug_prices", arguments: { drug: "metformin" } })) as TextResult;
    expect(r.content[0].text).toContain("Mark Cuban Cost Plus Drugs: $3.60/month");
    expect(r.content[0].text).toContain("Don't stop or switch a medicine");
  });

  it("list_medicare_gcodes flags the unverified seed table", async () => {
    const r = (await client.callTool({ name: "list_medicare_gcodes", arguments: { category: "awv" } })) as TextResult;
    expect(r.structuredContent?.verified).toBe(false);
    expect(r.content[0].text).toContain("NOT been verified");
    expect((r.structuredContent?.codes as { category: string }[]).every((c) => c.category === "awv")).toBe(true);
  });

  it("humanized text avoids stock AI phrasing", () => {
    const all = [freeCareText("california"), freeCareText("texas"), drugSavingsText("sertraline")].join("\n");
    for (const phrase of [/I hope this helps/i, /as an AI/i, /delve/i, /in conclusion/i, /it'?s important to note/i]) {
      expect(all).not.toMatch(phrase);
    }
  });
});

describe("public MCP connector: boundary", () => {
  it("server/mcp/ imports nothing that can reach patient data", () => {
    // Allowlist mirrors scripts/phi-ai-guard.sh "Fifth check". Keep both in sync.
    // auth/audit modules are allowed because they add identity verification and
    // HIPAA audit logging — not PHI data access.
    const allowed =
      /from "(@modelcontextprotocol\/sdk\/[^"]+|zod|express|express-rate-limit|\.\/public-connector(-route)?|\.\/auth|\.\/audit|\.\/tools\/[^"]+|\.\.\/seo\/(free-care|drug-savings)|\.\.\/services\/medicare-care-gaps\/g-code-catalog|\.\.\/lib\/logger|\.\.\/utils\/logger|\.\.\/middleware\/auth0-jwt-verify|\.\.\/security\/hipaa-audit|@shared\/(medicare-care-gaps|[^"]+))"/;
    for (const f of readdirSync("server/mcp").filter(f => f.endsWith(".ts"))) {
      for (const line of readFileSync(`server/mcp/${f}`, "utf8").split("\n")) {
        if (line.startsWith("import")) expect(line, `${f}: ${line}`).toMatch(allowed);
      }
    }
  });
});

describe("public MCP connector: HTTP mount", () => {
  const prev = process.env.PUBLIC_MCP_ENABLED;
  let server: Server | undefined;
  afterEach(() => {
    server?.close();
    server = undefined;
    process.env.PUBLIC_MCP_ENABLED = prev;
  });

  async function listen(enabled: boolean) {
    process.env.PUBLIC_MCP_ENABLED = enabled ? "true" : "false";
    const app = express();
    registerPublicMcpRoute(app);
    server = app.listen(0);
    await new Promise((r) => server!.once("listening", r));
    return `http://127.0.0.1:${(server!.address() as AddressInfo).port}${PUBLIC_MCP_PATH}`;
  }

  it("is not mounted unless PUBLIC_MCP_ENABLED=true", async () => {
    const url = await listen(false);
    expect((await fetch(url, { method: "POST" })).status).toBe(404);
  });

  it("serves tools over stateless Streamable HTTP when enabled", async () => {
    const url = await listen(true);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(url)));
    const r = (await client.callTool({ name: "list_free_care_states", arguments: {} })) as TextResult;
    expect(r.content[0].text).toContain("California (CA)");
    await client.close();
  });

  it("refuses GET with 405", async () => {
    const url = await listen(true);
    expect((await fetch(url)).status).toBe(405);
  });
});
