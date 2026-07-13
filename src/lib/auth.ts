import { cache } from "react";
import { redirect } from "next/navigation";
import type { AppRole } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export const getViewer = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, display_name")
    .eq("id", data.claims.sub)
    .single();

  return profile as { id: string; role: AppRole; display_name: string | null } | null;
});

export async function requireUser() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

export async function requireRole(roles: AppRole[]) {
  const viewer = await requireUser();
  if (!roles.includes(viewer.role)) redirect("/cuenta");
  return viewer;
}

export function assertOwnsResource(ownerId: string, viewerId: string) {
  if (ownerId !== viewerId) throw new Error("No tienes permiso sobre este recurso.");
}
