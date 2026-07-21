import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/listing-display";
import { createClient } from "@/lib/supabase/server";

type UserRow = { id: string; username: string | null; display_name: string | null; created_at: string };

export default async function UsersPage() {
  await requireRole(["staff", "admin"]);
  const supabase = await createClient();
  const [profiles, listings] = await Promise.all([
    supabase.from("profiles").select("id,username,display_name,created_at").order("created_at", { ascending: false }),
    supabase.from("listings").select("owner_id"),
  ]);
  const users = (profiles.data ?? []) as UserRow[];
  const counts = (listings.data ?? []).reduce<Record<string, number>>((result, listing) => ({ ...result, [listing.owner_id]: (result[listing.owner_id] ?? 0) + 1 }), {});
  return <><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Staff</p><h1 className="mt-3 text-4xl font-black">Usuarios</h1><div className="mt-8 divide-y border-y">{users.map((user) => <article key={user.id} className="flex flex-col justify-between gap-4 py-5 sm:flex-row sm:items-center"><div><h2 className="text-xl font-black">{user.username ? `@${user.username}` : "Usuario sin username"}</h2>{user.display_name ? <p>{user.display_name}</p> : null}<p className="mt-1 text-sm text-stone-500">Alta {formatDate(user.created_at)} · {counts[user.id] ?? 0} anuncios</p></div><Link href={`/staff/usuarios/${user.id}`} className="font-bold underline">Ver usuario</Link></article>)}</div></>;
}
