import Link from "next/link";
import { Search } from "lucide-react";
import { DrivenWordmark } from "@/components/driven-wordmark";
import { UserMenu } from "@/components/user-menu";
import { getViewer } from "@/lib/auth";

export async function SiteHeader() {
  const viewer = await getViewer();
  const sellHref = viewer ? "/cuenta/anuncios/nuevo" : "/login?next=%2Fcuenta%2Fanuncios%2Fnuevo";
  return (
    <header className="public-shell relative z-30">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 lg:flex-nowrap lg:px-8 lg:py-5">
        <DrivenWordmark className="w-[9.25rem] shrink-0 sm:w-[10.5rem]" />
        <nav aria-label="Principal" className="order-3 flex w-full items-center gap-5 overflow-x-auto border-t public-rule pt-3 text-[11px] font-semibold sm:gap-7 lg:order-none lg:w-auto lg:overflow-visible lg:border-0 lg:pt-0">
          <Link href="/autos" className="py-1 text-zinc-300 transition-colors hover:text-white">Explorar</Link>
          <Link href="/eventos" className="py-1 text-zinc-300 transition-colors hover:text-white">Eventos</Link>
          <Link href="/nosotros" className="py-1 text-zinc-300 transition-colors hover:text-white">Nosotros</Link>
          <Link href={sellHref} className="inline-flex min-h-9 shrink-0 items-center rounded-md bg-orange-600 px-4 font-bold text-white transition-colors hover:bg-orange-500">Vende tu auto</Link>
        </nav>
        <div className="order-4 flex w-full items-center gap-2.5 lg:order-none lg:ml-auto lg:w-auto">
        <form action="/autos" role="search" className="flex h-9 min-w-0 flex-1 items-center rounded-md border public-rule bg-black/20 sm:max-w-64 lg:w-56 lg:flex-none xl:w-64">
          <Search className="ml-3 size-4 shrink-0 text-zinc-500" aria-hidden="true" />
          <label className="sr-only" htmlFor="global-search">Buscar autos</label>
          <input id="global-search" name="q" placeholder="Buscar autos" className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-xs text-white outline-none placeholder:text-zinc-600" />
          <button aria-label="Buscar" className="grid h-full w-9 shrink-0 place-items-center border-l public-rule text-zinc-400 transition-colors hover:text-white"><Search className="size-3.5" aria-hidden="true" /></button>
        </form>
        <div className="shrink-0 text-xs font-semibold">
          {!viewer
            ? <Link href="/login" className="inline-flex min-h-9 items-center rounded-md border border-white/15 px-3 text-zinc-200 transition-colors hover:border-orange-400 hover:text-white">Ingresar</Link>
            : <UserMenu username={viewer.username ?? null} displayName={viewer.display_name ?? null} role={viewer.role} />}
        </div>
        </div>
      </div>
    </header>
  );
}
