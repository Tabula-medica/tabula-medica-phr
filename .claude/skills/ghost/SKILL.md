---
name: ghost
description: Write or rewrite text so it reads as human-written. No meta-commentary, signposting, soft openers, or AI closers. Use for /ghost on emails, UI copy, marketing, outreach, docs.
argument-hint: <text to rewrite, or a writing brief>
---

# /ghost

Input: $ARGUMENTS

Rules for the output:
- No opener that announces the text ("Here's a draft"), no closer ("Hope this helps", "Let me know").
- No signposting ("In this section", "It's worth noting"), no tricolons by default, no em-dash chains.
- Vary sentence length. Use concrete nouns and verbs. Cut adjectives that carry no information.
- Match the register the audience expects (a patient, a clinician, an investor, a developer).
- No lists or headers unless the brief asks for them.
- Keep every fact. Do not invent claims, numbers, or credentials.

Output only the text. Nothing before or after it.
