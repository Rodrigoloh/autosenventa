import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ListingPhotoUploadCleanupResult =
  | { ok: true; message: string; listingId?: string }
  | { ok: false; message: string; listingId?: string };

export async function cleanupListingPhotoUpload(
  reservationId: string,
  viewerId: string,
): Promise<ListingPhotoUploadCleanupResult> {
  const admin = createAdminClient();
  const { data: reservation, error: reservationError } = await admin
    .from("listing_photo_uploads")
    .select("id,listing_id,requested_by,storage_path")
    .eq("id", reservationId)
    .eq("requested_by", viewerId)
    .maybeSingle();

  // Idempotent and deliberately indistinguishable from an already-cleaned reservation.
  if (reservationError) {
    return { ok: false, message: "No pudimos comprobar la reserva. Reintenta la limpieza." };
  }
  if (!reservation) {
    return { ok: true, message: "Subida cancelada." };
  }

  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("id")
    .eq("id", reservation.listing_id)
    .eq("owner_id", viewerId)
    .in("status", ["draft", "changes_requested"])
    .is("deletion_started_at", null)
    .maybeSingle();
  if (!listing) {
    return { ok: false, message: "Sólo puedes limpiar subidas de un anuncio propio editable." };
  }

  const { data: finalizedMedia, error: mediaError } = await supabase
    .from("listing_media")
    .select("id")
    .eq("listing_id", listing.id)
    .eq("storage_path", reservation.storage_path)
    .maybeSingle();
  if (mediaError) {
    return {
      ok: false,
      listingId: listing.id,
      message: "No pudimos comprobar si la subida ya finalizó. Reintenta la limpieza.",
    };
  }
  if (finalizedMedia) {
    return {
      ok: false,
      listingId: listing.id,
      message: "Una subida finalizada no se puede cancelar.",
    };
  }

  // The exact path comes only from the validated reservation, never from the browser.
  const removed = await admin.storage.from("listing-media").remove([reservation.storage_path]);
  if (removed.error) {
    return {
      ok: false,
      listingId: listing.id,
      message: "No pudimos limpiar el archivo privado. Reintenta la limpieza.",
    };
  }

  const cancelled = await supabase.rpc("cancel_listing_photo_upload", {
    target_reservation_id: reservation.id,
  });
  if (!cancelled.error && cancelled.data === true) {
    return { ok: true, listingId: listing.id, message: "Subida cancelada." };
  }

  const { data: remaining } = await admin
    .from("listing_photo_uploads")
    .select("id")
    .eq("id", reservation.id)
    .eq("requested_by", viewerId)
    .maybeSingle();
  if (!remaining) {
    return { ok: true, listingId: listing.id, message: "Subida cancelada." };
  }
  return {
    ok: false,
    listingId: listing.id,
    message: "El archivo fue limpiado, pero la reserva sigue pendiente. Reintenta la limpieza.",
  };
}
