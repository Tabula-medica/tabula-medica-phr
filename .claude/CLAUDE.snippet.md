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
## Architecture diagrams (Archify, evidence-only)

`/archify` is vendored in `.claude/skills/archify/` (MIT). When asked for a diagram of this repo:

- Only draw boxes you can prove from code. Cite `file:line` in each component's `sources`.
  If a component cannot be proven, omit it. Never invent Redis, Kafka, gateways, queues, or
  services that are not in the repo.
- 8 to 12 nodes, one main path, side branches short. Extra detail goes in `cards`, not nodes.
- Write `./<topic>.architecture.json`, then run from the repo root:
  `node .claude/skills/archify/bin/archify.mjs validate architecture <topic>.architecture.json --quality showcase --repo-root .`
  and `... deliver architecture <topic>.architecture.json <topic>.html --quality showcase --repo-root .`
- A non-zero validate or deliver is never success. Fix only the diagnosed subject and rerun.
- Never put the literal words `undefined`, `NaN`, or `Infinity` in labels or notes: the finite-SVG
  check matches them as broken coordinates. Write "no entry" instead.
- Worked example: `cache-miss.architecture.json` and `cache-miss.html` at the repo root.
<!-- claude-prompt-codes:end -->
