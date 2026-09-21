---
title: "RFC 0005: Inspect and control response content with PostNetworkAccess"
status: Draft
discussion: "Pending — prerequisite Discussion has not been opened"
review-start: "Not started"
review-end: "Not scheduled"
maintainer-votes: []
decision: "Pending"
supersedes: []
superseded-by: []
---

# RFC 0005: Inspect and control response content with PostNetworkAccess

## Summary

Extend `PostNetworkAccess` so a capable host can inspect, replace, or withhold
a complete network response body before an agent or tool caller receives it.
Keep the two existing network events and the current count of 18 Core events:

| Event | Question | Controlled action |
| --- | --- | --- |
| `PreNetworkAccess` | May this request be sent? | Dispatching the outbound application request. |
| `PostNetworkAccess` | How did the request finish, and may its response content reach the caller? | Delivering the buffered response body, when the host declares `gate`. |

The host receives the response into a trusted buffer before the consumer can
access it. A Post handler can allow the body, allow a replacement body, or deny
delivery. A host that only reports network results retains `observe` behavior.
The Core fail-open default is preserved.

This remains a proposal against the **unaccepted Agent Hook Unity 0.1 draft**.
Since this RFC was introduced, PR #9 added buffered `PostNetworkAccess`
allow/deny delivery control to the working Core draft. Complete-body inspection,
recipient/body fields, and body replacement proposed here are still absent
from the canonical schemas. [RFC 0007](./0007-core-draft-consolidation.md)
records that partial adoption into the working draft and its pending review
status; it does not mark this RFC Accepted. No new event name is proposed.

Formal review has not started. The prerequisite Discussion and review window
required by [GOVERNANCE.md](../GOVERNANCE.md) remain pending; repository
Discussions was enabled on 2026-09-21, but that does not start formal review.
This Draft is preparatory material.

## Motivation

An allowed destination can return content that a policy prohibits an agent
from consuming. Request-side checks cannot inspect bytes that have not yet
arrived. Response-side checks can withhold a prohibited download or replace
sensitive text with a sanitized representation.

Using the existing Pre/Post pair keeps this distinction easy to implement and
explain. `Post` means the network operation has reached its terminal result;
the host can still control the subsequent delivery of its buffered body.
Network success and content approval remain separate facts within this flow.

## Proposal

The key words MUST, MUST NOT, SHOULD, and MAY below describe the **proposed**
contract, using the terminology of the [Core protocol](../spec/0.1/core.md).

### 1. Event timing and scope

For a successful request with content to deliver, a host declaring `gate`
MUST follow this order:

```text
PreNetworkAccess: decide whether the request may be sent
  -> send request; receive the complete response into a trusted buffer
  -> PostNetworkAccess: report the network result and evaluate the body
       allow                -> deliver the evaluated body
       allow + replacement  -> deliver the replacement body
       deny                 -> withhold the body
       handler failure      -> no new hook decision; apply fail-open/native policy
```

The **consumer** is the intended agent, tool caller, or other recipient for
this response. The host's trusted buffering component and the authorized
inspection handler are outside that consumer boundary. Before invoking a
controlling Post handler, the host MUST ensure that no body bytes are already
accessible to the consumer through a return value, callback, stream, stdout,
shared memory, or a readable temporary file.

`PostNetworkAccess` retains exactly one terminal occurrence per started network
request whose result the host observes. It MUST be reported for failures and
interruptions as well as successes. Delivery to multiple handlers or
reevaluation is a delivery of that same occurrence, not another completed
network request: use a fresh `event_id` and session `sequence`, while retaining
`operation_id`, `prompt_id`, the original target, and the terminal network facts.
The occurrence's `timestamp` remains the time its terminal result was observed.
Native invocation order and handler composition remain host-defined.

A failed or interrupted transfer has no complete body to control under this
proposal. Its Post event MUST retain the existing `error` requirements and
MUST NOT include the proposed complete-body fields. Handler controls on that
event have no effect. A host declaring this full-body Gate MUST NOT release
partial bytes as if they had passed inspection; it may return a native error
without those bytes. Handling partial content outside that guarantee requires
an accurately declared capability limitation.

Every complete-body delivery in the declared `gate` configuration MUST pass
the Post control boundary. When a complete response will not be delivered
(for example, a native policy already discarded it), the host still reports
its terminal Post result but MAY omit the delivery fields. Such an invocation
has no delivery-control effect; omission MUST NOT be used to bypass inspection
and then release the body.

Pre and Post support remain independent. Redirects and retries remain distinct
requests with distinct `operation_id` values. A host MUST NOT fabricate a Pre
event when it can only observe Post.

### 2. Preserve the actual network result

`outcome`, `error`, `status_code`, `bytes_sent`, `bytes_recv`, and `duration_ms`
retain their current [network-result meanings](../spec/0.1/events.md#postnetworkaccess).
In particular:

- A complete HTTP 403 or 500 response still has network `outcome: "success"`.
- Withholding or replacing its body MUST NOT change that outcome or status.
- Wire byte counts MUST NOT be replaced by decoded or replacement-body sizes.
- A local refusal or body-processing error MUST NOT become a fabricated
  network status or an additional terminal Post occurrence.

The handler's decision describes content delivery. It cannot undo the request,
remove information already sent, or roll back the remote server's actions.

### 3. Response content and recipient

Keep the existing flat envelope, required Post fields, correlation rules, and
event name. Add the following proposed event members:

| Member | Requirement and meaning |
| --- | --- |
| `response_body_base64` | Required when a `gate` Post offers a complete body for delivery. Standard padded base64 without whitespace, representing every byte of the current body proposed for delivery. An observed empty body is an empty string. |
| `consumer_id` | Required with `response_body_base64`. A nonempty opaque session-local identity for the intended recipient; stable across evaluations for this request. |
| `response_media_type` | Optional nonempty media type, when known. Advisory metadata, not evidence that content is safe. |

These fields apply only to `outcome: "success"`. An `observe` host MAY include
them if it can supply the complete representation and intended recipient
faithfully; their presence does not grant control authority or assert that
delivery has not occurred. A partial body, prefix, hash, path, or privacy-redacted
copy of the current buffer MUST NOT be labeled as that complete buffer. An
authorized replacement becomes the current buffer for subsequent invocations.
Observe telemetry may omit these members without losing its existing
terminal-result meaning.

The host MUST document how `consumer_id` maps to native agents, tool callers,
or other separately controlled recipients. The correlated response `event_id`
binds a handler decision to this recipient, request, and proposed body. A decision
MUST NOT be reused for a different recipient. This proposal controls the
response to the request's intended consumer; fan-out, reusable delivery grants,
and later release from quarantine are outside its portable contract.

The byte boundary is after content decompression and before character-set
decoding, invalid-character replacement, Unicode normalization, or structured
parsing. The first controlling invocation contains the complete decoded
network body. A later invocation following an authorized replacement contains
the current replacement bytes, while the network-result fields remain intact.
A runtime exposing only a string or parsed object cannot establish this
original byte boundary by re-encoding that value.

The host MUST retain control of the evaluated buffer until the decision is
resolved. An allow applies only to its evaluated body or explicit replacement.
Other buffer changes require reevaluation against the changed body before
release; an earlier valid deny remains a denial. The request's actual target
MUST NOT be changed during reevaluation, and changing the recipient is outside
this request-continuation contract. Reevaluation uses the same terminal
occurrence and request identifiers, with a fresh `event_id` and sequence.
It MUST NOT rewrite the original network facts.

### 4. Event-specific control and body replacement

Reuse the correlated response envelope: required `spec`, matching `event_id`,
and canonical top-level `decision`. A replacement additionally requires
`hookSpecificOutput.hookEventName: "PostNetworkAccess"`. Delivery controls
apply only when the host declares `gate`, the event has `outcome: "success"`,
and the complete body and recipient fields are present.

| Top-level `decision` | Effect |
| --- | --- |
| `allow` | Permit delivery of the evaluated body, or the explicit replacement below, subject to independent native policies. |
| `deny` | Withhold the body. The host may return a safe local refusal without exposing denied bytes. |
| `ask` | Keep the body unavailable until the existing native approval flow resolves. A non-interactive host MUST treat this as `deny`. |
| `defer` | Leave the decision to native approval or policy; this is not approval. |

Top-level `reason` explains the decision and is required for `deny`. The
supported nested control fields remain a fallback only when top-level
`decision` is absent. `ask` and `defer` here are additional proposed Post
controls; the current Core delivery Gate supports only allow/deny.
Introduce one replacement
member: **`hookSpecificOutput.updatedResponseBodyBase64`**. When present it MUST
be a string containing valid standard padded base64 without whitespace. An
empty string represents a deliberate empty replacement, not an omitted value.
Its replacement effect applies only with an explicit effective `allow` decision.
With `deny`, `ask`, `defer`, or no decision, it has no replacement effect;
in particular, a denial MUST NOT release replacement bytes.

For a valid allow with a replacement, the host MUST deliver exactly the decoded
replacement bytes, subject to native policy and any remaining configured
handlers. Editing an event copy is insufficient. The authorized replacement
does not require repeatedly invoking the same handler just because it changed
the body. If another handler is expected to inspect the final content, the host
MUST present it with the replacement, not the earlier body. A decision about an
earlier representation MUST NOT be reported as an inspection of the replacement.

Replacement changes the body only. It does not change the recorded network
status, target, or wire counts, and MUST preserve the declared media type.
The host MUST reconcile or remove stale native delivery metadata such as
content length, content encoding, checksums, and validators before exposing
the replacement. It MUST NOT claim that a signature over the original body
authenticates the replacement. If the host cannot apply a valid replacement
faithfully, it MUST stop delivery with a native error rather than fall back to
the original sensitive body. That host application failure is distinct from
an invalid or missing handler response.

This event gives no delivery-control or rewriting effect to `updatedInput`,
`updatedMessages`, or other event-inapplicable controls. It adds no
`transform` or `quarantine` decision enum. A valid deny withholds the body;
quarantine storage, retention, deletion, and any later release remain native
responsibilities. Retaining denied content MUST NOT make it readable to the
consumer or authorize a later release under the original decision.

Hosts MUST document handler ordering, replacement visibility, and how they
combine applicable decisions. They MUST serialize body replacements or otherwise
resolve concurrent proposals against the exact buffer each handler evaluated
before delivery. If a later replacement invalidates an earlier inspection
that the host relies on for the final body, the host MUST reevaluate that
inspection. Hosts MUST bound such reevaluation through documented native
resource policy. A failure in one handler supplies no decision
and MUST NOT cancel another handler's valid deny, discard its valid replacement,
or override an unresolved native approval requirement. Handler composition
MUST NOT turn a valid deny into delivery for this pending response delivery,
including redelivery or reevaluation.

### 5. Fail-open means inspection failure does not add a denial

Preserve the existing [Core fail-open rule](../spec/0.1/core.md#fail-open-behavior):

| Situation | Result |
| --- | --- |
| Valid allow without replacement | Deliver the evaluated body when other applicable decisions and native policies permit. |
| Valid allow with replacement | Deliver the replacement under those same constraints. |
| Valid deny | Withhold the body. |
| Absent response, malformed JSON/schema, invalid replacement encoding, mismatched event ID/name, handler error, or timeout | No control result from that invocation; continue the pending delivery unless another applicable decision or independent native policy blocks it. |

For example, with one handler and no other restriction, a timeout leaves the
original buffered body eligible for delivery. A valid response denying delivery
still blocks it. A failed invocation MUST NOT partially apply replacement data;
the current buffer and valid decisions from other invocations remain intact.
A structurally valid response without a decision likewise supplies no control
result, even if it contains the replacement member.

Fail-open does not promise that every delivered body was successfully scanned.
Deployments requiring that stronger guarantee need an explicit native policy.
It also does not authorize bypassing sandbox, organization, or user-approval
restrictions. Common async members introduce no separate remote approval or
buffer-retention protocol in this RFC.

### 6. Capabilities, streaming, and resource limits

The proposed registry makes `PostNetworkAccess` **Gate-capable for response
delivery**, while retaining faithful terminal telemetry in `observe` mode.
The controlled irreversible action is consumer access to the body; the network
request has already finished. Update the Core and adapter rules accordingly:

| Mode | Proposed Post behavior |
| --- | --- |
| `gate` | Report terminal results; for complete bodies offered for delivery, buffer them before consumer access and enforce valid delivery/replacement controls. Failure/interruption reports and results without a body offered for delivery remain observational. |
| `observe` | Report the actual terminal network result using existing timing. Ignore all handler controls, even if complete content is available. |
| `partial` | A related native signal cannot faithfully satisfy the declared semantics. Document the limitation and do not emit it as a normalized Core event. |
| `unavailable` | No faithful terminal network event is available. |

A streaming request still has one terminal occurrence when its body completes,
fails, or is interrupted. This proposal defines no per-chunk inspection. A host
that buffers an entire finite stream before any consumer access can provide
`gate`. A host that delivers chunks as they arrive may still provide accurate
terminal `observe` telemetry, but MUST NOT claim full-body delivery control.

Capability declarations MUST describe their supported protocols, runtime paths,
buffer limits, and disclosure restrictions. Within a configuration claiming
`gate`, oversized bodies or unsupported paths MUST NOT silently fall back to
uninspected streaming. A host may stop delivery under its declared native
resource policy, or declare the configuration `observe`, `partial`, or
`unavailable` as appropriate before use. It MUST NOT downgrade an in-flight
Gate to bypass control. A buffer or decoding failure is a native failure;
the pending delivery MUST stop with a native error. Report the actual network
result without fabricating complete-body fields. Fail-open for handler failures
does not authorize releasing an unrepresented body after such a native failure.
Once a valid event is submitted, a handler's size-limit error follows fail-open.

Full bodies may contain secrets or personal data. The host MUST select an
authorized handler under its disclosure policy. If full bytes cannot be
disclosed, use an authorized local handler or declare the capability limitation;
do not silently redact the input and claim original-body enforcement. Base64
does not encrypt content. Handlers MUST treat response content as untrusted data.

### 7. Diagnostics

A host SHOULD record the event, operation, recipient, and turn identifiers,
the handler decision or failure class, and the actual delivery result. It
SHOULD omit body content and sensitive metadata. An allow alone is not evidence
that delivery occurred. No new audit event or ledger format is introduced.

A body denial MUST NOT generate another network terminal occurrence or a
fabricated `PermissionDenied`. Existing permission events apply only when the
native permission boundary and all required identifiers are actually present.

## Illustrative exchange

These examples include the **proposed body-inspection semantics**, beyond the
current candidate's buffered allow/deny delivery control.
The existing schemas permit additional event and event-specific response members;
structural validation does not mean an existing Observe host will apply them.

A complete synthetic text response contains the six bytes `secret`. The host
has buffered it for one recipient and declares the revised Post `gate` contract:

```json
{
  "spec": "agent-hook-unity/0.1",
  "event_id": "018f6c3a-9214-7abc-9f12-34567890ab01",
  "hook_event_name": "PostNetworkAccess",
  "session_id": "session-42",
  "timestamp": "2026-09-15T02:00:00Z",
  "sequence": 50,
  "prompt_id": "prompt-7",
  "operation_id": "network-request-9",
  "destination_host": "downloads.example.com",
  "destination_port": 443,
  "protocol": "https",
  "outcome": "success",
  "status_code": 200,
  "bytes_recv": 6,
  "consumer_id": "consumer-agent-42",
  "response_media_type": "text/plain",
  "response_body_base64": "c2VjcmV0"
}
```

Option A: the handler allows replacement with the ten bytes `[REDACTED]`:

```json
{
  "spec": "agent-hook-unity/0.1",
  "event_id": "018f6c3a-9214-7abc-9f12-34567890ab01",
  "decision": "allow",
  "reason": "Replace the sensitive text before delivery.",
  "hookSpecificOutput": {
    "hookEventName": "PostNetworkAccess",
    "updatedResponseBodyBase64": "W1JFREFDVEVEXQ=="
  }
}
```

The host delivers `[REDACTED]` if remaining handlers and native policy permit.
It retains network `outcome: "success"`, `status_code: 200`, and `bytes_recv: 6`.
The replacement does not change how many body bytes the server transmitted.

Alternatively, option B denies delivery of the same response:

```json
{
  "spec": "agent-hook-unity/0.1",
  "event_id": "018f6c3a-9214-7abc-9f12-34567890ab01",
  "decision": "deny",
  "reason": "This response must not be delivered."
}
```

These are alternative handler responses to one invocation, not two replies that
must be combined. With option B the consumer receives no body bytes; the network
result remains success. No additional network event is needed in either case.

## Compatibility impact

This proposal keeps all 18 event names and reuses the existing envelope. Its
original baseline classified `PostNetworkAccess` as Observe. The current
working draft already permits buffered response-delivery allow/deny for a host
declaring `gate`; this proposal additionally introduces complete-body inspection
and replacement. Existing `observe` configurations continue to ignore controls.

Adopters MUST update the event registry, schemas, capability declarations, and
host/handler configuration together for the adopted revision. They MUST enable
the revised Post contract only for explicitly configured compatible hosts and
handlers. An old telemetry handler's response MUST NOT silently acquire control
authority. The consolidation candidate uses `spec: "agent-hook-unity/0.1"`;
its identifier alone does not establish support for this further body-inspection
proposal. [RFC 0007](./0007-core-draft-consolidation.md) documents migration from
the former colliding identifier. Existing Observe mappings
remain usable as Observe and gain no delivery-enforcement claim.

If 0.1 is accepted before this proposal is decided, revisit versioning through
the RFC process before changing the published contract. Vendor-native quarantine
or sanitization remains native until an adopted contract is implemented. No
automatic Claude Code, NeMo Relay, or other runtime mapping is claimed.

## Security and privacy impact

The proposal can prevent selected complete response bodies from reaching a
consumer, or replace their content, when the host enforces the buffer boundary.
It cannot retract previously delivered chunks, undo remote effects, or prove
that a scan or replacement is semantically safe after parsing.

Buffering, base64, and replacement increase memory and copying costs. Native
resource limits, restricted quarantine storage, authorized inspection endpoints,
and content-free diagnostics remain necessary host responsibilities. A valid
replacement is an authorized content change, not a claim of preserved origin
authenticity. Default fail-open remains part of the proposed contract.

## Alternatives considered

| Alternative | Trade-off |
| --- | --- |
| Add `BeforeNetworkResponseDelivery` | Would preserve the original Observe-only baseline, but adds a third network event for a flow that the current Pre/Post pair already covers. |
| Keep full-body inspection in a vendor event | Supports experimentation before adoption, but offers no shared body-inspection and replacement behavior across hosts. |
| Inspect each streaming chunk | Reduces buffering latency but requires cross-chunk, cancellation, and already-delivered-content rules. It is outside this full-body proposal. |
| Reuse `updatedInput` or add `transform`/`quarantine` decisions | Obscures whether input or response bytes change, or mixes delivery decisions with storage policy. An explicit body replacement field plus existing permission decisions is sufficient. |

## Follow-up implementation and acceptance criteria

After acceptance, a follow-up PR for the remaining body-inspection and
replacement features must update `spec/0.1/events.md` (including
the registry and shared network/memory terminal rules), `core.md` response and
capability rules, adapter/security guidance, root and published schemas,
fixtures, and examples together. `PostMemoryWrite` stays Observe. The event
enumerations and count remain 18. Schema rules must validate body/recipient
field dependencies, success-only delivery fields, and replacement types;
base64 validity and capability-dependent behavior also need semantic checks.

These are future acceptance criteria, not runtime tests performed by this RFC:

| Case | Required result |
| --- | --- |
| Complete text, binary, and empty body | A valid allow releases exactly the evaluated bytes, subject to other applicable decisions and native policy. |
| Valid replacement, including an empty string | Deliver exactly the replacement; preserve original network facts and reconcile native delivery metadata. |
| Replacement cannot be applied faithfully | Stop with a native error; do not expose the original body as a fallback. |
| Valid deny, including complete HTTP 403/500 responses | Withhold content; keep the actual network outcome/status; emit no extra terminal occurrence. |
| Valid replacement supplied without allow | No replacement effect; a valid deny remains a denial. |
| Handler error, timeout, malformed replacement, or correlation mismatch | No control from that invocation; preserve the current buffer and other valid decisions, and apply fail-open/native policy. |
| Multiple handlers | Present replacements to subsequent final-content inspectors; failures and later allows do not cancel valid denies. |
| Network failure/interruption | Emit the actual terminal result with error; omit complete-body fields and ignore controls; do not release partial bytes under a full-body protection claim. |
| Successful result with no body offered for delivery | Preserve terminal telemetry; omitted delivery fields confer no control or bypass permission. |
| Existing Observe host or handler | Continue faithful telemetry, ignore control fields, and require explicit configuration before enabling revised Gate semantics. |
| Already-delivered stream or decoded-object-only runtime | Claim only the faithful capability available; do not claim full-byte Gate protection. |
| Redacted, truncated, prefix-only, or hash-only input | Do not label it a complete evaluated body. |
| Changed body or repeated handler delivery | Reevaluate inapplicable inspections; retain the recipient, terminal occurrence, and network facts, using fresh event IDs. A valid deny remains a denial. |
| Attempt to reuse a decision for another recipient or a later quarantine release | Do not authorize it through this request-continuation contract. |
| Redirect or retry | A new request has a new operation ID; reevaluation is not a new network operation. |
| Native policy denial, ask, or defer | Keep the body unavailable while required approval is unresolved; non-interactive ask is deny, and defer is not consent. |
| Buffer limits and quarantine | Apply declared native policy; no silent streaming fallback or readable path to withheld bytes. |

JSON Schema validation alone cannot prove timing, actual replacement, withheld
bytes, or correct decision handling. Implementation verification must include
host integration tests in addition to structural fixtures.

## References

- [RFC 0001: Agent Hook 0.1 Core Event Contract](./0001-agent-hook-core-event-contract.md).
- [RFC 0004: Standard network, memory, and configuration lifecycle events](./0004-standard-lifecycle-events.md).
- [Core protocol](../spec/0.1/core.md).
- [Event registry](../spec/0.1/events.md).
- [Extension policy](../spec/0.1/extensions.md).
- [Security considerations](../spec/0.1/security.md).
- [Related enterprise integration proposal, PR #1](https://github.com/trendmicro/agent-hook-unity/pull/1).

The use case arose during review of an enterprise governance integration.
This RFC does not claim vendor acceptance, co-authorship, or implementation.

## Decision record

Pending. The prerequisite Discussion, at least 14 calendar days of public
review, and maintainer decision remain outstanding under repository governance.
The working draft includes later changes described by RFC 0007; their presence
does not accept this RFC's remaining body-inspection and replacement proposal.
