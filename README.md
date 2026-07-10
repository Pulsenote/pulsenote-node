# pulsenote-node

Official TypeScript/Node SDK for the [Pulsenote](https://pulsenote.eu) email API.
Published to npm as [`pulsenote`](https://www.npmjs.com/package/pulsenote).

> The `src/` client is **generated** from the Pulsenote OpenAPI spec — do not hand-edit
> generated files (everything except `src/client.ts` and `src/main.ts`). The repository
> itself is provisioned by Terraform in the `infrastructure` repo
> (`terraform/GitHub/pulsenote-node`).

## Install

```bash
npm install pulsenote
```

## Usage

```ts
import { Pulsenote } from "pulsenote";

const pulsenote = new Pulsenote({ apiKey: process.env.PULSENOTE_API_KEY! });

const res = await pulsenote.notifications.sendNotification({
  to: "greg@example.com",
  subject: "Welcome",
  html: "<b>Hello from Pulsenote</b>",
});

console.log(res.id, res.status); // -> "<uuid>", "QUEUED"
```

The client exposes three groups matching the API's data plane:

- `pulsenote.notifications` — `sendNotification`, `listNotifications`, `getNotification`, `getNotificationStats`
- `pulsenote.templates` — `listTemplates`, `getTemplate`, `createTemplate`, `updateTemplate`, `deleteTemplate`, `renderTemplate`, `listTemplateLocales`
- `pulsenote.domains` — `listDomains`, `addDomain`, `verifyDomain`, `getDomainDnsRecords`, `getDomainZoneFile`, `deleteDomain`

Non-2xx responses (incl. `401` and `429`) throw a typed `ApiError` you can catch:

```ts
import { Pulsenote, ApiError } from "pulsenote";

try {
  await pulsenote.notifications.sendNotification({ to, subject, html });
} catch (e) {
  if (e instanceof ApiError && e.status === 429) {
    // rate limited — back off and retry
  }
}
```

## Scope

v1 covers the **data plane** — the endpoints authenticated with your `X-API-Key`
(notifications, templates, domains). Account-management endpoints (team, billing,
auth), which use JWT auth, are intentionally out of scope for the SDK.

## How generation works

```
api-gateway (OpenAPI)  ─►  openapi/pulsenote-api.json  ─►  openapi-typescript-codegen  ─►  src/  ─►  npm
    source of truth          versioned spec artifact              generator                          publish
```

- **Source of truth** is the `api-gateway` service. Its CI runs `npm run spec:export`
  and publishes the full spec; this repo filters it to the data plane.
- **`scripts/generate.mjs`** (run via `npm run generate`) fetches `SPEC_URL`
  (or reads the committed `openapi/pulsenote-api.json`), filters to `X-API-Key`
  operations, and runs the generator into `src/`.
- **`.github/workflows/sdk_generation.yaml`** regenerates weekly / on demand and opens
  a PR with the diff.
- **`.github/workflows/sdk_publish.yaml`** builds and `npm publish`es the version in
  `package.json` when a GitHub release is published.

## Local regeneration

```bash
npm ci
SPEC_URL=https://pulsenote-api.sysgp.eu/api-json npm run generate  # or omit SPEC_URL to use the committed spec
npm run build
```

## Required secrets

Set at the **org level** (`Pulsenote`) so every `pulsenote-*` SDK repo inherits it,
or per-repo via Terraform (`actions_secrets` on the `github-repository` module):

| Secret | Purpose |
|--------|---------|
| `NPM_TOKEN` | Publishing to the npm `pulsenote` package |

`GITHUB_TOKEN` is provided automatically by Actions.

## Generator choice

This repo uses the OSS `openapi-typescript-codegen` (Option B in ADR-0001) — zero
external accounts, fully reproducible in CI. If richer ergonomics (branded retries,
pagination iterators, per-language code samples) become worth a subscription, the
managed path is Speakeasy (Option C); the ADR keeps that config as an upgrade option.

## Examples

See [`examples/send-email.ts`](examples/send-email.ts) for a runnable send + list example.

## Development

```bash
npm ci
npm run build      # compile to dist/
npm test           # build + run the smoke tests
npm run typecheck  # type-check without emitting
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the generated-vs-hand-written split and the
regeneration workflow, and [CHANGELOG.md](CHANGELOG.md) for release notes.

## License

[MIT](LICENSE) © GP IT-Tech
