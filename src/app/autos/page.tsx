import type { Metadata } from "next";
import Link from "next/link";
import { PublicListingGrid } from "@/components/public-listing-grid";
import { filterAndSortListings, getPublishedListings, marketplaceHref, parseMarketplaceFilters } from "@/lib/public-marketplace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Explorar autos", description: "Autos publicados y disponibles en driven-mx." };
const PAGE_SIZE = 12;

export default async function AutosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseMarketplaceFilters(await searchParams);
  const listings = await getPublishedListings();
  const brands = [...new Set(listings.map((item) => item.brandName).filter((value): value is string => Boolean(value)))].sort();
  const models = [...new Set(listings.filter((item) => !filters.brand || item.brandName === filters.brand).map((item) => item.modelName).filter((value): value is string => Boolean(value)))].sort();
  const results = filterAndSortListings(listings, filters);
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const visible = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return <main className="public-shell min-w-0 flex-1">
    <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
      <p className="editorial-kicker !text-orange-500">Marketplace</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4 border-b public-rule pb-8"><h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Explorar autos</h1><p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">{results.length} {results.length === 1 ? "auto publicado" : "autos publicados"}</p></div>
      <form id="buscar" action="/autos" role="search" className="public-surface mt-8 grid scroll-mt-24 gap-4 border-y public-rule p-5 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">Texto libre<input name="q" defaultValue={filters.q} placeholder="Año, ciudad, versión…" className="public-field mt-2 h-11 w-full px-3 font-normal normal-case tracking-normal placeholder:text-zinc-600" /></label>
        <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">Marca<select name="marca" defaultValue={filters.brand} className="public-field mt-2 h-11 w-full px-3 font-normal normal-case tracking-normal"><option value="">Todas</option>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select></label>
        <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">Modelo<select name="modelo" defaultValue={filters.model} className="public-field mt-2 h-11 w-full px-3 font-normal normal-case tracking-normal"><option value="">Todos</option>{models.map((model) => <option key={model}>{model}</option>)}</select></label>
        <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">Orden<select name="orden" defaultValue={filters.order} className="public-field mt-2 h-11 w-full px-3 font-normal normal-case tracking-normal"><option value="newest">Más recientes</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option><option value="mileage">Menor kilometraje</option></select></label>
        <button className="h-11 bg-orange-600 px-5 text-sm font-bold hover:bg-orange-500">Aplicar filtros</button>
        {(filters.q || filters.brand || filters.model || filters.order !== "newest") ? <Link href="/autos" className="text-xs font-semibold text-zinc-400 underline underline-offset-4 hover:text-white">Limpiar filtros</Link> : null}
      </form>
      <div className="mt-12">{visible.length ? <PublicListingGrid listings={visible} /> : <div className="driven-halftone border border-dashed border-white/15 p-10 text-center text-zinc-400"><p className="inline-block bg-zinc-950 px-3 py-2">No encontramos autos con esos filtros.</p><br /><Link href="/autos" className="mt-3 inline-block bg-zinc-950 px-3 py-2 font-semibold text-white underline">Ver todo el catálogo</Link></div>}</div>
      {pageCount > 1 ? <nav aria-label="Paginación" className="mt-12 flex items-center justify-center gap-3"><Link aria-disabled={page === 1} tabIndex={page === 1 ? -1 : undefined} href={marketplaceHref(filters, Math.max(1, page - 1))} className={`border border-white/15 px-4 py-2 text-sm font-semibold ${page === 1 ? "pointer-events-none text-zinc-700" : "hover:border-orange-500"}`}>Anterior</Link><span className="text-sm text-zinc-400">Página {page} de {pageCount}</span><Link aria-disabled={page === pageCount} tabIndex={page === pageCount ? -1 : undefined} href={marketplaceHref(filters, Math.min(pageCount, page + 1))} className={`border border-white/15 px-4 py-2 text-sm font-semibold ${page === pageCount ? "pointer-events-none text-zinc-700" : "hover:border-orange-500"}`}>Siguiente</Link></nav> : null}
    </section>
  </main>;
}
