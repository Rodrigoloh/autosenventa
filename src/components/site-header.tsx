import Link from "next/link";
import { UserMenu } from "@/components/user-menu";
import { getViewer } from "@/lib/auth";
import { SITE_NAME } from "@/lib/constants";

export async function SiteHeader() {
  const viewer = await getViewer();
  const sellHref = viewer ? "/cuenta/anuncios/nuevo" : "/login?next=%2Fcuenta%2Fanuncios%2Fnuevo";
  return (
    <header className="relative z-30 border-b border-white/10 bg-zinc-950 text-white">
      <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-x-6 px-5 py-4 lg:h-18 lg:flex-nowrap lg:px-8 lg:py-0">
        <Link href="/" className="text-xl font-black lowercase tracking-[-0.055em]">
          {SITE_NAME}
        </Link>
        <nav aria-label="Principal" className="order-3 mt-4 grid w-full grid-cols-4 items-center gap-1 border-t border-white/10 pt-3 text-center text-xs font-semibold sm:text-sm lg:order-none lg:mt-0 lg:flex lg:w-auto lg:gap-6 lg:border-0 lg:pt-0">
          <Link href="/autos" className="py-1 hover:text-orange-400">Explorar</Link>
          <Link href="/autos#buscar" className="py-1 hover:text-orange-400">Buscar</Link>
          <Link href="/eventos" className="py-1 hover:text-orange-400">Eventos</Link>
          <Link href={sellHref} className="py-1 font-bold text-orange-400 hover:text-orange-300">Vende tu auto</Link>
        </nav>
        <div className="text-sm font-medium">
          {!viewer
            ? <Link href="/login" className="hover:text-orange-400">Ingresar</Link>
            : <UserMenu username={viewer.username ?? null} displayName={viewer.display_name ?? null} role={viewer.role} />}
        </div>
      </div>
    </header>
  );
}
