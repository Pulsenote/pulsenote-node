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

  // A vanished attachment surfaces as a customer complaint weeks later, not a stack
  // trace — so these must fail loudly and send nothing.
  it.each([
    ['cc', { cc: 'cc@example.com' }],
    ['bcc', { bcc: 'bcc@example.com' }],
    ['replyTo', { replyTo: 'reply@example.com' }],
    ['attachments', { attachments: [{ filename: 'invoice.pdf', content: 'bytes' }] }],
  ])('refuses %s and sends nothing', async (label, extra) => {
    const { transport, requests } = harness(accepted);

    await expect(
      transport.sendMail({ from: 'noreply@acme.com', to: 'greg@example.com', subject: 'x', text: 'y', ...extra }),
    ).rejects.toThrow(new RegExp(label));

    expect(requests).toHaveLength(0);
  });

  it('refuses a message with no body instead of letting the API reject it', async () => {
    const { transport, requests } = harness(accepted);

    await expect(
      transport.sendMail({ from: 'noreply@acme.com', to: 'greg@example.com', subject: 'empty' }),
    ).rejects.toThrow(/no body/);

    expect(requests).toHaveLength(0);
  });
});
