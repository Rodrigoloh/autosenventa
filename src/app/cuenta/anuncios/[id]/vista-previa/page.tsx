import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { formatMxn } from "@/lib/listing-display";
import { EDITABLE_LISTING_STATUSES } from "@/lib/listing-validation";
import { createClient } from "@/lib/supabase/server";

type PreviewListing = {
  id: string; title: string; status: string; variant: string | null; year: number | null;
  price_mxn: number | string | null; mileage_km: number | null; city: string | null; state_region: string | null;
  body_style: string | null; transmission: string | null; drivetrain: string | null; fuel_type: string | null; engine: string | null;
  owner_description: string | null; ownership_history: string | null; maintenance_history: string | null;
  modifications: string | null; known_issues: string | null; sale_reason: string | null;
  brands: { name: string } | null; models: { name: string } | null;
};

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="border-t py-4"><dt className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</dt><dd className="mt-1 font-semibold">{value || "Sin especificar"}</dd></div>;
}

function Story({ title, body }: { title: string; body: string | null }) {
  return <section className="border-t py-7"><h2 className="text-xl font-black tracking-tight">{title}</h2><p className="mt-3 whitespace-pre-wrap leading-7 text-stone-700">{body || "Sin información todavía."}</p></section>;
}

export default async function ListingPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("listings").select(
    "id,title,status,variant,year,price_mxn,mileage_km,city,state_region,body_style,transmission,drivetrain,fuel_type,engine,owner_description,ownership_history,maintenance_history,modifications,known_issues,sale_reason,brands(name),models(name)",
  ).eq("id", id).eq("owner_id", viewer.id).maybeSingle();
  if (!data) notFound();
  const listing = data as unknown as PreviewListing;
  const editable = EDITABLE_LISTING_STATUSES.includes(listing.status as (typeof EDITABLE_LISTING_STATUSES)[number]);

  return (
    <article>
      <div className="border-2 border-amber-600 bg-amber-50 p-4 text-sm font-bold text-amber-950" role="note">Vista previa privada. Este anuncio todavía no está publicado.</div>
      <header className="py-10">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">{[listing.brands?.name, listing.models?.name].filter(Boolean).join(" · ") || "Vehículo por identificar"}</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">{listing.title}</h1>
        <p className="mt-5 text-3xl font-black">{formatMxn(listing.price_mxn)}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          {editable ? <Link href={`/cuenta/anuncios/${id}/editar`} className="bg-stone-950 px-5 py-3 text-sm font-bold text-white hover:bg-accent">Volver a editar</Link> : null}
          <Link href="/cuenta/anuncios" className="border px-5 py-3 text-sm font-bold hover:border-accent hover:text-accent">Mis anuncios</Link>
        </div>
      </header>
      <dl className="grid gap-x-8 border-b sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Marca" value={listing.brands?.name} /><Detail label="Modelo" value={listing.models?.name} />
        <Detail label="Variante" value={listing.variant} /><Detail label="Año" value={listing.year} />
        <Detail label="Kilometraje" value={listing.mileage_km === null ? null : `${new Intl.NumberFormat("es-MX").format(listing.mileage_km)} km`} />
        <Detail label="Ubicación" value={[listing.city, listing.state_region].filter(Boolean).join(", ")} />
        <Detail label="Carrocería" value={listing.body_style} /><Detail label="Transmisión" value={listing.transmission} />
        <Detail label="Tracción" value={listing.drivetrain} /><Detail label="Combustible" value={listing.fuel_type} /><Detail label="Motor" value={listing.engine} />
      </dl>
      <div className="mt-8">
        <Story title="Descripción del propietario" body={listing.owner_description} />
        <Story title="Historia de propiedad" body={listing.ownership_history} />
        <Story title="Mantenimiento" body={listing.maintenance_history} />
        <Story title="Modificaciones" body={listing.modifications} />
        <Story title="Problemas conocidos" body={listing.known_issues} />
        <Story title="Motivo de venta" body={listing.sale_reason} />
      </div>
    </article>
  );
}
