import { expect, test, type Page } from "@playwright/test";
import { adminClient, anonymousClient, createConfirmedUser, deleteUsers, runId, setRolePrivileged } from "./support";

test.describe.configure({ mode: "serial" });

async function login(page: Page, email: string, password: string, destination: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(destination);
}

test("dos registros concurrentes no reservan el mismo username", async () => {
  const admin = adminClient();
  const username = `race${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
  const emails = [`race-a-${runId}@example.test`, `race-b-${runId}@example.test`];
  const attempts = await Promise.all(emails.map((email, index) => anonymousClient().auth.signUp({
    email,
    password: `Race-${crypto.randomUUID()}!`,
    options: { data: { username: index === 0 ? username : username.toUpperCase() } },
  })));
  expect(attempts.filter((attempt) => !attempt.error)).toHaveLength(1);
  expect(attempts.filter((attempt) => attempt.error)).toHaveLength(1);
  const users = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.filter((user) => emails.includes(user.email ?? ""));
  expect(users).toHaveLength(1);
  expect(JSON.stringify(users[0].user_metadata)).not.toContain("confirm_password");
  expect((await admin.from("profiles").select("username").eq("id", users[0].id).single()).data?.username).toBe(username);
  await deleteUsers(admin, users.map((user) => user.id));
});

test("cuenta legacy completa identidad y expone un perfil público mínimo", async ({ page }) => {
  const admin = adminClient();
  const legacy = await createConfirmedUser(admin, "legacy-identity", { withUsername: false });
  try {
    await login(page, legacy.email, legacy.password, /\/cuenta$/);
    await expect(page.getByRole("link", { name: "Ingresar" })).toHaveCount(0);
    await expect(page.locator("dd").getByText("Usuario sin username", { exact: true })).toBeVisible();
    await expect(page.getByText(legacy.email, { exact: true })).toBeVisible();
    const menuButton = page.getByRole("button", { name: /Menú de usuario/ });
    await expect(menuButton).toHaveAttribute("aria-haspopup", "menu");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("heading", { name: /^Hola/ }).hover();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("menuitem", { name: "Cerrar sesión" })).toHaveCount(1);
    await page.getByRole("heading", { name: /^Hola/ }).click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await menuButton.focus();
    await menuButton.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Mi cuenta" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(menuButton).toBeFocused();
    const username = `legacy${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
    await page.getByLabel("Username").fill(username.toUpperCase());
    await expect(page.getByLabel("Username")).toHaveValue(username);
    await page.getByLabel("Username").blur();
    await expect(page.getByText("Username disponible.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Establecer username" }).click();
    await expect(page.locator("dd").getByText(`@${username}`, { exact: true })).toBeVisible();
    expect((await admin.from("profiles").select("username").eq("id", legacy.id).single()).data?.username).toBe(username);
    await page.goto(`/u/${username}`);
    await expect(page.getByRole("heading", { name: `@${username}` })).toBeVisible();
    await expect(page.getByText("Este usuario todavía no tiene autos publicados.")).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain(legacy.email);
    expect(html).not.toContain(legacy.id);
    await expect(page.getByText(/Staff|Admin/)).toHaveCount(0);
    await page.goto("/u/username-inexistente");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  } finally {
    await deleteUsers(admin, [legacy.id]);
  }
});

test("staff identifica propietario y registra decisiones definitivas", async ({ page, browser }) => {
  const admin = adminClient();
  const [owner, staff, otherStaff] = await Promise.all([
    createConfirmedUser(admin, "decision-owner"),
    createConfirmedUser(admin, "decision-staff"),
    createConfirmedUser(admin, "decision-other"),
  ]);
  await setRolePrivileged(staff.id, "staff");
  await setRolePrivileged(otherStaff.id, "staff");
  const listingIds: string[] = [];
  try {
    const createReview = async (title: string) => {
      const listing = await admin.from("listings").insert({ owner_id: owner.id, title, status: "in_review", submitted_at: new Date().toISOString(), reviewer_id: staff.id, review_started_at: new Date().toISOString() }).select("id").single();
      expect(listing.error).toBeNull();
      listingIds.push(listing.data!.id);
      expect((await admin.from("listing_submissions").insert({ listing_id: listing.data!.id, submitted_by: owner.id, attest_owner_authorized: true, attest_information_truthful: true, attest_modifications_and_issues_disclosed: true, attest_legal_documentation: true, attestation_version: "2026-07-20-v1" })).error).toBeNull();
      return listing.data!.id;
    };
    const changesId = await createReview("Solicitar cambios E2E");
    const rejectId = await createReview("Rechazar E2E");
    const approveId = await createReview("Aprobar E2E");

    await login(page, staff.email, staff.password, /\/staff$/);
    await expect(page.getByText("Usuarios registrados")).toBeVisible();
    await page.goto("/staff/usuarios");
    await expect(page.getByText(`@${owner.username}`)).toBeVisible();
    await page.goto(`/staff/anuncios/${changesId}`);
    await expect(page.getByText(`@${owner.username}`, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver usuario en staff" })).toHaveAttribute("href", `/staff/usuarios/${owner.id}`);
    await expect(page.getByRole("link", { name: "Ver perfil público" })).toHaveAttribute("href", `/u/${owner.username}`);
    await page.getByLabel("Mensaje para el propietario").fill("Corrige la descripción y documenta claramente el mantenimiento.");
    await page.getByRole("button", { name: "Solicitar cambios" }).click();
    await expect(page.getByText("Cambios solicitados al propietario.")).toBeVisible();
    expect((await admin.from("listings").select("status").eq("id", changesId).single()).data?.status).toBe("changes_requested");

    await page.goto(`/staff/anuncios/${rejectId}`);
    await page.getByLabel("Mensaje para el propietario").fill("El vehículo no cumple los criterios mínimos del marketplace.");
    await page.getByRole("button", { name: "Rechazar" }).click();
    await expect(page.getByText("Anuncio rechazado.")).toBeVisible({ timeout: 30_000 });

    await page.goto(`/staff/anuncios/${approveId}`);
    await page.getByRole("button", { name: "Aprobar" }).click();
    await expect(page.getByText("Anuncio aprobado. No fue publicado automáticamente.")).toBeVisible({ timeout: 30_000 });
    const approved = await admin.from("listings").select("status,published_at").eq("id", approveId).single();
    expect(approved.data).toMatchObject({ status: "approved", published_at: null });
    await page.goto("/staff/anuncios");
    await expect(page.getByText("Aprobar E2E")).toHaveCount(0);

    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await login(ownerPage, owner.email, owner.password, /\/cuenta$/);
    await ownerPage.goto(`/cuenta/anuncios/${changesId}/vista-previa`);
    await expect(ownerPage.getByText("Corrige la descripción y documenta claramente el mantenimiento.")).toBeVisible();
    await expect(ownerPage.getByRole("link", { name: "Editar y corregir" })).toBeVisible();
    await ownerPage.goto(`/cuenta/anuncios/${approveId}/vista-previa`);
    await expect(ownerPage.getByText("Tu anuncio fue aprobado.")).toBeVisible();
    await ownerPage.goto(`/cuenta/anuncios/${rejectId}/vista-previa`);
    await expect(ownerPage.getByText("El vehículo no cumple los criterios mínimos del marketplace.")).toBeVisible();
    await ownerContext.close();
  } finally {
    for (const id of listingIds) await admin.from("listings").delete().eq("id", id);
    await deleteUsers(admin, [otherStaff.id, staff.id, owner.id]);
  }
});
