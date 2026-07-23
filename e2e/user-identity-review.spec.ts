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
  test.setTimeout(240_000);
  const admin = adminClient();
  const [owner, staff, otherUser] = await Promise.all([
    createConfirmedUser(admin, "decision-owner"),
    createConfirmedUser(admin, "decision-staff"),
    createConfirmedUser(admin, "decision-other-user"),
  ]);
  await setRolePrivileged(staff.id, "staff");
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
    const openOwnerContext = await browser.newContext();
    const openOwnerPage = await openOwnerContext.newPage();
    await login(openOwnerPage, owner.email, owner.password, /\/cuenta$/);
    await expect(openOwnerPage.getByRole("heading", { name: "Actualizaciones de tus anuncios" })).toBeVisible();
    await expect(openOwnerPage.getByText("No tienes actualizaciones de revisión pendientes.")).toBeVisible();

    const legacy = await admin.from("listings").insert({ owner_id: owner.id, title: "Aprobado legado E2E", status: "approved" }).select("id").single();
    expect(legacy.error).toBeNull();
    const legacyId = legacy.data!.id;
    listingIds.push(legacyId);
    const legacySubmission = await admin.from("listing_submissions").insert({ listing_id: legacyId, submitted_by: owner.id, attest_owner_authorized: true, attest_information_truthful: true, attest_modifications_and_issues_disclosed: true, attest_legal_documentation: true, attestation_version: "2026-07-20-v1" }).select("id").single();
    expect(legacySubmission.error).toBeNull();
    expect((await admin.from("listing_review_decisions").insert({ submission_id: legacySubmission.data!.id, listing_id: legacyId, reviewer_id: staff.id, decision: "approved" })).error).toBeNull();
    const publishedBefore = (await admin.from("listings").select("id", { count: "exact", head: true }).eq("status", "published")).count ?? 0;
    const inReviewBefore = (await admin.from("listings").select("id", { count: "exact", head: true }).eq("status", "in_review")).count ?? 0;
    const legacyBefore = (await admin.from("listings").select("id", { count: "exact", head: true }).eq("status", "approved")).count ?? 0;

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
    await page.getByRole("button", { name: "Aprobar y publicar" }).click();
    await expect(page.getByText("Anuncio aprobado y publicado.")).toBeVisible({ timeout: 30_000 });
    const approved = await admin.from("listings").select("status,published_at").eq("id", approveId).single();
    expect(approved.data?.status).toBe("published");
    expect(approved.data?.published_at).not.toBeNull();
    await page.goto("/staff");
    await expect(page.locator('a[href="/staff/anuncios?view=published"]')).toContainText(String(publishedBefore + 1));
    await expect(page.locator('a[href="/staff/anuncios?view=in-review"]')).toContainText(String(inReviewBefore - 3));
    await page.goto("/staff/anuncios");
    await expect(page.getByText("Aprobar E2E")).toHaveCount(0);
    const decisionsBeforeLegacyPublish = (await admin.from("listing_review_decisions").select("id").eq("listing_id", legacyId)).data?.length;
    await page.goto(`/staff/anuncios/${legacyId}?from=legacy-approved`);
    await page.getByRole("button", { name: "Publicar anuncio" }).click();
    await expect(page.getByText("Anuncio aprobado y publicado.")).toBeVisible({ timeout: 30_000 });
    expect((await admin.from("listings").select("status,published_at").eq("id", legacyId).single()).data?.status).toBe("published");
    expect((await admin.from("listing_review_decisions").select("id").eq("listing_id", legacyId)).data).toHaveLength(decisionsBeforeLegacyPublish ?? 1);
    await page.goto("/staff");
    await expect(page.locator('a[href="/staff/anuncios?view=published"]')).toContainText(String(publishedBefore + 2));
    const legacyCard = page.locator('a[href="/staff/anuncios?view=legacy-approved"]');
    if (legacyBefore - 1 === 0) await expect(legacyCard).toHaveCount(0);
    else await expect(legacyCard).toContainText(String(legacyBefore - 1));
    await page.goto("/staff/anuncios?view=legacy-approved");
    await expect(page.locator(`a[href^="/staff/anuncios/${legacyId}"]`)).toHaveCount(0);
    await page.goto("/staff/anuncios?view=published");
    await expect(page.locator(`a[href^="/staff/anuncios/${legacyId}"]`)).toHaveCount(1);

    await openOwnerPage.reload();
    await expect(openOwnerPage.getByText("Tu anuncio fue rechazado.")).toBeVisible();
    await expect(openOwnerPage.getByText("Tu anuncio requiere cambios.")).toBeVisible();
    await expect(openOwnerPage.getByText("Tu anuncio ya está publicado.")).toHaveCount(2);
    await openOwnerContext.close();

    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await login(ownerPage, owner.email, owner.password, /\/cuenta$/);
    const rejectionUpdate = ownerPage.getByRole("article").filter({
      has: ownerPage.locator(`a[href="/cuenta/anuncios/${rejectId}/vista-previa"]`),
    });
    await expect(rejectionUpdate.getByText("Tu anuncio fue rechazado.")).toBeVisible();
    await expect(rejectionUpdate.getByRole("link", { name: "Ver motivo" })).toBeVisible();
    await expect(ownerPage.getByText("Tu anuncio ya está visible en el marketplace.")).toHaveCount(2);

    await ownerPage.goto("/cuenta/anuncios");
    const rejectedCard = ownerPage.getByRole("article").filter({
      has: ownerPage.locator(`a[href="/cuenta/anuncios/${rejectId}/vista-previa"]`),
    });
    const changesCard = ownerPage.getByRole("article").filter({
      has: ownerPage.locator(`a[href="/cuenta/anuncios/${changesId}/vista-previa"]`),
    });
    const approvedCard = ownerPage.getByRole("article").filter({
      has: ownerPage.locator(`a[href="/autos/${approveId}"]`),
    });
    await expect(rejectedCard.getByText("Rechazado", { exact: true })).toBeVisible();
    await expect(rejectedCard.getByRole("link", { name: "Ver motivo" })).toBeVisible();
    await expect(changesCard.getByText("Cambios solicitados", { exact: true })).toBeVisible();
    await expect(changesCard.getByRole("link", { name: "Ver mensaje" })).toBeVisible();
    await expect(approvedCard.getByText("Publicado", { exact: true })).toBeVisible();
    await expect(approvedCard.getByRole("link", { name: "Ver publicación" })).toBeVisible();

    await ownerPage.goto(`/cuenta/anuncios/${changesId}/vista-previa`);
    await expect(ownerPage.getByText("Corrige la descripción y documenta claramente el mantenimiento.")).toBeVisible();
    await expect(ownerPage.getByText(/Fecha de decisión:/)).toBeVisible();
    await expect(ownerPage.getByRole("link", { name: "Editar y corregir" })).toBeVisible();
    await expect(ownerPage.getByRole("button", { name: "Enviar a revisión" })).toBeVisible();
    await ownerPage.goto(`/cuenta/anuncios/${approveId}/vista-previa`);
    await expect(ownerPage.getByText(/Publicado\. Tu anuncio ya está visible en el marketplace/)).toBeVisible();
    await expect(ownerPage.getByText("Vista previa privada.")).toHaveCount(0);
    await expect(ownerPage.getByRole("link", { name: "Ver publicación" })).toBeVisible();
    await ownerPage.goto(`/autos/${approveId}`);
    await expect(ownerPage.getByRole("link", { name: `@${owner.username}` })).toBeVisible();
    await ownerPage.goto(`/u/${owner.username}`);
    await expect(ownerPage.locator(`a[href="/autos/${approveId}"]`)).toBeVisible();
    expect((await ownerPage.goto(`/autos/${changesId}`))?.status()).toBe(404);
    expect((await ownerPage.goto(`/autos/${rejectId}`))?.status()).toBe(404);
    await ownerPage.goto(`/cuenta/anuncios/${rejectId}/vista-previa`);
    await expect(ownerPage.getByText("El vehículo no cumple los criterios mínimos del marketplace.")).toBeVisible();
    await expect(ownerPage.getByText("Este anuncio no puede editarse ni reenviarse en esta versión.")).toBeVisible();
    await expect(ownerPage.getByText(/Fecha de decisión:/)).toBeVisible();
    await expect(ownerPage.getByRole("link", { name: "Volver a editar" })).toHaveCount(0);
    await expect(ownerPage.getByRole("button", { name: "Enviar a revisión" })).toHaveCount(0);
    const ownerHtml = await ownerPage.content();
    expect(ownerHtml).not.toContain(staff.id);
    expect(ownerHtml).not.toContain(staff.email);
    await ownerPage.goto(`/cuenta/anuncios/${rejectId}/editar`);
    await expect(ownerPage.getByRole("heading", { name: "Este anuncio no se puede editar" })).toBeVisible();
    await expect(ownerPage.getByRole("button", { name: "Guardar borrador" })).toHaveCount(0);
    await ownerPage.goto(`/cuenta/anuncios/${approveId}/editar`);
    await expect(ownerPage.getByRole("heading", { name: "Este anuncio no se puede editar" })).toBeVisible();
    await ownerContext.close();

    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    expect((await publicPage.goto(`/autos/${approveId}`))?.status()).toBe(200);
    await expect(publicPage.getByRole("link", { name: `@${owner.username}` })).toBeVisible();
    const publicHtml = await publicPage.content();
    expect(publicHtml).not.toContain(staff.id);
    expect(publicHtml).not.toContain(staff.email);
    expect(publicHtml).not.toContain(owner.id);
    expect((await publicPage.goto(`/autos/${changesId}`))?.status()).toBe(404);
    expect((await publicPage.goto(`/autos/${rejectId}`))?.status()).toBe(404);
    await publicPage.goto(`/u/${owner.username}`);
    await expect(publicPage.locator(`a[href="/autos/${approveId}"]`)).toBeVisible();
    await publicContext.close();

    const otherClient = anonymousClient();
    expect((await otherClient.auth.signInWithPassword({ email: otherUser.email, password: otherUser.password })).error).toBeNull();
    const foreignDecision = await otherClient.from("listing_review_decisions").select("decision,message,created_at").eq("listing_id", rejectId);
    expect(foreignDecision.error).toBeNull();
    expect(foreignDecision.data).toEqual([]);
    expect((await otherClient.from("listings").update({ title: "No permitido" }).eq("id", approveId).select()).data).toEqual([]);
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await login(otherPage, otherUser.email, otherUser.password, /\/cuenta$/);
    const foreignPreview = await otherPage.goto(`/cuenta/anuncios/${rejectId}/vista-previa`);
    expect(foreignPreview?.status()).toBe(404);
    await otherContext.close();
  } finally {
    for (const id of listingIds) await admin.from("listings").delete().eq("id", id);
    await deleteUsers(admin, [otherUser.id, staff.id, owner.id]);
  }
});
