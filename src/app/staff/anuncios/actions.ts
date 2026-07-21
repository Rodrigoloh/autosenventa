"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ClaimActionState = { status: "idle" | "success" | "error"; message?: string };

export async function claimListingForReviewAction(
  listingId: string,
  _previousState: ClaimActionState,
  _formData: FormData,
): Promise<ClaimActionState> {
  void _previousState;
  void _formData;
  await requireRole(["staff", "admin"]);
  if (!z.uuid().safeParse(listingId).success) return { status: "error", message: "El anuncio no es válido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_listing_for_review", { target_listing_id: listingId }).single();
  if (error || !data) return { status: "error", message: "No pudimos tomar la revisión." };
  const result = data as { success: boolean; conflict_code: string | null };
  if (!result.success) return { status: "error", message: "Otro miembro de staff tomó esta revisión." };
  revalidatePath("/staff");
  revalidatePath("/staff/anuncios");
  revalidatePath(`/staff/anuncios/${listingId}`);
  return { status: "success", message: "Revisión asignada a tu cuenta." };
}
