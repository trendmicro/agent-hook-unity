# RFCs

Formal proposals for the Agent Hook Spec live in this directory. Start by
opening an RFC Proposal in [GitHub Discussions](https://github.com/trendmicro/agent-hook-unity/discussions), then submit a numbered RFC pull request using
[`0000-template.md`](0000-template.md).

RFC numbers are four digits and assigned in sequence. Do not reuse a number.
Accepted RFCs remain here as the decision record; their resulting normative
content belongs in [`../spec/`](../spec/README.md).

An RFC number identifies a proposal, not a pull request or a commit. Revisions
to the same proposal update its existing numbered file. Implementation and
follow-up PRs reference that RFC without creating a new RFC for every PR.
Create a new numbered RFC for a distinct substantial proposal; routine fixes
and documentation updates do not each need an RFC. See the
[contribution guidance](../CONTRIBUTING.md#discussing-ideas-and-reporting-issues).

See [GOVERNANCE.md](../GOVERNANCE.md) for review, voting, and status rules.

## Response inspection proposal

[RFC 0005](./0005-network-response-delivery-inspection.md) proposes extending
`PostNetworkAccess` to inspect and replace complete buffered response content
before an agent receives it. Buffered delivery allow/deny is already present in
the working Core draft through PR #9; the proposed body fields and replacement
are not implemented. The Pre/Post pair and all 18 event names remain, and
Observe configurations retain their behavior. The RFC remains Draft with its
prerequisite Discussion and formal review pending.

## Enterprise security extensions proposal

[RFC 0006](./0006-enterprise-security-extensions-strategy.md) proposes an
opt-in architectural strategy and recommended extension profiles for
enterprise-grade security capabilities (cryptographic wire signing,
tamper-evident audit ledgers, asynchronous HITL suspension, TOCTOU payload
integrity, failure and degradation enforcement like fail-closed and bounded-open,
and administrative session revocation). It preserves Core 0.1
minimalism and interoperability while offering standard integration blueprints
for enterprise PEPs (e.g. NeMo Relay) and PDPs (e.g. Trend Micro Vision One).

## Consolidation candidate

[RFC 0007](./0007-core-draft-consolidation.md) records the working baseline's
provenance, the 12 Gate / 6 Observe classification, top-level responses and
legacy syntax fallback, cross-handler deny preservation, and migration to the
distinct `agent-hook-unity/0.1` identity and current schema URLs. Its companion
files make the candidate testable; no RFC becomes Accepted merely because the
draft changes are present in the repository. External telemetry/correlation
interoperability remains a separate evaluation, with no adapter claim.
