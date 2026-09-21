---
slug: /
sidebar_position: 1
---

import Link from '@docusaurus/Link';

# Agent Hook Unity

Agent Hook Unity defines a shared lifecycle event and response contract for AI
agents and their tooling. It gives runtime builders and handler authors a
common vocabulary for describing an operation, correlating its events, and
identifying the boundaries at which a handler can influence execution.

## Who does what

| Role | Responsibility |
| --- | --- |
| Host | Observe the actual lifecycle boundary, declare its capabilities, and apply supported controls through its native runtime. |
| Adapter | Translate native callbacks into faithful Agent Hook documents and map supported responses back to the host. An adapter may be part of the host. |
| Handler | Consume an event and return a schema-valid response correlated to that delivery. |

```text
Host lifecycle -> Adapter -> Agent Hook event -> Handler
Host           <- Adapter <- Correlated response <- Handler
```

The return path carries control only at a supported Gate. Native approval,
sandbox, organization, and host restrictions remain authoritative. This diagram
describes responsibilities; it does not prescribe separate processes, a
transport, or the order of multiple handlers.

## What the contract guarantees

The <Link to="/specification/0.1/events">event registry</Link> defines eighteen
Core events: twelve **Gate** events and six **Observe** events. Gate events
can control a pending operation when the host declares and implements that
capability. Observe events report a lifecycle boundary; a response does not
turn them into preventive controls.

Each host declares every Core event as `gate`, `observe`, `partial`, or
`unavailable`. A related native callback is insufficient if its timing, data,
correlation, or control cannot meet the event's requirements. A `partial` or
`unavailable` signal cannot be emitted as a normalized Core event. See the
<Link to="/capabilities">capability guide and complete example</Link>.

The contract standardizes event names, document shapes, correlation, and
event-specific control semantics. Settings files, handler discovery, matching,
execution order, process lifecycle, authentication, and transport remain host
concerns. An interoperable document does not establish identical multi-handler
policy composition across hosts.

The 0.1 draft treats a missing, invalid, timed-out, or errored handler response
as no control result from that invocation. A timeout alone is **fail open**,
subject to other valid decisions for the same pending action and independent
native policy. It cannot erase an accepted denial, rewrite, or approval
requirement. Observe responses have no control effect. Completed model, tool,
and network
operations are Gate-capable only when the host buffers the relevant result;
their controls govern rendering, delivery, or context ingestion and do not
roll back completed work. The contract does not provide a sandbox or guarantee
that every internal runtime or provider operation is visible. The
<Link to="/specification/0.1/core#host-obligations">host
obligations</Link> and <Link to="/specification/0.1/security">security
considerations</Link> explain these boundaries.

## Current status

The repository contains an unaccepted **Agent Hook Unity 0.1 draft** proposed by
RFC 0001, with standard network, memory, and configuration events proposed by
RFC 0004. It defines a portable security and telemetry contract, schemas,
fixtures, examples, and adapter guidance. It is not active until accepted
through the public RFC process.

Local agents can use the draft without enterprise identity, remote approval,
or audit services. The original 13-event schemas do not recognize the five
later network, memory, and configuration additions. The immediate pre-migration
draft already has 18 events but uses the old wire identity; update schemas and
handler configuration together as described in the
<Link to="/specification/0.1/core#versioning-and-conformance">versioning rules</Link>.

This contract now uses `agent-hook-unity/0.1` on the wire. It is neither a
byte-for-byte Claude Code hook interface nor the
separate [Responsible AI Agent Hooks contract](https://responsibleai.github.io/agent-hooks/).
The latter uses `agent-hooks/0.1`, but its `interception_point` context and
verdict documents are different from this draft's `hook_event_name` events and
correlated responses. Earlier local Agent Hook drafts used that same identifier.
Migrating implementations must update their configured identifier and schemas
explicitly; the draft defines no automatic wire negotiation.

## Start reading

| Reader | Start here |
| --- | --- |
| Runtime or adapter implementer | <Link to="/specification/0.1/core#host-obligations">Host obligations</Link>, then the <Link to="/capabilities">capability declaration guide</Link>. |
| Handler author | <Link to="/responses">Response reference</Link>, alongside the <Link to="/specification/0.1/events">event registry</Link>. |
| Reviewer or adopter | <Link to="/specification/0.1">Draft overview</Link> and <Link to="/conformance">conformance evidence and limits</Link>. |

The response reference and capability example are informative guides to the
canonical specification. They identify unresolved behavior without defining
new controls or claiming tested support for a real host.

### Consolidated draft provenance

The repository draft includes the top-level decision and additional Gate work
merged in [PR #9](https://github.com/trendmicro/agent-hook-unity/pull/9). It also
implements the buffered response-delivery control described by
[draft RFC 0005](https://github.com/trendmicro/agent-hook-unity/blob/main/rfcs/0005-network-response-delivery-inspection.md): a `PostNetworkAccess` Gate may
allow or deny delivery after the request completes. RFC 0005's response-body
inspection and replacement fields remain unimplemented proposals.

[Draft RFC 0007](https://github.com/trendmicro/agent-hook-unity/blob/main/rfcs/0007-core-draft-consolidation.md)
records this consolidation, the wire-identifier migration, and the review work
still required. It does not mark the specification or the earlier RFCs as
accepted.

## Get involved

- Bring a use case or question to [GitHub Discussions](https://github.com/trendmicro/agent-hook-unity/discussions).
- Read the [RFC process](./governance.md) before proposing a protocol change.
- Review the [conformance approach](./conformance.md) for the existing schema
  and fixture checks and the additional runtime evidence an adapter needs.
