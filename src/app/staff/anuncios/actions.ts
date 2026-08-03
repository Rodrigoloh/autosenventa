"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseStaffListingView, STAFF_LISTING_VIEWS, staffListingViewHref } from "@/lib/staff-listing-views";

export type ClaimActionState = { status: "idle" | "success" | "error"; message?: string };
export type ReviewDecisionState = { status: "idle" | "success" | "error"; message?: string };
export type PublicationControlState = { status: "idle" | "success" | "error"; message?: string };
export type PublicationControlOperation = "pause" | "resume" | "return_to_review";

function revalidateStaffQueues() {
  revalidatePath("/staff");
  revalidatePath("/staff/anuncios");
  for (const view of STAFF_LISTING_VIEWS) revalidatePath(staffListingViewHref(view));
}

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
  revalidateStaffQueues();
  revalidatePath(`/staff/anuncios/${listingId}`);
  return { status: "success", message: "Revisión asignada a tu cuenta." };
}

export async function decideListingReviewAction(
  listingId: string,
  _previousState: ReviewDecisionState,
  formData: FormData,
): Promise<ReviewDecisionState> {
  await requireRole(["staff", "admin"]);
  if (!z.uuid().safeParse(listingId).success) return { status: "error", message: "El anuncio no es válido." };
  const decision = formData.get("decision")?.toString();
  if (!decision || !["approved", "changes_requested", "rejected"].includes(decision)) {
    return { status: "error", message: "La decisión no es válida." };
  }
  const message = formData.get("message")?.toString().trim() || null;
  const returnView = parseStaffListingView(formData.get("return_view")?.toString()) ?? "all";
  if (decision !== "approved" && (message?.length ?? 0) < 20) {
    return { status: "error", message: "Escribe un mensaje de al menos 20 caracteres." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_listing_review", {
    target_listing_id: listingId,
    target_decision: decision,
    target_message: message,
  }).single();
  if (error || !data) return { status: "error", message: "No pudimos registrar la decisión de forma segura." };
  const result = data as { success: boolean; conflict_code: string | null };
  if (!result.success) return { status: "error", message: result.conflict_code === "message_too_short" ? "Escribe un mensaje de al menos 20 caracteres." : result.conflict_code === "not_assigned" ? "Sólo el revisor asignado puede decidir." : "La revisión ya fue decidida por otra sesión." };
  const { data: owner } = await supabase.from("listings").select("owner:profiles!listings_owner_id_fkey(username)").eq("id", listingId).maybeSingle();
  revalidateStaffQueues(); revalidatePath(`/staff/anuncios/${listingId}`);
  revalidatePath("/cuenta"); revalidatePath("/cuenta/anuncios");
  revalidatePath(`/cuenta/anuncios/${listingId}/editar`);
  revalidatePath(`/cuenta/anuncios/${listingId}/vista-previa`);
  if (decision === "approved") {
    revalidatePath(`/autos/${listingId}`);
    const username = (owner?.owner as unknown as { username: string | null } | null)?.username;
    if (username) revalidatePath(`/u/${username}`);
  }
  redirect(`/staff/anuncios/${listingId}?result=${decision === "approved" ? "published" : decision}&from=${returnView}`);
}

export async function controlListingPublicationAction(
  listingId: string,
  operation: PublicationControlOperation,
  _previousState: PublicationControlState,
  formData: FormData,
): Promise<PublicationControlState> {
  await requireRole(["staff", "admin"]);
  if (!z.uuid().safeParse(listingId).success) return { status: "error", message: "El anuncio no es válido." };
  const returnView = parseStaffListingView(formData.get("return_view")?.toString()) ?? "all";
  const reason = formData.get("reason")?.toString().trim() ?? "";
  if (operation !== "resume" && (reason.length < 20 || reason.length > 2000)) {
    return { status: "error", message: "Escribe un motivo de 20 a 2000 caracteres." };
  }

  const supabase = await createClient();
  const { data: listing } = await supabase.from("listings")
    .select("owner:profiles!listings_owner_id_fkey(username)").eq("id", listingId).maybeSingle();
  const rpc = operation === "pause"
    ? supabase.rpc("pause_listing_publication", { target_listing_id: listingId, target_reason: reason })
    : operation === "resume"
      ? supabase.rpc("resume_listing_publication", { target_listing_id: listingId })
      : supabase.rpc("return_listing_to_review", { target_listing_id: listingId, target_reason: reason });
  const { data, error } = await rpc.single();
  if (error || !data) return { status: "error", message: "No pudimos actualizar la publicación de forma segura." };
  const result = data as { success: boolean; conflict_code: string | null };
  if (!result.success) return {
    status: "error",
    message: result.conflict_code === "reason_invalid"
      ? "Escribe un motivo de 20 a 2000 caracteres."
      : "El anuncio cambió de estado en otra sesión. Actualiza la página.",
  };

  revalidateStaffQueues();
  revalidatePath(`/staff/anuncios/${listingId}`);
  revalidatePath("/cuenta");
  revalidatePath("/cuenta/anuncios");
  revalidatePath(`/cuenta/anuncios/${listingId}/vista-previa`);
  revalidatePath(`/autos/${listingId}`);
  const username = (listing?.owner as unknown as { username: string | null } | null)?.username;
  if (username) revalidatePath(`/u/${username}`);
  const resultCode = operation === "pause" ? "paused" : operation === "resume" ? "resumed" : "returned_to_review";
  const destinationView = operation === "pause" ? "paused" : operation === "return_to_review" ? "mine" : returnView;
  redirect(`/staff/anuncios/${listingId}?result=${resultCode}&from=${destinationView}`);
}
