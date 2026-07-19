"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { photoUploadRequestSchema } from "@/lib/listing-photo-validation";
import { validateUploadedPhoto } from "@/lib/listing-photo-validation.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const reservationIdSchema = z.uuid();

export type ReservePhotoResult =
  | { ok: true; reservationId: string; storagePath: string; token: string }
  | { ok: false; message: string };

export type FinalizePhotoResult =
  | { ok: true; mediaId: string }
  | { ok: false; message: string };

export async function reservePhotoUploadAction(input: unknown): Promise<ReservePhotoResult> {
  const viewer = await requireUser();
  const parsed = photoUploadRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Los datos del archivo no son válidos." };
  }

  const supabase = await createClient();
  const { data: listing } = await supabase.from("listings")
    .select("id,status")
    .eq("id", parsed.data.listingId)
    .eq("owner_id", viewer.id)
    .maybeSingle();
  if (!listing || listing.status !== "draft") {
    return { ok: false, message: "Sólo puedes subir fotografías a un borrador propio." };
  }

  const { data, error } = await supabase.rpc("reserve_listing_photo_upload", {
    target_listing_id: parsed.data.listingId,
    target_mime_type: parsed.data.mimeType,
    target_size_bytes: parsed.data.sizeBytes,
    target_extension: parsed.data.extension,
  }).single();
  if (error || !data) {
    return { ok: false, message: error?.message.includes("limit")
      ? "El anuncio ya alcanzó el máximo de 20 fotografías o reservas activas."
      : "No pudimos reservar un espacio para esta fotografía." };
  }

  const reservation = data as { reservation_id: string; storage_path: string };
  const signed = await supabase.storage.from("listing-media")
    .createSignedUploadUrl(reservation.storage_path, { upsert: false });
  if (signed.error || !signed.data?.token) {
    await supabase.rpc("cancel_listing_photo_upload", { target_reservation_id: reservation.reservation_id });
    return { ok: false, message: "No pudimos preparar la subida privada." };
  }

  return {
    ok: true,
    reservationId: reservation.reservation_id,
    storagePath: reservation.storage_path,
    token: signed.data.token,
  };
}

export async function cancelPhotoUploadAction(reservationId: string) {
  const viewer = await requireUser();
  if (!reservationIdSchema.safeParse(reservationId).success) return;
  const admin = createAdminClient();
  const { data } = await admin.from("listing_photo_uploads")
    .select("id,requested_by,storage_path")
    .eq("id", reservationId)
    .eq("requested_by", viewer.id)
    .maybeSingle();
  if (!data) return;
  const removed = await admin.storage.from("listing-media").remove([data.storage_path]);
  if (!removed.error) {
    await admin.from("listing_photo_uploads").delete()
      .eq("id", data.id)
      .eq("requested_by", viewer.id);
  }
}

async function cleanupRejectedUpload(
  admin: ReturnType<typeof createAdminClient>,
  reservation: { id: string; requested_by: string; storage_path: string },
) {
  const removed = await admin.storage.from("listing-media").remove([reservation.storage_path]);
  if (removed.error) return false;
  const deleted = await admin.from("listing_photo_uploads").delete()
    .eq("id", reservation.id)
    .eq("requested_by", reservation.requested_by);
  return !deleted.error;
}

export async function finalizePhotoUploadAction(reservationId: string): Promise<FinalizePhotoResult> {
  const viewer = await requireUser();
  if (!reservationIdSchema.safeParse(reservationId).success) {
    return { ok: false, message: "La reserva de subida no es válida." };
  }

  const admin = createAdminClient();
  const { data: rawReservation, error: reservationError } = await admin
    .from("listing_photo_uploads")
    .select("id,listing_id,requested_by,storage_path,expected_mime_type,expected_size_bytes,expires_at")
    .eq("id", reservationId)
    .maybeSingle();
  const reservation = rawReservation as null | {
    id: string;
    listing_id: string;
    requested_by: string;
    storage_path: string;
    expected_mime_type: string;
    expected_size_bytes: number;
    expires_at: string;
  };
  if (reservationError || !reservation || reservation.requested_by !== viewer.id) {
    return { ok: false, message: "No encontramos una reserva propia disponible." };
  }

  const { data: listing } = await admin.from("listings")
    .select("id,owner_id,status")
    .eq("id", reservation.listing_id)
    .maybeSingle();
  if (!listing || listing.owner_id !== viewer.id || listing.status !== "draft") {
    await cleanupRejectedUpload(admin, reservation);
    return { ok: false, message: "El anuncio ya no admite fotografías." };
  }
  if (new Date(reservation.expires_at).getTime() <= Date.now()) {
    await cleanupRejectedUpload(admin, reservation);
    return { ok: false, message: "La reserva expiró; selecciona nuevamente el archivo." };
  }

  const downloaded = await admin.storage.from("listing-media").download(reservation.storage_path);
  if (downloaded.error || !downloaded.data) {
    await cleanupRejectedUpload(admin, reservation);
    return { ok: false, message: "No encontramos el archivo privado que debía validarse." };
  }

  let validated;
  try {
    if (downloaded.data.size !== reservation.expected_size_bytes) {
      throw new Error("El tamaño subido no coincide con la reserva.");
    }
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    validated = await validateUploadedPhoto(bytes, reservation.expected_mime_type);
  } catch (error) {
    const cleaned = await cleanupRejectedUpload(admin, reservation);
    return {
      ok: false,
      message: cleaned
        ? (error instanceof Error ? error.message : "La fotografía no superó la validación.")
        : "La fotografía fue rechazada, pero no pudimos completar su limpieza. Inténtalo de nuevo.",
    };
  }

  const finalized = await admin.rpc("finalize_listing_photo_upload", {
    target_reservation_id: reservation.id,
    target_requester_id: viewer.id,
    verified_mime_type: validated.mimeType,
    verified_size_bytes: validated.sizeBytes,
    verified_width: validated.width,
    verified_height: validated.height,
  }).single();

  if (finalized.error || !finalized.data) {
    const existing = await admin.from("listing_media")
      .select("id")
      .eq("storage_path", reservation.storage_path)
      .eq("uploaded_by", viewer.id)
      .maybeSingle();
    if (existing.data) {
      return { ok: true, mediaId: existing.data.id };
    }
    await cleanupRejectedUpload(admin, reservation);
    return { ok: false, message: "No pudimos finalizar la fotografía de forma segura." };
  }

  const media = finalized.data as { media_id: string };
  revalidatePath(`/cuenta/anuncios/${reservation.listing_id}/editar`);
  revalidatePath(`/cuenta/anuncios/${reservation.listing_id}/vista-previa`);
  return { ok: true, mediaId: media.media_id };
}
