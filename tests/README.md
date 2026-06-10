Up: [../README.md](../README.md)

# `tests` — integration tests (real API)

Higher-level tests that exercise the library against the live AI Gateway.
They skip automatically unless `AI_GATEWAY_API_KEY` (or
`VERCEL_OIDC_TOKEN`) is set:

```sh
bun run test:e2e        # = bun --env-file=.env.local test tests/
```

- [`recovery.test.ts`](./recovery.test.ts) — a real agent is given a
  history whose large tool result is truncated to an id-stamped stub,
  plus `cm.tools` / `cm.systemSuffix` from `createContextManagement`.
  Asserts it calls `fetch_full_result` with the stub's id and answers a
  question only the recovered body contains. (Keep fixture "secrets"
  innocuous — a credential-looking fixture makes the model refuse to
  repeat it, which is correct behavior but fails the assertion.)

Unit tests (offline, exhaustive) live as siblings in `../src/`.
