import type { RequestOverrides, Transport } from '../http.js';
import { collect, paginate } from '../pagination.js';
import type {
  BatchSendResult,
  ListNotificationsParams,
  Notification,
  NotificationList,
  NotificationStats,
  SendEmailParams,
  SendEmailResult,
} from '../types.js';
import { pathSegment } from './shared.js';

/** Most messages the API accepts in a single {@link Notifications.sendBatch} call. */
export const MAX_BATCH_SIZE = 500;

/** Send emails and inspect what happened to them. */
export class Notifications {
  constructor(private readonly transport: Transport) {}

  /**
   * Queue an email for delivery.
   *
   * Returns as soon as the API has accepted the message (HTTP 202) — delivery
   * happens asynchronously, so the returned status is always `QUEUED`. Poll
   * {@link retrieve} to observe the final outcome.
   *
   * Supply exactly one content source: `html`, `text`, `templateId` or
   * `templateSlug`.
   *
   * ```ts
   * await pulsenote.notifications.send({
   *   to: 'greg@example.com',
   *   from: 'noreply@acme.com',
   *   subject: 'Welcome',
   *   html: '<h1>Hi</h1>',
   * });
   * ```
   *
   * @throws {PermissionDeniedError} when `from` is outside your verified domains,
   *   or the tenant has no verified sending domain at all.
   */
  async send(params: SendEmailParams, options: RequestOverrides = {}): Promise<SendEmailResult> {
    const { data } = await this.transport.request<SendEmailResult>({
      method: 'POST',
      path: '/api/v1/notifications/send',
      body: params,
      ...options,
    });
    return data;
  }

  /**
   * Queue up to {@link MAX_BATCH_SIZE} emails in one request.
   *
   * Each message is validated and queued independently, so this is
   * **partial-success**: a bad recipient or an unverified sender rejects that one
   * message and the rest still go out. The promise only rejects for whole-request
   * failures (bad API key, exhausted quota, an empty or oversized batch) — per-message
   * failures come back in the result.
   *
   * ```ts
   * const batch = await pulsenote.notifications.sendBatch([
   *   { to: 'a@example.com', subject: 'Welcome', html: '<b>Hi</b>' },
   *   { to: 'b@example.com', templateSlug: 'welcome', locale: 'pl' },
   * ]);
   *
   * for (const result of batch.results) {
   *   if (result.status === 'rejected') console.error(result.index, result.error);
   * }
   * ```
   *
   * @throws {TypeError} when the batch is empty or larger than {@link MAX_BATCH_SIZE}.
   */
  async sendBatch(
    messages: SendEmailParams[],
    options: RequestOverrides = {},
  ): Promise<BatchSendResult> {
    // Caught here rather than at the API: an empty batch is always a caller bug, and a
    // 501-message batch would otherwise cost a round trip to be told the obvious.
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new TypeError('Pulsenote: `sendBatch` needs at least one message');
    }
    if (messages.length > MAX_BATCH_SIZE) {
      throw new TypeError(
        `Pulsenote: \`sendBatch\` accepts at most ${MAX_BATCH_SIZE} messages, got ${messages.length}. ` +
          'Chunk the list and send it in parts.',
      );
    }

    const { data } = await this.transport.request<BatchSendResult>({
      method: 'POST',
      path: '/api/v1/notifications/batch',
      body: { messages },
      ...options,
    });
    return data;
  }

  /** Fetch a single notification, including its current delivery status. */
  async retrieve(id: string, options: RequestOverrides = {}): Promise<Notification> {
    const { data } = await this.transport.request<Notification>({
      method: 'GET',
      path: `/api/v1/notifications/${pathSegment(id, 'id')}`,
      ...options,
    });
    return data;
  }

  /** Fetch one page of notifications, newest first. */
  async list(
    params: ListNotificationsParams = {},
    options: RequestOverrides = {},
  ): Promise<NotificationList> {
    const { data } = await this.transport.request<NotificationList>({
      method: 'GET',
      path: '/api/v1/notifications',
      query: {
        page: params.page,
        limit: params.limit,
        status: params.status,
        search: params.search,
      },
      ...options,
    });
    return data;
  }

  /**
   * Iterate every matching notification, fetching pages lazily.
   *
   * ```ts
   * for await (const n of pulsenote.notifications.iterate({ status: 'BOUNCED' })) {
   *   console.log(n.recipient, n.failureReason);
   * }
   * ```
   */
  iterate(
    params: ListNotificationsParams = {},
    options: RequestOverrides = {},
  ): AsyncGenerator<Notification, void, undefined> {
    return paginate(
      (page) => this.list({ ...params, page }, options),
      params.page ?? 1,
    );
  }

  /**
   * Collect every matching notification into an array.
   *
   * Convenient, but it holds the whole result set in memory — prefer
   * {@link iterate} for large accounts.
   */
  listAll(
    params: ListNotificationsParams = {},
    options: RequestOverrides = {},
  ): Promise<Notification[]> {
    return collect(this.iterate(params, options));
  }

  /** Totals by status, this month's volume, and a 30-day daily breakdown. */
  async stats(options: RequestOverrides = {}): Promise<NotificationStats> {
    const { data } = await this.transport.request<NotificationStats>({
      method: 'GET',
      path: '/api/v1/notifications/stats',
      ...options,
    });
    return data;
  }
}
