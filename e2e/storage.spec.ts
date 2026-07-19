import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adminClient, createConfirmedUser, deleteUsers, e2eEnv } from "./support";

test.describe.configure({ mode: "serial" });

test.describe("Storage binario real", () => {
  const admin = adminClient();
  const userIds: string[] = [];
  let listingId = "";
  let storagePath = "";

  test.afterAll(async () => {
    if (storagePath) await admin.storage.from("listing-media").remove([storagePath]);
    if (listingId) await admin.from("listings").delete().eq("id", listingId);
    await deleteUsers(admin, userIds.reverse());
  });

  test("reserva path de fotografía y RLS bloquea DML, paths ajenos, MIME y tamaño inválidos", async () => {
    test.setTimeout(150_000);
    const owner = await createConfirmedUser(admin, "storage-owner");
    const other = await createConfirmedUser(admin, "storage-other");
    userIds.push(owner.id, other.id);

    const ownerClient = createClient(e2eEnv.supabaseUrl, e2eEnv.publishableKey);
    const otherClient = createClient(e2eEnv.supabaseUrl, e2eEnv.publishableKey);
    expect((await ownerClient.auth.signInWithPassword({ email: owner.email, password: owner.password })).error).toBeNull();
    expect((await otherClient.auth.signInWithPassword({ email: other.email, password: other.password })).error).toBeNull();

    const listing = await ownerClient.from("listings").insert({ owner_id: owner.id, title: "Storage HTTP E2E" }).select("id").single();
    expect(listing.error).toBeNull();
    listingId = listing.data!.id;
    const base64 = (await readFile(join(process.cwd(), "e2e", "fixtures", "pixel.png.base64"), "utf8")).trim();
    const image = Buffer.from(base64, "base64");

    const reservation = await ownerClient.rpc("reserve_listing_photo_upload", {
      target_listing_id: listingId,
      target_mime_type: "image/png",
      target_size_bytes: image.length,
      target_extension: "png",
    }).single();
    expect(reservation.error).toBeNull();
    storagePath = (reservation.data as { storage_path: string }).storage_path;
    expect(storagePath).toMatch(new RegExp(`^${listingId}/[0-9a-f-]{36}\\.png$`));

    expect((await ownerClient.storage.from("listing-media").upload(storagePath, image, { contentType: "image/png" })).error).toBeNull();
    expect((await ownerClient.from("listing_media").insert({
      listing_id: listingId, storage_path: storagePath, media_type: "image",
      mime_type: "image/png", file_size_bytes: image.length, width: 1, height: 1,
    })).error).toBeTruthy();
    expect((await ownerClient.storage.from("listing-media").download(storagePath)).error).toBeTruthy();

    expect((await otherClient.storage.from("listing-media").download(storagePath)).error).toBeTruthy();
    expect((await otherClient.storage.from("listing-media").upload(storagePath, image, { contentType: "image/png", upsert: true })).error).toBeTruthy();
    const foreignPath = `${listingId}/${crypto.randomUUID()}.png`;
    expect((await otherClient.storage.from("listing-media").upload(foreignPath, image, { contentType: "image/png" })).error).toBeTruthy();

    expect((await ownerClient.rpc("reserve_listing_photo_upload", {
      target_listing_id: listingId,
      target_mime_type: "text/plain",
      target_size_bytes: 10,
      target_extension: "jpg",
    })).error).toBeTruthy();
    expect((await ownerClient.rpc("reserve_listing_photo_upload", {
      target_listing_id: listingId,
      target_mime_type: "image/png",
      target_size_bytes: 10 * 1024 * 1024 + 1,
      target_extension: "png",
    })).error).toBeTruthy();
  });
});
