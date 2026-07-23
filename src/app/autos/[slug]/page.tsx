import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ListingPhotoGallery } from "@/components/listing-photo-gallery";
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
  return <div className="border-t py-4"><dt className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</dt><dd className="mt-1 font-semibold">{value || "Sin especificar"}</dd></div>;
}

function Story({ title, body }: { title: string; body: string | null }) {
  return <section className="border-t py-7"><h2 className="text-xl font-black">{title}</h2><p className="mt-3 whitespace-pre-wrap leading-7 text-stone-700">{body || "Sin información."}</p></section>;
}

export default async function AutoPage({ params }: { params: Promise<{ slug: string }> }) {
  const id = (await params).slug;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_listing", { target_listing_id: id }).maybeSingle();
  if (!data) notFound();
  const listing = data as PublicListing;
  const photos = await getPublicListingPhotos(id);
  if (!photos) notFound();
  return <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 lg:px-8"><article>
    <header className="border-b pb-8">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">{[listing.brand_name, listing.model_name].filter(Boolean).join(" · ")}</p>
      <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">{listing.title}</h1>
      <p className="mt-5 text-3xl font-black">{formatMxn(listing.price_mxn)}</p>
      <p className="mt-4 text-stone-600">Publicado por <Link href={`/u/${listing.owner_username}`} className="font-bold underline">@{listing.owner_username}</Link></p>
    </header>
    <div className="mt-8"><ListingPhotoGallery photos={photos} showCapacity={false} /></div>
    <dl className="mt-10 grid gap-x-8 border-b sm:grid-cols-2 lg:grid-cols-3">
      <Detail label="Marca" value={listing.brand_name} /><Detail label="Modelo" value={listing.model_name} /><Detail label="Versión" value={listing.variant} /><Detail label="Año" value={listing.year} />
      <Detail label="Kilometraje" value={listing.mileage_km === null ? null : `${new Intl.NumberFormat("es-MX").format(listing.mileage_km)} km`} /><Detail label="Ubicación" value={[listing.city, listing.state_region].filter(Boolean).join(", ")} />
      <Detail label="Color exterior" value={listing.exterior_color} /><Detail label="Color interior" value={listing.interior_color} /><Detail label="Carrocería" value={listing.body_style} />
      <Detail label="Transmisión" value={listing.transmission} /><Detail label="Tracción" value={listing.drivetrain} /><Detail label="Combustible" value={listing.fuel_type} /><Detail label="Motor" value={listing.engine} />
    </dl>
    <div className="mt-8"><Story title="Descripción" body={listing.owner_description} /><Story title="Historia de propiedad" body={listing.ownership_history} /><Story title="Mantenimiento" body={listing.maintenance_history} /><Story title="Modificaciones" body={listing.modifications} /><Story title="Problemas conocidos" body={listing.known_issues} /><Story title="Motivo de venta" body={listing.sale_reason} /></div>
  </article></main>;
}
