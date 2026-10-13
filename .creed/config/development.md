# Development

Use Node 24 or newer supported Node LTS with npm. Install the lockfile with `npm ci`; no local-file dependency substitutions.

Run `npx expo install --check`, `npm run typecheck`, `npm test -- --ci --runInBand`, `npm run build:web`, then `npm run test:browser`. Browser tests exercise the exported static UI and real loopback HTTP fixture; they are not live production auth/CORS acceptance.

Agent context source is .creed/config/. Never hand-edit AGENTS.md. Install `github.com/techgodhq/creed@v0.4.1`, then run `creed validate`, `creed sync`, and `creed diff`. Only agents target is enabled. No context skills are emitted in this pilot.

Stage source paths explicitly; never add node_modules, dist, .expo, .creed/.outputs, test-results or playwright-report. Keep generated build outputs ignored. Validate the final committed tree and exact remote PR SHA.

The upstream dependency audit is an unresolved release/deployment blocker, not a claim of clean security. Do not use blind force downgrades to manufacture green audit results.
