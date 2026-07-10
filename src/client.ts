/* Hand-written facade — NOT regenerated. */
import { PulsenoteCore } from './PulsenoteCore';
import type { OpenAPIConfig } from './core/OpenAPI';

export interface PulsenoteOptions {
  /** Tenant API key (pk_live_… / pk_test_…). Sent as the `X-API-Key` header. */
  apiKey: string;
  /** Override the API base URL (defaults to production). */
  baseUrl?: string;
  /** Extra headers to send on every request. */
  headers?: Record<string, string>;
}

/**
 * Pulsenote API client.
 *
 * ```ts
 * const pulsenote = new Pulsenote({ apiKey: process.env.PULSENOTE_API_KEY! });
 * const res = await pulsenote.notifications.sendNotification({
 *   to: "greg@example.com",
 *   subject: "Welcome",
 *   html: "<b>Hello</b>",
 * });
 * ```
 *
 * Groups: `notifications`, `templates`, `domains`.
 */
export class Pulsenote extends PulsenoteCore {
  constructor(options: PulsenoteOptions) {
    if (!options || !options.apiKey) {
      throw new Error('Pulsenote: `apiKey` is required');
    }

    const config: Partial<OpenAPIConfig> = {
      HEADERS: { 'X-API-Key': options.apiKey, ...(options.headers ?? {}) },
    };
    if (options.baseUrl) {
      config.BASE = options.baseUrl;
    }

    super(config);
  }
}
