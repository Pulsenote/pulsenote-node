import { describe, expect, it } from 'vitest';
import {
  AuthenticationError,
  BadRequestError,
  ConflictError,
  ConnectionError,
  NotFoundError,
  PermissionDeniedError,
  PulsenoteError,
  RateLimitError,
  ServerError,
  TimeoutError,
  UnprocessableEntityError,
} from '../src/index.js';
import { createTestClient } from './helpers.js';

describe('status mapping', () => {
  const cases: Array<[number, new (...args: never[]) => PulsenoteError]> = [
    [400, BadRequestError],
    [401, AuthenticationError],
    [403, PermissionDeniedError],
    [404, NotFoundError],
    [409, ConflictError],
    [422, UnprocessableEntityError],
    [429, RateLimitError],
    [500, ServerError],
    [503, ServerError],
  ];

  for (const [status, expected] of cases) {
    it(`maps ${status} to ${expected.name}`, async () => {
      const { client } = createTestClient({ status, body: { statusCode: status, message: 'nope' } }, { maxRetries: 0 });

      const error = await client.notifications.retrieve('n-1').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(expected);
      expect((error as PulsenoteError).status).toBe(status);
      expect((error as PulsenoteError).message).toBe('nope');
      expect((error as PulsenoteError).name).toBe(expected.name);
    });
  }

  it('falls back to the base error for unmapped statuses', async () => {
    const { client } = createTestClient({ status: 418, body: {} }, { maxRetries: 0 });

    const error = await client.notifications.retrieve('n-1').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PulsenoteError);
    expect((error as PulsenoteError).message).toBe('Request failed with status 418');
  });
});

describe('message extraction', () => {
  it('joins class-validator message arrays', async () => {
    const { client } = createTestClient(
      {
        status: 400,
        body: { statusCode: 400, message: ['to must be an email', 'property foo should not exist'], error: 'Bad Request' },
      },
      { maxRetries: 0 },
    );

    const error = (await client.notifications
      .send({ to: 'x', html: '<b>hi</b>' })
      .catch((e: unknown) => e)) as BadRequestError;

    expect(error.message).toBe('to must be an email; property foo should not exist');
    expect(error.validationErrors).toEqual(['to must be an email', 'property foo should not exist']);
  });

  it('keeps a non-JSON error body as the message', async () => {
    const { client } = createTestClient(
      { status: 502, body: 'Bad Gateway', headers: { 'content-type': 'text/html' } },
      { maxRetries: 0 },
    );

    const error = (await client.notifications.retrieve('n-1').catch((e: unknown) => e)) as PulsenoteError;

    expect(error.message).toBe('Bad Gateway');
    expect(error.body).toBe('Bad Gateway');
  });

  it('survives a malformed JSON body', async () => {
    const { client } = createTestClient({ status: 500, body: '{not json' }, { maxRetries: 0 });

    const error = (await client.notifications.retrieve('n-1').catch((e: unknown) => e)) as PulsenoteError;

    expect(error).toBeInstanceOf(ServerError);
    expect(error.status).toBe(500);
  });
});

describe('rate limits', () => {
  it('parses retryAfter from the body and quota from the headers', async () => {
    const { client } = createTestClient(
      {
        status: 429,
        body: { statusCode: 429, message: 'Rate limit exceeded. Maximum 100 requests per minute.', retryAfter: 42 },
        headers: {
          'x-ratelimit-limit-minute': '100',
          'x-ratelimit-remaining-minute': '0',
          'x-ratelimit-limit-hour': '1000',
          'x-ratelimit-remaining-hour': '250',
        },
      },
      { maxRetries: 0 },
    );

    const error = (await client.notifications.retrieve('n-1').catch((e: unknown) => e)) as RateLimitError;

    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.retryAfter).toBe(42);
    expect(error.rateLimit).toEqual({
      limitPerMinute: 100,
      remainingPerMinute: 0,
      limitPerHour: 1000,
      remainingPerHour: 250,
    });
  });

  it('prefers the Retry-After header over the body', async () => {
    const { client } = createTestClient(
      { status: 429, body: { retryAfter: 42 }, headers: { 'retry-after': '7' } },
      { maxRetries: 0 },
    );

    const error = (await client.notifications.retrieve('n-1').catch((e: unknown) => e)) as RateLimitError;

    expect(error.retryAfter).toBe(7);
  });

  it('surfaces rate-limit quota on successful responses too', async () => {
    const { client } = createTestClient({
      body: [],
      headers: { 'x-ratelimit-remaining-minute': '97' },
    });

    const response = await client.rawRequest({ method: 'GET', path: '/api/v1/templates' });

    expect(response.rateLimit.remainingPerMinute).toBe(97);
  });
});

describe('transport failures', () => {
  it('wraps network errors in ConnectionError', async () => {
    const { client } = createTestClient({ error: new TypeError('fetch failed') }, { maxRetries: 0 });

    const error = (await client.notifications.retrieve('n-1').catch((e: unknown) => e)) as ConnectionError;

    expect(error).toBeInstanceOf(ConnectionError);
    expect(error.message).toContain('fetch failed');
    expect(error.status).toBeUndefined();
    expect(error.cause).toBeInstanceOf(TypeError);
  });

  it('raises TimeoutError when the request outlives the timeout', async () => {
    const { client } = createTestClient({ hang: true }, { maxRetries: 0, timeout: 25 });

    const error = (await client.notifications.retrieve('n-1').catch((e: unknown) => e)) as TimeoutError;

    expect(error).toBeInstanceOf(TimeoutError);
    expect(error).toBeInstanceOf(ConnectionError);
    expect(error.message).toContain('timed out after 25ms');
  });

  it('propagates a caller abort verbatim', async () => {
    const controller = new AbortController();
    const { client } = createTestClient({ hang: true });

    const promise = client.notifications.retrieve('n-1', { signal: controller.signal });
    controller.abort();

    const error = (await promise.catch((e: unknown) => e)) as Error;
    expect(error).not.toBeInstanceOf(ConnectionError);
    expect(error.name).toBe('AbortError');
  });
});
