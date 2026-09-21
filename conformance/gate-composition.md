# Agent Hook Unity Core Gate composition scenarios

These behavioral scenarios exercise the minimum composition rules in the Agent
Hook Unity 0.1 draft. They do not define a reference reducer, handler scheduler,
or mutation algorithm. A host harness that claims to test Core Gate composition
MUST cover every scenario whose decision or rewrite form applies to the Gate
capabilities it declares. It MUST record the host version, adapter version,
capability mode, handler set, scheduling mode, and configured deadlines used for
the run. Passing these scenarios is useful evidence, not by itself a claim of
runtime conformance.

All example events use `spec: "agent-hook-unity/0.1"`. `A` and `B` are
handlers. `D1`, `D2`, and `D3` are distinct schema-valid UUID `event_id` values.
Unless a scenario says otherwise, the events describe one pending action at one
Gate boundary, all responses are schema-valid and correlated to their own
delivery, no native policy independently blocks the action, and no approval is
outstanding.

Every enforcement scenario below requires a host declaration of `gate` at the
tested boundary. A registry Gate exposed by the host as `observe` is covered
by the final isolation case, not by an obligation to enforce its responses.

The consolidation that introduces these obligations is tracked by
[draft RFC 0007](../rfcs/0007-core-draft-consolidation.md). The RFC remains
unaccepted.

The approval scenario applies to `BeforeModelRequest`, `PreToolUse`,
`PreNetworkAccess`, `PreMemoryWrite`, and `PreConfigChange`, whose canonical
response shapes support `ask` and `defer`. Rewrite scenarios apply only to
`UserPromptSubmit` (`updatedPrompt`), `BeforeModelRequest` (`updatedMessages`),
`AfterModelResponse` (`updatedResponse`), `PreToolUse` and `PermissionRequest`
(`updatedInput`, plus `updatedPermissions` for `PermissionRequest`),
`PostToolUse` (`updatedOutput`), and `PreMemoryWrite` (`updatedContent`).

## Required scenarios

| Scenario | Harness stimulus | Required observation |
| --- | --- | --- |
| Sequential allow then deny | Deliver the pending action to A as D1 and accept `allow`. Deliver it to B as D2 and accept `deny`. | The host does not cross the Gate. It waits for B instead of treating A's earlier `allow` as final permission. |
| Sequential deny then allow | Deliver the pending action to A as D1 and accept `deny`, then obtain `allow` from B as D2 if the host continues scheduling. | The host does not cross the Gate. B's later `allow` does not clear A's denial. The host may short-circuit B only after the action is irrevocably denied. |
| Parallel outcomes | Invoke A and B in parallel. Exercise both completion orders with one valid `allow` and one valid `deny`; repeat with the other outcome replaced by a timeout or handler error. | Every run containing an accepted denial prevents the action, independent of completion order. A timeout or error supplies no result and does not erase the denial. |
| Invalid or mismatched response | A returns a schema-invalid response or a response correlated to a different `event_id`; B returns a valid `deny` for D2. Repeat with B returning `allow`. | The invalid or mismatched response supplies no result. The valid denial prevents the action. With only B's valid `allow`, the response failure does not independently deny the action. |
| Timeout only | Every applicable handler invocation reaches its declared deadline without a usable response, with no accepted denial, unresolved approval, or native restriction. | The timeouts supply no Agent Hook decision. The Core default permits the host to continue after the deadlines; the harness does not report the timeouts as approval decisions. |
| Approval remains unresolved | For a Gate whose response shape supports `ask` and `defer`, A returns `ask`. Exercise an interactive host while approval is pending, and a non-interactive host without native suspension. Also exercise `defer` while native policy has not resolved. | The interactive host does not cross the Gate while approval is pending. The non-interactive host treats `ask` as denial. `defer` does not count as approval. |
| Deadline and late denial | A returns `allow` promptly. B returns `deny` immediately before B's declared deadline. Repeat with B returning only after the deadline and after the host has crossed the Gate under the timeout rule. | The host waits through B's deadline and honors the on-time denial. A response after the expired invocation cannot retroactively undo an action already performed; if the host performs a new reevaluation, it uses a new delivery and applies that evaluation before crossing the still-pending boundary. |
| Redelivery with distinct event IDs | Deliver the same pending action and boundary as D1 and accept `deny`; redeliver it as D2 and receive `allow`. For events with `operation_id`, retain the same value. | D1 and D2 remain separately correlated deliveries, while the D1 denial remains binding to the same pending action. The host does not cross the Gate. |
| Reevaluation after change | Accept `deny` for D1. Change a target or proposed value in a way that requires reevaluation of the same pending action, deliver D2, and receive `allow`. | The host performs the required reevaluation but does not clear the earlier denial. Re-proposing the work as a truly new action requires treating it as a distinct underlying action, using a distinct correlation identifier where Core defines one, and obtaining all applicable decisions again. |
| Same operation, distinct Pre and Post boundaries | For one `operation_id`, accept `allow` at `PreNetworkAccess`, complete the request on a buffered transport, then accept `deny` at `PostNetworkAccess`. | The request may be dispatched after the Pre Gate permits it. The Post denial prevents response delivery to the caller and does not claim rollback of the request. A Pre denial instead prevents dispatch and produces no Post event as execution evidence. The shared `operation_id` does not merge the two pending actions. |
| Unrelated operations | Deny operation X at a Gate, then evaluate unrelated operation Y at the same event boundary with a distinct operation identity and accept `allow`. | X remains denied. X's denial does not deny Y; Y proceeds only after its own applicable handler outcomes, approvals, and native policy permit it. |
| Rewrite plus response failure | For a Gate with an event-supported rewrite, A returns a valid `allow` with that rewrite. B times out or returns an invalid response. | B supplies no result and does not silently restore the original value. If the action is otherwise permitted, the host carries A's accepted rewrite into its host-defined mutation ordering and native validation. If native validation of the value to be committed fails, the host fails closed as required by Core. |
| Conflicting rewrites and denial | For a Gate with an event-supported rewrite, A and B return different valid rewrites under each scheduling mode the host supports; add a valid denial from either handler in a second run. | The host applies its own ordering or conflict policy and native validation in the first run. The denial prevents the action in the second run regardless of which rewrite would otherwise win. |

### Observe isolation

Expose a registry Gate as `observe`, or use an Observe event. Return
schema-valid control responses, including a deny and event-supported rewrite
fields. The host MUST ignore these responses for control purposes and make no
Gate enforcement claim for this capability. Native policy remains independent.

For Post Gates, “cross the Gate” means delivery, rendering, or context
ingestion, not rollback of the completed inference, tool execution, or network
request. The `PostNetworkAccess` cases exercise delivery control on a buffered
transport only. They do not require response-body fields, inspection, or
rewriting, which remain outside the current Core behavior.
