import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import { chromium, type Browser, type Page } from "@playwright/test";

type ViewportCase = {
  height: number;
  name: string;
  width: number;
};

type SmokeScenario = {
  name: string;
  path: string;
  prepare?: (page: Page) => Promise<void>;
  verify: (page: Page) => Promise<void>;
};

const port = Number(process.env.AIGO_UI_SMOKE_PORT ?? 3120);
const externalBaseUrl = process.env.AIGO_UI_BASE_URL;
const baseUrl = externalBaseUrl ?? `http://127.0.0.1:${port}`;
const screenshotDir = resolve(process.env.AIGO_UI_SMOKE_DIR ?? "test-results/ui-smoke");
const viewports: ViewportCase[] = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 }
];

let devServer: ChildProcess | undefined;

async function main() {
  await rm(screenshotDir, { force: true, recursive: true });
  await mkdir(screenshotDir, { recursive: true });

  if (!externalBaseUrl) {
    devServer = startDevServer();
    await waitForServer(baseUrl);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const detailPath = await discoverDetailPath(browser);
    const scenarios = smokeScenarios(detailPath);

    for (const viewport of viewports) {
      for (const scenario of scenarios) {
        await runScenario(browser, scenario, viewport);
      }
    }
  } finally {
    await browser.close();
    stopDevServer();
  }

  console.log(`UI smoke passed. Screenshots saved to ${screenshotDir}`);
}

function startDevServer() {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const child = spawn(command, ["exec", "next", "dev", "-p", String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr?.on("data", (chunk) => process.stderr.write(chunk));

  return child;
}

async function waitForServer(url: string) {
  const timeoutMs = 45_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (devServer?.exitCode !== null) {
      throw new Error(`Next dev server exited with code ${devServer?.exitCode}`);
    }

    try {
      await fetch(url, { signal: AbortSignal.timeout(1500) });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function stopDevServer() {
  if (!devServer || devServer.exitCode !== null) return;
  devServer.kill("SIGTERM");
}

async function discoverDetailPath(browser: Browser) {
  const context = await browser.newContext({ viewport: viewports[0] });
  const page = await context.newPage();
  try {
    await gotoAndSettle(page, "/?query=물놀이");
    const firstCard = page.locator("[data-map-place-card='true']").first();
    await firstCard.waitFor({ timeout: 15_000 });
    const href = await firstCard.getAttribute("href");
    if (!href) throw new Error("Could not find a result card detail link for the detail smoke scenario.");
    return href;
  } finally {
    await context.close();
  }
}

function smokeScenarios(detailPath: string): SmokeScenario[] {
  return [
    {
      name: "home",
      path: "/",
      verify: async (page) => {
        await page.locator(".search-form").waitFor({ timeout: 10_000 });
        await page.locator(".category-tabs").waitFor({ timeout: 10_000 });
      }
    },
    {
      name: "search-results",
      path: "/?query=물놀이",
      verify: async (page) => {
        await page.locator(".result-card").first().waitFor({ timeout: 15_000 });
        await page.locator(".map-card").waitFor({ timeout: 10_000 });
      }
    },
    {
      name: "empty-state",
      path: "/?query=aigo-smoke-no-results-20260523&categoryGroup=toyStore",
      verify: async (page) => {
        await page.locator(".empty-state").waitFor({ timeout: 15_000 });
        await page.getByText("결과 없음").waitFor({ timeout: 10_000 });
      }
    },
    {
      name: "detail",
      path: detailPath,
      verify: async (page) => {
        await page.locator(".detail-page").waitFor({ timeout: 15_000 });
        await page.locator(".detail-decision-card").waitFor({ timeout: 10_000 });
        await page.locator(".detail-map-card").waitFor({ timeout: 10_000 });
      }
    },
    {
      name: "dark-results",
      path: "/?query=물놀이",
      prepare: async (page) => {
        await page.addInitScript(() => window.localStorage.setItem("aigo-theme", "dark"));
      },
      verify: async (page) => {
        await page.locator(".result-card").first().waitFor({ timeout: 15_000 });
        const theme = await page.evaluate(() => document.documentElement.dataset.theme);
        if (theme !== "dark") throw new Error(`Expected dark theme, received ${theme ?? "unset"}.`);
      }
    }
  ];
}

async function runScenario(browser: Browser, scenario: SmokeScenario, viewport: ViewportCase) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  try {
    await scenario.prepare?.(page);
    await gotoAndSettle(page, scenario.path);
    await scenario.verify(page);
    await assertNoHorizontalOverflow(page, scenario.name, viewport.name);

    const screenshotPath = join(screenshotDir, `${scenario.name}-${viewport.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`✓ ${scenario.name} ${viewport.name}`);
  } finally {
    await context.close();
  }
}

async function gotoAndSettle(page: Page, path: string) {
  await page.goto(new URL(path, baseUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(750);
}

async function assertNoHorizontalOverflow(page: Page, scenarioName: string, viewportName: string) {
  const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
  if (overflow > 1) {
    throw new Error(`${scenarioName} ${viewportName} has ${overflow}px horizontal overflow.`);
  }
}

main().catch((error) => {
  stopDevServer();
  console.error(error);
  process.exit(1);
});
