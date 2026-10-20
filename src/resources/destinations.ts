import type { RequestOverrides, Transport } from '../http.js';
import type {
  CreateDestinationParams,
  CreatedDestination,
  Destination,
  DestinationRemoved,
  DestinationTestResult,
  SendMessageParams,
  SendMessageResult,
} from '../types.js';
import { pathSegment } from './shared.js';

/**
 * Places other than an inbox: a Slack, Microsoft Teams, Discord or Google Chat
 * channel, or an HTTPS endpoint of yours. Register one once, then send to it
 * by name with {@link Messages.send}.
 *
 * Messages count towards the same monthly allowance as email and need no
 * sending domain.
 */
export class Destinations {
  constructor(private readonly transport: Transport) {}

  /** Every destination on this account, oldest first. */
  async list(options: RequestOverrides = {}): Promise<Destination[]> {
    const { data } = await this.transport.request<Destination[]>({
      method: 'GET',
      path: '/api/v1/destinations',
      ...options,
    });
    return data;
  }

  /**
   * Register a destination.
   *
   * Slack takes either your own Slack app's bot token and a channel (checked
   * with Slack before it is saved) or an incoming-webhook URL. Every other
   * type takes the URL its platform gives you.
   *
   * For `webhook` destinations the result carries `signingSecret`, shown this
   * once: every request to your endpoint is signed with it in
   * `X-Pulsenote-Signature: sha256=<hex hmac of the raw body>`.
   *
   * @throws {ConflictError} when a destination with that name already exists.
   * @throws {BadRequestError} when the URL, token or channel is not accepted.
   */
  async create(
    params: CreateDestinationParams,
    options: RequestOverrides = {},
  ): Promise<CreatedDestination> {
    const { data } = await this.transport.request<CreatedDestination>({
      method: 'POST',
      path: '/api/v1/destinations',
      body: params,
      ...options,
    });
    return data;
  }

  /**
   * Send a test message right away — outside the queue and the allowance.
   * A success clears a destination that was marked as not delivering.
   */
  async test(
    id: string,
    options: RequestOverrides = {},
  ): Promise<DestinationTestResult> {
    const { data } = await this.transport.request<DestinationTestResult>({
      method: 'POST',
      path: `/api/v1/destinations/${pathSegment(id, 'id')}/test`,
      ...options,
    });
    return data;
  }

  /** Remove a destination. Messages already queued for it will fail. */
  async delete(
    id: string,
    options: RequestOverrides = {},
  ): Promise<DestinationRemoved> {
    const { data } = await this.transport.request<DestinationRemoved>({
      method: 'DELETE',
      path: `/api/v1/destinations/${pathSegment(id, 'id')}`,
      ...options,
    });
    return data;
  }
}

/** Messages to a {@link Destinations destination}. */
export class Messages {
  constructor(private readonly transport: Transport) {}

  /**
   * Queue a message for a registered destination and return at once.
   *
   * ```ts
   * await pulsenote.messages.send({ to: 'ops-alerts', title: 'New order', text: 'Order #1042 — €240.00' });
   * ```
   *
   * Not retried automatically: the API has no idempotency keys, so a replayed
   * request would post twice. Pass `{ idempotent: true }` if a duplicate is
   * acceptable to you.
   *
   * @throws {NotFoundError} when no destination has that name.
   * @throws {UnprocessableEntityError} when the destination stopped accepting
   * messages — the error says why.
   */
  async send(
    params: SendMessageParams,
    options: RequestOverrides = {},
  ): Promise<SendMessageResult> {
    const { data } = await this.transport.request<SendMessageResult>({
      method: 'POST',
      path: '/api/v1/messages',
      body: params,
      ...options,
    });
    return data;
  }
}
