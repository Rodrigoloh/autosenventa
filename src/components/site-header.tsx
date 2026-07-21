import Link from "next/link";
import { signOut } from "@/app/auth-actions";
import { getViewer } from "@/lib/auth";
import { SITE_NAME } from "@/lib/constants";

export async function SiteHeader() {
  const viewer = await getViewer();
  const roleLabel = viewer?.role === "user" ? "Usuario" : viewer?.role === "staff" ? "Staff" : "Admin";
  return (
    <header className="border-b bg-stone-50/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/" className="text-xl font-black uppercase tracking-[-0.04em]">
          {SITE_NAME}
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-5 text-sm font-medium">
          <Link href="/autos" className="hover:text-accent">Autos</Link>
          {!viewer ? <Link href="/login" className="hover:text-accent">Ingresar</Link> : <details className="relative"><summary className="flex cursor-pointer list-none items-center gap-2 font-bold"><span className="grid size-9 place-items-center rounded-full bg-stone-950 text-white">{(viewer.username ?? viewer.display_name ?? "U").slice(0, 1).toUpperCase()}</span><span className="hidden sm:inline">{viewer.username ? `@${viewer.username}` : viewer.display_name || "Mi cuenta"}</span></summary><div className="absolute right-0 z-20 mt-2 w-60 border bg-white p-4 shadow-lg"><p className="font-black">{viewer.username ? `@${viewer.username}` : "Usuario sin username"}</p>{viewer.display_name ? <p className="text-sm text-stone-600">{viewer.display_name}</p> : null}<p className="mt-1 text-xs font-bold uppercase text-stone-500">{roleLabel}</p><div className="mt-4 flex flex-col gap-2"><Link href="/cuenta" className="hover:text-accent">Mi cuenta</Link>{viewer.role !== "user" ? <Link href="/staff" className="hover:text-accent">Panel staff</Link> : null}<form action={signOut}><button className="font-medium hover:text-accent">Cerrar sesión</button></form></div></div></details>}
        </nav>
      </div>
    </header>
  );
}
