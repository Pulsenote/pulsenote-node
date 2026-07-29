import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_BASE_URL, Pulsenote, VERSION } from '../src/index.js';
import { createMockFetch, createTestClient } from './helpers.js';

describe('Pulsenote', () => {
  const originalKey = process.env.PULSENOTE_API_KEY;
  const originalBase = process.env.PULSENOTE_BASE_URL;

  afterEach(() => {
    restore('PULSENOTE_API_KEY', originalKey);
    restore('PULSENOTE_BASE_URL', originalBase);
  });

  it('exposes the three data-plane resources', () => {
    const { client } = createTestClient();

    expect(client.notifications).toBeDefined();
    expect(client.templates).toBeDefined();
    expect(client.domains).toBeDefined();
  });

  it('requires an API key', () => {
    delete process.env.PULSENOTE_API_KEY;

    expect(() => new Pulsenote({ fetch: createMockFetch().fetch })).toThrow(/apiKey.*required/i);
  });

  it('falls back to PULSENOTE_API_KEY', async () => {
    process.env.PULSENOTE_API_KEY = 'pk_test_from_env';
    const { fetch, requests } = createMockFetch({ body: [] });

    await new Pulsenote({ fetch }).templates.list();

    expect(requests[0]?.headers['x-api-key']).toBe('pk_test_from_env');
  });

  it('defaults to the production base URL', () => {
    delete process.env.PULSENOTE_BASE_URL;
    const { client } = createTestClient();

    expect(client.baseUrl).toBe(DEFAULT_BASE_URL);
    expect(DEFAULT_BASE_URL).toBe('https://api.pulsenote.eu');
  });

  it('prefers an explicit baseUrl over the environment', async () => {
    process.env.PULSENOTE_BASE_URL = 'https://from-env.test';
    const { client, requests } = createTestClient({ body: [] }, { baseUrl: 'https://explicit.test' });

    await client.templates.list();

    expect(requests[0]?.url.origin).toBe('https://explicit.test');
  });

  it('reads PULSENOTE_BASE_URL when no baseUrl is given', async () => {
    process.env.PULSENOTE_BASE_URL = 'https://staging.test';
    const { fetch, requests } = createMockFetch({ body: [] });

    await new Pulsenote({ apiKey: 'k', fetch }).templates.list();

    expect(requests[0]?.url.origin).toBe('https://staging.test');
  });

  it('keeps a path prefix in the base URL', async () => {
    const { client, requests } = createTestClient({ body: [] }, { baseUrl: 'https://gw.test/pulsenote' });

    await client.templates.list();

    expect(requests[0]?.url.pathname).toBe('/pulsenote/api/v1/templates');
  });

  it('sends auth, accept and user-agent headers', async () => {
    const { client, requests } = createTestClient({ body: [] }, { userAgentSuffix: 'acme/2.1' });

    await client.templates.list();

    const headers = requests[0]!.headers;
    expect(headers['x-api-key']).toBe('pk_test_key');
    expect(headers['accept']).toBe('application/json');
    expect(headers['user-agent']).toContain(`pulsenote-node/${VERSION}`);
    expect(headers['user-agent']).toContain('acme/2.1');
  });

  it('merges custom headers, per-call over per-client', async () => {
    const { client, requests } = createTestClient(
      { body: [] },
      { headers: { 'X-Tenant': 'acme', 'X-Trace': 'client' } },
    );

    await client.templates.list({}, { headers: { 'X-Trace': 'call' } });

    expect(requests[0]?.headers['x-tenant']).toBe('acme');
    expect(requests[0]?.headers['x-trace']).toBe('call');
  });

  it('rejects a fetch implementation that is not callable', () => {
    expect(() => new Pulsenote({ apiKey: 'k', fetch: {} as never })).toThrow(/fetch/i);
  });

  it('exposes an escape hatch for uncovered endpoints', async () => {
    const { client, requests } = createTestClient({ body: { ok: true }, headers: { 'x-ratelimit-limit-minute': '100' } });

    const response = await client.rawRequest<{ ok: boolean }>({ method: 'GET', path: '/api/v1/health' });

    expect(response.data).toEqual({ ok: true });
    expect(response.status).toBe(200);
    expect(response.rateLimit.limitPerMinute).toBe(100);
    expect(requests[0]?.url.pathname).toBe('/api/v1/health');
  });
});

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
