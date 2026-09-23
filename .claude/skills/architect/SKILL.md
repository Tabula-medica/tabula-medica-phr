---
name: architect
description: Design the full system structure before writing code. Components, data flow, interfaces, storage, failure modes, trade-offs. Use for /architect or ARCHITECT, "design this feature", "how should we structure X".
argument-hint: <feature or system to design>
---

# /architect

Design target: $ARGUMENTS

1. Read `CLAUDE.md` and the relevant existing modules so the design fits the codebase.
2. Deliver, in this order:
   - **Goals and non-goals** (3 bullets each)
   - **Components** and their responsibilities
   - **Data flow** (a mermaid diagram plus a paragraph)
   - **Interfaces**: API routes, types, schemas, events
   - **Storage and migrations**
   - **Failure modes** and how each is handled
   - **Compliance and security** considerations required by `CLAUDE.md`
   - **Trade-offs**: the two alternatives considered and why they lost
   - **Build order**: milestones with the first PR scoped to one day
3. Do not write implementation code unless asked. Stop at the design.
