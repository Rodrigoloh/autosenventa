import { expect, test, type Page } from "@playwright/test";
import { adminClient, createConfirmedUser, deleteUsers, setRolePrivileged } from "./support";

async function login(page: Page, email: string, password: string, destination: RegExp) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto("/login");
    await page.getByLabel("Correo").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    try {
      await expect(page).toHaveURL(destination, { timeout: 60_000 });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

test("dashboard staff enlaza conteos y aplica filtros allowlisted en servidor", async ({ page }) => {
  test.setTimeout(600_000);
  const admin = adminClient();
  const staff = await createConfirmedUser(admin, "dashboard-staff");
  const otherStaff = await createConfirmedUser(admin, "dashboard-other-staff");
  const normalUser = await createConfirmedUser(admin, "dashboard-normal-user");
  await setRolePrivileged(staff.id, "staff");
  await setRolePrivileged(otherStaff.id, "staff");
  const now = new Date().toISOString();
  const inserted = await admin.from("listings").insert([
    { owner_id: normalUser.id, title: "Pendiente dashboard", status: "submitted", submitted_at: now },
    { owner_id: normalUser.id, title: "Revisión propia dashboard", status: "in_review", submitted_at: now, reviewer_id: staff.id, review_started_at: now },
    { owner_id: normalUser.id, title: "Revisión ajena dashboard", status: "in_review", submitted_at: now, reviewer_id: otherStaff.id, review_started_at: now },
    { owner_id: normalUser.id, title: "Cambios dashboard", status: "changes_requested", submitted_at: now },
    { owner_id: normalUser.id, title: "Rechazado dashboard", status: "rejected", submitted_at: now },
    { owner_id: normalUser.id, title: "Publicado dashboard", status: "published", submitted_at: now, published_at: now },
  ]).select("id,status,reviewer_id");
  expect(inserted.error).toBeNull();
  const listings = inserted.data ?? [];
  const byStatus = (status: string) => listings.filter((listing) => listing.status === status);
  const pendingId = byStatus("submitted")[0].id;
  const ownReviewId = byStatus("in_review").find((listing) => listing.reviewer_id === staff.id)!.id;
  const otherReviewId = byStatus("in_review").find((listing) => listing.reviewer_id === otherStaff.id)!.id;
  const changesId = byStatus("changes_requested")[0].id;
  const rejectedId = byStatus("rejected")[0].id;
  const publishedId = byStatus("published")[0].id;

  const listingLink = (id: string) => page.locator(`a[href^="/staff/anuncios/${id}"]`);
  const openView = async (view: string, title: string) => {
    const target = `/staff/anuncios?view=${view}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.goto(target);
      if (new URL(page.url()).pathname === "/login") await login(page, staff.email, staff.password, /\/staff$/);
      if (page.url().endsWith(target)) break;
    }
    await expect(page).toHaveURL(new RegExp(`/staff/anuncios\\?view=${view}$`), { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 60_000 });
  };
  try {
    await login(page, staff.email, staff.password, /\/staff$/);
    await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible({ timeout: 60_000 });
    const pendingCount = (await admin.from("listings").select("id", { count: "exact", head: true }).eq("status", "submitted").is("reviewer_id", null)).count ?? 0;
    const pendingCard = page.locator('a[href="/staff/anuncios?view=pending"]');
    await expect(pendingCard).toContainText("Pendientes de revisión", { timeout: 60_000 });
    await expect(pendingCard).toContainText(String(pendingCount), { timeout: 60_000 });
    await pendingCard.focus();
    await expect(pendingCard).toBeFocused();
    await pendingCard.press("Enter");
    await expect(page).toHaveURL(/\/staff\/anuncios\?view=pending$/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Pendientes de revisión" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(`${pendingCount} anuncio esperando atención`, { exact: true })).toBeVisible();
    await expect(listingLink(pendingId)).toHaveCount(1);
    await expect(listingLink(ownReviewId)).toHaveCount(0);
    await expect(listingLink(otherReviewId)).toHaveCount(0);
    await expect(listingLink(rejectedId)).toHaveCount(0);
    await expect(listingLink(publishedId)).toHaveCount(0);

    await openView("in-review", "En revisión");
    await expect(listingLink(ownReviewId)).toHaveCount(1);
    await expect(listingLink(otherReviewId)).toHaveCount(1);
    await expect(listingLink(pendingId)).toHaveCount(0);

    await openView("mine", "Mis revisiones activas");
    await expect(listingLink(ownReviewId)).toHaveCount(1);
    await expect(listingLink(otherReviewId)).toHaveCount(0);

    await openView("changes-requested", "Cambios solicitados");
    await expect(listingLink(changesId)).toHaveCount(1);
    await expect(listingLink(rejectedId)).toHaveCount(0);

    await openView("published", "Publicados");
    await expect(listingLink(publishedId)).toHaveCount(1);

    await page.goto("/staff/anuncios?view=published%3Bdrop-table-listings");
    await expect(page).toHaveURL(/\/staff\/anuncios\?view=pending$/);

    const keyboardCards = [
      ["pending", "Pendientes de revisión"],
      ["in-review", "En revisión"],
      ["mine", "Mis revisiones activas"],
      ["changes-requested", "Cambios solicitados"],
      ["published", "Publicados"],
    ] as const;
    await page.goto("/staff");
    if (new URL(page.url()).pathname === "/login") await login(page, staff.email, staff.password, /\/staff$/);
    await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible({ timeout: 60_000 });
    for (const [view, label] of keyboardCards) {
      const card = page.locator(`a[href="/staff/anuncios?view=${view}"]`).filter({ hasText: label });
      await card.focus();
      await expect(card).toBeFocused();
    }

  } finally {
    await admin.from("listings").delete().in("id", listings.map((listing) => listing.id));
    await deleteUsers(admin, [otherStaff.id, staff.id, normalUser.id]);
  }
});

test("usuario normal no abre vistas filtradas de staff", async ({ page }) => {
  test.setTimeout(300_000);
  const admin = adminClient();
  const user = await createConfirmedUser(admin, "dashboard-guard-user");
  try {
    await login(page, user.email, user.password, /\/cuenta$/);
    for (const view of ["pending", "in-review", "mine", "changes-requested", "published"]) {
      await page.goto(`/staff/anuncios?view=${view}`);
      await expect(page).toHaveURL(/\/cuenta$/, { timeout: 60_000 });
    }
  } finally {
    await deleteUsers(admin, [user.id]);
  }
});
