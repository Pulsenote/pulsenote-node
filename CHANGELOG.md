# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-25

First stable release. 0.1.0 was published on 2026-07-29 as an early cut, so the entries
below describe the package as a whole rather than a delta against it.

The version before that described a preview generated with `openapi-typescript-codegen`;
that generator is deprecated and the client was replaced before publication.

### Added

- `Pulsenote` client covering the `X-API-Key` data plane: `notifications`, `templates`
  and `domains`.
- Resource-style API with parameter objects — `notifications.send({ … })`,
  `templates.update(id, { … })`, `domains.verify(id)`.
- Discriminated union on `notifications.send`, so exactly one of `html`, `text`,
  `templateId` or `templateSlug` type-checks.
- `notifications.sendBatch()` — up to 500 messages (`MAX_BATCH_SIZE`) per request, with a
  discriminated `BatchMessageResult` union so `status: 'rejected'` narrows to `error` and
  `status: 'queued'` narrows to `id`. Partial-success: it resolves with rejections rather
  than throwing, so check `rejected`.
- `search` filter on `notifications.list()`, `iterate()` and `listAll()` — matches
  recipient or subject, case-insensitive.
- Lazy pagination: `notifications.iterate()` and `notifications.listAll()`.
- Typed error hierarchy — `BadRequestError` (with `validationErrors`),
  `AuthenticationError`, `PermissionDeniedError`, `NotFoundError`, `ConflictError`,
  `UnprocessableEntityError`, `RateLimitError` (with `retryAfter` and `rateLimit`),
  `ServerError`, `ConnectionError` and `TimeoutError`.
- Automatic retries with exponential backoff and jitter, honouring `Retry-After`.
  `POST` is only replayed on `429` unless the endpoint is explicitly read-only, so a
  retried `notifications.send` can never deliver an email twice.
- Per-request timeouts, `AbortSignal` support and per-call overrides for `timeout`,
  `maxRetries` and `headers`.
- Rate-limit quota surfaced from the `X-RateLimit-*` headers on both successes
  (`rawRequest`) and `RateLimitError`.
- `rawRequest` / `request` escape hatches for endpoints the resources do not cover.
- ESM and CommonJS builds with types for both; zero runtime dependencies; Node 22+.
- Types generated from the OpenAPI spec with `openapi-typescript`, plus a
  spec-coverage test that fails when the API grows an endpoint the SDK does not map.
- Sandbox results on `notifications.send` / `sendBatch`: with no verified sending
  domain the API renders the message without delivering it and returns
  `status: 'SANDBOX'` with `sandbox: true` and an explanatory `message`, instead of
  raising `PermissionDeniedError`. The `from` you pass is echoed back, so going live
  is a domain verification rather than a code change. Documented in the README and
  pinned by tests, since the spec-coverage guard only catches new *operations*.
- `region` on `domains.add()` and on the returned `Domain` — pins which AWS region
  hosts the domain's SES identity (data residency). Picked up from the spec; the SDK
  had been missing it.

[Unreleased]: https://github.com/Pulsenote/pulsenote-node/compare/1.0.0...HEAD
[1.0.0]: https://github.com/Pulsenote/pulsenote-node/compare/0.1.0...1.0.0
[0.1.0]: https://github.com/Pulsenote/pulsenote-node/releases/tag/0.1.0
