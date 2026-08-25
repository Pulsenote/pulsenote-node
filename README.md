# pulsenote-node

Official TypeScript/Node SDK for the [Pulsenote](https://pulsenote.eu) email API.
Published to npm as [`pulsenote`](https://www.npmjs.com/package/pulsenote).

- Zero runtime dependencies — built on the platform `fetch`
- ESM and CommonJS, with types for both
- Typed error hierarchy, automatic retries with backoff, per-request timeouts and `AbortSignal`
- Lazy pagination over notification history
- Types derived from the OpenAPI spec, so they cannot drift from the API

## Install

```bash
npm install pulsenote
```

Requires Node 22 or newer. Node 20 reached end-of-life in April 2026 and is not tested.

## Quick start

```ts
import { Pulsenote } from 'pulsenote';

const pulsenote = new Pulsenote({ apiKey: process.env.PULSENOTE_API_KEY });

const { id, status } = await pulsenote.notifications.send({
  to: 'greg@example.com',
  from: 'noreply@acme.com',
  subject: 'Welcome',
  html: '<h1>Hi</h1>',
});

console.log(id, status); // "<uuid>" "QUEUED"  (or "SANDBOX" — see below)
```

`apiKey` falls back to `PULSENOTE_API_KEY` and `baseUrl` to `PULSENOTE_BASE_URL`, so
`new Pulsenote()` works when both are in the environment.

> **Sending is asynchronous.** `send` resolves once the API has accepted the message
> (HTTP 202), so a live send comes back `QUEUED`. Read the record back with
> `notifications.retrieve(id)` to see whether it was `DELIVERED`, `FAILED` or `BOUNCED`.

### Sandbox — your first send probably won't be delivered

Pulsenote only sends from **your own** verified domain; there is no shared sending
address. Until you have verified one, sends are accepted and fully rendered but
**never delivered**, and come back as sandbox instead of failing:

```ts
const result = await pulsenote.notifications.send({ /* … */ });

if (result.sandbox) {
  // status === 'SANDBOX' — rendered, stored for preview, not delivered.
  console.warn(result.message);
}
```

This exists so you can wire up the integration *before* pointing production DNS at
an email vendor. The `from` you pass is echoed back untouched, so **going live is
just verifying a domain — no code changes**. Sandbox is capped at 50 messages/month
and does not consume your plan allowance.

Verify a domain with [`pulsenote.domains`](#pulsenotedomains), or in Settings →
Domains. A subdomain such as `notify.yourcompany.com` is recommended: its DNS
records are separate from your main domain, so publishing them cannot affect the
deliverability of your existing company email.

> Guard against shipping in sandbox by asserting on it in your integration tests:
> `expect(result.sandbox).toBeUndefined()`.

## Nodemailer transport

Everything already written against Nodemailer keeps working — including the mail
layers of frameworks built on top of it. One line changes:

```bash
npm install pulsenote nodemailer
```

```ts
import nodemailer from 'nodemailer';
import { pulsenoteTransport } from 'pulsenote/nodemailer';

const transport = nodemailer.createTransport(pulsenoteTransport());

await transport.sendMail({
  from: 'Acme <noreply@acme.com>',
  to: 'greg@example.com',
  subject: 'Welcome',
  html: '<h1>Hi</h1>',
});
```

`pulsenoteTransport()` takes the same options as `new Pulsenote()` — including the
`PULSENOTE_API_KEY` fallback — or `{ client }` to reuse one you already built.

### What it will not send

The API carries `to`, `from`, `subject`, `html` and `text`. There is **no `cc`,
`bcc`, `replyTo` or attachment support**, and the transport **throws** rather than
dropping them:

```
Pulsenote: cannot send cc, attachments — the API has no field for them. Nothing was
sent, deliberately: dropping them silently would deliver a message that differs from
the one you composed.
```

A vanished attachment is a worse failure than an error at send time, and one you
would not discover until a customer complained. Route those messages through a
different transport:

```ts
const smtp = nodemailer.createTransport({ host: 'smtp.example.com' });
await smtp.sendMail({ /* … with attachments … */ });
```

### Several recipients

Pulsenote models one recipient per message, so `to: ['a@x.com', 'b@x.com']` is fanned
out through the batch endpoint — one message each, up to `MAX_BATCH_SIZE`.
**Recipients therefore do not see one another in the `To` header.** For transactional
mail that is usually what you want; it is a behaviour change if you were relying on a
shared `To`.

## CMS platforms

Payload and Strapi both send through Nodemailer, so they need no Pulsenote-specific
plugin — the transport above plugs straight in.

### Payload

```ts
import nodemailer from 'nodemailer';
import { nodemailerAdapter } from '@payloadcms/email-nodemailer';
import { pulsenoteTransport } from 'pulsenote/nodemailer';

export default buildConfig({
  email: nodemailerAdapter({
    transport: nodemailer.createTransport(pulsenoteTransport()),
    defaultFromAddress: 'noreply@yourcompany.com',
    defaultFromName: 'Your Company',
  }),
});
```

Payload verifies the transport on boot. `pulsenoteTransport()` implements
`verify()` against the API, so a wrong or revoked key fails at boot rather than at
the first send — and you do **not** need `skipVerify`.

### Strapi

```js
// config/plugins.js
const { pulsenoteTransport } = require('pulsenote/nodemailer');

module.exports = () => ({
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: pulsenoteTransport(),
      settings: { defaultFrom: 'noreply@yourcompany.com' },
    },
  },
});
```

> **Do not set `settings.defaultReplyTo`.** Strapi attaches it to every message, and
> the API has no `replyTo` field, so the transport refuses rather than dropping it —
> which would mean every send fails. Leave it unset.

## Auth.js / NextAuth provider

Magic links and password resets are the core of what this API is for, so this is the
shortest path from evaluating Pulsenote to being signed in:

```ts
import NextAuth from 'next-auth';
import { PulsenoteProvider } from 'pulsenote/auth';

export const { handlers, signIn, auth } = NextAuth({
  providers: [PulsenoteProvider({ from: 'login@yourcompany.com' })],
});
```

Modelled on the HTTP-based providers Auth.js ships (Resend, Postmark, SendGrid)
rather than the Nodemailer one — no SMTP, no extra dependency. `PulsenoteProvider()`
takes the same options as `new Pulsenote()`, including the `PULSENOTE_API_KEY`
fallback, or `{ client }` to reuse one you already built.

### It fails loudly when a link would not arrive

If your account has no verified sending domain, the message is rendered but never
delivered. Auth.js has no way to know that: it would report success and the user
would sit on "check your email" forever, with nothing in any log to explain it.

So the provider **throws** instead:

```
Pulsenote: the sign-in link was rendered but NOT delivered, because your account has
no verified sending domain. Verify one in Settings — no code changes are needed — or
the user will wait for an email that never arrives.
```

### Customising the email

A reasonable default template ships with the provider. Override any part of it:

```ts
PulsenoteProvider({
  from: 'login@yourcompany.com',
  subject: ({ host }) => `Your ${host} sign-in link`,
  html: ({ url, email }) => renderMyTemplate({ url, email }),
  text: ({ url }) => `Sign in: ${url}`,
});
```

`text` is worth setting alongside `html` — it is what spam filters read.

> Prefer to go through Nodemailer? [`pulsenote/nodemailer`](#nodemailer-transport)
> works with Auth.js's `Nodemailer` provider instead.

## Resources

### `pulsenote.notifications`

| Method | Endpoint |
|---|---|
| `send(params)` | `POST /api/v1/notifications/send` |
| `sendBatch(messages)` | `POST /api/v1/notifications/batch` |
| `retrieve(id)` | `GET /api/v1/notifications/{id}` |
| `list({ page, limit, status, search })` | `GET /api/v1/notifications` |
| `iterate({ ... })` | lazy `AsyncGenerator` over every page |
| `listAll({ ... })` | every page collected into an array |
| `stats()` | `GET /api/v1/notifications/stats` |

Exactly one content source must be supplied to `send` — `html`, `text`, `templateId`
or `templateSlug`. The type system enforces it:

```ts
await pulsenote.notifications.send({
  to: 'greg@example.com',
  templateSlug: 'welcome',
  locale: 'pl',
  templateData: { name: 'Greg', plan: 'Pro' },
});
```

```ts
for await (const n of pulsenote.notifications.iterate({ status: 'BOUNCED' })) {
  console.log(n.recipient, n.failureReason);
}
```

`list` and `iterate` also accept `search`, which matches recipient or subject
case-insensitively.

Building the payload dynamically and cannot satisfy the union? Cast through the
looser `SendEmailPayload` type: `send(payload as SendEmailParams)`.

#### Batch sending

`sendBatch` queues up to 500 messages (`MAX_BATCH_SIZE`) in one request. Each message is
validated independently, so the batch is **partial-success**: one bad recipient rejects
that message and the rest still go out.

```ts
const batch = await pulsenote.notifications.sendBatch([
  { to: 'a@example.com', subject: 'Welcome', html: '<b>Hi</b>' },
  { to: 'b@example.com', templateSlug: 'welcome', locale: 'pl', templateData: { name: 'Greg' } },
]);

console.log(`${batch.queued}/${batch.total} queued`);

for (const result of batch.results) {
  // `status` discriminates the union — `error` and `id` narrow accordingly.
  if (result.status === 'rejected') console.error(result.index, result.error);
}
```

> A partly-failed batch still returns `202` and **does not throw** — check
> `batch.rejected` rather than assuming success. The promise only rejects for
> whole-request failures: bad key, quota exhausted, or a batch that is empty or over
> `MAX_BATCH_SIZE`.

### `pulsenote.templates`

| Method | Endpoint |
|---|---|
| `list({ locale })` | `GET /api/v1/templates` |
| `retrieve(id)` | `GET /api/v1/templates/{id}` |
| `listLocales(slug)` | `GET /api/v1/templates/slug/{slug}/locales` |
| `create(params)` | `POST /api/v1/templates` |
| `update(id, params)` | `PUT /api/v1/templates/{id}` |
| `delete(id)` | `DELETE /api/v1/templates/{id}` |
| `render(id, { data })` | `POST /api/v1/templates/{id}/render` |

`slug` is unique per tenant **and** locale, so reusing a slug with a different
`locale` creates a translation rather than a conflict.

### `pulsenote.domains`

| Method | Endpoint |
|---|---|
| `list()` | `GET /api/v1/domains` |
| `add(params)` | `POST /api/v1/domains` |
| `dnsRecords(id)` | `GET /api/v1/domains/{id}/dns-records` |
| `zoneFile(id)` | `GET /api/v1/domains/{id}/zone-file` (plain text) |
| `verify(id)` | `POST /api/v1/domains/{id}/verify` |
| `delete(id)` | `DELETE /api/v1/domains/{id}` |

You can only send from a `VERIFIED` domain, so the flow is `add` → publish the
returned DNS records → `verify`. See [`examples/verify-domain.ts`](examples/verify-domain.ts).

## Errors

Every failure rejects with a `PulsenoteError` subclass:

| Class | Status | Typical cause |
|---|---|---|
| `BadRequestError` | 400 | validation failed; `.validationErrors` lists each rule |
| `AuthenticationError` | 401 | missing, unknown or revoked API key |
| `PermissionDeniedError` | 403 | `from` is outside your verified domains, or a quota is exhausted |
| `NotFoundError` | 404 | no such notification / template / domain |
| `ConflictError` | 409 | domain already registered |
| `UnprocessableEntityError` | 422 | semantically invalid request |
| `RateLimitError` | 429 | `.retryAfter` (seconds) and `.rateLimit` quota |
| `ServerError` | 5xx | the API failed to process the request |
| `ConnectionError` | — | the request never reached the API |
| `TimeoutError` | — | subclass of `ConnectionError` |

```ts
import { PulsenoteError, RateLimitError } from 'pulsenote';

try {
  await pulsenote.notifications.send({ to, subject, html });
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(error.retryAfter, error.rateLimit.remainingPerMinute);
  } else if (error instanceof PulsenoteError) {
    console.error(error.status, error.message, error.body);
  } else {
    throw error;
  }
}
```

The API validates with `forbidNonWhitelisted`, so an unknown property is rejected as
hard as a missing one. `undefined` values are dropped before the request is sent, so
`{ locale: undefined }` is safe.

## Retries

The client retries after connection failures, timeouts, `408`, `429` and `5xx`, with
exponential backoff and jitter (`maxRetries: 2` by default).

`POST` is treated as unsafe: the API has no idempotency keys, so replaying
`notifications.send` would deliver the email twice. A `POST` is therefore only retried
on `429`, where the rate-limit guard rejected the request before it did any work. The
two read-only `POST` endpoints — `templates.render` and `domains.verify` — opt back in
internally.

`Retry-After` is honoured up to `maxRetryAfter` (30s). Beyond that the `RateLimitError`
is thrown so your own scheduler can decide what to do.

## Configuration

```ts
const pulsenote = new Pulsenote({
  apiKey: process.env.PULSENOTE_API_KEY,
  baseUrl: 'https://api.pulsenote.eu', // default
  timeout: 30_000,                     // ms, 0 disables
  maxRetries: 2,
  initialRetryDelay: 500,              // ms, doubled per attempt
  maxRetryDelay: 8_000,                // ms
  maxRetryAfter: 30_000,               // ms — longer waits are handed back to you
  headers: { 'X-Tenant': 'acme' },
  userAgentSuffix: 'acme-billing/2.1',
  fetch: myInstrumentedFetch,
  logger: { warn: (msg, meta) => log.warn(msg, meta) },
});
```

Every resource method takes per-call overrides as its last argument:

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 1_000);

await pulsenote.templates.list(
  { locale: 'pl' },
  { signal: controller.signal, timeout: 5_000, maxRetries: 0 },
);
```

Aborted requests are never retried and reject with the original `AbortError`.

Need an endpoint the resources do not cover yet?

```ts
const { data, status, headers, rateLimit } = await pulsenote.rawRequest({
  method: 'GET',
  path: '/api/v1/something-new',
});
```

## Scope

The SDK covers the **data plane** — the endpoints authenticated with your `X-API-Key`
(notifications, templates, domains). Account management (auth, team, billing, GDPR)
uses JWT auth and belongs to the dashboard, not to customer integrations, so it is
deliberately out of scope.

## How generation works

```
api-gateway (NestJS decorators)   source of truth
        │  npm run spec:export
        ▼
openapi/pulsenote-public-api.json (in Pulsenote/microservices)
        │  npm run generate  ── fetches the spec verbatim
        ▼
openapi/pulsenote-public-api.json (here) ──► src/generated/schema.d.ts
        │                                          │  hand-written resources
        └──────────────────────────────────────────┴──► npm publish
```

Only `src/generated/` is machine-written. The transport, resources, errors and types
are hand-written on top of the generated schema, which is what keeps the ergonomics
under our control while the shapes stay tied to the API.

`test/spec-coverage.test.ts` is the drift guard: it asserts that every operation in the
spec is reachable through a resource method and that each method hits exactly the path
and verb the spec declares. A new endpoint upstream fails the build until it is wired up.

```bash
npm run generate                                    # from https://pulsenote.eu/openapi.json
SPEC_URL=https://other.host/openapi.json npm run generate
SKIP_SPEC_FETCH=1 npm run generate                  # regenerate types only
```

The default spec URL is the copy the landing site publishes — `Pulsenote/microservices`
is private, so `raw.githubusercontent.com` 404s without a token. `api.pulsenote.eu/api-json`
serves the *full* internal spec (43 paths incl. JWT endpoints), not this one.

`.github/workflows/sdk_generation.yaml` runs this weekly and opens a PR with the diff.
`.github/workflows/sdk_publish.yaml` builds and publishes when a GitHub release is cut.

## Required secrets

Set at the **org level** (`Pulsenote`) so every `pulsenote-*` SDK repo inherits it, or
per-repo via Terraform (`actions_secrets` on the `github-repository` module):

| Secret | Purpose |
|---|---|
| `NPM_TOKEN` | Publishing the `pulsenote` package |

`GITHUB_TOKEN` is provided automatically by Actions.

## Development

```bash
npm ci
npm test           # vitest, no network
npm run typecheck
npm run build      # tsup → dist/ (ESM + CJS + .d.ts)
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the generated-vs-hand-written split and
[CHANGELOG.md](CHANGELOG.md) for release notes.

## License

[MIT](LICENSE) © GP IT-Tech
