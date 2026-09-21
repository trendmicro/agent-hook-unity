import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootArgumentIndex = process.argv.indexOf('--root');
const root = rootArgumentIndex === -1
  ? defaultRoot
  : path.resolve(process.argv[rootArgumentIndex + 1] ?? '');
const schemaDirectory = path.join(root, 'schemas');
const fixtureDirectory = path.join(root, 'fixtures');
const rfcDirectory = path.join(root, 'rfcs');
const publishedSchemaDirectory = path.join(root, 'website', 'static', 'schemas', '0.1');
const ignoredDirectories = new Set([
  '.agents',
  '.atlassian',
  '.claude',
  '.codex',
  '.docusaurus',
  '.git',
  '.superpowers',
  '.worktrees',
  'build',
  'node_modules',
  'third_party',
]);
const errors = [];
const numberWords = new Map([
  ['zero', 0], ['one', 1], ['two', 2], ['three', 3], ['four', 4],
  ['five', 5], ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9],
  ['ten', 10], ['eleven', 11], ['twelve', 12], ['thirteen', 13],
  ['fourteen', 14], ['fifteen', 15], ['sixteen', 16], ['seventeen', 17],
  ['eighteen', 18], ['nineteen', 19], ['twenty', 20],
]);

async function filesUnder(directory, predicate = () => true) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...await filesUnder(target, predicate));
    } else if (predicate(target)) {
      files.push(target);
    }
  }
  return files;
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    errors.push(`${path.relative(root, file)} is not valid JSON: ${error.message}`);
    return null;
  }
}

async function readOptional(file) {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function difference(left, right) {
  return [...left].filter((value) => !right.has(value)).sort();
}

function describeSetDifference(left, right, leftLabel, rightLabel) {
  const parts = [];
  const missingFromRight = difference(left, right);
  const missingFromLeft = difference(right, left);
  if (missingFromRight.length) parts.push(`missing from ${rightLabel}: ${missingFromRight.join(', ')}`);
  if (missingFromLeft.length) parts.push(`missing from ${leftLabel}: ${missingFromLeft.join(', ')}`);
  return parts.join('; ');
}

function schemaSpecIdentifier(schema) {
  return schema?.properties?.spec?.const
    ?? schema?.$defs?.CommonRequest?.properties?.spec?.const;
}

function responseEventNames(schema) {
  const coreNames = schema?.$defs?.EventName?.anyOf?.find((entry) => Array.isArray(entry.enum));
  return coreNames?.enum;
}

function parseRegistry(markdown) {
  const events = new Map();
  for (const match of markdown.matchAll(/^\|\s*`([^`]+)`\s*\|.*\|\s*(Gate|Observe)\s*\|\s*$/gm)) {
    events.set(match[1], match[2]);
  }
  return events;
}

function parseGateTable(markdown, header) {
  const lines = markdown.split('\n');
  const headerIndex = lines.findIndex((line) => line.match(/^\|\s*([^|]+?)\s*\|/)?.[1].trim() === header);
  if (headerIndex === -1) return null;

  const names = new Set();
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.startsWith('|')) break;
    const match = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (match) names.add(match[1]);
  }
  return names;
}

function parseCount(value) {
  return /^\d+$/.test(value) ? Number(value) : numberWords.get(value.toLowerCase());
}

async function checkMarkdownLinks(markdown, file) {
  const checks = [];
  for (const match of markdown.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)) {
    const destination = match[1].replace(/^<|>$/g, '');
    if (/^(https?:|mailto:|#)/.test(destination)) continue;
    const [target] = destination.split('#');
    if (!target) continue;
    const resolved = path.resolve(path.dirname(file), target);
    checks.push(stat(resolved).catch(() => errors.push(`${path.relative(root, file)} links to missing ${destination}`)));
  }
  await Promise.all(checks);
}

async function validateMarkdownLinks() {
  const markdownFiles = await filesUnder(root, (file) => file.endsWith('.md'));
  await Promise.all(markdownFiles.map(async (file) => checkMarkdownLinks(await readFile(file, 'utf8'), file)));
}

function parseFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;
  return match[1];
}

async function validateRfcs() {
  const rfcFiles = (await filesUnder(rfcDirectory, (file) => /^\d{4}-.+\.md$/.test(path.basename(file))))
    .filter((file) => path.basename(file) !== '0000-template.md');
  const requiredFields = ['title:', 'status:', 'discussion:', 'review-start:', 'review-end:', 'maintainer-votes:', 'decision:'];
  for (const file of rfcFiles) {
    const frontMatter = parseFrontMatter(await readFile(file, 'utf8'));
    if (!frontMatter) {
      errors.push(`${path.relative(root, file)} needs YAML front matter`);
      continue;
    }
    for (const field of requiredFields) {
      if (!frontMatter.includes(`\n${field}`) && !frontMatter.startsWith(field)) {
        errors.push(`${path.relative(root, file)} is missing ${field.slice(0, -1)} in front matter`);
      }
    }
  }
}

async function validatePublishedSchemaCopies(schemaFiles) {
  const canonicalNames = new Set(schemaFiles.map((file) => path.basename(file)));
  for (const required of ['hook-event.schema.json', 'hook-response.schema.json']) {
    if (!canonicalNames.has(required)) errors.push(`missing canonical schema schemas/${required}`);
  }

  for (const canonical of schemaFiles) {
    const published = path.join(publishedSchemaDirectory, path.basename(canonical));
    const [canonicalContent, publishedContent] = await Promise.all([
      readFile(canonical, 'utf8'),
      readOptional(published),
    ]);
    if (publishedContent === null) {
      errors.push(`missing published schema copy ${path.relative(root, published)}`);
    } else if (publishedContent !== canonicalContent) {
      errors.push(`${path.relative(root, published)} must exactly match ${path.relative(root, canonical)}`);
    }
  }
}

async function validateRegistryAndSummaries(schemaDocuments) {
  const registryFile = path.join(root, 'spec', '0.1', 'events.md');
  const registryContent = await readOptional(registryFile);
  if (registryContent === null) {
    errors.push('missing Core event registry spec/0.1/events.md');
    return;
  }

  const registry = parseRegistry(registryContent);
  if (!registry.size) {
    errors.push('spec/0.1/events.md contains no Core event registry rows');
    return;
  }

  const eventSchema = schemaDocuments.get('hook-event');
  const responseSchema = schemaDocuments.get('hook-response');
  const schemaNames = eventSchema?.$defs?.CoreEventName?.enum;
  if (!Array.isArray(schemaNames)) {
    errors.push('schemas/hook-event.schema.json must define $defs.CoreEventName.enum');
    return;
  }

  const registryNames = new Set(registry.keys());
  const canonicalNames = new Set(schemaNames);
  const registryDifference = describeSetDifference(
    canonicalNames,
    registryNames,
    'schema',
    'registry',
  );
  if (registryDifference) {
    errors.push(`spec/0.1/events.md registry events differ from schemas/hook-event.schema.json $defs.CoreEventName (${registryDifference})`);
  }

  const responseNames = responseEventNames(responseSchema);
  if (!Array.isArray(responseNames)) {
    errors.push('schemas/hook-response.schema.json must enumerate Core names in $defs.EventName');
  } else {
    const responseDifference = describeSetDifference(
      canonicalNames,
      new Set(responseNames),
      'event schema',
      'response schema',
    );
    if (responseDifference) {
      errors.push(`schemas/hook-response.schema.json event names differ from schemas/hook-event.schema.json (${responseDifference})`);
    }
  }

  const counts = {
    Core: registry.size,
    Gate: [...registry.values()].filter((classification) => classification === 'Gate').length,
    Observe: [...registry.values()].filter((classification) => classification === 'Observe').length,
  };
  const gateNames = new Set(
    [...registry].filter(([, classification]) => classification === 'Gate').map(([name]) => name),
  );
  const gateMirrors = [
    [path.join(root, 'spec', '0.1', 'core.md'), 'Core Gate'],
    [path.join(root, 'website', 'docs', 'responses.md'), 'Gate'],
  ];
  for (const [file, header] of gateMirrors) {
    const content = await readOptional(file);
    if (content === null) continue;
    const mirroredNames = parseGateTable(content, header);
    if (mirroredNames === null) continue;
    const missing = difference(gateNames, mirroredNames);
    const extra = difference(mirroredNames, gateNames);
    if (missing.length || extra.length) {
      const details = [
        missing.length ? `missing from table: ${missing.join(', ')}` : '',
        extra.length ? `non-Gate in table: ${extra.join(', ')}` : '',
      ].filter(Boolean).join('; ');
      errors.push(`${path.relative(root, file)} ${header} table differs from the event registry (${details})`);
    }
  }
  const summaryFiles = [
    path.join(root, 'spec', '0.1', 'index.md'),
    path.join(root, 'website', 'docs', 'intro.md'),
    path.join(root, 'website', 'docs', 'capabilities.md'),
  ];
  const countPattern = /\b(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(Core|Gate|Observe)\s+events?\b/gi;
  for (const file of summaryFiles) {
    const content = await readOptional(file);
    if (content === null) continue;
    const plainContent = content.replace(/[*_`]/g, '');
    for (const match of plainContent.matchAll(countPattern)) {
      const stated = parseCount(match[1]);
      const category = `${match[2][0].toUpperCase()}${match[2].slice(1).toLowerCase()}`;
      if (stated !== counts[category]) {
        errors.push(`${path.relative(root, file)} states ${stated} ${category} events; registry defines ${counts[category]}`);
      }
    }
  }
}

async function validateSchemasAndFixtures() {
  const schemaFiles = await filesUnder(schemaDirectory, (file) => file.endsWith('.schema.json'));
  const schemas = new Map();
  const schemaDocuments = new Map();
  const ajv = new Ajv2020({ allErrors: true, strict: false });

  await validatePublishedSchemaCopies(schemaFiles);

  for (const file of schemaFiles) {
    const schema = await readJson(file);
    if (!schema) continue;
    const label = path.relative(root, file);
    schemaDocuments.set(path.basename(file, '.schema.json'), schema);
    if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') errors.push(`${label} must declare JSON Schema Draft 2020-12`);
    if (typeof schema.$id !== 'string' || !schema.$id) errors.push(`${label} must declare a stable $id`);
    if (typeof schema.title !== 'string' || !schema.title) errors.push(`${label} must declare a title`);
    try {
      schemas.set(path.basename(file, '.schema.json'), ajv.compile(schema));
    } catch (error) {
      errors.push(`${label} is not a compilable schema: ${error.message}`);
    }
  }

  await validateRegistryAndSummaries(schemaDocuments);

  const eventSpec = schemaSpecIdentifier(schemaDocuments.get('hook-event'));
  const responseSpec = schemaSpecIdentifier(schemaDocuments.get('hook-response'));
  if (typeof eventSpec !== 'string' || !eventSpec) {
    errors.push('schemas/hook-event.schema.json must declare a spec const');
  }
  if (typeof responseSpec !== 'string' || !responseSpec) {
    errors.push('schemas/hook-response.schema.json must declare a spec const');
  } else if (eventSpec && responseSpec !== eventSpec) {
    errors.push(`schema spec identifiers differ: hook-event uses "${eventSpec}" and hook-response uses "${responseSpec}"`);
  }

  const fixtureNames = new Set((await readdir(fixtureDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name));
  for (const name of fixtureNames) {
    if (!schemas.has(name)) errors.push(`fixtures/${name} has no matching schemas/${name}.schema.json`);
  }

  for (const [name, validate] of schemas) {
    const base = path.join(fixtureDirectory, name);
    for (const expected of ['valid', 'invalid']) {
      try {
        const files = await filesUnder(path.join(base, expected), (file) => file.endsWith('.json'));
        for (const file of files) {
          const fixture = await readJson(file);
          if (fixture === null) continue;
          const passes = validate(fixture);
          if (passes !== (expected === 'valid')) {
            errors.push(`${path.relative(root, file)} should ${expected === 'valid' ? 'validate' : 'fail validation'} against ${name}.schema.json`);
          }
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }

  const markdownFiles = await filesUnder(root, (file) => file.endsWith('.md'));
  for (const file of markdownFiles) {
    const content = await readFile(file, 'utf8');
    const blocks = Array.from(content.matchAll(/```(?:json)\n([\s\S]*?)\n```/g));
    for (let i = 0; i < blocks.length; i++) {
      let parsed;
      try {
        parsed = JSON.parse(blocks[i][1]);
      } catch {
        continue;
      }
      const isObject = parsed && typeof parsed === 'object' && !Array.isArray(parsed);
      const isHookEnvelope = isObject
        && Object.hasOwn(parsed, 'spec')
        && (parsed.spec === eventSpec
          || Object.hasOwn(parsed, 'event_id')
          || Object.hasOwn(parsed, 'hook_event_name')
          || Object.hasOwn(parsed, 'hookSpecificOutput'));
      if (isHookEnvelope) {
        if (parsed.spec !== eventSpec) {
          errors.push(`${path.relative(root, file)} (JSON block ${i + 1}) uses spec ${JSON.stringify(parsed.spec)}; expected ${JSON.stringify(eventSpec)}`);
          continue;
        }
        const isEvent = Object.hasOwn(parsed, 'hook_event_name');
        const schemaName = isEvent ? 'hook-event' : 'hook-response';
        const validate = schemas.get(schemaName);
        if (validate && !validate(parsed)) {
          const details = ajv.errorsText(validate.errors, { separator: '; ' });
          errors.push(`${path.relative(root, file)} (JSON block ${i + 1}) failed validation against ${schemaName}.schema.json: ${details}`);
        }
      }
    }
  }
}

await validateMarkdownLinks();
await validateRfcs();
await validateSchemasAndFixtures();

if (errors.length) {
  console.error(`Validation failed:\n- ${errors.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Validation passed.');
}
