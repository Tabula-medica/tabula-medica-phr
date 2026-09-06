#!/usr/bin/env bash
# Install the Claude prompt-code bundle (CLAUDE.md protocol + reference tables + slash-command
# skills) into another repository, or globally so it applies to every Claude Code session.
#
# Usage:
#   bash scripts/install-claude-codes.sh --repo /path/to/other-project   # per-project
#   bash scripts/install-claude-codes.sh --global                        # ~/.claude (all projects)
#   bash scripts/install-claude-codes.sh --repo PATH --replit            # also mirror .agents/skills
#   bash scripts/install-claude-codes.sh --dry-run --repo PATH
#
# Idempotent: re-running updates files in place; the CLAUDE.md block is replaced between markers.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$HERE/.claude"
BEGIN='<!-- claude-prompt-codes:begin -->'
END='<!-- claude-prompt-codes:end -->'

TARGET=""; MODE=""; REPLIT=0; DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --repo) MODE=repo; TARGET="$2"; shift 2 ;;
    --global) MODE=global; TARGET="${HOME}"; shift ;;
    --replit) REPLIT=1; shift ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done
[ -n "$MODE" ] || { echo "need --repo PATH or --global" >&2; exit 2; }
[ -d "$SRC/skills" ] || { echo "source bundle missing at $SRC" >&2; exit 1; }

run(){ if [ "$DRY" = 1 ]; then echo "+ $*"; else "$@"; fi; }

DEST="$TARGET/.claude"
MEMORY="$TARGET/CLAUDE.md"
[ "$MODE" = global ] && MEMORY="$DEST/CLAUDE.md"

run mkdir -p "$DEST/skills"
run cp "$SRC/prompt-codes.md" "$DEST/prompt-codes.md"
run cp "$SRC/claude-code-cheatsheet.md" "$DEST/claude-code-cheatsheet.md"
# In global mode the block lives in ~/.claude/CLAUDE.md, so its paths must be absolute to ~/.claude.
SNIP="$SRC/CLAUDE.snippet.md"
if [ "$MODE" = global ]; then
  SNIP="$(mktemp)"; sed 's#`\.claude/#`~/.claude/#g' "$SRC/CLAUDE.snippet.md" > "$SNIP"
fi
run cp "$SNIP" "$DEST/CLAUDE.snippet.md"
for d in "$SRC"/skills/*/; do
  name="$(basename "$d")"
  run mkdir -p "$DEST/skills/$name"
  run cp "$d/SKILL.md" "$DEST/skills/$name/SKILL.md"
done

# Insert or replace the protocol block in CLAUDE.md.
if [ "$DRY" = 1 ]; then
  echo "+ upsert prompt-codes block into $MEMORY"
else
  mkdir -p "$(dirname "$MEMORY")"
  touch "$MEMORY"
  if grep -qF "$BEGIN" "$MEMORY"; then
    awk -v b="$BEGIN" -v e="$END" -v snip="$SNIP" '
      $0==b { while ((getline line < snip) > 0) print line; skip=1; next }
      $0==e { skip=0; next }
      !skip { print }' "$MEMORY" > "$MEMORY.tmp" && mv "$MEMORY.tmp" "$MEMORY"
  else
    { [ -s "$MEMORY" ] && printf '\n'; cat "$SNIP"; } >> "$MEMORY"
  fi
fi

if [ "$REPLIT" = 1 ]; then
  run mkdir -p "$TARGET/.agents/skills/prompt-codes"
  run cp "$HERE/.agents/skills/prompt-codes/SKILL.md" "$TARGET/.agents/skills/prompt-codes/SKILL.md"
fi

echo "Installed prompt-code bundle -> $DEST ($(ls "$SRC/skills" | wc -l | tr -d ' ') skills); memory: $MEMORY"
