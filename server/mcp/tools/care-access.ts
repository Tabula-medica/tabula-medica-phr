/**
 * `care_access_lookup` — zero-PHI. Cash-pay reference pricing and low-cost
 * care options from `server/services/care-access-catalog.ts`.
 *
 * This is the first cross-portfolio hook for Uninsurance (strategy §4.1): the
 * same lookup becomes an A2A skill in Phase 2, where ZIP-level and live
 * provider data arrive from the Uninsurance agent. Until then the catalog is
 * state-level and static, and the tool says so in its description.
 *
 * Deliberately accepts no patient identifiers. No scope required.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchCareAccessCatalog } from "../../services/care-access-catalog";
import { runAuditedTool } from "../audit";

export const CARE_ACCESS_TOOL_NAME = "care_access_lookup";

const inputSchema = {
  state: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "Two-letter US state code")
    .optional()
    .describe("Two-letter US state code to filter the discount provider directory, e.g. 'TX'."),
  service: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .optional()
    .describe("What care is needed, in plain words: 'MRI knee', 'lipid panel', 'therapy session', 'chest x-ray'."),
  cptCodes: z
    .array(z.string().trim().max(6))
    .max(20)
    .optional()
    .describe("Specific CPT/CDT codes to price, e.g. ['80061', '99213']."),
  limit: z.number().int().min(1).max(50).optional().describe("Max rate rows to return (default 25)."),
};

const rateRow = z.object({
  cptCode: z.string(),
  description: z.string(),
  category: z.string(),
  medicareRate: z.number(),
  typicalUninsuredRate: z.number(),
  savingsAmount: z.number(),
  savings: z.string(),
  year: z.number(),
});

const outputSchema = {
  query: z.object({
    state: z.string().nullable(),
    service: z.string().nullable(),
    cptCodes: z.array(z.string()),
  }),
  medicareRates: z.array(rateRow),
  imagingServices: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      radiologyAssistPrice: z.string(),
      typicalHospitalPrice: z.string(),
      savings: z.string(),
    }),
  ),
  discountProviders: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      specialties: z.array(z.string()),
      location: z.string(),
      state: z.string(),
      acceptsMedicareRates: z.boolean(),
      discountPercent: z.number(),
      phone: z.string(),
      website: z.string(),
      acceptingNewPatients: z.boolean(),
    }),
  ),
  communityResources: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      url: z.string(),
      category: z.string(),
    }),
  ),
  disclaimer: z.string(),
};

function summarize(result: ReturnType<typeof searchCareAccessCatalog>): string {
  const lines: string[] = [];
  if (result.medicareRates.length > 0) {
    lines.push("Medicare reference rates (2026):");
    for (const r of result.medicareRates.slice(0, 10)) {
      lines.push(`  ${r.cptCode} ${r.description}: Medicare $${r.medicareRate} vs typical cash $${r.typicalUninsuredRate} (${r.savings} less)`);
    }
  }
  if (result.imagingServices.length > 0) {
    lines.push("Imaging cash-price ranges:");
    for (const s of result.imagingServices) lines.push(`  ${s.name}: ${s.radiologyAssistPrice} (hospital ${s.typicalHospitalPrice})`);
  }
  if (result.discountProviders.length > 0) {
    lines.push(`Discount providers${result.query.state ? ` in ${result.query.state}` : ""}:`);
    for (const p of result.discountProviders.slice(0, 10)) {
      lines.push(`  ${p.name} (${p.type}, ${p.location}) ${p.discountPercent}% off, ${p.acceptingNewPatients ? "accepting new patients" : "not accepting new patients"}`);
    }
  }
  lines.push(`${result.communityResources.length} national assistance programs included (HRSA health centers, free clinics, NeedyMeds, 340B, Medicaid/CHIP).`);
  lines.push(result.disclaimer);
  return lines.join("\n");
}

export function registerCareAccessTool(server: McpServer): void {
  server.registerTool(
    CARE_ACCESS_TOOL_NAME,
    {
      title: "Care Access: cash-pay and low-cost care lookup",
      description:
        "Find Medicare reference rates for a service or CPT code, cash-price imaging ranges, discount providers by US state, " +
        "and national assistance programs for uninsured or underinsured patients. Reads no patient data and takes no patient " +
        "identifiers. Directory is state-level; ZIP-level matching arrives with the Uninsurance integration.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args, extra) =>
      runAuditedTool(extra.authInfo, { tool: CARE_ACCESS_TOOL_NAME, resourceType: "CareAccessCatalog" }, async () => {
        const result = searchCareAccessCatalog(args);
        return {
          content: [{ type: "text", text: summarize(result) }],
          // Spread: the SDK wants a plain record, and an interface has no index signature.
          structuredContent: { ...result },
        };
      }),
  );
}
