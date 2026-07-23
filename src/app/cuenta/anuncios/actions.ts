"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  DELETABLE_LISTING_STATUSES,
  EDITABLE_LISTING_STATUSES,
  listingDraftFromFormData,
  type ListingActionState,
} from "@/lib/listing-validation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ATTESTATION_VERSION } from "@/lib/listing-review";

const listingIdSchema = z.uuid();

export type SubmissionActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  readinessCodes?: string[];
};

export async function submitListingForReviewAction(
  listingId: string,
  _previousState: SubmissionActionState,
  formData: FormData,
): Promise<SubmissionActionState> {
  await requireUser();
  if (!listingIdSchema.safeParse(listingId).success) return { status: "error", message: "El anuncio no es válido." };
  const flags = {
    attest_owner_authorized: formData.get("attest_owner_authorized") === "yes",
    attest_information_truthful: formData.get("attest_information_truthful") === "yes",
    attest_modifications_and_issues_disclosed: formData.get("attest_modifications_and_issues_disclosed") === "yes",
    attest_legal_documentation: formData.get("attest_legal_documentation") === "yes",
  };
  const supabase = await createClient();
  const result = await supabase.rpc("submit_listing_for_review", {
    target_listing_id: listingId,
    ...flags,
    target_attestation_version: ATTESTATION_VERSION,
  }).single();
  if (result.error || !result.data) return { status: "error", message: "No pudimos enviar el anuncio de forma segura." };
  const response = result.data as { success: boolean; readiness_codes: string[] };
  if (!response.success) return { status: "error", message: "El anuncio todavía no está listo para revisión.", readinessCodes: response.readiness_codes };
  revalidatePath("/cuenta/anuncios");
  revalidatePath(`/cuenta/anuncios/${listingId}/editar`);
  revalidatePath(`/cuenta/anuncios/${listingId}/vista-previa`);
  revalidatePath("/staff");
  revalidatePath("/staff/anuncios");
  redirect(`/cuenta/anuncios/${listingId}/vista-previa`);
}

export async function createDraftAction(
  _previousState: ListingActionState,
  _formData: FormData,
): Promise<ListingActionState> {
  void _previousState;
  void _formData;
  const viewer = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .insert({ owner_id: viewer.id, title: "Borrador sin identificar" })
    .select("id")
    .single();

  if (error || !data) {
    return { status: "error", message: "No pudimos crear el borrador. Inténtalo de nuevo." };
  }

  revalidatePath("/cuenta");
  revalidatePath("/cuenta/anuncios");
  redirect(`/cuenta/anuncios/${data.id}/editar`);
}

export async function saveListingAction(
  listingId: string,
  _previousState: ListingActionState,
  formData: FormData,
): Promise<ListingActionState> {
  const viewer = await requireUser();
  if (!listingIdSchema.safeParse(listingId).success) {
    return { status: "error", message: "El identificador del anuncio no es válido." };
  }

  const parsed = listingDraftFromFormData(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los campos marcados antes de guardar.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("listings")
    .select("id, status")
    .eq("id", listingId)
    .eq("owner_id", viewer.id)
    .maybeSingle();

  if (!current) {
    return { status: "error", message: "No encontramos un anuncio propio con ese identificador." };
  }
  if (!EDITABLE_LISTING_STATUSES.includes(current.status as (typeof EDITABLE_LISTING_STATUSES)[number])) {
    return { status: "error", message: "Este anuncio ya no se puede editar en su estado actual." };
  }

  const fieldErrors: Record<string, string[]> = {};
  if (parsed.data.category_id !== null) {
    const { data } = await supabase.from("categories").select("id").eq("id", parsed.data.category_id).eq("active", true).maybeSingle();
    if (!data) fieldErrors.category_id = ["Selecciona una categoría activa."];
  }
  if (parsed.data.brand_id !== null) {
    const { data } = await supabase.from("brands").select("id").eq("id", parsed.data.brand_id).eq("active", true).maybeSingle();
    if (!data) fieldErrors.brand_id = ["Selecciona una marca activa."];
  }
  if (parsed.data.model_id !== null) {
    const { data } = await supabase.from("models").select("id").eq("id", parsed.data.model_id)
      .eq("brand_id", parsed.data.brand_id ?? -1).eq("active", true).maybeSingle();
    if (!data) fieldErrors.model_id = ["El modelo debe estar activo y pertenecer a la marca seleccionada."];
  }
  if (Object.keys(fieldErrors).length) {
    return { status: "error", message: "Revisa la categoría, marca y modelo.", fieldErrors };
  }

  const { data: updated, error } = await supabase
    .from("listings")
    .update(parsed.data)
    .eq("id", listingId)
    .eq("owner_id", viewer.id)
    .in("status", [...EDITABLE_LISTING_STATUSES])
    .select("id");

  if (error || updated?.length !== 1) {
    return { status: "error", message: "No pudimos guardar. El anuncio pudo cambiar de estado; recarga e inténtalo de nuevo." };
  }

  revalidatePath("/cuenta");
  revalidatePath("/cuenta/anuncios");
  revalidatePath(`/cuenta/anuncios/${listingId}/editar`);
  revalidatePath(`/cuenta/anuncios/${listingId}/vista-previa`);
  return { status: "success", message: "Borrador guardado correctamente." };
}

export async function deleteDraftAction(
  listingId: string,
  _previousState: ListingActionState,
  formData: FormData,
): Promise<ListingActionState> {
  const viewer = await requireUser();
  if (!listingIdSchema.safeParse(listingId).success) {
    return { status: "error", message: "El identificador del anuncio no es válido." };
  }
  if (formData.get("confirm_delete") !== "yes") {
    return { status: "error", message: "Confirma explícitamente que quieres eliminar este borrador." };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("listings")
    .select("id, status")
    .eq("id", listingId)
    .eq("owner_id", viewer.id)
    .maybeSingle();

  if (!current) {
    return { status: "error", message: "No encontramos un borrador propio con ese identificador." };
  }
  if (!DELETABLE_LISTING_STATUSES.includes(current.status as (typeof DELETABLE_LISTING_STATUSES)[number])) {
    return { status: "error", message: "Este anuncio ya no se puede eliminar desde borradores." };
  }

  const started = await supabase.rpc("begin_draft_deletion", { target_listing_id: listingId });
  if (started.error) {
    return { status: "error", message: "No pudimos bloquear el borrador para eliminarlo. Recarga e inténtalo de nuevo." };
  }

  // El prefijo se deriva exclusivamente del listing validado. Se vuelve a listar
  // desde offset cero porque cada lote eliminado cambia la página siguiente.
  const admin = createAdminClient();
  for (;;) {
    const listed = await admin.storage.from("listing-media").list(listingId, { limit: 1000, offset: 0 });
    if (listed.error) {
      return { status: "error", message: "El borrador quedó bloqueado, pero Storage no pudo listar sus archivos. Intenta eliminarlo nuevamente." };
    }
    const paths = (listed.data ?? []).map((item) => `${listingId}/${item.name}`);
    if (!paths.length) break;
    const removed = await admin.storage.from("listing-media").remove(paths);
    if (removed.error) {
      return { status: "error", message: "El borrador quedó bloqueado y algunos archivos no pudieron eliminarse. Reintenta para completar la limpieza." };
    }
  }

  const finalized = await admin.rpc("finalize_draft_deletion", {
    target_listing_id: listingId,
    target_requester_id: viewer.id,
  });
  if (finalized.error || finalized.data !== true) {
    return { status: "error", message: "Los archivos se limpiaron, pero falta cerrar el borrado en la base. Reintenta la eliminación." };
  }

  revalidatePath("/cuenta");
  revalidatePath("/cuenta/anuncios");
  redirect("/cuenta/anuncios");
}
