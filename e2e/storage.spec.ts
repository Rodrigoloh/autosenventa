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

  test("propietario carga/lee y RLS rechaza acceso ajeno, MIME y tamaño inválidos", async () => {
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
    storagePath = `${listingId}/${crypto.randomUUID()}.png`;
    const base64 = (await readFile(join(process.cwd(), "e2e", "fixtures", "pixel.png.base64"), "utf8")).trim();
    const image = Buffer.from(base64, "base64");

    expect((await ownerClient.storage.from("listing-media").upload(storagePath, image, { contentType: "image/png" })).error).toBeNull();
    expect((await ownerClient.from("listing_media").insert({ listing_id: listingId, storage_path: storagePath, media_type: "image" })).error).toBeNull();
    const ownerDownload = await ownerClient.storage.from("listing-media").download(storagePath);
    expect(ownerDownload.error).toBeNull();
    expect(Buffer.from(await ownerDownload.data!.arrayBuffer())).toEqual(image);

    expect((await otherClient.storage.from("listing-media").download(storagePath)).error).toBeTruthy();
    expect((await otherClient.storage.from("listing-media").upload(storagePath, image, { contentType: "image/png", upsert: true })).error).toBeTruthy();
    const foreignPath = `${listingId}/${crypto.randomUUID()}.png`;
    expect((await otherClient.storage.from("listing-media").upload(foreignPath, image, { contentType: "image/png" })).error).toBeTruthy();

    const invalidMimePath = `${listingId}/${crypto.randomUUID()}.jpg`;
    expect((await ownerClient.storage.from("listing-media").upload(invalidMimePath, Buffer.from("not an image"), { contentType: "text/plain" })).error).toBeTruthy();
    const oversizedPath = `${listingId}/${crypto.randomUUID()}.png`;
    const oversized = Buffer.alloc(50 * 1024 * 1024 + 1);
    expect((await ownerClient.storage.from("listing-media").upload(oversizedPath, oversized, { contentType: "image/png" })).error).toBeTruthy();
  });
});
