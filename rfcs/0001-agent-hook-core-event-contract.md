---
title: "RFC 0001: Agent Hook 0.1 Core Event Contract"
status: Draft
discussion: "Pending — prerequisite Discussion has not been opened"
review-start: "Not started"
review-end: "Not scheduled"
maintainer-votes: []
decision: "Pending"
supersedes: []
superseded-by: []
---

# RFC 0001: Agent Hook 0.1 Core Event Contract

## Summary

**Historical proposal baseline:** The original proposal below describes 13
events and the earlier event-specific response model. Subsequent draft changes
are consolidated by [RFC 0007](./0007-core-draft-consolidation.md), including
18 events, top-level decisions, deny preservation, and the distinct
`agent-hook-unity/0.1` identity. Follow the current canonical draft for that
candidate's requirements. This RFC remains unaccepted; links to current files
do not retroactively change this original proposal's review status.

This RFC proposes Agent Hook 0.1, a portable JSON contract for lifecycle-hook
events and hook responses. It defines a native envelope, a 13-event Core
registry for security telemetry, decision semantics, JSON Schemas, fixtures,
and adapter guidance. It does not standardize native settings files, discovery
locations, matcher languages, handler ordering, or execution transports.

## Motivation

Agent runtimes increasingly expose hooks for policy enforcement, observability,
and workflow automation. Claude Code, Cursor, and Gemini all expose useful
lifecycle and tool boundaries, but their event names, payload shapes,
configuration, and response conventions differ. An integration therefore needs
one implementation per runtime even when its intended policy is identical.

A security control also needs to reconstruct the sequence of meaningful agent
activity: what entered the agent, what was sent to and received from a model,
what operation was proposed or performed, what approval was requested or
denied, and which work was delegated. A session and tool-only vocabulary cannot
make those distinctions portable.

The common boundary is an event delivered to a handler and a structured result
returned by that handler. Standardizing that boundary permits runtimes to build
small adapters without requiring a single configuration system or runtime
architecture.

## Prior art

- [Claude Code hooks](https://code.claude.com/docs/en/hooks) provide lifecycle
  events, command/HTTP/MCP/prompt handlers, JSON input and output, and
  permission decisions.
- [Cursor hooks](https://docs.cursor.com/agent/hooks) provide JSON-over-stdio
  hooks around sessions, tools, agents, and editor activity.
- [Gemini CLI hooks](https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md)
  use JSON input/output and before/after tool lifecycle points.
- [CloudEvents](https://github.com/cloudevents/spec) demonstrates the value of
  a compact, extensible event envelope, but this RFC chooses a native contract
  closer to existing agent hook payloads.
- [AsyncAPI](https://github.com/asyncapi/spec) separates canonical Markdown,
  schemas, and examples; this repository follows that documentation pattern.

## Proposal

Adopt the normative documents in [`../spec/0.1/`](../spec/0.1/) and the
machine-readable schemas in [`../schemas/`](../schemas/). Agent Hook 0.1:

1. Defines `spec`, `event_id`, `hook_event_name`, `session_id`, `timestamp`,
   and `sequence` as the required request-envelope members. `cwd` and
   `transcript_path` are optional contextual members and SHOULD be supplied
   when available.
2. Defines `spec` and `event_id` as the required members of a correlated
   response, retaining Claude-shaped, event-specific control members rather than
   a universal decision enum.
3. Defines thirteen case-sensitive Core `hook_event_name` values:
   `SessionStart`, `UserPromptSubmit`, `BeforeModelRequest`, `AfterModelResponse`,
   `PreToolUse`, `PermissionRequest`, `PermissionDenied`, `PostToolUse`,
   `PostToolUseFailure`, `SubagentStart`, `SubagentStop`, `Stop`, and
   `SessionEnd`.
4. Defines `UserPromptSubmit`, `BeforeModelRequest`, `PreToolUse`, and
   `PermissionRequest` as decision-capable pre-action events; all other Core
   events are observational.
5. Makes failed, timed-out, absent, and invalid hook responses fail open.
6. Reserves extensions for vendor-specific names and data, with adapter
   guidance rather than configuration-file compatibility claims.
7. Requires a per-host capability declaration for every Core event, using
   `gate`, `observe`, `partial`, or `unavailable`, so security telemetry
   consumers can interpret gaps without treating them as negative observations.

The Core registry is deliberately limited to the boundaries needed to describe
agent activity, model inference, tool execution, authorization, and
delegation. Additional lifecycle events remain available through the extension
mechanism and may be promoted through future RFCs after implementer review.

## Compatibility impact

Existing native hook configurations remain valid and unchanged. They do not
validate as Agent Hook configuration, because configuration and handler
selection are out of scope. Adapters translate native events and responses to
the Agent Hook contract; the included Claude Code reference mapping is
illustrative, not a compatibility guarantee for a particular product release.

This draft replaces the earlier five-event, `event_type` vocabulary before
acceptance. A host MUST use the canonical, case-sensitive `hook_event_name`
when it maps a corresponding Core boundary, and MUST omit a mapping it cannot
implement faithfully. Its per-event capability declaration uses `gate`,
`observe`, `partial`, or `unavailable` to distinguish an unsupported or
observe-only boundary from a missing lifecycle occurrence. The draft does not
require a host to fabricate model, permission, or delegation hooks that its
native facility does not expose.

## Security and privacy impact

The proposal defines event-specific control responses, which makes the host
responsible for preserving policy authority. A response that permits an operation
never overrides host, organization, sandbox, or administrative policy. A response
that requests approval must reach a native approval mechanism or be denied in a
non-interactive host. Event payloads may contain prompts, paths, tool arguments,
outputs, and credentials; adapters and handlers must treat them as untrusted
sensitive data.

The default on handler failure is intentionally fail open for availability. A
runtime that requires fail-closed enforcement must use a native policy feature
or define a future, explicitly configured profile.

The Core registry supports security telemetry without requiring raw sensitive
payloads to be retained. Implementations should preserve the available session,
model-request, tool-use, permission-request, operation, and delegation
correlation identifiers, then apply data minimization and redaction before
exporting or persisting records. A denied operation and a failed completed
operation are distinct security facts and are represented by distinct events.

## Alternatives considered

- **Adopt CloudEvents directly.** Rejected for 0.1 because existing hook
  payloads are closer to a native JSON shape and a CloudEvents binding would
  add a second vocabulary without solving hook decisions.
- **Standardize configuration and transport.** Deferred because native
  discovery, trust, process isolation, and handler execution models materially
  differ across runtimes.
- **Observation-only hooks.** Rejected because pre-action policy decisions are
  a primary cross-runtime use case.
- **A five-event session-and-tool registry.** Rejected because it cannot
  reconstruct model egress, authorization outcomes, user ingress, or delegated
  work for security telemetry.
- **Require every host to emit every Core event.** Rejected because native hook
  coverage differs materially across hosts. Capability declarations make each
  host's observable and enforceable surface explicit without fabricating
  equivalence.

## Acceptance checklist

- [ ] A GitHub Discussion is linked in the front matter.
- [ ] The public review window has run for at least 14 calendar days.
- [ ] The canonical specification, schemas, fixtures, examples, and website
  documentation are reviewed together.
- [ ] `npm run validate` and `npm run build` pass.
- [ ] Maintainer votes and decision rationale are recorded below.

## Decision record

The originating Discussion, review dates, votes, objections, and final
rationale will be recorded here when the RFC is decided.
