import { describe, expect, it } from 'vitest';
import type { Domain } from '../src/index.js';
import { ConflictError } from '../src/index.js';
import { createTestClient } from './helpers.js';

const domain: Domain = {
  id: 'd-1',
  domain: 'mail.acme.com',
  status: 'PENDING',
  spfVerified: false,
  dkimVerified: false,
  dmarcVerified: false,
  isDefault: true,
  createdAt: '2026-07-28T10:00:00.000Z',
  updatedAt: '2026-07-28T10:00:00.000Z',
};

describe('domains', () => {
  it('lists sender domains', async () => {
    const { client, requests } = createTestClient({ body: [domain] });

    const result = await client.domains.list();

    expect(requests[0]?.url.pathname).toBe('/api/v1/domains');
    expect(result[0]?.domain).toBe('mail.acme.com');
  });

  it('adds a domain and returns the DNS records to publish', async () => {
    const { client, requests } = createTestClient({
      status: 201,
      body: {
        ...domain,
        dnsRecords: [
          { type: 'TXT', name: '_amazonses.mail.acme.com', value: 'token', purpose: 'Domain ownership' },
        ],
      },
    });

    const result = await client.domains.add({ domain: 'mail.acme.com', fromEmail: 'noreply@mail.acme.com' });

    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.body).toEqual({ domain: 'mail.acme.com', fromEmail: 'noreply@mail.acme.com' });
    expect(result.dnsRecords?.[0]?.type).toBe('TXT');
  });

  it('maps a duplicate domain to ConflictError', async () => {
    const { client } = createTestClient({
      status: 409,
      body: { statusCode: 409, message: 'Domain already registered', error: 'Conflict' },
    });

    await expect(client.domains.add({ domain: 'mail.acme.com' })).rejects.toBeInstanceOf(ConflictError);
  });

  it('fetches the DNS records with verification state', async () => {
    const { client, requests } = createTestClient({
      body: {
        domain: 'mail.acme.com',
        status: 'VERIFYING',
        records: [],
        spfVerified: true,
        dkimVerified: false,
        dmarcVerified: false,
      },
    });

    const result = await client.domains.dnsRecords('d-1');

    expect(requests[0]?.url.pathname).toBe('/api/v1/domains/d-1/dns-records');
    expect(result.spfVerified).toBe(true);
  });

  it('returns the zone file as plain text', async () => {
    const zone = '$TTL 300\n@ IN TXT "token"\n';
    const { client, requests } = createTestClient({ body: zone });

    const result = await client.domains.zoneFile('d-1');

    expect(requests[0]?.url.pathname).toBe('/api/v1/domains/d-1/zone-file');
    expect(requests[0]?.headers['accept']).toBe('text/plain');
    expect(result).toBe(zone);
  });

  it('triggers verification', async () => {
    const { client, requests } = createTestClient({ status: 201, body: { ...domain, status: 'VERIFIED' } });

    const result = await client.domains.verify('d-1');

    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.url.pathname).toBe('/api/v1/domains/d-1/verify');
    expect(result.status).toBe('VERIFIED');
  });

  it('deletes a domain', async () => {
    const { client, requests } = createTestClient({ body: { deleted: true } });

    const result = await client.domains.delete('d-1');

    expect(requests[0]?.method).toBe('DELETE');
    expect(result.deleted).toBe(true);
  });
});
