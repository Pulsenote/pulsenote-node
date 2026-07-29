/**
 * Error hierarchy.
 *
 * Every failed call rejects with a `PulsenoteError`. Catch the base class to
 * handle everything, or a subclass to branch on a specific failure mode:
 *
 * ```ts
 * try {
 *   await pulsenote.notifications.send({ to, subject, html });
 * } catch (err) {
 *   if (err instanceof RateLimitError) await sleep(err.retryAfter! * 1000);
 *   else if (err instanceof PulsenoteError) console.error(err.status, err.message);
 *   else throw err;
 * }
 * ```
 */

/** Rate-limit state parsed from the `X-RateLimit-*` response headers. */
export interface RateLimit {
  /** Requests allowed per minute for this tenant. */
  limitPerMinute?: number;
  /** Requests left in the current minute window. */
  remainingPerMinute?: number;
  /** Requests allowed per hour for this tenant. */
  limitPerHour?: number;
  /** Requests left in the current hour window. */
  remainingPerHour?: number;
}

/** The error envelope the API returns for non-2xx responses. */
export interface ApiErrorBody {
  statusCode?: number;
  /** A single message, or one entry per failed validation rule. */
  message?: string | string[];
  error?: string;
  /** Seconds to wait before retrying (429 responses). */
  retryAfter?: number;
}

export interface PulsenoteErrorOptions {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  cause?: unknown;
}

/** Base class for every error thrown by the SDK. */
export class PulsenoteError extends Error {
  /** HTTP status code, or `undefined` for transport-level failures. */
  readonly status: number | undefined;
  /** Parsed response body, when the server sent one. */
  readonly body: unknown;
  /** Response headers, lower-cased. */
  readonly headers: Record<string, string> | undefined;

  constructor(message: string, options: PulsenoteErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.status = options.status;
    this.body = options.body;
    this.headers = options.headers;
  }

  /** Build the most specific error subclass for an HTTP response. */
  static fromResponse(
    status: number,
    body: unknown,
    headers: Record<string, string> = {},
  ): PulsenoteError {
    const message = extractMessage(body, status);
    const options: PulsenoteErrorOptions = { status, body, headers };

    switch (status) {
      case 400:
        return new BadRequestError(message, options);
      case 401:
        return new AuthenticationError(message, options);
      case 403:
        return new PermissionDeniedError(message, options);
      case 404:
        return new NotFoundError(message, options);
      case 409:
        return new ConflictError(message, options);
      case 422:
        return new UnprocessableEntityError(message, options);
      case 429:
        return new RateLimitError(message, options);
      default:
        if (status >= 500) return new ServerError(message, options);
        return new PulsenoteError(message, options);
    }
  }
}

/**
 * 400 — the request body failed validation.
 *
 * The API validates with `forbidNonWhitelisted`, so unknown properties are
 * rejected as hard as missing ones. `validationErrors` holds one entry per
 * failed rule when the server sent a list.
 */
export class BadRequestError extends PulsenoteError {
  /** One entry per failed validation rule, empty when the server sent a single message. */
  readonly validationErrors: string[];

  constructor(message: string, options: PulsenoteErrorOptions = {}) {
    super(message, options);
    const raw = (options.body as ApiErrorBody | undefined)?.message;
    this.validationErrors = Array.isArray(raw) ? raw : [];
  }
}

/** 401 — missing, unknown or revoked API key. */
export class AuthenticationError extends PulsenoteError {}

/**
 * 403 — authenticated, but not allowed.
 *
 * Most commonly: the `from` address is outside your verified domains, or the
 * tenant has no verified sending domain at all.
 */
export class PermissionDeniedError extends PulsenoteError {}

/** 404 — the notification, template or domain does not exist for this tenant. */
export class NotFoundError extends PulsenoteError {}

/** 409 — the resource already exists (e.g. a domain registered twice). */
export class ConflictError extends PulsenoteError {}

/** 422 — semantically invalid request. */
export class UnprocessableEntityError extends PulsenoteError {}

/** 429 — per-minute or per-hour rate limit exceeded. */
export class RateLimitError extends PulsenoteError {
  /** Seconds to wait before the current window resets, when the API said so. */
  readonly retryAfter: number | undefined;
  /** Limits and remaining quota parsed from the response headers. */
  readonly rateLimit: RateLimit;

  constructor(message: string, options: PulsenoteErrorOptions = {}) {
    super(message, options);
    this.retryAfter = parseRetryAfter(options.headers ?? {}, options.body);
    this.rateLimit = parseRateLimit(options.headers ?? {});
  }
}

/** 5xx — the API failed to process an otherwise valid request. */
export class ServerError extends PulsenoteError {}

/** The request never produced a response (DNS failure, refused connection, socket reset). */
export class ConnectionError extends PulsenoteError {}

/** The request exceeded the configured timeout, or the caller's `AbortSignal` fired. */
export class TimeoutError extends ConnectionError {}

/* -------------------------------------------------------------------------- */
/* Parsing helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Collapse the API's error envelope into a single human-readable sentence. */
export function extractMessage(body: unknown, status: number): string {
  if (typeof body === 'string' && body.trim() !== '') return body;

  if (body && typeof body === 'object') {
    const { message, error } = body as ApiErrorBody;
    if (Array.isArray(message) && message.length > 0) return message.join('; ');
    if (typeof message === 'string' && message !== '') return message;
    if (typeof error === 'string' && error !== '') return error;
  }

  return `Request failed with status ${status}`;
}

/**
 * Read `Retry-After` (delay-seconds or HTTP-date) with a fallback to the
 * `retryAfter` field the rate-limit guard puts in the body. Returns seconds.
 */
export function parseRetryAfter(
  headers: Record<string, string>,
  body?: unknown,
  now: number = Date.now(),
): number | undefined {
  const header = headers['retry-after'];

  if (header !== undefined) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds;

    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - now) / 1000));
  }

  const fromBody = (body as ApiErrorBody | undefined)?.retryAfter;
  if (typeof fromBody === 'number' && Number.isFinite(fromBody) && fromBody >= 0) return fromBody;

  return undefined;
}

/** Pull the `X-RateLimit-*` headers the API sets on every authenticated response. */
export function parseRateLimit(headers: Record<string, string>): RateLimit {
  const num = (key: string): number | undefined => {
    const raw = headers[key];
    if (raw === undefined) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const rateLimit: RateLimit = {};
  const limitPerMinute = num('x-ratelimit-limit-minute');
  const remainingPerMinute = num('x-ratelimit-remaining-minute');
  const limitPerHour = num('x-ratelimit-limit-hour');
  const remainingPerHour = num('x-ratelimit-remaining-hour');

  if (limitPerMinute !== undefined) rateLimit.limitPerMinute = limitPerMinute;
  if (remainingPerMinute !== undefined) rateLimit.remainingPerMinute = remainingPerMinute;
  if (limitPerHour !== undefined) rateLimit.limitPerHour = limitPerHour;
  if (remainingPerHour !== undefined) rateLimit.remainingPerHour = remainingPerHour;

  return rateLimit;
}
