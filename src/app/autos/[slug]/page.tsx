import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ListingPhotoGallery } from "@/components/listing-photo-gallery";
import { ListingComments, type PublicComment } from "@/components/listing-comments";
import { RichListingSections, type RichListingData } from "@/components/rich-listing-sections";
import { getViewer } from "@/lib/auth";
import { formatMxn } from "@/lib/listing-display";
import { getPublicListingPhotos } from "@/lib/listing-media";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PublicListing = {
  id: string; title: string; year: number | null; variant: string | null; price_mxn: number | string | null;
  mileage_km: number | null; city: string | null; state_region: string | null; exterior_color: string | null;
  interior_color: string | null; body_style: string | null; transmission: string | null; drivetrain: string | null;
  fuel_type: string | null; engine: string | null; owner_description: string | null; ownership_history: string | null;
  maintenance_history: string | null; modifications: string | null; known_issues: string | null; sale_reason: string | null;
  brand_name: string | null; model_name: string | null; owner_username: string;
};

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-4 border-b public-rule py-2.5"><dt className="text-xs text-zinc-500">{label}</dt><dd className="text-right text-xs font-medium text-zinc-300">{value || "—"}</dd></div>;
}

function Story({ title, body }: { title: string; body: string | null }) {
  return <section className="border-t public-rule py-7"><h2 className="text-sm font-bold tracking-tight text-zinc-100">{title}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-500">{body || "Sin información."}</p></section>;
}

export default async function AutoPage({ params }: { params: Promise<{ slug: string }> }) {
  const id = (await params).slug;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_listing", { target_listing_id: id }).maybeSingle();
  if (!data) notFound();
  const listing = data as PublicListing;
  const [photos, viewer, richResult, commentsResult] = await Promise.all([getPublicListingPhotos(id), getViewer(), supabase.rpc("get_public_listing_rich", { target_listing_id: id }), supabase.rpc("get_public_listing_comments", { target_listing_id: id })]);
  if (!photos) notFound();
  const vehicleName = [listing.year, listing.brand_name, listing.model_name].filter(Boolean).join(" ") || listing.title;
  const hasHistory = Boolean(listing.owner_description || listing.ownership_history);
  return <main className="public-shell min-w-0 flex-1 pb-16"><article className="mx-auto w-full max-w-7xl px-0 sm:px-5 lg:px-8">
    {viewer && ["staff", "admin"].includes(viewer.role) ? <aside className="mx-5 mb-5 flex flex-wrap items-center justify-between gap-3 border public-rule public-raised px-4 py-3 text-xs sm:mx-0" aria-label="Navegación staff"><span className="font-semibold text-zinc-400">Vista pública</span><Link href={`/staff/anuncios/${listing.id}`} className="font-bold text-zinc-100 underline underline-offset-4 hover:text-orange-400">Abrir en staff</Link></aside> : null}
    <ListingPhotoGallery photos={photos} showCapacity={false} variant="public" overlay={<>
      <div className="max-w-[42rem]">
        <p className="editorial-kicker !text-orange-500">{[listing.brand_name, listing.model_name].filter(Boolean).join(" · ")}</p>
        <h1 className="mt-3 text-[clamp(2.25rem,6vw,5.5rem)] font-bold leading-[.92] tracking-[-0.055em] text-white">{vehicleName}</h1>
        {listing.variant ? <p className="mt-2 text-base font-semibold text-zinc-200 sm:text-xl">{listing.variant}</p> : null}
        <p className="mt-6 text-2xl font-medium tracking-tight text-white sm:text-4xl">{formatMxn(listing.price_mxn)}</p>
        <div className="mt-5 h-px w-12 bg-[var(--driven-green)]" />
        <p className="mt-4 text-xs text-zinc-400">Publicado por <Link href={`/u/${listing.owner_username}`} className="font-semibold text-[var(--driven-green)] hover:text-white">@{listing.owner_username}</Link></p>
      </div>
    </>} />
    <div className={`mx-3 grid border-x border-b public-rule bg-black/20 sm:mx-4 ${hasHistory ? "lg:grid-cols-[1.05fr_1fr_1.15fr]" : "lg:grid-cols-2"}`}>
      {hasHistory ? <section className="public-rule p-6 lg:border-r"><p className="editorial-kicker">Historia</p>{listing.owner_description ? <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{listing.owner_description}</p> : null}{listing.ownership_history ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-500">{listing.ownership_history}</p> : null}</section> : null}
      <section className="border-t public-rule p-6 lg:border-r lg:border-t-0"><p className="editorial-kicker">Detalles</p><dl className="mt-3"><Detail label="Año" value={listing.year} /><Detail label="Kilometraje" value={listing.mileage_km === null ? null : `${new Intl.NumberFormat("es-MX").format(listing.mileage_km)} km`} /><Detail label="Transmisión" value={listing.transmission} /><Detail label="Combustible" value={listing.fuel_type} /><Detail label="Ubicación" value={[listing.city, listing.state_region].filter(Boolean).join(", ")} /></dl></section>
      <section className="border-t public-rule p-6 lg:border-t-0"><p className="editorial-kicker">Especificaciones</p><dl className="mt-3"><Detail label="Tracción" value={listing.drivetrain} /><Detail label="Motor" value={listing.engine} /><Detail label="Carrocería" value={listing.body_style} /><Detail label="Exterior" value={listing.exterior_color} /><Detail label="Interior" value={listing.interior_color} /></dl><Link href={`/u/${listing.owner_username}`} className="mt-5 flex min-h-11 items-center justify-between rounded-sm border border-[color-mix(in_srgb,var(--driven-green)_45%,transparent)] bg-[color-mix(in_srgb,var(--driven-green)_14%,transparent)] px-4 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-200 transition hover:bg-[color-mix(in_srgb,var(--driven-green)_25%,transparent)]">Contactar al vendedor <span aria-hidden="true">→</span></Link></section>
    </div>
    <div className="px-5 sm:px-4"><RichListingSections rich={(richResult.data ?? { ownership:null,documentation:null,equipment:[],modifications:[],flaws:[],serviceRecords:[],includedItems:[],videos:[] }) as RichListingData} mileageKm={listing.mileage_km} transmission={listing.transmission} /></div>
    <div className="grid gap-x-10 px-5 sm:px-4 lg:grid-cols-2">{listing.maintenance_history ? <Story title="Mantenimiento" body={listing.maintenance_history} /> : null}{listing.modifications ? <Story title="Modificaciones" body={listing.modifications} /> : null}{listing.known_issues ? <Story title="Problemas conocidos" body={listing.known_issues} /> : null}{listing.sale_reason ? <Story title="Seller notes" body={listing.sale_reason} /> : null}</div>
    <div className="px-5 sm:px-4"><ListingComments listingId={id} comments={(commentsResult.data ?? []) as PublicComment[]} viewerId={viewer?.id ?? null} /></div>
  </article></main>;
}
