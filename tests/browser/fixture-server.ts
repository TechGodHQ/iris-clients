/**
 * Isolated loopback fixture HTTP server for browser integration tests.
 * Provides a real HTTP endpoint that the Iris SDK hits via actual network
 * requests. No production endpoints. Token validated in Authorization header.
 *
 * Supports CORS preflight so browser-exported Expo web app can call it.
 */
import http from "http";
import type { IncomingMessage, ServerResponse } from "http";

export const FIXTURE_PORT = 9999;
export const FIXTURE_TOKEN = "tok_fixture_test_abc123";
export const FIXTURE_ENDPOINT = `http://localhost:${FIXTURE_PORT}`;

// Valid synthetic thread fixtures — UUIDs, descending RFC-3339 timestamps
export const makeThread = (i: number) => ({
  id: `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`,
  source: "gmail",
  provider_instance: "pilot@example.invalid",
  title: `Thread ${i}`,
  last_message_at: `2026-10-${String(20 - (i % 20)).padStart(2, "0")}T10:00:0${i % 10}.000Z`,
  unread_count: i % 3 === 0 ? 2 : 0,
});

export const THREADS_PAGE1 = Array.from({ length: 20 }, (_, i) => makeThread(i));
export const THREADS_PAGE2 = [makeThread(20)];

type ScenarioMap = Record<string, () => { status: number; body: unknown }>;

let _scenarios: ScenarioMap = {};

export function setScenario(path: string, handler: () => { status: number; body: unknown }) {
  _scenarios[path] = handler;
}

export function resetScenarios() {
  _scenarios = {
    "/threads": () => ({ status: 200, body: THREADS_PAGE1 }),
  };
}

function cors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

export function startFixtureServer(): Promise<http.Server> {
  resetScenarios();
  return new Promise((resolve, reject) => {
    const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      cors(res);
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      // Token check
      const auth = req.headers["authorization"] ?? "";
      if (auth !== `Bearer ${FIXTURE_TOKEN}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      // Route
      const url = new URL(req.url ?? "/", FIXTURE_ENDPOINT);
      const key = url.pathname;
      const handler = _scenarios[key];
      if (!handler) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }

      const { status, body } = handler();
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    });

    server.on("error", reject);
    server.listen(FIXTURE_PORT, "127.0.0.1", () => resolve(server));
  });
}
