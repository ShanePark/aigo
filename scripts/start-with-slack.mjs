import { spawn, spawnSync } from "node:child_process";

const appName = "AiGo";
const slackToken = process.env.SLACK_TOKEN?.trim() ?? "";
const branch = process.env.GIT_BRANCH?.trim() || "unknown";
const commit = process.env.GIT_COMMIT?.trim() || "unknown";
const port = process.env.PORT || "3000";

let shutdownStarted = false;
let notifiedReady = false;

runMigrations();

const child = spawn("node", ["node_modules/next/dist/bin/next", "start"], {
  env: { ...process.env, PORT: port },
  stdio: "inherit"
});

child.once("exit", async (code, signal) => {
  if (!shutdownStarted && notifiedReady) {
    await notifySlack("Application is shutting down", ":baby:");
  }

  if (signal) {
    process.exit(shutdownStarted ? 0 : 1);
  }

  process.exit(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}

await waitUntilReady();
notifiedReady = true;
await notifySlack(`Application is ready (branch: ${branch}, commit: ${commit})`, ":child:");

function runMigrations() {
  console.info("Applying database migrations...");
  const result = spawnSync("pnpm", ["db:migrate"], {
    env: process.env,
    stdio: "inherit"
  });

  if (result.status === 0) {
    return;
  }

  if (result.error) {
    console.error(`Database migration failed: ${result.error.message}`);
  }
  process.exit(result.status ?? 1);
}

async function shutdown(signal) {
  if (shutdownStarted) {
    child.kill(signal);
    return;
  }

  shutdownStarted = true;
  await notifySlack("Application is shutting down", ":baby:");
  child.kill(signal);
}

async function waitUntilReady() {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(1_000) });
      if (response.status < 500) {
        return;
      }
    } catch {
      await sleep(500);
    }
  }

  console.warn("AiGo startup notification readiness check timed out.");
}

async function notifySlack(text, iconEmoji) {
  if (!slackToken) {
    console.info(`Slack token is blank. Slack notification skipped: ${text}`);
    return;
  }

  try {
    const response = await fetch(`https://hooks.slack.com/services/${slackToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: appName,
        icon_emoji: iconEmoji,
        text
      }),
      signal: AbortSignal.timeout(5_000)
    });

    if (!response.ok) {
      console.warn(`Slack notification failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.warn(`Slack notification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
