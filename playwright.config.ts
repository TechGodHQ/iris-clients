import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: "http://localhost:8090",
    trace: "on-first-retry",
    // Required for CORS from static page to fixture server on :9999
    extraHTTPHeaders: {},
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Serve the exported static bundle; no Metro dev server
  webServer: {
    command: "npx serve dist --listen 8090 --no-clipboard",
    url: "http://localhost:8090",
    reuseExistingServer: false,
    timeout: 30000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
