import { describe, expect, it } from 'vitest';
import { PulsenoteProvider } from '../src/auth.js';
import { createTestClient } from './helpers.js';

const accepted = { status: 202, body: { id: 'n-1', status: 'QUEUED', from: 'login@acme.com' } };

function send(responder: Parameters<typeof createTestClient>[0], config = {}) {
  const { client, requests } = createTestClient(responder);
  const provider = PulsenoteProvider({ client, from: 'login@acme.com', ...config });
  return { provider, requests };
}

const request = {
  identifier: 'greg@example.com',
  url: 'https://acme.com/api/auth/callback/pulsenote?token=abc',
  provider: { from: 'login@acme.com' },
};

describe('Auth.js provider', () => {
  it('exposes the shape Auth.js expects from an email provider', () => {
    const { provider } = send(accepted);
    expect(provider.id).toBe('pulsenote');
    expect(provider.type).toBe('email');
    expect(provider.maxAge).toBe(24 * 60 * 60);
    expect(typeof provider.sendVerificationRequest).toBe('function');
  });

  it('sends the sign-in link with both HTML and text bodies', async () => {
    const { provider, requests } = send(accepted);

    await provider.sendVerificationRequest(request);

    const body = requests[0]!.body as Record<string, string>;
    expect(requests[0]!.url.pathname).toBe('/api/v1/notifications/send');
    expect(body.to).toBe('greg@example.com');
    expect(body.from).toBe('login@acme.com');
    // The host, not the raw URL — that is what a user recognises.
    expect(body.subject).toBe('Sign in to acme.com');
    expect(body.html).toContain(request.url);
    // Plain text matters: it is what spam filters read.
    expect(body.text).toContain(request.url);
  });

  it('escapes the URL in the HTML body', async () => {
    const { provider, requests } = send(accepted);

    await provider.sendVerificationRequest({
      ...request,
      url: 'https://acme.com/cb?token=a"><script>alert(1)</script>',
    });

    const html = (requests[0]!.body as Record<string, string>).html!;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  /**
   * The failure this provider exists to catch. A rendered-but-undelivered magic
   * link leaves the user on "check your email" forever, and Auth.js has no way to
   * know — it would report success.
   */
  it('throws when the link was sandboxed rather than delivered', async () => {
    const { provider } = send({
      status: 202,
      body: { id: 'n-sbx', status: 'SANDBOX', from: 'login@acme.com', sandbox: true, message: 'not delivered' },
    });

    await expect(provider.sendVerificationRequest(request)).rejects.toThrow(/NOT delivered/);
  });

  it('lets the caller override subject and bodies', async () => {
    const { provider, requests } = send(accepted, {
      subject: ({ host }: { host: string }) => `Log in — ${host}`,
      html: ({ email }: { email: string }) => `<b>${email}</b>`,
      text: () => 'plain',
    });

    await provider.sendVerificationRequest(request);

    const body = requests[0]!.body as Record<string, string>;
    expect(body.subject).toBe('Log in — acme.com');
    expect(body.html).toBe('<b>greg@example.com</b>');
    expect(body.text).toBe('plain');
  });

  it('prefers the from Auth.js passes over the configured one', async () => {
    const { provider, requests } = send(accepted);

    await provider.sendVerificationRequest({ ...request, provider: { from: 'override@acme.com' } });

    expect((requests[0]!.body as Record<string, string>).from).toBe('override@acme.com');
  });
});
