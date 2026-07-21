import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { LISTING_STATUS_LABELS, formatDate } from "@/lib/listing-display";
import { createClient } from "@/lib/supabase/server";
import type { ListingStatus } from "@/lib/constants";

export default async function StaffUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["staff", "admin"]);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const [profileResult, listingsResult] = await Promise.all([
    supabase.from("profiles").select("id,username,display_name,role,created_at").eq("id", id).maybeSingle(),
    supabase.from("listings").select("id,title,status,created_at").eq("owner_id", id).order("created_at", { ascending: false }),
  ]);
  if (!profileResult.data) notFound();
  const profile = profileResult.data;
  const listings = listingsResult.data ?? [];
  const counts = listings.reduce<Record<string, number>>((result, listing) => ({ ...result, [listing.status]: (result[listing.status] ?? 0) + 1 }), {});
  return <><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Usuario</p><h1 className="mt-3 text-4xl font-black">{profile.username ? `@${profile.username}` : "Usuario sin username"}</h1>{profile.display_name ? <p className="mt-2 text-xl">{profile.display_name}</p> : null}<p className="mt-3 text-sm">Rol: <strong>{profile.role}</strong> · Alta {formatDate(profile.created_at)}</p>{profile.username ? <Link href={`/u/${profile.username}`} className="mt-4 inline-block font-bold underline">Ver perfil público</Link> : null}<div className="mt-8 flex flex-wrap gap-2">{Object.entries(counts).map(([status, count]) => <span key={status} className="bg-stone-200 px-3 py-2 text-sm font-bold">{LISTING_STATUS_LABELS[status as ListingStatus]}: {count}</span>)}</div><section className="mt-10 border-t pt-7"><h2 className="text-2xl font-black">Anuncios</h2><div className="mt-4 divide-y">{listings.map((listing) => <article key={listing.id} className="flex justify-between gap-4 py-4"><div><h3 className="font-black">{listing.title}</h3><p className="text-sm">{LISTING_STATUS_LABELS[listing.status as ListingStatus]}</p></div>{listing.status !== "draft" ? <Link href={`/staff/anuncios/${listing.id}`} className="font-bold underline">Ver detalle</Link> : null}</article>)}</div></section></>;
}
