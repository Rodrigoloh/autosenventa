import Link from "next/link";
import { getViewer } from "@/lib/auth";

export const metadata = { title: "Nosotros" };

export default async function NosotrosPage() {
  const viewer = await getViewer();
  const sellHref = viewer ? "/cuenta/anuncios/nuevo" : "/login?next=%2Fcuenta%2Fanuncios%2Fnuevo";
  return <main className="public-shell flex-1"><div className="mx-auto max-w-5xl px-5 py-16 lg:px-8 lg:py-24">
    <p className="editorial-kicker !text-orange-500">drvn.mx</p>
    <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-[-0.045em] text-white sm:text-6xl">Un lugar para descubrir y publicar autos interesantes.</h1>
    <div className="mt-16 grid gap-10 border-t public-rule pt-10 md:grid-cols-3">
      <section><h2 className="text-lg font-bold text-white">Qué es</h2><p className="mt-3 text-sm leading-6 text-zinc-500">Un marketplace público centrado en la fotografía, la historia y los datos esenciales de cada auto.</p></section>
      <section id="vendedores"><h2 className="text-lg font-bold text-white">Vendedores</h2><p className="mt-3 text-sm leading-6 text-zinc-500">Publica la información de tu auto, agrega fotografías y envíalo a revisión desde un flujo privado.</p><Link href={sellHref} className="mt-5 inline-flex text-sm font-semibold text-orange-400 hover:text-orange-300">Comenzar publicación →</Link></section>
      <section id="ayuda"><h2 className="text-lg font-bold text-white">Ayuda</h2><p className="mt-3 text-sm leading-6 text-zinc-500">¿Tienes una pregunta sobre una publicación o tu cuenta?</p><a href="mailto:ayuda@drvn.mx" className="mt-5 inline-flex text-sm font-semibold text-orange-400 hover:text-orange-300">ayuda@drvn.mx</a></section>
    </div>
    <section id="seguridad" className="mt-12 border-t public-rule pt-10"><h2 className="text-lg font-bold text-white">Seguridad</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">Verifica personalmente la identidad, documentación y estado del vehículo antes de realizar cualquier operación.</p></section>
  </div></main>;
}
