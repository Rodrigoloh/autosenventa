import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminClient, createConfirmedUser, deleteUsers, setRolePrivileged } from "./support";

async function login(page: Page, email: string, password: string, destination: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(destination, { timeout: 60_000 });
}

async function authenticatedPage(browser: Browser, email: string, password: string, destination: RegExp) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, email, password, destination);
  return { context, page };
}

test("separa las vistas públicas y staff, con navegación contextual según el rol", async ({ browser, page }) => {
  test.setTimeout(600_000);
  const admin = adminClient();
  const [owner, staff, adminUser, normalUser] = await Promise.all([
    createConfirmedUser(admin, "surface-owner"),
    createConfirmedUser(admin, "surface-staff"),
    createConfirmedUser(admin, "surface-admin"),
    createConfirmedUser(admin, "surface-normal"),
  ]);
  await Promise.all([setRolePrivileged(staff.id, "staff"), setRolePrivileged(adminUser.id, "admin")]);
  const taxonomy = await admin.from("models").select("id,name,brand_id,brands!inner(name)").eq("active", true).eq("brands.active", true).limit(1).single();
  expect(taxonomy.error).toBeNull();
  const model = taxonomy.data! as unknown as { id: number; name: string; brand_id: number; brands: { name: string } };
  const now = new Date().toISOString();
  const inserted = await admin.from("listings").insert([
    { owner_id: owner.id, status: "published", published_at: now, year: 2024, brand_id: model.brand_id, model_id: model.id, variant: "Navegacion", title: "ignorado" },
    { owner_id: owner.id, status: "paused", published_at: now, year: 2023, brand_id: model.brand_id, model_id: model.id, variant: "Pausado", title: "ignorado" },
  ]).select("id,title,status");
  expect(inserted.error).toBeNull();
  const published = inserted.data!.find((listing) => listing.status === "published")!;
  const paused = inserted.data!.find((listing) => listing.status === "paused")!;
  const contexts: Array<{ close(): Promise<void> }> = [];

  try {
    await page.goto(`/autos/${published.id}`);
    await expect(page.getByRole("link", { name: "Abrir en staff" })).toHaveCount(0);
    await page.goto(`/u/${owner.username}`);
    await expect(page.getByRole("link", { name: "Abrir perfil en staff" })).toHaveCount(0);

    const normal = await authenticatedPage(browser, normalUser.email, normalUser.password, /\/cuenta$/);
    contexts.push(normal.context);
    await normal.page.goto(`/autos/${published.id}`);
    await expect(normal.page.getByRole("link", { name: "Abrir en staff" })).toHaveCount(0);
    await normal.page.goto(`/u/${owner.username}`);
    await expect(normal.page.getByRole("link", { name: "Abrir perfil en staff" })).toHaveCount(0);
    await normal.page.goto(`/staff/anuncios/${published.id}`);
    await expect(normal.page).toHaveURL(/\/cuenta$/, { timeout: 60_000 });
    await normal.page.goto(`/staff/usuarios/${owner.id}`);
    await expect(normal.page).toHaveURL(/\/cuenta$/, { timeout: 60_000 });

    for (const identity of [staff, adminUser]) {
      const authenticated = await authenticatedPage(browser, identity.email, identity.password, /\/staff$/);
      contexts.push(authenticated.context);
      await authenticated.page.goto(`/autos/${published.id}`);
      await expect(authenticated.page.getByRole("link", { name: "Abrir en staff" })).toHaveAttribute("href", `/staff/anuncios/${published.id}`);
      await expect(authenticated.page.getByText("Auditoría post-publicación", { exact: true })).toHaveCount(0);
      await authenticated.page.goto(`/u/${owner.username}`);
      const profileStaffLink = authenticated.page.getByRole("link", { name: "Abrir perfil en staff" });
      await expect(profileStaffLink).toHaveAttribute("href", `/staff/usuarios/${owner.id}`);
      await expect(profileStaffLink).not.toContainText(owner.id);
    }

    const staffSession = await authenticatedPage(browser, staff.email, staff.password, /\/staff$/);
    contexts.push(staffSession.context);
    await staffSession.page.goto(`/staff/anuncios/${published.id}?from=published`);
    await expect(staffSession.page.getByRole("link", { name: "Ver publicación pública" })).toHaveAttribute("href", `/autos/${published.id}`);
    await staffSession.page.goto(`/staff/anuncios/${paused.id}?from=paused`);
    await expect(staffSession.page.getByRole("link", { name: "Ver publicación pública" })).toHaveCount(0);
    await staffSession.page.goto(`/staff/usuarios/${owner.id}`);
    await expect(staffSession.page.getByRole("link", { name: "Ver perfil público" })).toHaveAttribute("href", `/u/${owner.username}`);
  } finally {
    for (const context of contexts) await context.close();
    await admin.from("listings").delete().in("id", [published.id, paused.id]);
    await deleteUsers(admin, [normalUser.id, adminUser.id, staff.id, owner.id]);
  }
});

test("el buscador staff combina username, vehículo, título e ID con la vista allowlisted", async ({ page }) => {
  test.setTimeout(600_000);
  const admin = adminClient();
  const [owner, staff] = await Promise.all([
    createConfirmedUser(admin, "search-owner"),
    createConfirmedUser(admin, "search-staff"),
  ]);
  await setRolePrivileged(staff.id, "staff");
  const taxonomy = await admin.from("models").select("id,name,brand_id,brands!inner(name)").eq("active", true).eq("brands.active", true).limit(1).single();
  expect(taxonomy.error).toBeNull();
  const model = taxonomy.data! as unknown as { id: number; name: string; brand_id: number; brands: { name: string } };
  const now = new Date().toISOString();
  const inserted = await admin.from("listings").insert([
    { owner_id: owner.id, status: "published", published_at: now, year: 2022, brand_id: model.brand_id, model_id: model.id, variant: "Unico Buscable", title: "ignorado" },
    { owner_id: owner.id, status: "paused", published_at: now, year: 2021, brand_id: model.brand_id, model_id: model.id, variant: "Fuera De Vista", title: "ignorado" },
  ]).select("id,title,status");
  expect(inserted.error).toBeNull();
  const published = inserted.data!.find((listing) => listing.status === "published")!;
  const paused = inserted.data!.find((listing) => listing.status === "paused")!;
  const listingLink = (id: string) => page.locator(`a[href^="/staff/anuncios/${id}"]`);
  const assertPublishedSearch = async (query: string) => {
    await page.goto(`/staff/anuncios?view=published&q=${encodeURIComponent(query)}`);
    await expect(listingLink(published.id)).toHaveCount(1);
    await expect(listingLink(paused.id)).toHaveCount(0);
    await expect(page.getByText(/1 resultado para/)).toBeVisible();
  };

  try {
    await login(page, staff.email, staff.password, /\/staff$/);
    await assertPublishedSearch(owner.username!);
    await assertPublishedSearch(model.brands.name.toUpperCase());
    await assertPublishedSearch(model.name);
    await assertPublishedSearch("Unico Buscable");
    await assertPublishedSearch(published.id);

    await page.goto(`/staff/anuncios?view=paused&q=${encodeURIComponent(owner.username!)}`);
    await expect(listingLink(paused.id)).toHaveCount(1);
    await expect(listingLink(published.id)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Limpiar búsqueda" })).toHaveAttribute("href", "/staff/anuncios?view=paused");

    await page.goto(`/staff/anuncios?view=published&q=${encodeURIComponent(owner.username!)}`);
    await listingLink(published.id).click();
    await expect(page.getByRole("link", { name: new RegExp(`Volver a resultados de.*${owner.username}`) })).toHaveAttribute(
      "href",
      `/staff/anuncios?view=published&q=${owner.username}`,
    );
  } finally {
    await admin.from("listings").delete().in("id", [published.id, paused.id]);
    await deleteUsers(admin, [staff.id, owner.id]);
  }
});
