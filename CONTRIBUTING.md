# Contributing

The SDK is hand-written on top of machine-generated types. Knowing which is which is
most of what you need.

## What's generated vs hand-written

- **Generated — do not edit.** `src/generated/**` (produced by `openapi-typescript`)
  and `openapi/pulsenote-public-api.json` (a verbatim copy of the spec the API
  publishes). Both are overwritten by `npm run generate`.
- **Hand-written — the actual SDK.** Everything else in `src/`: the transport
  (`http.ts`), the error hierarchy (`errors.ts`), the public types (`types.ts`), the
  resources (`resources/**`) and the client (`client.ts`).

The generated layer owns the *shapes*; the hand-written layer owns the *ergonomics*.

## Changing the API surface

The source of truth is the `api-gateway` service in
[`Pulsenote/microservices`](https://github.com/Pulsenote/microservices) — its NestJS
decorators produce the spec. Change the API there, let its CI export the spec, then:

```bash
npm ci
npm run generate                    # from https://pulsenote.eu/openapi.json
SKIP_SPEC_FETCH=1 npm run generate  # regenerate types from the committed spec only
```

The default URL is the copy the landing site publishes; `Pulsenote/microservices` is
private, so `raw.githubusercontent.com` needs a token. Note that
`api.pulsenote.eu/api-json` is the *full internal* spec (JWT endpoints included) — not
the data-plane spec this SDK targets.

Adding a new endpoint upstream will make `test/spec-coverage.test.ts` fail — by design.
Wire it up by hand:

1. Add the method to the right class in `src/resources/`.
2. Add its parameter/return types to `src/types.ts` (alias the generated schema type
   rather than redeclaring the shape).
3. Export anything new from `src/index.ts`.
4. Add a case to `CASES` in `test/spec-coverage.test.ts`.
5. Add behavioural tests to the matching `test/*.test.ts`.

### Is the new endpoint safe to retry?

`POST` is not replayed by default, because the API has no idempotency keys. If the new
`POST` is genuinely read-only or naturally repeatable, pass `idempotent: true` in the
request options — see `templates.render` and `domains.verify`. If it has side effects,
leave it alone.

## Before opening a PR

```bash
npm run typecheck   # covers src/, test/ and examples/
npm test            # vitest — no network access, everything is mocked
npm run build       # tsup → ESM + CJS + .d.ts
```

Tests must not hit the network. Use `createTestClient` from `test/helpers.ts`.

## Releasing

1. Bump `version` in `package.json` **and** `VERSION` in `src/version.ts`
   (`test/version.test.ts` fails if they disagree — the version ends up in the
   `User-Agent`).
2. Move the `Unreleased` section of `CHANGELOG.md` under the new version.
3. Merge, then cut a GitHub release. `.github/workflows/sdk_publish.yaml` builds and
   publishes to npm.
