---
sidebar_position: 1
slug: /0.1
---

# Agent Hook Unity 0.1 draft

Agent Hook Unity 0.1 is a draft portable security and telemetry contract for an agent
runtime to deliver a lifecycle event to a hook and receive a structured
response. Its flat request shape and PascalCase `hook_event_name` values are
Claude-shaped for practical adapter compatibility, but it is not a Claude Code
wire-format specification.

The draft adds delivery, ordering, turn, operation, approval, model-request,
and delegation correlation that security telemetry needs. Hosts declare whether
each Core event is a `gate`, `observe`, `partial`, or `unavailable` capability;
they must not fabricate an event merely to claim support.

This is not a standard hook configuration format: discovery, matching, handler
execution, ordering, and native policy remain host concerns.

## Responsibilities and scope

| Participant | Contract responsibility |
| --- | --- |
| Host | Observe the defined boundary, declare faithful capabilities, and honor supported controls without bypassing native policy. |
| Adapter | Preserve the event's meaning and correlation while translating native callbacks and supported responses. It may be implemented inside the host. |
| Handler | Accept an event and return a schema-valid response correlated to that delivery. |

The registry distinguishes twelve Gate events from six Observe events.
Control requires both a Gate event and a host declaration of `gate`; a faithful
observation alone does not provide preventive enforcement. The default for
an individual missing, invalid, timed-out, or errored handler response is no
decision from that invocation. A timeout alone therefore fails open, subject
to other valid handler decisions and independent native restrictions; it does
not erase an accepted denial, rewrite, or approval requirement for the same
pending action. Completed model, tool, and network operations can expose Gate
boundaries only when the host buffers their results until control completes.
Those Post Gates control delivery, rendering, or context ingestion, not
rollback of the completed work.

The contract covers the lifecycle boundaries a host can expose faithfully.
It does not establish sandbox isolation or visibility into every internal
runtime or provider operation. Its per-delivery event and response semantics
leave handler scheduling and rewrite conflict resolution to the host, subject
to the minimum decision-preservation rules in Core. See the
[host obligations](./core.md#host-obligations) for existing responsibilities
and the boundaries that remain open in this draft.

## Reading the draft

The human-readable documents in this directory are normative. The companion
JSON Schemas, fixtures, and examples make the JSON interchange testable.
The website's [response reference](https://trendmicro.github.io/agent-hook-unity/responses)
and [capability guide](https://trendmicro.github.io/agent-hook-unity/capabilities)
are informative: they explain current requirements and limitations without
introducing a new response contract or capability configuration format.

## Documents

- [Core protocol](./core.md) defines the flat envelope, security correlation,
  canonical top-level control responses, event-specific rewrites, capability
  declarations, fail-open behavior, versioning, and conformance requirements.
- [Event registry](./events.md) defines the 18 Core PascalCase event names,
  their timing, required flat fields, and intended capability boundaries.
- [Extensions](./extensions.md) defines portable extension boundaries.
- [Security considerations](./security.md) defines data-handling and policy
  requirements.
- [Adapter guide](./adapters.md) maps the Claude Code baseline and defines
  requirements for other native hook facilities.

Network events describe application-level requests, including distinct retries
and redirects; memory events describe durable agent context;
`PreConfigChange` describes pending changes to agent behavior or capabilities.
Each event is part of the standard vocabulary, but hosts may declare support
independently. No enterprise service, signature, ledger, or remote approval
workflow is required. Older 0.1 schemas reject the new names; adopters must
update schemas and capability declarations before using the revised draft.

The original draft is proposed by
[RFC 0001](https://github.com/trendmicro/agent-hook-unity/blob/main/rfcs/0001-agent-hook-core-event-contract.md).
The five-event expansion is proposed by
[RFC 0004](https://github.com/trendmicro/agent-hook-unity/blob/main/rfcs/0004-standard-lifecycle-events.md).
The current repository draft also incorporates the top-level decision and
additional Gate work merged in
[PR #9](https://github.com/trendmicro/agent-hook-unity/pull/9), plus the buffered
response-delivery control portion of draft RFC 0005. RFC 0005's response-body
inspection and replacement fields remain unimplemented proposals. The
provenance and remaining adoption work are recorded in
[draft RFC 0007](https://github.com/trendmicro/agent-hook-unity/blob/main/rfcs/0007-core-draft-consolidation.md).
None of these proposals has yet been accepted through the repository RFC
process.

The separate [Responsible AI Agent Hooks project](https://responsibleai.github.io/agent-hooks/)
uses the identifier `agent-hooks/0.1`. Its context and verdict documents
are not this draft's flat event and correlated response documents. Neither
that former shared identifier nor the Claude-shaped field names imply wire
compatibility. This draft now uses `agent-hook-unity/0.1`; adopters of earlier
local drafts must explicitly update their configured identifier and schemas.
There is no automatic wire negotiation between the old and new identifiers.
