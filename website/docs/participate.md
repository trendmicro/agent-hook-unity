---
sidebar_position: 2
---

# Participate

GitHub Discussions is the home for questions, ideas, use cases, and RFC
proposals. Start there before opening a formal RFC pull request.

Discussions was enabled on 2026-09-21. The current consolidation candidate is
preparatory material and has not started formal review; see
[RFC 0007](https://github.com/trendmicro/agent-hook-unity/blob/main/rfcs/0007-core-draft-consolidation.md)
for its scope and pending decision record.

Use GitHub Issues for reproducible repository problems, such as a broken link,
an invalid fixture, or a failing build. Sensitive reports belong in the private
channel described by the repository security policy.

For contribution expectations, read
[CONTRIBUTING.md](https://github.com/trendmicro/agent-hook-unity/blob/main/CONTRIBUTING.md).

## Keep the website in sync

Every PR must review website impact and update affected website content in
the same PR. This includes summaries of spec changes, event names and counts,
examples, schema downloads, contributor guidance, and proposal status.

- The specification pages render `spec/` directly, except `spec/README.md`.
- Site summaries in `website/docs/` and schema copies in
  `website/static/schemas/0.1/` require corresponding updates.
- Root Markdown and RFC files are not automatically mirrored to website pages.
  Describe unaccepted proposals as drafts, not adopted behavior.
- Explain website updates, or why none are needed, in the PR's **Website impact**
  section. Run `npm run validate` and `npm run build` before requesting review.

See the full [website synchronization checklist](https://github.com/trendmicro/agent-hook-unity/blob/main/CONTRIBUTING.md#website-synchronization).
PR checks build the site; publication normally happens after merge to `main`
through the Pages deployment workflow.
