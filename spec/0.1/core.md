---
sidebar_position: 2
---

# Core protocol

## Status and terminology

This document defines the Agent Hook Unity 0.1 draft. The key words **MUST**,
**MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**,
and **OPTIONAL** in this document are to be interpreted as described in
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they
appear in all capitals.

A **host** is the agent runtime that observes lifecycle activity. An
**adapter** translates between a host's native hook facility and this contract.
A **handler** consumes an Agent Hook event and returns an Agent Hook response.
An **invocation** is one host delivery of one event to one handler.

Agent Hook standardizes event and response documents, event semantics, and
capability declarations. It does not standardize handler discovery,
configuration files, matcher grammar, invocation order, process lifecycle,
timeout values, authentication, or a transport binding. A command handler
receiving one JSON document on standard input and writing one JSON response on
standard output is a useful non-normative adapter pattern.

## Event envelope

An event MUST be a JSON object that validates against the
[Hook Event schema](https://trendmicro.github.io/agent-hook-unity/schemas/0.1/hook-event.schema.json).
The 0.1 document shape is deliberately Claude-shaped: the event discriminator
is the flat `hook_event_name` member and Core event names are PascalCase. It is
not a byte-for-byte Claude Code payload or response contract.

Every event MUST contain these flat members:

| Member | Meaning |
| --- | --- |
| `spec` | The Agent Hook contract identifier, exactly `agent-hook-unity/0.1`. |
| `event_id` | A UUID that uniquely identifies this delivered event. |
| `hook_event_name` | A Core or extension event name. Core values are defined by the event registry. |
| `session_id` | An opaque identifier for the host session that emitted the event. |
| `timestamp` | RFC 3339 UTC (`Z`) time at which the host observed the event. |
| `sequence` | A non-negative integer ordering events emitted for the same `session_id`. |

For one session, a host MUST emit strictly increasing `sequence` values. A
re-delivery is a new event delivery and therefore has a new `event_id`; a host
MUST retain enough correlation data to identify the underlying occurrence.

Event-specific fields are flat top-level members. Core fields MUST NOT be
relocated into a generic `context` or `payload` object. A host SHOULD include
`cwd` when a meaningful current working directory exists, and SHOULD include
`transcript_path` when it safely exposes a transcript location. A host MUST
omit either member rather than fabricate a value. `agent_id`, `agent_type`,
`permission_mode`, `effort`, and `scratchpad_dir` MAY be included as flat
host-provided context.

The event registry identifies turn-scoped events. A turn-scoped event MUST
contain `prompt_id`, an opaque identifier shared by all events causally
attributable to the same caller-initiated turn. Session lifecycle events that
are not attributable to a turn MUST omit `prompt_id`; a host MUST NOT invent
one merely to satisfy a downstream consumer.

### Security correlation

`event_id` identifies a delivery, not the action or lifecycle operation that
caused it. The following event-specific identifiers provide the required
cross-event correlation:

| Identifier | Required event scope | Requirement |
| --- | --- | --- |
| `model_request_id` | `BeforeModelRequest`, `AfterModelResponse` | MUST identify one model request; the paired events MUST use the same value. |
| `operation_id` | `PermissionRequest`, `PermissionDenied`, `PreNetworkAccess`, `PostNetworkAccess`, `PreMemoryWrite`, `PostMemoryWrite`, `PreConfigChange` | MUST identify the underlying operation and remain stable across its related events, as defined by the [event registry](./events.md#correlation-and-ordering). |
| `permission_request_id` | `PermissionRequest`, `PermissionDenied` | MUST identify one native approval request; a denial MUST retain the request's value. |
| `delegation_id` | `SubagentStart`, `SubagentStop` | MUST identify one delegated subagent lifetime; the paired events MUST use the same value. |

When a host supplies a native tool-call identifier, such as Claude Code's
`tool_use_id`, an adapter SHOULD retain it as `tool_use_id`. At a permission
boundary, an adapter MUST create `operation_id` and `permission_request_id`
when the native runtime lacks them, retaining an existing `operation_id` for
the same underlying operation. It MUST NOT infer their correlation from timing
alone. Network, memory, and configuration operation identifiers MUST follow
the registry's uniqueness, generation, and redelivery requirements, including
when only a Post event can be observed.

An event MAY contain `extensions`, as defined in the
[extension policy](./extensions.md). Hosts MUST preserve the correlation
members above when an event passes through an adapter or intermediate
component.

### Data minimization and redaction

Prompts, model messages, paths, tool arguments, tool results, transcript
locations, network destinations, memory content, and configuration values can
contain sensitive data. A host MAY redact or omit data that it cannot safely
disclose. It MUST NOT fabricate a substitute value or silently
change a security-relevant target such that a handler's decision appears to
cover a different operation. If redaction prevents faithful observation,
correlation, or enforcement at the declared boundary, the host MUST declare
the event `partial` or `unavailable`, rather than `gate`.

## Response envelope

A handler response MUST be a JSON object that validates against the
[Hook Response schema](https://trendmicro.github.io/agent-hook-unity/schemas/0.1/hook-response.schema.json).
It contains required `spec` and `event_id` members. `event_id` MUST equal the
event's `event_id`; a response with a different identifier is invalid.

The response MAY contain the Claude-shaped common members `continue`,
`stopReason`, `systemMessage`, `terminalSequence`, `suppressOutput`, `async`,
`asyncTimeout`, `metadata`, and `extensions`.

To establish clean architectural separation between the **control plane**
(authorization decisions) and the **data plane** (surgical payload mutations),
a handler responding to a Gate with control or mutation intent MUST provide a
top-level `decision` (`allow`, `deny`, `ask`, `defer`, or legacy `block`) and an
optional `reason` (REQUIRED when `decision` is `deny` or `block`). Omission of a
top-level `decision` is valid only for passive observation / metadata responses
or as a legacy compatibility fallback. When a top-level `decision` is present,
it is canonical and the host MUST ignore legacy nested control fields
(`permissionDecision`, `permissionDecisionReason`, and nested `decision.behavior`
within `hookSpecificOutput`). When no payload mutation is required,
`hookSpecificOutput` MAY be omitted entirely.

When payload rewriting or event-specific output is needed, `hookSpecificOutput`
MUST contain `hookEventName` matching the request, and MAY provide the applicable
rewrite members listed in the Gate table below. Native approval updates for
`PermissionRequest` retain their existing `hookSpecificOutput.decision`
container; its `behavior` is structurally required but ignored for control
when a canonical top-level decision is present. For backward compatibility
with earlier handlers, a host MUST also accept `permissionDecision` and `permissionDecisionReason`
inside `hookSpecificOutput` only when top-level `decision` is omitted.

| Core Gate | Canonical control response | Data plane rewrite support (`hookSpecificOutput`) | Effect |
| --- | --- | --- | --- |
| `SessionStart` | `decision: "allow"` or `"deny"` | None. | Controls whether session initialization may proceed before agent work starts. |
| `UserPromptSubmit` | `decision: "allow"`, `"deny"`, or legacy `"block"` | `updatedPrompt` | `deny` or `block` prevents prompt execution; `allow` with `updatedPrompt` surgically replaces prompt content. |
| `BeforeModelRequest` | `decision: "allow"`, `"deny"`, `"ask"`, or `"defer"` | `updatedMessages` | Controls complete model request; `updatedMessages` replaces messages dispatched to provider. |
| `AfterModelResponse` | `decision: "allow"` or `"deny"` | `updatedResponse` | Controls model response before UI rendering or context ingestion (when declared `gate`); `updatedResponse` replaces model output. Controls delivery and rendering, not inference rollback. |
| `PreToolUse` | `decision: "allow"`, `"deny"`, `"ask"`, or `"defer"` | `updatedInput` | Controls tool invocation; `updatedInput` replaces tool parameters before execution. |
| `PermissionRequest` | `decision: "allow"` or `"deny"` (or nested `decision.behavior`) | `decision.updatedInput`, `decision.updatedPermissions` | Controls native approval request. The nested update members are relative to `hookSpecificOutput`. |
| `PostToolUse` | `decision: "allow"` or `"deny"` | `updatedOutput` | Controls completed tool output before context ingestion (when declared `gate`); `updatedOutput` sanitizes result before ingestion. Controls ingestion into agent context, not tool execution rollback. |
| `PreNetworkAccess` | `decision: "allow"`, `"deny"`, `"ask"`, or `"defer"` | None. | `deny` prevents pending outbound application request. |
| `PostNetworkAccess` | `decision: "allow"` or `"deny"` | None. | Controls delivery of completed response content to the application caller (when declared `gate` on buffered transport); `deny` prevents response delivery. Controls delivery to caller, not network rollback. Response body inspection and rewriting are deferred to RFC 0005. |
| `PreMemoryWrite` | `decision: "allow"`, `"deny"`, `"ask"`, or `"defer"` | `updatedContent` | `deny` prevents durable write; `updatedContent` replaces content persisted to memory store. |
| `PreConfigChange` | `decision: "allow"`, `"deny"`, `"ask"`, or `"defer"` | None. | `deny` prevents pending effective configuration mutation. |
| `SubagentStart` | `decision: "allow"` or `"deny"` | None. | Controls child agent delegation before executable work is dispatched. |

An `allow` only passes that hook's native gate; it MUST NOT override sandbox,
organization, managed-policy, or user-approval restrictions.

### Multiple handlers and repeated evaluation

A **pending action** is the effect controlled at one declared Gate boundary:
for a Pre Gate, the dispatch or mutation that has not occurred; for a Post
Gate, the delivery, rendering, or ingestion that has not occurred. A host that
accepts a valid `deny` (or `block` where that event supports it) for a pending
action MUST NOT perform that action. An accepted denial can use the canonical
top-level decision or a supported legacy nested denial when the top-level
decision is absent. This denial is binding for the same pending action at the
same Gate boundary. It MUST survive:

- another handler returning `allow`, `ask`, `defer`, or a rewrite;
- another handler returning no usable control result because its response is
  absent, invalid, mismatched, errored, or timed out;
- redelivery to the same or another handler with a different `event_id`; and
- reevaluation of that pending action, including reevaluation required after
  its target or proposed values change.

`event_id` correlates one response to one delivery; changing it MUST NOT clear
a denial of the underlying pending action. An operation identifier can span
different lifecycle boundaries, but a Pre boundary and its Post boundary
control distinct pending actions. A denial at one boundary therefore does not
become a control result at another boundary, and a denial for one operation
MUST NOT deny an unrelated operation.

Core does not prescribe whether hosts invoke handlers sequentially or in
parallel, or how they order or reconcile multiple valid rewrites. Unless an
accepted denial has already made the action impossible, a host MUST NOT cross
the Gate until every applicable handler invocation has completed or reached
its declared deadline, every applicable `ask` or native approval has resolved,
and native policy permits the action. A response failure supplies no decision;
it MUST NOT erase another valid decision or cause an already accepted rewrite
to be silently discarded. If the action is otherwise permitted, accepted
rewrites remain subject to the host's mutation ordering and conflict policy
and to the native validation rule below.

For Post Gates (`AfterModelResponse`, `PostToolUse`, `PostNetworkAccess`), the
controlled effect is strictly delivery to the caller, rendering to the user, or
ingestion into session context. Gating a Post event MUST NOT be interpreted as
rolling back, undoing, or compensating for the already-completed model inference,
tool execution, or network transaction.

For Gates supporting `ask`, `ask` represents pending authorization. The portable
contract requires that the operation MUST NOT execute or deliver until approval
resolves. If the host is interactive, it delegates to the host approval flow. If
the host is non-interactive and lacks a native suspension mechanism, it MUST
treat `ask` as `deny`. A host supporting asynchronous turn suspension MAY suspend
the turn awaiting approval. Token format, token issuance, expiration, replay
protection, persistence, and resumption APIs are host- or profile-specific
mechanisms and are not defined as an interoperable wire protocol in Core 0.1.
`defer` leaves resolution to native approval or policy and MUST NOT count as
approval.

When a handler supplies a schema-valid, event-supported rewrite or native
approval update from the Gate table above, the host
MUST apply its native validation rules before committing the mutated value. If the
replacement fails native validation, the host MUST fail closed (terminating the
turn or treating the decision as `deny`) and MUST NOT silently fall back to the
unredacted original value, which could reintroduce sensitive data or prompt
injections.
The [event registry](./events.md#gate-and-observe-semantics) defines their
request-mutation preconditions and which response members have no control
effect.

Agent Hook control semantics are portable; native response documents are not.
An adapter MUST interpret a control response only for a Core event classified as
a Gate by the event registry and declared `gate` by the host. It MUST NOT claim
universal Claude Code response compatibility. Claude Code uses event-specific
response shapes, and it emits neither `BeforeModelRequest` nor
`AfterModelResponse`; a model-response mapping requires a future profile or a
new host-specific mapping.

For an `observe` event, top-level `decision` and all control members in
`hookSpecificOutput` MUST be ignored for control purposes. A host MAY retain
them as diagnostic or observational data. A `partial` or `unavailable`
capability MUST NOT emit a normalized Core event.

## Fail-open behavior

An absent response, invalid JSON, schema-invalid response, correlation
mismatch, handler error, or timeout supplies no Agent Hook control result for
that invocation. It is not an implicit denial or permission. After every
applicable handler invocation has completed or reached its deadline, the host
MUST continue the pending action if no accepted denial binds it, no other
applicable valid Agent Hook decision withholds permission, required approvals
have resolved, and independent native policy permits it. Thus a timeout as the
only handler outcome retains the 0.1 fail-open default, while a timeout
alongside an accepted denial does not weaken that denial. Adapters SHOULD emit
a diagnostic record containing the event ID, hook event name, failure class,
and handler identity without retaining sensitive event data.

This requirement controls only Agent Hook 0.1. It does not weaken host,
sandbox, administrative, or organization policy. A host requiring fail-closed
enforcement MUST use a native mechanism or a future explicitly configured
profile; it MUST NOT reinterpret an Agent Hook failure as an implicit block
while claiming 0.1 default behavior.

## Host obligations

For one event delivery to one handler, the host and its adapter have the
responsibilities below. This section collects the existing requirements for
implementers; the linked clauses define their scope. The table is a reading
guide, not a new execution order for native policy checks or multiple handlers.

| Responsibility | What the host or adapter does | Existing definition |
| --- | --- | --- |
| Declare the actual boundary | Publish a mode for every Core event. Claim `gate` only when the registry classifies the event as a Gate and the host can faithfully observe and enforce it. Declare limitations; do not normalize a `partial` or `unavailable` signal into a Core event. | [Versioning and conformance](#versioning-and-conformance) |
| Construct a faithful event | Emit a schema-valid event at the event's defined boundary, with the required delivery, session, turn, and operation identifiers. Preserve correlation through the adapter. Omit optional context that cannot be supplied faithfully and apply the existing redaction rules. | [Event envelope](#event-envelope), [security correlation](#security-correlation), [data minimization](#data-minimization-and-redaction), [event registry](./events.md#core-event-registry) |
| Validate and pair the response | Check the response schema and match `event_id` to this delivery. If `hookSpecificOutput` is present, also match its `hookEventName` to the event's `hook_event_name`. Schema validation alone does not establish these cross-document matches. | [Response envelope](#response-envelope) |
| Apply the event's Gate control | Interpret control only for a registry Gate declared `gate`. Apply that event's response shape and effect, including its rewrite support where defined. An accepted valid denial remains binding to the same pending action at that boundary across handlers, delivery retries, and reevaluation. The network, memory, and configuration Gates require reevaluation if the presented operation, target, or proposed values change before dispatch or mutation. | [Response envelope](#response-envelope), [multiple handlers and repeated evaluation](#multiple-handlers-and-repeated-evaluation), [Gate and Observe semantics](./events.md#gate-and-observe-semantics) |
| Keep Observe responses observational | Ignore response controls for control purposes on an `observe` event. Diagnostic or observational retention is optional; retaining a response does not authorize changing the observed action. | [Response envelope](#response-envelope), [Gate and Observe semantics](./events.md#gate-and-observe-semantics) |
| Preserve native authority | An Agent Hook `allow` passes only that hook's native gate. Sandbox, organization, managed-policy, and user-approval restrictions still apply. Follow the event-specific approval semantics: `PreNetworkAccess`, `PreMemoryWrite`, and `PreConfigChange` use native approval for `ask`, treat `ask` as `deny` on a non-interactive host, and do not treat `defer` as approval. | [Response envelope](#response-envelope) |
| Handle response failures | An absent or unusable response supplies no Agent Hook control result for that invocation. Continue a pending action only when no accepted denial, other valid Agent Hook decision, unresolved approval, or independent native policy blocks it. Adapters should record the minimal diagnostics described below. | [Fail-open behavior](#fail-open-behavior) |

### Response-failure reference

All conditions in this table have the same outcome under the existing
[fail-open rule](#fail-open-behavior): no Agent Hook control result from that
invocation. For an event declared `gate`, an isolated failure does not deny the
pending action, but it does not override accepted denials, other applicable
decisions, unresolved approvals, or independent native policy. For an
`observe` event, a response has no control effect in the first place.

| Condition | Why it is not a valid control result |
| --- | --- |
| Absent response | The handler supplies no response document. |
| Invalid JSON | The response cannot be parsed as JSON. |
| Schema-invalid response | The response does not satisfy the Hook Response schema. |
| Correlation mismatch | `event_id` does not identify this delivery, or a present `hookSpecificOutput.hookEventName` does not match the event name. |
| Handler error | The host or adapter observes a handler failure. |
| Timeout | The handler does not complete within the host's timeout; 0.1 does not define the timeout value. |

An absent response means no response document. A schema-valid document that
omits optional control members is a different case; this table does not define
a general default decision for it.

The existing diagnostic recommendation is to retain the event ID, hook event
name, failure class, and handler identity without retaining sensitive event
data. These are diagnostic contents, not a new record schema or audit transport.
Recording a failure does not turn it into a denial or an approval.

### Boundaries still open in 0.1

The following questions are not resolved by consolidating the existing host
requirements. They need explicit design decisions before implementations can
rely on a shared behavior:

| Question | Current boundary |
| --- | --- |
| Common-field precedence on a Gate | The schema accepts common members such as `continue` and `stopReason`, but 0.1 does not fully define their interaction with event-specific Gate controls. For example, it does not define a portable precedence rule for `continue: false` together with `permissionDecision: "allow"`. The existing Observe control-ignore rule still applies. |
| Ordering or conflict between multiple valid rewrites | Core does not prescribe sequential or parallel handler scheduling, mutation order, or a winner between conflicting valid rewrites. The host's policy is still subject to deny preservation, completion and deadline safety, and fail-closed native validation of the value it would commit. A response failure alone cannot erase an accepted rewrite or restore the original value. |
| Failure to construct a valid event | Producers still owe schema-valid, faithful events and accurate capability declarations. The fail-open clause covers response and handler failures; it does not define a general disposition of the pending operation when the producer cannot construct a valid event. Fabricating missing data or treating an unfaithful signal as a normalized Core event would violate the existing requirements. |

Handler scheduling, rewrite conflict resolution, transport bindings, and
asynchronous approval mechanisms remain outside this section's scope except
for the minimum composition and approval-safety requirements above. No general
fail-closed profile or new approval mechanism is introduced here.

## Versioning and conformance

`spec` is a major/minor contract identifier. A 0.1 implementation MUST emit and
accept exactly `agent-hook-unity/0.1`. The earlier `agent-hooks/0.1` value
collides with a different project and MUST NOT be silently accepted or
negotiated as an alias. The namespace change is a coordinated migration to a
separate wire identity, not a compatibility claim. Pinned pre-migration schemas
remain linked from the
[schema guide](https://github.com/trendmicro/agent-hook-unity/blob/main/schemas/README.md)
for integrations that deliberately retain the old draft. Future incompatible
envelopes require a new major version.

This revision consolidates an unaccepted 0.1 draft under the new identity and
extends it with `PreNetworkAccess`,
`PostNetworkAccess`, `PreMemoryWrite`, `PostMemoryWrite`, and `PreConfigChange`
while preserving the current partial `PostNetworkAccess` Gate: it can control
delivery on a buffered transport, while response-body inspection and rewriting
remain deferred to RFC 0005. The original 13-event 0.1 schemas reject the five
additional event names. The immediate pre-migration 18-event schemas include
them but use the former colliding identifier. Implementations MUST treat this
as an explicit migration rather than inferred compatibility.
Adopters MUST update their schemas and capability declarations and ensure
handler compatibility and configuration before enabling the new events.
Hosts MUST deliver these events only to handlers configured for this revised
draft. Automatic handler discovery or version negotiation is not defined, and
an unknown event MUST NOT be treated as an implicit `allow` response.
The [fail-open rule](#fail-open-behavior) still applies to response failures
for configured event deliveries.

The provenance and still-pending adoption decisions for this consolidation are
recorded in
[draft RFC 0007](https://github.com/trendmicro/agent-hook-unity/blob/main/rfcs/0007-core-draft-consolidation.md).
That RFC is not accepted, and this text does not represent an acceptance
decision.

A host claiming 0.1 conformance MUST publish a capability declaration that
enumerates every Core `hook_event_name` in the event registry. For each name,
the declaration MUST state exactly one of these modes:

| Mode | Meaning |
| --- | --- |
| `gate` | The host emits the event before the relevant irreversible operation and enforces a valid Agent Hook decision. |
| `observe` | The host emits a faithful event, but a handler response cannot control the operation. |
| `partial` | The host has a related native signal but cannot faithfully meet one or more required timing, field, correlation, control, or privacy semantics. The declaration MUST identify the limitation, and the host MUST NOT emit the signal as a normalized Core event. |
| `unavailable` | The host cannot emit the event faithfully. |

A host MUST NOT fabricate a Core event to improve its declaration. It MUST NOT
declare `gate` when the native timing is post-effect, a response cannot be
enforced, redaction removes the security-relevant information needed for the
declared boundary, or the event registry classifies the event as Observe.
Core 0.1 normatively adheres to the [fail-open rule](#fail-open-behavior) for an
individual handler error or timeout while preserving other valid decisions for
the same pending action. Alternative degradation behaviors (such as general
fail-closed enforcement profiles) are deferred to dedicated profile RFCs.

Core membership standardizes event names and semantics; it does not require a
host to implement every event. Per-event obligations apply to the capabilities
actually claimed, as specified by the [event registry](./events.md#core-event-registry).
Network and memory Pre and Post support MUST be declared independently.

An implementation conforms as an **event producer** if it emits schema-valid
events, publishes an accurate capability declaration, and implements this
document's required semantics. It conforms as a **handler** if it accepts
schema-valid events and emits schema-valid correlated responses. An **adapter**
conforms if it preserves core semantics and correlation while mapping between a
native hook facility and the event/response contract. Conformance does not
imply compatibility with a vendor's configuration file or response envelope.
