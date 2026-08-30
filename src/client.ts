import {
  Transport,
  type ApiResponse,
  type FetchLike,
  type Logger,
  type RequestOptions,
} from './http.js';
import { Domains } from './resources/domains.js';
import { Suppressions } from './resources/suppressions.js';
import { Notifications } from './resources/notifications.js';
import { Templates } from './resources/templates.js';
import { VERSION } from './version.js';

/** Production API host. */
export const DEFAULT_BASE_URL = 'https://api.pulsenote.eu';

export interface PulsenoteOptions {
  /**
   * Tenant API key (`pk_live_…`). Sent as the `X-API-Key` header.
   * Falls back to `process.env.PULSENOTE_API_KEY`.
   */
  apiKey?: string;
  /**
   * API base URL. Falls back to `process.env.PULSENOTE_BASE_URL`, then to
   * {@link DEFAULT_BASE_URL}.
   */
  baseUrl?: string;
  /** Per-request timeout in milliseconds. `0` disables it. Default `30_000`. */
  timeout?: number;
  /**
   * Retries after the initial attempt. Default `2`.
   *
   * `GET`, `PUT` and `DELETE` are replayed on connection failures, timeouts,
   * `408`, `429` and `5xx`. A `POST` is only replayed on `429`, because the
   * API has no idempotency keys and a resent `notifications.send` would
   * deliver the email twice. The two read-only `POST` endpoints
   * (`templates.render`, `domains.verify`) opt back in internally.
   */
  maxRetries?: number;
  /** Base backoff delay in ms, doubled per attempt and jittered. Default `500`. */
  initialRetryDelay?: number;
  /** Upper bound for the backoff delay in ms. Default `8_000`. */
  maxRetryDelay?: number;
  /**
   * Longest `Retry-After` the client will wait out, in ms. Default `30_000`.
   * Beyond that the `RateLimitError` is thrown so the caller can reschedule.
   */
  maxRetryAfter?: number;
  /** Extra headers sent on every request. */
  headers?: Record<string, string>;
  /** Custom `fetch` implementation (proxy agents, test doubles, instrumentation). */
  fetch?: FetchLike;
  /** Appended to the `User-Agent`, e.g. `"acme-billing/2.1"`. */
  userAgentSuffix?: string;
  /** Receives retry diagnostics. */
  logger?: Logger;
}

/**
 * Pulsenote API client.
 *
 * ```ts
 * import { Pulsenote } from 'pulsenote';
 *
 * const pulsenote = new Pulsenote({ apiKey: process.env.PULSENOTE_API_KEY });
 *
 * const { id } = await pulsenote.notifications.send({
 *   to: 'greg@example.com',
 *   subject: 'Welcome',
 *   html: '<h1>Hi</h1>',
 * });
 * ```
 */
export class Pulsenote {
  /** Send emails and inspect delivery. */
  readonly notifications: Notifications;
  /** Manage reusable templates. */
  readonly templates: Templates;
  /** Manage sender domains and their DNS verification. */
  readonly domains: Domains;

  /** Addresses this tenant will not send to. */
  readonly suppressions: Suppressions;

  /** Resolved base URL, after option and environment fallbacks. */
  readonly baseUrl: string;

  private readonly transport: Transport;

  constructor(options: PulsenoteOptions = {}) {
    const apiKey = options.apiKey ?? readEnv('PULSENOTE_API_KEY');
    if (!apiKey) {
      throw new TypeError(
        'Pulsenote: `apiKey` is required. Pass it to the constructor or set PULSENOTE_API_KEY.',
      );
    }

    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new TypeError(
        'Pulsenote: global `fetch` is unavailable. Use Node 22+ or pass a `fetch` implementation.',
      );
    }

    this.baseUrl = options.baseUrl ?? readEnv('PULSENOTE_BASE_URL') ?? DEFAULT_BASE_URL;

    this.transport = new Transport({
      apiKey,
      baseUrl: this.baseUrl,
      timeout: options.timeout ?? 30_000,
      maxRetries: options.maxRetries ?? 2,
      initialRetryDelay: options.initialRetryDelay ?? 500,
      maxRetryDelay: options.maxRetryDelay ?? 8_000,
      maxRetryAfter: options.maxRetryAfter ?? 30_000,
      headers: options.headers ?? {},
      fetch: (input, init) => fetchImpl(input, init),
      userAgent: buildUserAgent(options.userAgentSuffix),
      logger: options.logger,
    });

    this.notifications = new Notifications(this.transport);
    this.templates = new Templates(this.transport);
    this.domains = new Domains(this.transport);
    this.suppressions = new Suppressions(this.transport);
  }

  /**
   * Call an endpoint the resource classes do not cover yet, with the same auth,
   * timeout and retry behaviour.
   */
  async request<T = unknown>(options: RequestOptions): Promise<T> {
    const { data } = await this.transport.request<T>(options);
    return data;
  }

  /**
   * Same as {@link request}, but returns the status, headers and rate-limit
   * quota alongside the body.
   */
  rawRequest<T = unknown>(options: RequestOptions): Promise<ApiResponse<T>> {
    return this.transport.request<T>(options);
  }
}

function readEnv(name: string): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  const value = process.env[name];
  return value !== undefined && value !== '' ? value : undefined;
}

function buildUserAgent(suffix?: string): string {
  const runtime =
    typeof process !== 'undefined' && process.versions?.node ? ` node/${process.versions.node}` : '';
  return `pulsenote-node/${VERSION}${runtime}${suffix ? ` ${suffix}` : ''}`;
}
