import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type PublicListingPhoto = {
  id: string;
  url: string | null;
  width: number;
  height: number;
  sortOrder: number;
  isCover: boolean;
};

export type PublicListingSummary = {
  id: string;
  title: string;
  year: number | null;
  variant: string | null;
  priceMxn: number | string | null;
  mileageKm: number | null;
  city: string | null;
  stateRegion: string | null;
  isFeatured: boolean;
  featuredOrder: number | null;
  publishedAt: string | null;
  brandName: string | null;
  modelName: string | null;
  photos: PublicListingPhoto[];
};

type MarketplaceRow = {
  id: string;
  title: string;
  year: number | null;
  variant: string | null;
  price_mxn: number | string | null;
  mileage_km: number | null;
  city: string | null;
  state_region: string | null;
  is_featured: boolean;
  featured_order: number | null;
  published_at: string | null;
  brands: { name: string } | null;
  models: { name: string } | null;
  listing_media: Array<{
    id: string;
    storage_path: string;
    width: number | null;
    height: number | null;
    sort_order: number;
    is_cover: boolean;
    deletion_started_at: string | null;
  }>;
};

const PUBLIC_SUMMARY_FIELDS = "id,title,year,variant,price_mxn,mileage_km,city,state_region,is_featured,featured_order,published_at,brands(name),models(name),listing_media(id,storage_path,width,height,sort_order,is_cover,deletion_started_at)";

export async function getPublishedListings() {
  // La colección pública existente no tiene todavía un RPC de listado. Esta lectura
  // queda confinada al servidor, selecciona sólo campos públicos y exige published.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("listings")
    .select(PUBLIC_SUMMARY_FIELDS)
    .eq("status", "published")
    .is("deletion_started_at", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(240);

  if (error) throw new Error("No pudimos cargar el catálogo público.");
  const rows = (data ?? []) as unknown as MarketplaceRow[];
  const paths = rows.flatMap((row) => row.listing_media)
    .filter((photo) => !photo.deletion_started_at && photo.width && photo.height)
    .map((photo) => photo.storage_path);
  const signedByPath = new Map<string, string>();

  if (paths.length) {
    const { data: signed } = await admin.storage.from("listing-media").createSignedUrls(paths, 900);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    year: row.year,
    variant: row.variant,
    priceMxn: row.price_mxn,
    mileageKm: row.mileage_km,
    city: row.city,
    stateRegion: row.state_region,
    isFeatured: row.is_featured,
    featuredOrder: row.featured_order,
    publishedAt: row.published_at,
    brandName: row.brands?.name ?? null,
    modelName: row.models?.name ?? null,
    photos: row.listing_media
      .filter((photo) => !photo.deletion_started_at && photo.width && photo.height)
      .sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order)
      .map((photo) => ({
        id: photo.id,
        url: signedByPath.get(photo.storage_path) ?? null,
        width: photo.width!,
        height: photo.height!,
        sortOrder: photo.sort_order,
        isCover: photo.is_cover,
      })),
  })) satisfies PublicListingSummary[];
}

export type MarketplaceFilters = {
  q: string;
  brand: string;
  model: string;
  order: "newest" | "price-asc" | "price-desc" | "mileage";
  page: number;
};

export function parseMarketplaceFilters(params: Record<string, string | string[] | undefined>): MarketplaceFilters {
  const one = (value: string | string[] | undefined) => typeof value === "string" ? value.trim().slice(0, 80) : "";
  const rawOrder = one(params.orden);
  const order = ["newest", "price-asc", "price-desc", "mileage"].includes(rawOrder)
    ? rawOrder as MarketplaceFilters["order"]
    : "newest";
  const rawPage = Number(one(params.pagina));
  return {
    q: one(params.q),
    brand: one(params.marca),
    model: one(params.modelo),
    order,
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

function searchableText(listing: PublicListingSummary) {
  return [listing.title, listing.year, listing.brandName, listing.modelName, listing.variant, listing.city, listing.stateRegion]
    .filter(Boolean).join(" ").toLocaleLowerCase("es-MX");
}

export function filterAndSortListings(listings: PublicListingSummary[], filters: MarketplaceFilters) {
  const q = filters.q.toLocaleLowerCase("es-MX");
  const brand = filters.brand.toLocaleLowerCase("es-MX");
  const model = filters.model.toLocaleLowerCase("es-MX");
  const filtered = listings.filter((listing) => (
    (!q || searchableText(listing).includes(q))
    && (!brand || listing.brandName?.toLocaleLowerCase("es-MX") === brand)
    && (!model || listing.modelName?.toLocaleLowerCase("es-MX") === model)
  ));
  return filtered.sort((a, b) => {
    if (filters.order === "price-asc") return Number(a.priceMxn ?? Number.MAX_SAFE_INTEGER) - Number(b.priceMxn ?? Number.MAX_SAFE_INTEGER);
    if (filters.order === "price-desc") return Number(b.priceMxn ?? -1) - Number(a.priceMxn ?? -1);
    if (filters.order === "mileage") return (a.mileageKm ?? Number.MAX_SAFE_INTEGER) - (b.mileageKm ?? Number.MAX_SAFE_INTEGER);
    return new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime();
  });
}

export function marketplaceHref(filters: MarketplaceFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.brand) params.set("marca", filters.brand);
  if (filters.model) params.set("modelo", filters.model);
  if (filters.order !== "newest") params.set("orden", filters.order);
  if (page > 1) params.set("pagina", String(page));
  const query = params.toString();
  return query ? `/autos?${query}` : "/autos";
}
