import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import type { ListingStatus } from "@/lib/constants";
import { formatDate, formatMxn, LISTING_STATUS_LABELS } from "@/lib/listing-display";
import { createClient } from "@/lib/supabase/server";
import {
  parseStaffListingView,
  normalizeStaffListingSearch,
  STAFF_LISTING_VIEWS,
  STAFF_LISTING_VIEW_COPY,
  staffListingViewHref,
  staffListingDetailHref,
  type StaffListingView,
} from "@/lib/staff-listing-views";

type QueueListing = {
  id: string; title: string; status: ListingStatus; reviewer_id: string | null;
  year: number | null; city: string | null; state_region: string | null; price_mxn: number | string | null;
  submitted_at: string | null; updated_at: string; brands: { name: string } | null; models: { name: string } | null;
  reviewer: { username: string | null } | null; listing_media: Array<{ count: number }>;
  owner: { username: string | null } | null;
};

function applyViewFilter<T extends {
  in(column: string, values: readonly string[]): T;
  eq(column: string, value: string): T;
  is(column: string, value: null): T;
}>(query: T, view: StaffListingView, viewerId: string) {
  if (view === "all") return query.in("status", ["submitted", "in_review"]);
  if (view === "pending") return query.eq("status", "submitted").is("reviewer_id", null);
  if (view === "in-review") return query.eq("status", "in_review");
  if (view === "mine") return query.eq("status", "in_review").eq("reviewer_id", viewerId);
  if (view === "changes-requested") return query.eq("status", "changes_requested");
  if (view === "published") return query.eq("status", "published");
  return query.eq("status", "paused");
}

function itemBadge(item: QueueListing, viewerId: string) {
  if (item.status === "submitted") return "Pendiente de revisión";
  if (item.status === "in_review" && item.reviewer_id === viewerId) return "En revisión · Asignado a ti";
  if (item.status === "in_review") return item.reviewer?.username ? `En revisión por @${item.reviewer.username}` : "En revisión por otro miembro de staff";
  return LISTING_STATUS_LABELS[item.status];
}

export default async function ReviewQueuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireRole(["staff", "admin"]);
  const params = await searchParams;
  const view = parseStaffListingView(params.view);
  if (!view) redirect("/staff/anuncios?view=pending");
  const search = normalizeStaffListingSearch(params.q);
  if (search === null) redirect(staffListingViewHref(view));
  const supabase = await createClient();
  const fields = "id,title,status,reviewer_id,year,city,state_region,price_mxn,submitted_at,updated_at,brands(name),models(name),owner:profiles!listings_owner_id_fkey(username),reviewer:profiles!listings_reviewer_id_fkey(username),listing_media(count)";
  const baseQuery = supabase.from("listings").select(fields);
  const { data } = await applyViewFilter(baseQuery, view, viewer.id).order("updated_at", { ascending: false });
  const viewItems = (data ?? []) as unknown as QueueListing[];
  const needle = search.toLocaleLowerCase("es-MX");
  const items = search ? viewItems.filter((item) => [
    item.id, item.title, item.owner?.username, item.brands?.name, item.models?.name,
  ].some((value) => value?.toLocaleLowerCase("es-MX").includes(needle))) : viewItems;
  const copy = STAFF_LISTING_VIEW_COPY[view];

  return <>
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Panel editorial</p>
    <div className="mt-3 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-4xl font-black tracking-tight">{copy.title}</h1>
        <p className="mt-2 font-semibold text-stone-600">{copy.countLabel(items.length)}</p>
      </div>
      {view !== "all" ? <Link href="/staff/anuncios" className="font-bold underline">Todas las revisiones</Link> : null}
    </div>
    <nav aria-label="Filtros de anuncios staff" className="mt-5 flex flex-wrap gap-2">
      {STAFF_LISTING_VIEWS.map((candidate) => (
        <Link
          key={candidate}
          href={staffListingViewHref(candidate, search)}
          aria-current={candidate === view ? "page" : undefined}
          className={`border px-3 py-2 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${candidate === view ? "border-stone-950 bg-stone-950 text-white" : "hover:border-accent hover:text-accent"}`}
        >
          {STAFF_LISTING_VIEW_COPY[candidate].title}
        </Link>
      ))}
    </nav>
    <form method="get" action="/staff/anuncios" role="search" className="mt-5 flex flex-col gap-3 border bg-stone-50 p-4 sm:flex-row sm:items-end">
      {view !== "all" ? <input type="hidden" name="view" value={view} /> : null}
      <label className="flex-1 text-sm font-bold">Buscar anuncios
        <input name="q" defaultValue={search} maxLength={100} placeholder="Username, marca, modelo, título o ID" className="mt-2 min-h-11 w-full border bg-white px-3 font-normal" />
      </label>
      <button className="min-h-11 bg-stone-950 px-5 text-sm font-bold text-white">Buscar</button>
      {search ? <Link href={staffListingViewHref(view)} className="inline-flex min-h-11 items-center justify-center px-3 text-sm font-bold underline">Limpiar búsqueda</Link> : null}
    </form>
    {search ? <p className="mt-4 text-sm font-semibold text-stone-700">{items.length} {items.length === 1 ? "resultado" : "resultados"} para “{search}” en {copy.title.toLowerCase()}.</p> : null}
    {items.length ? (
      <div className="mt-8 divide-y border-y">
        {items.map((item) => (
          <article key={item.id} className="grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <span className="bg-stone-200 px-2.5 py-1 text-xs font-black uppercase">{itemBadge(item, viewer.id)}</span>
              <h2 className="mt-3 text-xl font-black">{item.title}</h2>
              <p className="mt-1 text-sm text-stone-600">{[item.year, item.brands?.name, item.models?.name].filter(Boolean).join(" · ")} · {[item.city, item.state_region].filter(Boolean).join(", ")}</p>
              <p className="mt-2 text-sm font-semibold">{formatMxn(item.price_mxn)} · {item.listing_media[0]?.count ?? 0} fotos</p>
              <p className="mt-1 text-xs text-stone-500">{item.submitted_at ? `Enviado ${formatDate(item.submitted_at)}` : `Actualizado ${formatDate(item.updated_at)}`}</p>
            </div>
            <Link href={staffListingDetailHref(item.id, view, search)} className="border px-4 py-2 text-sm font-bold hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
              {item.status === "submitted" ? "Revisar anuncio" : item.status === "published" ? "Ver publicación" : "Abrir anuncio"}
            </Link>
          </article>
        ))}
      </div>
    ) : <p className="mt-8 border border-dashed p-6 text-stone-600">{search ? `No encontramos anuncios para “${search}” dentro de ${copy.title.toLowerCase()}.` : copy.empty}</p>}
  </>;
}
