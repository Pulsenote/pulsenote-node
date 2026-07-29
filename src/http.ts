/**
 * HTTP transport: URL building, auth, timeouts, retries and error mapping.
 *
 * Nothing here is Pulsenote-specific beyond the header names — the resource
 * classes sit on top and only describe paths and payloads.
 */
import {
  ConnectionError,
  PulsenoteError,
  RateLimitError,
  TimeoutError,
  parseRateLimit,
  type RateLimit,
} from './errors.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

/** Minimal `fetch` shape, so a custom implementation can be injected. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Optional sink for retry/timing diagnostics. */
export interface Logger {
  debug?(message: string, meta?: Record<string, unknown>): void;
  warn?(message: string, meta?: Record<string, unknown>): void;
}

/** Per-call overrides accepted by every resource method. */
export interface RequestOverrides {
  /** Abort the call from the outside. Aborted calls are never retried. */
  signal?: AbortSignal;
  /** Override the client timeout, in milliseconds. `0` disables it. */
  timeout?: number;
  /** Override the client retry budget for this call. */
  maxRetries?: number;
  /** Extra headers merged over the client defaults. */
  headers?: Record<string, string>;
}

export interface RequestOptions extends RequestOverrides {
  method: HttpMethod;
  /** Path relative to the base URL, e.g. `/api/v1/notifications`. */
  path: string;
  query?: QueryParams;
  body?: unknown;
  /** `text` skips JSON parsing — used by the zone-file endpoint. */
  responseType?: 'json' | 'text';
  /**
   * Mark a `POST` as safe to replay. Retrying a request that may have already
   * been processed is only acceptable when the operation has no side effect
   * (template preview) or is naturally repeatable (domain re-verification).
   */
  idempotent?: boolean;
}

/** A successful response plus the metadata worth surfacing. */
export interface ApiResponse<T> {
  data: T;
  status: number;
  /** Response headers, lower-cased. */
  headers: Record<string, string>;
  /** Rate-limit quota parsed from the `X-RateLimit-*` headers. */
  rateLimit: RateLimit;
}

export interface TransportConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  initialRetryDelay: number;
  maxRetryDelay: number;
  maxRetryAfter: number;
  headers: Record<string, string>;
  fetch: FetchLike;
  userAgent: string;
  logger?: Logger | undefined;
}

/**
 * Statuses worth replaying. `408`/`5xx` are transport-ish failures and `429`
 * means the request was rejected before any work happened.
 */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export class Transport {
  constructor(private readonly config: TransportConfig) {}

  async request<T>(options: RequestOptions): Promise<ApiResponse<T>> {
    const url = this.buildUrl(options.path, options.query);
    const init = this.buildInit(options);
    const maxRetries = options.maxRetries ?? this.config.maxRetries;

    for (let attempt = 0; ; attempt++) {
      let response: Response;

      try {
        response = await this.fetchOnce(url, init, options);
      } catch (error) {
        // Anything that is not a ConnectionError came from the caller's own
        // AbortSignal (or is a programmer error) — never replay those.
        if (!(error instanceof ConnectionError)) throw error;
        if (attempt >= maxRetries || !this.mayReplay(options)) throw error;

        const delay = this.backoff(attempt);
        this.config.logger?.warn?.('pulsenote: retrying after transport error', {
          url,
          attempt: attempt + 1,
          delay,
          error: error.message,
        });
        await sleep(delay);
        continue;
      }

      if (response.ok) return this.readSuccess<T>(response, options);

      const { body, headers } = await readBody(response);
      const error = PulsenoteError.fromResponse(response.status, body, headers);

      if (attempt < maxRetries && this.mayReplayStatus(response.status, options)) {
        const delay = this.retryDelay(attempt, error);
        if (delay !== null) {
          this.config.logger?.warn?.('pulsenote: retrying after error response', {
            url,
            status: response.status,
            attempt: attempt + 1,
            delay,
          });
          await sleep(delay);
          continue;
        }
      }

      throw error;
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Request construction                                                    */
  /* ---------------------------------------------------------------------- */

  private buildUrl(path: string, query?: QueryParams): string {
    const base = this.config.baseUrl.endsWith('/') ? this.config.baseUrl : `${this.config.baseUrl}/`;
    const url = new URL(path.replace(/^\/+/, ''), base);

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null) continue;
      url.searchParams.append(key, String(value));
    }

    return url.toString();
  }

  private buildInit(options: RequestOptions): RequestInit {
    const headers: Record<string, string> = {
      accept: options.responseType === 'text' ? 'text/plain' : 'application/json',
      'x-api-key': this.config.apiKey,
      'user-agent': this.config.userAgent,
      ...lowerKeys(this.config.headers),
      ...lowerKeys(options.headers ?? {}),
    };

    const init: RequestInit = { method: options.method, headers };

    if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
      // JSON.stringify already drops `undefined` properties, which matters:
      // the API validates with `forbidNonWhitelisted` and rejects stray keys.
      init.body = JSON.stringify(options.body);
    }

    return init;
  }

  /* ---------------------------------------------------------------------- */
  /* Single attempt                                                          */
  /* ---------------------------------------------------------------------- */

  private async fetchOnce(url: string, init: RequestInit, options: RequestOptions): Promise<Response> {
    const timeout = options.timeout ?? this.config.timeout;
    const controller = new AbortController();
    const cleanups: Array<() => void> = [];
    let timedOut = false;

    if (timeout > 0) {
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeout);
      cleanups.push(() => clearTimeout(timer));
    }

    const external = options.signal;
    if (external) {
      if (external.aborted) {
        controller.abort(external.reason);
      } else {
        const onAbort = () => controller.abort(external.reason);
        external.addEventListener('abort', onAbort, { once: true });
        cleanups.push(() => external.removeEventListener('abort', onAbort));
      }
    }

    try {
      return await this.config.fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (external?.aborted) throw error; // the caller cancelled — surface it verbatim
      if (timedOut) {
        throw new TimeoutError(`Request timed out after ${timeout}ms: ${init.method} ${url}`, {
          cause: error,
        });
      }
      throw new ConnectionError(
        `Could not reach the Pulsenote API: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    } finally {
      for (const cleanup of cleanups) cleanup();
    }
  }

  private async readSuccess<T>(response: Response, options: RequestOptions): Promise<ApiResponse<T>> {
    const headers = headersToObject(response.headers);
    const { body } = await readBody(response, options.responseType);

    return {
      data: body as T,
      status: response.status,
      headers,
      rateLimit: parseRateLimit(headers),
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Retry policy                                                            */
  /* ---------------------------------------------------------------------- */

  /**
   * Whether a request may be sent again at all. `GET`/`PUT`/`DELETE` are
   * idempotent by definition; a `POST` only when it opts in explicitly —
   * replaying `notifications.send` would deliver the email twice.
   */
  private mayReplay(options: RequestOptions): boolean {
    return options.method !== 'POST' || options.idempotent === true;
  }

  private mayReplayStatus(status: number, options: RequestOptions): boolean {
    if (!RETRYABLE_STATUSES.has(status)) return false;
    if (this.mayReplay(options)) return true;
    // A rate-limited request was rejected by the guard before it did any work,
    // so replaying it is safe even for a non-idempotent POST.
    return status === 429;
  }

  /** Returns the delay in ms, or `null` when the wait is too long to be worth it. */
  private retryDelay(attempt: number, error: PulsenoteError): number | null {
    if (error instanceof RateLimitError && error.retryAfter !== undefined) {
      const wait = error.retryAfter * 1000;
      // Blocking the caller for minutes is worse than handing back the error.
      if (wait > this.config.maxRetryAfter) return null;
      return wait;
    }
    return this.backoff(attempt);
  }

  /** Exponential backoff with full-width jitter, capped at `maxRetryDelay`. */
  private backoff(attempt: number): number {
    const exponential = this.config.initialRetryDelay * 2 ** attempt;
    const capped = Math.min(exponential, this.config.maxRetryDelay);
    return Math.round(capped * (0.5 + Math.random() * 0.5));
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function lowerKeys(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}

function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}

/**
 * Read a response body without ever throwing: a malformed JSON error page must
 * not mask the status code the caller actually needs to see.
 */
async function readBody(
  response: Response,
  responseType: 'json' | 'text' = 'json',
): Promise<{ body: unknown; headers: Record<string, string> }> {
  const headers = headersToObject(response.headers);

  if (response.status === 204 || headers['content-length'] === '0') {
    return { body: undefined, headers };
  }

  const text = await response.text().catch(() => '');
  if (text === '') return { body: undefined, headers };

  if (responseType === 'text') return { body: text, headers };

  const contentType = headers['content-type'] ?? '';
  if (!contentType.includes('json')) return { body: text, headers };

  try {
    return { body: JSON.parse(text), headers };
  } catch {
    return { body: text, headers };
  }
}
