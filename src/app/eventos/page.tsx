import type { Metadata } from "next";

export const metadata: Metadata = { title: "Eventos", description: "Próximamente, encuentros y experiencias de driven-mx." };

export default function EventosPage() {
  return <main className="grid min-h-[70vh] flex-1 place-items-center bg-zinc-950 px-5 text-white"><section className="w-full max-w-3xl border-l border-orange-500 py-5 pl-6 sm:pl-10"><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-orange-500">Próximamente</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">Eventos</h1><p className="mt-5 max-w-lg text-base leading-7 text-zinc-400">Encuentros, rutas y experiencias para descubrir autos en persona. Esta sección se habilitará posteriormente.</p></section></main>;
}
