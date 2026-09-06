---
name: sentinel
description: Final review pass before commit, push, or release. Checks errors, risks, missed details, and compliance as a checklist. Use for /sentinel or SENTINEL as the last step.
argument-hint: <"diff", PR number, or path>
---

# /sentinel

Target: $ARGUMENTS (default: uncommitted and staged changes).

Run through this checklist and mark each item Pass / Fail / N/A with a one-line note:

- [ ] Typecheck, lint, tests, and guards from `CLAUDE.md` all pass on the current tree
- [ ] No secrets, tokens, credentials, or sensitive data in the diff or logs
- [ ] Every `CLAUDE.md` non-negotiable respected
- [ ] Error paths handled; no swallowed exceptions
- [ ] New behavior has a test; changed behavior has an updated test
- [ ] Registration points updated (routes, exports, migrations, config)
- [ ] Docs, comments, and user-facing strings updated where behavior changed
- [ ] Commit message follows the project format and describes the why
- [ ] Nothing in the diff is outside the task's scope

End with a one-line verdict: **Clear to push** or **Blocked by: …**
