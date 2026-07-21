import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffPage() {
  const viewer = await requireRole(["staff", "admin"]);
  const supabase = await createClient();
  const countStatus = (status: string) => supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", status);
  const [submitted, inReview, changes, approved, drafts, users, mine] = await Promise.all([
    countStatus("submitted"), countStatus("in_review"), countStatus("changes_requested"), countStatus("approved"), countStatus("draft"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "in_review").eq("reviewer_id", viewer.id),
  ]);
  const cards = [["Anuncios pendientes", submitted.count], ["En revisión", inReview.count], ["Cambios solicitados", changes.count], ["Aprobados", approved.count], ["Borradores totales", drafts.count], ["Usuarios registrados", users.count], ["Mis revisiones activas", mine.count]];
  return <><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Panel editorial</p><h1 className="mt-3 text-4xl font-black tracking-tight">Resumen</h1><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([label, count]) => <div key={String(label)} className="border p-5"><p className="text-sm font-bold text-stone-600">{label}</p><p className="mt-2 text-4xl font-black">{count ?? 0}</p></div>)}</div><div className="mt-8 flex flex-wrap gap-3"><Link href="/staff/anuncios" className="bg-stone-950 px-5 py-3 text-sm font-bold text-white">Revisión</Link><Link href="/staff/usuarios" className="border px-5 py-3 text-sm font-bold">Usuarios</Link><Link href="/staff/taxonomia" className="border px-5 py-3 text-sm font-bold">Taxonomía</Link><Link href="/cuenta" className="border px-5 py-3 text-sm font-bold">Mi cuenta</Link></div></>;
}
