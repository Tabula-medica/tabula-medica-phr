---
name: digest
description: Read everything supplied (files, threads, docs, logs) and return only what matters: key points, decisions needed, actions. Use for /digest on long documents, PR threads, meeting notes, log dumps.
argument-hint: <file paths, URLs, or pasted content>
---

# /digest

Source: $ARGUMENTS

Read all of it. Then output exactly:

**Key points** (max 7 bullets, one sentence each)
**Decisions needed** (who decides, by when, options)
**Actions** (owner, action, deadline if stated)
**Open questions** (only ones the source itself leaves open)

Nothing else. No summary of the summary. If the source contains sensitive data, do not reproduce it; describe it.
