---
sidebar_position: 3
---

import Link from '@docusaurus/Link';

# Capability declaration guide

**Informative guide.** The normative requirements are in the
<Link to="/specification/0.1/core#versioning-and-conformance">Core protocol</Link>
and <Link to="/specification/0.1/events#capability-declaration">event registry</Link>.
This guide supplies a report format and a fictional example. It does not
standardize a configuration file, discovery mechanism, negotiation protocol,
minimum supported event set, or new conformance level.

## What a declaration communicates

A host or adapter declares every Core event using exactly one capability mode.
The declaration identifies what its native runtime can actually observe and
control, rather than which similarly named callbacks it offers.

| Mode | Meaning for the declared event |
| --- | --- |
| `gate` | The host observes the registry's exact control boundary and can enforce a valid response before the controlled effect. For a Post Gate, that effect is buffered delivery, rendering, or context ingestion after the underlying work completes. Only registry Gates can use this mode. |
| `observe` | The host faithfully emits the event but treats responses as observation or diagnostics, without control effects. A registry Gate may be declared `observe` if its event timing, fields, and correlation are faithful but control is unavailable. |
| `partial` | A related native signal cannot meet one or more required timing, field, correlation, control, or privacy semantics. Identify the limitation; do not emit it as a normalized Core event. |
| `unavailable` | The host cannot emit the event faithfully. Do not fabricate a Core equivalent. |

Capability and outcome are different: a `gate` declaration does not mean every
operation is denied, and an `observe` declaration is not a dry-run enforcement
mode. A timeout alone supplies no decision and follows the
<Link to="/specification/0.1/core#fail-open-behavior">Core fail-open default</Link>,
subject to other valid controls for the same pending action and independent
native policy.

## Suggested report information

The Core requires a complete event enumeration, one mode per event, and the
limitations of each `partial` mapping. The following additional information
makes that declaration easier to review; this table is a reporting aid, not
additional required wire fields.

| Report item | What to record |
| --- | --- |
| Host and adapter | Names, versions, and the native runtime or SDK version whose behavior was assessed. |
| Specification baseline | Contract name, spec identifier, exact reviewed revision, and the event/response schemas used. The current identifier is `agent-hook-unity/0.1`; the draft defines no automatic negotiation with the earlier colliding identifier. |
| Execution scope | Which native operations reach the adapter, including any hidden SDK retries, provider-hosted tools, background work, or delegated agents. |
| Native source and boundary | The callback or instrumentation used, when it runs relative to effects, and how required fields are obtained. |
| Correlation | Where delivery, turn, model, tool, operation, approval, and delegation IDs originate and how related events retain them. |
| Handler deadlines and failures | Timeout value and native handling. Under Core, a failed invocation supplies no decision and does not erase other accepted controls for the same pending action. Record any independent native policy separately. |
| Privacy limitations | Redaction or unavailable data that prevents faithful observation or decision-making at the claimed boundary. |
| Evidence | Named tests, traces, or an implementation review tied to the host and adapter version. State whether each check passed, failed, was not run, or was not applicable, with a reason. |
| Open issues | Missing evidence and mapping limitations, with an owner or follow-up reference where available. |

An evidence label does not grant a capability. A schema-valid fixture only
establishes document shape; a mode claim also depends on faithful timing,
correlation, and any required enforcement. See the
<Link to="/conformance">conformance guidance</Link>.

## Complete fictional example

The following **Example Host** is invented to demonstrate all four modes and
independent Pre/Post support. It is not a Claude Code, NVIDIA, or other product
support matrix. There is no implementation or passing conformance claim behind
these rows; all evidence listed below is **planned, not run**.

| Report item | Illustrative value |
| --- | --- |
| Host / adapter | Example Host 0.1 / Example Adapter 0.1 (fictional). |
| Spec baseline | Agent Hook Unity 0.1 revised draft with all 18 Core events; an actual report would attach its exact reviewed revision and schemas. |
| Scope | Caller-initiated turns, host-dispatched tools, native approval, per-request completion tracking, and durable memory writes. Model provider internals and delegated agents are not exposed. |
| Correlation | Adapter-managed delivery and turn IDs; native tool IDs; operation IDs allocated at the actual operation boundary and retained through approval and completion. |
| Evidence status | Every check below is an example of evidence to collect, not an executed result. |

| Core event | Mode | Hypothetical native source and limitation | Planned evidence |
| --- | --- | --- | --- |
| `SessionStart` | `observe` | Session-context callback before subsequent work, carrying its actual start or reset cause. | Context-boundary trace with source and sequence. |
| `UserPromptSubmit` | `gate` | Accepted-turn callback before the prompt affects execution; prompt content and turn ID are available. | Prompt block prevents the turn from affecting execution. |
| `BeforeModelRequest` | `unavailable` | The complete provider request is not exposed before dispatch. | Document the missing boundary; no normalized event. |
| `AfterModelResponse` | `unavailable` | No complete provider terminal-result callback with the required request correlation. | Document the missing result boundary; no normalized event. |
| `PreToolUse` | `gate` | All host tool invocations pass through a pre-dispatch callback with the actual proposed input and a stable tool ID. | Valid deny leaves tool invocation count at zero. |
| `PermissionRequest` | `gate` | Native approval callback before resolution; operation and permission-request IDs retained by the adapter. | Top-level deny prevents the requested operation; hook allow cannot override native restrictions. |
| `PermissionDenied` | `observe` | Native rejection result for a concrete approval request, retaining both IDs and the denying authority. | Request/denial pair with the same identifiers. |
| `PostToolUse` | `observe` | Successful terminal tool result with the input and tool ID used for the invocation, but the host cannot hold it before context ingestion. | Success pairs with its Pre event; response controls have no effect for this host capability. |
| `PostToolUseFailure` | `observe` | Failed or interrupted terminal tool result with the same tool ID. | One observed terminal outcome per invocation, not both success and failure. |
| `PreNetworkAccess` | `partial` | Only the initial outbound request has a pre-dispatch callback; internal redirect and retry dispatches cannot be gated. | Record this limitation; no normalized Pre event for this partial mapping. |
| `PostNetworkAccess` | `observe` | Separate per-request completion tracking exposes each request's original target and terminal result, including redirects/retries, but response delivery is not buffered. | Distinct request IDs, faithful terminal targets, no fabricated Pre events, and ignored response controls. |
| `PreMemoryWrite` | `gate` | Durable-memory callback before the proposed value becomes persistent or visible. | Deny prevents the write; a changed target or value requires re-evaluation. |
| `PostMemoryWrite` | `observe` | Terminal durable-write result retains store, key, operation, and turn IDs. | Correlated success/failure/interruption; no rollback inference. |
| `PreConfigChange` | `partial` | A watcher reports the effective configuration only after a mutation took effect. | Record the timing limitation; no normalized Core Pre event. |
| `SubagentStart` | `unavailable` | No faithful delegated-agent start boundary or delegation IDs. | Document the missing surface; no normalized event. |
| `SubagentStop` | `unavailable` | No faithful delegated-agent terminal boundary. | Document the missing surface; no normalized event. |
| `Stop` | `observe` | Terminal caller-turn callback with the accepted prompt's ID and actual outcome. | Turn correlation and ignored response controls. |
| `SessionEnd` | `observe` | Observable session end callback with the actual end cause. | Session-end trace; no invented notification for an unobservable process crash. |

In this example, Post-network support depends on an independent source of
per-request completion data. Observing only an initial URL or a final redirect
result would not justify that row. Operation IDs still originate at the
underlying operation boundary, even when no faithful Pre event can be emitted.

Every event capability is declared independently. Model, tool, network,
memory, approval, and delegation pairs still have their own required
correlation and lifecycle rules. A Gate-capable Post event may therefore be
declared `observe` when the host cannot buffer its controlled delivery or
ingestion boundary. Likewise, a failed or interrupted operation may have
partial effects; its Post event does not prove rollback.

## Applying the report to a real host

1. Replace the fictional metadata and every event row with an assessment of
   the exact host and adapter version being reviewed.
2. Check timing, required payload, correlation, privacy, and response handling
   against the <Link to="/specification/0.1/events">event registry</Link>.
   Preserve native facts; a similar name or later side effect is not enough.
3. Attach actual evidence and its status. Distinguish fixtures, mock behavior,
   and real-host observations. A test not run is not a passing result.
4. Reassess when the native runtime, visibility, redaction, adapter, or draft
   revision changes. Keep the declaration tied to what was assessed.

Use the <Link to="/specification/0.1/adapters">adapter guide</Link> for native
mapping requirements and the <Link to="/responses">response reference</Link>
for event-specific controls. This reporting example supplies neither automatic
capability negotiation nor evidence that a host's unobserved paths are covered.
