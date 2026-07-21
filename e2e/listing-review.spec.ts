import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { adminClient, createConfirmedUser, deleteUsers, e2eEnv, setRolePrivileged } from "./support";

test.describe.configure({ mode: "serial" });

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/cuenta$/);
}

test("propietario envía un anuncio completo y sólo un staff toma la revisión", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const admin = adminClient();
  const users = await Promise.all([
    createConfirmedUser(admin, "review-owner"),
    createConfirmedUser(admin, "review-staff-a"),
    createConfirmedUser(admin, "review-staff-b"),
  ]);
  const [owner, staffA, staffB] = users;
  await setRolePrivileged(staffA.id, "staff");
  await setRolePrivileged(staffB.id, "staff");
  let listingId = "";
  try {
    const [{ data: category }, { data: brand }] = await Promise.all([
      admin.from("categories").select("id").eq("slug", "deportivos").single(),
      admin.from("brands").select("id").eq("slug", "mazda").single(),
    ]);
    const { data: model } = await admin.from("models").select("id").eq("brand_id", brand!.id).eq("slug", "mx-5").single();
    const created = await admin.from("listings").insert({
      owner_id: owner.id, title: "Revisión E2E", category_id: category!.id, brand_id: brand!.id, model_id: model!.id,
      year: 2020, mileage_km: 30000, exterior_color: "Rojo", body_style: "Convertible",
      transmission: "Manual", fuel_type: "Gasolina", price_mxn: 500000, city: "Guadalajara", state_region: "Jalisco",
      owner_description: "Vehículo conservado cuidadosamente por su propietario, con uso recreativo y toda su historia disponible para revisión detallada.",
      ownership_history: "Comprado nuevo y conservado por el mismo propietario durante toda su vida útil.",
      maintenance_history: "Servicios periódicos documentados y mantenimiento preventivo al día.",
      modifications: "Sin modificaciones", known_issues: "Ninguno",
    }).select("id").single();
    expect(created.error).toBeNull();
    listingId = created.data!.id;

    await login(page, owner.email, owner.password);
    await page.goto(`/cuenta/anuncios/${listingId}/editar`);
    await expect(page.getByText("Agrega al menos 8 fotografías finalizadas.")).toBeVisible();
    const image = Buffer.from((await readFile(join(process.cwd(), "e2e", "fixtures", "pixel.png.base64"), "utf8")).trim(), "base64");
    await page.locator('input[type="file"]').setInputFiles(Array.from({ length: 8 }, (_, index) => ({ name: `vehiculo-${index + 1}.png`, mimeType: "image/png", buffer: image })));
    await expect(page.getByText("8 fotografías cargadas correctamente.")).toBeVisible({ timeout: 120_000 });
    await page.reload();
    await expect(page.getByRole("img", { name: /Fotografía/ })).toHaveCount(8);
    await page.getByLabel("Soy propietario del vehículo o estoy autorizado para venderlo.").check();
    await page.getByLabel("La información proporcionada es veraz.").check();
    await page.getByLabel("Declaré las modificaciones y los problemas conocidos.").check();
    await page.getByLabel("Cuento con documentación para acreditar propiedad y situación legal.").check();
    await page.getByRole("button", { name: "Enviar a revisión" }).click();
    await expect(page).toHaveURL(new RegExp(`/cuenta/anuncios/${listingId}/vista-previa$`));
    await expect(page.getByText(/Enviado a revisión/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver a editar" })).toHaveCount(0);

    const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    const staffPages = await Promise.all(contexts.map((context) => context.newPage()));
    await Promise.all([login(staffPages[0], staffA.email, staffA.password), login(staffPages[1], staffB.email, staffB.password)]);
    await Promise.all(staffPages.map((staffPage) => staffPage.goto(`/staff/anuncios/${listingId}`)));
    await Promise.all(staffPages.map((staffPage) => expect(staffPage.getByRole("button", { name: "Tomar revisión" })).toBeVisible()));
    await Promise.all(staffPages.map((staffPage) => staffPage.getByRole("button", { name: "Tomar revisión" }).click()));
    await expect.poll(async () => (await admin.from("listings").select("status").eq("id", listingId).single()).data?.status).toBe("in_review");
    const winner = await admin.from("listings").select("status,reviewer_id").eq("id", listingId).single();
    const winnerIndex = winner.data?.reviewer_id === staffA.id ? 0 : 1;
    const loserIndex = winnerIndex === 0 ? 1 : 0;
    expect([staffA.id, staffB.id]).toContain(winner.data?.reviewer_id);
    await expect(staffPages[winnerIndex].getByText("Revisión asignada a tu cuenta.", { exact: false })).toBeVisible();
    await expect(staffPages[loserIndex].getByText("Otro miembro de staff tomó esta revisión.", { exact: false })).toBeVisible();
    await expect(staffPages[loserIndex].getByRole("button", { name: "Tomar revisión" })).toHaveCount(0);
    expect((await admin.from("listing_status_history").select("id").eq("listing_id", listingId).eq("to_status", "in_review")).data).toHaveLength(1);
    await Promise.all(contexts.map((context) => context.close()));

    await page.reload();
    await expect(page.getByText(/En revisión/)).toBeVisible();
    expect((await createClient(e2eEnv.supabaseUrl, e2eEnv.publishableKey).from("listings").select("id").eq("id", listingId)).data).toEqual([]);
  } finally {
    if (listingId) {
      const objects = await admin.storage.from("listing-media").list(listingId, { limit: 100 });
      const paths = (objects.data ?? []).map((item) => `${listingId}/${item.name}`);
      if (paths.length) await admin.storage.from("listing-media").remove(paths);
      await admin.from("listings").delete().eq("id", listingId);
    }
    await deleteUsers(admin, users.map((user) => user.id).reverse());
  }
});
