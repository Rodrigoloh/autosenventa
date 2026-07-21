import Link from "next/link";
import { notFound } from "next/navigation";
import { usernameSchema } from "@/lib/auth-validation";
import { formatMxn } from "@/lib/listing-display";
import { createClient } from "@/lib/supabase/server";

type PublicProfile = { username: string; display_name: string | null; joined_at: string };
type PublicListing = { id: string; slug: string | null; title: string; year: number | null; price_mxn: number | string | null };

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const raw = (await params).username;
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) notFound();
  const supabase = await createClient();
  const [profileResult, listingsResult] = await Promise.all([
    supabase.rpc("get_public_profile", { target_username: parsed.data }).maybeSingle(),
    supabase.rpc("get_public_profile_listings", { target_username: parsed.data }),
  ]);
  if (!profileResult.data) notFound();
  const profile = profileResult.data as PublicProfile;
  const listings = (listingsResult.data ?? []) as PublicListing[];
  return <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-14"><p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Perfil público</p><h1 className="mt-3 text-5xl font-black">@{profile.username}</h1>{profile.display_name ? <p className="mt-3 text-xl text-stone-700">{profile.display_name}</p> : null}<p className="mt-2 text-sm text-stone-500">En Garage desde {new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(new Date(profile.joined_at))}</p><section className="mt-12 border-t pt-8"><h2 className="text-2xl font-black">Autos publicados</h2>{listings.length ? <div className="mt-5 divide-y">{listings.map((listing) => <article key={listing.id} className="flex items-center justify-between gap-4 py-5"><div><h3 className="text-xl font-black">{listing.title}</h3><p>{listing.year ?? "Año sin especificar"} · {formatMxn(listing.price_mxn)}</p></div>{listing.slug ? <Link href={`/autos/${listing.slug}`} className="font-bold underline">Ver auto</Link> : null}</article>)}</div> : <p className="mt-4 text-stone-600">Este usuario todavía no tiene autos publicados.</p>}</section></main>;
}
