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

const listingIdSchema = z.uuid();

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

  // La eliminación coordinada de objetos queda fuera de esta fase. Impedimos
  // borrar un draft con medios o reservas para no crear objetos huérfanos.
  const admin = createAdminClient();
  const [{ count: mediaCount }, { count: reservationCount }] = await Promise.all([
    admin.from("listing_media").select("id", { count: "exact", head: true }).eq("listing_id", listingId),
    admin.from("listing_photo_uploads").select("id", { count: "exact", head: true }).eq("listing_id", listingId),
  ]);
  if ((mediaCount ?? 0) > 0 || (reservationCount ?? 0) > 0) {
    return { status: "error", message: "Este borrador tiene fotografías o subidas pendientes y todavía no puede eliminarse." };
  }

  const { data: deleted, error } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("owner_id", viewer.id)
    .in("status", [...DELETABLE_LISTING_STATUSES])
    .select("id");

  if (error || deleted?.length !== 1) {
    return { status: "error", message: "No pudimos eliminar el borrador. Recarga e inténtalo de nuevo." };
  }

  revalidatePath("/cuenta");
  revalidatePath("/cuenta/anuncios");
  redirect("/cuenta/anuncios");
}
