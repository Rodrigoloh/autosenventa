import "server-only";

import { MAX_LISTING_PHOTOS } from "@/lib/listing-photo-validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PrivateListingPhoto = {
  id: string;
  signedUrl: string;
  width: number;
  height: number;
  sortOrder: number;
  isCover: boolean;
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
    .select("id,storage_path,width,height,sort_order,is_cover")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error("No pudimos consultar las fotografías privadas.");

  return Promise.all((media ?? []).map(async (item) => {
    const signed = await supabase.storage.from("listing-media")
      .createSignedUrl(item.storage_path, 300);
    if (signed.error || !signed.data?.signedUrl || !item.width || !item.height) {
      throw new Error("No pudimos firmar una fotografía privada.");
    }
    return {
      id: item.id,
      signedUrl: signed.data.signedUrl,
      width: item.width,
      height: item.height,
      sortOrder: item.sort_order,
      isCover: item.is_cover,
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
    .select("id,status")
    .eq("id", listingId)
    .eq("owner_id", viewerId)
    .maybeSingle();
  if (!listing || listing.status !== "draft") return 0;

  const admin = createAdminClient();
  const { count } = await admin.from("listing_photo_uploads")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId)
    .eq("requested_by", viewerId)
    .gt("expires_at", new Date().toISOString());
  return Math.max(0, MAX_LISTING_PHOTOS - finalizedCount - (count ?? 0));
}
