/**
 * Sending, error handling and pagination.
 *
 *   PULSENOTE_API_KEY=pk_live_... npx tsx examples/send-email.ts
 */
import { PermissionDeniedError, Pulsenote, PulsenoteError, RateLimitError } from 'pulsenote';

const pulsenote = new Pulsenote({ apiKey: process.env.PULSENOTE_API_KEY });

async function main() {
  // --- Raw HTML -----------------------------------------------------------
  const queued = await pulsenote.notifications.send({
    to: 'greg@example.com',
    from: 'noreply@acme.com',
    subject: 'Hello from Pulsenote',
    html: '<h1>Hi</h1><p>Sent with the Pulsenote Node SDK.</p>',
  });
  console.log(`Queued ${queued.id} from ${queued.from}`);

  // --- Stored template ----------------------------------------------------
  await pulsenote.notifications.send({
    to: 'greg@example.com',
    templateSlug: 'welcome',
    locale: 'pl',
    templateData: { name: 'Greg', plan: 'Pro' },
  });

  // --- Where did it end up? ----------------------------------------------
  // `send` returns as soon as the API accepts the message, so the status is
  // always QUEUED. Read it back to see the delivery outcome.
  const notification = await pulsenote.notifications.retrieve(queued.id);
  console.log(`${notification.recipient}: ${notification.status}`);

  // --- Pagination ---------------------------------------------------------
  for await (const bounced of pulsenote.notifications.iterate({ status: 'BOUNCED', limit: 100 })) {
    console.log(`Bounced: ${bounced.recipient} — ${bounced.failureReason ?? 'no reason given'}`);
  }

  const stats = await pulsenote.notifications.stats();
  console.log(`${stats.thisMonth} emails sent this month`);
}

main().catch((error: unknown) => {
  if (error instanceof RateLimitError) {
    console.error(`Rate limited. Retry in ${error.retryAfter ?? '?'}s.`, error.rateLimit);
  } else if (error instanceof PermissionDeniedError) {
    console.error('Sender rejected — verify the domain first:', error.message);
  } else if (error instanceof PulsenoteError) {
    console.error(`API error ${error.status ?? 'n/a'}: ${error.message}`);
  } else {
    throw error;
  }
  process.exitCode = 1;
});
