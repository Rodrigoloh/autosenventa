import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adminClient, anonymousClient, createConfirmedUser, deleteUsers, e2eEnv } from "./support";

test.describe.configure({ mode: "serial" });

test.describe("Storage binario real", () => {
  const admin = adminClient();
  const userIds: string[] = [];
  let listingId = "";
  const storagePaths: string[] = [];

  test.afterAll(async () => {
    if (storagePaths.length) await admin.storage.from("listing-media").remove(storagePaths);
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
    const reserved = reservation.data as { reservation_id: string; storage_path: string };
    const storagePath = reserved.storage_path;
    storagePaths.push(storagePath);
    expect(storagePath).toMatch(new RegExp(`^${listingId}/[0-9a-f-]{36}\\.png$`));

    const signedUpload = await ownerClient.storage.from("listing-media").createSignedUploadUrl(storagePath, { upsert: false });
    expect(signedUpload.error).toBeNull();
    const alteredPath = `${listingId}/${crypto.randomUUID()}.png`;
    expect((await ownerClient.storage.from("listing-media").uploadToSignedUrl(
      alteredPath, signedUpload.data!.token, image, { contentType: "image/png" },
    )).error).toBeTruthy();
    expect((await ownerClient.storage.from("listing-media").uploadToSignedUrl(
      storagePath, signedUpload.data!.token, image, { contentType: "image/png" },
    )).error).toBeNull();
    expect((await ownerClient.from("listing_media").insert({
      listing_id: listingId, storage_path: storagePath, media_type: "image",
      mime_type: "image/png", file_size_bytes: image.length, width: 1, height: 1,
    })).error).toBeTruthy();
    const finalized = await admin.rpc("finalize_listing_photo_upload", {
      target_reservation_id: reserved.reservation_id,
      target_requester_id: owner.id,
      verified_mime_type: "image/png",
      verified_size_bytes: image.length,
      verified_width: 1,
      verified_height: 1,
    }).single();
    expect(finalized.error).toBeNull();
    expect(finalized.data).toMatchObject({ finalized_sort_order: 0, finalized_is_cover: true });

    const ownerDownload = await ownerClient.storage.from("listing-media").download(storagePath);
    expect(ownerDownload.error).toBeNull();
    expect(Buffer.from(await ownerDownload.data!.arrayBuffer())).toEqual(image);
    const signedRead = await ownerClient.storage.from("listing-media").createSignedUrl(storagePath, 60);
    expect(signedRead.error).toBeNull();
    expect((await fetch(signedRead.data!.signedUrl)).ok).toBe(true);

    expect((await otherClient.storage.from("listing-media").download(storagePath)).error).toBeTruthy();
    expect((await anonymousClient().storage.from("listing-media").download(storagePath)).error).toBeTruthy();
    expect((await otherClient.storage.from("listing-media").createSignedUrl(storagePath, 60)).error).toBeTruthy();
    expect((await otherClient.rpc("finalize_listing_photo_upload", {
      target_reservation_id: reserved.reservation_id,
      target_requester_id: other.id,
      verified_mime_type: "image/png",
      verified_size_bytes: image.length,
      verified_width: 1,
      verified_height: 1,
    })).error).toBeTruthy();
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

    const concurrentReservations = await Promise.all([1, 2].map(async () => {
      const result = await ownerClient.rpc("reserve_listing_photo_upload", {
        target_listing_id: listingId,
        target_mime_type: "image/png",
        target_size_bytes: image.length,
        target_extension: "png",
      }).single();
      expect(result.error).toBeNull();
      const item = result.data as { reservation_id: string; storage_path: string };
      storagePaths.push(item.storage_path);
      const signed = await ownerClient.storage.from("listing-media").createSignedUploadUrl(item.storage_path);
      expect(signed.error).toBeNull();
      expect((await ownerClient.storage.from("listing-media").uploadToSignedUrl(
        item.storage_path, signed.data!.token, image, { contentType: "image/png" },
      )).error).toBeNull();
      return item;
    }));
    const concurrentFinalizations = await Promise.all(concurrentReservations.map((item) => admin.rpc(
      "finalize_listing_photo_upload",
      {
        target_reservation_id: item.reservation_id,
        target_requester_id: owner.id,
        verified_mime_type: "image/png",
        verified_size_bytes: image.length,
        verified_width: 1,
        verified_height: 1,
      },
    ).single()));
    expect(concurrentFinalizations.every((result) => !result.error)).toBe(true);
    const ordered = await admin.from("listing_media").select("id,storage_path,sort_order,is_cover").eq("listing_id", listingId).order("sort_order");
    expect(ordered.data?.map((item) => item.sort_order)).toEqual([0, 1, 2]);
    expect(ordered.data?.filter((item) => item.is_cover)).toHaveLength(1);

    const media = ordered.data!;
    expect((await ownerClient.rpc("set_listing_photo_cover", { target_media_id: media[2].id })).error).toBeNull();
    expect((await ownerClient.rpc("reorder_listing_photos", {
      target_listing_id: listingId,
      target_media_ids: media.map((item) => item.id).reverse(),
    })).error).toBeNull();
    expect((await otherClient.rpc("set_listing_photo_cover", { target_media_id: media[0].id })).error).toBeTruthy();
    // Storage devuelve 200 aunque RLS convierta el DELETE en no-op; verificamos el objeto.
    expect((await ownerClient.storage.from("listing-media").remove([media[0].storage_path])).error).toBeNull();
    expect((await admin.storage.from("listing-media").list(listingId, { search: media[0].storage_path.split("/")[1] })).data).toHaveLength(1);

    const preparedDelete = await ownerClient.rpc("prepare_listing_photo_deletion", { target_media_id: media[0].id }).single();
    expect(preparedDelete.error).toBeNull();
    expect((await admin.storage.from("listing-media").remove([media[0].storage_path])).error).toBeNull();
    expect((await admin.rpc("finalize_listing_photo_deletion", {
      target_media_id: media[0].id,
      target_requester_id: owner.id,
    })).error).toBeNull();
    const compacted = await admin.from("listing_media").select("sort_order,is_cover").eq("listing_id", listingId).order("sort_order");
    expect(compacted.data?.map((item) => item.sort_order)).toEqual([0, 1]);
    expect(compacted.data?.filter((item) => item.is_cover)).toHaveLength(1);

    expect((await ownerClient.rpc("begin_draft_deletion", { target_listing_id: listingId })).error).toBeNull();
    expect((await ownerClient.rpc("reserve_listing_photo_upload", {
      target_listing_id: listingId,
      target_mime_type: "image/png",
      target_size_bytes: image.length,
      target_extension: "png",
    })).error).toBeTruthy();
  });
});
