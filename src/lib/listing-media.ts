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

export type PendingListingPhotoUpload = {
  id: string;
  expectedMimeType: string;
  expectedSizeBytes: number;
  expiresAt: string;
  createdAt: string;
  expired: boolean;
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
  if (!listing || !["draft", "changes_requested"].includes(listing.status) || listing.deletion_started_at) return 0;

  const admin = createAdminClient();
  const { count } = await admin.from("listing_photo_uploads")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId)
    .eq("requested_by", viewerId)
    .gt("expires_at", new Date().toISOString());
  return Math.max(0, MAX_LISTING_PHOTOS - finalizedCount - (count ?? 0));
}

export async function getPendingListingPhotoUploads(listingId: string, viewerId: string) {
  const supabase = await createClient();
  const { data: listing } = await supabase.from("listings").select("id,status,deletion_started_at")
    .eq("id", listingId).eq("owner_id", viewerId).maybeSingle();
  if (!listing || !["draft", "changes_requested"].includes(listing.status) || listing.deletion_started_at) return [];
  const admin = createAdminClient();
  const { data, error } = await admin.from("listing_photo_uploads")
    .select("id,expected_mime_type,expected_size_bytes,expires_at,created_at")
    .eq("listing_id", listingId).eq("requested_by", viewerId).order("created_at");
  if (error) throw new Error("No pudimos consultar las subidas pendientes.");
  return (data ?? []).map((item) => ({
    id: item.id,
    expectedMimeType: item.expected_mime_type,
    expectedSizeBytes: item.expected_size_bytes,
    expiresAt: item.expires_at,
    createdAt: item.created_at,
    expired: new Date(item.expires_at).getTime() <= Date.now(),
  })) satisfies PendingListingPhotoUpload[];
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

export async function getPublicListingPhotos(listingId: string) {
  const admin = createAdminClient();
  const { data: listing } = await admin.from("listings")
    .select("id,status").eq("id", listingId).eq("status", "published").maybeSingle();
  if (!listing) return null;
  const { data: media, error } = await admin.from("listing_media")
    .select("id,storage_path,width,height,sort_order,is_cover,deletion_started_at")
    .eq("listing_id", listingId).is("deletion_started_at", null).order("sort_order");
  if (error) throw new Error("No pudimos consultar las fotografías públicas.");
  return Promise.all((media ?? []).map(async (item) => {
    if (!item.width || !item.height) throw new Error("Una fotografía pública no tiene dimensiones válidas.");
    const signed = await admin.storage.from("listing-media").createSignedUrl(item.storage_path, 600);
    return {
      id: item.id,
      signedUrl: signed.error ? null : signed.data.signedUrl,
      width: item.width,
      height: item.height,
      sortOrder: item.sort_order,
      isCover: item.is_cover,
      deletionPending: false,
    } satisfies PrivateListingPhoto;
  }));
}
