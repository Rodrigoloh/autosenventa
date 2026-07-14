"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  EDITABLE_LISTING_STATUSES,
  listingDraftFromFormData,
  type ListingActionState,
} from "@/lib/listing-validation";
import { createClient } from "@/lib/supabase/server";

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
  if (!EDITABLE_LISTING_STATUSES.includes(current.status)) {
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
