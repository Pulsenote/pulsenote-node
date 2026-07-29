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
