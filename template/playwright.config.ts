import { defineConfig } from "@playwright/test";

// Derive a per-product port from the package name so sibling products never share a web server.
const slug = "__PRODUCT_SLUG__";
const port = Number(process.env.PW_PORT ?? 8200 + ([...slug].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 600));
export default defineConfig({
  testDir: process.env.SHOWCASE ? "showcase" : "test/e2e",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: process.env.PW_CHANNEL ?? (process.env.CI ? undefined : "chrome"),
    video: process.env.SHOWCASE ? { mode: "on", size: { width: 1280, height: 800 } } : "retain-on-failure",
    viewport: { width: 1280, height: 800 },
  },
  outputDir: process.env.SHOWCASE ? "showcase/out" : "test-results",
  webServer: {
    command: `ENV_FILE=/dev/null ARAG_MOCK=1 ADMIN_TOKEN=e2e-admin-token DATA_DIR=./data/e2e PORT=${port} node src/index.ts`,
    url: `http://127.0.0.1:${port}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
