---
title: "RFC 0007: Consolidate the Core draft and distinguish its wire identity"
status: Draft
discussion: "Pending — prerequisite Discussion has not been opened"
review-start: "Not started"
review-end: "Not scheduled"
maintainer-votes: []
decision: "Pending"
supersedes: []
superseded-by: []
---

# RFC 0007: Consolidate the Core draft and distinguish its wire identity

## Summary

Establish one reviewable working baseline for Agent Hook Unity 0.1: 18 Core
events (12 Gate and 6 Observe), canonical top-level decisions with the existing
nested fallback, a minimum cross-handler deny-preservation obligation, and the
distinct wire identifier `agent-hook-unity/0.1`.

The accompanying specification, schemas, examples, and website implement this
**candidate draft baseline for review**. Their presence on a branch or on main
does not constitute RFC acceptance or an active standard. This RFC remains
Draft until the Discussion, review window, and maintainer votes required by
[governance](../GOVERNANCE.md) are recorded. No existing RFC is declared
Accepted or Superseded by this preparatory change.

## Motivation and provenance

The baseline before this consolidation is commit
[`08ecf2973ed8a3fb7b09f7a8f3a9450f2ea206b3`](https://github.com/trendmicro/agent-hook-unity/tree/08ecf2973ed8a3fb7b09f7a8f3a9450f2ea206b3).
Its normative pages, introductory pages, adapter guidance, and proposal status
described different contracts.

| Source | Contribution and disposition in this candidate |
| --- | --- |
| [RFC 0001](./0001-agent-hook-core-event-contract.md) | Original flat event and correlated response proposal; remains unaccepted. |
| [RFC 0004](./0004-standard-lifecycle-events.md) | Network, memory, and configuration event expansion to 18 events; remains unaccepted. |
| [PR #9](https://github.com/trendmicro/agent-hook-unity/pull/9), commit `ee25d77` | Introduced canonical top-level decisions, added five Gate classifications, and revised payload rewrites. This preceded RFC 0006. Its resulting registry is the candidate's 12 Gate / 6 Observe baseline. |
| [RFC 0005](./0005-network-response-delivery-inspection.md) | Buffered `PostNetworkAccess` allow/deny delivery control is already in the working Core draft. Complete-body inspection, recipient/body fields, and body replacement remain proposals and are not introduced here. Its narrow deny-preservation rule informs the generic Core rule below. |
| [RFC 0006](./0006-enterprise-security-extensions-strategy.md) | Proposes optional enterprise extension profiles on top of the existing top-level response baseline; it did not originate that response shape. No enterprise profile becomes mandatory or accepted here. |
| This RFC | Consolidates the candidate baseline, adds the generic deny invariant, disambiguates identity, and records migration and review obligations. |

The old summaries said seven Gate and eleven Observe events. They also treated
completed model and tool results as purely observational even after Core added
delivery and ingestion controls. Core itself listed native rewrite-validation
failure as unresolved after already requiring fail-closed behavior. These are
cross-document consistency defects, not alternative implementation choices.

## Proposal

### 1. One explicit candidate baseline

The [event registry](../spec/0.1/events.md) defines event classification. The
[Core protocol](../spec/0.1/core.md) defines response and host obligations.
Consumer guidance must agree with those documents; schemas and examples must
use the same identity and supported fields.

A registry Gate provides preventive control only where a host faithfully
declares `gate`. A host may expose that boundary as `observe` and must then
ignore control fields. Post Gates control result delivery, rendering, or
context ingestion; they cannot undo completed inference, tool execution, or
network side effects. `PostNetworkAccess` requires buffering for its delivery
Gate claim; this consolidation does not add response-body inspection fields.

Top-level `decision` is canonical. Supported legacy nested control remains a
fallback only when the top-level decision is absent; the canonical examples
use the top-level form. This syntax compatibility is separate from the wire
identifier migration below.

### 2. Minimum Core composition guarantee

For one pending action at one boundary declared `gate`, an accepted valid,
correlated `deny` or applicable legacy `block` MUST remain effective across
other handler responses, missing/invalid responses, handler errors, timeouts,
redelivery, and reevaluation. Another handler's `allow` MUST NOT authorize the
denied action. Required unresolved approval and independent native policy
also continue to constrain release.

The host associates decisions with its pending action and controlled boundary.
An `event_id` identifies a single handler delivery, so it cannot by itself
identify the cross-handler decision set. A new delivery ID does not clear a
denial; an unrelated operation or the separate Post boundary of an operation
does not inherit a Pre-boundary denial as a new independent policy decision.

The host MUST NOT release the action while evaluations required by its own
declared dispatch policy remain pending before their deadlines. A declared
short-circuit policy may stop after a deny because the action is already
blocked. Ordering, sequential/parallel dispatch, discovery, deadlines, and
rewrite composition remain host-defined subject to the Core invariants.

An invocation failure produces no decision from that invocation. Baseline
fail-open permits continuation only when no other applicable decision,
unresolved approval, or independent native policy blocks it. Thus an accepted
deny plus timeout is denied; timeout alone does not become a synthesized deny.
A late response after an invocation has expired cannot retroactively retract
an action. Hosts requiring successful inspection before release need an
explicit stricter policy. Failure must not erase an already applicable rewrite
and expose the unredacted original; schema-valid rewrites that fail native
validation retain the existing fail-closed requirement.

The [composition conformance scenarios](../conformance/gate-composition.md)
describe observations that host integration tests must demonstrate. The
repository has no host runtime, and document checks do not execute these
scenarios or certify an implementation.

### 3. Distinct wire and schema identity

The canonical request and response `spec` value becomes
`agent-hook-unity/0.1`. This is an intentional incompatible identifier change
within an unaccepted draft; it is not a patch-compatible alias for the former
`agent-hooks/0.1` value. The new namespace starts at 0.1 and does not indicate
compatibility with another project's 0.1.

Canonical schema identifiers and download locations are:

- [Request schema](https://trendmicro.github.io/agent-hook-unity/schemas/0.1/hook-event.schema.json).
- [Response schema](https://trendmicro.github.io/agent-hook-unity/schemas/0.1/hook-response.schema.json).

Previously, `$id` used the non-resolving `agent-hook-standard` Pages path.
JSON Schema identifies resources by URI and does not require network retrieval
from that URI. This change makes the new resource identity match its published
location; it does not silently reassign the old identity to a new contract.
The [schema migration guidance](../schemas/README.md) links immutable copies of
the previous schemas for deployments that must remain pinned.

### 4. Interoperability direction

The distinct [Responsible AI Agent Hooks contract](https://github.com/responsibleai/agent-hooks)
uses `agent-hooks/0.1`, eight interception points, and its own context, verdict,
composition, and fail-closed obligations. It is not wire-compatible with this
repository. Shared lifecycle concepts or similar names do not confer
conformance. Its [conformance claims](https://github.com/responsibleai/agent-hooks/blob/main/conformance/CLAIMS.md)
are declared-surface test results, not security certifications.

A subsequent interoperability proposal should evaluate a telemetry and
correlation profile plus an adapter. It must cover:

1. Mapping session, prompt, model-request, tool-call, operation, approval, and
   delegation identities without conflating handler delivery with an action.
2. Mapping only equivalent control boundaries; documenting network, memory,
   configuration, and other events without a faithful counterpart.
3. Preserving deny, approval, rewrite, buffering, and failure semantics. Our
   fail-open default cannot be translated into an upstream conformant control
   path merely by renaming fields.
4. Separating observational telemetry from enforced interception and recording
   unsupported capabilities without fabricating events.
5. Running the applicable external conformance harness against a real adapter
   and reporting the exact supported revision and declared surface.

This RFC establishes the independent identity and evaluates that direction; it
does not deliver an adapter, assert external certification, or adopt a new
product positioning as an approved interoperability profile.

## Compatibility impact and migration

1. Pin the old schemas and the precise old draft revision if continued use of
   `agent-hooks/0.1` is required. Do not resolve an incoming ambiguous identifier
   by trying both projects' schemas until one happens to validate.
2. Upgrade host, adapter, and handler contract configuration together to
   `agent-hook-unity/0.1`, the new schema IDs, and this candidate revision.
3. New canonical schemas reject the former identifier. An explicitly
   configured legacy ingress may translate only when the old contract and
   revision are known and the host can honor the new obligations; it must
   validate each side and must not claim automatic negotiation.
4. Update signed payloads, signing domain separators, schema registrations,
   and content-derived identities as applicable. Changing `spec` changes the
   signed document; do not relabel an existing signature or approval grant.
5. Retain legacy nested response syntax only within the declared contract's
   supported fallback rules. It does not make an old envelope identifier valid.
6. Revalidate Gate capability claims and execute the host behavioral scenarios.
   A host exposing only observations must keep that declaration.

## Security and privacy impact

Deny preservation closes a composition ambiguity, but does not turn the
cooperative host contract into a sandbox or guarantee every operation was
successfully scanned. Baseline fail-open is unchanged when no applicable
blocking decision exists. Identity migration must not reinterpret another
project's documents or reuse approvals/signatures across changed content.
No new telemetry payload, enterprise dependency, or body-content collection is
required by this consolidation.

## Alternatives considered

| Alternative | Reason for this proposal |
| --- | --- |
| Fix only the event count | Leaves contradictory response, rewrite, failure, and proposal-status claims. |
| Standardize a complete handler runner | Adds scheduling and mutation algorithms beyond the required deny invariant. |
| Keep the colliding identifier with a disclaimer | Requires every integration to disambiguate identical version strings indefinitely. |
| Rename only the repository or site title | Does not distinguish wire payloads or schema resources. |
| Immediately replace the protocol with an external telemetry profile | Requires a tested semantic mapping and product decision that this consolidation does not establish. |
| Mark previously merged RFCs Accepted | Would invent review and voting decisions that have not occurred. |

## Validation and adoption criteria

- Canonical and published schema copies are identical; registry/schema event
  sets, mirrored counts, and current JSON examples are checked together.
- New identity fixtures pass, and old colliding identity fixtures fail against
  the new schemas. Legacy nested responses remain structurally supported.
- Documentation states the same Gate, response, failure, and draft status.
- A claiming host supplies behavioral evidence for the composition scenarios;
  this repository's schema checks are not a substitute.
- The prerequisite Discussion is linked, the public review window lasts at
  least 14 calendar days, and maintainer votes and disposition are recorded
  before formal acceptance. Website and schema publication follows the normal
  Pages deployment after merge; preparing these files does not publish them.

## Decision record

Pending. This preparatory RFC records the candidate and its provenance without
claiming a completed review, maintainer vote, or external endorsement. Final
acceptance must also record the disposition of overlapping portions of RFCs
0001, 0004, and 0005; RFC 0006's optional enterprise profiles remain a separate
proposal.
