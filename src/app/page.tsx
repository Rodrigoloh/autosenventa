import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export default function HomePage() {
  return (
    <main className="flex-1">
      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-32">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Selección editorial</p>
        <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.055em] sm:text-7xl lg:text-8xl">
          Autos con historia, directamente de sus propietarios.
        </h1>
        <p className="mt-8 max-w-2xl text-lg leading-8 text-stone-600">
          {SITE_NAME} será un espacio curado para descubrir automóviles interesantes. El catálogo se abrirá cuando las primeras publicaciones sean revisadas.
        </p>
        <Link href="/registro" className="mt-10 inline-flex bg-stone-950 px-6 py-3.5 text-sm font-bold text-white hover:bg-accent">Crear una cuenta</Link>
      </section>
    </main>
  );
}
