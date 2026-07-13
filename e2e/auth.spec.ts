import { expect, test, type Cookie } from "@playwright/test";
import { anonymousClient, adminClient, deleteUsers, e2eEnv, mailpitLinkFor, runId } from "./support";

test.describe.configure({ mode: "serial" });

test.describe("Auth real mediante navegador y Mailpit", () => {
  test.skip(e2eEnv.target !== "local", "Confirmación y recuperación por Mailpit sólo acreditan el entorno local.");

  const email = `e2e-auth-${runId}@example.test`;
  const oldPassword = `Old-${crypto.randomUUID()}!`;
  const newPassword = `New-${crypto.randomUUID()}!`;
  let userId = "";
  let browserCookies: Cookie[] = [];
  const admin = adminClient();

  test.afterAll(async () => {
    if (userId) await deleteUsers(admin, [userId]);
  });

  test("registro crea perfil user y muestra que requiere confirmación", async ({ page, context }) => {
    await page.goto("/registro");
    await page.getByLabel("Correo").fill(email);
    await page.getByLabel("Contraseña").fill(oldPassword);
    await page.getByRole("button", { name: "Registrarme" }).click();

    await expect(page).toHaveURL(/\/login\?registered=1$/);
    await expect(page.getByRole("status")).toHaveText("Revisa tu correo para confirmar la cuenta.");

    const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    expect(usersError).toBeNull();
    const user = users.users.find((candidate) => candidate.email === email);
    expect(user).toBeTruthy();
    userId = user!.id;

    const { data: profile, error: profileError } = await admin.from("profiles").select("id, role").eq("id", userId).single();
    expect(profileError).toBeNull();
    expect(profile).toEqual({ id: userId, role: "user" });
    browserCookies = await context.cookies();
    expect(browserCookies.some((cookie) => cookie.name.includes("code-verifier"))).toBe(true);
  });

  test("confirmación PKCE establece sesión y rechaza next externo", async ({ page, context }) => {
    await context.addCookies(browserCookies);
    await page.goto(await mailpitLinkFor(email));
    await expect(page).toHaveURL(`${e2eEnv.appUrl}/cuenta`);
    await expect(page.getByRole("heading", { name: /^Hola/ })).toBeVisible();

    const html = await page.content();
    expect(html).not.toContain(userId);
    expect(html).not.toContain(email);

    await page.goto("/auth/callback?next=https://evil.example/steal");
    await expect(page).toHaveURL(`${e2eEnv.appUrl}/login?error=confirmation`);
    expect(page.url()).not.toContain("evil.example");
    await page.goto("/cuenta");
    await expect(page).toHaveURL(`${e2eEnv.appUrl}/cuenta`);
    browserCookies = await context.cookies();
  });

  test("usuario normal no abre staff, logout borra sesión y login maneja errores", async ({ page, context }) => {
    await context.addCookies(browserCookies);
    await page.goto("/staff");
    await expect(page).toHaveURL(`${e2eEnv.appUrl}/cuenta`);

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login\?signedOut=1$/);
    await page.goto("/cuenta");
    await expect(page).toHaveURL(`${e2eEnv.appUrl}/login`);

    await page.getByLabel("Correo").fill(email);
    await page.getByLabel("Contraseña").fill(`${oldPassword}-incorrecta`);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByText("No fue posible iniciar sesión con esos datos.", { exact: true })).toBeVisible();

    await page.getByLabel("Correo").fill(email);
    await page.getByLabel("Contraseña").fill(oldPassword);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(`${e2eEnv.appUrl}/cuenta`);
    browserCookies = await context.cookies();
  });

  test("recuperación cambia la contraseña y deja inutilizable la anterior", async ({ page, context }) => {
    await context.addCookies(browserCookies);
    await page.goto("/cuenta");
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await page.goto("/recuperar-password");
    await page.getByLabel("Correo").fill(email);
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(page.getByRole("status")).toHaveText("Si la cuenta existe, enviamos un enlace de recuperación.");

    await page.goto(await mailpitLinkFor(email));
    await expect(page).toHaveURL(`${e2eEnv.appUrl}/actualizar-password`);
    await page.getByLabel("Contraseña").fill(newPassword);
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page).toHaveURL(`${e2eEnv.appUrl}/cuenta`);

    const oldClient = anonymousClient();
    const oldAttempt = await oldClient.auth.signInWithPassword({ email, password: oldPassword });
    expect(oldAttempt.error).toBeTruthy();
    const newClient = anonymousClient();
    const newAttempt = await newClient.auth.signInWithPassword({ email, password: newPassword });
    expect(newAttempt.error).toBeNull();
  });
});
