---
name: factcheck
description: Verify each claim in a text and mark it True, False, or Unverifiable with evidence. Flags anything that might be wrong. Use for /factcheck or FACTCHECK on copy, docs, compliance statements, marketing claims.
argument-hint: <text, file, or URL>
---

# /factcheck

Input: $ARGUMENTS

1. Extract every checkable claim (facts, numbers, dates, certifications, legal statements, technical assertions).
2. For each: verdict **True / False / Unverifiable**, the evidence or source (code, docs, web), and the corrected wording if false.
3. Flag claims that are technically true but misleading.
4. For compliance or certification claims, apply the project's rules in `CLAUDE.md` (for example, "aligned with" versus "certified").
5. End with a list of edits to make, in order.
