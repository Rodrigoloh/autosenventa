import Link from "next/link";
import { UserMenu } from "@/components/user-menu";
import { getViewer } from "@/lib/auth";
import { SITE_NAME } from "@/lib/constants";

export async function SiteHeader() {
  const viewer = await getViewer();
  return (
    <header className="border-b bg-stone-50/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/" className="text-xl font-black uppercase tracking-[-0.04em]">
          {SITE_NAME}
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-5 text-sm font-medium">
          <Link href="/autos" className="hover:text-accent">Autos</Link>
          {!viewer
            ? <Link href="/login" className="hover:text-accent">Ingresar</Link>
            : <UserMenu username={viewer.username ?? null} displayName={viewer.display_name ?? null} role={viewer.role} />}
        </nav>
      </div>
    </header>
  );
}
