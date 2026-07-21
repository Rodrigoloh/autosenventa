import assert from "node:assert/strict";
import test from "node:test";
import { accessDecision, defaultPathForRole, resolveViewer, safeInternalPath } from "../src/lib/auth-policy";
import { credentialsSchema, emailSchema, registrationSchema, usernameSchema } from "../src/lib/auth-validation";
import { parsePublicEnv } from "../src/lib/env";
import { listingCompletion } from "../src/lib/listing-display";
import {
  assertSafeImageDimensions,
  detectImageMime,
  photoReorderRequestSchema,
  photoUploadRequestSchema,
} from "../src/lib/listing-photo-validation";
import { DELETABLE_LISTING_STATUSES, EDITABLE_LISTING_STATUSES, listingDraftSchema, provisionalTitle } from "../src/lib/listing-validation";
import { readinessItems, textMeetsMinimum, validReviewPrice } from "../src/lib/listing-review";

const user = { id: "11111111-1111-4111-8111-111111111111", role: "user" as const, display_name: null };
const staff = { ...user, role: "staff" as const };
const admin = { ...user, role: "admin" as const };

test("valida el entorno completo", () => {
  assert.equal(parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "key", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }).NEXT_PUBLIC_SITE_URL, "http://localhost:3000");
  assert.throws(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "bad" }));
});

test("valida credenciales y correo", () => {
  assert.equal(credentialsSchema.safeParse({ email: "owner@example.test", password: "12345678" }).success, true);
  assert.equal(credentialsSchema.safeParse({ email: "bad", password: "short" }).success, false);
  assert.equal(emailSchema.safeParse({ email: "owner@example.test" }).success, true);
});

test("valida username y confirmación de registro", () => {
  assert.equal(usernameSchema.parse(" Usuario_5 "), "usuario_5");
  for (const invalid of ["5usuario", "usuario_", "usuario__cinco", "con-punto.", "soporte", "áccento"]) {
    assert.equal(usernameSchema.safeParse(invalid).success, false);
  }
  assert.equal(registrationSchema.safeParse({ username: "usuario5", email: "u@example.test", password: "12345678", confirm_password: "12345678" }).success, true);
  assert.equal(registrationSchema.safeParse({ username: "usuario5", email: "u@example.test", password: "12345678", confirm_password: "87654321" }).success, false);
});

test("rechaza perfiles ausentes o roles inesperados", () => {
  assert.equal(resolveViewer(null), null);
  assert.equal(resolveViewer({ ...user, role: "superadmin" }), null);
  assert.deepEqual(resolveViewer(user), user);
});

test("resuelve guards user, staff y admin", () => {
  assert.equal(accessDecision(null), "login");
  assert.equal(accessDecision(user), "allowed");
  assert.equal(accessDecision(user, ["staff", "admin"]), "forbidden");
  assert.equal(accessDecision(staff, ["staff", "admin"]), "allowed");
  assert.equal(accessDecision(staff, ["admin"]), "forbidden");
  assert.equal(accessDecision(admin, ["admin"]), "allowed");
});

test("sólo admite redirecciones internas", () => {
  assert.equal(safeInternalPath("/cuenta?ok=1"), "/cuenta?ok=1");
  assert.equal(safeInternalPath("https://evil.example/path"), "/cuenta");
  assert.equal(safeInternalPath("//evil.example/path"), "/cuenta");
  assert.equal(safeInternalPath(null, "/login"), "/login");
  assert.equal(defaultPathForRole("user"), "/cuenta");
  assert.equal(defaultPathForRole("staff"), "/staff");
  assert.equal(defaultPathForRole("admin"), "/staff");
});

test("valida y normaliza únicamente campos del borrador", () => {
  const valid = listingDraftSchema.safeParse({
    category_id: "1", brand_id: "2", model_id: "3", variant: " Grand Touring ", year: "2016",
    city: "Guadalajara", state_region: "Jalisco", price_mxn: "420000", mileage_km: "55000",
    exterior_color: "Rojo", interior_color: "Negro", body_style: "Convertible", transmission: "Manual",
    drivetrain: "Trasera", fuel_type: "Gasolina", engine: "2.0 L", owner_description: "Descripción",
    ownership_history: "Dos dueños", maintenance_history: "Al día", modifications: "", known_issues: "",
    sale_reason: "Cambio de proyecto",
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.variant, "Grand Touring");
    assert.equal(valid.data.modifications, null);
    assert.equal("status" in valid.data, false);
    assert.equal("owner_id" in valid.data, false);
    assert.equal("editorial_description" in valid.data, false);
  }
});

test("rechaza importes, kilometraje y relaciones básicas inválidas", () => {
  const base = {
    category_id: "", brand_id: "", model_id: "", variant: "", year: "", city: "", state_region: "",
    price_mxn: "", mileage_km: "", exterior_color: "", interior_color: "", body_style: "", transmission: "",
    drivetrain: "", fuel_type: "", engine: "", owner_description: "", ownership_history: "",
    maintenance_history: "", modifications: "", known_issues: "", sale_reason: "",
  };
  assert.equal(listingDraftSchema.safeParse({ ...base, price_mxn: "-1" }).success, false);
  assert.equal(listingDraftSchema.safeParse({ ...base, mileage_km: "-1" }).success, false);
  assert.equal(listingDraftSchema.safeParse({ ...base, brand_id: "", model_id: "2" }).success, false);
  assert.equal(listingDraftSchema.safeParse({ ...base, transmission: "Telepática" }).success, false);
});

test("genera título tolerante y calcula avance", () => {
  assert.equal(provisionalTitle({ year: 2016, brand: "Mazda", model: "MX-5", variant: "Grand Touring" }), "2016 Mazda MX-5 Grand Touring");
  assert.equal(provisionalTitle({ brand: "Mazda" }), "Mazda");
  assert.equal(provisionalTitle({}), "Borrador sin identificar");
  assert.equal(listingCompletion({}), 0);
});

test("mantiene separados estados editables y eliminables", () => {
  assert.deepEqual(EDITABLE_LISTING_STATUSES, ["draft", "changes_requested"]);
  assert.deepEqual(DELETABLE_LISTING_STATUSES, ["draft"]);
});

test("mapea la checklist de revisión y conserva códigos estables", () => {
  const items = readinessItems(["invalid_price", "missing_public_username", "description_too_short", "invalid_price"]);
  assert.deepEqual(items.map((item) => item.code), ["invalid_price", "missing_public_username", "description_too_short", "missing_attestations"]);
  assert.equal(items.find((item) => item.code === "invalid_price")?.category, "Precio");
  assert.equal(items.find((item) => item.code === "missing_public_username")?.category, "Perfil");
});

test("valida mínimos de historia, precio y declaraciones para revisión", () => {
  assert.equal(textMeetsMinimum("x".repeat(120), 120), true);
  assert.equal(textMeetsMinimum(`  ${"x".repeat(119)}  `, 120), false);
  assert.equal(validReviewPrice(1), true);
  assert.equal(validReviewPrice("420000"), true);
  assert.equal(validReviewPrice(0), false);
  assert.equal(validReviewPrice(null), false);
});

test("valida nombre, extensión, MIME y tamaño de fotografías", () => {
  const valid = { listingId: user.id, originalName: "frente.JPEG", mimeType: "image/jpeg", sizeBytes: 1024, extension: "jpeg" };
  assert.equal(photoUploadRequestSchema.safeParse(valid).success, true);
  assert.equal(photoUploadRequestSchema.safeParse({ ...valid, mimeType: "image/png" }).success, false);
  assert.equal(photoUploadRequestSchema.safeParse({ ...valid, extension: "png" }).success, false);
  assert.equal(photoUploadRequestSchema.safeParse({ ...valid, sizeBytes: 10 * 1024 * 1024 + 1 }).success, false);
  assert.equal(photoUploadRequestSchema.safeParse({ ...valid, mimeType: "image/gif", extension: "gif" }).success, false);
});

test("detecta magic bytes permitidos y rechaza contenido falso", () => {
  assert.equal(detectImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(detectImageMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(detectImageMime(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), "image/webp");
  assert.equal(detectImageMime(new TextEncoder().encode("contenido arbitrario etiquetado como imagen")), null);
});

test("rechaza dimensiones inválidas o superiores a 25 megapíxeles", () => {
  assert.doesNotThrow(() => assertSafeImageDimensions(5000, 5000));
  assert.throws(() => assertSafeImageDimensions(5001, 5000));
  assert.throws(() => assertSafeImageDimensions(0, 100));
});

test("rechaza campos controlados que no pertenecen al payload de subida", () => {
  const base = { listingId: user.id, originalName: "frente.webp", mimeType: "image/webp", sizeBytes: 1024, extension: "webp" };
  assert.equal(photoUploadRequestSchema.safeParse({ ...base, storagePath: `${user.id}/fabricado.webp` }).success, false);
  assert.equal(photoUploadRequestSchema.safeParse({ ...base, owner_id: user.id }).success, false);
  assert.equal(photoUploadRequestSchema.safeParse({ ...base, sort_order: 0 }).success, false);
});

test("acepta sólo IDs mínimos y únicos para reordenar fotografías", () => {
  const second = "22222222-2222-4222-8222-222222222222";
  const valid = { listingId: user.id, mediaIds: [user.id, second] };
  assert.equal(photoReorderRequestSchema.safeParse(valid).success, true);
  assert.equal(photoReorderRequestSchema.safeParse({ ...valid, mediaIds: [user.id, user.id] }).success, false);
  assert.equal(photoReorderRequestSchema.safeParse({ ...valid, sortOrders: [0, 1] }).success, false);
  assert.equal(photoReorderRequestSchema.safeParse({ ...valid, storagePath: `${user.id}/inventada.jpg` }).success, false);
});
