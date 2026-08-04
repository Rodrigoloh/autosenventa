import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["staff", "admin"]);
  const nav = [{ href: "/staff", label: "Resumen" }, { href: "/staff/anuncios", label: "Revisión" }, { href: "/staff/comentarios", label: "Comentarios" }, { href: "/staff/usuarios", label: "Usuarios" }, { href: "/staff/taxonomia", label: "Taxonomía" }, { href: "/cuenta", label: "Mi cuenta" }];
  return <AppShell title="Staff" nav={nav}>{children}</AppShell>;
}
