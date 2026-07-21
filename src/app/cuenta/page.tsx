import Link from "next/link";
import { CompleteProfileForm } from "@/components/complete-profile-form";
import { requireUser } from "@/lib/auth";

export default async function AccountPage() {
  const viewer = await requireUser();
  return <>
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Cuenta</p>
    <h1 className="mt-3 text-4xl font-black tracking-tight">Hola{viewer.display_name ? `, ${viewer.display_name}` : ""}</h1>
    <p className="mt-4 text-stone-600">Administra tus borradores y revisa cómo se verá la información que proporcionaste.</p>
    <dl className="mt-6 grid max-w-xl gap-3 border-y py-5 text-sm"><div><dt className="font-bold">Username</dt><dd>{viewer.username ? `@${viewer.username}` : "Usuario sin username"}</dd></div><div><dt className="font-bold">Correo privado</dt><dd>{viewer.email ?? "No disponible"}</dd></div><div><dt className="font-bold">Rol</dt><dd>{viewer.role === "user" ? "Usuario" : viewer.role === "staff" ? "Staff" : "Admin"}</dd></div></dl>
    {!viewer.username ? <CompleteProfileForm /> : null}
    <div className="mt-8 flex flex-wrap gap-3">
      <Link href="/cuenta/anuncios" className="bg-stone-950 px-5 py-3 text-sm font-bold text-white hover:bg-accent">Mis anuncios</Link>
    </div>
  </>;
}
