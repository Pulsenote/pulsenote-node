import { describe, expect, it } from 'vitest';
import type { Notification, NotificationList } from '../src/index.js';
import { createTestClient } from './helpers.js';

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n-1',
    recipient: 'greg@example.com',
    status: 'QUEUED',
    createdAt: '2026-07-28T10:00:00.000Z',
    updatedAt: '2026-07-28T10:00:00.000Z',
    ...overrides,
  };
}

function page(data: Notification[], meta: Partial<NotificationList['meta']> = {}): NotificationList {
  return {
    data,
    meta: { total: data.length, page: 1, limit: 20, pages: 1, ...meta },
  };
}

describe('notifications.send', () => {
  it('POSTs the payload to the send endpoint', async () => {
    const { client, requests } = createTestClient({
      status: 202,
      body: { id: 'n-1', status: 'QUEUED', from: 'noreply@acme.com' },
    });

    const result = await client.notifications.send({
      to: 'greg@example.com',
      from: 'noreply@acme.com',
      subject: 'Welcome',
      html: '<h1>Hi</h1>',
    });

    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.url.pathname).toBe('/api/v1/notifications/send');
    expect(requests[0]?.headers['content-type']).toBe('application/json');
    expect(requests[0]?.body).toEqual({
      to: 'greg@example.com',
      from: 'noreply@acme.com',
      subject: 'Welcome',
      html: '<h1>Hi</h1>',
    });
    expect(result).toEqual({ id: 'n-1', status: 'QUEUED', from: 'noreply@acme.com' });
  });

  it('omits undefined fields so the API\'s whitelist validation passes', async () => {
    const { client, requests } = createTestClient({ status: 202, body: {} });

    await client.notifications.send({
      to: 'greg@example.com',
      templateSlug: 'welcome',
      locale: undefined,
      templateData: { name: 'Greg' },
    });

    expect(Object.keys(requests[0]?.body as object).sort()).toEqual([
      'templateData',
      'templateSlug',
      'to',
    ]);
  });
});

describe('notifications.retrieve', () => {
  it('GETs a single notification and encodes the id', async () => {
    const { client, requests } = createTestClient({ body: notification({ status: 'DELIVERED' }) });

    const result = await client.notifications.retrieve('id with/slash');

    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.url.pathname).toBe('/api/v1/notifications/id%20with%2Fslash');
    expect(result.status).toBe('DELIVERED');
  });

  it('rejects an empty id instead of hitting the collection endpoint', async () => {
    const { client, requests } = createTestClient();

    await expect(client.notifications.retrieve('')).rejects.toThrow(TypeError);
    expect(requests).toHaveLength(0);
  });
});

describe('notifications.list', () => {
  it('serialises filters into the query string', async () => {
    const { client, requests } = createTestClient({ body: page([]) });

    await client.notifications.list({ page: 2, limit: 50, status: 'BOUNCED' });

    const query = requests[0]!.url.searchParams;
    expect(query.get('page')).toBe('2');
    expect(query.get('limit')).toBe('50');
    expect(query.get('status')).toBe('BOUNCED');
  });

  it('omits filters that were not provided', async () => {
    const { client, requests } = createTestClient({ body: page([]) });

    await client.notifications.list();

    expect(requests[0]?.url.search).toBe('');
  });
});

describe('notifications.iterate', () => {
  it('walks every page', async () => {
    const pages = [
      page([notification({ id: 'n-1' }), notification({ id: 'n-2' })], { total: 3, pages: 2, limit: 2 }),
      page([notification({ id: 'n-3' })], { total: 3, page: 2, pages: 2, limit: 2 }),
    ];
    const { client, requests } = createTestClient((_req, attempt) => ({ body: pages[attempt] }));

    const ids: string[] = [];
    for await (const item of client.notifications.iterate({ limit: 2 })) ids.push(item.id);

    expect(ids).toEqual(['n-1', 'n-2', 'n-3']);
    expect(requests.map((r) => r.url.searchParams.get('page'))).toEqual(['1', '2']);
  });

  it('stops on an empty page even when meta.pages disagrees', async () => {
    const { client, requests } = createTestClient({ body: page([], { pages: 99 }) });

    const collected = await client.notifications.listAll();

    expect(collected).toEqual([]);
    expect(requests).toHaveLength(1);
  });

  it('starts from the requested page', async () => {
    const { client, requests } = createTestClient({
      body: page([notification()], { page: 3, pages: 3 }),
    });

    await client.notifications.listAll({ page: 3 });

    expect(requests[0]?.url.searchParams.get('page')).toBe('3');
  });
});

describe('notifications.stats', () => {
  it('GETs the stats endpoint', async () => {
    const { client, requests } = createTestClient({
      body: { total: 12, counts: { DELIVERED: 10, BOUNCED: 2 }, thisMonth: 12, daily: [] },
    });

    const stats = await client.notifications.stats();

    expect(requests[0]?.url.pathname).toBe('/api/v1/notifications/stats');
    expect(stats.counts.DELIVERED).toBe(10);
  });
});
