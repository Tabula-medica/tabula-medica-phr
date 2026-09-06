# Tabula Medica PHR — Claude Code project memory

Tabula Medica is a HIPAA-regulated patient health record PWA: React/TypeScript client
(`client/`), Express + Drizzle server (`server/`), shared types (`shared/`), Expo config
(`app.json`, `eas.json`) and Capacitor wrappers (`ios/`, `android/`) for native builds. Full topology and
architecture decisions live in `replit.md`. Roadmap and program docs live in
`.local/deliverables/` (start with `tm-comprehensive-roadmap.md`).

## Non-negotiables (no prompt code overrides these)

- PHI-bearing AI calls go to Vertex AI under the Google BAA. Never OpenAI, Anthropic, or the
  consumer Gemini API for PHI. CI enforces this with `scripts/phi-ai-guard.sh`.
- Never log, email, or commit PHI. Operational alert emails stay PHI-free even though the
  provider is BAA-eligible.
- Do not claim SOC 2 or HITRUST certification in any copy; say "aligned with" at most.
- New public pages must be added to the public route lists in `client/src/App.tsx` or they
  silently render the landing page for logged-out users.
- After bumping dependencies, re-run `npm audit` and maintain the `overrides` block in
  `package.json`.
- Ask before major or destructive changes. Keep diffs minimal and scoped.

## Commands

```
npm run dev          # dev server (tsx server/index.ts)
npm run check        # typecheck (tsc)
npm run lint         # eslint .
npm test             # vitest run
npm run build        # production build
npm run db:push      # drizzle-kit push
bash scripts/phi-ai-guard.sh   # PHI-AI boundary guard (must pass before push)
```

Tests live in `tests/*.spec.ts` (Vitest). Custom lint rule: `eslint-rules/no-string-form-logger.js`.

## Conventions

- TypeScript everywhere, functional style preferred, Zod for validation.
- Commit messages: `type(scope): summary` (see `git log`).
- Region-gated features: US vs International flags; keep regulatory copy per region.
- 19 UI languages via `client/src/components/language-provider.tsx`; new user-facing strings go
  through that layer, never hardcoded.

<!-- claude-prompt-codes:begin -->
## Prompt codes ("Claude Secret Codes")

When a message starts or ends with a code from `.claude/prompt-codes.md` (for example
`/ghost`, `/redteam`, `/premortem`, `L99`, `OODA`, `PARETO`, `OPERATOR`), apply that
code's behavior spec. Rules:

- Codes change style, depth, structure, or workflow only. They never relax project rules,
  compliance rules, permission rules, or safety policy. If a code conflicts with a project
  rule, the project rule wins; say so in one line.
- Codes compose: `L99 /trim` means expert depth, then cut 40% of the words.
- Codes with a matching skill in `.claude/skills/` run as slash commands with repo-aware
  steps. All other codes are honored from the reference table.
- `/deepthink` maps to `ultrathink`. `/memory` may offer to persist details into `CLAUDE.md`.

Quick reference (full table in `.claude/prompt-codes.md`):

| Need | Codes |
|------|-------|
| Human-sounding, tight copy | `/ghost` `/trim` `/punch` `/polish` `/eli5` |
| Rigor before shipping | `/redteam` `/premortem` `/audit` `SENTINEL` `/blindspots` |
| Engineering workflows | `/debug` `REFACTOR` `/shipit` `/testit` `ARCHITECT` `SCAFFOLD` `/optimize` |
| Depth and structure | `L99` `OODA` `CHAINLOGIC` `/layered` `/deepdive` `COMPARE` `FACTCHECK` `/digest` |
| Prioritization and execution | `PARETO` `LEVERAGE` `BOTTLENECK` `OPERATOR` `CEOMODE` |

Real Claude Code commands and shortcuts (documented, not viral): `.claude/claude-code-cheatsheet.md`.
<!-- claude-prompt-codes:end -->
