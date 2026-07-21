import { notFound } from "next/navigation";
import { z } from "zod";
import { ClaimReviewForm } from "@/components/claim-review-form";
import { ListingPhotoGallery } from "@/components/listing-photo-gallery";
import { requireRole } from "@/lib/auth";
import type { ListingStatus } from "@/lib/constants";
import { formatDate, formatMxn, LISTING_STATUS_LABELS } from "@/lib/listing-display";
import { getStaffListingPhotos } from "@/lib/listing-media";
import { createClient } from "@/lib/supabase/server";

const visibleStatuses = ["submitted", "in_review"];

type ReviewListing = {
  id: string; title: string; status: ListingStatus; submitted_at: string | null; reviewer_id: string | null; review_started_at: string | null;
  variant: string | null; year: number | null; price_mxn: number | string | null; mileage_km: number | null;
  city: string | null; state_region: string | null; exterior_color: string | null; interior_color: string | null;
  body_style: string | null; transmission: string | null; drivetrain: string | null; fuel_type: string | null; engine: string | null;
  owner_description: string | null; ownership_history: string | null; maintenance_history: string | null;
  modifications: string | null; known_issues: string | null; sale_reason: string | null;
  brands: { name: string } | null; models: { name: string } | null;
  owner: { display_name: string | null } | null; reviewer: { display_name: string | null } | null;
};

type HistoryItem = {
  id: number; from_status: string; to_status: string; created_at: string;
  actor: { display_name: string | null } | null;
};

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="border-t py-3"><dt className="text-xs font-bold uppercase text-stone-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap font-semibold">{value || "Sin especificar"}</dd></div>;
}

export default async function ReviewListingPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole(["staff", "admin"]);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("listings").select(
    "id,title,status,submitted_at,reviewer_id,review_started_at,variant,year,price_mxn,mileage_km,city,state_region,exterior_color,interior_color,body_style,transmission,drivetrain,fuel_type,engine,owner_description,ownership_history,maintenance_history,modifications,known_issues,sale_reason,brands(name),models(name),owner:profiles!listings_owner_id_fkey(display_name),reviewer:profiles!listings_reviewer_id_fkey(display_name)",
  ).eq("id", id).maybeSingle();
  if (!data || !visibleStatuses.includes(data.status)) notFound();
  const listing = data as unknown as ReviewListing;

  const [photos, submission, history] = await Promise.all([
    getStaffListingPhotos(id),
    supabase.from("listing_submissions").select("attest_owner_authorized,attest_information_truthful,attest_modifications_and_issues_disclosed,attest_legal_documentation,attestation_version,created_at").eq("listing_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("listing_status_history").select("id,from_status,to_status,created_at,actor:profiles!listing_status_history_actor_id_fkey(display_name)").eq("listing_id", id).order("created_at", { ascending: true }),
  ]);
  const attestation = submission.data;
  const reviewControl = listing.status === "submitted"
    ? <ClaimReviewForm listingId={id} />
    : listing.reviewer_id === viewer.id
      ? <p role="status" className="font-bold text-emerald-800">Revisión asignada a tu cuenta. En revisión desde {listing.review_started_at ? formatDate(listing.review_started_at) : "fecha desconocida"}.</p>
      : <p role="alert" className="font-bold text-amber-900">Otro miembro de staff tomó esta revisión. Asignada a {listing.reviewer?.display_name || "otro revisor"}.</p>;

  return (
    <article>
      <header className="border-b pb-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">{LISTING_STATUS_LABELS[listing.status]}</p>
        <h1 className="mt-3 text-4xl font-black">{listing.title}</h1>
        <p className="mt-2 text-stone-600">Propietario: {listing.owner?.display_name || "Sin nombre público"}</p>
        <div className="mt-6">{reviewControl}</div>
      </header>
      <div className="mt-8"><ListingPhotoGallery photos={photos} /></div>
      <dl className="mt-8 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Marca" value={listing.brands?.name} /><Detail label="Modelo" value={listing.models?.name} />
        <Detail label="Variante" value={listing.variant} /><Detail label="Año" value={listing.year} />
        <Detail label="Precio" value={formatMxn(listing.price_mxn)} /><Detail label="Kilometraje" value={listing.mileage_km === null ? null : `${listing.mileage_km} km`} />
        <Detail label="Ubicación" value={[listing.city, listing.state_region].filter(Boolean).join(", ")} /><Detail label="Color exterior" value={listing.exterior_color} />
        <Detail label="Color interior" value={listing.interior_color} /><Detail label="Carrocería" value={listing.body_style} />
        <Detail label="Transmisión" value={listing.transmission} /><Detail label="Tracción" value={listing.drivetrain} />
        <Detail label="Combustible" value={listing.fuel_type} /><Detail label="Motor" value={listing.engine} />
      </dl>
      <dl className="mt-8">
        <Detail label="Descripción general" value={listing.owner_description} /><Detail label="Historia de propiedad" value={listing.ownership_history} />
        <Detail label="Mantenimiento" value={listing.maintenance_history} /><Detail label="Modificaciones" value={listing.modifications} />
        <Detail label="Problemas conocidos" value={listing.known_issues} /><Detail label="Motivo de venta" value={listing.sale_reason} />
      </dl>
      <section className="mt-10 border-t pt-7">
        <h2 className="text-2xl font-black">Declaraciones</h2>
        {attestation ? <ul className="mt-4 space-y-2 text-sm font-semibold"><li>✓ Propietario o autorizado para vender</li><li>✓ Información veraz</li><li>✓ Modificaciones y problemas declarados</li><li>✓ Documentación legal disponible</li><li className="text-stone-500">Versión {attestation.attestation_version} · {formatDate(attestation.created_at)}</li></ul> : <p className="mt-3 text-red-700">No se encontró la instantánea de envío.</p>}
      </section>
      <section className="mt-10 border-t pt-7">
        <h2 className="text-2xl font-black">Historial de estados</h2>
        <ol className="mt-4 space-y-3">{((history.data ?? []) as unknown as HistoryItem[]).map((item) => <li key={item.id} className="border-l-4 pl-4 text-sm"><strong>{item.from_status} → {item.to_status}</strong><br /><span className="text-stone-600">{item.actor?.display_name || "Usuario"} · {formatDate(item.created_at)}</span></li>)}</ol>
      </section>
    </article>
  );
}
