# Agent Hook Unity

Agent Hook Unity is a community effort to define a portable lifecycle-hook
protocol for AI agents and their tooling. It will let agent builders describe
events, hook payloads, hook responses, and security telemetry using a shared,
interoperable model.

The revised 0.1 draft defines eighteen canonical Core `hook_event_name` values across
session and turn lifecycle, user prompts, model requests and responses, tool
use, permission outcomes, subagent delegation, application network requests,
durable memory writes, and configuration changes. Hosts publish the Core
boundaries and gate behavior they can observe and enforce faithfully. Each
per-event capability claim is `gate`, `observe`, `partial`, or `unavailable`;
an unavailable claim is not evidence that the underlying activity did not
occur.

## Status

The repository contains a candidate Agent Hook Unity 0.1 draft for review.
[RFC 0007](rfcs/0007-core-draft-consolidation.md) consolidates the original
RFC 0001 and RFC 0004 proposals with subsequent working-draft changes, the
12 Gate / 6 Observe registry, and the minimum cross-handler deny guarantee.
The canonical wire identifier is `agent-hook-unity/0.1`; see the
[migration guide](schemas/README.md#migrating-the-unaccepted-draft) before
upgrading an integration that uses the former `agent-hooks/0.1` identifier.

The candidate is not an active standard until accepted through the RFC
process. Working files and merged PRs do not substitute for recorded review
and votes. Join the
[GitHub Discussions](https://github.com/trendmicro/agent-hook-unity/discussions)
to help shape it.

## Repository map

- [`rfcs/`](rfcs/README.md) — proposal process and formal RFCs.
- [`spec/`](spec/README.md) — canonical normative specification Markdown.
- [`schemas/`](schemas/README.md) — machine-readable JSON Schemas.
- [`fixtures/`](fixtures/README.md) — schema-validation fixtures.
- [`conformance/`](conformance/gate-composition.md) — behavioral scenarios for host integration tests; not an executed runtime claim.
- [`examples/`](examples/README.md) — illustrative integrations.
- [`website/`](website/) — Docusaurus source for the GitHub Pages site.

## Local setup

Use Node.js 20 or later; CI validates and builds with Node.js 24.
From the repository root, install the validator and website dependencies
separately:

```sh
npm ci
npm ci --prefix website
```

Validate the schemas and fixtures, then build the website:

```sh
npm run validate
npm run build
```

To preview the website locally, run:

```sh
npm start
```

## Participate

Read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing. The decision
process, voting rules, and RFC lifecycle are defined in
[GOVERNANCE.md](GOVERNANCE.md). For sensitive matters, follow
[SECURITY.md](SECURITY.md).

### Keep the website in sync

Every pull request must review its website impact and update affected website
content in the same PR. Follow the [website synchronization checklist](CONTRIBUTING.md#website-synchronization)
for canonical spec pages, site summaries, and published schema copies. Explain
the website updates in the PR, or why no website change is needed.

## Licenses

Specifications and documentation are licensed under
[CC BY 4.0](LICENSE-DOCS). Code, schemas, tooling, and website assets are
licensed under the [MIT License](LICENSE-CODE).
