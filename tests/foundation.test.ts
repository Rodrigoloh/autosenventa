import assert from "node:assert/strict";
import test from "node:test";
import { accessDecision, resolveViewer, safeInternalPath } from "../src/lib/auth-policy";
import { credentialsSchema, emailSchema } from "../src/lib/auth-validation";
import { parsePublicEnv } from "../src/lib/env";

const user = { id: "11111111-1111-4111-8111-111111111111", role: "user" as const, display_name: null };
const staff = { ...user, role: "staff" as const };
const admin = { ...user, role: "admin" as const };

test("valida el entorno completo", () => {
  assert.equal(parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "key", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }).NEXT_PUBLIC_SITE_URL, "http://localhost:3000");
  assert.throws(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "bad" }));
});

test("valida credenciales y correo", () => {
  assert.equal(credentialsSchema.safeParse({ email: "owner@example.test", password: "12345678" }).success, true);
  assert.equal(credentialsSchema.safeParse({ email: "bad", password: "short" }).success, false);
  assert.equal(emailSchema.safeParse({ email: "owner@example.test" }).success, true);
});

test("rechaza perfiles ausentes o roles inesperados", () => {
  assert.equal(resolveViewer(null), null);
  assert.equal(resolveViewer({ ...user, role: "superadmin" }), null);
  assert.deepEqual(resolveViewer(user), user);
});

test("resuelve guards user, staff y admin", () => {
  assert.equal(accessDecision(null), "login");
  assert.equal(accessDecision(user), "allowed");
  assert.equal(accessDecision(user, ["staff", "admin"]), "forbidden");
  assert.equal(accessDecision(staff, ["staff", "admin"]), "allowed");
  assert.equal(accessDecision(staff, ["admin"]), "forbidden");
  assert.equal(accessDecision(admin, ["admin"]), "allowed");
});

test("sólo admite redirecciones internas", () => {
  assert.equal(safeInternalPath("/cuenta?ok=1"), "/cuenta?ok=1");
  assert.equal(safeInternalPath("https://evil.example/path"), "/cuenta");
  assert.equal(safeInternalPath("//evil.example/path"), "/cuenta");
  assert.equal(safeInternalPath(null, "/login"), "/login");
});
