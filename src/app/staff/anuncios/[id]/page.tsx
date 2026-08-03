import { notFound } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { ClaimReviewForm } from "@/components/claim-review-form";
import { ReviewDecisionForm } from "@/components/review-decision-form";
import { ListingPhotoGallery } from "@/components/listing-photo-gallery";
import { ListingPublicationControls } from "@/components/listing-publication-controls";
import { requireRole } from "@/lib/auth";
import type { ListingStatus } from "@/lib/constants";
import { formatDate, formatMxn, LISTING_STATUS_LABELS } from "@/lib/listing-display";
import { getStaffListingPhotos } from "@/lib/listing-media";
import { createClient } from "@/lib/supabase/server";
import { parseStaffListingView, STAFF_LISTING_VIEW_COPY, staffListingViewHref } from "@/lib/staff-listing-views";

const visibleStatuses = ["submitted", "in_review", "changes_requested", "approved", "rejected", "published", "paused", "archived"];

type ReviewListing = {
  id: string; title: string; status: ListingStatus; submitted_at: string | null; reviewer_id: string | null; review_started_at: string | null;
  variant: string | null; year: number | null; price_mxn: number | string | null; mileage_km: number | null;
  city: string | null; state_region: string | null; exterior_color: string | null; interior_color: string | null;
  body_style: string | null; transmission: string | null; drivetrain: string | null; fuel_type: string | null; engine: string | null;
  owner_description: string | null; ownership_history: string | null; maintenance_history: string | null;
  modifications: string | null; known_issues: string | null; sale_reason: string | null;
  brands: { name: string } | null; models: { name: string } | null;
  owner_id: string; owner: { display_name: string | null; username: string | null } | null; reviewer: { display_name: string | null; username: string | null } | null;
};

type HistoryItem = {
  id: number; from_status: string; to_status: string; created_at: string;
  actor: { display_name: string | null } | null;
};

type PublicationEvent = {
  id: number; action: "paused" | "resumed" | "returned_to_review"; reason: string | null; created_at: string;
  actor: { display_name: string | null; username: string | null } | null;
};

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="border-t py-3"><dt className="text-xs font-bold uppercase text-stone-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap font-semibold">{value || "Sin especificar"}</dd></div>;
}

export default async function ReviewListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireRole(["staff", "admin"]);
  const { id } = await params;
  const query = await searchParams;
  const result = query.result;
  const returnView = parseStaffListingView(query.from) ?? "all";
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("listings").select(
    "id,owner_id,title,status,submitted_at,reviewer_id,review_started_at,variant,year,price_mxn,mileage_km,city,state_region,exterior_color,interior_color,body_style,transmission,drivetrain,fuel_type,engine,owner_description,ownership_history,maintenance_history,modifications,known_issues,sale_reason,brands(name),models(name),owner:profiles!listings_owner_id_fkey(display_name,username),reviewer:profiles!listings_reviewer_id_fkey(display_name,username)",
  ).eq("id", id).maybeSingle();
  if (!data || !visibleStatuses.includes(data.status)) notFound();
  const listing = data as unknown as ReviewListing;

  const [photos, submission, history, decisions, publicationEvents] = await Promise.all([
    getStaffListingPhotos(id),
    supabase.from("listing_submissions").select("attest_owner_authorized,attest_information_truthful,attest_modifications_and_issues_disclosed,attest_legal_documentation,attestation_version,created_at").eq("listing_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("listing_status_history").select("id,from_status,to_status,created_at,actor:profiles!listing_status_history_actor_id_fkey(display_name)").eq("listing_id", id).order("created_at", { ascending: true }),
    supabase.from("listing_review_decisions").select("id,decision,message,created_at,reviewer:profiles!listing_review_decisions_reviewer_id_fkey(display_name,username)").eq("listing_id", id).order("created_at", { ascending: true }),
    supabase.from("listing_post_publication_events").select("id,action,reason,created_at,actor:profiles!listing_post_publication_events_actor_id_fkey(display_name,username)").eq("listing_id", id).order("created_at", { ascending: true }),
  ]);
  const attestation = submission.data;
  const reviewControl = listing.status === "submitted"
    ? <ClaimReviewForm listingId={id} />
    : listing.status === "in_review" && listing.reviewer_id === viewer.id
      ? <p role="status" className="font-bold text-emerald-800">Revisión asignada a tu cuenta. En revisión desde {listing.review_started_at ? formatDate(listing.review_started_at) : "fecha desconocida"}.</p>
      : listing.status === "in_review"
        ? <p role="alert" className="font-bold text-amber-900">Otro miembro de staff tomó esta revisión. Asignada a {listing.reviewer?.username ? `@${listing.reviewer.username}` : listing.reviewer?.display_name || "otro miembro de staff"}.</p>
        : <p className="font-bold">Esta revisión ya terminó con estado {LISTING_STATUS_LABELS[listing.status]}.</p>;

  return (
    <article>
      <Link href={staffListingViewHref(returnView)} className="mb-5 inline-flex min-h-11 items-center font-bold underline">← Volver a {STAFF_LISTING_VIEW_COPY[returnView].title}</Link>
      {result === "published" ? <p role="status" className="mb-5 border border-emerald-700 bg-emerald-50 p-4 font-bold text-emerald-900">Anuncio aprobado y publicado.</p> : result === "paused" ? <p role="status" className="mb-5 border border-amber-700 bg-amber-50 p-4 font-bold text-amber-900">Publicación pausada.</p> : result === "resumed" ? <p role="status" className="mb-5 border border-emerald-700 bg-emerald-50 p-4 font-bold text-emerald-900">Publicación reanudada.</p> : result === "returned_to_review" ? <p role="status" className="mb-5 border border-blue-800 bg-blue-50 p-4 font-bold text-blue-950">El anuncio regresó a revisión y quedó asignado a tu cuenta.</p> : result === "changes_requested" ? <p role="status" className="mb-5 border border-amber-700 bg-amber-50 p-4 font-bold text-amber-900">Cambios solicitados al propietario.</p> : result === "rejected" ? <p role="status" className="mb-5 border border-red-700 bg-red-50 p-4 font-bold text-red-900">Anuncio rechazado.</p> : null}
      <header className="border-b pb-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">{LISTING_STATUS_LABELS[listing.status]}</p>
        <h1 className="mt-3 text-4xl font-black">{listing.title}</h1>
        <div className="mt-4 border-l-4 border-accent pl-4"><p className="text-xs font-bold uppercase text-stone-500">Propietario</p><p className="mt-1 font-black">{listing.owner?.username ? `@${listing.owner.username}` : "Usuario sin username"}</p>{listing.owner?.display_name ? <p>{listing.owner.display_name}</p> : null}<div className="mt-2 flex flex-wrap gap-3 text-sm font-bold"><Link href={`/staff/usuarios/${listing.owner_id}`} className="underline">Ver usuario en staff</Link>{listing.owner?.username ? <Link href={`/u/${listing.owner.username}`} className="underline">Ver perfil público</Link> : null}</div></div>
        <div className="mt-6">{reviewControl}</div>
      </header>
      {listing.status === "published" || listing.status === "paused" ? <ListingPublicationControls listingId={id} status={listing.status} returnView={returnView} /> : null}
      {listing.status === "in_review" && (listing.reviewer_id === viewer.id || viewer.role === "admin") ? <ReviewDecisionForm listingId={id} returnView={returnView} /> : null}
      {listing.status === "published" ? <Link href={`/autos/${id}`} className="mt-6 inline-flex bg-emerald-800 px-5 py-3 text-sm font-bold text-white">Ver publicación</Link> : null}
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
        <h2 className="text-2xl font-black">Decisiones</h2>
        {(decisions.data ?? []).length ? <ol className="mt-4 space-y-3">{(decisions.data ?? []).map((item) => { const reviewer = item.reviewer as unknown as { display_name: string | null; username: string | null } | null; return <li key={item.id} className="border-l-4 border-accent pl-4"><strong>{item.decision === "approved" ? "Aprobado y publicado" : LISTING_STATUS_LABELS[item.decision as ListingStatus]}</strong>{item.message ? <p className="mt-1 whitespace-pre-wrap">{item.message}</p> : null}<p className="mt-1 text-sm text-stone-500">{reviewer?.username ? `@${reviewer.username}` : reviewer?.display_name || "Staff"} · {formatDate(item.created_at)}</p></li>; })}</ol> : <p className="mt-3 text-stone-600">Sin decisiones todavía.</p>}
      </section>
      <section className="mt-10 border-t pt-7">
        <h2 className="text-2xl font-black">Declaraciones</h2>
        {attestation ? <ul className="mt-4 space-y-2 text-sm font-semibold"><li>✓ Propietario o autorizado para vender</li><li>✓ Información veraz</li><li>✓ Modificaciones y problemas declarados</li><li>✓ Documentación legal disponible</li><li className="text-stone-500">Versión {attestation.attestation_version} · {formatDate(attestation.created_at)}</li></ul> : <p className="mt-3 text-red-700">No se encontró la instantánea de envío.</p>}
      </section>
      <section className="mt-10 border-t pt-7">
        <h2 className="text-2xl font-black">Auditoría post-publicación</h2>
        {(publicationEvents.data ?? []).length ? <ol className="mt-4 space-y-3">{((publicationEvents.data ?? []) as unknown as PublicationEvent[]).map((event) => <li key={event.id} className="border-l-4 border-blue-800 pl-4 text-sm"><strong>{event.action === "paused" ? "Publicación pausada" : event.action === "resumed" ? "Publicación reanudada" : "Regresó a revisión"}</strong>{event.reason ? <p className="mt-1 whitespace-pre-wrap">{event.reason}</p> : null}<p className="mt-1 text-stone-600">{event.actor?.username ? `@${event.actor.username}` : event.actor?.display_name || "Staff"} · {formatDate(event.created_at)}</p></li>)}</ol> : <p className="mt-3 text-stone-600">Sin acciones post-publicación.</p>}
      </section>
      <section className="mt-10 border-t pt-7">
        <h2 className="text-2xl font-black">Historial de estados</h2>
        <ol className="mt-4 space-y-3">{((history.data ?? []) as unknown as HistoryItem[]).map((item) => <li key={item.id} className="border-l-4 pl-4 text-sm"><strong>{item.from_status} → {item.to_status}</strong><br /><span className="text-stone-600">{item.actor?.display_name || "Usuario"} · {formatDate(item.created_at)}</span></li>)}</ol>
      </section>
    </article>
  );
}
