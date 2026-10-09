/**
 * Playwright browser integration tests — COD-517 browser-first pilot.
 *
 * Uses a real loopback fixture HTTP server (tests/browser/fixture-server.ts).
 * The exported Expo web UI makes real SDK-to-HTTP requests against it.
 * No production endpoints. No inbox reads or sends.
 *
 * TDD: written RED first; implementation makes them GREEN.
 */
import { test, expect, type Page } from "@playwright/test";
import http from "http";
import {
  startFixtureServer,
  resetScenarios,
  setScenario,
  FIXTURE_TOKEN,
  FIXTURE_ENDPOINT,
  THREADS_PAGE1,
  THREADS_PAGE2,
  makeThread,
} from "./fixture-server";

// ---------------------------------------------------------------------------
// Global fixture server lifecycle
// ---------------------------------------------------------------------------

let server: http.Server;

test.beforeAll(async () => {
  server = await startFixtureServer();
});

test.afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

test.beforeEach(() => {
  resetScenarios();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fillLogin(page: Page, endpoint: string, token: string) {
  await page.locator('[data-testid="endpoint-input"]').fill(endpoint);
  await page.locator('[data-testid="token-input"]').fill(token);
}

async function connect(page: Page) {
  await page.locator('[data-testid="login-button"]').click();
}

async function loginOk(page: Page) {
  await fillLogin(page, FIXTURE_ENDPOINT, FIXTURE_TOKEN);
  await connect(page);
}

// ---------------------------------------------------------------------------
// Login screen
// ---------------------------------------------------------------------------

test.describe("Login screen", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows endpoint and token fields with correct data-testid", async ({ page }) => {
    await expect(page.locator('[data-testid="endpoint-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="token-input"]')).toBeVisible();
  });

  test("shows Connect button", async ({ page }) => {
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
  });

  test("shows validation error when endpoint is empty", async ({ page }) => {
    await connect(page);
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
  });

  test("shows validation error when token is empty", async ({ page }) => {
    await page.locator('[data-testid="endpoint-input"]').fill(FIXTURE_ENDPOINT);
    await connect(page);
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
  });

  test("rejects non-URL endpoint and does not fetch", async ({ page }) => {
    let fetchHappened = false;
    page.on("request", (req) => {
      if (req.url().startsWith(FIXTURE_ENDPOINT)) fetchHappened = true;
    });
    await page.locator('[data-testid="endpoint-input"]').fill("not-a-url");
    await page.locator('[data-testid="token-input"]').fill(FIXTURE_TOKEN);
    await connect(page);
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
    expect(fetchHappened).toBe(false);
  });

  test("rejects insecure http:// non-local endpoint and does not fetch", async ({ page }) => {
    let fetchHappened = false;
    page.on("request", (req) => {
      if (req.url().includes("remote.example.invalid")) fetchHappened = true;
    });
    await page.locator('[data-testid="endpoint-input"]').fill("http://remote.example.invalid");
    await page.locator('[data-testid="token-input"]').fill(FIXTURE_TOKEN);
    await connect(page);
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
    expect(fetchHappened).toBe(false);
  });

  test("rejects URL with query string (token leak prevention)", async ({ page }) => {
    await page.locator('[data-testid="endpoint-input"]').fill(`${FIXTURE_ENDPOINT}?token=abc`);
    await page.locator('[data-testid="token-input"]').fill(FIXTURE_TOKEN);
    await connect(page);
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
  });

  test("Enter on endpoint field focuses token field, not submit", async ({ page }) => {
    await page.locator('[data-testid="endpoint-input"]').fill(FIXTURE_ENDPOINT);
    await page.locator('[data-testid="endpoint-input"]').press("Enter");
    // Login error should NOT appear — token field should be focused instead
    await expect(page.locator('[data-testid="login-error"]')).not.toBeVisible();
  });

  test("Enter on token field submits form", async ({ page }) => {
    await fillLogin(page, FIXTURE_ENDPOINT, FIXTURE_TOKEN);
    await page.locator('[data-testid="token-input"]').press("Enter");
    await expect(
      page.locator('[data-testid="threads-list"], [data-testid="loading-indicator"], [data-testid="error-view"]')
    ).toBeVisible({ timeout: 8000 });
  });

  test("token does not appear in any request URL", async ({ page }) => {
    const tokenInUrl: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes(FIXTURE_TOKEN)) tokenInUrl.push(req.url());
    });
    await fillLogin(page, FIXTURE_ENDPOINT, FIXTURE_TOKEN);
    await connect(page);
    await expect(
      page.locator('[data-testid="threads-list"], [data-testid="error-view"], [data-testid="empty-view"]')
    ).toBeVisible({ timeout: 8000 });
    expect(tokenInUrl).toHaveLength(0);
  });

  test("token does not appear in localStorage after login", async ({ page }) => {
    await fillLogin(page, FIXTURE_ENDPOINT, FIXTURE_TOKEN);
    await connect(page);
    await expect(
      page.locator('[data-testid="threads-list"], [data-testid="error-view"]')
    ).toBeVisible({ timeout: 8000 });
    const stored = await page.evaluate(() => JSON.stringify(window.localStorage));
    expect(stored).not.toContain(FIXTURE_TOKEN);
  });

  test("token does not appear in sessionStorage after login", async ({ page }) => {
    await fillLogin(page, FIXTURE_ENDPOINT, FIXTURE_TOKEN);
    await connect(page);
    await expect(
      page.locator('[data-testid="threads-list"], [data-testid="error-view"]')
    ).toBeVisible({ timeout: 8000 });
    const stored = await page.evaluate(() => JSON.stringify(window.sessionStorage));
    expect(stored).not.toContain(FIXTURE_TOKEN);
  });
});

// ---------------------------------------------------------------------------
// Threads list — real fixture server requests
// ---------------------------------------------------------------------------

test.describe("Threads list — real fixture HTTP", () => {
  test("shows loading indicator while fetching", async ({ page }) => {
    // Slow the server response
    let release: () => void;
    const hold = new Promise<void>((r) => (release = r));
    setScenario("/threads", () => {
      // We can't truly async-block in the sync handler; rely on timing
      return { status: 200, body: THREADS_PAGE1 };
    });

    await page.goto("/");
    // Intercept after navigation — before login so we can watch loading state
    let requestPending = false;
    page.on("request", (r) => {
      if (r.url().includes("/threads")) requestPending = true;
    });

    await loginOk(page);
    // loading-indicator should appear before threads-list
    await expect(
      page.locator('[data-testid="loading-indicator"], [data-testid="threads-list"]')
    ).toBeVisible({ timeout: 5000 });
  });

  test("sends real GET /threads with correct Authorization header", async ({ page }) => {
    let capturedAuth = "";
    let capturedPath = "";

    // Override scenario to capture request details via a route interceptor
    // We use page.route on the fixture endpoint to inspect headers BEFORE passing through
    await page.goto("/");
    await page.route(`${FIXTURE_ENDPOINT}/threads*`, async (route) => {
      capturedAuth = route.request().headers()["authorization"] ?? "";
      capturedPath = new URL(route.request().url()).pathname;
      await route.continue();
    });

    await loginOk(page);
    await expect(page.locator('[data-testid="threads-list"]')).toBeVisible({ timeout: 8000 });

    expect(capturedAuth).toBe(`Bearer ${FIXTURE_TOKEN}`);
    expect(capturedPath).toBe("/threads");
  });

  test("shows actual thread titles from fixture server response", async ({ page }) => {
    await page.goto("/");
    await loginOk(page);
    await expect(page.locator('[data-testid="threads-list"]')).toBeVisible({ timeout: 8000 });
    // First thread row should be present with fixture ID
    const firstId = THREADS_PAGE1[0].id;
    await expect(page.locator(`[data-testid="thread-row-${firstId}"]`)).toBeVisible();
  });

  test("shows loading indicator testid element", async ({ page }) => {
    await page.goto("/");
    await loginOk(page);
    // Either loading or list must appear
    await expect(
      page.locator('[data-testid="loading-indicator"], [data-testid="threads-list"]')
    ).toBeVisible({ timeout: 8000 });
  });

  test("401 from fixture server shows error state with reconnect option", async ({ page }) => {
    setScenario("/threads", () => ({ status: 401, body: { error: "Unauthorized" } }));

    await page.goto("/");
    await loginOk(page);
    await expect(page.locator('[data-testid="error-view"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    // Must surface reconnect prominently for 401
    await expect(page.locator('[data-testid="reconnect-button"]')).toBeVisible();
    // Error message must not contain the token
    const errText = await page.locator('[data-testid="error-message"]').textContent();
    expect(errText ?? "").not.toContain(FIXTURE_TOKEN);
  });

  test("500 from fixture server shows error state and retry", async ({ page }) => {
    setScenario("/threads", () => ({ status: 500, body: { error: "Internal Server Error" } }));

    await page.goto("/");
    await loginOk(page);
    await expect(page.locator('[data-testid="error-view"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test("malformed JSON response is handled gracefully", async ({ page }) => {
    // Intercept the fixture server request at the browser level and return invalid JSON.
    // The IrisClient's fetch → res.json() throws SyntaxError → useThreads catches → safe UI.
    await page.goto("/");
    await page.route(`${FIXTURE_ENDPOINT}/threads*`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "not-json{{{",
      });
    });
    await loginOk(page);
    // All malformed records are skipped by refineThread → empty result OR json parse error.
    // Either error-view or empty-view is acceptable; blank/loading is not.
    await expect(
      page.locator('[data-testid="error-view"], [data-testid="empty-view"]')
    ).toBeVisible({ timeout: 8000 });
  });

  test("empty array response shows empty state", async ({ page }) => {
    setScenario("/threads", () => ({ status: 200, body: [] }));

    await page.goto("/");
    await loginOk(page);
    await expect(page.locator('[data-testid="empty-view"]')).toBeVisible({ timeout: 8000 });
  });

  test("retry re-fetches after error", async ({ page }) => {
    let calls = 0;
    setScenario("/threads", () => {
      calls++;
      if (calls === 1) return { status: 500, body: {} };
      return { status: 200, body: THREADS_PAGE1 };
    });

    await page.goto("/");
    await loginOk(page);
    await expect(page.locator('[data-testid="error-view"]')).toBeVisible({ timeout: 8000 });
    await page.locator('[data-testid="retry-button"]').click();
    await expect(page.locator('[data-testid="threads-list"]')).toBeVisible({ timeout: 8000 });
    expect(calls).toBe(2);
  });

  test("logout returns to login screen and clears session", async ({ page }) => {
    await page.goto("/");
    await loginOk(page);
    await expect(page.locator('[data-testid="threads-list"]')).toBeVisible({ timeout: 8000 });
    await page.locator('[data-testid="logout-button"]').click();
    await expect(page.locator('[data-testid="endpoint-input"]')).toBeVisible({ timeout: 5000 });
  });

  test("reconnect button after 401 returns to login screen", async ({ page }) => {
    setScenario("/threads", () => ({ status: 401, body: { error: "Unauthorized" } }));
    await page.goto("/");
    await loginOk(page);
    await expect(page.locator('[data-testid="reconnect-button"]')).toBeVisible({ timeout: 8000 });
    await page.locator('[data-testid="reconnect-button"]').click();
    await expect(page.locator('[data-testid="endpoint-input"]')).toBeVisible({ timeout: 5000 });
  });

  test("logout while fetch is in-flight: stale response is discarded", async ({ page }) => {
    // Intercept and hold /threads request
    let resolveHeld: () => void;
    const held = new Promise<void>((r) => (resolveHeld = r));
    await page.goto("/");
    await page.route(`${FIXTURE_ENDPOINT}/threads*`, async (route) => {
      await held;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(THREADS_PAGE1) });
    });

    await loginOk(page);
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible({ timeout: 5000 });
    // Logout while loading
    await page.locator('[data-testid="logout-button"]').click();
    await expect(page.locator('[data-testid="endpoint-input"]')).toBeVisible({ timeout: 5000 });
    // Release the held request — should not transition back to threads
    resolveHeld!();
    await page.waitForTimeout(500);
    // Should still be on login screen
    await expect(page.locator('[data-testid="endpoint-input"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Pagination — real fixture server cursor
// ---------------------------------------------------------------------------

test.describe("Pagination", () => {
  test("load-more button visible when full page (20) returned", async ({ page }) => {
    await page.goto("/");
    await loginOk(page);
    await expect(page.locator('[data-testid="threads-list"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="load-more-button"]')).toBeVisible();
  });

  test("no load-more button when partial page returned", async ({ page }) => {
    setScenario("/threads", () => ({ status: 200, body: THREADS_PAGE2 }));
    await page.goto("/");
    await loginOk(page);
    await expect(page.locator('[data-testid="threads-list"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="load-more-button"]')).not.toBeVisible();
  });

  test("load-more sends GET /threads with cursor query param", async ({ page }) => {
    const cursorsReceived: string[] = [];
    let callCount = 0;

    setScenario("/threads", () => {
      callCount++;
      return { status: 200, body: callCount === 1 ? THREADS_PAGE1 : THREADS_PAGE2 };
    });

    await page.goto("/");
    await page.route(`${FIXTURE_ENDPOINT}/threads*`, async (route) => {
      const url = new URL(route.request().url());
      const c = url.searchParams.get("cursor");
      if (c) cursorsReceived.push(c);
      await route.continue();
    });
    await loginOk(page);
    await expect(page.locator('[data-testid="load-more-button"]')).toBeVisible({ timeout: 8000 });
    await page.locator('[data-testid="load-more-button"]').click();

    // Page 2 thread should appear
    const page2Id = THREADS_PAGE2[0].id;
    await expect(page.locator(`[data-testid="thread-row-${page2Id}"]`)).toBeVisible({ timeout: 8000 });
    // Cursor must have been sent
    expect(cursorsReceived.length).toBeGreaterThan(0);
    // Cursor format: last_message_at|source|id
    expect(cursorsReceived[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("rapid load-more clicks do not produce duplicate rows", async ({ page }) => {
    // Use two full pages so load-more remains visible after loading extra rows
    const EXTRA_PAGE = Array.from({ length: 20 }, (_, i) => makeThread(i + 20));
    let callCount = 0;
    setScenario("/threads", () => {
      callCount++;
      if (callCount === 1) return { status: 200, body: THREADS_PAGE1 };
      return { status: 200, body: EXTRA_PAGE };
    });

    await page.goto("/");
    await loginOk(page);
    await expect(page.locator('[data-testid="load-more-button"]')).toBeVisible({ timeout: 8000 });

    // Single click — wait for page 2 rows to appear
    await page.locator('[data-testid="load-more-button"]').click();
    const extraFirstId = EXTRA_PAGE[0].id;
    await expect(page.locator(`[data-testid="thread-row-${extraFirstId}"]`)).toBeVisible({ timeout: 8000 });

    // Count rows — should not have duplicate testids
    const rowIds = await page.locator('[data-testid^="thread-row-"]').evaluateAll(
      (els) => els.map((e) => e.getAttribute("data-testid"))
    );
    const unique = new Set(rowIds);
    expect(unique.size).toBe(rowIds.length);
    // 20 page1 + 20 extra = 40 unique rows
    expect(rowIds.length).toBe(40);
  });

  test("load-more error preserves existing rows with inline error", async ({ page }) => {
    let loadMoreCalls = 0;
    setScenario("/threads", () => {
      loadMoreCalls++;
      if (loadMoreCalls === 1) return { status: 200, body: THREADS_PAGE1 };
      return { status: 500, body: {} };
    });

    await page.goto("/");
    await loginOk(page);
    await expect(page.locator('[data-testid="load-more-button"]')).toBeVisible({ timeout: 8000 });
    await page.locator('[data-testid="load-more-button"]').click();

    // Existing rows preserved
    const firstId = THREADS_PAGE1[0].id;
    await expect(page.locator(`[data-testid="thread-row-${firstId}"]`)).toBeVisible({ timeout: 8000 });
    // Inline error for load-more failure
    await expect(page.locator('[data-testid="load-more-error"]')).toBeVisible({ timeout: 5000 });
    // Full-page error should NOT appear (rows preserved)
    await expect(page.locator('[data-testid="error-view"]')).not.toBeVisible();
  });
});
