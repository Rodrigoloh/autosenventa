import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <AppShell title="Mi cuenta" nav={[{ href: "/cuenta", label: "Resumen" }, { href: "/cuenta/anuncios", label: "Mis anuncios" }, { href: "/cuenta/anuncios/nuevo", label: "Crear anuncio" }]}>{children}</AppShell>;
}
