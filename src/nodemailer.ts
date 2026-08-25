/**
 * Nodemailer transport — `pulsenote/nodemailer`.
 *
 * The difference between "rewrite your sending code" and "change one line":
 * everything already written against Nodemailer keeps working, including the
 * mail layers of frameworks that sit on top of it.
 *
 * ```ts
 * import nodemailer from 'nodemailer';
 * import { pulsenoteTransport } from 'pulsenote/nodemailer';
 *
 * const transport = nodemailer.createTransport(pulsenoteTransport({ apiKey: process.env.PULSENOTE_API_KEY }));
 * await transport.sendMail({ from: 'noreply@acme.com', to: 'greg@example.com', subject: 'Hi', html: '<b>Hi</b>' });
 * ```
 *
 * ## What it deliberately refuses
 *
 * The API carries `to`, `from`, `subject`, `html` and `text`. There is no `cc`,
 * `bcc`, `replyTo` or attachment support, so this throws rather than dropping them
 * silently — a message that differs from the one the caller composed is a bug found
 * by a customer complaint weeks later, and a vanished attachment is worse than an
 * error at send time.
 *
 * ## Several recipients
 *
 * Pulsenote models one recipient per message, so multiple `to` addresses are fanned
 * out through the batch endpoint — one message each. Recipients therefore do NOT see
 * one another in the `To` header.
 */
import { Pulsenote, type PulsenoteOptions } from './client.js';
import type { SendEmailParams } from './types.js';
import { MAX_BATCH_SIZE } from './resources/notifications.js';
import { VERSION } from './version.js';

/** Minimal structural view of what Nodemailer hands a custom transport. */
interface MailAddress {
  name?: string;
  address?: string;
}

type AddressField = string | MailAddress | Array<string | MailAddress> | undefined;

interface MailData {
  from?: AddressField;
  to?: AddressField;
  cc?: AddressField;
  bcc?: AddressField;
  replyTo?: AddressField;
  subject?: string;
  text?: unknown;
  html?: unknown;
  attachments?: unknown[];
  messageId?: string;
}

interface MailLike {
  data: MailData;
  message?: { messageId?(): string };
}

/** What Nodemailer expects a custom transport object to look like. */
export interface PulsenoteNodemailerTransport {
  name: string;
  version: string;
  send(
    mail: MailLike,
    callback: (err: Error | null, info?: { messageId: string; envelope: { from: string | null; to: string[] }; accepted: string[]; rejected: string[]; response: string }) => void,
  ): void;
}

export interface PulsenoteTransportOptions extends PulsenoteOptions {
  /** Reuse an existing client instead of constructing one from the options. */
  client?: Pulsenote;
}

function flatten(field: AddressField): string[] {
  if (field === undefined) return [];
  const items = Array.isArray(field) ? field : [field];
  return items
    .map((item) => (typeof item === 'string' ? item : item.address))
    .filter((address): address is string => typeof address === 'string' && address.length > 0);
}

/** Render a single address back to `Name <email>` when a name was supplied. */
function formatFrom(field: AddressField): string | undefined {
  if (field === undefined) return undefined;
  const first = Array.isArray(field) ? field[0] : field;
  if (first === undefined) return undefined;
  if (typeof first === 'string') return first;
  if (!first.address) return undefined;
  return first.name ? `${first.name} <${first.address}>` : first.address;
}

function asString(body: unknown): string | undefined {
  return typeof body === 'string' && body.length > 0 ? body : undefined;
}

/**
 * Build a Nodemailer transport backed by the Pulsenote API.
 *
 * Pass `client` to reuse a configured {@link Pulsenote}; otherwise the usual
 * options (and their `PULSENOTE_*` environment fallbacks) apply.
 */
export function pulsenoteTransport(options: PulsenoteTransportOptions = {}): PulsenoteNodemailerTransport {
  const { client, ...clientOptions } = options;
  const pulsenote = client ?? new Pulsenote(clientOptions);

  return {
    name: 'pulsenote',
    version: VERSION,

    send(mail, callback) {
      const data = mail.data ?? {};

      const unsupported: string[] = [];
      if (flatten(data.cc).length > 0) unsupported.push('cc');
      if (flatten(data.bcc).length > 0) unsupported.push('bcc');
      if (flatten(data.replyTo).length > 0) unsupported.push('replyTo');
      if (Array.isArray(data.attachments) && data.attachments.length > 0) unsupported.push('attachments');

      if (unsupported.length > 0) {
        callback(
          new Error(
            `Pulsenote: cannot send ${unsupported.join(', ')} — the API has no field for ` +
              `${unsupported.length === 1 ? 'it' : 'them'}. Nothing was sent, deliberately: dropping ` +
              'them silently would deliver a message that differs from the one you composed. ' +
              'Remove them, or use a different transport for this message.',
          ),
        );
        return;
      }

      const recipients = flatten(data.to);
      if (recipients.length === 0) {
        callback(new Error('Pulsenote: the message has no "to" recipient.'));
        return;
      }
      if (recipients.length > MAX_BATCH_SIZE) {
        callback(
          new Error(
            `Pulsenote: ${recipients.length} recipients exceeds the ${MAX_BATCH_SIZE}-message batch limit. ` +
              'Send them in chunks.',
          ),
        );
        return;
      }

      const from = formatFrom(data.from);
      const subject = data.subject;
      const html = asString(data.html);
      const text = asString(data.text);

      // Build the discriminated variant explicitly rather than casting. This is
      // also the only place a body-less message can be caught locally instead of
      // costing a round trip to be told the obvious.
      const body = ((): { html: string; text?: string } | { text: string } | undefined => {
        if (html !== undefined) return { html, text };
        if (text !== undefined) return { text };
        return undefined;
      })();

      if (body === undefined) {
        callback(new Error('Pulsenote: the message has no body — set `html` or `text`.'));
        return;
      }

      const done = (id: string): void => {
        callback(null, {
          messageId: id,
          envelope: { from: from ?? null, to: recipients },
          accepted: recipients,
          rejected: [],
          response: 'queued',
        });
      };

      const fail = (error: unknown): void => {
        callback(error instanceof Error ? error : new Error(String(error)));
      };

      if (recipients.length === 1) {
        pulsenote.notifications
          .send({ to: recipients[0]!, from, subject, ...body } satisfies SendEmailParams)
          .then((result) => done(result.id))
          .catch(fail);
        return;
      }

      pulsenote.notifications
        .sendBatch(recipients.map((to) => ({ to, from, subject, ...body }) satisfies SendEmailParams))
        .then((batch) => {
          const first = batch.results.find((r) => r.status === 'queued');
          done(first && 'id' in first ? first.id : (data.messageId ?? 'batch'));
        })
        .catch(fail);
    },
  };
}
