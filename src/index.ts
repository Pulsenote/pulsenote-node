/**
 * Official TypeScript/Node SDK for the Pulsenote email API.
 *
 * @see https://pulsenote.eu
 */
export { Pulsenote, DEFAULT_BASE_URL, type PulsenoteOptions } from './client.js';
export { VERSION } from './version.js';

export { Notifications, MAX_BATCH_SIZE } from './resources/notifications.js';
export { Templates } from './resources/templates.js';
export { Domains } from './resources/domains.js';

export {
  PulsenoteError,
  BadRequestError,
  AuthenticationError,
  PermissionDeniedError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
  RateLimitError,
  ServerError,
  ConnectionError,
  TimeoutError,
  type ApiErrorBody,
  type RateLimit,
} from './errors.js';

export type {
  ApiResponse,
  FetchLike,
  HttpMethod,
  Logger,
  QueryParams,
  RequestOptions,
  RequestOverrides,
} from './http.js';

export { collect, paginate, type Page } from './pagination.js';

export {
  DomainStatus,
  NotificationStatus,
  type AddDomainParams,
  type BatchMessageQueued,
  type BatchMessageRejected,
  type BatchMessageResult,
  type BatchMessageStatus,
  type BatchSendResult,
  type CreateTemplateParams,
  type DeletedResult,
  type DnsRecord,
  type DnsRecordType,
  type Domain,
  type DomainDnsRecords,
  type EmailAttachment,
  type ListNotificationsParams,
  type ListTemplatesParams,
  type Notification,
  type NotificationList,
  type NotificationStats,
  type PaginationMeta,
  type RenderTemplateParams,
  type RenderedTemplate,
  type SendEmailHtmlParams,
  type SendEmailParams,
  type SendEmailPayload,
  type SendEmailResult,
  type SendEmailTemplateIdParams,
  type SendEmailTemplateSlugParams,
  type SendEmailTextParams,
  type Template,
  type UpdateTemplateParams,
} from './types.js';

export type { components, operations, paths } from './generated/schema.js';
