---
sidebar_position: 5
---

# Security considerations

Hook payloads can contain user prompts, filesystem paths, source code, tool
arguments, tool outputs, model requests and responses, environment details,
credentials, network destinations, durable memory content, and configuration
values. Hosts, adapters, and handlers MUST treat all event data as
untrusted input and SHOULD minimize the values they expose, persist, or
transmit.

## Policy authority

An Agent Hook control response that permits an operation only passes that
handler's gate. It MUST NOT bypass native approval, sandbox, organization,
managed-policy, or platform restrictions. A refusal reason should be useful to
the agent but MUST NOT expose secrets or protected policy details. A response
that requests approval must use a host approval flow. The pending action MUST
NOT proceed while approval is unresolved; non-interactive hosts without a
native suspension mechanism MUST deny instead of assuming consent.

Once the host accepts a valid denial for a pending action at a Gate boundary,
that denial remains binding across other handler results, delivery retries,
and reevaluation of the same pending action. A failure, timeout, or later
`allow` MUST NOT turn that denial into permission. This rule is scoped to the
same pending action and boundary: a related Post Gate controls a distinct
delivery or ingestion action, and an unrelated operation requires its own
decisions.

Only the gate events defined by the event registry may interpret a control
response: `SessionStart`, `UserPromptSubmit`, `BeforeModelRequest`,
`AfterModelResponse`, `PreToolUse`, `PermissionRequest`, `PostToolUse`,
`PreNetworkAccess`, `PostNetworkAccess`, `PreMemoryWrite`, `PreConfigChange`,
and `SubagentStart`. A host MUST ignore a control response for any other
`hook_event_name` for control purposes. In particular, a control response
returned for an event classified as Observe (such as `PermissionDenied`,
`PostToolUseFailure`, `SubagentStop`, `Stop`, or `SessionEnd`) MUST NOT be
represented as preventive enforcement.

The network, memory, and configuration Gates MUST apply the
[request-mutation preconditions](./events.md#gate-and-observe-semantics): a
decision cannot authorize a target or proposed value that changed after the
handler evaluated it. For `PreMemoryWrite`, `updatedContent` permits surgical
redaction before durable storage. For `PostNetworkAccess`, gating controls response
delivery before caller access; response body replacement is deferred to RFC 0005.
`PreNetworkAccess` covers application request dispatch, not kernel-level
enforcement or complete SSRF protection. A failed or interrupted network request
or memory write can have partial effects; the
[terminal-result rules](./events.md#network-and-memory-terminal-results) do not
promise rollback. A configuration denial must prevent the pending mutation,
not attempt to undo an effective change.

## Handler isolation and transport

Agent Hook does not standardize execution isolation or transport. Hosts SHOULD
run handlers with least privilege, provide only the working-directory and
environment access they require, set finite timeouts, and restrict outbound
network destinations. Adapters SHOULD avoid putting credentials into command
arguments, output, or persisted diagnostics.

## Security telemetry and capability claims

The Core event registry provides a minimum vocabulary for reconstructing an
agent security-relevant lifecycle: session and turn boundaries, user ingress,
model requests and responses, tool execution, permission outcomes,
subagent delegation, application network requests, durable memory writes,
and effective configuration changes. Telemetry consumers MUST retain the exact
`hook_event_name`; they MUST NOT replace it with a vendor-native event name.

A host MAY expose only the Core events it can observe faithfully. A conforming
host MUST publish a per-host capability declaration for every Core
`hook_event_name`, using exactly one of these modes:

| Mode | Meaning |
| --- | --- |
| `gate` | The host emits the event at the defined pre-action boundary and can enforce a control response through a native mechanism. |
| `observe` | The host emits the event faithfully but does not treat a response as control. |
| `partial` | The host exposes a related boundary with a documented difference in timing, payload, or control behavior. |
| `unavailable` | The host cannot emit the event faithfully. |

A host MUST NOT claim `gate` when it cannot prevent the pending operation, or
claim `observe` when it only infers the event from a later side effect. A
capability declaration describes the host's observable and enforceable surface;
it does not override an independent security policy.

Core membership does not require runtime support. Network and memory Pre and
Post capabilities are independent; a faithful Post observation does not imply
that the host could gate the operation. Hidden SDK redirects or retries require
the capability limitations described in the [event registry](./events.md#prenetworkaccess).

Security telemetry SHOULD preserve `session_id`, `model_request_id`,
`tool_use_id`, `permission_request_id`, `operation_id`, and `delegation_id`
when they are present. It SHOULD preserve `parent_agent_id` for delegated work.
These identifiers let a consumer distinguish an operation that was denied
before execution from one that executed and later failed, including when tool
calls or subagents run concurrently.

## Failure and telemetry

The 0.1 default is fail open for an individual unavailable, malformed, errored,
or timed-out handler response: that invocation supplies no control result. It
does not become a denial, erase an accepted denial or rewrite, resolve an
approval, or override native policy. Hosts SHOULD record a minimal diagnostic
with the event ID, `hook_event_name`, handler identity, and failure class. They
SHOULD redact or omit prompt text, model data, tool data, secrets, and personal
data from those records. A diagnostic record SHOULD retain only the correlation
identifiers and outcome needed to investigate the event.

Handlers SHOULD validate the event schema before producing a security control
response and SHOULD return only one correlated response. A response for a
different event ID is invalid and supplies no control result for that
invocation under the Core protocol; it cannot override another valid result.
