import "server-only";

import { MAX_LISTING_PHOTOS } from "@/lib/listing-photo-validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PrivateListingPhoto = {
  id: string;
  signedUrl: string | null;
  width: number;
  height: number;
  sortOrder: number;
  isCover: boolean;
  deletionPending: boolean;
};

export async function getPrivateListingPhotos(listingId: string, viewerId: string) {
  const supabase = await createClient();
  const { data: listing } = await supabase.from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("owner_id", viewerId)
    .maybeSingle();
  if (!listing) return null;

  const { data: media, error } = await supabase.from("listing_media")
    .select("id,storage_path,width,height,sort_order,is_cover,deletion_started_at")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error("No pudimos consultar las fotografías privadas.");

  return Promise.all((media ?? []).map(async (item) => {
    if (!item.width || !item.height) {
      throw new Error("Una fotografía privada no tiene dimensiones válidas.");
    }
    if (item.deletion_started_at) {
      return {
        id: item.id,
        signedUrl: null,
        width: item.width,
        height: item.height,
        sortOrder: item.sort_order,
        isCover: item.is_cover,
        deletionPending: true,
      } satisfies PrivateListingPhoto;
    }
    const signed = await supabase.storage.from("listing-media")
      .createSignedUrl(item.storage_path, 300);
    if (signed.error || !signed.data?.signedUrl) {
      throw new Error("No pudimos firmar una fotografía privada.");
    }
    return {
      id: item.id,
      signedUrl: signed.data.signedUrl,
      width: item.width,
      height: item.height,
      sortOrder: item.sort_order,
      isCover: item.is_cover,
      deletionPending: false,
    } satisfies PrivateListingPhoto;
  }));
}

export async function getPrivateListingPhotoAvailability(
  listingId: string,
  viewerId: string,
  finalizedCount: number,
) {
  const supabase = await createClient();
  const { data: listing } = await supabase.from("listings")
    .select("id,status,deletion_started_at")
    .eq("id", listingId)
    .eq("owner_id", viewerId)
    .maybeSingle();
  if (!listing || listing.status !== "draft" || listing.deletion_started_at) return 0;

  const admin = createAdminClient();
  const { count } = await admin.from("listing_photo_uploads")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId)
    .eq("requested_by", viewerId)
    .gt("expires_at", new Date().toISOString());
  return Math.max(0, MAX_LISTING_PHOTOS - finalizedCount - (count ?? 0));
}

export async function getStaffListingPhotos(listingId: string) {
  const supabase = await createClient();
  const { data: media, error } = await supabase.from("listing_media")
    .select("id,storage_path,width,height,sort_order,is_cover,deletion_started_at")
    .eq("listing_id", listingId).order("sort_order", { ascending: true });
  if (error) throw new Error("No pudimos consultar las fotografías para revisión.");
  return Promise.all((media ?? []).map(async (item) => {
    if (!item.width || !item.height) throw new Error("Una fotografía no tiene dimensiones válidas.");
    const signed = item.deletion_started_at ? null : await supabase.storage.from("listing-media").createSignedUrl(item.storage_path, 300);
    return {
      id: item.id,
      signedUrl: signed && !signed.error ? signed.data.signedUrl : null,
      width: item.width, height: item.height, sortOrder: item.sort_order,
      isCover: item.is_cover, deletionPending: Boolean(item.deletion_started_at),
    } satisfies PrivateListingPhoto;
  }));
}
