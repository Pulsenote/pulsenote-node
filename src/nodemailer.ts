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
 * ## Several recipients
 *
 * Pulsenote models one recipient per message, so multiple `to` addresses are fanned
 * out through the batch endpoint — one message each. Recipients therefore do NOT see
 * one another in the `To` header.
 *
 * That fan-out decides how copies travel: `cc` and `bcc` ride on the FIRST message
 * only, since repeating them per message would deliver one copy per `to` recipient.
 * Attachments and `replyTo` go on every message — each recipient should get the
 * invoice, and each should be able to reply.
 */
import { Pulsenote, type PulsenoteOptions } from './client.js';
import type { EmailAttachment, SendEmailParams } from './types.js';
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
  attachments?: NodemailerAttachment[];
  messageId?: string;
}

/**
 * The subset of Nodemailer's attachment shape we can forward.
 *
 * Nodemailer also accepts `path`, `href` and streams; those are resolved by its
 * own transports at send time, and doing that resolution here would mean reading
 * files and draining streams on the caller's behalf. Rather than half-support
 * them, they are rejected with a message pointing at the fix.
 */
interface NodemailerAttachment {
  filename?: string;
  content?: string | Buffer;
  contentType?: string;
  encoding?: string;
  cid?: string;
  path?: unknown;
  href?: unknown;
}

interface MailLike {
  data: MailData;
  message?: { messageId?(): string };
}

/** What Nodemailer expects a custom transport object to look like. */
export interface PulsenoteNodemailerTransport {
  name: string;
  version: string;
  /**
   * Nodemailer's `transporter.verify()`. Without this it resolves `false`, which
   * frameworks that verify on boot — Payload's email adapter does by default —
   * read as a broken transport.
   *
   * Checks the credentials against the API rather than answering `true` blindly,
   * so a wrong or revoked key fails at boot instead of at the first send.
   */
  verify(callback?: (err: Error | null, success?: true) => void): Promise<true>;
  send(
    mail: MailLike,
    callback: (err: Error | null, info?: { messageId: string; envelope: { from: string | null; to: string[] }; accepted: string[]; rejected: string[]; response: string }) => void,
  ): void;
}

export interface PulsenoteTransportOptions extends PulsenoteOptions {
  /** Reuse an existing client instead of constructing one from the options. */
  client?: Pulsenote;
}

/**
 * Convert Nodemailer attachments into the API's shape.
 *
 * Nodemailer lets a caller supply content as a string, a Buffer, a file path, an
 * href or a stream, and resolves the lazy ones inside its own transports. We only
 * see the raw `data`, so path/href/stream attachments cannot be forwarded — those
 * throw with the fix spelled out rather than silently sending a message with the
 * attachment missing.
 */
function convertAttachments(attachments: NodemailerAttachment[] | undefined): EmailAttachment[] {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];

  return attachments.map((attachment, index) => {
    const where = attachment.filename ?? `attachments[${index}]`;

    if (attachment.path !== undefined || attachment.href !== undefined) {
      throw new Error(
        `Pulsenote: attachment "${where}" uses \`path\`/\`href\`, which this transport cannot read. ` +
          'Read the file yourself and pass `content` (a Buffer or base64 string) instead.',
      );
    }

    const { content } = attachment;

    if (content === undefined) {
      throw new Error(`Pulsenote: attachment "${where}" has no \`content\`.`);
    }

    if (typeof content !== 'string' && !Buffer.isBuffer(content)) {
      throw new Error(
        `Pulsenote: attachment "${where}" has an unsupported \`content\` type. ` +
          'Pass a Buffer or a string.',
      );
    }

    // A string is only already-encoded when the caller says so; otherwise it is
    // literal text that still needs encoding.
    const base64 = Buffer.isBuffer(content)
      ? content.toString('base64')
      : attachment.encoding === 'base64'
        ? content
        : Buffer.from(content, (attachment.encoding as BufferEncoding | undefined) ?? 'utf8').toString('base64');

    return {
      filename: attachment.filename ?? 'attachment',
      content: base64,
      ...(attachment.contentType !== undefined ? { contentType: attachment.contentType } : {}),
      ...(attachment.cid !== undefined ? { contentId: attachment.cid } : {}),
    };
  });
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

    async verify(callback) {
      try {
        // Cheapest authenticated GET there is. A bad key fails here, at boot,
        // rather than silently on the first message a user actually cares about.
        await pulsenote.domains.list();
        callback?.(null, true);
        return true;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (callback) {
          callback(err);
          return true;
        }
        throw err;
      }
    },

    send(mail, callback) {
      const data = mail.data ?? {};

      const cc = flatten(data.cc);
      const bcc = flatten(data.bcc);
      const replyTo = flatten(data.replyTo);

      let attachments: EmailAttachment[];
      try {
        attachments = convertAttachments(data.attachments);
      } catch (error) {
        callback(error instanceof Error ? error : new Error(String(error)));
        return;
      }

      const copies = {
        ...(cc.length > 0 ? { cc } : {}),
        ...(bcc.length > 0 ? { bcc } : {}),
      };
      const perMessage = {
        ...(replyTo.length > 0 ? { replyTo } : {}),
        ...(attachments.length > 0 ? { attachments } : {}),
      };

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
          .send({ to: recipients[0]!, from, subject, ...copies, ...perMessage, ...body } satisfies SendEmailParams)
          .then((result) => done(result.id))
          .catch(fail);
        return;
      }

      pulsenote.notifications
        .sendBatch(
          recipients.map(
            (to, index) =>
              ({
                to,
                from,
                subject,
                // Copies go out once — see the module docblock.
                ...(index === 0 ? copies : {}),
                ...perMessage,
                ...body,
              }) satisfies SendEmailParams,
          ),
        )
        .then((batch) => {
          const first = batch.results.find((r) => r.status === 'queued');
          done(first && 'id' in first ? first.id : (data.messageId ?? 'batch'));
        })
        .catch(fail);
    },
  };
}
