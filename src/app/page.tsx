import Link from "next/link";
import { FeaturedListings } from "@/components/featured-listings";
import { PublicListingGrid } from "@/components/public-listing-grid";
import { getPublishedListings } from "@/lib/public-marketplace";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const listings = await getPublishedListings();
  const featured = listings.filter((listing) => listing.isFeatured)
    .sort((a, b) => (a.featuredOrder ?? Number.MAX_SAFE_INTEGER) - (b.featuredOrder ?? Number.MAX_SAFE_INTEGER));
  const highlights = (featured.length ? featured : listings).slice(0, 5);
  const selection = (featured.length ? featured : listings).slice(0, 8);
  return (
    <main className="public-shell min-w-0 flex-1">
      {highlights.length ? <FeaturedListings listings={highlights} /> : <section className="grid min-h-[22rem] place-items-center px-5 text-center"><div><p className="editorial-kicker">Selección driven-mx</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Los próximos autos están por llegar.</h1></div></section>}
      <section className="px-5 lg:px-8">
        <div className="public-raised mx-auto mt-4 flex max-w-7xl flex-col gap-3 rounded-md border public-rule px-4 py-3 lg:flex-row lg:items-center">
          <h2 className="shrink-0 text-sm font-bold text-zinc-100">Explorar autos</h2>
          <form action="/autos" role="search" className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_1fr_1.5fr_auto]">
            <label className="sr-only" htmlFor="home-brand">Marca</label><input id="home-brand" name="marca" placeholder="Marca" className="public-field h-9 min-w-0 px-3 text-xs placeholder:text-zinc-600" />
            <label className="sr-only" htmlFor="home-model">Modelo</label><input id="home-model" name="modelo" placeholder="Modelo" className="public-field h-9 min-w-0 px-3 text-xs placeholder:text-zinc-600" />
            <label className="sr-only" htmlFor="home-keyword">Año o palabra clave</label><input id="home-keyword" name="q" placeholder="Año o palabra clave" className="public-field h-9 min-w-0 px-3 text-xs placeholder:text-zinc-600" />
            <button className="h-9 bg-orange-600 px-5 text-[11px] font-bold text-white transition-colors hover:bg-orange-500">Ver autos</button>
          </form>
          <nav aria-label="Orden rápido" className="flex shrink-0 items-center gap-3 text-[10px] font-semibold text-zinc-500"><Link href="/autos" className="text-zinc-200 hover:text-white">Recientes</Link><Link href="/autos?orden=price-asc" className="hover:text-white">Precio</Link><Link href="/autos?orden=mileage" className="hover:text-white">Kilometraje</Link></nav>
        </div>
      </section>
      {selection.length ? <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-14"><div className="mb-5 flex items-end justify-between gap-4"><div><p className="editorial-kicker">Curaduría</p><h2 className="mt-1 text-xl font-bold tracking-tight">Destacados / selección</h2></div><Link href="/autos?orden=newest" className="text-[11px] font-semibold text-zinc-500 transition-colors hover:text-white">Ver todos&nbsp; →</Link></div><PublicListingGrid listings={selection} /></section> : null}
      <section className="mx-auto max-w-7xl border-t public-rule px-5 py-12 lg:px-8 lg:py-14"><div className="mb-5 flex items-end justify-between gap-4"><div><p className="editorial-kicker !text-orange-500">Recién publicados</p><h2 className="mt-1 text-xl font-bold tracking-tight">Nuevas publicaciones</h2></div><Link href="/autos" className="text-[11px] font-semibold text-zinc-500 transition-colors hover:text-white">Explorar catálogo&nbsp; →</Link></div>{listings.length ? <PublicListingGrid listings={listings.slice(0, 8)} /> : <p className="border border-dashed border-white/15 p-6 text-sm text-zinc-500">Aún no hay publicaciones disponibles.</p>}</section>
    </main>
  );
}
