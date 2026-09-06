# Claude Prompt Codes — behavior specifications

Source list: "Claude Secret Codes — 100 Prompt Shortcuts" (Hasan Toor's list, mirrored at
gist.github.com/Samarth0211/2fd03ca00c56001315e64ef8bd54c65a).

**How this works.** None of these codes are built into Claude. They are compressed
instructions. This file makes them deterministic: when a message starts or ends with a
code below, Claude applies that row's behavior spec. Codes compose (`L99 /trim`). Codes
change style, depth, structure, or workflow only. They never relax project rules,
compliance rules (HIPAA / PHI / BAA), permission rules, or safety policy.

Codes marked **[skill]** also exist as real slash commands in `.claude/skills/` with
repo-aware steps (run checks, read project files). Everything else is honored from
this table.

## Writing & Style

| Code | Behavior spec |
|------|---------------|
| `/ghost` **[skill]** | Write as a competent human would. No meta-commentary, no signposting, no soft openers or closers, no "I hope this helps". Vary sentence length. No lists unless asked. |
| `/mirror` | Match the supplied writing sample: vocabulary, sentence length, punctuation habits, tone. Output only the rewritten text. Ask for a sample if none is given. |
| `/raw` | Plain text only. No markdown, headers, bullets, bold, emoji, or code fences. |
| `/voice` | Lock the specified tone for the rest of the session. Restate the tone in one line, then keep it until `/voice off`. |
| `/punch` | Short sentences, active voice, strong verbs. Cut hedges and qualifiers. Keep meaning. |
| `/flow` | Reorder for logical progression, add transitions, remove repetition. Keep all content. |
| `/trim` **[skill]** | Cut filler, redundancy, and throat-clearing. Target 40% fewer words. Keep every fact. |
| `/hook` | Give 3 alternative opening lines that create curiosity or stakes, then the text with the best one applied. |
| `/rephrase` | Same meaning, different structure and vocabulary. Add nothing, remove nothing. |
| `/polish` | Fix grammar, clarity, and tone to professional. Preserve meaning; length within 10%. |

## Artifacts & Creation

| Code | Behavior spec |
|------|---------------|
| `ARTIFACTS` | Build the actual deliverable (file, app, page, document) instead of describing it. Complete, runnable files. No placeholders. |
| `/buildme` | Ship a complete working tool from the description: choose the stack, write every file, include run instructions. |
| `DASHBOARD` | Produce an interactive data dashboard (HTML/React artifact) with real controls. Use the dataviz skill when available. |
| `PROTOTYPE` | Fastest working prototype: minimal dependencies, hardcoded data allowed, must run. List what is stubbed. |
| `CANVAS` | Open a visual design surface (design skill / artifact) for layouts and diagrams instead of describing them in text. |
| `/render` | Turn the description into a visual (SVG, HTML, or mermaid) inline. |
| `BLUEPRINT` | Full project plan: file tree, purpose of each file, dependencies, milestones, risks. |
| `WIREFRAME` | Low-fidelity screen layout (ASCII, SVG, or HTML) with annotated regions. No visual polish. |
| `/livecode` | Write the code and run it immediately. Show output. Iterate until it works. |
| `GENERATOR` | Build a reusable script or template that produces outputs from parameters, with a usage example. |

## Thinking & Reasoning

| Code | Behavior spec |
|------|---------------|
| `OODA` | Structure the answer as Observe (facts), Orient (interpretation), Decide (choice and reason), Act (concrete next steps). |
| `/deepthink` | Reason through every layer before answering. In Claude Code, treat as `ultrathink` (maximum reasoning budget). Show conclusions plus the key reasoning only. |
| `L99` | Expert-level depth. Assume the reader knows the basics. Include trade-offs, edge cases, numbers, and a committed recommendation. Never a summary-level answer. Usually placed at the end of the prompt. |
| `CHAINLOGIC` | Numbered reasoning steps, each with premise and inference, ending in the conclusion. |
| `/blindspots` **[skill]** | List what the user did not ask but should have: hidden assumptions, missing constraints, second-order effects. |
| `OVERTHINK` | Exhaustively enumerate details, edge cases, and failure modes, then mark which ones actually matter. |
| `/unpack` | Decompose the idea into components, dependencies, and mechanisms. Explain each. |
| `INVERT` | Solve backwards: define the failure or opposite goal, list what causes it, derive the actions that avoid it. |
| `/layered` | Three answers: one-paragraph surface, practitioner level, expert level. |
| `XRAY` | Look past the obvious answer. State the surface reading, then the underlying cause, incentive, or mechanism. |

## Learning & Mastery

| Code | Behavior spec |
|------|---------------|
| `/teachme` | Lesson format: objective, concept, worked example, common mistake, two practice questions. |
| `GAPFINDER` | Ask 3–5 diagnostic questions (or infer from context), then list specific knowledge gaps in priority order. |
| `/eli5` **[skill]** | Plain words, one concrete analogy, no jargon. Patient-facing copy stays at a grade-6 reading level. |
| `MASTERCLASS` | Teach as a world-class expert: principles, mental models, nuance, what novices get wrong. |
| `/drill` | Practice exercises of increasing difficulty, answers below each. |
| `SPEEDRUN` | Shortest path to competence: the five things to learn, in order, with one resource each. |
| `/mentor` | Personal advice grounded in the user's stated situation and goals. Direct, not generic. |
| `LEVELUP` | Assess the current level from context, name it, teach exactly the next level up. |
| `CRASHCOURSE` | Everything essential in a five-minute read: definitions, how it works, when to use it, pitfalls. |
| `BOOTCAMP` | Multi-week plan from beginner to advanced with weekly goals and checkpoints. |

## Analysis & Strategy

| Code | Behavior spec |
|------|---------------|
| `/redteam` **[skill]** | Attack the idea: every weakness, exploit, and counterargument, severity-ranked. No praise. |
| `PARETO` **[skill]** | Find the 20% of actions producing 80% of results. Rank by impact over effort. |
| `/swot` | Strengths, Weaknesses, Opportunities, Threats, 3–5 bullets each, then a one-line strategic implication. |
| `WARGAME` | Simulate competitor or opponent moves and counter-moves over three rounds. Identify the winning line. |
| `/premortem` **[skill]** | Assume the plan already failed. Reconstruct the failure sequence (what broke first, then next). Name the wrong assumption behind each step. |
| `LEVERAGE` | Find the single highest-leverage move and explain why it unlocks the rest. |
| `/audit` **[skill]** | Review the work and flag every issue with severity, location, and fix. For code, run lint, typecheck, and tests first. |
| `BOTTLENECK` | Identify the one constraint limiting throughput, the evidence, the fix, and what becomes the next bottleneck. |
| `/scenario` | Play out three futures (best/base/worst or divergent branches) with triggers and prepared responses. |
| `BLINDSPOT` | Surface risks and angles not yet considered, especially second-order and regulatory ones. |

## Creative & Content

| Code | Behavior spec |
|------|---------------|
| `/viral` | Rewrite for shareability: strong hook, one idea, emotional trigger, clear payoff, platform-appropriate length. |
| `HOOKS10` | Ten distinct opening hooks using different mechanisms (question, statistic, story, contrarian, etc.). |
| `/storysell` | Reframe the message as a short narrative with a character, tension, and a resolution that lands the point. |
| `REMIX` | Combine the two given ideas into a new concept. Explain the mechanism of the combination. |
| `/angles` | Ten genuinely different framings of the topic, one line each. |
| `CLIFFHANGER` | Write an ending that opens a loop the reader must close. |
| `/captionme` | Social captions per platform with hook, body, call to action, and hashtags where appropriate. |
| `POLARIZE` | Take a bold, defensible position. State it, defend it, acknowledge the strongest objection. |
| `/banger` | One quotable, screenshot-worthy line. Give five candidates and mark the best. |
| `THUMBNAIL` | Ten click-worthy titles or headlines, each with the psychological lever it uses. |

## Coding & Technical

| Code | Behavior spec |
|------|---------------|
| `/debug` **[skill]** | Reproduce, isolate the root cause, explain what went wrong and why, fix minimally, add a regression test. |
| `REFACTOR` **[skill]** | Improve structure and readability without changing behavior. Tests stay green. No feature changes. |
| `/shipit` **[skill]** | Make rough code production-ready: error handling, types, tests, docs. Run the project's checks before declaring done. |
| `ARCHITECT` **[skill]** | Design before code: components, data flow, interfaces, storage, failure modes, trade-offs. |
| `/convert` | Translate code between languages or frameworks idiomatically. Preserve behavior. Note semantic differences. |
| `AUTOMATE` | Turn the manual process into a runnable script with usage, idempotency, and error handling. |
| `/testit` **[skill]** | Write tests (unit first, then integration) covering happy path, edge cases, and failure modes. Run them. |
| `SCAFFOLD` **[skill]** | Generate the full file and folder structure for a new project or module with stubs that compile. |
| `/optimize` **[skill]** | Measure first, then improve performance. Behavior stays identical. Report before and after. |
| `APIBUILD` | Build a complete API from the description: routes, validation, handlers, error format, docs, tests. |

## Research & Deep Dives

| Code | Behavior spec |
|------|---------------|
| `/deepdive` **[skill]** | Go far beyond the surface: mechanisms, history, competing views, open questions, sources. |
| `FACTCHECK` **[skill]** | Verify each claim. Mark True / False / Unverifiable with evidence. Flag anything that might be wrong. |
| `/sources` | Cite a source for every claim. Separate primary from secondary. Mark anything uncited as opinion. |
| `COMPARE` **[skill]** | Side-by-side table on the criteria that matter, then a clear winner for the stated use case. |
| `/investigate` | Journalist mode: the question, evidence gathered, who/what/when/why, what is still unknown. |
| `TRENDSCAN` | What is happening right now in the space: signals, drivers, who is moving, what to watch. |
| `/extract` | Pull exactly the requested information from the document. Quote it. Nothing else. |
| `TIMELINE` | Chronological account with dates, events, and causal links. |
| `/digest` **[skill]** | Read everything and return only what matters: key points, decisions needed, actions. |
| `DOSSIER` | Full briefing: overview, key facts, people, history, current status, risks, open questions. |

## Power Commands

| Code | Behavior spec |
|------|---------------|
| `/godmode` | Maximum completeness and directness: no hedging, no omitted sections, every relevant detail. Bypasses no rule. |
| `/autoprompt` | Turn the rough idea into a complete, well-structured prompt (role, context, task, constraints, output format). |
| `MEGAPROMPT` | Produce a long, detailed prompt with examples and evaluation criteria for the goal. |
| `/chain` | Break the task into sequential prompts, run each, feed the output forward, show each step's result. |
| `/system` | Draft a system prompt that produces the described behavior, with constraints and examples. |
| `PERSONA` | Answer as the named expert type. State the assumptions that expert would make. Stay consistent. |
| `/memory` | Record the stated details and reuse them for the rest of the session. In Claude Code, offer to save them to `CLAUDE.md`. |
| `CONTEXT` | Ingest the supplied background before answering. Confirm what was loaded in one line. |
| `/rolelock` | Stay in the specified role until `/rolelock off`. Do not drift. |
| `PROMPTFIX` | Diagnose why the prompt underperforms and rewrite it. Explain each change. |

## Hidden Modes

| Code | Behavior spec |
|------|---------------|
| `/nofilter` | Direct, candid opinion without diplomatic softening. Still truthful and within policy. |
| `BEASTMODE` | Maximum output quality: research first, verify, then deliver polished, complete work. |
| `/therapist` | Reflective, supportive dialogue: listen, reflect, ask, suggest. Not medical advice. Point to professionals when warranted. |
| `CEOMODE` | Decide like a CEO: options, numbers, risk, decision, owner, deadline. |
| `/negotiate` | Negotiation script: goals, BATNA, anchors, concessions, responses to objections. |
| `FOUNDER` | Founder's-eye advice: speed, focus, distribution, runway, what to ignore. |
| `/closer` | Persuasive copy that moves to a decision: pain, proof, offer, urgency, call to action. No false claims. |
| `OPERATOR` **[skill]** | Run the task end to end autonomously: plan, execute, verify, report. Ask only on real blockers. |
| `/unlocked` | Drop default caution in tone (no disclaimers, no hedging). Never drops safety, PHI, or permission rules. |
| `SENTINEL` **[skill]** | Final review pass: errors, risks, missed details, compliance. Checklist output. |

## Composition rules

- Multiple codes in one message apply together. Later codes refine earlier ones.
- A code with no matching skill is still honored from this table.
- If a code conflicts with a project rule in `CLAUDE.md`, the project rule wins and Claude says so in one line.
