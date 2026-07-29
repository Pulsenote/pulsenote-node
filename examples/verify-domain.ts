/**
 * Registering a sender domain and checking its DNS state.
 *
 *   PULSENOTE_API_KEY=pk_live_... npx tsx examples/verify-domain.ts mail.acme.com
 */
import { ConflictError, Pulsenote } from 'pulsenote';

const pulsenote = new Pulsenote({ apiKey: process.env.PULSENOTE_API_KEY });
const hostname = process.argv[2] ?? 'mail.acme.com';

async function main() {
  // 1. Register the domain (or reuse it if it is already there).
  let domain = await pulsenote.domains
    .add({ domain: hostname, fromEmail: `noreply@${hostname}` })
    .catch(async (error: unknown) => {
      if (!(error instanceof ConflictError)) throw error;
      const existing = (await pulsenote.domains.list()).find((d) => d.domain === hostname);
      if (!existing) throw error;
      return existing;
    });

  // 2. Publish these records with your DNS provider.
  const { records } = await pulsenote.domains.dnsRecords(domain.id);
  for (const record of records) {
    console.log(`${record.type.padEnd(5)} ${record.name} → ${record.value}   (${record.purpose})`);
  }

  // Or hand the whole thing to whoever runs your zone:
  const zoneFile = await pulsenote.domains.zoneFile(domain.id);
  console.log(`\n--- BIND zone file ---\n${zoneFile}`);

  // 3. Once the records have propagated, ask Pulsenote to re-check.
  domain = await pulsenote.domains.verify(domain.id);
  console.log(
    `${domain.domain}: ${domain.status} ` +
      `(spf=${domain.spfVerified} dkim=${domain.dkimVerified} dmarc=${domain.dmarcVerified})`,
  );

  if (domain.status !== 'VERIFIED') {
    console.log('DNS has not propagated yet — run this again in a few minutes.');
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
