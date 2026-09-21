---
sidebar_position: 6
---

# Adapter guide

An adapter maps a host's native hook events and results to flat Agent Hook
documents. It does not make a host's settings file, matcher language, execution
order, transport, or native response envelope part of this specification.

## Claude Code reference mapping

The following table identifies the direct Claude Code baseline where one
exists. A dash means Claude Code does not emit a faithful native event; an
adapter MUST declare that Core event `unavailable` rather than fabricate it.

| Agent Hook `hook_event_name` | Claude Code event | Adapter requirement |
| --- | --- | --- |
| `SessionStart` | `SessionStart` | Preserve the native session ID and source; add the standard delivery and sequence fields. |
| `UserPromptSubmit` | `UserPromptSubmit` | Preserve `prompt`; retain its native `prompt_id` as the turn correlation. |
| `BeforeModelRequest` | — | Declare `unavailable`; do not derive it from model selection or tool activity. |
| `AfterModelResponse` | — | Declare `unavailable`; do not synthesize it from streamed display output or a later tool event. |
| `PreToolUse` | `PreToolUse` | Map `tool_name`, `tool_input`, and `tool_use_id`. |
| `PermissionRequest` | `PermissionRequest` | Map the native request and assign both `operation_id` and `permission_request_id`. Claude Code does not supply `tool_use_id` here. |
| `PermissionDenied` | `PermissionDenied` | Preserve the native reason and tool-call ID when supplied; retain the corresponding operation and permission-request identifiers. |
| `PostToolUse` | `PostToolUse` | Preserve structured `tool_response`, tool input, and tool-call ID. |
| `PostToolUseFailure` | `PostToolUseFailure` | Preserve `error`, interruption information, and duration when supplied. |
| `SubagentStart` | `SubagentStart` | Assign `delegation_id`; preserve native agent ID and type. |
| `SubagentStop` | `SubagentStop` | Retain the `delegation_id` assigned at start and the native outcome context. |
| `Stop` | `Stop` | Preserve the active turn's `prompt_id` when the stop is turn-scoped. |
| `SessionEnd` | `SessionEnd` | Preserve the native end reason. |

This guide defines no Claude Code mapping for `PreNetworkAccess`,
`PostNetworkAccess`, `PreMemoryWrite`, `PostMemoryWrite`, or `PreConfigChange`.
An adapter MUST assess each event against its
[registry requirements](./events.md) and declare its actual capability. A tool
name, a file change, or a later side effect alone does not establish the
required boundary. Network and memory Pre and Post support are independent.

The exact native availability and payload vary by product and release. An
adapter for another host MUST map only events it can implement faithfully and
MUST publish its own `gate`, `observe`, `partial`, or `unavailable` capability
declaration. It MUST identify any timing, field, correlation, response, or
privacy limitation for a `partial` mapping.

## Envelope and correlation mapping

An adapter MUST construct the standard flat envelope: `spec`, `event_id`,
`hook_event_name`, `session_id`, `timestamp`, and `sequence`. It SHOULD retain
native `cwd` and `transcript_path` when safely available, and MUST omit them
rather than invent them. It MUST retain `prompt_id` for a turn-scoped native
event.

Native identifiers do not remove the standard correlation requirements. An
adapter MUST assign and retain `model_request_id`, `operation_id`,
`permission_request_id`, and `delegation_id` wherever the Core protocol
requires them. In particular, it MUST not attempt to correlate Claude Code's
`PermissionRequest` with a later tool event solely from timing, because the
native request has no `tool_use_id`.

For network, memory, and configuration activities, adapters MUST preserve the
[operation correlation rules](./events.md#correlation-and-ordering), including
generation at the operation boundary when only a Post event is observable and
reuse at native approval for the same operation. Redirect and retry requests
are separate network operations; an SDK that hides their boundaries cannot
support a faithful mapping merely because its first request is visible.

An adapter MAY redact data before delivery to a handler. It MUST preserve the
meaning and correlation of the exposed event, and MUST downgrade the capability
to `partial` or `unavailable` when redaction prevents faithful security
observation or enforcement.

## Response mappings

The Agent Hook response uses a canonical top-level `decision`, with
event-specific allowed values, effects, and optional rewrites. An adapter MUST
interpret a control response only at an event classified as a Gate by the
registry, declared `gate`, and reached through a native control point that can
still enforce the event's controlled effect.

| Core Gate | Standard response shape | Claude Code direction |
| --- | --- | --- |
| `SessionStart` | `decision: "allow"` or `"deny"`; no rewrite. | This guide claims no Claude Code Gate mapping. Declare `observe`, `partial`, or `unavailable` unless the native boundary can prevent agent work from starting. |
| `UserPromptSubmit` | `decision: "allow"`, `"deny"`, or legacy `"block"`; optional `hookSpecificOutput.updatedPrompt`. | Map denial or legacy block to Claude Code's prompt block response. Map a rewrite only if the native callback can replace the accepted prompt before execution. |
| `BeforeModelRequest` | `decision: "allow"`, `"deny"`, `"ask"`, or `"defer"`; optional `hookSpecificOutput.updatedMessages`. | Claude Code has no native event; declare it `unavailable` rather than fabricate a mapping. |
| `AfterModelResponse` | `decision: "allow"` or `"deny"`; optional `hookSpecificOutput.updatedResponse`. | Claude Code has no faithful native event. A Gate requires the complete result to remain buffered before rendering or context ingestion. |
| `PreToolUse` | `decision: "allow"`, `"deny"`, `"ask"`, or `"defer"`; optional `hookSpecificOutput.updatedInput`. | Map the canonical decision and supported rewrite to Claude Code's native `PreToolUse` response. |
| `PermissionRequest` | `decision: "allow"` or `"deny"`; optional native approval updates under `hookSpecificOutput.decision`. | Map to Claude Code's permission-request response while preserving native policy authority. |
| `PostToolUse` | `decision: "allow"` or `"deny"`; optional `hookSpecificOutput.updatedOutput`. | Claim `gate` only when the adapter can hold the completed result before model-context ingestion and map the replacement faithfully. The tool execution has already completed. |
| `PreNetworkAccess` | `decision: "allow"`, `"deny"`, `"ask"`, or `"defer"`; no rewrite. | No Claude Code mapping is defined here. Enforce only at an actual pre-dispatch request boundary. |
| `PostNetworkAccess` | `decision: "allow"` or `"deny"`; no rewrite. | No Claude Code mapping is defined here. A Gate requires buffered response delivery; Core defines no body-inspection or body-replacement field. |
| `PreMemoryWrite` | `decision: "allow"`, `"deny"`, `"ask"`, or `"defer"`; optional `hookSpecificOutput.updatedContent`. | No Claude Code mapping is defined here. Apply a replacement only before durable persistence or visibility. |
| `PreConfigChange` | `decision: "allow"`, `"deny"`, `"ask"`, or `"defer"`; no rewrite. | No Claude Code mapping is defined here. Enforce only before the effective mutation. |
| `SubagentStart` | `decision: "allow"` or `"deny"`; no rewrite. | Preserve the native event, but claim `gate` only if a denial prevents executable work from reaching the child. |

When top-level `decision` is present, it is canonical. The adapter MUST ignore
legacy nested controls (`permissionDecision`, `permissionDecisionReason`, and
`hookSpecificOutput.decision.behavior`). For backward compatibility, nested
controls remain valid only when top-level `decision` is absent.
`hookSpecificOutput.hookEventName` MUST match the request whenever
`hookSpecificOutput` is present. An `allow` MUST NOT override native,
organization, sandbox, managed-policy, or user-approval restrictions.

For Gates supporting `ask`, adapters MUST follow the
[Core response rules](./core.md#response-envelope): the controlled operation
does not proceed while approval is unresolved, and a non-interactive host
without suspension treats `ask` as `deny`. `defer` leaves resolution to native
approval or policy and is not approval. A schema-valid rewrite that fails
native validation fails closed; the adapter MUST NOT restore the original
unredacted value.

All response controls are ignored for an event the host declares `observe`.
For the three Post Gates, control applies to buffered rendering, delivery, or
context ingestion and MUST NOT be represented as rollback of completed model,
tool, or network work. Claude Code's native response shapes remain
event-specific, and this guide claims no universal byte-for-byte compatibility.

Adapters MUST correlate the native invocation with `event_id`. An absent,
invalid, timed-out, or errored response supplies no decision from that handler
invocation. A timeout alone follows the Core fail-open default, but a failure
MUST NOT erase another accepted denial, rewrite, or approval requirement for
the same pending action. Independent native policy still applies.

Before delivering the current eighteen-event baseline, adapters MUST satisfy
the [draft compatibility requirements](./core.md#versioning-and-conformance).
The current wire identifier is `agent-hook-unity/0.1`. Earlier local drafts
used the colliding `agent-hooks/0.1` value; adapters MUST update configuration
and schemas explicitly and MUST NOT silently negotiate between the identifiers.

## Non-normative stdio adapter pattern

A common adapter serializes one event object to a command handler's standard
input and reads at most one response object from standard output. Standard error
is reserved for diagnostics. This pattern is compatible with the general shape
of Claude Code and Gemini CLI command hooks, but the process launch command,
timeout, settings location, matcher, and output parsing details remain native
to each host.
