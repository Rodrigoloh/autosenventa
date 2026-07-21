import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adminClient, anonymousClient, createConfirmedUser, deleteUsers, e2eEnv, setRolePrivileged } from "./support";

test.describe.configure({ mode: "serial" });

test.describe("Autorización real por Data API", () => {
  const admin = adminClient();
  const userIds: string[] = [];
  const taxonomyCleanup: Array<{ table: "categories" | "brands"; id: number }> = [];
  let listingId = "";

  test.afterAll(async () => {
    if (listingId) await admin.from("listings").delete().eq("id", listingId);
    for (const item of taxonomyCleanup.reverse()) await admin.from(item.table).delete().eq("id", item.id);
    await deleteUsers(admin, userIds.reverse());
  });

  test("RLS, campos reservados y hardening de transiciones atraviesan PostgREST", async () => {
    const userA = await createConfirmedUser(admin, "owner-a");
    const userB = await createConfirmedUser(admin, "owner-b");
    const staff = await createConfirmedUser(admin, "staff");
    userIds.push(userA.id, userB.id, staff.id);
    await setRolePrivileged(staff.id, "staff");

    const clientA = createClient(e2eEnv.supabaseUrl, e2eEnv.publishableKey);
    const clientB = createClient(e2eEnv.supabaseUrl, e2eEnv.publishableKey);
    const staffClient = createClient(e2eEnv.supabaseUrl, e2eEnv.publishableKey);
    expect((await clientA.auth.signInWithPassword({ email: userA.email, password: userA.password })).error).toBeNull();
    expect((await clientB.auth.signInWithPassword({ email: userB.email, password: userB.password })).error).toBeNull();
    expect((await staffClient.auth.signInWithPassword({ email: staff.email, password: staff.password })).error).toBeNull();

    const created = await clientA.from("listings").insert({ owner_id: userA.id, title: "Draft HTTP E2E" }).select("id, status").single();
    expect(created.error).toBeNull();
    expect(created.data?.status).toBe("draft");
    listingId = created.data!.id;

    expect((await clientB.from("listings").select("id").eq("id", listingId)).data).toEqual([]);
    expect((await clientB.from("listings").update({ title: "Ajeno" }).eq("id", listingId).select()).data).toEqual([]);
    expect((await clientB.from("listings").delete().eq("id", listingId).select()).error).toBeTruthy();
    expect((await anonymousClient().from("listings").select("id").eq("id", listingId)).data).toEqual([]);

    const forbiddenUpdates: Array<Record<string, unknown>> = [
      { status: "published" },
      { owner_id: userB.id },
      { is_featured: true },
      { featured_order: 1 },
      { editorial_description: "No permitido" },
      { slug: "slug-controlado-por-usuario" },
      { listing_type: "clasificacion-editorial" },
      { published_at: new Date().toISOString() },
      { created_at: "2000-01-01T00:00:00Z" },
      { updated_at: "2000-01-01T00:00:00Z" },
    ];
    for (const values of forbiddenUpdates) {
      const result = await clientA.from("listings").update(values).eq("id", listingId).select();
      expect(result.error, JSON.stringify(values)).toBeTruthy();
    }

    const { data: mazda } = await clientA.from("brands").select("id").eq("slug", "mazda").single();
    const { data: ford } = await clientA.from("brands").select("id").eq("slug", "ford").single();
    const { data: mx5 } = await clientA.from("models").select("id").eq("brand_id", mazda!.id).eq("slug", "mx-5").single();
    const validDraft = await clientA.from("listings").update({
      brand_id: mazda!.id, model_id: mx5!.id, year: 2016, variant: "Grand Touring",
      price_mxn: 420000, mileage_km: 55000, owner_description: "Conservado por su propietario",
    }).eq("id", listingId).select("title, owner_id, status, price_mxn, mileage_km").single();
    expect(validDraft.error).toBeNull();
    expect(validDraft.data).toMatchObject({
      title: "2016 Mazda MX-5 Grand Touring", owner_id: userA.id, status: "draft", mileage_km: 55000,
    });
    expect((await clientA.from("listings").update({ brand_id: ford!.id, model_id: mx5!.id }).eq("id", listingId).select()).error).toBeTruthy();
    expect((await clientA.from("listings").update({ price_mxn: -1 }).eq("id", listingId).select()).error).toBeTruthy();
    expect((await clientA.from("listings").update({ mileage_km: -1 }).eq("id", listingId).select()).error).toBeTruthy();

    const inactiveCategory = await admin.from("categories").insert({
      name: `Inactiva ${crypto.randomUUID()}`, slug: `inactive-${crypto.randomUUID()}`, active: false,
    }).select("id").single();
    expect(inactiveCategory.error).toBeNull();
    taxonomyCleanup.push({ table: "categories", id: inactiveCategory.data!.id });
    expect((await clientA.from("listings").update({ category_id: inactiveCategory.data!.id }).eq("id", listingId).select()).error).toBeTruthy();

    const reservedRpc = await clientA.rpc("set_user_role", { target_user: userA.id, target_role: "admin" });
    expect(reservedRpc.error).toBeTruthy();

    expect((await clientA.rpc("transition_listing", { target_id: listingId, target_status: "submitted" })).error).toBeTruthy();
    expect((await staffClient.rpc("transition_listing", { target_id: listingId, target_status: "published" })).error).toBeTruthy();
    expect((await staffClient.rpc("transition_listing", { target_id: listingId, target_status: "in_review" })).error).toBeTruthy();
    expect((await staffClient.rpc("transition_listing", { target_id: listingId, target_status: "approved" })).error).toBeTruthy();
    expect((await anonymousClient().from("listings").select("id").eq("id", listingId)).data).toEqual([]);

    const disposable = await clientA.from("listings").insert({ owner_id: userA.id, title: "Draft para borrar" }).select("id").single();
    expect(disposable.error).toBeNull();
    const disposableId = disposable.data!.id;
    expect((await clientB.from("listings").delete().eq("id", disposableId).select()).error).toBeTruthy();
    expect((await clientA.from("listings").delete().eq("id", disposableId).select("id")).error).toBeTruthy();
    expect((await clientA.rpc("begin_draft_deletion", { target_listing_id: disposableId })).error).toBeNull();
    expect((await admin.rpc("finalize_draft_deletion", { target_listing_id: disposableId, target_requester_id: userA.id })).error).toBeNull();
  });
});
