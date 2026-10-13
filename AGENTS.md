# Iris Clients

Build an Iris-only browser-first Expo 57 / expo-router 57 / react-native-web client. Consume the generated npm @techgod/iris-client exactly 0.4.0; never generate a shadow API. The SDK uses opaque domain records, refined in this consumer.

COD-517 is a read-only authenticated threads pilot. Messages, sending, contacts, Android/iOS packaging and EAS remain deferred to explicitly authorized follow-ups. Do not add placeholder interaction surfaces.

Use synthetic loopback fixtures for acceptance; do not read personal inboxes or send messages. Tokens stay in tab memory, never persistent storage or URLs. Reject endpoint credentials, query strings and fragments. HTTP is restricted to loopback or explicitly chosen Tailscale addresses; address spelling alone does not prove network membership. HTTPS is preferred.

Work in a ticket worktree, preserve signed commits, and use reviewed branches/PRs. Manual review is required; do not auto-merge, release, publish npm packages, restart production Iris or change backend authentication/deployment from this pilot.

---

# Development

Use Node 24 or newer supported Node LTS with npm. Install the lockfile with `npm ci`; no local-file dependency substitutions.

Run `npx expo install --check`, `npm run typecheck`, `npm test -- --ci --runInBand`, `npm run build:web`, then `npm run test:browser`. Browser tests exercise the exported static UI and real loopback HTTP fixture; they are not live production auth/CORS acceptance.

Agent context source is .creed/config/. Never hand-edit AGENTS.md. Install `github.com/techgodhq/creed@v0.4.1`, then run `creed validate`, `creed sync`, and `creed diff`. Only agents target is enabled. No context skills are emitted in this pilot.

Stage source paths explicitly; never add node_modules, dist, .expo, .creed/.outputs, test-results or playwright-report. Keep generated build outputs ignored. Validate the final committed tree and exact remote PR SHA.

The upstream dependency audit is an unresolved release/deployment blocker, not a claim of clean security. Do not use blind force downgrades to manufacture green audit results.
