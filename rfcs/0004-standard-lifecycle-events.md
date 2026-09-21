---
title: "RFC 0004: Standard network, memory, and configuration lifecycle events"
status: Draft
discussion: "Pending — prerequisite Discussion has not been opened"
review-start: "Not started"
review-end: "Not scheduled"
maintainer-votes: []
decision: "Pending"
supersedes: []
superseded-by: []
---

# RFC 0004: Standard network, memory, and configuration lifecycle events

## Summary

**Historical proposal baseline:** The event table below preserves this
proposal's original classifications, including Observe-only
`PostNetworkAccess`. PR #9 subsequently changed the working draft, and
[RFC 0007](./0007-core-draft-consolidation.md) records the resulting candidate
baseline and identity migration. This RFC remains unaccepted; its original
proposal does not override the current canonical candidate.

Extend the Agent Hook 0.1 draft's single standard event registry with
`PreNetworkAccess`, `PostNetworkAccess`, `PreMemoryWrite`, `PostMemoryWrite`,
and `PreConfigChange`. This adds five events to the thirteen proposed by
[RFC 0001](./0001-agent-hook-core-event-contract.md), without changing those
events' names, timing, control behavior, or shared envelope.

An event's inclusion in the standard does not require every host to implement
it. Hosts retain the existing `gate`, `observe`, `partial`, and `unavailable`
capability declarations. A host claiming support must implement the declared
event faithfully; no separate optional-event namespace is introduced.

This is a proposal, not an accepted specification. Formal review has not
started. Repository Discussions was enabled on 2026-09-21; a prior Discussion
must still be linked before the formal review window begins under
[GOVERNANCE.md](../GOVERNANCE.md).

## Motivation

Personal assistants and local developer agents make network requests, save
durable context, and change settings that affect their behavior. Tool hooks
alone do not describe these actions consistently when they occur through
different libraries or storage mechanisms. Shared boundaries let independent
implementations observe these actions and, where a host supports enforcement,
ask the user or prevent a pending action.

These needs do not depend on enterprise infrastructure. This proposal defines
interchange contracts, not a required policy engine or security architecture.

## Proposal

### Requirement language and scope

The key words **MUST**, **MUST NOT**, **SHOULD**, **MAY**, and **OPTIONAL** are
interpreted as described in BCP 14
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) only when they
appear in all capitals. Event requirements apply to hosts declaring the event
`gate` or `observe`; `partial` and `unavailable` MUST NOT be presented as
faithful standard-event deliveries.

The original flat `spec: "agent-hooks/0.1"` envelope, delivery identifiers,
session ordering, redaction rules, and native policy authority are preserved.
No runtime, transport, handler discovery, capability negotiation, signature,
ledger, approval gateway, or managed session revocation is specified here.

### Event contracts

All events retain the required common envelope fields from RFC 0001. The
following fields are additional, flat top-level members:

| Event | Boundary | Required fields beyond the envelope | Classification |
| --- | --- | --- | --- |
| `PreNetworkAccess` | Before dispatching one application-level outbound request. | `operation_id`, `prompt_id`, `destination_host`, `destination_port`, `protocol` | Gate |
| `PostNetworkAccess` | At the terminal result of one started outbound request. | The same identifiers and target fields, plus `outcome`; `error` on non-success | Observe |
| `PreMemoryWrite` | Before one durable agent-memory write takes effect. | `operation_id`, `prompt_id`, `memory_store_id`, `memory_key`, `content` | Gate |
| `PostMemoryWrite` | At the terminal result of one started memory write. | `operation_id`, `prompt_id`, `memory_store_id`, `memory_key`, `outcome`; `error` on non-success | Observe |
| `PreConfigChange` | Before changing configuration that affects agent behavior or capabilities. | `operation_id`, `config_target`, `mutation_type`; `new_value` for create/update | Gate |

Identifiers and targets are nonempty strings. Network `destination_host` is a
bare hostname or IP address, without credentials or URL components;
`destination_port` is an integer from 1 through 65535. `protocol` identifies
the application protocol in lowercase, matching `^[a-z][a-z0-9+.-]*$`.
Memory `content` and configuration values may contain any JSON value,
including `null`. A null value is distinct from an absent member.

Both Post events use `outcome: "success" | "failure" | "interrupted"`.
Non-success outcomes MUST include the existing `error` object with a
nonempty `type` and optional string `message`; success MUST omit `error`.
Both MAY include a nonnegative numeric `duration_ms`. Failure or interruption
does not establish that a partially performed operation was rolled back.

### Operation identity and coverage

`operation_id` identifies one underlying action and MUST be unique within
its session across network, memory, and configuration operations. It MUST be
retained across paired events and re-delivery. `event_id` continues to identify
a delivery. Matching destinations or memory keys MUST NOT be used to infer
operation identity. A native approval request or denial for this same action
MUST retain its `operation_id` when represented by the existing permission
events.

The network and memory events in this proposal are turn-scoped and require
`prompt_id`. Background activity without a caller-initiated turn is outside
their scope. `PreConfigChange` MUST include `prompt_id` if attributable to a
turn and MUST omit it otherwise; a host MUST NOT invent a turn identifier.

Hosts MAY support either side of a pair independently. A host with only Post
visibility MUST still assign the operation identifier to the underlying
action and MUST NOT fabricate a Pre event. When both sides are emitted, the
Post event MUST retain the Pre event's operation, turn, and target fields.
Exactly one terminal occurrence is reported for each started operation whose
terminal result is observed; re-deliveries retain the operation identity.
A denied operation that never starts MUST NOT produce a Post event claiming
that execution occurred. Existing permission events remain available where
their own required fields and lifecycle semantics can be met.

### Network request unit

Each request is a separate operation even when requests reuse a connection.
Pre occurs before request bytes are dispatched; Post occurs after the
response body completes, fails, or is interrupted. A streaming chunk, socket
open/close, or DNS lookup is not this request boundary. A completed HTTP
error response is still a completed request (`success` here describes the
protocol operation, not the application's interpretation of its status).

Redirects and retries that dispatch another request MUST have a new
`operation_id` and, when `gate` is claimed, a new gate evaluation. Post MUST
report that request's original destination, rather than silently replacing
it with a redirect destination. Hidden library retries or redirects that
prevent faithful coverage require a `partial` capability declaration.

Post MAY include nonnegative integer `bytes_sent` and `bytes_recv`, counting
serialized application request and response body bytes as transmitted for
that request, before content decoding and excluding headers, framing, and
transport overhead. Compressed bodies count in their transmitted compressed
representation. Decoded-only, estimated, or unassignable counts MUST be omitted;
zero means an observed zero. No kernel interception or complete SSRF
protection is implied by these fields or event names.

Post MAY include `status_code`, an integer response status in the namespace
of the declared `protocol`. It MUST describe this request's response, not a
later redirect or retry. It MUST be omitted when no response status is
available or the protocol has no integer response status; hosts MUST NOT
substitute local transport errors or a synthetic zero. For protocols with
interim responses, only the final response status MAY be reported; if no
final status was observed, the field MUST be omitted.

For HTTP(S), the value is the HTTP response status code defined by
[RFC 9110, Section 15](https://www.rfc-editor.org/rfc/rfc9110.html#section-15).
A complete HTTP 403 response has `outcome: "success"` and MAY carry
`status_code: 403`. A known final status MAY also be retained if the response
body subsequently fails or is interrupted; it does not change the existing
`outcome` or `error` requirements.

### Durable memory and configuration

Memory writes cover creation, replacement, or upsert of durable agent context
in a logical store. The store may use files, a local database, or a remote
service. `memory_store_id` and `memory_key` identify its logical target;
`content` is the value proposed for persistence. Ordinary file writes and
volatile scratchpad updates are outside this event's scope. A host claiming
`gate` MUST prevent a denied write before it becomes persistent or visible.

Configuration targets are logical settings or complete configuration
documents affecting the agent, such as model settings, tool availability,
MCP configuration, or agent rules. `config_target` identifies that granularity;
it is not an arbitrary file-change notification. `config_file_path` MAY name
a backing file when meaningful and safe to disclose. `old_value` MAY expose
the previous value if known and safe. `mutation_type` is one of:

| Mutation | Value requirements |
| --- | --- |
| `create` | `new_value` MUST contain the complete proposed value at the target. |
| `update` | `new_value` MUST contain the complete proposed value at the target, not an unspecified patch. |
| `delete` | `new_value` MUST be absent. |

Cryptographic hashes are not required or newly standardized. Denial MUST
prevent the pending change; it does not mean reverting an already effective
change. A separate configuration-completion event is deferred.

### Control responses

The three new Gate events use `hookSpecificOutput.permissionDecision` with
`allow`, `deny`, `ask`, or `defer` and optional `permissionDecisionReason`.
The response MUST retain the existing envelope and matching `hookEventName`.
`allow` clears only this hook; `deny` prevents the pending operation; `ask`
uses native host approval and a non-interactive host MUST deny; `defer`
leaves the decision to native policy and MUST NOT count as approval.

The existing fail-open rules for unavailable or invalid hook responses remain
unchanged and do not override independent host policy. These events introduce
no payload-replacement controls: `updatedInput`, `updatedMessages`, and other
undefined control members have no control effect for them. A host MUST NOT
apply a decision to a changed target or value; a changed operation requires
a fresh gate evaluation before it takes effect. All control members on the
two Post events MUST be ignored for control purposes.

### Integration and validation

After acceptance, update the canonical specification, both JSON Schemas,
their published website copies, focused valid/invalid fixtures, and website
status text. Keep protocol semantics in `spec/` rather than duplicating them
in website source. Fixtures cover required operation identity, protocol and
port constraints, terminal outcome/error combinations, optional response
status and metrics, and configuration creation, update, deletion, and null
values. Existing valid fixtures, including native `ask`, remain valid.

Schema validation verifies document shape. Correlation, accurate capability
claims, timing, policy enforcement, and redaction require implementation
review; this RFC does not introduce a reference runtime or claim runtime
conformance from passing JSON fixtures.

## Compatibility impact

This proposal amends an unaccepted 0.1 draft. It preserves the existing
thirteen event definitions and does not add model-call aliases, rename
subagent events, or promote Observe events to Gate. A generalized peer-agent
invocation contract needs a separate proposal.

Existing events and responses remain valid, but older schemas reject the five
new names. Implementers adopting the revised draft MUST update their schemas
and capability declarations. Hosts MUST send the new events only to handlers
configured to understand this revised draft; this is not automatic feature
negotiation or universal backward compatibility. An unsupported event MUST
NOT be mistaken for an explicit permission grant. A failure remains subject
to the existing fail-open and independent native-policy rules.

## Security and privacy impact

Targets and values can disclose browsing destinations, preferences, personal
memory, credentials, or configuration secrets. Apply the existing minimization
and redaction rules before delivery. Hosts MUST NOT fabricate values or claim
`gate` when redaction or timing prevents faithful enforcement. Post memory
events do not require a copy of stored content; network events do not require
request bodies or headers. No internal model reasoning, enterprise identity,
signature, or audit record is required.

## Alternatives considered

- **Merge the full enterprise proposal:** couples useful events to transport,
  ledger, asynchronous approval, and runtime implementation decisions.
- **Freeze the registry at thirteen events:** leaves common lifecycle points
  to incompatible vendor extensions despite the existing capability model.
- **Create an optional-event namespace:** adds another registration mechanism
  without improving on per-event capability declarations.
- **Use socket lifecycle as Network:** does not pair cleanly with pooled
  connections, redirects, retries, and application request completion.
- **Retain `ConfigChange` as a pre-action name:** obscures whether a change
  has already happened. `PreConfigChange` makes the gate timing explicit.
- **Require hashes instead of configuration values:** a digest alone does
  not describe the proposed configuration change to a general handler.

## References

### Normative references

- [RFC 2119: Key words for use in RFCs to Indicate Requirement Levels](https://www.rfc-editor.org/rfc/rfc2119).
- [RFC 8174: Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words](https://www.rfc-editor.org/rfc/rfc8174).
- [RFC 0001](./0001-agent-hook-core-event-contract.md): Agent Hook 0.1 Core Event Contract (Draft).
- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12): schema dialect used by the repository.
- [RFC 9110, Section 15](https://www.rfc-editor.org/rfc/rfc9110.html#section-15): HTTP response status codes.

### Informative references and attribution

The selected network, memory, and configuration event concepts are adapted
from Brian Chuang's [PR #1](https://github.com/trendmicro/agent-hook-unity/pull/1),
commit `4beb7b79190b3dfdfd85e42c2b53f71483b2db6c`. This proposal changes their
scope, correlation, configuration representation, and capability requirements.
It does not supersede the remaining work in that PR. RFC numbers 0002 and
0003 remain associated with its enterprise and asynchronous approval proposals.

## Decision record

Pending. No maintainer votes or acceptance are recorded. A linked Discussion
and the review window required by repository governance must precede a
decision. A dependent implementation may be prepared as a Draft PR but must
not be merged as an accepted standard before the RFC process completes.
