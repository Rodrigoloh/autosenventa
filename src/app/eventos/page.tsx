import type { Metadata } from "next";

export const metadata: Metadata = { title: "Eventos", description: "Próximamente, encuentros y experiencias de driven-mx." };

export default function EventosPage() {
  return <main className="public-shell relative grid min-h-[72vh] flex-1 place-items-center overflow-hidden px-5"><div className="driven-halftone absolute right-0 top-0 h-full w-1/4 opacity-15" aria-hidden="true" /><section className="relative w-full max-w-5xl border-y public-rule py-12 sm:py-16"><div className="max-w-2xl border-l-2 border-orange-500 pl-6 sm:pl-10"><p className="editorial-kicker !text-orange-500">Próximamente</p><h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">Eventos</h1><p className="mt-5 max-w-lg text-base leading-7 text-zinc-400">Encuentros, rutas y experiencias para descubrir autos en persona. Esta sección se habilitará posteriormente.</p></div></section></main>;
}
