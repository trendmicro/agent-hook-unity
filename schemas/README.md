# Schemas

This directory contains machine-readable JSON Schemas for Agent Hook Unity
versions. The 0.1 draft defines `hook-event.schema.json` and
`hook-response.schema.json`. Each schema declares JSON Schema Draft 2020-12,
a stable `$id`, and a descriptive `title`.

The canonical `spec` value is `agent-hook-unity/0.1`. Each schema's `$id`
matches its published download URL:

- [Request schema](https://trendmicro.github.io/agent-hook-unity/schemas/0.1/hook-event.schema.json).
- [Response schema](https://trendmicro.github.io/agent-hook-unity/schemas/0.1/hook-response.schema.json).

The files in `website/static/schemas/0.1/` must be identical to the canonical
files here; `npm run validate` checks this. The Pages workflow publishes the
new files after merge to main; a local change or PR does not update the live
downloads.

## Migrating the unaccepted draft

[RFC 0007](../rfcs/0007-core-draft-consolidation.md) changes the previous
`agent-hooks/0.1` identifier to distinguish this contract from the separate
Responsible AI Agent Hooks contract. New schemas reject the old identifier.
Update host, handler, adapter, schema registration, and capability declaration
together, and pin the exact candidate revision. Legacy nested control remains
supported where Core allows it; that syntax fallback does not accept an old
envelope identity.

Previously, `$id` used `https://trendmicro.github.io/agent-hook-standard/`.
Those paths returned HTTP 404 when checked on 2026-09-21. A JSON Schema `$id`
is a resource identifier and base URI, not a requirement to fetch the schema
over HTTP; see the [JSON Schema identification guidance](https://json-schema.org/understanding-json-schema/structuring).
The new IDs identify the new contract resources. This repository does not
publish a redirect at the old Pages path or rebind its identity.

Integrations remaining on the old contract can explicitly pin the
pre-migration revision `08ecf2973ed8a3fb7b09f7a8f3a9450f2ea206b3` and vendor its
[request schema](https://raw.githubusercontent.com/trendmicro/agent-hook-unity/08ecf2973ed8a3fb7b09f7a8f3a9450f2ea206b3/schemas/hook-event.schema.json)
and [response schema](https://raw.githubusercontent.com/trendmicro/agent-hook-unity/08ecf2973ed8a3fb7b09f7a8f3a9450f2ea206b3/schemas/hook-response.schema.json).
Register those resources locally under their original `$id` values. Do not
infer which project's contract applies from `agent-hooks/0.1`, or automatically
retry a failed document against a different schema. A deliberately configured
translation must validate both contracts and preserve their semantics.

Changing `spec` also changes signed or hashed payloads. Update applicable
signing domain separators and recompute signatures and content identities;
do not reuse approvals bound to the previous content.

## Adding schemas

Place a schema at `schemas/<name>.schema.json`. Pair it with fixtures at
`fixtures/<name>/valid/` and `fixtures/<name>/invalid/`. Valid fixtures must
validate; invalid fixtures must fail validation. Add normative explanation in
`spec/` and illustrative integrations in `examples/` alongside schema changes.
