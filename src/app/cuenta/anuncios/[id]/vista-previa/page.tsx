import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ListingPhotoGallery } from "@/components/listing-photo-gallery";
import { ListingSubmissionPanel } from "@/components/listing-submission-panel";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMxn } from "@/lib/listing-display";
import { getPrivateListingPhotos } from "@/lib/listing-media";
import { EDITABLE_LISTING_STATUSES } from "@/lib/listing-validation";
import { createClient } from "@/lib/supabase/server";
import type { ListingStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

type PreviewListing = {
  id: string; title: string; status: ListingStatus; submitted_at: string | null; variant: string | null; year: number | null;
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
    "id,title,status,submitted_at,variant,year,price_mxn,mileage_km,city,state_region,body_style,transmission,drivetrain,fuel_type,engine,owner_description,ownership_history,maintenance_history,modifications,known_issues,sale_reason,brands(name),models(name)",
  ).eq("id", id).eq("owner_id", viewer.id).maybeSingle();
  if (!data) notFound();
  const listing = data as unknown as PreviewListing;
  const photos = await getPrivateListingPhotos(id, viewer.id);
  const editable = EDITABLE_LISTING_STATUSES.includes(listing.status as (typeof EDITABLE_LISTING_STATUSES)[number]);
  const canSubmit = listing.status === "draft" || listing.status === "changes_requested";
  const [readiness, decision] = await Promise.all([
    canSubmit ? supabase.rpc("get_listing_submission_readiness", { target_listing_id: id }) : Promise.resolve(null),
    supabase.from("listing_review_decisions").select("decision,message,created_at").eq("listing_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return (
    <article>
      <div className="border-2 border-amber-600 bg-amber-50 p-4 text-sm font-bold text-amber-950" role="note">Vista previa privada. Este anuncio todavía no está publicado.</div>
      {listing.status === "submitted" || listing.status === "in_review" ? <div className="mt-4 border border-emerald-700 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">{listing.status === "submitted" ? "Enviado a revisión" : "En revisión"}{listing.submitted_at ? ` · ${formatDate(listing.submitted_at)}` : ""}</div> : null}
      {listing.status === "changes_requested" ? (
        <section className="mt-4 border border-amber-700 bg-amber-50 p-4 text-amber-950" aria-labelledby="review-update-heading">
          <p className="text-sm font-bold uppercase tracking-wide">Cambios solicitados</p>
          <h2 id="review-update-heading" className="mt-1 font-black">Tu anuncio requiere cambios.</h2>
          {decision.data?.message ? <p className="mt-2 whitespace-pre-wrap">{decision.data.message}</p> : null}
          {decision.data?.created_at ? <p className="mt-2 text-sm">Fecha de decisión: {formatDate(decision.data.created_at)}</p> : null}
          <Link href={`/cuenta/anuncios/${id}/editar`} className="mt-3 inline-flex min-h-11 items-center font-bold underline">Editar y corregir</Link>
        </section>
      ) : null}
      {listing.status === "approved" ? (
        <section className="mt-4 border border-emerald-700 bg-emerald-50 p-4 text-emerald-950" aria-labelledby="review-update-heading">
          <p className="text-sm font-bold uppercase tracking-wide">Aprobado</p>
          <h2 id="review-update-heading" className="mt-1 font-black">Tu anuncio fue aprobado.</h2>
          <p className="mt-1 text-sm">La aprobación no significa que ya esté publicado.</p>
          {decision.data?.created_at ? <p className="mt-2 text-sm">Fecha de decisión: {formatDate(decision.data.created_at)}</p> : null}
        </section>
      ) : null}
      {listing.status === "rejected" ? (
        <section className="mt-4 border border-red-800 bg-red-50 p-4 text-red-950" aria-labelledby="review-update-heading">
          <p className="text-sm font-bold uppercase tracking-wide">Rechazado</p>
          <h2 id="review-update-heading" className="mt-1 font-black">Tu anuncio fue rechazado.</h2>
          {decision.data?.message ? <p className="mt-2 whitespace-pre-wrap">{decision.data.message}</p> : null}
          {decision.data?.created_at ? <p className="mt-2 text-sm">Fecha de decisión: {formatDate(decision.data.created_at)}</p> : null}
          <p className="mt-3 text-sm font-semibold">Este anuncio no puede editarse ni reenviarse en esta versión.</p>
        </section>
      ) : null}
      <header className="py-10">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">{[listing.brands?.name, listing.models?.name].filter(Boolean).join(" · ") || "Vehículo por identificar"}</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">{listing.title}</h1>
        <p className="mt-5 text-3xl font-black">{formatMxn(listing.price_mxn)}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          {editable ? <Link href={`/cuenta/anuncios/${id}/editar`} className="bg-stone-950 px-5 py-3 text-sm font-bold text-white hover:bg-accent">Volver a editar</Link> : null}
          <Link href="/cuenta/anuncios" className="border px-5 py-3 text-sm font-bold hover:border-accent hover:text-accent">Mis anuncios</Link>
        </div>
      </header>
      <ListingPhotoGallery photos={photos ?? []} />
      {canSubmit && readiness ? <ListingSubmissionPanel listingId={id} readinessCodes={(readiness.data as string[] | null) ?? []} /> : null}
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
