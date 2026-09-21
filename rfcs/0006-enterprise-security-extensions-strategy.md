---
title: "RFC 0006: Enterprise Security Extensions Strategy & Non-Core Capabilities"
status: Draft
discussion: "Pending — prerequisite Discussion has not been opened"
review-start: "Not started"
review-end: "Not scheduled"
maintainer-votes: []
decision: "Pending"
supersedes: []
superseded-by: []
---

# RFC 0006: Enterprise Security Extensions Strategy & Non-Core Capabilities

## Summary

This RFC proposes a standardized architectural strategy and recommended extension profiles for enterprise-grade security capabilities within the Agent Hook ecosystem.

This is an unaccepted proposal. Its top-level `decision` baseline was already
introduced by PR #9 before this RFC; the enterprise profiles below did not
introduce that Core response shape. [RFC 0007](./0007-core-draft-consolidation.md)
records the consolidated working baseline and migration to
`agent-hook-unity/0.1`, including the corresponding signing-domain update in
this draft. The profiles remain optional proposals and have not been accepted
or certified by their appearance in this repository.

To preserve the minimalism, zero-dependency, and lightweight nature of the **Agent Hook Core 0.1 Specification**, heavy enterprise defense features—such as cryptographic wire signing (Ed25519/TPM), tamper-evident audit ledgers (hash-chaining), asynchronous Human-in-the-Loop (HITL) suspension, Time-of-Check to Time-of-Use (TOCTOU) payload verification, and out-of-band administrative session revocation—are explicitly designated as **optional, non-core extension profiles**.

These profiles use the existing `extensions` container defined in
[`spec/0.1/extensions.md`](../spec/0.1/extensions.md). Unknown extension data can
be ignored without changing Core schema compatibility. Interoperability and
enforcement for a profile require explicit agreement on its version and
semantics; independently customized profiles do not imply compatibility.

---

## Motivation

### The Architectural Dilemma

When designing runtime security governance standards for autonomous AI agents, two distinct sets of requirements emerge:

1. **Open Source & Lightweight Developers (OSS / Consumer Agents)**:
   - Demand zero heavy dependencies, minimal overhead, and absolute ease of adoption.
   - A single-file Python script or simple TypeScript agent should run without needing C cryptography bindings, hardware TPM drivers, or asynchronous webhook suspension queues.
2. **Enterprise, FinTech, & Regulated Sectors (Enterprise / GovTech / SEC Compliance)**:
   - Demand non-repudiation, tamper-evident audit trails for forensic admissibility, cryptographic hardware identity, asynchronous human approval across corporate chat tools (Slack/Teams), and immediate administrative kill-switches.

Forcing heavy enterprise armor into the **Core 0.1 normative specification** would alienate open-source developers and slow down adoption. Conversely, providing no standard for enterprise capabilities leads to fragmentation, proprietary vendor lock-in, and incompatible custom forks.

### Guiding Philosophy

> **"Core does subtraction (protecting a universal minimal baseline); Extensions do addition (mounting modular enterprise armor on demand)."**

This RFC proposes optional enterprise profiles for implementations such as PEP
proxies and policy decision points. Lightweight agents can retain Core schema
compatibility while ignoring those extensions, but profile-specific guarantees
require matching implementations and explicit configuration on the participating
hosts. No vendor adoption or interoperability certification is asserted.

---

## Proposal

### 1. Scope & Core vs. Non-Core Boundary

The following capabilities are classified as **Tier 2 (Enterprise Extension Profiles)** and **Tier 3 (Control-Plane Operations)**:

```
+---------------------------------------------------------------------------------------------------+
|                        Agent Hook Security Governance Hierarchy                                   |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [ TIER 1: Core 0.1 Protocol ] (Normative Baseline)                                              |
|  - Flat JSON Envelopes, Top-Level Decision & Reason, 18 Core Lifecycle Events                     |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [ TIER 2: Enterprise Extension Profiles ] (Optional Profiles via extensions[...])               |
|                                                                                                   |
|   1. Zero-Trust Wire Signing    2. Tamper-Evident Ledger     3. Asynchronous HITL                 |
|      (sec.enterprise.crypto)      (sec.enterprise.audit)      (sec.enterprise.hitl)               |
|                                                                                                   |
|   4. TOCTOU Integrity Guard     5. Failure & Degradation Enforcement                              |
|      (sec.enterprise.integrity)   (sec.enterprise.degradation)                                    |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [ TIER 3: Control-Plane Management ] (Out-of-band Administrative Channel)                         |
|                                                                                                   |
|   6. Emergency Administrative Kill Switch (x-nemo/SessionRevoke or POST /sessions/{id}/revoke)    |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

#### Gap Analysis of Non-Core Capabilities

| Capability | Primary Value | Why Kept Out of Core 0.1 | Recommended Disposition |
| :--- | :--- | :--- | :--- |
| **1. Cryptographic Wire Signing** | Hardware-grade authenticity (Ed25519/TPM); prevents spoofed agent events. | Requires crypto dependencies (`cryptography`, libsodium) and key management infrastructure. | Optional profile under `extensions["sec.enterprise.crypto"]` or HTTP header `Hook-Signature`. |
| **2. Tamper-Evident Audit Ledger** | Hash-chained records (`prev_record_hash`) providing forensic non-repudiation. | Imposes sequencing and storage overhead unsuitable for stateless lambdas/microservices. | Optional profile under `extensions["sec.enterprise.audit"]`. |
| **3. Asynchronous HITL Suspension** | Async suspension with signed resumption tokens (`ApprovalGrantToken`) via Slack/Teams. | Involves long-lived state queues and callback channels beyond Core synchronous request/response. | Optional profile under `extensions["sec.enterprise.hitl"]`. |
| **4. TOCTOU Integrity Verification** | Compares payload hash between approval time and execution time. | Application-level invariant check rather than lifecycle dispatch primitive. | Optional profile under `extensions["sec.enterprise.integrity"]`. |
| **5. Failure & Degradation Enforcement** | Enforces fail-closed or bounded-open degradation under handler outage, timeout, or validation rejection. | Core 0.1 mandates baseline fail-open to preserve agent availability without defining complex failure state machines. | Optional profile under `extensions["sec.enterprise.degradation"]` or host capability metadata. |
| **6. Emergency Session Revocation** | Out-of-band administrative command to immediately sever agent network & revoke grants. | Control-plane operation, fundamentally distinct from inside-out agent data-plane lifecycle events. | Out-of-band control endpoint (`POST /sessions/{id}/revoke`) or namespaced event `x-nemo/SessionRevoke`. |

---

### 2. Normative Rules for Extensions

All extensions proposed in this RFC adhere strictly to [`spec/0.1/extensions.md`](../spec/0.1/extensions.md):

1. **Non-Mandatory (Opt-In)**: No agent, PEP, or PDP is required to implement any extension defined herein to claim Core 0.1 compliance.
2. **Safe to Ignore**: A consumer that does not understand an extension namespace MUST ignore it without failing validation.
3. **Namespace Autonomy & Customization**:
   - The namespaces defined in this document (e.g., `sec.enterprise.*` or reverse-DNS `com.trendmicro.security.*`) represent **recommended public profiles**.
   - Conforming to Core 0.1 `spec/0.1/extensions.md`, property names under `extensions` MUST be reverse-DNS namespaces using dot notation (`^(?:[a-z][a-z0-9-]*\.)+[a-z][a-z0-9-]*$`).
   - Implementers are free to define proprietary namespaces (e.g., `com.mycompany.security.crypto`) or customize property keys according to their internal architecture.
4. **Parameterized & Open Algorithms**:
   - Cryptographic and hashing algorithms specified in example payloads are **parameterized**. Implementers MAY choose alternative algorithms (e.g., `rsa-pss`, `ecdsa-p256`, post-quantum algorithms like `dilithium`, or alternative hashes like `blake3` and `sha3-512`).

---

### 3. Recommended Profile Specifications

#### 3.1 Profile: Cryptographic Wire Signing (`sec.enterprise.crypto`)

Used to guarantee message authenticity and provenance between Agent, PEP (Relay), and PDP.

##### Request / Response Example
```json
{
  "spec": "agent-hook-unity/0.1",
  "event_id": "8f2ab3e1-4c5d-4e6f-8a9b-0c1d2e3f4a5b",
  "hook_event_name": "PreToolUse",
  "session_id": "sess_production_9981",
  "timestamp": "2026-09-17T02:30:00Z",
  "sequence": 4,
  "prompt_id": "prompt-9981",
  "tool_use_id": "toolu-9981-bash",
  "tool_name": "bash",
  "tool_input": {
    "command": "uname -a"
  },
  "extensions": {
    "sec.enterprise.crypto": {
      "key_id": "key_enclave_prod_01",
      "algorithm": "ed25519",
      "canonical_algorithm": "RFC8785_JCS",
      "canonical_hash": "sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
      "signature": "MEQCIE...base64_encoded_signature..."
    }
  }
}
```

* **`key_id`** *(string, required)*: Identifier of the public key registered in the enterprise directory.
* **`algorithm`** *(string, optional, default: `"ed25519"`)*: Cryptographic signing algorithm. Implementations MAY specify `"rsa-pss"`, `"ecdsa-p256"`, or post-quantum variants.
* **`canonical_algorithm`** *(string, optional, default: `"RFC8785_JCS"`)*: Canonicalization method used before hashing.
* **`canonical_hash`** *(string, required)*: Hex-encoded digest (`<hash_algo>:<hex>`).
* **`signature`** *(string, required)*: Base64-encoded signature over the canonical hash.

Alternatively, transport-level implementations MAY transport this metadata via HTTP header:
```http
Hook-Signature: key_id="key_enclave_prod_01", alg="ed25519", sig="MEQCIE..."
```

##### Canonicalization, Preimage, and Verification Semantics

To ensure consistent interoperability across distinct runtime languages (Python, Go, TypeScript) and implementations without signature mismatch:

1. **Canonicalization & Encoding**: Implementations MUST canonicalize payloads using **RFC 8785 (JSON Canonicalization Scheme - JCS)** and encode to UTF-8.
2. **Exact Signed Object & Exclusion**:
   - The signing input is formed from the complete Agent Hook event (or response) document.
   - The self-referential signature property (`extensions["sec.enterprise.crypto"].signature`) and `canonical_hash` (if present) MUST be excluded prior to canonicalization.
3. **Domain Separator & Preimage**:
   - The preimage MUST be prefixed with a strict profile/version domain separation string:
     `agent-hook-unity/0.1:sec.enterprise.crypto:v1\n`
   - The complete byte sequence for signing and verification is:
     $$\text{PREIMAGE\_BYTES} = \text{"agent-hook-unity/0.1:sec.enterprise.crypto:v1\n"} \,||\, \text{JCS}(\text{payload\_without\_sig})$$
   - `canonical_hash` is computed as `<hash_algo>:<hex_digest>` over $\text{PREIMAGE\_BYTES}$.
4. **Replay & Freshness Binding**:
   - The payload MUST include a valid ISO-8601 `timestamp` and a unique UUID `event_id`.
   - The receiver MUST assert that `timestamp` is within the allowable clock-skew window (recommended: $\pm 300\text{ seconds}$) and that `event_id` has not been observed within the active replay cache.
5. **Key ID Resolution & Verification Failure**:
   - `key_id` is resolved against the host or PEP's authorized local keystore, JWKS, or PKI trust anchors.
   - If `key_id` is missing, unknown, or revoked, or if cryptographic verification fails, the PEP/Host **MUST reject the event (`fail_closed` / `decision: "deny"`)** and emit a high-priority security alert.

---

#### 3.2 Profile: Tamper-Evident Audit Ledger (`sec.enterprise.audit`)

Enables forensic verification of agent operation history using back-linked hash chains.

##### Example Payload
```json
{
  "extensions": {
    "sec.enterprise.audit": {
      "sequence": 42,
      "prev_record_hash": "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
      "record_hash": "f8e7d6c5b4a3928170efdcba9876543210fedcba0987654321abcdef01234567",
      "hash_algorithm": "sha256",
      "tamper_evident_status": "verified"
    }
  }
}
```

* **`sequence`** *(integer, required)*: Monotonically increasing event sequence index for the session.
* **`prev_record_hash`** *(string, required)*: Hex-encoded hash of the previous ledger record (or genesis seed string for `sequence: 0`).
* **`record_hash`** *(string, required)*: Hex-encoded hash of the current record including `prev_record_hash`.
* **`hash_algorithm`** *(string, optional, default: `"sha256"`)*: Hash algorithm used (`"sha256"`, `"sha3-512"`, `"blake3"`).
* **`tamper_evident_status`** *(string, optional)*: State evaluation by the verification point (`"verified"`, `"broken_chain"`, `"unverified"`).

##### Ledger Chain Lifecycle, Scope, and Anchors

1. **Chain Scope & Isolation**: Hash chains MUST be scoped and isolated per `session_id`. A multi-agent or multi-session host MUST NOT interleave sequences across distinct sessions.
2. **Genesis Value**: For the first event in a session (`sequence: 0`), `prev_record_hash` MUST be set to 64 hexadecimal ASCII zeros (`"0000000000000000000000000000000000000000000000000000000000000000"`).
3. **Preimage Calculation**:
   - `record_hash` is computed as:
     $$\text{record\_hash} = \text{HASH}(\text{prev\_record\_hash} \,||\, \text{JCS}(\text{record\_body}))$$
     where `record_body` contains the canonicalized event payload excluding `record_hash` and `tamper_evident_status`.
4. **Verification Anchors & Session Rotation**:
   - Upon `SessionEnd` (or sequence rollover), the terminal `record_hash` SHOULD be anchored to external immutable/append-only storage (e.g. WORM storage, Transparency Log, or signed ledger checkpoint).
   - If verification detects a hash mismatch at any sequence step, `tamper_evident_status` is marked `"broken_chain"` and administrative audit alerts are triggered.

---

#### 3.3 Profile: Asynchronous HITL Suspension (`sec.enterprise.hitl`)

Standardizes asynchronous human intervention when a Policy Decision Point returns `decision: "ask"`.

##### PDP Response with Suspension Challenge
```json
{
  "spec": "agent-hook-unity/0.1",
  "event_id": "36c2b982-1d4c-4dc2-ae5b-a65139601741",
  "decision": "ask",
  "reason": "Execution of bash shell with root privilege requires administrator sign-off.",
  "extensions": {
    "sec.enterprise.hitl": {
      "mode": "async_suspended",
      "challenge_id": "ch_slack_prod_99182",
      "resumption_channel": "slack://security-operations",
      "expires_at": 1773729900,
      "escalation_policy": "require_manager_approval"
    }
  }
}
```

##### Correlated Resumption Response (Triggered by Slack/Teams Approval)
When human approval resolves out-of-band, the enterprise PDP or callback service delivers an asynchronous correlated response matching the original `event_id` (`36c2b982-1d4c-4dc2-ae5b-a65139601741`) to the host or PEP resumption endpoint:
```json
{
  "spec": "agent-hook-unity/0.1",
  "event_id": "36c2b982-1d4c-4dc2-ae5b-a65139601741",
  "decision": "allow",
  "reason": "Approved by security administrator Alice.",
  "extensions": {
    "sec.enterprise.hitl": {
      "challenge_id": "ch_slack_prod_99182",
      "approval_grant_token": "agt_eyJhbGciOiJFZERTQ...",
      "approved_by": "alice.security.lead@example.com",
      "approved_at": 1773726500,
      "bound_tool_hash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  }
}
```

* **`mode`** *(string, optional)*: `"sync_prompt"` (synchronous user prompt) or `"async_suspended"` (long-lived asynchronous suspension).
* **`challenge_id`** *(string, required)*: Unique identifier for the human approval challenge.
* **`approval_grant_token`** *(string, optional)*: Cryptographically signed single-use grant token.
* **`expires_at`** *(integer, optional)*: Unix epoch timestamp indicating expiration of the approval challenge.

##### HITL Grant & Resumption Security Contract

To ensure human authorization cannot be replayed, forged, or decoupled from the exact suspended operation:

1. **Standardized Resumption Grant (Signed or Opaque with Introspection)**:
   The `approval_grant_token` delivered upon resumption MUST represent cryptographically verifiable authorization via either:
   - **Signed Grant (JWS/JWT)**: A compact JWS token (RFC 7515) signed by the authorized HITL Policy Decision Point.
   - **Opaque Grant with Token Introspection**: An opaque reference string validated via an authenticated PDP token introspection endpoint (RFC 7662 style) returning the required claims.
2. **Mandatory Bound Claims**:
   Both formats MUST bind the following claims:
   - `iss` *(string, required)*: Identifier of the authorized HITL authority.
   - `aud` *(string, required)*: Identifier of the target Agent host or PEP.
   - `sub` *(string, required)*: The original suspended `event_id` (e.g. `"36c2b982-1d4c-4dc2-ae5b-a65139601741"`).
   - `sid` *(string, required)*: The session identifier (`session_id`).
   - `tool` *(string, required)*: The tool name being authorized (`tool_name`).
   - `input_hash` *(string, required)*: Hex-encoded `SHA-256(RFC8785_JCS(tool_input))` representing the exact parameters displayed to and approved by the human.
   - `exp` *(integer, required)*: Expiration timestamp in seconds since Unix epoch.
   - `jti` *(string, required)*: Globally unique grant ID for atomic single-use tracking.
   - `approver` *(string, optional)*: Identity of the approving operator (e.g. email or employee ID).
3. **Host Resumption Verification & Replay Protection**:
   When the correlated resumption response arrives at the PEP:
   - **Freshness Check**: Assert $(T_{\text{now}} \le \text{exp})$. If expired, reject resumption (`decision: "deny"`).
   - **Context Binding**: Assert that `sub == event_id`, `sid == session_id`, and `tool == tool_name` match the currently suspended turn.
   - **Content Integrity Binding**: Recompute `SHA-256(RFC8785_JCS(tool_input))` against the pending tool execution parameters and assert exact match with `input_hash`. If arguments were altered during turn suspension, the host MUST reject execution (`decision: "deny"`).
   - **Atomic Single-Use**: The host MUST atomically verify and mark `jti` as consumed. Any duplicate arrival with the same `jti` MUST be rejected as a replay attack.

---

#### 3.4 Profile: TOCTOU Content Fingerprint (`sec.enterprise.integrity`)

Defends against Time-of-Check to Time-of-Use (TOCTOU) payload swapping attacks between policy verification and tool execution.

##### Example Payload
```json
{
  "extensions": {
    "sec.enterprise.integrity": {
      "content_identity": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "enforce_toctou_pre_dispatch": true
    }
  }
}
```

* **`content_identity`** *(string, required)*: Cryptographic hash of the serialized tool input arguments (`tool_input`).
* **`enforce_toctou_pre_dispatch`** *(boolean, optional, default: `true`)*: Instructs the PEP/host to verify that the executed parameters match `content_identity` identically prior to invocation.

##### Canonical Serialization & Payload Rewrite Semantics

1. **Canonical Serialization**: `content_identity` MUST be generated as `"sha256:"` concatenated with lowercase hex of `SHA-256(RFC8785_JCS(tool_input))`.
2. **Behavior After Payload Rewrite**:
   - If an authorized `PreToolUse` hook handler legitimately modifies `tool_input` (e.g. parameter sanitization or credential injection), the rewriting handler **MUST recompute** and provide the updated `content_identity` alongside the mutated payload.
   - If an unauthorized handler modifies parameters, or if the dispatched parameters do not match `content_identity` immediately prior to execution, the host PEP **MUST abort dispatch (`decision: "deny"`)** with `reason: "TOCTOU integrity violation: parameters modified post-authorization"`.

---

### Extension Profile 5: Failure & Degradation Enforcement (`sec.enterprise.degradation`)

#### Motivation & Threat Model

While Core 0.1 specifies a baseline **fail-open** policy under handler errors or timeouts (to ensure lightweight, local, or experimental agents do not break unexpectedly), enterprise environments and regulated deployments operate under a Zero-Trust threat model:
- If a security policy handler, network proxy, or credential vault times out or crashes, allowing an unvetted `PreToolUse`, `PreNetworkAccess`, or `PreMemoryWrite` operation to proceed creates severe breach and prompt injection exposure.
- Conversely, an unconditional fail-closed policy across non-critical events could cause unnecessary availability outages during brief network jitter.

To resolve this conflict without breaking Core 0.1 minimalism, this profile establishes an opt-in degradation specification that defines:
1. **Precise Failure Classes** that trigger degradation.
2. **Deterministic Enforcement Modes** (`strict_fail_closed`, `bounded_open`, `fail_open_monitored`).
3. **Bounded-Open Circuit Breakers** with defined state transitions and exhaustion thresholds.
4. **Explicit Precedence** over the Core 0.1 fail-open default.

#### Recommended Payload Structure

This profile is authoritative when declared in host or administrator preconfiguration, or dynamically provisioned via authenticated control-plane policy channels:

```json
{
  "extensions": {
    "sec.enterprise.degradation": {
      "profile_version": "1.0",
      "mode": "bounded_open",
      "applicable_gates": [
        "PreToolUse",
        "PreNetworkAccess",
        "PreMemoryWrite",
        "SubagentStart"
      ],
      "applicable_failures": [
        "timeout",
        "transport_error",
        "http_server_error",
        "malformed_response",
        "native_validation_failure"
      ],
      "bounded_open_policy": {
        "max_consecutive_failures": 3,
        "window_seconds": 60,
        "cooldown_seconds": 300,
        "on_exhausted": "fail_closed"
      },
      "audit_alert": true
    }
  }
}
```

#### Specification of Parameters

* **`mode`** *(string, required)*:
  - `"strict_fail_closed"`: Any failure in `applicable_failures` for a covered Gate results in immediate operation denial (`decision: "deny"`) and aborts the pending turn.
  - `"bounded_open"`: Follows the deterministic circuit breaker state machine defined below. When failures reach `max_consecutive_failures`, the circuit trips to `on_exhausted`. Requires `bounded_open_policy`.
  - `"fail_open_monitored"`: Follows the Core 0.1 fail-open behavior, but generates high-priority security telemetry and audit events.
* **`applicable_gates`** *(array of strings, optional)*: List of Core Gate names to which this enforcement applies. Defaults to all Gates declared by the host.
* **`applicable_failures`** *(array of strings, required)*:
  - `"timeout"`: Handler fails to reply before `timeout_ms` expires.
  - `"transport_error"`: Connection refusal, DNS resolution failure, or TCP connection reset.
  - `"http_server_error"`: Webhook or proxy responds with HTTP 5xx status codes.
  - `"malformed_response"`: Response body fails JSON parsing, schema validation, or signature verification.
  - `"native_validation_failure"`: Schema-valid mutated payload (e.g. `updatedInput`, `updatedPrompt`) is rejected by the host runtime's native validation.
* **`bounded_open_policy`** *(object, required when `mode` is `"bounded_open"`)*:
  - **`max_consecutive_failures`** *(integer, minimum: 1)*: Maximum allowed consecutive failures before tripping.
  - **`window_seconds`** *(integer, minimum: 1)*: Rolling evaluation window in seconds.
  - **`cooldown_seconds`** *(integer, minimum: 1)*: Time period the circuit remains tripped before entering `HALF_OPEN`.
  - **`on_exhausted`** *(string, enum: `["fail_closed", "require_interactive_approval"]`)*: Action to take once the bound is exhausted.
* **`audit_alert`** *(boolean, optional, default: `true`)*: When `true`, emits an enterprise audit record or alert for every degraded event.

#### Deterministic Circuit Breaker State Machine

When `mode` is `"bounded_open"`, the host or PEP MUST implement the circuit breaker as a deterministic finite-state machine (FSM) governed by the following rules:

1. **Counter Scope & Keying**:
   - State and failure counters MUST be isolated and keyed per **`[gate, handler_id]`** within the agent session (or `[host_id, gate, handler_id]` for multi-tenant gateways). A failure at one tool hook handler MUST NOT trip or affect another hook handler.
2. **Success & Reset Rule**:
   - In state `CLOSED`: When a handler invocation succeeds (receives a valid correlated response within `timeout_ms`), the consecutive failure counter is immediately **reset to 0**, and any prior failures outside the rolling window are pruned.
   - In state `HALF_OPEN`: A single successful probe invocation immediately **resets the counter to 0** and transitions the circuit back to `CLOSED`.
3. **Trip Point (Failure $N$)**:
   - The circuit transitions from `CLOSED` to `TRIPPED` **on failure $N$**, where $N = \text{max\_consecutive\_failures}$ recorded within the trailing `window_seconds`. The $N$-th failing operation and all subsequent arrivals are subjected to `on_exhausted`.
4. **Rolling-Window Calculation**:
   - The rolling window tracks failure timestamps $\{t_1, t_2, \dots\}$. Timestamps older than $(T_{\text{now}} - \text{window\_seconds})$ are pruned continuously.
5. **Half-Open Probing & Concurrent Arrival**:
   - When the circuit is `TRIPPED` and $(T_{\text{now}} - T_{\text{trip}} \ge \text{cooldown\_seconds})$, the circuit transitions to `HALF_OPEN`.
   - In `HALF_OPEN`, the host allows **exactly one (1) probe invocation** to be dispatched to the handler.
   - **Concurrency behavior**: If concurrent operations arrive while a probe is in-flight, the host MUST NOT dispatch additional probes to the degraded handler; concurrent operations MUST immediately evaluate `on_exhausted`.
   - If the probe succeeds: State transitions to `CLOSED`.
   - If the probe fails: State transitions back to `TRIPPED`, resets $T_{\text{trip}} = T_{\text{now}}$, and applies `on_exhausted`.
6. **Persistence & Restart**:
   - The state machine is maintained in-memory by default. Upon process restart, the circuit initializes to `CLOSED` unless persistent backing storage (e.g. Redis) is explicitly configured.
7. **Interactive Fallback**:
   - If `on_exhausted` is `"require_interactive_approval"` but the host environment is non-interactive or headless, the host **MUST fallback to `fail_closed`** (`decision: "deny"`).

##### State Transition Table

| Current State | Event / Condition | Next State | Operation Gating Action |
| :--- | :--- | :--- | :--- |
| `CLOSED` | Handler invocation succeeds | `CLOSED` | Reset consecutive failure counter to 0; allow operation. |
| `CLOSED` | Handler failure; total failures $< N$ in window | `CLOSED` | Increment counter; fail-open (allow operation); emit audit alert. |
| `CLOSED` | Handler failure; total failures $= N$ in window | `TRIPPED` | Record trip time $T_{\text{trip}}$; apply `on_exhausted` (deny operation). |
| `TRIPPED` | New operation; $T_{\text{now}} - T_{\text{trip}} < \text{cooldown}$ | `TRIPPED` | Apply `on_exhausted` (deny operation); do not dispatch to handler. |
| `TRIPPED` | $T_{\text{now}} - T_{\text{trip}} \ge \text{cooldown}$ | `HALF_OPEN` | Transition to `HALF_OPEN`; prepare single probe. |
| `HALF_OPEN` | First operation arrives | `HALF_OPEN` | Dispatch single probe request to handler. |
| `HALF_OPEN` | Concurrent operation arrives while probe in flight | `HALF_OPEN` | Apply `on_exhausted` (deny operation); do not dispatch extra probe. |
| `HALF_OPEN` | Probe succeeds | `CLOSED` | Reset failure counter & window to 0; allow operation. |
| `HALF_OPEN` | Probe fails | `TRIPPED` | Reset $T_{\text{trip}} = T_{\text{now}}$; apply `on_exhausted` (deny operation). |

#### Trust Model & Policy Lifecycle

1. **Authoritative Provisioning Channel & Authorized Issuer**:
   - The authoritative degradation policy MUST be established by **Host / Administrator Preconfiguration** (e.g. local configuration files, environment variables, or host deployment manifests).
   - In distributed deployments, the host MAY accept degradation policies provisioned dynamically by an authorized Policy Administration Point (PAP) or Policy Decision Point (PDP) via an authenticated control-plane channel (e.g. mTLS or cryptographically signed policy bundle).
   - **Precedence & Security Invariant**: An ordinary, unauthenticated hook handler responding to tool or lifecycle events MUST NOT be permitted to downgrade or overwrite an administrator's degradation policy (e.g., a failing handler cannot unilaterally switch the host from `strict_fail_closed` to `fail_open_monitored`). Hook responses MAY only report policy state or request a degradation policy if the issuer is explicitly authenticated as possessing administrative policy authority.
2. **Bootstrap Behavior**:
   - When an agent host boots with no preconfigured degradation policy and no cached policy from an authorized PAP, it defaults to the Core 0.1 baseline: a failed invocation supplies no decision, other applicable decisions and native policy remain effective, and minimal diagnostics are recommended. An explicitly configured `enterprise-strict` profile instead defaults to `strict_fail_closed` for all mutating gates.
3. **Persistence, Expiry, Replacement, and Revocation**:
   - Policies dynamically provisioned by an authorized PAP MAY declare `ttl_seconds` or `expires_at`. Upon expiration, the host evicts the cached policy and falls back to host bootstrap defaults.
   - An administrator or authorized PAP MAY revoke or replace a degradation policy at any time via control-plane push or administrative event (`x-nemo/SessionRevoke`), which takes effect immediately for all subsequent gate evaluations.

#### Precedence Rule against Core 0.1

When `sec.enterprise.degradation` is configured on a host or provisioned by an authorized enterprise PDP, its rules **MUST take precedence** over Core 0.1 default fail-open behavior for all gates listed in `applicable_gates`. If an unlisted Gate fails, it falls back to the Core 0.1 baseline.

---

### 5. Control-Plane Operation: SessionRevoke Emergency Kill Switch

#### Distinction between Data Plane and Control Plane

* **Data-Plane Lifecycle Events** ([`events.md`](../spec/0.1/events.md)): Fired inside-out by the Agent runtime as it progresses (e.g., `PreToolUse`, `AfterModelResponse`).
* **Control-Plane Management Commands**: Fired outside-in by administrative systems or SOC platforms to instruct the PEP/host to terminate execution immediately.

#### Recommended Implementation Formats

Implementations MAY support administrative revocation through either:

1. **REST Management Endpoint**:
   ```http
   POST /v1/sessions/{session_id}/revoke HTTP/1.1
   Host: relay.enterprise.local
   Authorization: Bearer <admin_token>
   Content-Type: application/json

   {
     "reason": "Compromised credentials detected on host machine.",
     "revoked_by": "soc_incident_responder_42",
     "terminate_subagents": true
   }
   ```
2. **Namespaced Extension Event**:
   On internal event buses, implementations MAY emit an extension event adhering to `spec/0.1/events.md`:

```json
{
  "spec": "agent-hook-unity/0.1",
  "event_id": "9f3bc4e2-5d6e-4f7a-9b0c-1d2e3f4a5b6c",
  "hook_event_name": "x-nemo/SessionRevoke",
  "session_id": "sess_production_9981",
  "timestamp": "2026-09-17T02:35:00Z",
  "sequence": 100,
  "extensions": {
    "sec.enterprise.control": {
      "action": "terminate",
      "reason": "Administrative kill-switch invoked by SOC"
    }
  }
}
```

Upon receiving a valid revocation command, the PEP/Host MUST:
- Invalidate all active tokens and standing authorizations associated with `session_id`.
- Terminate or cleanly interrupt running subagents and child tasks.
- Sever external network egress proxy connections for the session.
- Append a terminal record to the audit ledger.

---

## Roles & Responsibilities

```
+----------------+      Core 0.1 Events        +-------------------+     Enriched Extensions    +----------------------+
| AI Agent Host  | ──────────────────────────> |  NeMo Relay (PEP) | ─────────────────────────> | Security PDP (Trend) |
| (Lightweight)  | <────────────────────────── |  (Security Proxy) | <───────────────────────── | (Policy Engine)      |
+----------------+       Standard Allow/Deny   +-------------------+    UniversalDecision       +----------------------+
                                                         │                                                 │
                                                         │ Asynchronous Suspension (202)                   │ Slack/Teams
                                                         ▼                                                 ▼
                                                [ Suspension Store ]                              [ Corporate HITL ]
```

1. **AI Agent Host (Lightweight)**:
   - Needs only Core 0.1 compliance.
   - Emits standard lifecycle events.
   - Transparently retains `extensions` without modifying or stripping unrecognized fields.
2. **NeMo Relay / Interceptor Proxy (PEP)**:
   - Bridges the lightweight Agent with heavy enterprise infrastructure.
   - Offloads cryptographic signing, hash-chain ledger maintenance, and connection suspension from the Agent runtime.
   - Enforces TOCTOU verification before dispatching tool executions.
3. **Security Vendor / PDP (e.g., Trend Micro Vision One)**:
   - Evaluates incoming events against enterprise threat intelligence and security policies.
   - Verifies wire signatures and ledger continuity.
   - Returns top-level `decision: "ask"` and issues signed `ApprovalGrantToken` upon human authorization.
   - Issues out-of-band `SessionRevoke` commands when high-severity incidents are detected.

---

## Compatibility Impact

- **Core 0.1 Compatibility**: These proposed profiles use `extensions` or
  out-of-band endpoints and add no mandatory Core dependency. Enforcement
  guarantees require explicit agreement and implementation by participating
  hosts; ignoring extension data does not provide the profile's guarantees.
- **Draft migration**: Hosts and handlers must coordinate the
  `agent-hook-unity/0.1` identity change described by RFC 0007. Signed payloads,
  domain separators, and content-bound approvals require migration as well.
  Within that declared contract, existing supported nested controls remain a
  fallback only when the canonical top-level decision is absent.

---

## Security and Privacy Impact

- **Enhanced Integrity**: Cryptographic wire signing and TOCTOU protection prevent adversarial injection and man-in-the-middle tampering.
- **Legal Non-Repudiation**: Hash-chained ledgers provide tamper-evident records suitable for enterprise compliance audits (SOC 2, ISO 27001, GDPR).
- **Privacy Considerations**: Extension payloads (such as audit hashes) SHOULD hash rather than log raw sensitive parameters (PII/secrets) unless explicitly intended for encrypted secure audit vaults.

---

## Alternatives Considered

1. **Mandating signing and hash chains in Core 0.1**: Rejected. Would impose C-extension dependencies and high storage overhead on open-source, CLI, and resource-constrained agents.
2. **Using proprietary vendor protocols outside Agent Hook**: Rejected. Would fragment the ecosystem and force enterprise agents into disparate non-interoperable silos.
3. **Encoding non-core decisions inside `hookSpecificOutput`**: Rejected. Top-level `decision` and `reason` cleanly separate the control plane from data mutations, keeping extensions strictly focused on auxiliary governance metadata.

---

## Appendix: Reference JSON Schemas for Extension Profiles

The following JSON Schemas illustrate how implementations may validate extension payloads independently of the core specification.

### A.1 Wire Signing Profile (`sec.enterprise.crypto`)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "EnterpriseCryptoExtension",
  "type": "object",
  "properties": {
    "key_id": { "type": "string" },
    "algorithm": { "type": "string", "default": "ed25519" },
    "canonical_algorithm": { "type": "string", "default": "RFC8785_JCS" },
    "canonical_hash": { "type": "string", "pattern": "^[a-z0-9-]+:[a-f0-9]+$" },
    "signature": { "type": "string" }
  },
  "required": ["key_id", "canonical_hash", "signature"],
  "additionalProperties": true
}
```

### A.2 Audit Ledger Profile (`sec.enterprise.audit`)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "EnterpriseAuditExtension",
  "type": "object",
  "properties": {
    "sequence": { "type": "integer", "minimum": 0 },
    "prev_record_hash": { "type": "string" },
    "record_hash": { "type": "string" },
    "hash_algorithm": { "type": "string", "default": "sha256" },
    "tamper_evident_status": { "type": "string", "enum": ["verified", "broken_chain", "unverified"] }
  },
  "required": ["sequence", "prev_record_hash", "record_hash"],
  "additionalProperties": true
}
```

### A.3 Asynchronous HITL Profile (`sec.enterprise.hitl`)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "EnterpriseHitlExtension",
  "type": "object",
  "properties": {
    "mode": { "type": "string", "enum": ["sync_prompt", "async_suspended"] },
    "challenge_id": { "type": "string" },
    "approval_grant_token": { "type": "string" },
    "resumption_channel": { "type": "string" },
    "expires_at": { "type": "integer" },
    "approved_by": { "type": "string" },
    "approved_at": { "type": "integer" },
    "bound_tool_hash": { "type": "string" }
  },
  "required": ["challenge_id"],
  "additionalProperties": true
}
```

### A.4 Failure & Degradation Profile (`sec.enterprise.degradation`)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "EnterpriseDegradationExtension",
  "type": "object",
  "properties": {
    "profile_version": { "type": "string" },
    "mode": { "type": "string", "enum": ["strict_fail_closed", "bounded_open", "fail_open_monitored"] },
    "applicable_gates": { "type": "array", "items": { "type": "string" } },
    "applicable_failures": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["timeout", "transport_error", "http_server_error", "malformed_response", "native_validation_failure"]
      }
    },
    "bounded_open_policy": {
      "type": "object",
      "properties": {
        "max_consecutive_failures": { "type": "integer", "minimum": 1 },
        "window_seconds": { "type": "integer", "minimum": 1 },
        "cooldown_seconds": { "type": "integer", "minimum": 1 },
        "on_exhausted": { "type": "string", "enum": ["fail_closed", "require_interactive_approval"] }
      },
      "required": ["max_consecutive_failures", "window_seconds", "cooldown_seconds", "on_exhausted"],
      "additionalProperties": true
    },
    "audit_alert": { "type": "boolean" }
  },
  "required": ["mode", "applicable_failures"],
  "allOf": [
    {
      "if": {
        "properties": { "mode": { "const": "bounded_open" } },
        "required": ["mode"]
      },
      "then": {
        "required": ["bounded_open_policy"]
      }
    }
  ],
  "additionalProperties": true
}
```

---

## References

- [RFC 0001: Agent Hook 0.1 Core Event Contract](./0001-agent-hook-core-event-contract.md).
- [RFC 0004: Standard network, memory, and configuration lifecycle events](./0004-standard-lifecycle-events.md).
- [RFC 0005: Inspect and control response content with PostNetworkAccess](./0005-network-response-delivery-inspection.md).
- [Core protocol](../spec/0.1/core.md).
- [Event registry](../spec/0.1/events.md).
- [Extension policy](../spec/0.1/extensions.md).
- [Security considerations](../spec/0.1/security.md).

---

## Decision record

Pending. The prerequisite Discussion, public review window, and formal maintainer votes remain outstanding under repository governance. Core 0.1 remains the normative baseline.
