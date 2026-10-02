/**
 * `glossary_lookup` — zero-PHI. Plain-language definition of a lab, condition,
 * procedure, medication, or abbreviation from `server/glossary-service.ts`.
 * No scope required: nothing patient-specific is read or returned.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { lookupTerm, type GlossaryTerm } from "../../glossary-service";
import { runAuditedTool } from "../audit";

export const GLOSSARY_TOOL_NAME = "glossary_lookup";

const inputSchema = {
  term: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .describe("The medical word, abbreviation, or test name to define, e.g. 'HbA1c', 'eGFR', 'atelectasis'."),
};

const outputSchema = {
  found: z.boolean(),
  term: z.string().optional(),
  category: z.enum(["lab", "condition", "procedure", "medication", "anatomy", "abbreviation"]).optional(),
  definition: z.string().optional(),
  normalRange: z.string().optional(),
  context: z.string().optional(),
  synonyms: z.array(z.string()).optional(),
  pronunciation: z.string().optional(),
};

function toStructured(entry: GlossaryTerm | null) {
  if (!entry) return { found: false as const };
  return {
    found: true as const,
    term: entry.term,
    category: entry.category,
    definition: entry.definition,
    normalRange: entry.normalRange,
    context: entry.context,
    synonyms: entry.synonyms,
    pronunciation: entry.pronunciation,
  };
}

function toText(entry: GlossaryTerm | null, term: string): string {
  if (!entry) return `No glossary entry for "${term}".`;
  const lines = [`${entry.term} (${entry.category})`, entry.definition];
  if (entry.normalRange) lines.push(`Typical range: ${entry.normalRange}`);
  if (entry.context) lines.push(`Context: ${entry.context}`);
  return lines.join("\n");
}

export function registerGlossaryTool(server: McpServer): void {
  server.registerTool(
    GLOSSARY_TOOL_NAME,
    {
      title: "Medical glossary lookup",
      description:
        "Define a medical term, abbreviation, lab test, procedure, or medication in plain language. " +
        "Reads no patient data. Definitions are general information, not medical advice.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ term }, extra) =>
      runAuditedTool(extra.authInfo, { tool: GLOSSARY_TOOL_NAME, resourceType: "GlossaryTerm" }, async () => {
        const entry = lookupTerm(term);
        return {
          content: [{ type: "text", text: toText(entry, term) }],
          structuredContent: toStructured(entry),
        };
      }),
  );
}
