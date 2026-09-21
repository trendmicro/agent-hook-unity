# Pre-tool security guard

This non-normative example handles the `PreToolUse` Gate. A host adapter may
deliver the request as JSON on standard input and consume one JSON response on
standard output.

```javascript
#!/usr/bin/env node
import process from 'node:process';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const event = JSON.parse(input);
if (
  event.spec !== 'agent-hook-unity/0.1' ||
  event.hook_event_name !== 'PreToolUse'
) {
  throw new Error('Expected an agent-hook-unity/0.1 PreToolUse event.');
}
const command = event.tool_input?.command ?? '';

const response = {
  spec: 'agent-hook-unity/0.1',
  event_id: event.event_id
};

if (/\brm\s+-rf\b/.test(command)) {
  response.decision = 'deny';
  response.reason = 'Destructive recursive deletion is blocked.';
} else if (/\bdeploy\b.*\bproduction\b/i.test(command)) {
  response.decision = 'ask';
  response.reason = 'Confirm the production deployment.';
} else {
  response.decision = 'allow';
}

process.stdout.write(JSON.stringify(response) + '\n');
```

The `PreToolUse` response uses the canonical top-level `decision`. Legacy
`hookSpecificOutput.permissionDecision` remains valid only when a top-level
decision is absent. An `allow` is only this handler's result; another accepted
denial, a sandbox, organization policy, host policy, or native approval flow
can still block the action. `ask` requires host-native approval and does not
permit execution while that approval remains unresolved. See the
[core protocol](../spec/0.1/core.md) for the normative behavior.

The host is responsible for validating the complete event schema before
delivery. The handler still checks the wire identifier and event name so it
does not silently relabel an older or unrelated request in its response.
