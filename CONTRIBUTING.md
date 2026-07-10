# Contributing

Most of this repo is **generated** from the Pulsenote OpenAPI spec, so the workflow is
a little different from a hand-written library.

## What's generated vs hand-written

- **Generated** (do not edit — changes are overwritten on the next regeneration):
  `src/PulsenoteCore.ts`, `src/core/**`, `src/models/**`, `src/services/**`, `src/index.ts`.
- **Hand-written** (safe to edit): `src/client.ts` (the `Pulsenote` facade) and
  `src/main.ts` (the package entry point).

## Changing the API surface

The source of truth is the API itself. To change what the SDK exposes, update the
`api-gateway` service (its OpenAPI annotations), then regenerate here:

```bash
npm ci
# from the committed spec:
npm run generate
# or from a live/hosted spec:
SPEC_URL=https://pulsenote-api.sysgp.eu/api-json npm run generate
npm run build
```

CI regenerates weekly and opens a PR automatically.

## Before opening a PR

```bash
npm run typecheck
npm run build
npm test
```

## Releasing

Bump the `version` in `package.json` (usually in the regeneration PR), merge, then cut a
GitHub release. The publish workflow builds and pushes the package to npm.
