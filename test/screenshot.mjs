#!/usr/bin/env node
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
};

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  let rel = url === "/" ? "/test/harness.html" : url;
  const path = join(ROOT, rel.replace(/^\//, ""));
  if (!path.startsWith(ROOT) || !existsSync(path)) {
    res.writeHead(404); res.end("not found"); return;
  }
  res.writeHead(200, { "Content-Type": MIME[extname(path)] || "application/octet-stream" });
  res.end(readFileSync(path));
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function shot(page, query, file) {
  await page.goto(`${base}/test/harness.html${query}`, {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForFunction(() => document.body?.dataset?.ready === "1", { timeout: 10000 });
  await page.waitForTimeout(450);
  await page.screenshot({ path: join(ROOT, file), fullPage: false });
  console.log("Wrote", file);
}

try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await shot(page, "?theme=dark", "preview-v2-closed.png");
  await shot(page, "?theme=dark&open=all_lights", "preview-v2-popup.png");
  await shot(page, "?theme=dark&open=all_lights&color=1", "preview-v2-color.png");
  await shot(page, "?theme=dark&open=kitchen&color=1", "preview-v2-dark.png");
  await shot(page, "?theme=light&open=kitchen&color=1", "preview-v2-light.png");
} finally {
  await browser.close();
  server.close();
}
