import Link from "next/link";
import { DrivenWordmark } from "@/components/driven-wordmark";
import { UserMenu } from "@/components/user-menu";
import { getViewer } from "@/lib/auth";

export async function SiteHeader() {
  const viewer = await getViewer();
  const sellHref = viewer ? "/cuenta/anuncios/nuevo" : "/login?next=%2Fcuenta%2Fanuncios%2Fnuevo";
  return (
    <header className="public-shell relative z-30 border-b public-rule">
      <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-x-8 px-5 py-5 lg:min-h-22 lg:flex-nowrap lg:px-8">
        <div className="relative py-1">
          <div className="driven-halftone absolute -inset-x-3 -inset-y-2 opacity-25" aria-hidden="true" />
          <DrivenWordmark className="text-[1.7rem] sm:text-[2rem]" />
        </div>
        <nav aria-label="Principal" className="order-3 mt-5 grid w-full grid-cols-4 items-center border-t public-rule pt-4 text-center text-[11px] font-semibold sm:text-xs lg:order-none lg:mt-0 lg:flex lg:w-auto lg:gap-8 lg:border-0 lg:pt-0">
          <Link href="/autos" className="py-1 text-zinc-300 transition-colors hover:text-white">Explorar</Link>
          <Link href="/autos#buscar" className="py-1 text-zinc-300 transition-colors hover:text-white">Buscar</Link>
          <Link href="/eventos" className="py-1 text-zinc-300 transition-colors hover:text-white">Eventos</Link>
          <Link href={sellHref} className="py-1 font-bold text-orange-400 transition-colors hover:text-orange-300">Vende tu auto</Link>
        </nav>
        <div className="text-xs font-semibold">
          {!viewer
            ? <Link href="/login" className="border-b border-zinc-600 pb-1 text-zinc-200 transition-colors hover:border-orange-400 hover:text-orange-400">Ingresar</Link>
            : <UserMenu username={viewer.username ?? null} displayName={viewer.display_name ?? null} role={viewer.role} />}
        </div>
      </div>
    </header>
  );
}
