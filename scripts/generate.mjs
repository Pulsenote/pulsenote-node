#!/usr/bin/env node
/**
 * Refresh the committed OpenAPI spec and regenerate the schema types.
 *
 *   npm run generate
 *   SPEC_URL=https://api.pulsenote.eu/api-json npm run generate
 *   SKIP_SPEC_FETCH=1 npm run generate
 *
 * Steps:
 *   1. Fetch the public spec from SPEC_URL (or reuse the committed copy).
 *   2. Write it to openapi/pulsenote-public-api.json *verbatim*, so `git diff`
 *      in the regeneration PR shows exactly what the API changed.
 *   3. Run `openapi-typescript` into src/generated/schema.d.ts.
 *
 * Only src/generated/ is machine-written. Everything else in src/ is hand-written
 * and must be updated by a human when the spec grows a new operation —
 * test/spec-coverage.test.ts fails until that happens.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const specPath = join(root, 'openapi', 'pulsenote-public-api.json');
const outPath = join(root, 'src', 'generated', 'schema.d.ts');

const SPEC_URL = process.env.SPEC_URL;
/**
 * The landing site publishes the public spec artifact, and it needs no auth —
 * `Pulsenote/pulsenote` is private, so raw.githubusercontent 404s without a
 * token. Its CI copies openapi/pulsenote-public-api.json here on every change.
 */
const DEFAULT_SPEC_URL = 'https://pulsenote.eu/openapi.json';

async function refreshSpec() {
  if (process.env.SKIP_SPEC_FETCH === '1') {
    console.log('SKIP_SPEC_FETCH=1 — using the committed spec as-is.');
    return JSON.parse(readFileSync(specPath, 'utf8'));
  }

  const url = SPEC_URL ?? DEFAULT_SPEC_URL;
  console.log(`Fetching spec from ${url}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch spec: ${res.status} ${res.statusText} (${url})`);

  const text = await res.text();
  const spec = JSON.parse(text);

  if (!spec.paths || !spec.components?.schemas) {
    throw new Error('Fetched document does not look like an OpenAPI spec (no paths/components.schemas).');
  }

  mkdirSync(dirname(specPath), { recursive: true });
  writeFileSync(specPath, text.endsWith('\n') ? text : `${text}\n`);
  return spec;
}

const spec = await refreshSpec();

const operationIds = Object.values(spec.paths)
  .flatMap((methods) => Object.values(methods))
  .map((op) => op?.operationId)
  .filter(Boolean);

console.log(
  `Spec: ${Object.keys(spec.paths).length} paths, ${operationIds.length} operations, ` +
    `${Object.keys(spec.components.schemas).length} schemas (version ${spec.info?.version})`,
);

mkdirSync(dirname(outPath), { recursive: true });
// --default-non-nullable=false: openapi-typescript otherwise treats a property
// carrying a `default` as always present, even when the schema's `required`
// list omits it. These are CLIENT types — for a request body, a documented
// default is precisely the signal that the caller MAY leave it out, so
// non-optional is the wrong shape. Today this changes exactly one property
// (AddSuppressionDto.stream) and nothing else in the spec has a default.
//
// It would be the wrong call for a response type, where a default does mean
// the server always sends the field. Revisit if a response schema ever grows
// one: the fix then is per-schema, not this flag.
execFileSync(
  'npx',
  [
    'openapi-typescript',
    specPath,
    '--output',
    outPath,
    '--alphabetize',
    '--default-non-nullable',
    'false',
  ],
  {
  cwd: root,
  stdio: 'inherit',
});

console.log(`Types written to ${outPath}`);
console.log('Now run `npm run typecheck && npm test` — spec-coverage.test.ts flags uncovered operations.');
