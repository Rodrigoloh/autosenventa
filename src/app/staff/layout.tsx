import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRole(["staff", "admin"]);
  const nav = [{ href: "/staff", label: "Resumen" }, { href: "/staff/anuncios", label: "Revisión" }, { href: "/staff/taxonomia", label: "Taxonomía" }];
  if (viewer.role === "admin") nav.push({ href: "/staff/usuarios", label: "Usuarios" });
  return <AppShell title="Staff" nav={nav}>{children}</AppShell>;
}
