import Link from "next/link";
import { requireUser } from "@/lib/auth";

export default async function AccountPage() {
  const viewer = await requireUser();
  return <>
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Cuenta</p>
    <h1 className="mt-3 text-4xl font-black tracking-tight">Hola{viewer.display_name ? `, ${viewer.display_name}` : ""}</h1>
    <p className="mt-4 text-stone-600">Administra tus borradores y revisa cómo se verá la información que proporcionaste.</p>
    <div className="mt-8 flex flex-wrap gap-3">
      <Link href="/cuenta/anuncios" className="bg-stone-950 px-5 py-3 text-sm font-bold text-white hover:bg-accent">Mis anuncios</Link>
    </div>
  </>;
}
