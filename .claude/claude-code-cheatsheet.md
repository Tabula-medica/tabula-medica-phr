# Claude Code — real commands, shortcuts, and flags

These are documented Claude Code features (not prompt codes). Official reference:
https://code.claude.com/docs/en/commands

## Slash commands worth using daily

| Command | What it does |
|---------|--------------|
| `/help` | List commands |
| `/clear` | Fresh conversation (previous stays resumable) |
| `/compact [focus]` | Summarize context to free space; run at ~70% usage |
| `/context` | Show context consumption |
| `/status` | Version, model, account, connectivity |
| `/model [name]` | Switch model mid-session |
| `/effort [level]` | Change reasoning effort |
| `/plan` | Enter Plan Mode (explore and propose, no edits) |
| `/code-review [--fix]` | Review diff or PR for bugs; `--fix` applies findings |
| `/security-review` | Review pending changes for vulnerabilities |
| `/simplify` | Quality-only cleanup pass (reuse, simplification, efficiency) |
| `/loop <interval> <cmd>` | Run a command on a schedule |
| `/init` | Generate a starter `CLAUDE.md` |
| `/config` | Settings panel |
| `/mcp` | Manage MCP servers |
| `/resume` / `/branch` / `/rename` / `/export` | Session management |
| `/usage` (`/cost`) | Token and cost stats |
| `/doctor` | Verify installation health |

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Shift+Tab` | Cycle permission modes (default → acceptEdits → plan → auto) |
| `Esc` | Interrupt the current response or tool call |
| `Esc Esc` | Rewind / clear draft |
| `Ctrl+C` | Interrupt; twice exits |
| `Ctrl+O` | Toggle transcript viewer |
| `Ctrl+R` | Reverse-search history |
| `Ctrl+T` | Toggle task list |
| `Alt/Option+T` | Toggle extended thinking |
| `Alt/Option+P` | Switch model |
| `@path/to/file` | Attach a file to the prompt |
| `!command` | Run a shell command inline |

## Prompt-level features that genuinely change behavior

- `ultrathink` in a prompt raises the reasoning budget (this one is documented, unlike the viral "secret codes").
- `CLAUDE.md` at repo root is loaded every session. `~/.claude/CLAUDE.md` is loaded for every project.
- `.claude/skills/<name>/SKILL.md` becomes `/<name>`; `$ARGUMENTS` receives what follows the command.
- `.claude/agents/<name>.md` defines subagents; `.claude/settings.json` holds hooks and permissions.

## CLI flags

| Flag | Purpose |
|------|---------|
| `-p "query"` | Non-interactive (CI) |
| `-c` / `--continue` | Resume last session |
| `-r <id>` / `--resume` | Resume a specific session |
| `--model <name>` | Model for the session |
| `--permission-mode plan` | Start in Plan Mode |
| `--add-dir <path>` | Extra working directories |
| `--allowedTools` / `--disallowedTools` | Tool allow/deny lists |
| `--output-format json` | Machine-readable output for scripting |
| `--max-turns N` | Cap agentic turns in print mode |
| `--dangerously-skip-permissions` | Skip prompts (sandboxed CI only) |

## Context hygiene

- 0–50% context: work freely. 50–70%: be selective. 70–90%: `/compact`. 90%+: `/clear`.
- Commit after each completed task.
- Read every diff before accepting.
