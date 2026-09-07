---
name: trim
description: Cut filler, redundancy, and throat-clearing from text or docs, targeting 40% fewer words with every fact kept. Use for /trim on drafts, READMEs, PR descriptions, UI copy.
argument-hint: <text or file path>
---

# /trim

Input: $ARGUMENTS (if a file path, edit the file in place and show the diff).

1. Count words before.
2. Remove: hedges, restatements, transitions that carry nothing, adjectives without information, sentences that only announce the next sentence.
3. Merge sentences that say one thing twice. Prefer one strong verb over a verb plus noun.
4. Keep every fact, number, name, and instruction. Do not change meaning.
5. Report words before and after. Target is 40% fewer; stop earlier if meaning would be lost.
