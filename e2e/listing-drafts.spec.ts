import { expect, test } from "@playwright/test";
import { adminClient, createConfirmedUser, deleteUsers } from "./support";

test.describe.configure({ mode: "serial" });

test.describe("Borrador de anuncio del propietario", () => {
  const admin = adminClient();
  const userIds: string[] = [];
  const listingIds: string[] = [];

  test.afterAll(async () => {
    for (const id of listingIds) await admin.from("listings").delete().eq("id", id);
    await deleteUsers(admin, userIds.reverse());
  });

  test("crea, guarda, recupera y previsualiza un draft privado", async ({ page }) => {
    test.setTimeout(360_000);
    const owner = await createConfirmedUser(admin, "draft-owner");
    const other = await createConfirmedUser(admin, "draft-other");
    userIds.push(owner.id, other.id);

    const foreign = await admin.from("listings").insert({ owner_id: other.id, title: "Ajeno" }).select("id").single();
    expect(foreign.error).toBeNull();
    listingIds.push(foreign.data!.id);

    await page.goto("/cuenta/anuncios");
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("Correo").fill(owner.email);
    await page.getByLabel("Contraseña").fill(owner.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/cuenta$/);

    const foreignEdit = await page.goto(`/cuenta/anuncios/${foreign.data!.id}/editar`);
    expect(foreignEdit?.status()).toBe(404);
    const foreignPreview = await page.goto(`/cuenta/anuncios/${foreign.data!.id}/vista-previa`);
    expect(foreignPreview?.status()).toBe(404);

    await page.goto("/cuenta/anuncios/nuevo");
    await page.getByRole("button", { name: "Crear anuncio" }).click();
    await expect(page).toHaveURL(/\/cuenta\/anuncios\/[0-9a-f-]{36}\/editar$/, { timeout: 60_000 });
    const listingId = page.url().match(/anuncios\/([0-9a-f-]{36})\/editar$/)![1];
    listingIds.push(listingId);

    const created = await admin.from("listings").select("owner_id,status,is_featured,editorial_description").eq("id", listingId).single();
    expect(created.error).toBeNull();
    expect(created.data).toEqual({ owner_id: owner.id, status: "draft", is_featured: false, editorial_description: null });
    expect((await admin.from("listings").select("id").eq("owner_id", owner.id)).data).toHaveLength(1);

    await expect(page.getByLabel("Categoría")).toContainText("Clásicos");
    await expect(page.locator('select[name="brand_id"]')).toContainText("Mazda");
    await page.getByLabel("Categoría").selectOption({ label: "Clásicos" });
    await page.locator('select[name="brand_id"]').selectOption({ label: "Mazda" });
    await expect(page.locator('select[name="model_id"] option')).toHaveText(["Selecciona un modelo", "MX-5"]);
    await page.locator('select[name="model_id"]').selectOption({ label: "MX-5" });
    await page.locator('select[name="brand_id"]').selectOption({ label: "Ford" });
    await expect(page.locator('select[name="model_id"]')).toHaveValue("");
    await expect(page.getByText("El modelo se limpió porque no pertenece a la nueva marca.")).toBeVisible();
    await expect(page.locator('select[name="model_id"] option')).toHaveText(["Selecciona un modelo", "Mustang"]);
    await page.locator('select[name="brand_id"]').selectOption({ label: "Mazda" });
    await page.locator('select[name="model_id"]').selectOption({ label: "MX-5" });
    await page.getByLabel("Variante").fill("Grand Touring");
    await page.getByLabel("Año").fill("2016");
    await page.getByLabel("Ciudad").fill("Guadalajara");
    await page.getByLabel("Estado").fill("Jalisco");
    await page.getByLabel("Precio en MXN").fill("420000");
    await page.getByLabel("Kilometraje").fill("55000");
    await page.getByLabel("Color exterior").fill("Rojo");
    await page.getByLabel("Color interior").fill("Negro");
    await page.getByLabel("Carrocería").selectOption("Convertible");
    await page.getByLabel("Transmisión").selectOption("Manual");
    await page.getByLabel("Tracción").selectOption("Trasera");
    await page.getByLabel("Combustible").selectOption("Gasolina");
    await page.getByLabel("Motor").fill("2.0 L");
    await page.getByLabel("Descripción general").fill("Un roadster cuidado y usado los fines de semana.");
    await page.getByLabel("Historia de propiedad").fill("Dos propietarios desde nuevo.");
    await page.getByLabel("Historial de mantenimiento").fill("Servicios documentados.");
    await page.getByRole("textbox", { name: "Modificaciones", exact: true }).fill("Suspensión reversible.");
    await page.getByRole("textbox", { name: "Problemas conocidos", exact: true }).fill("Desgaste menor en el volante.");
    await page.getByLabel("Motivo de venta").fill("Cambio de proyecto.");
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByText("Borrador guardado correctamente.", { exact: true })).toBeVisible();

    const saved = await admin.from("listings").select("title,status,owner_id,price_mxn,mileage_km,owner_description").eq("id", listingId).single();
    expect(saved.data).toMatchObject({
      title: "2016 Mazda MX-5 Grand Touring", status: "draft", owner_id: owner.id,
      mileage_km: 55000, owner_description: "Un roadster cuidado y usado los fines de semana.",
    });
    if (process.env.E2E_VISUAL_REVIEW === "true") {
      await page.screenshot({ path: "test-results/listing-edit-desktop.png", fullPage: true });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("link", { name: "Vista previa" }).click();
    await expect(page.getByText("Vista previa privada. Este anuncio todavía no está publicado.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "2016 Mazda MX-5 Grand Touring" })).toBeVisible();
    await expect(page.getByText("Un roadster cuidado y usado los fines de semana.")).toBeVisible();
    if (process.env.E2E_VISUAL_REVIEW === "true") {
      await page.screenshot({ path: "test-results/listing-preview-mobile.png", fullPage: true });
    }
    expect(await page.locator("body").innerText()).not.toContain("editorial_description");

    await page.goto("/cuenta");
    await page.locator("summary").click();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await page.getByLabel("Correo").fill(owner.email);
    await page.getByLabel("Contraseña").fill(owner.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/cuenta$/);
    await page.goto("/cuenta/anuncios");
    await expect(page.getByRole("heading", { name: "2016 Mazda MX-5 Grand Touring" })).toBeVisible();
    await page.getByRole("link", { name: "Editar" }).click();
    await expect(page.getByLabel("Variante")).toHaveValue("Grand Touring");
    await expect(page.getByLabel("Motivo de venta")).toHaveValue("Cambio de proyecto.");
    await expect(page.getByRole("button", { name: "Publicar" })).toHaveCount(0);
    await page.getByRole("button", { name: "Eliminar borrador" }).click();
    await expect(
      page.getByRole("alert").filter({
        hasText: "Confirma explícitamente que quieres eliminar este borrador.",
      }),
    ).toHaveText("Confirma explícitamente que quieres eliminar este borrador.");
    await page.getByLabel("Confirmo que quiero eliminar este borrador.").check();
    await page.getByRole("button", { name: "Eliminar borrador" }).click();
    await expect(page).toHaveURL(/\/cuenta\/anuncios$/);
    await expect(page.getByRole("heading", { name: "2016 Mazda MX-5 Grand Touring" })).toHaveCount(0);
    expect((await admin.from("listings").select("id").eq("id", listingId)).data).toEqual([]);
  });
});
