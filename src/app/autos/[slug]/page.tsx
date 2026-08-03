import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ListingPhotoGallery } from "@/components/listing-photo-gallery";
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
  return <div className="border-t public-rule py-4"><dt className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</dt><dd className="mt-1.5 text-sm font-semibold text-zinc-200">{value || "Sin especificar"}</dd></div>;
}

function Story({ title, body }: { title: string; body: string | null }) {
  return <section className="border-t public-rule py-8"><h2 className="text-lg font-bold tracking-tight text-zinc-100">{title}</h2><p className="mt-4 max-w-3xl whitespace-pre-wrap text-[15px] leading-7 text-zinc-400">{body || "Sin información."}</p></section>;
}

export default async function AutoPage({ params }: { params: Promise<{ slug: string }> }) {
  const id = (await params).slug;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_listing", { target_listing_id: id }).maybeSingle();
  if (!data) notFound();
  const listing = data as PublicListing;
  const [photos, viewer] = await Promise.all([getPublicListingPhotos(id), getViewer()]);
  if (!photos) notFound();
  const vehicleName = [listing.year, listing.brand_name, listing.model_name].filter(Boolean).join(" ") || listing.title;
  return <main className="public-shell min-w-0 flex-1 py-6 sm:py-8"><article className="mx-auto w-full max-w-[90rem] px-0 sm:px-5 lg:px-8">
    {viewer && ["staff", "admin"].includes(viewer.role) ? <aside className="mx-5 mb-5 flex flex-wrap items-center justify-between gap-3 border public-rule public-raised px-4 py-3 text-xs sm:mx-0" aria-label="Navegación staff"><span className="font-semibold text-zinc-400">Vista pública</span><Link href={`/staff/anuncios/${listing.id}`} className="font-bold text-zinc-100 underline underline-offset-4 hover:text-orange-400">Abrir en staff</Link></aside> : null}
    <ListingPhotoGallery photos={photos} showCapacity={false} variant="public" overlay={<>
      <p className="editorial-kicker">{[listing.brand_name, listing.model_name].filter(Boolean).join(" · ")}</p>
      <h1 className="mt-2 max-w-4xl text-2xl font-bold tracking-[-0.035em] text-white sm:text-4xl">{vehicleName}</h1>
      {listing.variant ? <p className="mt-1 text-sm text-zinc-300 sm:text-base">{listing.variant}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/25 pt-4 text-xs text-zinc-300 sm:text-sm"><strong className="text-xl text-white sm:text-2xl">{formatMxn(listing.price_mxn)}</strong><span>{listing.mileage_km === null ? "Kilometraje no indicado" : `${new Intl.NumberFormat("es-MX").format(listing.mileage_km)} km`}</span><span>{[listing.city, listing.state_region].filter(Boolean).join(", ")}</span></div>
    </>} />
    <div className="grid gap-10 px-5 pb-16 pt-12 sm:px-0 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-20 lg:pt-16">
      <div>
        <div className="mb-10 flex flex-wrap items-baseline justify-between gap-3 border-b public-rule pb-6"><div><p className="editorial-kicker !text-orange-500">Historia del auto</p><p className="mt-2 text-sm text-zinc-500">Presentado por <Link href={`/u/${listing.owner_username}`} className="font-bold text-zinc-200 underline underline-offset-4 hover:text-orange-400">@{listing.owner_username}</Link></p></div></div>
        <Story title="Descripción" body={listing.owner_description} /><Story title="Historia de propiedad" body={listing.ownership_history} /><Story title="Mantenimiento" body={listing.maintenance_history} /><Story title="Modificaciones" body={listing.modifications} /><Story title="Problemas conocidos" body={listing.known_issues} /><Story title="Motivo de venta" body={listing.sale_reason} />
      </div>
      <aside><p className="editorial-kicker">Especificaciones</p><dl className="mt-5 grid grid-cols-2 gap-x-5 lg:grid-cols-1">
        <Detail label="Marca" value={listing.brand_name} /><Detail label="Modelo" value={listing.model_name} /><Detail label="Versión" value={listing.variant} /><Detail label="Año" value={listing.year} />
        <Detail label="Kilometraje" value={listing.mileage_km === null ? null : `${new Intl.NumberFormat("es-MX").format(listing.mileage_km)} km`} /><Detail label="Ubicación" value={[listing.city, listing.state_region].filter(Boolean).join(", ")} />
        <Detail label="Color exterior" value={listing.exterior_color} /><Detail label="Color interior" value={listing.interior_color} /><Detail label="Carrocería" value={listing.body_style} />
        <Detail label="Transmisión" value={listing.transmission} /><Detail label="Tracción" value={listing.drivetrain} /><Detail label="Combustible" value={listing.fuel_type} /><Detail label="Motor" value={listing.engine} />
      </dl></aside>
    </div>
  </article></main>;
}
