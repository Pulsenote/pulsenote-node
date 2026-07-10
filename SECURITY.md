# Security Policy

## Reporting a vulnerability

Please report security issues privately to **security@pulsenote.eu**. Do not open a
public GitHub issue for security reports. We aim to acknowledge reports within a few
business days.

## Handling API keys

This SDK authenticates with a tenant API key (`pk_live_…` / `pk_test_…`) sent as the
`X-API-Key` header. Keep keys server-side:

- Load the key from an environment variable or secret store — never hardcode it.
- Do not ship a `pk_live_` key in browser/frontend bundles.
- Rotate keys via the Pulsenote dashboard if one is exposed.
