/**
 * Public, PHI-free MCP connector for Claude (and any MCP client).
 *
 * NON-PHI ONLY. Anthropic has no BAA with us, so this connector can only ever
 * see public reference data: state free-care programs, generic drug savings,
 * and the Medicare G-code catalog. Every tool input is a closed enum of public
 * slugs or codes, so there is no free-text field a user could paste a name,
 * DOB, or diagnosis into. Nothing here may import the database, storage, auth,
 * or any patient-record service; scripts/phi-ai-guard.sh enforces that.
 *
 * Tool text is written the way a community health worker would say it: short,
 * plain, no jargon left unexplained. Structured data rides alongside it for
 * clients that want fields.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getFreeCareState, getStateSlugs } from "../seo/free-care";
import { getDrugSavings, getDrugSlugs } from "../seo/drug-savings";
import { gcodeRuleSet } from "../services/medicare-care-gaps/g-code-catalog";
import type { MedicareGapCategory } from "@shared/medicare-care-gaps";

export const PUBLIC_CONNECTOR_NAME = "tabula-medica-public";
export const PUBLIC_CONNECTOR_VERSION = "1.0.0";

const NOT_ADVICE =
  "This is general information, not medical or financial advice. Prices change; check with the pharmacy or clinic before you go.";

const GAP_CATEGORIES = ["awv", "vaccine", "medication-reconciliation", "care-plan"] as const satisfies readonly MedicareGapCategory[];

function asEnum(values: string[]): [string, ...string[]] {
  if (values.length === 0) throw new Error("public connector: empty enum");
  return values as [string, ...string[]];
}

function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] };
}

function bullets(items: readonly string[]): string {
  return items.map((i) => `- ${i}`).join("\n");
}

export function freeCareText(slug: string): string | null {
  const s = getFreeCareState(slug);
  if (!s) return null;
  const medicaid = s.medicaidExpanded
    ? `${s.state} expanded Medicaid, so adults earning up to 138% of the federal poverty level can usually get it.`
    : `${s.state} has not expanded Medicaid. A lot of working adults earn too much for Medicaid and too little for marketplace help, so community health centers matter even more here.`;
  return [
    `# Free and low-cost care in ${s.state}`,
    `About ${s.uninsuredPop} people in ${s.state} have no insurance (${s.uninsuredRate}). ${medicaid}`,
    `## Where to go`,
    `${s.state} has ${s.fqhcCount}+ community health centers (FQHCs). They have to see you whether or not you can pay. A few of them:`,
    bullets(s.topFqhcs.map((f) => `${f.name}, ${f.city}: ${f.services.join(", ")}`)),
    `## What it costs`,
    s.slidingScaleInfo,
    `## Programs to ask about`,
    bullets(s.keyPrograms),
    `## Paying for prescriptions`,
    bullets(s.prescriptionHelp),
    `_${NOT_ADVICE}_`,
  ].join("\n\n");
}

export function drugSavingsText(slug: string): string | null {
  const d = getDrugSavings(slug);
  if (!d) return null;
  return [
    `# ${d.name} (${d.genericName}; brand: ${d.brandName})`,
    `Used for: ${d.commonUses.join(", ")}.`,
    `## Typical cash prices`,
    bullets([
      `Retail, no discount: ${d.avgRetailPrice}`,
      `Generic: ${d.avgGenericPrice}`,
      `With a GoodRx-style coupon: ${d.goodRxPrice}`,
      `Mark Cuban Cost Plus Drugs: ${d.costPlusPrice}`,
    ]),
    `## Ways to pay less`,
    bullets(d.savingsTips),
    `## Manufacturer help`,
    d.patientAssistance,
    d.alternatives.length ? `Similar lower-cost options to ask your doctor about: ${d.alternatives.join(", ")}.` : "",
    `_${NOT_ADVICE} Don't stop or switch a medicine without talking to your prescriber._`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function gcodeText(category?: MedicareGapCategory): string {
  const set = gcodeRuleSet();
  const codes = category ? set.codes.filter((c) => c.category === category) : set.codes;
  const header = set.verified
    ? `Medicare G-codes (${set.year}, verified against: ${set.source}).`
    : "Medicare G-codes from the built-in seed table. It has NOT been verified against the current HCPCS release or Physician Fee Schedule, so don't bill from it.";
  if (codes.length === 0) return `${header}\n\nNo codes in that category.`;
  return [header, ...codes.map((c) => `**${c.code}** (${c.category}): ${c.label}\n${c.note}`)].join("\n\n");
}

export function createPublicConnector(): McpServer {
  const server = new McpServer(
    { name: PUBLIC_CONNECTOR_NAME, version: PUBLIC_CONNECTOR_VERSION },
    {
      instructions:
        "Public reference data from Tabula Medica and Uninsurance.care for people who are uninsured or underinsured: " +
        "where to get free or sliding-scale care by state, what common generic drugs cost and how to pay less, and the " +
        "Medicare G-code catalog. It holds no patient records. Never send names, birth dates, member IDs, or diagnoses here.",
    },
  );

  const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

  server.registerTool(
    "list_free_care_states",
    {
      title: "List states with free-care guides",
      description: "Lists the US states that have a free and low-cost care guide. Use the slug with find_free_care.",
      inputSchema: {},
      annotations: readOnly,
    },
    async () => {
      const states = getStateSlugs()
        .map((slug) => getFreeCareState(slug))
        .filter((s): s is NonNullable<typeof s> => s !== null);
      return {
        ...text(bullets(states.map((s) => `${s.state} (${s.abbr}): slug \`${s.slug}\``))),
        structuredContent: { states: states.map((s) => ({ slug: s.slug, state: s.state, abbr: s.abbr })) },
      };
    },
  );

  server.registerTool(
    "find_free_care",
    {
      title: "Find free and low-cost care in a state",
      description:
        "Community health centers, sliding-scale fees, coverage programs, and prescription help for one US state. " +
        "For people without insurance or with coverage that doesn't go far enough.",
      inputSchema: { state: z.enum(asEnum(getStateSlugs())).describe("State slug, e.g. texas") },
      annotations: readOnly,
    },
    async ({ state }) => {
      const s = getFreeCareState(state);
      const body = freeCareText(state);
      if (!s || !body) return { ...text(`No guide for "${state}" yet.`), isError: true };
      return { ...text(body), structuredContent: { ...s } };
    },
  );

  server.registerTool(
    "compare_drug_prices",
    {
      title: "Compare cash prices for a common drug",
      description:
        "Retail, generic, coupon, and Cost Plus Drugs prices for a common generic medicine, plus ways to pay less " +
        "and manufacturer assistance. Use list_drugs for the supported names.",
      inputSchema: { drug: z.enum(asEnum(getDrugSlugs())).describe("Drug slug, e.g. metformin") },
      annotations: readOnly,
    },
    async ({ drug }) => {
      const d = getDrugSavings(drug);
      const body = drugSavingsText(drug);
      if (!d || !body) return { ...text(`No price guide for "${drug}" yet.`), isError: true };
      return { ...text(body), structuredContent: { ...d } };
    },
  );

  server.registerTool(
    "list_drugs",
    {
      title: "List drugs with price guides",
      description: "Lists the medicines that compare_drug_prices covers.",
      inputSchema: {},
      annotations: readOnly,
    },
    async () => {
      const drugs = getDrugSlugs()
        .map((slug) => getDrugSavings(slug))
        .filter((d): d is NonNullable<typeof d> => d !== null);
      return {
        ...text(bullets(drugs.map((d) => `${d.name} (${d.category}): slug \`${d.slug}\``))),
        structuredContent: { drugs: drugs.map((d) => ({ slug: d.slug, name: d.name, category: d.category })) },
      };
    },
  );

  server.registerTool(
    "list_medicare_gcodes",
    {
      title: "Medicare G-code catalog",
      description:
        "The HCPCS G-codes Tabula Medica maps Medicare care gaps to (Annual Wellness Visit, vaccines, medication " +
        "reconciliation, care plans). Says plainly whether the table is verified.",
      inputSchema: { category: z.enum(GAP_CATEGORIES).optional().describe("Limit to one gap category") },
      annotations: readOnly,
    },
    async ({ category }) => {
      const set = gcodeRuleSet();
      const codes = category ? set.codes.filter((c) => c.category === category) : set.codes;
      return {
        ...text(gcodeText(category)),
        structuredContent: { verified: set.verified, year: set.year, source: set.source, codes: [...codes] },
      };
    },
  );

  return server;
}
