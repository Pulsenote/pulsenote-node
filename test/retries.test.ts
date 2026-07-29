import { describe, expect, it } from 'vitest';
import { ConnectionError, RateLimitError, ServerError, TimeoutError } from '../src/index.js';
import { createTestClient } from './helpers.js';

describe('retry policy', () => {
  it('replays a GET on 500 and returns the eventual success', async () => {
    const { client, requests } = createTestClient([
      { status: 500, body: { message: 'boom' } },
      { status: 500, body: { message: 'boom' } },
      { body: { id: 'n-1', recipient: 'a@b.c', status: 'DELIVERED', createdAt: '', updatedAt: '' } },
    ]);

    const result = await client.notifications.retrieve('n-1');

    expect(requests).toHaveLength(3);
    expect(result.status).toBe('DELIVERED');
  });

  it('gives up after maxRetries and throws the last error', async () => {
    const { client, requests } = createTestClient({ status: 503, body: { message: 'unavailable' } }, {
      maxRetries: 2,
    });

    await expect(client.notifications.retrieve('n-1')).rejects.toBeInstanceOf(ServerError);
    expect(requests).toHaveLength(3); // 1 attempt + 2 retries
  });

  it('replays a GET after a connection failure', async () => {
    const { client, requests } = createTestClient([
      { error: new TypeError('fetch failed') },
      { body: [] },
    ]);

    await client.templates.list();

    expect(requests).toHaveLength(2);
  });

  it('replays a GET after a timeout', async () => {
    const { client, requests } = createTestClient([{ hang: true }, { body: [] }], { timeout: 25 });

    await client.templates.list();

    expect(requests).toHaveLength(2);
  });

  it('never replays a send on 500 — a retried email would be delivered twice', async () => {
    const { client, requests } = createTestClient({ status: 500, body: { message: 'boom' } });

    await expect(
      client.notifications.send({ to: 'greg@example.com', html: '<b>hi</b>' }),
    ).rejects.toBeInstanceOf(ServerError);
    expect(requests).toHaveLength(1);
  });

  it('never replays a send after a timeout', async () => {
    const { client, requests } = createTestClient({ hang: true }, { timeout: 25 });

    await expect(
      client.notifications.send({ to: 'greg@example.com', html: '<b>hi</b>' }),
    ).rejects.toBeInstanceOf(TimeoutError);
    expect(requests).toHaveLength(1);
  });

  it('does replay a send on 429 — the guard rejected it before any work happened', async () => {
    const { client, requests } = createTestClient([
      { status: 429, body: { message: 'Rate limit exceeded', retryAfter: 0 } },
      { status: 202, body: { id: 'n-1', status: 'QUEUED', from: 'noreply@acme.com' } },
    ]);

    const result = await client.notifications.send({ to: 'greg@example.com', html: '<b>hi</b>' });

    expect(requests).toHaveLength(2);
    expect(result.id).toBe('n-1');
  });

  it('replays the read-only POST endpoints', async () => {
    const { client, requests } = createTestClient([{ status: 500, body: {} }, { body: { html: 'ok' } }]);

    await client.templates.render('t-1');

    expect(requests).toHaveLength(2);
  });

  it('replays domain verification', async () => {
    const { client, requests } = createTestClient([{ status: 502, body: {} }, { body: { id: 'd-1' } }]);

    await client.domains.verify('d-1');

    expect(requests).toHaveLength(2);
  });

  it('does not replay statuses outside the retryable set', async () => {
    const { client, requests } = createTestClient({ status: 404, body: { message: 'Not found' } });

    await expect(client.notifications.retrieve('n-1')).rejects.toThrow();
    expect(requests).toHaveLength(1);
  });

  it('honours Retry-After when it is short enough', async () => {
    const { client, requests } = createTestClient([
      { status: 429, body: {}, headers: { 'retry-after': '0' } },
      { body: [] },
    ]);

    await client.templates.list();

    expect(requests).toHaveLength(2);
  });

  it('hands back the error when Retry-After exceeds maxRetryAfter', async () => {
    const { client, requests } = createTestClient(
      { status: 429, body: {}, headers: { 'retry-after': '120' } },
      { maxRetryAfter: 5_000 },
    );

    const error = (await client.templates.list().catch((e: unknown) => e)) as RateLimitError;

    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.retryAfter).toBe(120);
    expect(requests).toHaveLength(1);
  });

  it('respects a per-call retry budget', async () => {
    const { client, requests } = createTestClient({ status: 500, body: {} }, { maxRetries: 5 });

    await expect(client.templates.list({}, { maxRetries: 0 })).rejects.toBeInstanceOf(ServerError);
    expect(requests).toHaveLength(1);
  });

  it('stops replaying once the caller aborts', async () => {
    const controller = new AbortController();
    const { client, requests } = createTestClient(() => {
      controller.abort();
      throw new TypeError('fetch failed');
    });

    await expect(client.templates.list({}, { signal: controller.signal })).rejects.toThrow();
    expect(requests).toHaveLength(1);
  });

  it('reports retries to the logger', async () => {
    const warnings: string[] = [];
    const { client } = createTestClient([{ status: 500, body: {} }, { body: [] }], {
      logger: { warn: (message) => warnings.push(message) },
    });

    await client.templates.list();

    expect(warnings).toEqual(['pulsenote: retrying after error response']);
  });

  it('does not classify a caller abort as a ConnectionError', async () => {
    const controller = new AbortController();
    const { client } = createTestClient({ hang: true });

    const promise = client.templates.list({}, { signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.not.toBeInstanceOf(ConnectionError);
  });
});
