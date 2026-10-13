# iris-clients

Browser-first Iris messaging client — COD-517 pilot.

Expo 57 / expo-router 57 / react-native-web. Displays authenticated threads from an Iris instance. Messages/send/contacts (COD-518) are deferred and not stubbed here.

## What this is

A read-only threads list that:
- Authenticates to any Iris instance with a bearer token (in-memory only)
- Lists threads with provider, title, unread count, and date
- Paginates via explicit Load More (cursor-based, tie-safe)
- Surfaces loading / empty / error / retry / logout states
- On 401: shows Reconnect prompt in addition to Retry

## Prerequisites

- Node 24+ (hosted verification uses Node 26)
- npm 11+
- `npx expo install --check` must exit 0 before any PR

## Setup

```sh
npm ci
npx expo install --check   # must show "Dependencies are up to date"
```

## Development

```sh
npm run web               # Expo dev server (Metro)
```

## Production / CI

```sh
npm run build:web          # static export -> dist/
npm run typecheck          # tsc --noEmit (zero errors required)
npm test                   # jest unit tests
npx playwright install chromium
npm run test:browser
```

## Environment

No runtime env vars. The endpoint URL and bearer token are entered in the UI at runtime and held **only in module-level memory** for the tab lifetime. They are never written to localStorage, sessionStorage, cookies, or URL params.

## Endpoint URL policy

| Scheme | Host | Allowed? |
|--------|------|----------|
| https:// | any | Yes |
| http:// | localhost, 127.0.0.1, ::1 | Yes (loopback) |
| http:// | 100.64.0.0–100.127.255.255 | Yes (Tailscale CGNAT) |
| http:// | *.ts.net | Yes (Tailscale MagicDNS) |
| http:// | *.local, *.internal, other | **Rejected** |
| ftp://, ws://, etc. | any | **Rejected** |

Rationale: `.local` and `.internal` are not proof of a real tailnet. Only actual Tailscale 100.64/10 IPs and `*.ts.net` MagicDNS names are trusted for unencrypted HTTP. All other non-loopback hosts require HTTPS.

## Auth token safety

- Token is stored in a module-level JS variable only
- Token is never logged, included in error messages, or appended to URLs
- Token is sent only in the `Authorization: Bearer <token>` request header
- On logout the variable is set to null; in-flight requests are discarded via generation counter

## CORS for local development

When using http://localhost:PORT as the endpoint, ensure your Iris instance has CORS headers permitting `http://localhost:8090` (or your static-serve port). For production use HTTPS with your domain.

## SDK

`@techgod/iris-client@0.4.0` — npm registry, integrity verified in package-lock.json.

Thread fields used: `id` (UUID, mandatory), `source` (mandatory), `last_message_at` (RFC-3339, mandatory), `provider_instance` (optional), `title` (optional), `unread_count` (optional).

Pagination cursor format: `last_message_at|source|id` (tie-safe per API contract).

## Audit and acceptance boundary

The measured `npm audit --omit=dev` baseline reports **25 findings: 15 high, 10 moderate, 0 critical**. These include transitive Expo/Metro build-tool paths (node-forge signature validation and braces denial of service), and router query-string/decode-uri-component and native tooling dependencies. They are **not accepted as production-safe**. CI currently rejects critical findings and reports the full audit; its green result is a functional gate, not a clean security audit. Review patched upstream or narrowly compatible dependency remedies before any release/deployment. Do not blindly apply `npm audit fix --force`: the returned plan includes incompatible major downgrades, and is not the only possible remediation strategy. Audit counts are the observed initial baseline, not a promise they remain unchanged.

Lockfile peer resolution is explicit in `.npmrc` (`legacy-peer-deps=true`) because the initial Expo/Jest peer graph needs it. `expo install --check` and actual browser export/test gates check compatibility; this workaround remains visible rather than a hidden install flag.

Fixture browser tests prove the generated SDK request, bearer header, pagination and UI handling against synthetic loopback HTTP. They do not prove a deployed Iris instance accepts browser origins or credentials. No production inbox was accessed. Live CORS/auth integration and tailnet-only hosting are separate acceptance gates. This PR is manual-review only and is not a deployment/release authorization.

## Agent context

`.creed/config/` is canonical; root `AGENTS.md` is generated with released Creed v0.4.1, agents target only. Install via `go install github.com/techgodhq/creed@v0.4.1`; run `creed validate && creed diff`.

## License

MIT — see LICENSE.
