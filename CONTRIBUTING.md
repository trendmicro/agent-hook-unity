# Contributing to Agent Hook Unity

Thank you for your interest in improving the Agent Hook Unity. We welcome
documentation corrections, schema and example improvements, feature proposals,
and fixes.

## Before you contribute

- Keep contributions focused, well explained, and consistent with the existing
  specification and examples.
- Do not include secrets, credentials, access keys, or proprietary product
  code.
- If your change adds or updates third-party material, make sure its license is
  compatible with this repository.

## Discussing ideas and reporting issues

Use [GitHub Discussions](https://github.com/trendmicro/agent-hook-unity/discussions)
for questions, ideas, use cases, and proposed changes to the Agent Hook Unity.
Start a discussion before drafting an RFC so the community can help shape the
proposal.

Use GitHub Issues only for reproducible repository defects, such as a broken
link, invalid fixture, build failure, or problem with this website. Include
enough detail for maintainers to understand and reproduce the problem. Helpful
details include:

- The affected file, section, schema field, or example.
- What you expected and what you observed.
- A concise proposed correction or use case, where applicable.

For substantial changes to the protocol, schema, or semantics, follow the RFC
process in [GOVERNANCE.md](GOVERNANCE.md). A formal RFC pull request must link
to its prior GitHub Discussion.

The repository's existing unaccepted draft files include a consolidated
candidate described by [RFC 0007](rfcs/0007-core-draft-consolidation.md).
They are preparatory review material, not a record of completed governance.
Discussions was enabled on 2026-09-21; formal review still requires a linked
Discussion and the normal review window and votes. Do not mark a proposal
Accepted merely because its candidate files have been merged.

## Contributing changes

1. Fork the repository and clone your fork locally.
2. Create a descriptive branch for one feature, fix, or documentation update.
3. Make the change. Keep JSON examples valid and update related schema,
   documentation, and comparison files when needed. Review website impact and
   update affected website content in the same PR using the checklist below.
4. Use Node.js 20 or later (CI uses Node.js 24). From the repository root,
   install dependencies and run validation and the website build:

   ```sh
   npm ci
   npm ci --prefix website
   npm run validate
   npm run build
   ```

5. Commit with a clear, meaningful message.
6. Push the branch to your fork.
7. Open a pull request against this repository. Explain what changed, why it is
   needed, and how you validated it. Link the related Discussion, Issue, or RFC
   when one exists.

## Pull request expectations

- Keep pull requests small and focused where practical.
- Ensure all checks pass before requesting review.
- Include documentation and examples for user-visible schema changes.
- Describe website impact and update affected pages and downloads in the same
  PR. If no website change is needed, explain why.
- Respond to review feedback and update the pull request as needed.
- Be respectful and constructive in all project interactions.

## Website synchronization

Every PR must check whether its changes affect the website. Changes to the
specification, examples, event names or counts, schema downloads, project
status, or contributor guidance must update the affected website content in
the same PR. Do not defer known website corrections to a separate PR.

| Changed source | Website synchronization required |
| --- | --- |
| Canonical specification in `spec/` | The website renders these files directly. Edit the canonical source; check site summaries and navigation for related changes. `spec/README.md` is excluded from publication. |
| Event semantics, counts, examples, or conformance guidance | Check the overview and conformance pages in `website/docs/`, plus any affected site examples. Update their descriptions alongside the canonical source. |
| Schemas in `schemas/` | Update the matching downloads in `website/static/schemas/0.1/` for the current version, keeping each copy identical. Update affected download links and guidance. |
| Contributor guidance, governance, or project status | Update the affected summaries in `website/docs/participate.md`, `governance.md`, and `intro.md`. Root Markdown files are not automatically mirrored there. |
| RFC proposals or decisions | Keep any affected website proposal summaries, status labels, and links current. Clearly label unaccepted proposals as drafts. `rfcs/` is not automatically rendered, and a proposal must not be presented as adopted behavior. |
| Website pages or navigation | Update the appropriate `website/docs/` or `website/src/` source and, when needed, the sidebars or Docusaurus configuration. |

Before requesting review:

1. List affected pages, downloads, or directly rendered spec sources in the
   PR's **Website impact** section. If none are affected, explain why; a
   website-only edit is not required when there is no website impact.
2. Check the resulting pages, links, event counts, and draft/accepted labels.
   Run `npm start` for a local preview when needed.
3. Run `npm run validate` and `npm run build` from the repository root using
   the setup above. A successful build checks rendering and links; it does
   not prove that summaries accurately describe the changed specification.
4. Complete the PR checklist, including website synchronization.

PR CI validates and builds the website. Opening or updating a PR does not
publish it to the live site. The Pages workflow deploys after a push to `main`
(normally a merge), and also supports manual dispatch. Keep generated output
such as `website/build/` and `website/.docusaurus/` out of commits.

## Security concerns

Do not report security-sensitive issues in a public GitHub issue. Follow
[SECURITY.md](SECURITY.md) to report them privately.

## Contact

For questions, use [GitHub Discussions](https://github.com/trendmicro/agent-hook-unity/discussions)
or contact a [maintainer](GOVERNANCE.md#active-maintainers).

Thank you for helping make this specification clearer, more reliable, and more
useful.
