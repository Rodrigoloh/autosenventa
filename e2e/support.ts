import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable obligatoria ${name}.`);
  return value;
}

export const e2eEnv = {
  target: required("E2E_TARGET") as "local" | "staging",
  appUrl: required("E2E_APP_URL"),
  supabaseUrl: required("E2E_SUPABASE_URL"),
  publishableKey: required("E2E_SUPABASE_PUBLISHABLE_KEY"),
  serviceRoleKey: required("E2E_SUPABASE_SERVICE_ROLE_KEY"),
  databaseUrl: required("E2E_DATABASE_URL"),
  mailpitUrl: process.env.E2E_MAILPIT_URL,
};

export const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

export function adminClient() {
  return createClient(e2eEnv.supabaseUrl, e2eEnv.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function anonymousClient() {
  return createClient(e2eEnv.supabaseUrl, e2eEnv.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createConfirmedUser(admin: SupabaseClient, label: string, options?: { withUsername?: boolean }) {
  const email = `e2e-${label}-${runId}@example.test`;
  const password = `E2e-${crypto.randomUUID()}!`;
  const username = `u${crypto.randomUUID().replaceAll("-", "").slice(0, 15)}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: options?.withUsername === false ? {} : { username },
  });
  if (error || !data.user) throw error ?? new Error("Auth Admin no devolvió usuario.");
  return { id: data.user.id, email, password, username: options?.withUsername === false ? null : username };
}

export async function deleteUsers(admin: SupabaseClient, userIds: string[]) {
  for (const id of userIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error && !error.message.toLowerCase().includes("not found")) throw error;
  }
}

export async function setRolePrivileged(userId: string, role: "user" | "staff" | "admin") {
  const client = new pg.Client({ connectionString: e2eEnv.databaseUrl });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.role_change', 'allowed', true)");
    await client.query("update public.profiles set role = $1 where id = $2", [role, userId]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

function decodeHtml(value: string) {
  return value.replaceAll("&amp;", "&").replaceAll("&#x3D;", "=").replaceAll("=3D", "=");
}

export async function mailpitLinkFor(email: string) {
  if (e2eEnv.target !== "local" || !e2eEnv.mailpitUrl) {
    throw new Error("Mailpit sólo está configurado para E2E_TARGET=local.");
  }
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const listResponse = await fetch(`${e2eEnv.mailpitUrl}/api/v1/messages?limit=100`);
    if (!listResponse.ok) throw new Error(`Mailpit respondió ${listResponse.status}.`);
    const list = await listResponse.json() as { messages?: Array<{ ID: string }> };
    for (const summary of list.messages ?? []) {
      const response = await fetch(`${e2eEnv.mailpitUrl}/api/v1/message/${summary.ID}`);
      if (!response.ok) continue;
      const message = await response.json() as Record<string, unknown>;
      if (!JSON.stringify(message).toLowerCase().includes(email.toLowerCase())) continue;
      const body = decodeHtml(String(message.HTML ?? message.Text ?? ""));
      const links = body.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
      const link = links.find((candidate) => candidate.includes("/auth/v1/verify"));
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Mailpit no recibió a tiempo un enlace para ${email}.`);
}
