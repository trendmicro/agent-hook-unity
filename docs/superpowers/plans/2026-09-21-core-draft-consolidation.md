# Core Draft Consolidation Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement the independent tasks and review the combined change.

**Goal:** Resolve the four PM findings against main `08ecf2973ed8a3fb7b09f7a8f3a9450f2ea206b3` with a coherent, explicitly unaccepted draft baseline.

**Architecture:** Keep this repository a specification and schema project. Clarify the minimum host composition invariant, synchronize consumer guidance, and introduce the user-approved `agent-hook-unity/0.1` identity. Record the provenance and outstanding adoption decisions in consolidation RFC 0007 without inventing review dates or votes.

**Tech Stack:** Markdown, JSON Schema Draft 2020-12, Node.js validation, Docusaurus.

**Spec:** User-approved PM-feedback assessment in this task; normative source files in `spec/0.1/` and the proposed consolidation in `rfcs/0007-core-draft-consolidation.md`.

## Global Constraints

- Preserve 18 Core events: 12 Gate and 6 Observe; per-host capabilities remain explicit.
- Preserve supported legacy nested control when top-level decision is absent.
- A valid denial of the same pending action survives other handler outcomes and redelivery; timeout alone retains baseline fail-open behavior.
- Preserve native policy and unresolved approval restrictions; no action execution before required decisions finish or reach their declared deadlines.
- Do not claim runtime conformance from schema validation or a reference reducer.
- Keep RFCs Draft and review/vote metadata truthful. No fabricated acceptance or external publication.
- New wire identity: `agent-hook-unity/0.1`; canonical schema IDs use the existing `agent-hook-unity` Pages paths. Do not silently negotiate the colliding old identity.
- Product repositioning and full Responsible AI interoperability remain an explicitly separate design question.

## Task 1: Core composition and behavioral conformance

**Files:** `spec/0.1/core.md`, `spec/0.1/events.md`, `spec/0.1/security.md`, `website/docs/conformance.md`, `conformance/`.

- [x] Define accepted valid deny as binding to the host's same pending action, across per-handler event IDs, retries of delivery, and reevaluation.
- [x] Qualify every fail-open continuation with other applicable decisions and independent native policy; distinguish timeout from permission.
- [x] Leave scheduling and mutation conflict resolution host-defined subject to deny preservation and existing approval rules.
- [x] Replace stale unresolved rewrite-validation language with the current fail-closed requirement.
- [x] Publish behavioral test scenarios for allow/deny order, failures, parallel outcomes, deadlines, redelivery, and distinct operations; label them as obligations for a host harness.

## Task 2: Consumer-facing baseline synchronization

**Files:** `spec/0.1/index.md`, `spec/0.1/adapters.md`, `examples/`, `website/docs/intro.md`, `website/docs/responses.md`, `website/docs/capabilities.md`.

- [x] Align event modes and result-delivery semantics with the registry; remove stale seven/eleven counts.
- [x] Use canonical top-level decisions in examples and explicitly explain nested legacy fallback.
- [x] Align adapter and capability guidance with all current Gate controls and supported rewrites.
- [x] Explain draft status, partial RFC 0005 implementation, consolidation provenance, and safe host capability claims.

## Task 3: Mechanical regression checks

**Files:** `scripts/validate.mjs`, focused validator helpers/tests if needed, `package.json`.

- [x] Demonstrate failing checks for mismatched published schema copies and registry/schema event drift before implementing them.
- [x] Derive the active identity from canonical schemas and validate current Markdown JSON examples against it, detecting stale envelope identifiers instead of silently skipping them.
- [x] Check event counts where summarized and canonical Gate membership where mirrored; avoid enforcing arbitrary prose wording.
- [x] Verify the validator with deliberate temporary mutations in isolated test data, including newly introduced or removed events and missing files.

## Task 4: Consolidation RFC, identity migration, publication guidance

**Files:** `rfcs/0007-core-draft-consolidation.md`, existing RFC baseline/status summaries, `schemas/`, `fixtures/`, published schema copies, active identifier references, root and website status guidance.

- [x] Record which behavior came from PR #9, which RFC 0005 features remain proposals, and what RFC 0006 actually proposes.
- [x] Document new Core deny invariant, identity migration, schema locations, compatibility impact, and explicitly pending review requirements.
- [x] Move canonical `spec` constants and current examples to `agent-hook-unity/0.1`; add invalid fixtures for the former colliding identity.
- [x] Change schema IDs to their current published URLs; link immutable pre-migration schemas for pinned old integrations and explain that `$id` is not a retrieval requirement.
- [x] Document the future telemetry/correlation interoperability evaluation without claiming an adapter or external certification exists.

## Exit Gate

- [x] Simplify for reuse, quality, and efficiency; remove redundant checks and contradictory claims.
- [x] Run focused validator tests, `npm run validate`, `npm run build`, and `git diff --check`.
- [x] Run scoped independent `codex exec -p review` diff review; fix findings and re-review until Mergeable.
- [x] Report concrete changes, checks, review verdict, and remaining external adoption/publication steps.

Validation: 14 validator regression tests, schema/fixture/Markdown validation,
image parser guards, the website production build, and five executable
PreToolUse example cases passed. The independent review profile returned
**Mergeable** with zero findings after the two initial findings were fixed.
This branch prepares the candidate only; RFC acceptance, a tested external
adapter, and publication after merge remain separate steps.
