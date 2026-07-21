import { cache } from "react";
import { redirect } from "next/navigation";
import type { AppRole } from "@/lib/constants";
import { hasRequiredRole, resolveViewer } from "@/lib/auth-policy";
import { createClient } from "@/lib/supabase/server";

export const getViewer = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, display_name, username")
    .eq("id", data.user.id)
    .single();

  return resolveViewer(profile ? { ...profile, email: data.user.email ?? null } : null);
});

export async function requireUser() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

export async function requireRole(roles: AppRole[]) {
  const viewer = await requireUser();
  if (!hasRequiredRole(viewer, roles)) redirect("/cuenta");
  return viewer;
}

export function assertOwnsResource(ownerId: string, viewerId: string) {
  if (ownerId !== viewerId) throw new Error("No tienes permiso sobre este recurso.");
}
