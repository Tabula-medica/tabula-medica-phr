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
