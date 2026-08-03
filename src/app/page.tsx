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
    <main className="min-w-0 flex-1 bg-zinc-950 text-white">
      {highlights.length ? <FeaturedListings listings={highlights} /> : <section className="grid min-h-[34rem] place-items-center bg-[radial-gradient(circle_at_70%_30%,#26342c,transparent_35%),linear-gradient(135deg,#18181b,#09090b)] px-5 text-center"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-400">Selección driven-mx</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Los próximos autos están por llegar.</h1></div></section>}
      <section className="border-y border-white/10 bg-zinc-900 px-5 py-7 lg:px-8">
        <form action="/autos" role="search" className="mx-auto grid max-w-7xl gap-3 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
          <label className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">Marca<input name="marca" placeholder="Porsche" className="mt-2 h-12 w-full border border-white/15 bg-black px-4 text-sm font-normal normal-case tracking-normal text-white placeholder:text-zinc-600" /></label>
          <label className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">Modelo<input name="modelo" placeholder="911" className="mt-2 h-12 w-full border border-white/15 bg-black px-4 text-sm font-normal normal-case tracking-normal text-white placeholder:text-zinc-600" /></label>
          <label className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">Buscar<input name="q" placeholder="Convertible manual en Guadalajara" className="mt-2 h-12 w-full border border-white/15 bg-black px-4 text-sm font-normal normal-case tracking-normal text-white placeholder:text-zinc-600" /></label>
          <button className="h-12 bg-orange-600 px-7 text-sm font-bold text-white hover:bg-orange-500">Explorar autos</button>
        </form>
      </section>
      {selection.length ? <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8"><div className="mb-7 flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Curaduría</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Destacados / selección</h2></div><Link href="/autos?orden=newest" className="text-sm font-semibold text-zinc-300 hover:text-orange-400">Ver todos →</Link></div><PublicListingGrid listings={selection} /></section> : null}
      <section className="mx-auto max-w-7xl border-t border-white/10 px-5 py-16 lg:px-8"><div className="mb-7 flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500">Recién publicados</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Nuevas publicaciones</h2></div><Link href="/autos" className="text-sm font-semibold text-zinc-300 hover:text-orange-400">Explorar catálogo →</Link></div>{listings.length ? <PublicListingGrid listings={listings.slice(0, 8)} /> : <p className="border border-dashed border-white/15 p-8 text-zinc-400">Aún no hay publicaciones disponibles.</p>}</section>
    </main>
  );
}
