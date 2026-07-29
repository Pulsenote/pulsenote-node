# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

First release. Nothing has been published to npm yet, so the entries below describe the
package as a whole rather than a delta.

The earlier 0.1.0 entry described a preview generated with `openapi-typescript-codegen`;
that generator is deprecated and the client was replaced before publication.

### Added

- `Pulsenote` client covering the `X-API-Key` data plane: `notifications`, `templates`
  and `domains`.
- Resource-style API with parameter objects — `notifications.send({ … })`,
  `templates.update(id, { … })`, `domains.verify(id)`.
- Discriminated union on `notifications.send`, so exactly one of `html`, `text`,
  `templateId` or `templateSlug` type-checks.
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
- ESM and CommonJS builds with types for both; zero runtime dependencies; Node 20+.
- Types generated from the OpenAPI spec with `openapi-typescript`, plus a
  spec-coverage test that fails when the API grows an endpoint the SDK does not map.

[Unreleased]: https://github.com/Pulsenote/pulsenote-node/commits/main
