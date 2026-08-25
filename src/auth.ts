/**
 * Auth.js / NextAuth email provider — `pulsenote/auth`.
 *
 * Magic links and password resets are the core of what this API is for, so this
 * is the shortest path from "evaluating Pulsenote" to "signed in".
 *
 * ```ts
 * import NextAuth from 'next-auth';
 * import { PulsenoteProvider } from 'pulsenote/auth';
 *
 * export const { handlers, signIn } = NextAuth({
 *   providers: [PulsenoteProvider({ from: 'login@yourcompany.com' })],
 * });
 * ```
 *
 * Modelled on the HTTP-based providers Auth.js ships (Resend, Postmark, SendGrid)
 * rather than the Nodemailer one — no SMTP, no extra dependency. If you would
 * rather go through Nodemailer, `pulsenote/nodemailer` works with Auth.js's
 * `Nodemailer` provider instead.
 */
import { Pulsenote, type PulsenoteOptions } from './client.js';

/** Everything the provider needs to render and address one sign-in email. */
export interface PulsenoteMailParams {
  /** The magic link the user must open. */
  url: string;
  /** Host of {@link url}, the name users recognise. */
  host: string;
  /** Address the link was requested for. */
  email: string;
}

export interface PulsenoteAuthConfig extends PulsenoteOptions {
  /** Reuse an existing client instead of constructing one from the options. */
  client?: Pulsenote;
  /** Sender address. Must be on a domain you have verified with Pulsenote. */
  from?: string;
  /** How long a link stays valid, in seconds. Defaults to 24 hours. */
  maxAge?: number;
  /** Override the subject line. */
  subject?: (params: PulsenoteMailParams) => string;
  /** Override the HTML body. */
  html?: (params: PulsenoteMailParams) => string;
  /** Override the plain-text body, which is what spam filters read. */
  text?: (params: PulsenoteMailParams) => string;
}

/**
 * Structural view of what Auth.js expects a provider factory to return. Declared
 * here rather than imported so `@auth/core` stays entirely optional — nothing in
 * this SDK depends on it at runtime or build time.
 */
export interface PulsenoteEmailProvider {
  id: string;
  type: 'email';
  name: string;
  from: string;
  maxAge: number;
  sendVerificationRequest(params: {
    identifier: string;
    url: string;
    provider: { from?: string };
  }): Promise<void>;
  /**
   * Auth.js echoes the provider config back here and types the slot as
   * `Record<string, unknown>`. Neither an interface nor an intersection involving
   * one gets TypeScript's implicit index signature, so exposing
   * {@link PulsenoteAuthConfig} directly makes the provider unassignable to
   * `Provider` — the built-in providers avoid this only because their config is a
   * mapped type from Auth.js's own definitions.
   */
  options: Record<string, unknown>;
}

const DEFAULT_FROM = 'login@example.com';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function defaultSubject({ host }: PulsenoteMailParams): string {
  return `Sign in to ${host}`;
}

function defaultText({ url, host }: PulsenoteMailParams): string {
  return `Sign in to ${host}\n\n${url}\n\nIf you did not request this, you can ignore this email.\n`;
}

function defaultHtml({ url, host }: PulsenoteMailParams): string {
  const safeUrl = escapeHtml(url);
  const safeHost = escapeHtml(host);

  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#f6f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
    <tr><td style="font-size:18px;font-weight:600;color:#16111f;padding-bottom:8px;">Sign in to ${safeHost}</td></tr>
    <tr><td style="font-size:14px;line-height:1.6;color:#5b5570;padding-bottom:24px;">Click the button below to finish signing in. The link works once and expires shortly.</td></tr>
    <tr><td style="padding-bottom:24px;">
      <a href="${safeUrl}" style="display:inline-block;background:#6E56F7;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">Sign in</a>
    </td></tr>
    <tr><td style="font-size:12px;line-height:1.6;color:#9a94a8;">If the button does not work, paste this into your browser:<br><span style="color:#5b5570;word-break:break-all;">${safeUrl}</span></td></tr>
    <tr><td style="font-size:12px;color:#9a94a8;padding-top:16px;">If you did not request this email, you can safely ignore it.</td></tr>
  </table>
</body></html>`;
}

/**
 * Build an Auth.js email provider backed by Pulsenote.
 *
 * Takes the same options as {@link Pulsenote} — including the `PULSENOTE_API_KEY`
 * fallback — or `{ client }` to reuse one you already built.
 */
export function PulsenoteProvider(config: PulsenoteAuthConfig = {}): PulsenoteEmailProvider {
  const { client, from, maxAge, subject, html, text, ...clientOptions } = config;
  const pulsenote = client ?? new Pulsenote(clientOptions);

  return {
    id: 'pulsenote',
    type: 'email',
    name: 'Pulsenote',
    from: from ?? DEFAULT_FROM,
    maxAge: maxAge ?? 24 * 60 * 60,
    options: { ...config } as Record<string, unknown>,

    async sendVerificationRequest({ identifier, url, provider }) {
      const { host } = new URL(url);
      const params: PulsenoteMailParams = { url, host, email: identifier };

      const result = await pulsenote.notifications.send({
        to: identifier,
        from: provider.from ?? from,
        subject: (subject ?? defaultSubject)(params),
        html: (html ?? defaultHtml)(params),
        text: (text ?? defaultText)(params),
      });

      // A sign-in link that was rendered but never delivered leaves the user
      // staring at "check your email" forever, with nothing in any log to explain
      // it. Auth.js has no way to know, so surface it here — this is the one
      // failure mode a generic HTTP provider would miss.
      if (result.sandbox) {
        throw new Error(
          'Pulsenote: the sign-in link was rendered but NOT delivered, because your account has no ' +
            'verified sending domain. Verify one in Settings — no code changes are needed — or the ' +
            'user will wait for an email that never arrives.',
        );
      }
    },
  };
}
