import { Router } from "express";
import { generatePhiSafeText } from "./services/ai-gateway";

const router = Router();

function logPhiAccess(action: string, details: Record<string, unknown>): void {
  console.log(JSON.stringify({
    type: "HIPAA_AUDIT",
    timestamp: new Date().toISOString(),
    component: "AITimelineAssistant",
    action,
    details,
  }));
}

const SYSTEM_PROMPT = `You are a supportive AI Timeline Assistant for patients on their treatment journey. Your role is to:

1. EXPLAIN treatment phases, milestones, and medical terms in plain language
2. PROVIDE context about what each step in the journey means
3. ANSWER questions about the treatment timeline
4. OFFER encouragement and emotional support
5. HELP patients understand what to expect next

CRITICAL COMPLIANCE RULES (NO-CDS - No Clinical Decision Support):
- You are NOT a medical professional and CANNOT provide medical advice
- NEVER recommend specific treatments, medications, or dosages
- NEVER suggest changing or stopping any treatment
- ALWAYS encourage patients to consult their care team for medical questions
- Include educational disclaimers when explaining medical concepts

Your tone should be:
- Warm, empathetic, and supportive
- Clear and easy to understand (avoid complex medical jargon)
- Encouraging without being dismissive of concerns
- Honest about what you can and cannot help with

When answering questions:
- Focus on explaining what things mean, not what patients should do
- Provide general educational information only
- Validate patient feelings and concerns
- Remind patients their care team is their best resource for medical decisions`;

interface TimelineContext {
  condition: string;
  conditionSubtype?: string;
  currentPhase: string;
  overallProgress: number;
  phases: {
    name: string;
    status: string;
    progress: number;
  }[];
  upcomingMilestones?: string[];
  recentActivity?: string[];
}

router.post("/ask", async (req, res) => {
  try {
    const { question, context } = req.body as {
      question: string;
      context?: TimelineContext;
    };

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Question is required" });
    }

    logPhiAccess("AI_TIMELINE_QUESTION", {
      questionLength: question.length,
      hasContext: !!context,
    });

    let contextMessage = "";
    if (context) {
      contextMessage = `
Current Treatment Context:
- Condition: ${context.condition}${context.conditionSubtype ? ` (${context.conditionSubtype})` : ""}
- Current Phase: ${context.currentPhase}
- Overall Progress: ${context.overallProgress}%
- Treatment Phases: ${context.phases.map(p => `${p.name} (${p.status}, ${p.progress}%)`).join(", ")}
${context.upcomingMilestones ? `- Upcoming: ${context.upcomingMilestones.join(", ")}` : ""}
${context.recentActivity ? `- Recent Activity: ${context.recentActivity.join(", ")}` : ""}
`;
    }

    const userPrompt = contextMessage
      ? `Here is my current treatment context:\n${contextMessage}\n\n${question}`
      : question;

    const answer = (await generatePhiSafeText({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 1024,
    })) || "I'm sorry, I couldn't generate a response. Please try again.";

    logPhiAccess("AI_TIMELINE_RESPONSE", {
      responseLength: answer.length,
    });

    res.json({
      answer,
      disclaimer: "This information is for educational purposes only. Always consult your healthcare team for medical advice.",
    });
  } catch (error) {
    console.error("[AI Timeline Assistant] Error:", error);
    res.status(500).json({ error: "Failed to get AI response" });
  }
});

router.post("/explain-phase", async (req, res) => {
  try {
    const { phaseName, phaseDescription, condition } = req.body;

    if (!phaseName) {
      return res.status(400).json({ error: "Phase name is required" });
    }

    logPhiAccess("AI_EXPLAIN_PHASE", { phaseName, condition });

    const explanation = (await generatePhiSafeText({
      system: SYSTEM_PROMPT,
      user: `Please explain this treatment phase in simple, supportive terms:

Phase: ${phaseName}
${phaseDescription ? `Description: ${phaseDescription}` : ""}
${condition ? `For condition: ${condition}` : ""}

Include:
1. What this phase typically involves
2. What patients commonly experience
3. How long it usually lasts
4. Tips for getting through it
5. What comes after this phase

Remember to be encouraging and add an educational disclaimer.`,
      maxTokens: 1024,
    })) || "Unable to generate explanation.";

    res.json({
      explanation,
      disclaimer: "This is general educational information. Your specific treatment may differ.",
    });
  } catch (error) {
    console.error("[AI Timeline Assistant] Explain phase error:", error);
    res.status(500).json({ error: "Failed to explain phase" });
  }
});

router.post("/explain-milestone", async (req, res) => {
  try {
    const { milestoneTitle, milestoneType, phaseName, condition } = req.body;

    if (!milestoneTitle) {
      return res.status(400).json({ error: "Milestone title is required" });
    }

    logPhiAccess("AI_EXPLAIN_MILESTONE", { milestoneTitle, milestoneType });

    const explanation = (await generatePhiSafeText({
      system: SYSTEM_PROMPT,
      user: `Please explain this treatment milestone in simple, supportive terms:

Milestone: ${milestoneTitle}
Type: ${milestoneType || "Unknown"}
${phaseName ? `Part of phase: ${phaseName}` : ""}
${condition ? `For condition: ${condition}` : ""}

Include:
1. What this milestone involves
2. What to expect during/after
3. Why it's important in the treatment journey
4. Any common questions patients have

Be encouraging and add an educational disclaimer.`,
      maxTokens: 800,
    })) || "Unable to generate explanation.";

    res.json({
      explanation,
      disclaimer: "This is general educational information. Ask your care team about your specific situation.",
    });
  } catch (error) {
    console.error("[AI Timeline Assistant] Explain milestone error:", error);
    res.status(500).json({ error: "Failed to explain milestone" });
  }
});

router.post("/summarize-progress", async (req, res) => {
  try {
    const { context } = req.body as { context: TimelineContext };

    if (!context) {
      return res.status(400).json({ error: "Context is required" });
    }

    logPhiAccess("AI_SUMMARIZE_PROGRESS", {
      condition: context.condition,
      currentPhase: context.currentPhase,
    });

    const summary = (await generatePhiSafeText({
      system: SYSTEM_PROMPT,
      user: `Please provide an encouraging summary of this patient's treatment progress:

Condition: ${context.condition}${context.conditionSubtype ? ` (${context.conditionSubtype})` : ""}
Current Phase: ${context.currentPhase}
Overall Progress: ${context.overallProgress}%
Treatment Phases: ${context.phases.map(p => `${p.name} (${p.status}, ${p.progress}%)`).join(", ")}
${context.upcomingMilestones ? `Upcoming: ${context.upcomingMilestones.join(", ")}` : ""}

Please include:
1. A warm acknowledgment of how far they've come
2. What they've accomplished
3. What's ahead in simple terms
4. Words of encouragement

Keep the tone supportive and celebratory of their progress.`,
      maxTokens: 800,
    })) || "Unable to generate summary.";

    res.json({
      summary,
      disclaimer: "This summary is for encouragement only. Discuss your specific progress with your care team.",
    });
  } catch (error) {
    console.error("[AI Timeline Assistant] Summarize progress error:", error);
    res.status(500).json({ error: "Failed to summarize progress" });
  }
});

export default router;
