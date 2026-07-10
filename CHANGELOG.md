# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-07-11

### Added

- Initial release. TypeScript/Node client for the Pulsenote data-plane API
  (`X-API-Key` auth), generated from the OpenAPI spec.
- `Pulsenote` client with `notifications`, `templates`, and `domains` groups.
- Typed models and `ApiError` for non-2xx responses (including `401` and `429`).

[Unreleased]: https://github.com/Pulsenote/pulsenote-node/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Pulsenote/pulsenote-node/releases/tag/v0.1.0
