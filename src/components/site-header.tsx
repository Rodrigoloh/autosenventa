import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export function SiteHeader() {
  return (
    <header className="border-b bg-stone-50/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/" className="text-xl font-black uppercase tracking-[-0.04em]">
          {SITE_NAME}
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-5 text-sm font-medium">
          <Link href="/autos" className="hover:text-accent">Autos</Link>
          <Link href="/login" className="hover:text-accent">Ingresar</Link>
        </nav>
      </div>
    </header>
  );
}
