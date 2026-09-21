import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validator = path.join(projectRoot, 'scripts', 'validate.mjs');
const activeSpec = 'agent-hook-unity/0.1';
const eventNames = ['BeforeAction', 'AfterAction'];

function eventSchema(names = eventNames) {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://example.test/schemas/0.1/hook-event.schema.json',
    title: 'Test hook event',
    type: 'object',
    properties: {
      spec: { const: activeSpec },
      event_id: { type: 'string' },
      hook_event_name: { $ref: '#/$defs/EventName' },
    },
    required: ['spec', 'event_id', 'hook_event_name'],
    $defs: {
      CoreEventName: { enum: names },
      EventName: {
        anyOf: [
          { $ref: '#/$defs/CoreEventName' },
          { type: 'string', pattern: '^x-[a-z]+/[A-Z][A-Za-z]+$' },
        ],
      },
    },
  };
}

function responseSchema(names = eventNames) {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://example.test/schemas/0.1/hook-response.schema.json',
    title: 'Test hook response',
    type: 'object',
    properties: {
      spec: { const: activeSpec },
      event_id: { type: 'string' },
      decision: { enum: ['allow', 'deny'] },
      hookSpecificOutput: { $ref: '#/$defs/HookSpecificOutput' },
    },
    required: ['spec', 'event_id'],
    additionalProperties: false,
    $defs: {
      EventName: {
        anyOf: [
          { enum: names },
          { type: 'string', pattern: '^x-[a-z]+/[A-Z][A-Za-z]+$' },
        ],
      },
      HookSpecificOutput: {
        type: 'object',
        properties: { hookEventName: { $ref: '#/$defs/EventName' } },
        required: ['hookEventName'],
      },
    },
  };
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function makeRepository(t) {
  const repository = await mkdtemp(path.join(tmpdir(), 'agent-hook-validator-'));
  t.after(() => rm(repository, { recursive: true, force: true }));

  const event = eventSchema();
  const response = responseSchema();
  await Promise.all([
    mkdir(path.join(repository, 'fixtures'), { recursive: true }),
    mkdir(path.join(repository, 'rfcs'), { recursive: true }),
    mkdir(path.join(repository, 'website/docs'), { recursive: true }),
    mkdir(path.join(repository, 'spec/0.1'), { recursive: true }),
  ]);
  await Promise.all([
    writeJson(path.join(repository, 'schemas/hook-event.schema.json'), event),
    writeJson(path.join(repository, 'schemas/hook-response.schema.json'), response),
    writeJson(path.join(repository, 'website/static/schemas/0.1/hook-event.schema.json'), event),
    writeJson(path.join(repository, 'website/static/schemas/0.1/hook-response.schema.json'), response),
    writeFile(path.join(repository, 'spec/0.1/events.md'), `# Event registry

| \`hook_event_name\` | Boundary | Classification |
| --- | --- | --- |
| \`BeforeAction\` | Before action. | Gate |
| \`AfterAction\` | After action. | Observe |
`),
    writeFile(path.join(repository, 'spec/0.1/index.md'), 'The registry defines 2 Core events: 1 Gate event and 1 Observe event.\n'),
  ]);

  return repository;
}

function validate(repository) {
  return spawnSync(process.execPath, [validator, '--root', repository], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

function output(result) {
  return `${result.stdout}${result.stderr}`;
}

async function updateCanonicalAndPublished(repository, name, mutate) {
  const canonical = path.join(repository, 'schemas', `${name}.schema.json`);
  const schema = JSON.parse(await readFile(canonical, 'utf8'));
  mutate(schema);
  await Promise.all([
    writeJson(canonical, schema),
    writeJson(path.join(repository, 'website/static/schemas/0.1', `${name}.schema.json`), schema),
  ]);
}

test('accepts a synchronized minimal repository', async (t) => {
  const repository = await makeRepository(t);
  const result = validate(repository);

  assert.equal(result.status, 0, output(result));
});

test('rejects a published schema copy that differs from its canonical schema', async (t) => {
  const repository = await makeRepository(t);
  const published = path.join(repository, 'website/static/schemas/0.1/hook-event.schema.json');
  const schema = JSON.parse(await readFile(published, 'utf8'));
  schema.title = 'Drifted copy';
  await writeJson(published, schema);

  const result = validate(repository);

  assert.equal(result.status, 1, output(result));
  assert.match(output(result), /website\/static\/schemas\/0\.1\/hook-event\.schema\.json must exactly match schemas\/hook-event\.schema\.json/);
});

test('rejects a newly introduced schema event missing from the registry', async (t) => {
  const repository = await makeRepository(t);
  await updateCanonicalAndPublished(repository, 'hook-event', (schema) => {
    schema.$defs.CoreEventName.enum.push('DuringAction');
  });

  const result = validate(repository);

  assert.equal(result.status, 1, output(result));
  assert.match(output(result), /missing from registry: DuringAction/);
});

test('rejects a registry event removed from the schema', async (t) => {
  const repository = await makeRepository(t);
  await updateCanonicalAndPublished(repository, 'hook-event', (schema) => {
    schema.$defs.CoreEventName.enum = ['BeforeAction'];
  });

  const result = validate(repository);

  assert.equal(result.status, 1, output(result));
  assert.match(output(result), /missing from schema: AfterAction/);
});

test('rejects response event membership that differs from the canonical event schema', async (t) => {
  const repository = await makeRepository(t);
  await updateCanonicalAndPublished(repository, 'hook-response', (schema) => {
    schema.$defs.EventName.anyOf[0].enum = ['BeforeAction'];
  });

  const result = validate(repository);

  assert.equal(result.status, 1, output(result));
  assert.match(output(result), /hook-response\.schema\.json event names differ.*missing from response schema: AfterAction/);
});

test('rejects a mirrored Core Gate table that differs from registry classifications', async (t) => {
  const repository = await makeRepository(t);
  await writeFile(path.join(repository, 'spec/0.1/core.md'), `# Core

| Core Gate | Control |
| --- | --- |
| \`AfterAction\` | deny |
`);

  const result = validate(repository);

  assert.equal(result.status, 1, output(result));
  assert.match(output(result), /spec\/0\.1\/core\.md Core Gate table differs from the event registry \(missing from table: BeforeAction; non-Gate in table: AfterAction\)/);
});

test('rejects a missing published schema copy', async (t) => {
  const repository = await makeRepository(t);
  await unlink(path.join(repository, 'website/static/schemas/0.1/hook-response.schema.json'));

  const result = validate(repository);

  assert.equal(result.status, 1, output(result));
  assert.match(output(result), /missing published schema copy website\/static\/schemas\/0\.1\/hook-response\.schema\.json/);
});

test('rejects a stale spec identifier in a JSON hook envelope', async (t) => {
  const repository = await makeRepository(t);
  await writeFile(path.join(repository, 'website/docs/example.md'), `# Example

\`\`\`json
{
  "spec": "agent-hooks/0.1",
  "event_id": "example-id",
  "hook_event_name": "BeforeAction"
}
\`\`\`
`);

  const result = validate(repository);

  assert.equal(result.status, 1, output(result));
  assert.match(output(result), /website\/docs\/example\.md \(JSON block 1\) uses spec "agent-hooks\/0\.1"; expected "agent-hook-unity\/0\.1"/);
});

test('rejects active-spec event and response examples that omit event_id', async (t) => {
  const repository = await makeRepository(t);
  await writeFile(path.join(repository, 'website/docs/missing-event-id.md'), `# Missing correlation

\`\`\`json
{"spec": "${activeSpec}", "hook_event_name": "BeforeAction"}
\`\`\`

\`\`\`json
{"spec": "${activeSpec}", "decision": "allow"}
\`\`\`
`);

  const result = validate(repository);

  assert.equal(result.status, 1, output(result));
  assert.match(output(result), /missing-event-id\.md \(JSON block 1\) failed validation against hook-event\.schema\.json/);
  assert.match(output(result), /missing-event-id\.md \(JSON block 2\) failed validation against hook-response\.schema\.json/);
});

test('ignores unrelated JSON configs and proposed jsonc examples', async (t) => {
  const repository = await makeRepository(t);
  await writeFile(path.join(repository, 'website/docs/config.md'), `# Config

\`\`\`json
{"spec": "unrelated-tool/1", "enabled": true}
\`\`\`

\`\`\`jsonc
{"spec": "agent-hooks/0.1", "event_id": "proposal"}
\`\`\`
`);

  const result = validate(repository);

  assert.equal(result.status, 0, output(result));
});

test('ignores hook examples in repository-local worktrees', async (t) => {
  const repository = await makeRepository(t);
  const historicalExample = path.join(repository, '.worktrees/old/examples/historical.md');
  await mkdir(path.dirname(historicalExample), { recursive: true });
  await writeFile(historicalExample, `\`\`\`json
{"spec": "agent-hooks/0.1", "event_id": "old", "hook_event_name": "BeforeAction"}
\`\`\`
`);

  const result = validate(repository);

  assert.equal(result.status, 0, output(result));
});

test('ignores vendored and local agent-tool Markdown', async (t) => {
  const repository = await makeRepository(t);
  for (const directory of ['third_party', '.agents', '.atlassian', '.claude', '.codex', '.superpowers']) {
    const localMarkdown = path.join(repository, directory, 'local.md');
    await mkdir(path.dirname(localMarkdown), { recursive: true });
    await writeFile(localMarkdown, `# Local tooling

[Missing local file](./missing.md)

\`\`\`json
{"spec": "agent-hooks/0.1", "event_id": "old", "hook_event_name": "BeforeAction"}
\`\`\`
`);
  }

  const result = validate(repository);

  assert.equal(result.status, 0, output(result));
});

test('rejects explicit event-count summaries that disagree with the registry', async (t) => {
  const repository = await makeRepository(t);
  await writeFile(path.join(repository, 'spec/0.1/index.md'), 'The registry defines 999 Core events: 998 Gate events and 1 Observe event.\n');

  const result = validate(repository);

  assert.equal(result.status, 1, output(result));
  assert.match(output(result), /spec\/0\.1\/index\.md states 999 Core events; registry defines 2/);
  assert.match(output(result), /spec\/0\.1\/index\.md states 998 Gate events; registry defines 1/);
});

test('rejects emphasized event-count summaries that disagree with the registry', async (t) => {
  const repository = await makeRepository(t);
  await writeFile(path.join(repository, 'spec/0.1/index.md'), 'The registry distinguishes seven **Gate** events from eleven **Observe** events.\n');

  const result = validate(repository);

  assert.equal(result.status, 1, output(result));
  assert.match(output(result), /spec\/0\.1\/index\.md states 7 Gate events; registry defines 1/);
  assert.match(output(result), /spec\/0\.1\/index\.md states 11 Observe events; registry defines 1/);
});
