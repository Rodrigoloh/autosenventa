import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatDate, formatMxn } from "@/lib/listing-display";
import { createClient } from "@/lib/supabase/server";

type QueueListing = {
  id: string; title: string; status: "submitted" | "in_review"; reviewer_id: string | null;
  year: number | null; city: string | null; state_region: string | null; price_mxn: number | string | null;
  submitted_at: string | null; brands: { name: string } | null; models: { name: string } | null;
  reviewer: { username: string | null } | null; listing_media: Array<{ count: number }>;
};

export default async function ReviewQueuePage() {
  const viewer = await requireRole(["staff", "admin"]);
  const supabase = await createClient();
  const fields = "id,title,status,reviewer_id,year,city,state_region,price_mxn,submitted_at,brands(name),models(name),reviewer:profiles!listings_reviewer_id_fkey(username),listing_media(count)";
  const { data } = await supabase.from("listings").select(fields).in("status", ["submitted", "in_review"]).order("submitted_at", { ascending: true });
  const items = (data ?? []) as unknown as QueueListing[];
  return <><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Panel editorial</p><h1 className="mt-3 text-4xl font-black tracking-tight">Revisión</h1>{items.length ? <div className="mt-8 divide-y border-y">{items.map((item) => { const badge = item.status === "submitted" ? "Pendiente" : item.reviewer_id === viewer.id ? "En revisión · Asignado a ti" : item.reviewer?.username ? `En revisión por @${item.reviewer.username}` : "En revisión por otro miembro de staff"; return <article key={item.id} className="grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><span className="bg-stone-200 px-2.5 py-1 text-xs font-black uppercase">{badge}</span><h2 className="mt-3 text-xl font-black">{item.title}</h2><p className="mt-1 text-sm text-stone-600">{[item.year,item.brands?.name,item.models?.name].filter(Boolean).join(" · ")} · {[item.city,item.state_region].filter(Boolean).join(", ")}</p><p className="mt-2 text-sm font-semibold">{formatMxn(item.price_mxn)} · {item.listing_media[0]?.count ?? 0} fotos</p>{item.submitted_at ? <p className="mt-1 text-xs text-stone-500">Enviado {formatDate(item.submitted_at)}</p> : null}</div><Link href={`/staff/anuncios/${item.id}`} className="border px-4 py-2 text-sm font-bold hover:border-accent">{item.status === "submitted" ? "Revisar anuncio" : "Abrir revisión"}</Link></article>; })}</div> : <p className="mt-8 border border-dashed p-6 text-stone-600">No hay anuncios activos en revisión.</p>}</>;
}
