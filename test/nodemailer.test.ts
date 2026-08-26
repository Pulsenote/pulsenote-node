import { describe, expect, it } from 'vitest';
import nodemailer from 'nodemailer';
import { pulsenoteTransport } from '../src/nodemailer.js';
import { createTestClient } from './helpers.js';

/**
 * Driven through a real `nodemailer.createTransport()`, not a hand-rolled stand-in:
 * the point of this transport is that Nodemailer accepts it, so the contract that
 * matters is Nodemailer's, not our reading of it.
 */
function harness(response: Parameters<typeof createTestClient>[0]) {
  const { client, requests } = createTestClient(response);
  const transport = nodemailer.createTransport(pulsenoteTransport({ client }) as never);
  return { transport, requests };
}

const accepted = { status: 202, body: { id: 'n-1', status: 'QUEUED', from: 'noreply@acme.com' } };

describe('nodemailer transport', () => {
  it('is accepted by nodemailer and reports itself', () => {
    const t = pulsenoteTransport({ client: createTestClient(accepted).client });
    expect(t.name).toBe('pulsenote');
    expect(t.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  // Payload's email adapter verifies on boot by default. Without verify() nodemailer
  // resolves false there, which reads as a broken transport.
  it('verifies credentials against the API rather than answering blindly', async () => {
    const { transport, requests } = harness({ status: 200, body: [] });

    await expect(transport.verify()).resolves.toBe(true);
    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.url.pathname).toBe('/api/v1/domains');
  });

  it('fails verification on a bad key, at boot rather than at first send', async () => {
    const { transport } = harness({ status: 401, body: { message: 'Invalid API key' } });

    await expect(transport.verify()).rejects.toThrow();
  });

  it('sends a single recipient through the send endpoint', async () => {
    const { transport, requests } = harness(accepted);

    const info = await transport.sendMail({
      from: 'Acme <noreply@acme.com>',
      to: 'greg@example.com',
      subject: 'Welcome',
      html: '<b>Hi</b>',
      text: 'Hi',
    });

    expect(requests[0]?.url.pathname).toBe('/api/v1/notifications/send');
    expect(requests[0]!.body).toEqual({
      to: 'greg@example.com',
      from: 'Acme <noreply@acme.com>',
      subject: 'Welcome',
      html: '<b>Hi</b>',
      text: 'Hi',
    });
    expect(info.messageId).toBe('n-1');
    expect(info.accepted).toEqual(['greg@example.com']);
  });

  it('fans several recipients out through the batch endpoint', async () => {
    const { transport, requests } = harness({
      status: 202,
      body: {
        total: 2,
        queued: 2,
        rejected: 0,
        results: [
          { index: 0, status: 'queued', id: 'a' },
          { index: 1, status: 'queued', id: 'b' },
        ],
      },
    });

    await transport.sendMail({
      from: 'noreply@acme.com',
      to: ['a@example.com', 'b@example.com'],
      subject: 'Batch',
      text: 'hi',
    });

    expect(requests[0]?.url.pathname).toBe('/api/v1/notifications/batch');
    const body = requests[0]!.body as { messages: Array<{ to: string }> };
    expect(body.messages.map((m) => m.to)).toEqual(['a@example.com', 'b@example.com']);
  });

  it('forwards cc, bcc and replyTo', async () => {
    const { transport, requests } = harness(accepted);

    await transport.sendMail({
      from: 'noreply@acme.com',
      to: 'greg@example.com',
      subject: 'x',
      text: 'y',
      cc: 'cc@example.com',
      bcc: ['bcc1@example.com', 'bcc2@example.com'],
      replyTo: 'reply@example.com',
    });

    const body = requests[0]!.body as Record<string, unknown>;
    expect(body.cc).toEqual(['cc@example.com']);
    expect(body.bcc).toEqual(['bcc1@example.com', 'bcc2@example.com']);
    expect(body.replyTo).toEqual(['reply@example.com']);
  });

  it('omits copy fields when the message has none', async () => {
    const { transport, requests } = harness(accepted);

    await transport.sendMail({ from: 'noreply@acme.com', to: 'greg@example.com', subject: 'x', text: 'y' });

    const body = requests[0]!.body as Record<string, unknown>;
    expect(body).not.toHaveProperty('cc');
    expect(body).not.toHaveProperty('bcc');
    expect(body).not.toHaveProperty('replyTo');
    expect(body).not.toHaveProperty('attachments');
  });

  // The case that made this transport unusable for real apps: a mail with an
  // invoice attached.
  it('encodes a Buffer attachment as base64', async () => {
    const { transport, requests } = harness(accepted);

    await transport.sendMail({
      from: 'noreply@acme.com',
      to: 'greg@example.com',
      subject: 'Invoice',
      text: 'attached',
      attachments: [
        { filename: 'invoice.pdf', content: Buffer.from('invoice bytes'), contentType: 'application/pdf' },
      ],
    });

    const body = requests[0]!.body as { attachments: Array<Record<string, string>> };
    expect(body.attachments).toHaveLength(1);
    expect(body.attachments[0]!.filename).toBe('invoice.pdf');
    expect(body.attachments[0]!.contentType).toBe('application/pdf');
    expect(Buffer.from(body.attachments[0]!.content!, 'base64').toString()).toBe('invoice bytes');
  });

  it('encodes a plain string attachment rather than assuming it is already base64', async () => {
    const { transport, requests } = harness(accepted);

    await transport.sendMail({
      from: 'noreply@acme.com',
      to: 'greg@example.com',
      subject: 'Notes',
      text: 'attached',
      attachments: [{ filename: 'notes.txt', content: 'hello world' }],
    });

    const body = requests[0]!.body as { attachments: Array<Record<string, string>> };
    expect(Buffer.from(body.attachments[0]!.content!, 'base64').toString()).toBe('hello world');
  });

  it('passes through content the caller already encoded', async () => {
    const { transport, requests } = harness(accepted);
    const encoded = Buffer.from('already encoded').toString('base64');

    await transport.sendMail({
      from: 'noreply@acme.com',
      to: 'greg@example.com',
      subject: 'Notes',
      text: 'attached',
      attachments: [{ filename: 'notes.txt', content: encoded, encoding: 'base64' }],
    });

    const body = requests[0]!.body as { attachments: Array<Record<string, string>> };
    expect(body.attachments[0]!.content).toBe(encoded);
  });

  it('maps cid to contentId so inline images keep working', async () => {
    const { transport, requests } = harness(accepted);

    await transport.sendMail({
      from: 'noreply@acme.com',
      to: 'greg@example.com',
      subject: 'Logo',
      html: '<img src="cid:logo">',
      attachments: [{ filename: 'logo.png', content: Buffer.from('png'), cid: 'logo' }],
    });

    const body = requests[0]!.body as { attachments: Array<Record<string, string>> };
    expect(body.attachments[0]!.contentId).toBe('logo');
  });

  // These are resolved inside Nodemailer's own transports, so we never see the
  // bytes. Failing loudly beats sending a mail with the attachment missing.
  it.each([
    ['path', { path: '/tmp/invoice.pdf' }],
    ['href', { href: 'https://example.com/invoice.pdf' }],
  ])('refuses an attachment supplied by %s and sends nothing', async (label, source) => {
    const { transport, requests } = harness(accepted);

    await expect(
      transport.sendMail({
        from: 'noreply@acme.com',
        to: 'greg@example.com',
        subject: 'x',
        text: 'y',
        attachments: [{ filename: 'invoice.pdf', ...source }],
      }),
    ).rejects.toThrow(new RegExp(label));

    expect(requests).toHaveLength(0);
  });

  it('sends copies once when fanning out to several recipients', async () => {
    const { transport, requests } = harness({
      status: 202,
      body: {
        total: 2,
        queued: 2,
        rejected: 0,
        results: [
          { index: 0, status: 'queued', id: 'a' },
          { index: 1, status: 'queued', id: 'b' },
        ],
      },
    });

    await transport.sendMail({
      from: 'noreply@acme.com',
      to: ['a@example.com', 'b@example.com'],
      subject: 'Batch',
      text: 'hi',
      cc: 'cc@example.com',
      replyTo: 'reply@example.com',
      attachments: [{ filename: 'invoice.pdf', content: Buffer.from('bytes') }],
    });

    const body = requests[0]!.body as { messages: Array<Record<string, unknown>> };

    // One copy for the cc'd address, not one per recipient.
    expect(body.messages[0]!.cc).toEqual(['cc@example.com']);
    expect(body.messages[1]).not.toHaveProperty('cc');

    for (const message of body.messages) {
      expect(message.replyTo).toEqual(['reply@example.com']);
      expect(message.attachments).toHaveLength(1);
    }
  });

  it('refuses a message with no body instead of letting the API reject it', async () => {
    const { transport, requests } = harness(accepted);

    await expect(
      transport.sendMail({ from: 'noreply@acme.com', to: 'greg@example.com', subject: 'empty' }),
    ).rejects.toThrow(/no body/);

    expect(requests).toHaveLength(0);
  });
});
