import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatDate, formatMxn } from "@/lib/listing-display";
import { createClient } from "@/lib/supabase/server";

type QueueListing = {
  id: string; title: string; year: number | null; city: string | null; state_region: string | null;
  price_mxn: number | string | null; submitted_at: string | null;
  brands: { name: string } | null; models: { name: string } | null;
  listing_media: Array<{ count: number }>;
};

function age(value: string | null) {
  if (!value) return "fecha desconocida";
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000));
  return hours < 24 ? `hace ${hours || 1} h` : `hace ${Math.floor(hours / 24)} d`;
}

function QueueSection({ title, items }: { title: string; items: QueueListing[] }) {
  return <section className="mt-10"><h2 className="text-2xl font-black tracking-tight">{title}</h2>{items.length ? <div className="mt-4 divide-y border-y">{items.map((item) => <article key={item.id} className="grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><h3 className="text-xl font-black">{item.title}</h3><p className="mt-1 text-sm text-stone-600">{[item.year, item.brands?.name, item.models?.name].filter(Boolean).join(" · ")} · {[item.city, item.state_region].filter(Boolean).join(", ")}</p><p className="mt-2 text-sm font-semibold">{formatMxn(item.price_mxn)} · {item.listing_media[0]?.count ?? 0} fotos</p><p className="mt-1 text-xs text-stone-500">Enviado {item.submitted_at ? formatDate(item.submitted_at) : "sin fecha"} · {age(item.submitted_at)}</p></div><Link className="border px-4 py-2 text-sm font-bold hover:border-accent hover:text-accent" href={`/staff/anuncios/${item.id}`}>Abrir detalle</Link></article>)}</div> : <p className="mt-4 border border-dashed p-6 text-sm text-stone-600">No hay anuncios en esta sección.</p>}</section>;
}

export default async function ReviewQueuePage() {
  const viewer = await requireRole(["staff", "admin"]);
  const supabase = await createClient();
  const fields = "id,title,year,city,state_region,price_mxn,submitted_at,brands(name),models(name),listing_media(count)";
  const [pending, mine] = await Promise.all([
    supabase.from("listings").select(fields).eq("status", "submitted").order("submitted_at", { ascending: true }),
    supabase.from("listings").select(fields).eq("status", "in_review").eq("reviewer_id", viewer.id).order("review_started_at", { ascending: false }),
  ]);
  return <><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Panel editorial</p><h1 className="mt-3 text-4xl font-black tracking-tight">Cola de revisión</h1><QueueSection title="Pendientes de tomar" items={(pending.data ?? []) as unknown as QueueListing[]} /><QueueSection title="Mis revisiones" items={(mine.data ?? []) as unknown as QueueListing[]} /></>;
}
