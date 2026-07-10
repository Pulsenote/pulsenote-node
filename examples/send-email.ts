/**
 * Minimal send example.
 *
 *   PULSENOTE_API_KEY=pk_live_... npx tsx examples/send-email.ts
 */
import { Pulsenote, ApiError } from "pulsenote";

const pulsenote = new Pulsenote({ apiKey: process.env.PULSENOTE_API_KEY! });

async function main() {
  try {
    const res = await pulsenote.notifications.sendNotification({
      to: "greg@example.com",
      subject: "Hello from Pulsenote",
      html: "<h1>Hi</h1><p>Sent via the Pulsenote Node SDK.</p>",
    });
    console.log(`Queued ${res.id} (${res.status})`);

    const page = await pulsenote.notifications.listNotifications(1, 5);
    console.log(`You have ${page.meta.total} notifications total.`);
  } catch (e) {
    if (e instanceof ApiError) {
      console.error(`API error ${e.status}:`, e.body);
      if (e.status === 429) console.error("Rate limited — back off and retry.");
    } else {
      throw e;
    }
  }
}

main();
