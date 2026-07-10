#!/usr/bin/env node
/**
 * Regenerate the SDK from the Pulsenote OpenAPI spec.
 *
 *   node scripts/generate.mjs
 *
 * Steps:
 *   1. Load the spec (SPEC_URL env, or the committed openapi/pulsenote-api.json).
 *   2. Filter to the data-plane surface (operations authenticated with X-API-Key).
 *   3. Run openapi-typescript-codegen into ./src.
 *
 * Hand-written files (client.ts, main.ts) are NOT touched by the generator.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const specPath = join(root, 'openapi', 'pulsenote-api.json');
const SPEC_URL = process.env.SPEC_URL;

async function loadSpec() {
  if (SPEC_URL) {
    const res = await fetch(SPEC_URL);
    if (!res.ok) throw new Error(`Failed to fetch spec: ${res.status} ${SPEC_URL}`);
    return res.json();
  }
  return JSON.parse(readFileSync(specPath, 'utf8'));
}

function filterDataPlane(spec) {
  const out = {
    openapi: spec.openapi,
    info: { title: 'Pulsenote API', description: spec.info?.description, version: spec.info?.version, contact: {} },
    servers: spec.servers,
    tags: (spec.tags || []).filter((t) => ['Notifications', 'Templates', 'Domains'].includes(t.name)),
    paths: {},
    components: { securitySchemes: { 'api-key': spec.components.securitySchemes['api-key'] }, schemas: {} },
  };
  for (const [p, methods] of Object.entries(spec.paths)) {
    for (const [m, op] of Object.entries(methods)) {
      if (JSON.stringify(op.security || '').includes('api-key')) {
        (out.paths[p] ??= {})[m] = op;
      }
    }
  }
  const need = new Set();
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    for (const [k, v] of Object.entries(o)) {
      if (k === '$ref' && typeof v === 'string' && v.startsWith('#/components/schemas/')) {
        const name = v.split('/').pop();
        if (!need.has(name)) { need.add(name); walk(spec.components.schemas[name]); }
      } else walk(v);
    }
  };
  walk(out.paths);
  for (const name of [...need].sort()) out.components.schemas[name] = spec.components.schemas[name];
  return out;
}

const spec = filterDataPlane(await loadSpec());
mkdirSync(dirname(specPath), { recursive: true });
writeFileSync(specPath, JSON.stringify(spec, null, 2) + '\n');
console.log(`Spec: ${Object.keys(spec.paths).length} paths, ${Object.keys(spec.components.schemas).length} schemas`);

execSync(
  `npx openapi --input "${specPath}" --output "${join(root, 'src')}" --name PulsenoteCore --client fetch`,
  { cwd: root, stdio: 'inherit' },
);
console.log('SDK generated into ./src');
