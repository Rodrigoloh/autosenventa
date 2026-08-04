import Link from "next/link";
import { Search } from "lucide-react";
import { DrivenWordmark } from "@/components/driven-wordmark";
import { UserMenu } from "@/components/user-menu";
import { getViewer } from "@/lib/auth";

export async function SiteHeader() {
  const viewer = await getViewer();
  const sellHref = viewer ? "/cuenta/anuncios/nuevo" : "/login?next=%2Fcuenta%2Fanuncios%2Fnuevo";
  return (
    <header className="public-shell relative z-30 border-b public-rule">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 px-5 py-4 lg:flex-nowrap lg:px-8">
        <DrivenWordmark className="shrink-0 text-[1.55rem]" />
        <nav aria-label="Principal" className="order-3 mt-3 flex w-full items-center justify-between border-t public-rule pt-3 text-[11px] font-semibold sm:justify-start sm:gap-7 lg:order-none lg:mt-0 lg:w-auto lg:border-0 lg:pt-0">
          <Link href="/autos" className="py-1 text-zinc-300 transition-colors hover:text-white">Explorar</Link>
          <Link href="/eventos" className="py-1 text-zinc-300 transition-colors hover:text-white">Eventos</Link>
          <Link href={sellHref} className="py-1 font-bold text-orange-400 transition-colors hover:text-orange-300 lg:hidden">Vende tu auto</Link>
        </nav>
        <form action="/autos" role="search" className="order-4 mt-3 flex h-10 w-full min-w-0 items-center border public-rule bg-zinc-900/80 lg:order-none lg:mt-0 lg:max-w-xl lg:flex-1">
          <Search className="ml-3 size-4 shrink-0 text-zinc-500" aria-hidden="true" />
          <label className="sr-only" htmlFor="global-search">Buscar autos</label>
          <input id="global-search" name="q" placeholder="Buscar marca, modelo o palabra clave" className="h-full min-w-0 flex-1 bg-transparent px-3 text-xs text-white outline-none placeholder:text-zinc-600" />
          <button className="h-full border-l public-rule px-4 text-[10px] font-bold uppercase tracking-wider text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white">Buscar</button>
        </form>
        <Link href={sellHref} className="hidden shrink-0 text-xs font-bold text-orange-400 transition-colors hover:text-orange-300 lg:inline">Vende tu auto</Link>
        <div className="ml-auto shrink-0 text-xs font-semibold lg:ml-0">
          {!viewer
            ? <Link href="/login" className="border-b border-zinc-600 pb-1 text-zinc-200 transition-colors hover:border-orange-400 hover:text-orange-400">Ingresar</Link>
            : <UserMenu username={viewer.username ?? null} displayName={viewer.display_name ?? null} role={viewer.role} />}
        </div>
      </div>
    </header>
  );
}
