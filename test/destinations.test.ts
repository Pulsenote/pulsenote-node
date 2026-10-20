import { describe, expect, it } from 'vitest';
import type { Destination } from '../src/index.js';
import { ConflictError, ServerError, UnprocessableEntityError } from '../src/index.js';
import { createTestClient } from './helpers.js';

const destination: Destination = {
  id: 'd-1',
  type: 'slack',
  name: 'ops-alerts',
  displayHint: 'Acme · #ops-alerts',
  brokenAt: null,
  brokenReason: null,
  lastDeliveredAt: null,
  createdAt: '2026-10-20T10:00:00.000Z',
};

describe('destinations', () => {
  it('registers Slack through your own app with a token and channel', async () => {
    const { client, requests } = createTestClient({ status: 201, body: destination });

    const result = await client.destinations.create({
      type: 'slack',
      name: 'ops-alerts',
      token: 'xoxb-123',
      channel: '#ops-alerts',
    });

    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.url.pathname).toBe('/api/v1/destinations');
    expect(requests[0]?.body).toEqual({
      type: 'slack',
      name: 'ops-alerts',
      token: 'xoxb-123',
      channel: '#ops-alerts',
    });
    expect(result.displayHint).toBe('Acme · #ops-alerts');
  });

  it('hands back the signing secret of a webhook destination', async () => {
    const { client } = createTestClient({
      status: 201,
      body: { ...destination, type: 'webhook', signingSecret: 'whsec_abc' },
    });

    const result = await client.destinations.create({
      type: 'webhook',
      name: 'orders',
      url: 'https://example.com/hook',
    });

    expect(result.signingSecret).toBe('whsec_abc');
  });

  it('surfaces a duplicate name as a ConflictError', async () => {
    const { client } = createTestClient({ status: 409, body: { message: 'exists' } });

    await expect(
      client.destinations.create({ type: 'discord', name: 'ops', url: 'https://discord.com/api/webhooks/1/a' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('escapes the id in the path', async () => {
    const { client, requests } = createTestClient({ body: { status: 'sent' } });

    await client.destinations.test('a/b');

    expect(requests[0]?.url.pathname).toBe('/api/v1/destinations/a%2Fb/test');
  });
});

describe('messages', () => {
  it('sends to a destination by name', async () => {
    const { client, requests } = createTestClient({
      status: 202,
      body: { id: 'n-1', status: 'QUEUED', channel: 'slack' },
    });

    const result = await client.messages.send({ to: 'ops-alerts', title: 'New order', text: '€240' });

    expect(requests[0]?.url.pathname).toBe('/api/v1/messages');
    expect(requests[0]?.body).toEqual({ to: 'ops-alerts', title: 'New order', text: '€240' });
    expect(result).toEqual({ id: 'n-1', status: 'QUEUED', channel: 'slack' });
  });

  // No idempotency keys: a retried send would post the message twice.
  it('does not retry a failed send on its own', async () => {
    const { client, requests } = createTestClient([{ status: 503, body: {} }, { status: 202, body: {} }]);

    await expect(client.messages.send({ to: 'ops', text: 'x' })).rejects.toBeInstanceOf(ServerError);
    expect(requests).toHaveLength(1);
  });

  it('reports a destination that stopped accepting messages', async () => {
    const { client } = createTestClient({ status: 422, body: { message: 'not_in_channel' } });

    await expect(client.messages.send({ to: 'ops', text: 'x' })).rejects.toBeInstanceOf(
      UnprocessableEntityError,
    );
  });
});
