---
sidebar_position: 4
---

import Link from '@docusaurus/Link';

# Conformance

Agent Hook Unity 0.1 defines three conformance roles: event producer, handler,
and adapter. The draft's normative requirements and role definitions are in the
<Link to="/specification/0.1/core">core protocol</Link>.

The repository validates the 0.1 event and response JSON Schemas against
focused valid and invalid fixtures. Each schema uses JSON Schema Draft 2020-12,
declares a stable identifier and title, and is published at its versioned schema
URL. Run the following checks before requesting review:

```sh
npm run validate
npm run build
```

Use the <Link to="/capabilities">capability declaration guide</Link> to document
the host and adapter versions, every Core event's mode, limitations, and
supporting evidence. Its fictional example is informative and is not a tested
host claim or a required configuration format. The
<Link to="/responses">response reference</Link> summarizes the existing
event-specific controls and identifies unresolved portable behavior.

Schema validation proves document shape, not complete runtime behavior. An
adapter review must additionally verify correct event mapping, `event_id`
correlation, decision handling, same-action deny preservation, and the required
fail-open behavior for an individual invalid, missing, timed-out, or errored
handler response. Passing repository schema checks does not establish runtime
conformance.

The repository's
[Core Gate composition scenarios](https://github.com/trendmicro/agent-hook-unity/blob/main/conformance/gate-composition.md)
state the behavioral cases a host harness should exercise. They cover handler
order and parallel completion, invalid and mismatched responses, deadlines,
redelivery, reevaluation, distinct Pre and Post actions, unrelated operations,
and accepted rewrites. They are review obligations rather than an executable
reference reducer, and a result report is evidence only for the host and
configuration actually tested.

For the network and memory event pairs, verify that concurrent operations at
the same destination or memory key retain distinct `operation_id` values, and
that each terminal result retains its operation's identity. Network redirects
and retries require separate request boundaries. `PreConfigChange` denial
must prevent the change before it takes effect. An Observe callback cannot
claim any of these preventive effects.

The revised draft uses `agent-hook-unity/0.1`. The original 13-event schemas do
not recognize the five later additions. The immediate pre-migration 18-event
schemas recognize them but use the colliding `agent-hooks/0.1` identity. Upgrade
schemas and capability declarations and configure compatible handlers before
delivery; do not silently treat the old identity as an alias. Native `ask`
still uses the host's approval flow, and a pending action cannot proceed while
required approval remains unresolved.

The migration and composition changes are tracked in
[draft RFC 0007](https://github.com/trendmicro/agent-hook-unity/blob/main/rfcs/0007-core-draft-consolidation.md).
The RFC remains unaccepted; this page does not claim an adoption decision.
