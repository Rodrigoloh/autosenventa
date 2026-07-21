import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { expect as baseExpect, test } from "@playwright/test";
import { adminClient, createConfirmedUser, deleteUsers } from "./support";

const expect = baseExpect.configure({ timeout: 60_000 });

test.describe.configure({ mode: "serial" });

test.describe("Fotografías privadas del borrador", () => {
  const admin = adminClient();
  const userIds: string[] = [];
  let listingId = "";

  test.afterAll(async () => {
    if (listingId) {
      const listed = await admin.storage.from("listing-media").list(listingId, { limit: 100 });
      const paths = (listed.data ?? []).map((item) => `${listingId}/${item.name}`);
      if (paths.length) await admin.storage.from("listing-media").remove(paths);
      await admin.from("listings").delete().eq("id", listingId);
    }
    await deleteUsers(admin, userIds.reverse());
  });

  test("sube, administra, previsualiza y elimina un borrador con fotografías", async ({ page }) => {
    test.setTimeout(240_000);
    const owner = await createConfirmedUser(admin, "photo-ui-owner");
    userIds.push(owner.id);
    const listing = await admin.from("listings").insert({ owner_id: owner.id, title: "Draft fotos UI" }).select("id").single();
    expect(listing.error).toBeNull();
    listingId = listing.data!.id;

    await page.goto(`/cuenta/anuncios/${listingId}/editar`);
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("Correo").fill(owner.email);
    await page.getByLabel("Contraseña").fill(owner.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/cuenta$/, { timeout: 60_000 });
    await page.goto(`/cuenta/anuncios/${listingId}/editar`);
    await expect(page.getByRole("heading", { name: "Subir fotografías" })).toBeVisible();
    await expect(page.getByText("20 espacios disponibles", { exact: true })).toBeVisible();

    const image = Buffer.from((await readFile(join(process.cwd(), "e2e", "fixtures", "pixel.png.base64"), "utf8")).trim(), "base64");
    await page.locator('input[type="file"]').setInputFiles({ name: "vehiculo.png", mimeType: "image/png", buffer: image });
    await expect(page.getByText("Completada", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("1 fotografía cargada correctamente.")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("img", { name: "Fotografía 1 del vehículo, portada" })).toBeVisible();
    await expect(page.getByText("19 espacios disponibles", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("img", { name: "Fotografía 1 del vehículo, portada" })).toBeVisible();

    const stored = await admin.from("listing_media")
      .select("storage_path,mime_type,file_size_bytes,width,height,sort_order,is_cover")
      .eq("listing_id", listingId)
      .single();
    expect(stored.error).toBeNull();
    expect(stored.data).toMatchObject({
      mime_type: "image/png",
      file_size_bytes: image.length,
      width: 1,
      height: 1,
      sort_order: 0,
      is_cover: true,
    });

    await page.locator('input[type="file"]').setInputFiles([
      { name: "lateral.png", mimeType: "image/png", buffer: image },
      { name: "interior.png", mimeType: "image/png", buffer: image },
    ]);
    await expect(page.getByText("2 fotografías cargadas correctamente.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("img", { name: /Fotografía/ })).toHaveCount(3);
    await expect(page.getByText("17 espacios disponibles", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Elegir portada" }).nth(1).click();
    await expect(page.getByText("Portada actualizada.")).toBeVisible();
    await page.getByRole("button", { name: "Mover antes" }).nth(1).click();
    await expect(page.getByText("Orden de fotografías guardado.")).toBeVisible({ timeout: 60_000 });

    let managed = await admin.from("listing_media")
      .select("id,sort_order,is_cover,storage_path")
      .eq("listing_id", listingId)
      .order("sort_order");
    expect(managed.data?.map((item) => item.sort_order)).toEqual([0, 1, 2]);
    expect(managed.data?.filter((item) => item.is_cover)).toHaveLength(1);
    expect(managed.data?.[0].is_cover).toBe(true);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Eliminar foto" }).nth(2).click();
    await expect(page.getByText(/Fotografía eliminada/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("img", { name: /Fotografía/ })).toHaveCount(2);
    managed = await admin.from("listing_media").select("id,sort_order,is_cover,storage_path").eq("listing_id", listingId).order("sort_order");
    expect(managed.data?.map((item) => item.sort_order)).toEqual([0, 1]);
    expect(managed.data?.filter((item) => item.is_cover)).toHaveLength(1);
    expect((await admin.storage.from("listing-media").list(listingId, { limit: 100 })).data).toHaveLength(2);

    await page.getByRole("link", { name: "Vista previa" }).click();
    await expect(page.getByText("Vista previa privada. Este anuncio todavía no está publicado.")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("img", { name: "Fotografía 1 del vehículo, portada" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("img", { name: "Fotografía 1 del vehículo, portada" })).toBeVisible();

    await page.goto(`/cuenta/anuncios/${listingId}/editar`);
    await page.unroute("**/storage/v1/object/upload/sign/**");
    await page.route("**/storage/v1/object/upload/sign/**", (route) => route.abort());
    await page.locator('input[type="file"]').setInputFiles({ name: "fallo-red.png", mimeType: "image/png", buffer: image });
    await expect(page.getByText(/Cancelada: No pudimos subir el archivo privado\. Subida cancelada\./)).toBeVisible();
    await expect(page.getByText("18 espacios disponibles", { exact: true })).toBeVisible();
    await expect(page.getByText("Finaliza o cancela todas las subidas y eliminaciones pendientes.")).toHaveCount(0);
    await expect.poll(async () => (
      await admin.from("listing_photo_uploads").select("id").eq("listing_id", listingId)
    ).data?.length).toBe(0);
    await page.unroute("**/storage/v1/object/upload/sign/**");

    await page.locator('input[type="file"]').setInputFiles({
      name: "contenido-falso.png",
      mimeType: "image/png",
      buffer: Buffer.from("no-es-una-imagen"),
    });
    await expect(page.getByText(/Cancelada: El contenido real no coincide.*Subida cancelada\./)).toBeVisible();
    await expect(page.getByRole("img", { name: /Fotografía/ })).toHaveCount(2);
    expect((await admin.from("listing_media").select("id").eq("listing_id", listingId)).data).toHaveLength(2);
    expect((await admin.from("listing_photo_uploads").select("id").eq("listing_id", listingId)).data).toHaveLength(0);
    const objects = await admin.storage.from("listing-media").list(listingId, { limit: 100 });
    expect(objects.data).toHaveLength(2);

    const expiredReservationId = randomUUID();
    const expiredPath = `${listingId}/${randomUUID()}.png`;
    expect((await admin.storage.from("listing-media").upload(expiredPath, image, { contentType: "image/png" })).error).toBeNull();
    expect((await admin.from("listing_photo_uploads").insert({
      id: expiredReservationId,
      listing_id: listingId,
      requested_by: owner.id,
      storage_path: expiredPath,
      expected_mime_type: "image/png",
      expected_size_bytes: image.length,
      created_at: new Date(Date.now() - 120_000).toISOString(),
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    })).error).toBeNull();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Subidas pendientes" })).toBeVisible();
    await expect(page.getByText(/Expirada/)).toBeVisible();
    await page.getByRole("button", { name: "Cancelar y limpiar subida" }).click();
    await expect.poll(async () => (
      await admin.from("listing_photo_uploads").select("id").eq("id", expiredReservationId)
    ).data?.length).toBe(0);
    const storedAfterCleanup = await admin.storage.from("listing-media").list(listingId, { limit: 100 });
    expect(storedAfterCleanup.data?.some((item) => `${listingId}/${item.name}` === expiredPath)).toBe(false);

    const missingObjectReservationId = randomUUID();
    expect((await admin.from("listing_photo_uploads").insert({
      id: missingObjectReservationId,
      listing_id: listingId,
      requested_by: owner.id,
      storage_path: `${listingId}/${randomUUID()}.png`,
      expected_mime_type: "image/png",
      expected_size_bytes: image.length,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    })).error).toBeNull();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Subidas pendientes" })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar y limpiar subida" }).click();
    await expect.poll(async () => (
      await admin.from("listing_photo_uploads").select("id").eq("id", missingObjectReservationId)
    ).data?.length).toBe(0);
    await expect(page.getByText("Finaliza o cancela todas las subidas y eliminaciones pendientes.")).toHaveCount(0);

    await page.getByLabel("Confirmo que quiero eliminar este borrador.").check();
    await page.getByRole("button", { name: "Eliminar borrador" }).click();
    await expect(page).toHaveURL(/\/cuenta\/anuncios$/);
    expect((await admin.from("listings").select("id").eq("id", listingId)).data).toHaveLength(0);
    expect((await admin.from("listing_media").select("id").eq("listing_id", listingId)).data).toHaveLength(0);
    expect((await admin.from("listing_photo_uploads").select("id").eq("listing_id", listingId)).data).toHaveLength(0);
    expect((await admin.storage.from("listing-media").list(listingId, { limit: 100 })).data).toHaveLength(0);
  });
});
