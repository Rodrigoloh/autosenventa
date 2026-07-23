import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { StaffListingView } from "@/lib/staff-listing-views";
import { staffListingViewHref } from "@/lib/staff-listing-views";

type DashboardCard = { label: string; count: number; href: string };

export default async function StaffPage() {
  const viewer = await requireRole(["staff", "admin"]);
  const supabase = await createClient();
  const countStatus = (status: string) => supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", status);
  const [pending, inReview, mine, changes, published, users] = await Promise.all([
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "submitted").is("reviewer_id", null),
    countStatus("in_review"),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "in_review").eq("reviewer_id", viewer.id),
    countStatus("changes_requested"),
    countStatus("published"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);
  const listingCard = (label: string, count: number | null, view: StaffListingView): DashboardCard => ({
    label, count: count ?? 0, href: staffListingViewHref(view),
  });
  const cards: DashboardCard[] = [
    listingCard("Pendientes de revisión", pending.count, "pending"),
    listingCard("En revisión", inReview.count, "in-review"),
    listingCard("Mis revisiones activas", mine.count, "mine"),
    listingCard("Cambios solicitados", changes.count, "changes-requested"),
    listingCard("Publicados", published.count, "published"),
    { label: "Usuarios registrados", count: users.count ?? 0, href: "/staff/usuarios" },
  ];

  return <>
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Panel editorial</p>
    <h1 className="mt-3 text-4xl font-black tracking-tight">Resumen</h1>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className="group block border p-5 transition hover:border-accent hover:bg-stone-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <p className="text-sm font-bold text-stone-600 group-hover:text-accent">{card.label}</p>
          <p className="mt-2 text-4xl font-black">{card.count}</p>
        </Link>
      ))}
    </div>
    <div className="mt-8 flex flex-wrap gap-3">
      <Link href="/staff/anuncios" className="bg-stone-950 px-5 py-3 text-sm font-bold text-white">Todas las revisiones</Link>
      <Link href="/staff/taxonomia" className="border px-5 py-3 text-sm font-bold">Taxonomía</Link>
      <Link href="/cuenta" className="border px-5 py-3 text-sm font-bold">Mi cuenta</Link>
    </div>
  </>;
}
