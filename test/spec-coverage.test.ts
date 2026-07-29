/**
 * Drift guard.
 *
 * Every operation in the committed OpenAPI spec must be reachable through a
 * resource method, and every method must hit the exact path and verb the spec
 * declares. When `npm run generate` pulls in a new endpoint, this test fails
 * until somebody wires it up by hand.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Pulsenote } from '../src/index.js';
import { createTestClient, type MockResponseInit } from './helpers.js';

const SPEC_PATH = fileURLToPath(new URL('../openapi/pulsenote-public-api.json', import.meta.url));

interface SpecOperation {
  operationId: string;
  method: string;
  path: string;
}

const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8')) as {
  paths: Record<string, Record<string, { operationId?: string }>>;
};

const specOperations: SpecOperation[] = Object.entries(spec.paths).flatMap(([path, methods]) =>
  Object.entries(methods)
    .filter(([method]) => method !== 'parameters')
    .map(([method, operation]) => ({
      operationId: operation.operationId ?? `${method} ${path}`,
      method: method.toUpperCase(),
      path,
    })),
);

const ID = 'abc-123';
const SLUG = 'welcome';

interface Case {
  operationId: string;
  run: (client: Pulsenote) => Promise<unknown>;
  response?: MockResponseInit;
}

const CASES: Case[] = [
  {
    operationId: 'sendNotification',
    run: (c) => c.notifications.send({ to: 'greg@example.com', html: '<b>hi</b>' }),
    response: { status: 202, body: {} },
  },
  { operationId: 'listNotifications', run: (c) => c.notifications.list() },
  { operationId: 'getNotification', run: (c) => c.notifications.retrieve(ID) },
  { operationId: 'getNotificationStats', run: (c) => c.notifications.stats() },

  { operationId: 'listTemplates', run: (c) => c.templates.list() },
  { operationId: 'getTemplate', run: (c) => c.templates.retrieve(ID) },
  { operationId: 'listTemplateLocales', run: (c) => c.templates.listLocales(SLUG) },
  {
    operationId: 'createTemplate',
    run: (c) => c.templates.create({ name: 'Welcome', slug: SLUG, body: '<b>hi</b>' }),
    response: { status: 201, body: {} },
  },
  {
    operationId: 'updateTemplate',
    run: (c) => c.templates.update(ID, { name: 'Welcome', slug: SLUG, body: '<b>hi</b>' }),
  },
  { operationId: 'deleteTemplate', run: (c) => c.templates.delete(ID) },
  { operationId: 'renderTemplate', run: (c) => c.templates.render(ID) },

  { operationId: 'listDomains', run: (c) => c.domains.list() },
  {
    operationId: 'addDomain',
    run: (c) => c.domains.add({ domain: 'mail.acme.com' }),
    response: { status: 201, body: {} },
  },
  { operationId: 'getDomainDnsRecords', run: (c) => c.domains.dnsRecords(ID) },
  { operationId: 'getDomainZoneFile', run: (c) => c.domains.zoneFile(ID), response: { body: '$TTL 300' } },
  { operationId: 'verifyDomain', run: (c) => c.domains.verify(ID), response: { status: 201, body: {} } },
  { operationId: 'deleteDomain', run: (c) => c.domains.delete(ID) },
];

describe('OpenAPI coverage', () => {
  it('covers every operation in the spec', () => {
    const covered = new Set(CASES.map((c) => c.operationId));
    const missing = specOperations.map((o) => o.operationId).filter((id) => !covered.has(id));

    expect(missing, 'operations in the spec with no SDK method').toEqual([]);
  });

  it('has no cases for operations the spec dropped', () => {
    const known = new Set(specOperations.map((o) => o.operationId));
    const stale = CASES.map((c) => c.operationId).filter((id) => !known.has(id));

    expect(stale, 'SDK methods pointing at operations the API no longer exposes').toEqual([]);
  });

  for (const testCase of CASES) {
    it(`${testCase.operationId} hits the path the spec declares`, async () => {
      const operation = specOperations.find((o) => o.operationId === testCase.operationId);
      expect(operation, `operation ${testCase.operationId} is missing from the spec`).toBeDefined();

      const { client, requests } = createTestClient(testCase.response ?? { body: {} });
      await testCase.run(client);

      const expectedPath = operation!.path.replace('{id}', ID).replace('{slug}', SLUG);

      expect(requests).toHaveLength(1);
      expect(requests[0]?.method).toBe(operation!.method);
      expect(requests[0]?.url.pathname).toBe(expectedPath);
    });
  }
});
