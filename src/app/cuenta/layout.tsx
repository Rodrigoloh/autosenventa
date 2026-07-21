import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <AppShell
      title="Mi cuenta"
      nav={[{ href: "/cuenta", label: "Mi cuenta" }, { href: "/cuenta/anuncios", label: "Mis anuncios" }]}
      action={<Link href="/cuenta/anuncios/nuevo" className="inline-flex min-h-11 w-full items-center justify-center bg-stone-950 px-4 py-3 text-sm font-bold text-white hover:bg-accent">Crear anuncio</Link>}
    >
      {children}
    </AppShell>
  );
}
