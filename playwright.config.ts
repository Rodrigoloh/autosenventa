import { readFileSync, existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

function loadTestEnv() {
  const path = process.env.E2E_ENV_FILE ?? ".env.test";
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

loadTestEnv();

const appUrl = process.env.E2E_APP_URL;
const supabaseUrl = process.env.E2E_SUPABASE_URL;
if (!appUrl || !supabaseUrl) {
  throw new Error("E2E_APP_URL y E2E_SUPABASE_URL son obligatorias (usa .env.test o E2E_ENV_FILE). ");
}
if (process.env.ALLOW_DESTRUCTIVE_E2E !== "true") {
  throw new Error("Las pruebas crean y eliminan datos. Define ALLOW_DESTRUCTIVE_E2E=true explícitamente.");
}
if ([process.env.E2E_PRODUCTION_APP_URL, process.env.E2E_PRODUCTION_SUPABASE_URL].filter(Boolean).includes(appUrl)
  || [process.env.E2E_PRODUCTION_SUPABASE_URL].filter(Boolean).includes(supabaseUrl)) {
  throw new Error("Objetivo E2E bloqueado: coincide con una URL de producción identificada.");
}

const target = process.env.E2E_TARGET;
if (target !== "local" && target !== "staging") throw new Error("E2E_TARGET debe ser local o staging.");
if (target === "local" && !new URL(supabaseUrl).hostname.match(/^(localhost|127\.0\.0\.1|::1)$/)) {
  throw new Error("E2E_TARGET=local exige Supabase en loopback.");
}
if (target === "staging") {
  const stagingRef = process.env.E2E_STAGING_PROJECT_REF;
  const productionRef = process.env.E2E_PRODUCTION_PROJECT_REF;
  if (!stagingRef || !productionRef || stagingRef === productionRef || !new URL(supabaseUrl).hostname.startsWith(`${stagingRef}.`)) {
    throw new Error("Staging exige refs explícitos, distintos y una URL que coincida con E2E_STAGING_PROJECT_REF.");
  }
}

const startApp = process.env.E2E_START_APP !== "false";
const parsedAppUrl = new URL(appUrl);
const appPort = parsedAppUrl.port || (parsedAppUrl.protocol === "https:" ? "443" : "80");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: appUrl,
    channel: process.env.E2E_BROWSER_CHANNEL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: startApp ? {
    command: `npm run build && npm run start -- --hostname ${parsedAppUrl.hostname} --port ${appPort}`,
    url: appUrl,
    reuseExistingServer: true,
    timeout: 240_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? "",
      NEXT_PUBLIC_SITE_URL: appUrl,
    },
  } : undefined,
});
