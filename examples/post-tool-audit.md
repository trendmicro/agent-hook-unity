# Post-tool audit event

This non-normative example records a successful tool invocation after it has
completed. The registry classifies `PostToolUse` as a Gate, but the host in
this example declares it `observe`: it can report the completed invocation but
cannot hold the result before context ingestion. The handler therefore returns
correlated metadata rather than a control response.

Event delivered by the adapter:

```json
{
  "spec": "agent-hook-unity/0.1",
  "event_id": "862a966f-6f7b-4c15-a8c5-40df353eeaac",
  "hook_event_name": "PostToolUse",
  "session_id": "session-42",
  "timestamp": "2026-09-09T10:17:00Z",
  "sequence": 17,
  "prompt_id": "prompt-7",
  "tool_name": "shell",
  "tool_input": { "command": "git status --short" },
  "tool_response": { "exit_code": 0 },
  "tool_use_id": "toolu-17"
}
```

Response from the audit handler:

```json
{
  "spec": "agent-hook-unity/0.1",
  "event_id": "862a966f-6f7b-4c15-a8c5-40df353eeaac",
  "metadata": {
    "audit_id": "audit-20260909-17",
    "retention_class": "30d"
  }
}
```

Handlers should not copy raw prompts, tool arguments, outputs, or credentials
into audit records unless a documented privacy policy permits it.
Because this delivery is `observe`, any response control fields would be
ignored. The completed tool execution also cannot be rolled back.
