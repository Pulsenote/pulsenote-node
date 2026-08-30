/**
 * Public types.
 *
 * The shapes come straight from the generated OpenAPI schema, re-exported under
 * names without the `Dto` suffix. Anything the spec cannot express (parameter
 * objects, the send-email discriminated union) is declared here by hand.
 */
import type { components } from './generated/schema.js';

type Schemas = components['schemas'];

/* -------------------------------------------------------------------------- */
/* Enums                                                                       */
/* -------------------------------------------------------------------------- */

/** Delivery status of a notification. */
export type NotificationStatus = Schemas['NotificationDto']['status'];

/** Runtime companion to the {@link NotificationStatus} type. */
export const NotificationStatus = {
  PENDING: 'PENDING',
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  BOUNCED: 'BOUNCED',
} as const satisfies Record<string, NotificationStatus>;

/** Verification status of a sender domain. */
export type DomainStatus = Schemas['DomainDto']['status'];

/** Runtime companion to the {@link DomainStatus} type. */
export const DomainStatus = {
  PENDING: 'PENDING',
  VERIFYING: 'VERIFYING',
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED',
} as const satisfies Record<string, DomainStatus>;

/** Type of a DNS record returned by the domains API. */
export type DnsRecordType = Schemas['DnsRecordDto']['type'];

/* -------------------------------------------------------------------------- */
/* Resources                                                                   */
/* -------------------------------------------------------------------------- */

/** A single notification record. */
export type Notification = Schemas['NotificationDto'];

/** Pagination metadata attached to list responses. */
export type PaginationMeta = Schemas['PaginationMetaDto'];

/** A page of notifications. */
export type NotificationList = Schemas['NotificationListDto'];

/** Aggregate notification statistics for the tenant. */
export type NotificationStats = Schemas['NotificationStatsDto'];

/** Result of accepting an email for delivery. */
export type SendEmailResult = Schemas['SendEmailResponseDto'];

/** A stored email template. */
export type Template = Schemas['TemplateDto'];

/** Rendered template output. */
export type RenderedTemplate = Schemas['RenderedTemplateDto'];

/** A registered sender domain. */
export type Domain = Schemas['DomainDto'];

/** A DNS record that must be published to verify a domain. */
export type DnsRecord = Schemas['DnsRecordDto'];

/** DNS records plus per-record verification state for a domain. */
export type DomainDnsRecords = Schemas['DomainDnsRecordsDto'];

/** Transactional or broadcast — see {@link SendEmailBase.stream}. */
export type MessageStream = NonNullable<Schemas['AddSuppressionDto']['stream']>;

/** A recipient this tenant will not send to, and why. */
export type Suppression = Schemas['SuppressionDto'];

/** Parameters for suppressing an address by hand. */
export type AddSuppressionParams = Schemas['AddSuppressionDto'];

/** What a manual add settled on — narrower than a full {@link Suppression}. */
export type AddedSuppression = Schemas['AddedSuppressionDto'];

/** Acknowledgement returned when a suppression is removed. */
export type SuppressionRemoved = Schemas['SuppressionRemovedDto'];

/** Body returned by the delete endpoints. */
export interface DeletedResult {
  deleted: boolean;
}

/* -------------------------------------------------------------------------- */
/* Send parameters                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The raw request body accepted by `POST /notifications/send`.
 *
 * Prefer {@link SendEmailParams}, which additionally enforces that exactly one
 * content source is supplied. Use this looser type when you build the payload
 * dynamically and cannot satisfy the union at compile time.
 */
export type SendEmailPayload = Schemas['SendEmailDto'];

/**
 * A file attached to an outgoing email.
 *
 * `content` is base64. Encoding is the caller's job because the source varies —
 * `readFile()` gives you a Buffer (`buf.toString('base64')`), a browser upload
 * gives you a data URL whose payload is already encoded.
 *
 * ```ts
 * await pulsenote.notifications.send({
 *   to: 'greg@example.com',
 *   subject: 'Your invoice',
 *   html: '<p>Attached.</p>',
 *   attachments: [{
 *     filename: 'invoice.pdf',
 *     content: (await readFile('invoice.pdf')).toString('base64'),
 *     contentType: 'application/pdf',
 *   }],
 * });
 * ```
 */
export interface EmailAttachment {
  /** File name shown to the recipient. */
  filename: string;
  /** Base64-encoded file contents. */
  content: string;
  /** MIME type. The API defaults to `application/octet-stream`. */
  contentType?: string;
  /**
   * Set to embed the file in the HTML body rather than list it as a download.
   * Reference it from the HTML as `cid:<contentId>`.
   */
  contentId?: string;
}

interface SendEmailBase {
  /** Recipient email address. */
  to: string;
  /**
   * Sender address on a verified domain — plain (`billing@acme.com`) or with a
   * display name (`Acme <billing@acme.com>`). Defaults to the tenant's default
   * sender. The API rejects addresses outside your verified domains with a 403.
   */
  from?: string;
  /** Subject line. Ignored when the template supplies its own subject. */
  subject?: string;
  /**
   * Carbon-copy recipients, visible to everyone on the message. Counts toward
   * the 50-recipient limit shared with `to` and `bcc`.
   */
  cc?: string[];
  /**
   * Blind-carbon-copy recipients, hidden from the other recipients. Counts
   * toward the 50-recipient limit shared with `to` and `cc`.
   */
  bcc?: string[];
  /**
   * Where replies should go, when that differs from `from`. Unlike `from`, these
   * addresses do not need to be on a verified domain.
   */
  replyTo?: string[];
  /** Files to attach — up to 20 per message and 10 MB in total. */
  attachments?: EmailAttachment[];
  /**
   * Which stream this message belongs to. Defaults to `transactional`.
   *
   * The stream decides which suppression list applies and, once separate SES
   * configuration sets are in place, which reputation the message is measured
   * against. Sending marketing mail as `transactional` mixes its bounce and
   * complaint rates into the ones that protect your password resets.
   */
  stream?: MessageStream;
}

/** Send a raw HTML body. */
export interface SendEmailHtmlParams extends SendEmailBase {
  html: string;
  text?: string;
  templateId?: never;
  templateSlug?: never;
  templateData?: never;
  locale?: never;
}

/** Send a plain-text-only body. */
export interface SendEmailTextParams extends SendEmailBase {
  text: string;
  html?: never;
  templateId?: never;
  templateSlug?: never;
  templateData?: never;
  locale?: never;
}

/** Send a stored template, addressed by ID. */
export interface SendEmailTemplateIdParams extends SendEmailBase {
  templateId: string;
  /** Variables interpolated into the template. */
  templateData?: Record<string, unknown>;
  /** Locale variant to use (e.g. `en`, `pl`). */
  locale?: string;
  templateSlug?: never;
  html?: never;
  text?: never;
}

/** Send a stored template, addressed by slug. */
export interface SendEmailTemplateSlugParams extends SendEmailBase {
  templateSlug: string;
  /** Variables interpolated into the template. */
  templateData?: Record<string, unknown>;
  /** Locale variant to use (e.g. `en`, `pl`). */
  locale?: string;
  templateId?: never;
  html?: never;
  text?: never;
}

/**
 * Parameters for {@link Notifications.send}. Exactly one content source —
 * `html`, `text`, `templateId` or `templateSlug` — must be provided.
 */
export type SendEmailParams =
  | SendEmailHtmlParams
  | SendEmailTextParams
  | SendEmailTemplateIdParams
  | SendEmailTemplateSlugParams;

/* -------------------------------------------------------------------------- */
/* Batch send                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Per-message outcome inside a batch.
 *
 * Note the lower-case values: this reports whether a message was *accepted*, not
 * how it was delivered, so it is deliberately distinct from
 * {@link NotificationStatus} (`QUEUED`, `DELIVERED`, …).
 */
export type BatchMessageStatus = 'queued' | 'rejected';

/** A message that entered the send queue. */
export interface BatchMessageQueued {
  /** Position in the array passed to {@link Notifications.sendBatch}, 0-based. */
  index: number;
  status: 'queued';
  /** ID of the queued notification — pass it to `notifications.retrieve()`. */
  id: string;
  error?: never;
}

/** A message the API refused. */
export interface BatchMessageRejected {
  /** Position in the array passed to {@link Notifications.sendBatch}, 0-based. */
  index: number;
  status: 'rejected';
  /** Why the message was refused. */
  error: string;
  id?: never;
}

/**
 * Outcome for one message. Discriminate on `status` to narrow to `id` or `error`:
 *
 * ```ts
 * if (result.status === 'rejected') console.error(result.error);
 * ```
 */
export type BatchMessageResult = BatchMessageQueued | BatchMessageRejected;

/**
 * Result of {@link Notifications.sendBatch}.
 *
 * A batch is partial-success: the call resolves with `202` even when some messages
 * were rejected, so check `rejected` rather than assuming everything was queued.
 */
export interface BatchSendResult {
  /** Messages submitted. */
  total: number;
  /** Messages that entered the queue. */
  queued: number;
  /** Messages the API refused. */
  rejected: number;
  /** Per-message outcomes, in submission order. */
  results: BatchMessageResult[];
}

/* -------------------------------------------------------------------------- */
/* Query / body parameters                                                     */
/* -------------------------------------------------------------------------- */

/** Filters for {@link Notifications.list}. */
export interface ListNotificationsParams {
  /** 1-based page number. Defaults to 1. */
  page?: number;
  /** Page size. Defaults to 20 server-side. */
  limit?: number;
  /** Only return notifications in this status. */
  status?: NotificationStatus;
  /** Match recipient or subject, case-insensitive. */
  search?: string;
}

/** Filters for {@link Templates.list}. */
export interface ListTemplatesParams {
  /** Only return templates for this locale (e.g. `en`, `pl`). */
  locale?: string;
}

/** Body for creating a template. */
export type CreateTemplateParams = Schemas['UpsertTemplateDto'];

/**
 * Body for updating a template. The API replaces the record, so `name`, `slug`
 * and `body` are required on update too.
 */
export type UpdateTemplateParams = Schemas['UpsertTemplateDto'];

/** Body for {@link Templates.render}. */
export interface RenderTemplateParams {
  /** Sample data interpolated into the template. */
  data?: Record<string, unknown>;
}

/** Body for {@link Domains.add}. */
export type AddDomainParams = Schemas['AddDomainDto'];
