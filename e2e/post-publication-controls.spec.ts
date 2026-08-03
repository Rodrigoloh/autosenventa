import { expect, test, type Page } from "@playwright/test";
import { adminClient, anonymousClient, createConfirmedUser, deleteUsers, setRolePrivileged } from "./support";

async function login(page: Page, email: string, password: string, destination: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(destination, { timeout: 60_000 });
}

test("staff pausa, reanuda y regresa una publicación a una nueva revisión", async ({ page, browser }) => {
  test.setTimeout(600_000);
  const admin = adminClient();
  const [owner, staff, normalUser] = await Promise.all([
    createConfirmedUser(admin, "post-owner"),
    createConfirmedUser(admin, "post-staff"),
    createConfirmedUser(admin, "post-normal"),
  ]);
  await setRolePrivileged(staff.id, "staff");
  const publishedAt = "2026-07-01T12:00:00.000Z";
  const listing = await admin.from("listings").insert({
    owner_id: owner.id,
    title: "Publicación controlada E2E",
    status: "published",
    published_at: publishedAt,
    submitted_at: "2026-06-30T12:00:00.000Z",
    reviewer_id: staff.id,
    review_started_at: "2026-06-30T13:00:00.000Z",
  }).select("id").single();
  expect(listing.error).toBeNull();
  const listingId = listing.data!.id;
  const submission = await admin.from("listing_submissions").insert({
    listing_id: listingId,
    submitted_by: owner.id,
    attest_owner_authorized: true,
    attest_information_truthful: true,
    attest_modifications_and_issues_disclosed: true,
    attest_legal_documentation: true,
    attestation_version: "2026-07-20-v1",
  }).select("id").single();
  expect(submission.error).toBeNull();
  expect((await admin.from("listing_review_decisions").insert({
    submission_id: submission.data!.id,
    listing_id: listingId,
    reviewer_id: staff.id,
    decision: "approved",
  })).error).toBeNull();

  const pauseReason = "El vehículo no está disponible temporalmente para mostrarse.";
  const reviewReason = "Detectamos información que requiere una nueva validación editorial.";
  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();

  try {
    expect((await publicPage.goto(`/autos/${listingId}`))?.status()).toBe(200);
    await publicPage.goto(`/u/${owner.username}`);
    await expect(publicPage.locator(`a[href="/autos/${listingId}"]`)).toBeVisible();

    const normalClient = anonymousClient();
    expect((await normalClient.auth.signInWithPassword({ email: normalUser.email, password: normalUser.password })).error).toBeNull();
    expect((await normalClient.rpc("pause_listing_publication", { target_listing_id: listingId, target_reason: pauseReason })).error).toBeTruthy();
    expect((await normalClient.rpc("resume_listing_publication", { target_listing_id: listingId })).error).toBeTruthy();
    expect((await normalClient.rpc("return_listing_to_review", { target_listing_id: listingId, target_reason: reviewReason })).error).toBeTruthy();

    await login(page, staff.email, staff.password, /\/staff$/);
    await page.goto(`/staff/anuncios/${listingId}?from=published`);
    await expect(page.getByText("Regresar a revisión", { exact: true })).toBeVisible();
    await expect(page.getByText("Pausar publicación", { exact: true })).toBeVisible();
    const pauseControl = page.locator("details").filter({ hasText: "Pausar publicación" });
    await pauseControl.getByText("Pausar publicación", { exact: true }).click();
    await pauseControl.getByRole("textbox", { name: "Motivo" }).fill(pauseReason);
    await pauseControl.getByRole("button", { name: "Confirmar pausa" }).click();
    await expect(page.getByText("Publicación pausada.", { exact: true })).toBeVisible({ timeout: 30_000 });
    const pausedListing = (await admin.from("listings").select("status,published_at").eq("id", listingId).single()).data;
    expect(pausedListing?.status).toBe("paused");
    expect(new Date(pausedListing!.published_at).toISOString()).toBe(publishedAt);
    expect((await publicPage.goto(`/autos/${listingId}`))?.status()).toBe(404);
    await publicPage.goto(`/u/${owner.username}`);
    await expect(publicPage.locator(`a[href="/autos/${listingId}"]`)).toHaveCount(0);

    await login(ownerPage, owner.email, owner.password, /\/cuenta$/);
    await expect(ownerPage.getByText("Publicación pausada", { exact: true })).toBeVisible();
    await expect(ownerPage.getByText("Tu anuncio no está visible actualmente.", { exact: true })).toBeVisible();
    await expect(ownerPage.getByText(pauseReason, { exact: true })).toBeVisible();
    await ownerPage.goto("/cuenta/anuncios");
    const ownerCard = ownerPage.getByRole("article").filter({
      has: ownerPage.locator(`a[href="/cuenta/anuncios/${listingId}/vista-previa"]`),
    });
    await expect(ownerCard.getByText("Publicación pausada", { exact: true })).toBeVisible();
    await expect(ownerCard.getByText(pauseReason, { exact: true })).toBeVisible();

    await page.goto("/staff");
    const pausedCount = (await admin.from("listings").select("id", { count: "exact", head: true }).eq("status", "paused")).count ?? 0;
    await expect(page.locator('a[href="/staff/anuncios?view=paused"]')).toContainText(String(pausedCount));
    await page.goto("/staff/anuncios?view=paused");
    await expect(page.locator(`a[href^="/staff/anuncios/${listingId}"]`)).toBeVisible();
    await page.goto(`/staff/anuncios/${listingId}?from=paused`);
    await page.getByRole("button", { name: "Reanudar publicación" }).click();
    await expect(page.getByText("Publicación reanudada.", { exact: true })).toBeVisible({ timeout: 30_000 });
    const resumedListing = (await admin.from("listings").select("status,published_at").eq("id", listingId).single()).data;
    expect(resumedListing?.status).toBe("published");
    expect(new Date(resumedListing!.published_at).toISOString()).toBe(publishedAt);
    expect((await admin.from("listing_review_decisions").select("id").eq("listing_id", listingId)).data).toHaveLength(1);
    expect((await publicPage.goto(`/autos/${listingId}`))?.status()).toBe(200);
    await publicPage.goto(`/u/${owner.username}`);
    await expect(publicPage.locator(`a[href="/autos/${listingId}"]`)).toBeVisible();
    await ownerPage.goto("/cuenta");
    await expect(ownerPage.getByText("Tu anuncio está nuevamente visible en el marketplace.", { exact: true })).toBeVisible();

    await page.goto(`/staff/anuncios/${listingId}?from=published`);
    const reviewControl = page.locator("details").filter({ hasText: "Regresar a revisión" });
    await reviewControl.getByText("Regresar a revisión", { exact: true }).click();
    await reviewControl.getByRole("textbox", { name: "Motivo" }).fill(reviewReason);
    await reviewControl.getByRole("button", { name: "Confirmar regreso a revisión" }).click();
    await expect(page.getByText("El anuncio regresó a revisión y quedó asignado a tu cuenta.", { exact: true })).toBeVisible({ timeout: 30_000 });
    expect((await admin.from("listings").select("status,reviewer_id,review_started_at").eq("id", listingId).single()).data).toMatchObject({ status: "in_review", reviewer_id: staff.id });
    expect((await admin.from("listing_submissions").select("id").eq("listing_id", listingId)).data).toHaveLength(2);
    expect((await admin.from("listing_review_decisions").select("id").eq("listing_id", listingId)).data).toHaveLength(1);
    expect((await publicPage.goto(`/autos/${listingId}`))?.status()).toBe(404);

    await ownerPage.goto("/cuenta");
    await expect(ownerPage.getByText("Tu anuncio regresó a revisión.", { exact: true })).toBeVisible();
    await expect(ownerPage.getByText(reviewReason, { exact: true })).toBeVisible();
    const ownerHtml = await ownerPage.content();
    expect(ownerHtml).not.toContain(staff.id);
    expect(ownerHtml).not.toContain(staff.email);

    await page.goto("/staff");
    const mineCount = (await admin.from("listings").select("id", { count: "exact", head: true }).eq("status", "in_review").eq("reviewer_id", staff.id)).count ?? 0;
    await expect(page.locator('a[href="/staff/anuncios?view=mine"]')).toContainText(String(mineCount));
    await page.goto("/staff/anuncios?view=mine");
    await expect(page.locator(`a[href^="/staff/anuncios/${listingId}"]`)).toBeVisible();
    await page.goto(`/staff/anuncios/${listingId}?from=mine`);
    await page.getByRole("button", { name: "Aprobar y publicar" }).click();
    await expect(page.getByText("Anuncio aprobado y publicado.", { exact: true })).toBeVisible({ timeout: 30_000 });
    expect((await admin.from("listing_review_decisions").select("id").eq("listing_id", listingId).eq("decision", "approved")).data).toHaveLength(2);
    const republishedAt = (await admin.from("listings").select("published_at").eq("id", listingId).single()).data?.published_at;
    expect(new Date(republishedAt!).toISOString()).toBe(publishedAt);
    expect((await admin.from("listing_status_history").select("id").eq("listing_id", listingId)).data).toHaveLength(4);
    expect((await publicPage.goto(`/autos/${listingId}`))?.status()).toBe(200);
  } finally {
    await publicContext.close();
    await ownerContext.close();
    await admin.from("listings").delete().eq("id", listingId);
    await deleteUsers(admin, [normalUser.id, staff.id, owner.id]);
  }
});
