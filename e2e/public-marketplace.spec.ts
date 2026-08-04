import { expect, test } from "@playwright/test";
import { adminClient, createConfirmedUser, deleteUsers } from "./support";

test("marketplace público descubre únicamente publicaciones y conserva el flujo de venta", async ({ page }) => {
  test.setTimeout(600_000);
  const admin = adminClient();
  const owner = await createConfirmedUser(admin, "public-marketplace");
  const taxonomy = await admin.from("models")
    .select("id,name,brand_id,brands!inner(name)")
    .eq("active", true)
    .eq("brands.active", true)
    .limit(1)
    .single();
  expect(taxonomy.error).toBeNull();
  const model = taxonomy.data! as unknown as { id: number; name: string; brand_id: number; brands: { name: string } };
  const now = new Date().toISOString();
  const inserted = await admin.from("listings").insert([
    {
      owner_id: owner.id, status: "published", published_at: now, is_featured: true, featured_order: 1,
      year: 2024, brand_id: model.brand_id, model_id: model.id, variant: "Discovery Visible",
      price_mxn: 850000, mileage_km: 12000, city: "Monterrey", state_region: "Nuevo León", title: "ignorado",
    },
    {
      owner_id: owner.id, status: "published", published_at: new Date(Date.now() - 60_000).toISOString(), is_featured: false,
      year: 2022, brand_id: model.brand_id, model_id: model.id, variant: "Searchable Especial",
      price_mxn: 620000, mileage_km: 30000, city: "Guadalajara", state_region: "Jalisco", title: "ignorado",
    },
    {
      owner_id: owner.id, status: "paused", published_at: now, is_featured: false,
      year: 2023, brand_id: model.brand_id, model_id: model.id, variant: "Paused Invisible",
      price_mxn: 700000, mileage_km: 20000, city: "Puebla", state_region: "Puebla", title: "ignorado",
    },
  ]).select("id,status");
  expect(inserted.error).toBeNull();
  const published = inserted.data!.filter((item) => item.status === "published");
  const featured = published[0];
  const searchable = published[1];
  const paused = inserted.data!.find((item) => item.status === "paused")!;

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("link", { name: "driven-mx", exact: true })).toBeVisible();
    await expect(page.locator(`[data-listing-id="${featured.id}"]`).first()).toBeVisible();
    await expect(page.locator(`[data-listing-id="${searchable.id}"]`).first()).toBeVisible();
    await expect(page.locator(`[data-listing-id="${paused.id}"]`)).toHaveCount(0);
    await expect(page.getByText("Paused Invisible")).toHaveCount(0);
    const firstHomeCard = await page.locator("[data-listing-id]").first().boundingBox();
    expect(firstHomeCard?.y).toBeLessThan(780);

    await page.goto("/autos");
    await expect(page.locator(`[data-listing-id="${featured.id}"]`)).toHaveCount(1);
    await expect(page.locator(`[data-listing-id="${searchable.id}"]`)).toHaveCount(1);
    await expect(page.locator(`[data-listing-id="${paused.id}"]`)).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    const desktopColumns = await page.locator("[data-public-listing-grid]").first().evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length);
    expect(desktopColumns).toBeLessThanOrEqual(4);

    await page.getByLabel("Texto libre").fill("Searchable Especial");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(page).toHaveURL(/q=Searchable\+Especial/);
    await expect(page.locator(`[data-listing-id="${searchable.id}"]`)).toHaveCount(1);
    await expect(page.locator(`[data-listing-id="${featured.id}"]`)).toHaveCount(0);
    await page.locator(`[data-listing-id="${searchable.id}"] a`).click();
    await expect(page).toHaveURL(new RegExp(`/autos/${searchable.id}$`));

    await page.getByRole("link", { name: "Eventos" }).click();
    await expect(page).toHaveURL(/\/eventos$/);
    await expect(page.getByRole("heading", { name: "Eventos" })).toBeVisible();

    const sell = page.getByRole("link", { name: "Vende tu auto" });
    await expect(sell).toHaveAttribute("href", "/login?next=%2Fcuenta%2Fanuncios%2Fnuevo");
    await sell.click();
    await expect(page).toHaveURL(/\/login\?next=%2Fcuenta%2Fanuncios%2Fnuevo$/);
    await expect(page.locator('input[name="next"]')).toHaveValue("/cuenta/anuncios/nuevo");
    await page.getByLabel("Correo").fill(owner.email);
    await page.getByLabel("Contraseña").fill(owner.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/cuenta\/anuncios\/nuevo$/, { timeout: 60_000 });

    for (const path of ["/", "/autos", `/autos/${searchable.id}`, `/u/${owner.username}`, "/eventos"]) {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }
  } finally {
    await admin.from("listings").delete().in("id", inserted.data!.map((item) => item.id));
    await deleteUsers(admin, [owner.id]);
  }
});
