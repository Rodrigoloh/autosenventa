import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adminClient, anonymousClient, createConfirmedUser, deleteUsers, e2eEnv, setRolePrivileged } from "./support";

test.describe.configure({ mode: "serial" });

test.describe("Autorización real por Data API", () => {
  const admin = adminClient();
  const userIds: string[] = [];
  let listingId = "";

  test.afterAll(async () => {
    if (listingId) await admin.from("listings").delete().eq("id", listingId);
    await deleteUsers(admin, userIds.reverse());
  });

  test("RLS, campos reservados, RPC y publicación atraviesan PostgREST", async () => {
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
    expect((await anonymousClient().from("listings").select("id").eq("id", listingId)).data).toEqual([]);

    const forbiddenUpdates: Array<Record<string, unknown>> = [
      { status: "published" },
      { owner_id: userB.id },
      { is_featured: true },
      { featured_order: 1 },
      { editorial_description: "No permitido" },
      { published_at: new Date().toISOString() },
      { created_at: "2000-01-01T00:00:00Z" },
      { updated_at: "2000-01-01T00:00:00Z" },
    ];
    for (const values of forbiddenUpdates) {
      const result = await clientA.from("listings").update(values).eq("id", listingId).select();
      expect(result.error, JSON.stringify(values)).toBeTruthy();
    }

    const reservedRpc = await clientA.rpc("set_user_role", { target_user: userA.id, target_role: "admin" });
    expect(reservedRpc.error).toBeTruthy();

    expect((await clientA.rpc("transition_listing", { target_id: listingId, target_status: "submitted" })).error).toBeNull();
    expect((await staffClient.from("listings").select("id, status").eq("id", listingId).single()).data?.status).toBe("submitted");
    expect((await staffClient.rpc("transition_listing", { target_id: listingId, target_status: "published" })).error).toBeTruthy();
    expect((await staffClient.rpc("transition_listing", { target_id: listingId, target_status: "in_review" })).error).toBeNull();
    expect((await staffClient.rpc("transition_listing", { target_id: listingId, target_status: "approved" })).error).toBeNull();
    expect((await anonymousClient().from("listings").select("id").eq("id", listingId)).data).toEqual([]);
    expect((await staffClient.rpc("transition_listing", { target_id: listingId, target_status: "published" })).error).toBeNull();
    expect((await anonymousClient().from("listings").select("id").eq("id", listingId)).data).toEqual([{ id: listingId }]);
  });
});
