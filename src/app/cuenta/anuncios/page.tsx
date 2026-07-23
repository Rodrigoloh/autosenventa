import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { requireUser } from "@/lib/auth";
import { LISTING_STATUS_LABELS, formatDate, formatMxn, listingCompletion } from "@/lib/listing-display";
import { EDITABLE_LISTING_STATUSES } from "@/lib/listing-validation";
import { createClient } from "@/lib/supabase/server";
import type { ListingStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

type DashboardListing = Record<string, unknown> & {
  id: string; title: string; variant: string | null; year: number | null; price_mxn: string | number | null;
  status: ListingStatus; updated_at: string; brands: { name: string } | null; models: { name: string } | null;
};

export default async function ListingsPage() {
  const viewer = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("listings").select(
    "id,title,category_id,brand_id,model_id,variant,year,price_mxn,mileage_km,city,state_region,exterior_color,interior_color,body_style,transmission,drivetrain,fuel_type,engine,owner_description,ownership_history,maintenance_history,sale_reason,status,updated_at,brands(name),models(name)",
  ).eq("owner_id", viewer.id).order("updated_at", { ascending: false });

  if (error) return (
    <section>
      <h1 className="text-4xl font-black tracking-tight">Mis anuncios</h1>
      <div role="alert" className="mt-8 border-l-4 border-red-700 bg-red-50 p-5">
        <p className="font-bold">No pudimos cargar tus anuncios.</p>
        <p className="mt-1 text-sm text-stone-700">Recarga la página. Si el problema continúa, inténtalo más tarde.</p>
      </div>
    </section>
  );

  const listings = (data ?? []) as unknown as DashboardListing[];
  if (!listings.length) return <EmptyState title="Mis anuncios" description="Todavía no has creado ningún anuncio." href="/cuenta/anuncios/nuevo" action="Crear anuncio" />;

  return (
    <section>
      <div className="flex flex-col gap-5 border-b pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Cuenta</p><h1 className="mt-2 text-4xl font-black tracking-tight">Mis anuncios</h1></div>
        <Link href="/cuenta/anuncios/nuevo" className="inline-flex min-h-11 items-center justify-center bg-stone-950 px-5 py-3 text-sm font-bold text-white hover:bg-accent">Crear anuncio</Link>
      </div>
      <div className="divide-y">
        {listings.map((listing) => {
          const editable = EDITABLE_LISTING_STATUSES.includes(listing.status as (typeof EDITABLE_LISTING_STATUSES)[number]);
          const completion = listingCompletion(listing);
          return (
            <article key={listing.id} className="grid gap-5 py-7 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-stone-200 px-2.5 py-1 text-xs font-bold uppercase tracking-wide">{LISTING_STATUS_LABELS[listing.status]}</span>
                  {listing.status === "draft" && completion < 100 ? <span className="text-xs font-semibold text-amber-800">Borrador incompleto</span> : null}
                </div>
                <h2 className="mt-3 text-2xl font-black tracking-tight">{listing.title}</h2>
                <p className="mt-1 text-sm text-stone-600">{[listing.brands?.name, listing.models?.name, listing.variant, listing.year].filter(Boolean).join(" · ") || "Vehículo por identificar"}</p>
                <p className="mt-3 font-bold">{formatMxn(listing.price_mxn)}</p>
                <div className="mt-4 max-w-sm">
                  <div className="flex justify-between text-xs font-semibold"><span>Información completada</span><span>{completion}%</span></div>
                  <div className="mt-1 h-2 bg-stone-200" aria-label={`${completion}% de información completada`}><div className="h-full bg-accent" style={{ width: `${completion}%` }} /></div>
                </div>
                <p className="mt-3 text-xs text-stone-500">Actualizado {formatDate(listing.updated_at)}</p>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {editable ? <Link href={`/cuenta/anuncios/${listing.id}/editar`} className="border border-stone-950 px-4 py-2 text-sm font-bold hover:bg-stone-950 hover:text-white">Editar</Link> : <span className="px-1 py-2 text-sm font-semibold text-stone-500">No editable</span>}
                {listing.status === "rejected" ? <Link href={`/cuenta/anuncios/${listing.id}/vista-previa`} className="border border-red-800 px-4 py-2 text-sm font-bold text-red-900 hover:bg-red-800 hover:text-white">Ver motivo</Link> : null}
                {listing.status === "changes_requested" ? <Link href={`/cuenta/anuncios/${listing.id}/vista-previa`} className="border border-amber-700 px-4 py-2 text-sm font-bold text-amber-900 hover:bg-amber-700 hover:text-white">Ver mensaje</Link> : null}
                {listing.status === "published" ? <Link href={`/autos/${listing.id}`} className="bg-emerald-800 px-4 py-2 text-sm font-bold text-white">Ver publicación</Link> : <Link href={`/cuenta/anuncios/${listing.id}/vista-previa`} className="border px-4 py-2 text-sm font-bold hover:border-accent hover:text-accent">{listing.status === "rejected" ? "Ver detalle" : "Vista previa"}</Link>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
