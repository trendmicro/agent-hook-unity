---
sidebar_position: 3
---

# Event registry

This document defines the Core event registry for the Agent Hook Unity 0.1
draft.
The capitalized key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**,
**SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are
to be interpreted as described in the [Core protocol](./core.md).

The registry adopts the flat request shape and `hook_event_name` spelling used
by Claude Code hook requests. It standardizes portable lifecycle boundaries;
it does not require a host to manufacture a callback that its native runtime
does not expose. Core is one standard vocabulary, not a requirement to
implement every event. Support is declared separately for each event.

## Event name and request shape

Every Core event MUST be a flat request object that validates against the Hook
Event schema. `hook_event_name` is its sole event discriminator and MUST equal
one of the PascalCase Core values in this document. `event_type`, a generic
`payload` wrapper, and a second event discriminator MUST NOT appear in a
normalized Agent Hook 0.1 request.

The shared request envelope is defined by the Core protocol and schema. In
addition to those shared fields, each Core event MUST contain the
event-specific fields listed below. `cwd`, `transcript_path`, and other
host-native context MUST be omitted when unavailable rather than invented.

## Core event registry

The classification in the final column describes the standard boundary, not
merely whether an individual host happens to deliver a callback.

Unless a requirement specifically says otherwise, the per-event requirements
apply when a producer declares that event as `gate` or `observe`. A `partial`
or `unavailable` capability MUST NOT be represented as a Core event delivery;
an extension MAY expose related native data without claiming Core semantics.

| `hook_event_name` | Exact lifecycle boundary | Required event-specific fields | Classification |
| --- | --- | --- | --- |
| `SessionStart` | When a host starts, resumes, clears, compacts, or forks a session context before subsequent agent work. | `source` | Gate |
| `UserPromptSubmit` | After an external prompt is accepted, but before it affects agent execution. | `prompt`, `prompt_id` | Gate |
| `BeforeModelRequest` | Immediately before a complete request is dispatched to a model provider. | `prompt_id`, `model_request_id`, `model`, `messages` | Gate |
| `AfterModelResponse` | Once the terminal result of one complete model request is available. | `prompt_id`, `model_request_id`, `model`, `outcome`, and `response` on success or `error` otherwise | Gate |
| `PreToolUse` | Immediately before a tool begins and before any effect of that invocation occurs. | `prompt_id`, `tool_name`, `tool_input`, `tool_use_id` | Gate |
| `PermissionRequest` | At a native approval boundary, before the requested operation has been allowed or denied. | `prompt_id`, `permission_request_id`, `operation_id`, `operation` | Gate |
| `PermissionDenied` | After a user, policy, handler, or host denies a requested operation. | `prompt_id`, `permission_request_id`, `operation_id`, `reason`, `denied_by` | Observe |
| `PostToolUse` | After one tool invocation completes successfully. | `prompt_id`, `tool_name`, `tool_input`, `tool_response`, `tool_use_id` | Gate |
| `PostToolUseFailure` | After one tool invocation fails or is interrupted. | `prompt_id`, `tool_name`, `tool_input`, `tool_use_id`, `error` | Observe |
| `PreNetworkAccess` | Immediately before one application-level outbound request is dispatched, before its request bytes are sent. | `operation_id`, `prompt_id`, `destination_host`, `destination_port`, `protocol` | Gate |
| `PostNetworkAccess` | At the terminal result of one started application-level outbound request. | `operation_id`, `prompt_id`, `destination_host`, `destination_port`, `protocol`, `outcome`, and `error` on failure or interruption | Gate |
| `PreMemoryWrite` | Immediately before one durable agent-memory create, update, or upsert becomes persistent or visible. | `operation_id`, `prompt_id`, `memory_store_id`, `memory_key`, `content` | Gate |
| `PostMemoryWrite` | At the terminal result of one started durable agent-memory write. | `operation_id`, `prompt_id`, `memory_store_id`, `memory_key`, `outcome`, and `error` on failure or interruption | Observe |
| `PreConfigChange` | Before a change to effective agent behavior or capability configuration takes effect. | `operation_id`, `config_target`, `mutation_type`, plus `new_value` for create/update and `prompt_id` when turn-attributable | Gate |
| `SubagentStart` | Before a child agent receives executable work. | `prompt_id`, `delegation_id`, `agent_id`, `agent_type`, `parent_agent_id` | Gate |
| `SubagentStop` | After a child agent reaches a terminal state. | `prompt_id`, `delegation_id`, `agent_id`, `agent_type`, `outcome` | Observe |
| `Stop` | At the terminal boundary of a caller-initiated, prompt-scoped turn. | `prompt_id`, `outcome` | Observe |
| `SessionEnd` | After final output, or after an observable abnormal session termination. | `reason` | Observe |

### `SessionStart`

A producer MUST emit `SessionStart` before subsequent agent work for the
applicable start, resume, clear, compaction, or fork. `source` MUST identify
the cause. Producers SHOULD use `startup`, `resume`, `clear`, `compact`,
`fork`, or `other`; a richer native cause MAY be preserved in `extensions`.
A change of model within an existing session MUST NOT be represented as
`SessionStart`. When declared as `gate`, a host MUST evaluate handler
permission decisions (`allow` or `deny`) before agent execution commences,
enabling load-time sandbox and runtime integrity verification (such as
prohibiting unauthorized library injection or suspicious proxy configurations).

### `UserPromptSubmit`

A producer MUST emit `UserPromptSubmit` only after an external prompt has been
accepted and before that prompt changes agent execution. `prompt_id` identifies
the resulting prompt-scoped turn. A host that rejects input before accepting it
MUST NOT represent that rejected input as `UserPromptSubmit`. When declared as
`gate`, a handler MAY block the turn via `decision: "block"`, or provide
`updatedPrompt` in `hookSpecificOutput` to perform surgical prompt rewriting
(such as input guardrail tagging or credential redaction) without terminating
the workflow.

### `BeforeModelRequest`

A producer MUST emit `BeforeModelRequest` immediately before dispatching a
complete request to the model provider. `messages` MUST represent the complete
request content visible at that boundary, subject to the privacy rules below.
The event is not a model-selection notification and MUST NOT be emitted merely
because the host selected, configured, or displayed a model.

### `AfterModelResponse`

A producer MUST emit exactly one `AfterModelResponse` for each terminal model
request result it observes. `model_request_id` MUST equal the identifier from
the corresponding `BeforeModelRequest`. `outcome` MUST identify the terminal
condition. A successful outcome MUST include `response`; a non-successful
outcome MUST include `error`. A streaming delta, partial token, or display callback MUST NOT be represented
as `AfterModelResponse`. Capability declarations for this event are scoped to
the host's configuration and transport. A configuration that may expose tokens or
partial output to users or agent context before hook evaluation MUST declare this
event `observe`. A host MAY declare `gate` only for configurations where all model
output is retained and buffered until the hook decision resolves. When declared
as `gate`, a handler MAY enforce permission decisions (`allow` or `deny`) or
supply `updatedResponse` in `hookSpecificOutput` to sanitize model outputs (such
as removing phishing URLs, PII, or prompt leaks) before the response is rendered
to users or appended to session context. In unbuffered streaming configurations
where tokens have already been emitted, this event MUST operate as `observe`.

### `PreToolUse`

A producer MUST emit `PreToolUse` before the identified invocation begins and
before any effect of the invocation occurs. `tool_name` and `tool_input` MUST
describe the proposed invocation, and `tool_use_id` MUST be stable for its
life. A host that can observe a tool only after it begins MUST NOT claim this
event as a faithful Gate.

### `PermissionRequest`

A producer MUST emit `PermissionRequest` when an operation reaches the host's
native approval boundary and before that request is resolved. `operation` MUST
be an object containing at least `kind` and `name`; it MAY contain `input`.
Approval is not limited to tools, so this event MUST NOT require
`tool_use_id`. When the operation is a tool and the corresponding fields are
available, a producer SHOULD include `tool_name`, `tool_input`, and
`tool_use_id` as compatible additional fields.

### `PermissionDenied`

A producer MUST emit `PermissionDenied` after a concrete approval request is
denied. It MUST retain the `permission_request_id` and `operation_id` from the
corresponding `PermissionRequest`. `denied_by` MUST identify the actor or
authority that denied the operation, such as a user, policy, handler, or host.
`PermissionDenied` is independent audit evidence: a consumer MUST NOT infer it
from the absence of a later tool event.

### `PostToolUse`

A producer MUST emit `PostToolUse` after a tool invocation completes
successfully. Its `tool_use_id` MUST equal the identifier on the corresponding
`PreToolUse`, and `tool_response` MUST be the terminal result available to the
host. `duration_ms` MAY be included when the host can calculate it faithfully.
When declared as `gate`, handlers MAY evaluate handler permission decisions
or provide `updatedOutput` in `hookSpecificOutput` to sanitize untrusted tool
results (such as neutralizing indirect prompt injection payloads scraped from
external data sources) before the result is incorporated into agent context.

### `PostToolUseFailure`

A producer MUST emit `PostToolUseFailure` after a tool invocation fails or is
interrupted. Its `tool_use_id` MUST equal the identifier on the corresponding
`PreToolUse`, and `error` MUST describe the terminal failure available to the
host. A producer MAY include the Claude-compatible `is_interrupt` and
`duration_ms` fields when it can provide them faithfully. For one `tool_use_id`,
`PostToolUse` and `PostToolUseFailure` are mutually exclusive terminal
outcomes.

### `PreNetworkAccess`

A producer MUST emit `PreNetworkAccess` immediately before dispatching one
application-level outbound request, such as an HTTP request, before sending
its request bytes. A socket opening or closing, DNS lookup, pooled connection,
or streaming chunk MUST NOT be represented as this boundary. Each redirect or
retry request is a distinct operation with its own `operation_id` and MUST be
gated separately when `gate` is claimed. Reusing a connection does not remove
request boundaries. A host whose SDK hides redirects or retries MUST declare
the affected capability `partial` unless it can faithfully observe and, for a
Gate, enforce those boundaries.

Both network events require `operation_id` and `prompt_id`; this draft covers
requests attributable to a caller-initiated turn. They also require:

- `destination_host`: a nonempty bare hostname or IP address, without a URL,
  credentials, or other URL components.
- `destination_port`: an integer from 1 through 65535.
- `protocol`: a lowercase application protocol identifier matching
  `^[a-z][a-z0-9+.-]*$`, such as `https`.

These fields MUST describe the target of this individual request. Request
payloads and headers are not required. This Gate controls application request
dispatch; it does not establish a kernel network boundary or complete SSRF
protection.

### `PostNetworkAccess`

A producer MUST emit exactly one `PostNetworkAccess` terminal result for each
started request whose terminal result it observes, using the same
`operation_id`, `prompt_id`, and request target as its `PreNetworkAccess`, when
available. The target MUST remain the original target of this request, not the
final target reached by a separate redirect request. A streaming request
becomes terminal when its response body completes, fails, or is interrupted;
individual chunks MUST NOT be emitted as terminal events.

`outcome` and `error` MUST follow the [terminal-result rules](#network-and-memory-terminal-results).
For this event, `success` means the request and response completed at the
application protocol boundary, not that the application accepted the request.
For example, a complete HTTP error-status response is a `success` outcome.

`status_code` MAY contain an integer response status in the namespace of the
declared `protocol`. It MUST describe this request's response, not a later
redirect or retry. It MUST be omitted when no response status is available or
the protocol has no integer response status; hosts MUST NOT substitute local
transport errors or a synthetic zero. For protocols with interim responses,
only the final response status MAY be reported; if no final status was
observed, the field MUST be omitted.

For HTTP(S), use the HTTP response status code defined by
[RFC 9110, Section 15](https://www.rfc-editor.org/rfc/rfc9110.html#section-15).
For example, a complete HTTP 403 response has `outcome: "success"` and MAY
carry `status_code: 403`. A known final status MAY also be retained if the
response body subsequently fails or is interrupted; it does not change the
existing `outcome` or `error` requirements.

`bytes_sent` and `bytes_recv` MAY contain non-negative integer counts of the
serialized application request and response body bytes observed for this
request, respectively, as transmitted and before content decoding. A body
transmitted compressed is counted in its compressed representation. The counts
MUST exclude headers, protocol framing, and transport overhead. They MUST be
omitted when the runtime exposes only decoded, estimated, or connection-level
values, or cannot otherwise accurately attribute the bytes to this request.
Zero means an observed count of zero, not an unavailable measurement.

### `PreMemoryWrite`

A producer MUST emit `PreMemoryWrite` immediately before one create, update,
or upsert of durable agent memory becomes persistent or visible. Durable agent
memory means long-term agent context, including local file or database stores;
it does not require a vector database. Arbitrary filesystem writes and volatile
scratchpad changes MUST NOT be represented as this event.

Both memory events require `operation_id`, `prompt_id`, `memory_store_id`, and
`memory_key`. This draft covers writes attributable to a caller-initiated
turn. `memory_store_id` and `memory_key` MUST be nonempty opaque strings whose
combination identifies the logical write target. `PreMemoryWrite` additionally
requires `content`, the proposed value as any JSON value, including `null`.

### `PostMemoryWrite`

A producer MUST emit exactly one `PostMemoryWrite` terminal result for each
started write whose terminal result it observes. It MUST retain the
`operation_id`, `prompt_id`, `memory_store_id`, and `memory_key` from
`PreMemoryWrite`, when available.
`outcome` and `error` MUST follow the [terminal-result rules](#network-and-memory-terminal-results).
The event does not require an echo of the written content. Failure or
interruption MUST NOT be interpreted as proof of rollback or absence of
partial effects.

### `PreConfigChange`

A producer MUST emit `PreConfigChange` before a change to effective agent
behavior or capability configuration takes effect, including model, tool, MCP,
or rule settings. Arbitrary file changes and configuration for other
applications MUST NOT be represented as this event. A host claiming `gate`
MUST gate the actual configuration mutation; a denial prevents the pending
change and MUST NOT mean rollback after it takes effect.

`operation_id`, `config_target`, and `mutation_type` are required.
`config_target` MUST be a nonempty opaque identifier for one logical setting
or an entire configuration document. `mutation_type` MUST be `create`,
`update`, or `delete`. For `create` and `update`, `new_value` is REQUIRED and
MUST be the complete proposed JSON value at that target, including `null` when
that is the intended value; it MUST NOT be an unspecified patch. For `delete`,
`new_value` MUST be omitted. Deleting a target is distinct from assigning it
the JSON value `null`.

`config_file_path` MAY be included as a nonempty string for a file-backed
target. `old_value` MAY contain any JSON value when known and safe to disclose;
its absence does not assert that the target was absent. `prompt_id` is REQUIRED
when the change is attributable to a caller-initiated turn and MUST otherwise
be omitted. No cryptographic hash is required or defined by this event.

### Network and memory terminal results

For `PostNetworkAccess` and `PostMemoryWrite`, `outcome` MUST be `success`,
`failure`, or `interrupted`. A `failure` or `interrupted` outcome MUST include
the existing `error` object with a nonempty string `type` and an optional
string `message`. A `success` outcome MUST NOT include `error`. `duration_ms`
MAY contain a non-negative number when the duration is accurately known.
For `PostMemoryWrite`, hosts MUST ignore all response control fields. For
`PostNetworkAccess`, when declared as `gate` on a buffered transport, handlers
MAY provide control decisions (`allow`, `deny`) to govern whether the completed
response content is delivered to the application caller. A `deny` decision prevents
delivery of the received response to the caller. Response payload body inspection
and base64-encoded body replacement semantics are deferred to RFC 0005.

A pre-operation denial MUST NOT produce either Post event as evidence of
execution. Native permission telemetry MAY report that denial when the
required identifiers and semantics of `PermissionRequest` and
`PermissionDenied` are available. A failed or interrupted operation may have
already sent bytes or made a partial memory change; its terminal outcome alone
does not prove that it had no effects.

### `SubagentStart`

A producer MUST emit `SubagentStart` before the identified child agent receives
executable work. `agent_id` identifies the child and `parent_agent_id`
identifies its parent. `delegation_id` identifies this delegation, not merely
the lifetime of the child process or agent instance. When available,
`delegation_depth` MUST indicate the zero-based hierarchical delegation depth
(where 0 indicates the root agent and 1 indicates a direct child), and
`delegation_chain` MUST list the ordered ancestor agent identifiers from root to
parent, enabling handlers and hosts to enforce recursion limits and prevent runaway
delegation. When declared as `gate`, a host MUST evaluate handler permission
decisions (`allow` or `deny`) before dispatching work to the subagent, defending
against confused-deputy escalation and multi-agent fork bombs.

### `SubagentStop`

A producer MUST emit `SubagentStop` after the child agent identified by
`agent_id` reaches a terminal state. It MUST retain the `delegation_id` from
the matching `SubagentStart`; `outcome` MUST identify that terminal state. A
child-agent terminal event MUST NOT be represented as the parent's `Stop`.

### `Stop`

A producer MUST emit `Stop` at the terminal boundary for a caller-initiated,
prompt-scoped turn. It MUST retain the `prompt_id` from the corresponding
`UserPromptSubmit`. `outcome` MUST identify the terminal state. `Stop` is not
a session termination event and MUST NOT replace `SessionEnd`.

### `SessionEnd`

A producer MUST emit `SessionEnd` after final output or when it can observe an
abnormal session termination. `reason` MUST describe the end cause available
to the host. If a host cannot observe an abnormal termination, it MUST declare
that limitation rather than fabricate `SessionEnd`.

## Gate and Observe semantics

A **Gate** is a boundary at which a handler's response may be considered before
the host crosses the stated lifecycle boundary. A host MUST deliver a Gate in
time to enforce its response; otherwise it MUST report the event as `partial`
or `unavailable`, not as a Gate. A response that permits an operation only
passes the Agent Hook gate and MUST NOT override a native sandbox, organization
policy, host policy, or user approval.

A host MAY declare any Gate as `gate` (enabling control decisions) or as
`observe` (telemetry only), based on host architecture, transport capabilities,
and policy. When declared `gate`, the host MUST enforce applicable valid
control responses under the Core
[composition rules](./core.md#multiple-handlers-and-repeated-evaluation); when
declared `observe`, the host MUST ignore control members for enforcement
purposes while retaining observational telemetry.

An **Observe** event records a lifecycle boundary without making the event a
portable control point. A host MUST NOT use a handler response to retroactively
change an observed action while claiming conformance to this registry.

`PreNetworkAccess`, `PreMemoryWrite`, and `PreConfigChange` use the
[Core permission-decision response](./core.md#response-envelope). For a host
declaring `gate`, a decision applies only to the operation, target, and proposed
values presented to the handler. If those change before dispatch or mutation,
the host MUST evaluate the Gate again against the changed operation before
proceeding. Reevaluation does not clear an accepted denial of the same pending
action at this boundary, even though it uses a new delivery and `event_id`. A
host that cannot enforce this precondition MUST NOT claim `gate`.
For `PreMemoryWrite`, an optional `updatedContent` member in `hookSpecificOutput`
MAY provide sanitized or redacted content to be stored in place of the proposed
content. For `PreNetworkAccess` and `PreConfigChange`, content-rewriting controls
have no effect.

## Correlation and ordering

`event_id` identifies a single delivery to a single handler. Separate handlers,
redelivery, and reevaluation use distinct `event_id` values. Those new delivery
identifiers MUST NOT be used to clear a decision binding the same pending
action, and they MUST NOT be used in place of an action or lifecycle
correlation identifier.

- `model_request_id` correlates `BeforeModelRequest` with
  `AfterModelResponse`.
- `tool_use_id` correlates `PreToolUse` with exactly one terminal
  `PostToolUse` or `PostToolUseFailure` when a terminal result is observed.
- `permission_request_id` and `operation_id` correlate `PermissionRequest`
  with `PermissionDenied`.
- `operation_id` correlates `PreNetworkAccess` with `PostNetworkAccess`, and
  `PreMemoryWrite` with `PostMemoryWrite`, and identifies a `PreConfigChange`
  mutation.
- `delegation_id` correlates `SubagentStart` with `SubagentStop`.
- `prompt_id` correlates `UserPromptSubmit` with `Stop`.

The shared `session_id` scopes a session. The shared `sequence` field MUST
increase strictly within that session, so that consumers can order events even
when timestamps collide or are imprecise. An adapter or intermediate component
MUST preserve correlation identifiers and MUST NOT reuse them for a different
logical action.

For the network, memory, and configuration events, `operation_id` MUST be a
nonempty opaque string identifying one underlying operation, unique within
the session across these activities. The host MUST generate it at the
underlying operation boundary even when a pre-event cannot be observed. It
MUST remain stable across paired pre/post events, redelivery, and reevaluation
of the same underlying operation. Stability does not merge the distinct
pending actions controlled at Pre and Post Gate boundaries. If the exact same
operation reaches `PermissionRequest` or `PermissionDenied`, those events MUST
retain this `operation_id`; a different underlying operation MUST NOT reuse it.
A consumer MUST NOT substitute a destination, memory key, configuration target,
or delivery `event_id` for operation correlation.

## Sensitive content and telemetry

Prompts, model messages, tool input, tool responses, errors, workspace paths,
transcript locations, network destinations, memory content, and configuration
values can contain sensitive information. A producer MUST apply its applicable
data-handling policy before delivering these fields to a
handler or telemetry destination.

When a producer omits, truncates, tokenizes, or replaces sensitive content, it
MUST declare that redaction by a schema-supported or namespaced extension
member, and it MUST NOT fabricate substitute content. A consumer MUST treat a
declared-redacted value as incomplete and MUST NOT assume it is the original
request, response, or tool result.

## Capability declaration

A host or adapter MUST declare the fidelity of every Core event as one of the
following values. The declaration's transport and configuration format are
outside the scope of Agent Hook 0.1.

| Capability | Meaning |
| --- | --- |
| `gate` | The host observes the exact pre-action boundary and can enforce a handler response there. |
| `observe` | The host faithfully observes the registry boundary, but it is not a portable control point. |
| `partial` | The host can expose a related native callback but cannot preserve the registry boundary, required data, or control semantics. The declaration MUST identify the limitation, and the callback MUST NOT be emitted as a Core event. |
| `unavailable` | The host cannot expose the event faithfully. It MUST NOT emit a fabricated equivalent. |

A host MAY support only the Core events it can implement faithfully. It MUST
not label an after-the-fact notification as a pre-action Gate, and it MUST not
claim that an omitted callback is equivalent to a Core event.

Network and memory pre/post capabilities are independent. A host MAY declare
the Post event `observe` even when its Pre event is `partial` or `unavailable`,
provided the Post event meets its own boundary, data, and correlation
requirements. It MUST generate `operation_id` for the actual operation and
MUST NOT fabricate a Pre event. Supporting a Pre event likewise does not imply
that the corresponding terminal result is observable.

## Deferred and extended events

Events for arbitrary file changes, worktree lifecycle, compaction, UI and
message-display activity, reasoning, and task management remain outside Core
in Agent Hook 0.1. `SessionRevoke` and `PostConfigChange` are also deferred.
They MAY be specified as extensions under the
[extension policy](./extensions.md), but an extension MUST NOT claim Core
semantics unless a future version adds it to this registry.
