import { Router } from "express";
import { z } from "zod";
import OpenAI from "openai";

const router = Router();

const generateSchema = z.object({
  medicationOrProcedure: z.string().min(2).max(200),
  medicalCondition: z.string().min(2).max(500),
  insurancePlan: z.string().max(200).optional().default(""),
  patientName: z.string().max(120).optional().default(""),
  priorTreatmentsTried: z.string().max(1000).optional().default(""),
  denialReason: z.string().max(500).optional().default(""),
});

function buildFallbackLetter(input: z.infer<typeof generateSchema>): string {
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const name = input.patientName || "[Patient Name]";
  const insurer = input.insurancePlan || "[Insurance Plan Name]";
  const tried = input.priorTreatmentsTried
    ? `\n\nPrevious treatments attempted include: ${input.priorTreatmentsTried}. These approaches have not adequately addressed the condition, making the requested ${input.medicationOrProcedure} medically necessary at this time.`
    : "";
  const denial = input.denialReason
    ? `\n\nI am writing in response to your denial notice citing: "${input.denialReason}". I respectfully request reconsideration based on the medical necessity outlined below.`
    : "";

  return `${today}

${insurer}
Prior Authorization / Appeals Department

Re: Prior Authorization Request — ${input.medicationOrProcedure}
Patient: ${name}
Member ID: [Member ID]

Dear Prior Authorization Reviewer,

I am writing to request prior authorization for ${input.medicationOrProcedure} for the treatment of ${input.medicalCondition}.${denial}

This treatment is medically necessary because ${input.medicalCondition} requires targeted intervention to prevent disease progression, manage symptoms, and preserve quality of life. The requested ${input.medicationOrProcedure} is appropriate for this clinical situation based on accepted standards of care.${tried}

Without timely access to ${input.medicationOrProcedure}, there is a meaningful risk of clinical deterioration, increased emergency department utilization, and avoidable downstream costs to the plan.

I respectfully request that ${insurer} approve coverage for ${input.medicationOrProcedure} as soon as possible. Please contact my treating provider's office for any additional clinical documentation needed to support this request.

Thank you for your prompt review.

Sincerely,

${name}
[Phone Number]
[Email Address]

cc: Treating Provider

— — —
NOTE: This is a draft letter generated from the information you provided. Please review carefully, add any missing details (Member ID, contact info, treating provider name), and have your physician review it before submission. This is not medical or legal advice.`;
}

async function generateAiLetter(input: z.infer<typeof generateSchema>): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return buildFallbackLetter(input);

  const client = new OpenAI({ apiKey });
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const system = `You are a healthcare advocacy assistant helping patients write prior authorization appeal letters to their insurance company. Write in a professional, respectful, factual tone using accepted medical-necessity language. Never invent specific clinical facts, dosages, lab values, or guidelines that were not provided. Use placeholders like [Member ID] for missing details. The output must be a complete letter ready to copy, edit, and send.`;

  const user = `Draft a prior authorization request / appeal letter dated ${today} with these details:
- Patient name: ${input.patientName || "(not provided — use [Patient Name] placeholder)"}
- Insurance plan: ${input.insurancePlan || "(not provided — use [Insurance Plan Name] placeholder)"}
- Medication or procedure being requested: ${input.medicationOrProcedure}
- Medical condition / diagnosis: ${input.medicalCondition}
- Prior treatments tried: ${input.priorTreatmentsTried || "(none specified)"}
- Reason for denial (if appealing): ${input.denialReason || "(not an appeal — initial request)"}

Format: standard business letter. Length: 250-400 words. End with a brief disclaimer that this is a draft for the patient to review with their physician and that it is not medical or legal advice.`;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      max_tokens: 900,
    });
    const text = completion.choices?.[0]?.message?.content?.trim();
    return text || buildFallbackLetter(input);
  } catch (err) {
    console.warn("[PriorAuthLetter] OpenAI generation failed, using fallback:", String(err));
    return buildFallbackLetter(input);
  }
}

router.post("/generate", async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parsed.error.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
    });
  }
  try {
    const letter = await generateAiLetter(parsed.data);
    const usingAi = !!process.env.OPENAI_API_KEY;
    res.json({
      letter,
      generatedBy: usingAi ? "ai" : "template",
      generatedAt: new Date().toISOString(),
      disclaimer:
        "This is a draft letter generated from the information you provided. It is not medical or legal advice. Review carefully and consult your physician before submission.",
    });
  } catch (err) {
    console.error("[PriorAuthLetter] generate error:", err);
    res.status(500).json({ error: "Failed to generate letter" });
  }
});

export default router;
