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
      {highlights.length ? <FeaturedListings listings={highlights} /> : <section className="relative grid min-h-[30rem] place-items-center overflow-hidden px-5 text-center"><div className="driven-halftone absolute inset-y-0 right-0 w-1/3 opacity-15" /><div className="relative"><p className="editorial-kicker">Selección driven-mx</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Los próximos autos están por llegar.</h1></div></section>}
      <section className="border-y public-rule public-surface px-5 py-8 lg:px-8">
        <form action="/autos" role="search" className="mx-auto grid max-w-7xl gap-4 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
          <label className="text-[10px] font-bold uppercase tracking-[0.17em] text-zinc-500">Marca<input name="marca" placeholder="Porsche" className="public-field mt-2 h-12 w-full px-4 text-sm font-normal normal-case tracking-normal placeholder:text-zinc-600" /></label>
          <label className="text-[10px] font-bold uppercase tracking-[0.17em] text-zinc-500">Modelo<input name="modelo" placeholder="911" className="public-field mt-2 h-12 w-full px-4 text-sm font-normal normal-case tracking-normal placeholder:text-zinc-600" /></label>
          <label className="text-[10px] font-bold uppercase tracking-[0.17em] text-zinc-500">Palabra clave<input name="q" placeholder="Convertible manual en Guadalajara" className="public-field mt-2 h-12 w-full px-4 text-sm font-normal normal-case tracking-normal placeholder:text-zinc-600" /></label>
          <button className="h-12 bg-orange-600 px-7 text-sm font-bold text-white hover:bg-orange-500">Explorar autos</button>
        </form>
      </section>
      {selection.length ? <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24"><div className="mb-9 flex items-end justify-between gap-4"><div><p className="editorial-kicker">Curaduría</p><h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Destacados / selección</h2></div><Link href="/autos?orden=newest" className="text-xs font-semibold text-zinc-400 transition-colors hover:text-orange-400">Ver todos&nbsp; ↗</Link></div><PublicListingGrid listings={selection} /></section> : null}
      <section className="mx-auto max-w-7xl border-t public-rule px-5 py-20 lg:px-8 lg:py-24"><div className="mb-9 flex items-end justify-between gap-4"><div><p className="editorial-kicker !text-orange-500">Recién publicados</p><h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Nuevas publicaciones</h2></div><Link href="/autos" className="text-xs font-semibold text-zinc-400 transition-colors hover:text-orange-400">Explorar catálogo&nbsp; →</Link></div>{listings.length ? <PublicListingGrid listings={listings.slice(0, 8)} /> : <p className="border border-dashed border-white/15 p-8 text-zinc-400">Aún no hay publicaciones disponibles.</p>}</section>
    </main>
  );
}
