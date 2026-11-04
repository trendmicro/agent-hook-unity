---
title: "RFC 0008: Delegation lineage and session trace context"
status: Draft
discussion: "Pending — prerequisite Discussion has not been opened"
review-start: "Not started"
review-end: "Not scheduled"
maintainer-votes: []
decision: "Pending"
supersedes: []
superseded-by: []
---

# RFC 0008: Delegation lineage and session trace context

## Summary

Make delegated (sub-agent) work traceable end to end within the Agent Hook
Unity 0.1 draft. The draft already defines `SubagentStart` and `SubagentStop`
with `delegation_id`, `agent_id`, and `parent_agent_id`, and its schema carries
an optional `trace` object that the normative text never defines. This
proposal closes four gaps:

| Gap in the current draft | Proposed change | Where |
| --- | --- | --- |
| Events emitted *inside* a child agent need not identify that child or its delegation. | Every event whose acting agent is a delegated agent MUST carry `agent_id` and `delegation_id`. | Core amendment |
| The delegation tree cannot be rebuilt from identifiers alone, and the delegating tool call is not linked. | Add `parent_delegation_id` and `delegating_tool_use_id`; require `delegation_depth` on `SubagentStart`. | Core amendment |
| Resumption, child sessions, and host-internal agents are unspecified. | One `delegation_id` per `SubagentStart`; `parent_session_id` for child sessions; no Core `SubagentStop` without a start. | Core amendment |
| `trace` exists only in the schema. | Define W3C Trace Context semantics, add `parent_span_id`, and state that trace data never replaces Core correlation. | Core amendment |

It also proposes an optional `sec.enterprise.delegation` extension profile
that gives a `SubagentStart` handler the delegated task fingerprint, the
child's effective scope relative to its parent, and delegation budget
counters, so that stateless policy decision points can deny privilege
escalation and runaway fan-out.

No Core event is added, renamed, or reclassified. The Core fail-open default,
response envelope, and capability modes are unchanged.

This is a proposal against the **unaccepted Agent Hook Unity 0.1 draft**.
Formal review has not started. The prerequisite Discussion and review window
required by [GOVERNANCE.md](../GOVERNANCE.md) remain pending.

## Motivation

Integrators who build policy enforcement relays and security analytics on
the draft ask two questions: can a session be traced end to end, and can work
performed by sub-agents be tracked back to the delegation that caused it?

### What the 0.1 draft already provides

- `session_id` plus a strictly increasing `sequence` orders every event in a
  session ([Core protocol](../spec/0.1/core.md#event-envelope)).
- `prompt_id` groups the events of one caller-initiated turn, and
  `model_request_id`, `tool_use_id`, `operation_id`, `permission_request_id`,
  and `delegation_id` pair related events
  ([correlation and ordering](../spec/0.1/events.md#correlation-and-ordering)).
- `SubagentStart` is a Gate event emitted before a child receives executable
  work. It carries `delegation_id`, `agent_id`, `agent_type`, and
  `parent_agent_id`, and, when available, `delegation_depth` and
  `delegation_chain` ([`SubagentStart`](../spec/0.1/events.md#subagentstart)).
- Security telemetry SHOULD preserve `delegation_id` and `parent_agent_id`
  ([security telemetry](../spec/0.1/security.md#security-telemetry-and-capability-claims)).

### What is missing

1. **Child-originated events are not attributed.** `agent_id` is a MAY on the
   common envelope, and no event other than the `Subagent*` pair carries
   `delegation_id`. A `PreToolUse`, `PreNetworkAccess`, or `PermissionRequest`
   performed by a child is indistinguishable from the same action by the root
   agent. A handler cannot apply a stricter policy to delegated work, and a
   forensic consumer cannot attribute a harmful action to the delegation that
   caused it.
2. **The delegation tree is incomplete.** `delegation_chain` lists ancestor
   *agent* identifiers, which are not unique across resumptions, and both it
   and `delegation_depth` are optional. Nothing links `SubagentStart` to the
   tool call that requested the delegation and that carries the delegated task.
3. **Instance and session boundaries are undefined.** Hosts resume children,
   reuse agents for new work, run children in separate sessions, and run
   internal helper agents that were never started through a delegation. The
   draft does not say how these map to `delegation_id`, `session_id`, or
   `SubagentStop`.
4. **Trace context is undocumented.** The [event schema](../schemas/hook-event.schema.json)
   defines `trace` with `trace_id`, `span_id`, and `traceparent`, but no spec
   text states when it is populated, whether it propagates to children, how it
   relates to Core correlation, or how a span tree is rebuilt (there is no
   parent span).

## Proposal

### Requirement language and scope

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY**
are interpreted as described in BCP 14
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) only when they appear in all
capitals. They describe the **proposed** contract.

Definitions used below:

- **Root agent**: the agent that handles caller-initiated turns for a session.
  A host MUST use one stable identifier for the root agent within a session.
  That identifier is the root `parent_agent_id` and `delegation_chain[0]`.
- **Delegated agent**: an agent whose executable work was started under a
  `SubagentStart`.
- **Acting agent**: the agent on whose behalf the host performs the action or
  lifecycle step that an event reports.

Delegation across hosts (for example agent-to-agent protocols or remote agent
services) is out of scope; see [open questions](#open-questions).

### 1. Acting-agent attribution (Core amendment)

For every Core event other than `SubagentStart` and `SubagentStop`:

- When the acting agent is a delegated agent, the event MUST include `agent_id`
  set to that agent's identifier and `delegation_id` set to the delegation
  under which it is acting. It SHOULD include `delegation_depth` equal to the
  depth declared by that delegation's `SubagentStart`.
- When the acting agent is the root agent, the event MUST NOT include
  `delegation_id`. It MAY include `agent_id`; if present, it MUST equal the
  root agent identifier.
- Turn-scoped events of a delegated agent retain the `prompt_id` of the
  caller-initiated turn that caused the delegation, including when the
  delegated agent is still running after that turn's `Stop`.

On `SubagentStart` and `SubagentStop`, `agent_id` and `delegation_id` keep
their existing meaning (the child and the delegation itself). The acting
parent is identified by `parent_agent_id` and, for nested delegation,
`parent_delegation_id` (section 2).

Attribution values MUST be assigned by the host from its own execution
context. A host MUST NOT take them from model output, tool input, or any
content a delegated agent can influence. A delegated agent therefore cannot
present its actions as the root agent's by omitting or forging these members.

A consumer MUST NOT infer that an event without `delegation_id` came from the
root agent unless the host declares `delegation_attribution: "full"`
(section 5).

### 2. Delegation tree on `SubagentStart` (Core amendment)

| Member | Requirement |
| --- | --- |
| `delegation_depth` | Becomes REQUIRED. The child's depth: `1` for a direct child of the root agent. The schema minimum becomes `1`. |
| `delegation_chain` | Becomes SHOULD (previously MUST when available). Ordered ancestor agent identifiers from root to parent. When present, its length MUST equal `delegation_depth`, and its last element MUST equal `parent_agent_id`. |
| `parent_delegation_id` | New. MUST be present when the parent is itself a delegated agent, and MUST equal the `delegation_id` under which the parent is acting. MUST be omitted when the parent is the root agent. |
| `delegating_tool_use_id` | New. When the host starts the delegation through a tool invocation that it exposes as `PreToolUse`, `SubagentStart` SHOULD carry that invocation's `tool_use_id`. A host or adapter MUST include it only from a native identifier, and MUST NOT infer it from timing. |

`parent_delegation_id` turns the delegation set into a tree that a consumer
can rebuild from identifiers alone. `delegating_tool_use_id` lets a handler
join a `SubagentStart` to the `PreToolUse` whose `tool_input` describes the
delegated task.

`SubagentStop` gains one optional member: `agent_transcript_path`, which the
host SHOULD include when it safely exposes the delegated agent's own
transcript. It follows the existing `transcript_path` rules: the host omits it
rather than fabricating it, and redaction applies.

### 3. Delegation instances, resumption, and sessions (Core amendment)

- **One delegation per start.** Each `SubagentStart` begins a new delegation
  with a fresh `delegation_id`. This includes resuming a previously run child
  and handing new work to an existing agent. The host MUST retain the same
  `agent_id` for the same agent instance across resumptions, so a consumer can
  link them.
- **At most one stop.** Each delegation has at most one `SubagentStop`. A host
  whose native terminal signal exists only per agent instance, rather than per
  delegation, MUST declare `SubagentStop` as `partial`.
- **No orphan stops.** A native terminal signal for a host-internal agent that
  was never started through a Core `SubagentStart` MUST NOT be emitted as a
  Core `SubagentStop`. An adapter MAY map it to an extension event.
- **Child sessions.** If a host runs a delegated agent under a different
  `session_id`, every event of that child session MUST include
  `parent_session_id` (the delegating session) and the `delegation_id` that
  started it. `sequence` remains ordered per session. A consumer MUST NOT
  assume a total order across sessions; it orders across them through
  delegation links and timestamps.

### 4. Trace context (Core amendment)

The optional `trace` member is defined as follows:

| Member | Requirement |
| --- | --- |
| `trace.trace_id` | W3C Trace Context trace-id: 32 lowercase hexadecimal characters, not all zero. |
| `trace.span_id` | 16 lowercase hexadecimal characters, not all zero, identifying the span of the unit the event belongs to. |
| `trace.parent_span_id` | New, optional. The span that encloses `span_id`. Omitted only for the root span. |
| `trace.traceparent` | Optional. When present, its trace-id MUST equal `trace_id` and its parent-id MUST equal `span_id`, so that a handler recording its own processing span creates it as a child of the event's span. |

Requirements when a host emits `trace`:

1. All events of a session, and of every delegated agent in its delegation
   tree (including child sessions), MUST use the same `trace_id`.
2. Events paired by a Core correlation identifier (`model_request_id`,
   `tool_use_id`, `operation_id`, `permission_request_id`, `delegation_id`)
   MUST carry the same `span_id`, the span of that operation.
3. The span of a delegation (the span of its `SubagentStart` and
   `SubagentStop`) MUST be a child of the delegating span: the span of the tool
   invocation named by `delegating_tool_use_id` when present, otherwise the
   span of the parent's delegation or turn.
4. Spans of events whose acting agent is a delegated agent MUST be descendants
   of that delegation's span.
5. If the host received W3C trace context with the caller's request, it SHOULD
   continue that trace. It MAY start a new trace when the inbound context is
   untrusted, as W3C Trace Context permits.
6. A host SHOULD emit `trace` on every event of a session or on none of them.

The RECOMMENDED span hierarchy is session, then turn (`prompt_id`), then
operation or delegation, nesting further delegations and their operations
beneath each delegation span.

`trace` is supplementary telemetry. A host MUST NOT omit a Core correlation
identifier because `trace` is present. A consumer MUST NOT pair Core events,
or make a control decision, from span relationships alone. Trace identifiers
are not credentials, and a handler MUST NOT grant trust because an event
belongs to a particular trace.

The following mapping to the OpenTelemetry GenAI semantic conventions is
informative only. Those conventions have Development status and have moved to
a separate repository, so this RFC makes no conformance claim against them:

| Agent Hook | OpenTelemetry GenAI |
| --- | --- |
| `session_id` | `gen_ai.conversation.id` |
| `agent_id` | `gen_ai.agent.id` |
| `agent_type` | `gen_ai.agent.name` |
| `tool_use_id` | `gen_ai.tool.call.id` |
| Delegation span (`SubagentStart` / `SubagentStop`) | span with `gen_ai.operation.name` = `invoke_agent` |
| Tool span (`PreToolUse` / `PostToolUse`) | span with `gen_ai.operation.name` = `execute_tool` |

### 5. Capability declaration

In addition to a mode for each Core event, a conforming host's capability
declaration MUST state:

| Property | Values | Meaning |
| --- | --- | --- |
| `delegation_attribution` | `full`, `partial`, `none` | `full`: section 1 holds for every emitted event. `partial`: the declaration MUST list the events that lack attribution. `none`: delegated agents' events are not attributed. |
| `trace_context` | `full`, `none` | `full`: section 4 holds for every emitted event. `none`: `trace` is not emitted. |

A host that declares `SubagentStart` as `gate` or `observe` but cannot
attribute child events MUST declare `delegation_attribution` as `partial` or
`none`. It MUST NOT drop or fabricate events to improve this declaration.

### 6. Optional profile: `sec.enterprise.delegation`

This profile follows the extension-profile approach of
[RFC 0006](./0006-enterprise-security-extensions-strategy.md) and uses its
naming. It does not change any Core member, correlation identifier, or
capability mode, and it cannot turn an Observe event into a Gate.

A host claiming the profile attaches it to `SubagentStart`:

| Member | Requirement |
| --- | --- |
| `task.content_hash` | SHA-256 (lowercase hex) of the UTF-8 task text the child will receive. A handler can compare it with the delegating `PreToolUse` input, consistent with the `sec.enterprise.integrity` profile. |
| `task.description` | Optional short description, subject to the Core redaction rules. The full task text is not required. |
| `requested_model` | Optional model identifier requested for the child. |
| `scope.relation` | `subset`, `equal`, `broader`, or `unknown`: how the child's effective capability (tools, permission mode, network and memory reach) compares with the parent's at dispatch time. The host MUST compute it from its enforced configuration and MUST NOT report `subset` or `equal` unless it enforces the child's limits. `broader` indicates privilege escalation through delegation. |
| `scope.tools` | Optional list of the child's effective tool names. |
| `scope.permission_mode` | Optional effective permission mode of the child. |
| `budget.active_delegations` | Delegations in this session's delegation tree that have started and not stopped, excluding the pending one. |
| `budget.session_delegations` | Delegations started in this session's delegation tree, excluding the pending one. |
| `budget.max_depth` | Optional host-configured maximum depth, when one exists. |

The budget counters let a stateless policy decision point deny runaway fan-out
or recursion without keeping its own state. A handler acts on this profile only
through the Core `allow` or `deny` decision for `SubagentStart`. Narrowing the
child's scope through a response is not proposed; see
[open questions](#open-questions).

When a host's effective delegation gate is the delegating tool call rather than
`SubagentStart`, it MAY attach the profile to that `PreToolUse` event, omitting
members it cannot know before dispatch.

### 7. Adapter guidance: Claude Code

This guidance reflects the Claude Code hooks reference as observed on
2026-11-04. Native behavior varies by release; an adapter MUST verify the
behavior it relies on.

- **Child tool events.** Claude Code adds `agent_id` and `agent_type` to hook
  input when a hook fires inside a subagent, and child events share the
  parent's `session_id`. An adapter MUST add `delegation_id` by mapping the
  native `agent_id` to that agent's active delegation. This is an
  identifier-based mapping, not a timing inference.
- **Delegation gate.** Native `SubagentStart` cannot block subagent creation
  and only injects context. An adapter MUST NOT declare `SubagentStart` as
  `gate` on that basis. A deny is enforceable at `PreToolUse` for the `Agent`
  tool, whose `tool_input` carries the delegated `prompt`, `subagent_type`,
  and optional `model`.
- **Delegating tool call.** Native `SubagentStart` input has no tool-call
  identifier, so the adapter omits `delegating_tool_use_id`. The `Agent` tool's
  `PostToolUse` response includes the subagent's `agentId`, which a forensic
  consumer MAY use to link the tool call to the delegation afterwards. It MUST
  NOT be used for a control decision.
- **Resumption and teammates.** Native `SubagentStart` also fires when a
  subagent resumes and when an in-process teammate handles a new message. Each
  firing maps to a new `delegation_id` under section 3.
- **Internal agents.** Native `SubagentStop` also fires for internal agents
  (for example prompt suggestions) that had no `SubagentStart`. The adapter
  MUST NOT emit these as Core `SubagentStop`.
- **Child transcript.** Native `SubagentStop` provides `agent_transcript_path`,
  which maps directly to the proposed member.
- **Trace.** Hook input carries no W3C trace context, and Claude Code removes
  its `OTEL_*` exporter variables from hook subprocesses. An adapter that
  generates `trace` itself MUST satisfy section 4 for the whole session, or
  declare `trace_context: "none"`.

### 8. Interaction with RFC 0006

RFC 0006 is itself a Draft. If it proceeds, this RFC recommends that it:

- extend `SessionRevoke` to every delegated agent in the revoked session's
  delegation tree, including child sessions linked by `parent_session_id`, and
  consider revocation that targets a single `delegation_id` subtree;
- include child-originated events in the same audit chain as their session,
  and link child-session chains through `parent_session_id`;
- show the acting agent and its delegation chain to the approver when an
  asynchronous HITL `ask` concerns a child-originated `PermissionRequest`.

Wire signing needs no change: the new members are ordinary event members
covered by the event signature.

## Illustrative exchange

The root agent `main` delegates to `sub-17`, which delegates further to
`sub-18`. The existing schemas permit the proposed additional top-level
members, so the JSON examples below validate structurally. Structural
validation does not mean an existing host emits them. `trace.parent_span_id`
is not yet permitted by the schema and is shown only in the table.

| `sequence` | Event | Acting agent | Key identifiers | `span_id` ← `parent_span_id` |
| --- | --- | --- | --- | --- |
| 10 | `PreToolUse` (`Agent`) | `main` | `tool_use_id` `toolu_01` | `00f067aa0ba902b7` ← turn span |
| 11 | `SubagentStart` | `main` → `sub-17` | `delegation_id` `dlg-17`, `delegating_tool_use_id` `toolu_01`, depth 1 | `b7ad6b7169203331` ← `00f067aa0ba902b7` |
| 12 | `PreToolUse` (`Grep`) | `sub-17` | `delegation_id` `dlg-17`, `tool_use_id` `toolu_02` | `e457b5a2e4d86bd1` ← `b7ad6b7169203331` |
| 13 | `PostToolUse` (`Grep`) | `sub-17` | same as 12 | same as 12 |
| 14 | `SubagentStart` | `sub-17` → `sub-18` | `delegation_id` `dlg-18`, `parent_delegation_id` `dlg-17`, depth 2 | `5f2c1d9a8b7e6f40` ← `b7ad6b7169203331` |
| 15 | `SubagentStop` | `sub-18` | `delegation_id` `dlg-18` | same as 14 |
| 16 | `SubagentStop` | `sub-17` | `delegation_id` `dlg-17` | same as 11 |
| 17 | `PostToolUse` (`Agent`) | `main` | `tool_use_id` `toolu_01` | same as 10 |

The nested `SubagentStart` at sequence 14, with the optional profile (the hash
value is illustrative):

```json
{
  "spec": "agent-hook-unity/0.1",
  "event_id": "3b1f6a2e-8c4d-4f7a-9b2e-5d6c7e8f9a01",
  "hook_event_name": "SubagentStart",
  "session_id": "session-42",
  "timestamp": "2026-11-04T08:00:14Z",
  "sequence": 14,
  "prompt_id": "prompt-7",
  "delegation_id": "dlg-18",
  "agent_id": "sub-18",
  "agent_type": "Explore",
  "parent_agent_id": "sub-17",
  "parent_delegation_id": "dlg-17",
  "delegation_depth": 2,
  "delegation_chain": ["main", "sub-17"],
  "trace": {
    "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
    "span_id": "5f2c1d9a8b7e6f40",
    "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-5f2c1d9a8b7e6f40-01"
  },
  "extensions": {
    "sec.enterprise.delegation": {
      "task": {
        "description": "List HTTP route handlers",
        "content_hash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
      },
      "scope": {
        "relation": "subset",
        "tools": ["Read", "Grep", "Glob"]
      },
      "budget": {
        "active_delegations": 1,
        "session_delegations": 1,
        "max_depth": 3
      }
    }
  }
}
```

A handler that limits depth to 1 for this agent type would deny it:

```json
{
  "spec": "agent-hook-unity/0.1",
  "event_id": "3b1f6a2e-8c4d-4f7a-9b2e-5d6c7e8f9a01",
  "decision": "deny",
  "reason": "Nested delegation beyond depth 1 is not permitted for Explore agents."
}
```

The child's tool call at sequence 12 carries its attribution:

```json
{
  "spec": "agent-hook-unity/0.1",
  "event_id": "c2d4e6f8-1a3b-4c5d-8e7f-9a0b1c2d3e4f",
  "hook_event_name": "PreToolUse",
  "session_id": "session-42",
  "timestamp": "2026-11-04T08:00:12Z",
  "sequence": 12,
  "prompt_id": "prompt-7",
  "agent_id": "sub-17",
  "agent_type": "general-purpose",
  "delegation_id": "dlg-17",
  "delegation_depth": 1,
  "tool_name": "Grep",
  "tool_input": { "pattern": "router\\.(get|post)", "path": "src" },
  "tool_use_id": "toolu_02",
  "trace": {
    "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
    "span_id": "e457b5a2e4d86bd1"
  }
}
```

## Compatibility impact

This proposal amends an unaccepted 0.1 draft. The 18 Core event names, their
Gate/Observe classification, the response envelope, and fail-open behavior are
unchanged.

- **Additive members:** `delegation_id` and `delegation_depth` on
  non-`Subagent*` events, `parent_session_id`, `parent_delegation_id`,
  `delegating_tool_use_id`, `agent_transcript_path`, and
  `trace.parent_span_id`. Handlers that ignore unknown members are unaffected.
- **Stricter requirements:** `delegation_depth` becomes required on
  `SubagentStart`, and its minimum becomes `1`. The existing fixture
  `fixtures/hook-event/valid/subagent-start.json` must add it. Producers that
  omit it become non-conforming.
- **Schema revision:** `TraceContext` currently forbids additional properties,
  so events carrying `parent_span_id` fail against the current schemas until
  the schemas are revised.
- **New obligations for hosts that expose delegation:** attribute child events
  or declare `delegation_attribution` as `partial` or `none`. No host is
  required to expose delegation; `SubagentStart` and `SubagentStop` may remain
  `unavailable`.
- **Consumers** that assumed events without `delegation_id` came from the root
  agent must now check `delegation_attribution` first.

## Security and privacy impact

- **Attribution integrity.** Host-assigned attribution prevents a delegated
  agent from passing its actions off as the root agent's. Under
  `delegation_attribution: "full"`, a missing `delegation_id` reliably means
  the root agent acted.
- **Delegation as an escalation path.** `scope.relation: "broader"` makes
  privilege escalation through delegation visible before dispatch.
  `delegation_depth` and the budget counters let a handler stop recursive or
  fan-out abuse.
- **Sensitive task content.** Delegated task text can contain secrets or
  personal data. The profile requires only a hash and an optional redacted
  description; the full text already appears, subject to redaction, in the
  delegating `PreToolUse` when that is exposed.
- **Trace identifiers.** Trace and span identifiers MUST be random and MUST NOT
  encode user identifiers, secrets, or session tokens. They are not
  authentication material. A host MAY restart a trace when inbound context is
  untrusted.
- **Transcript locations.** `agent_transcript_path` can reveal file-system
  layout and follows the existing `transcript_path` redaction rules.

## Alternatives considered

- **Attribution as an extension profile only:** the extension policy forbids
  extensions from changing the meaning of a correlation identifier, and
  attribution is needed by every Core consumer, not only enterprise ones.
- **Rely on trace spans alone:** `trace` is optional and telemetry-oriented;
  Core correlation and control decisions must not depend on a tracing system.
- **Require a separate session per child:** host architectures differ;
  Claude Code runs children inside the parent session.
- **Repeat `delegation_chain` on every event:** inflates payloads; the chain is
  reconstructable from `parent_delegation_id`, and `delegation_depth` covers
  stateless depth policy.
- **Put the full delegated task into Core `SubagentStart`:** deferred because of
  sensitivity; the task is already available from the delegating `PreToolUse`.
- **Add a new Core event such as `DelegationRequest`:** `SubagentStart` is
  already the pre-dispatch delegation boundary.

## Open questions

1. Should `delegation_depth` be REQUIRED, rather than SHOULD, on
   child-originated Gate events?
2. Should a `SubagentStart` response be able to narrow the child's scope? That
   requires a Core response change and is not proposed here.
3. Should `trace` carry W3C `tracestate`?
4. Cross-host delegation (agent-to-agent protocols, remote agents) needs its
   own RFC. Is `parent_session_id` sufficient across hosts?
5. Agent teams: is each teammate message a delegation, or is a peer-messaging
   event needed?
6. The profile namespace follows RFC 0006 and changes if that RFC's naming
   changes.

## Follow-up implementation and acceptance criteria

If accepted, follow-up pull requests should:

- Update the [Core protocol](../spec/0.1/core.md) (envelope members, security
  correlation, capability declaration), the [event registry](../spec/0.1/events.md)
  (`SubagentStart`, `SubagentStop`, correlation and ordering, trace context),
  the [security](../spec/0.1/security.md) telemetry guidance, and the
  [adapter guide](../spec/0.1/adapters.md) Claude Code rows.
- Revise `schemas/hook-event.schema.json` and its published copy: add the new
  members, `TraceContext.parent_span_id`, `dependentRequired` of `agent_id` on
  `delegation_id`, the `SubagentStart` required `delegation_depth` with minimum
  `1`, and `agent_transcript_path` on `SubagentStop`.
- Extend `scripts/validate.mjs` with semantic checks that JSON Schema cannot
  express: `delegation_chain` length equals `delegation_depth`,
  `traceparent` consistency with `trace_id` and `span_id`, and all-zero trace
  identifiers.
- Add fixtures. Valid: a delegated `PreToolUse`, a nested `SubagentStart`,
  and an event with full trace context. Invalid: `delegation_id` without
  `agent_id`, `SubagentStart` without `delegation_depth`, and a malformed
  `parent_span_id`.
- Before acceptance, a claiming host supplies behavioral evidence: a denied
  child action is attributed to its delegation, a resumed child receives a new
  `delegation_id` with the same `agent_id`, and no orphan `SubagentStop` is
  emitted.

## References

### Normative references

- [RFC 2119: Key words for use in RFCs to Indicate Requirement Levels](https://www.rfc-editor.org/rfc/rfc2119).
- [RFC 8174: Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words](https://www.rfc-editor.org/rfc/rfc8174).
- [W3C Trace Context](https://www.w3.org/TR/trace-context/).
- [RFC 0007](./0007-core-draft-consolidation.md): Consolidate the Core draft (Draft).

### Informative references

- [RFC 0006](./0006-enterprise-security-extensions-strategy.md): Enterprise Security Extensions Strategy (Draft).
- [OpenTelemetry GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai) (Development status).
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks), observed 2026-11-04.

## Decision record

Pending. No maintainer votes or acceptance are recorded. A linked Discussion
and the review window required by repository governance must precede a
decision. Dependent implementation may be prepared as a Draft PR but must not
be merged as an accepted standard before the RFC process completes.
