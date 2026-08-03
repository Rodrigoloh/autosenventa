import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicListingGrid } from "@/components/public-listing-grid";
import { usernameSchema } from "@/lib/auth-validation";
import { getViewer } from "@/lib/auth";
import { getPublicListingPhotos } from "@/lib/listing-media";
import type { PublicListingSummary } from "@/lib/public-marketplace";
import { createClient } from "@/lib/supabase/server";

type PublicProfile = { username: string; display_name: string | null; joined_at: string };
type ProfileListing = { id: string; slug: string | null; title: string; year: number | null; price_mxn: number | string | null; city: string | null };

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const raw = (await params).username;
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) notFound();
  const supabase = await createClient();
  const [profileResult, listingsResult, viewer] = await Promise.all([
    supabase.rpc("get_public_profile", { target_username: parsed.data }).maybeSingle(),
    supabase.rpc("get_public_profile_listings", { target_username: parsed.data }),
    getViewer(),
  ]);
  if (!profileResult.data) notFound();
  const profile = profileResult.data as PublicProfile;
  const staffProfile = viewer && ["staff", "admin"].includes(viewer.role)
    ? await supabase.from("profiles").select("id").eq("username", profile.username).maybeSingle()
    : null;
  const listings = (listingsResult.data ?? []) as ProfileListing[];
  const publicListings = await Promise.all(listings.map(async (listing) => {
    const photos = await getPublicListingPhotos(listing.id);
    return {
      id: listing.id,
      title: listing.title,
      year: listing.year,
      variant: null,
      priceMxn: listing.price_mxn,
      mileageKm: null,
      city: listing.city,
      stateRegion: null,
      isFeatured: false,
      featuredOrder: null,
      publishedAt: null,
      brandName: null,
      modelName: null,
      photos: (photos ?? []).filter((photo) => photo.signedUrl).map((photo) => ({
        id: photo.id,
        url: photo.signedUrl,
        width: photo.width,
        height: photo.height,
        sortOrder: photo.sortOrder,
        isCover: photo.isCover,
      })),
    } satisfies PublicListingSummary;
  }));

  return <main className="public-shell min-w-0 flex-1">
    <div className="mx-auto w-full max-w-7xl px-5 py-10 lg:px-8 lg:py-16">
      {staffProfile?.data ? <aside className="mb-7 flex flex-wrap items-center justify-between gap-3 border public-rule public-raised px-4 py-3 text-xs" aria-label="Navegación staff"><span className="font-semibold text-zinc-400">Vista pública</span><Link href={`/staff/usuarios/${staffProfile.data.id}`} className="font-bold text-zinc-100 underline underline-offset-4 hover:text-orange-400">Abrir perfil en staff</Link></aside> : null}
      <header className="relative overflow-hidden border-y public-rule py-12 sm:py-16">
        <div className="driven-halftone absolute right-0 top-0 h-full w-1/4 opacity-15" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <p className="editorial-kicker">Autos presentados por</p>
          <h1 className="mt-4 break-words text-4xl font-bold tracking-[-0.05em] sm:text-6xl">@{profile.username}</h1>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-400">
            {profile.display_name ? <p className="font-semibold text-zinc-200">{profile.display_name}</p> : null}
            <p className="font-mono text-[10px] uppercase tracking-wider">En driven-mx desde {new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(new Date(profile.joined_at))}</p>
          </div>
        </div>
      </header>
      <section className="py-16 lg:py-20">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-4"><div><p className="editorial-kicker !text-orange-500">Garage público</p><h2 className="mt-2 text-2xl font-bold tracking-tight">Autos publicados</h2></div><p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{publicListings.length} {publicListings.length === 1 ? "publicación" : "publicaciones"}</p></div>
        {publicListings.length ? <PublicListingGrid listings={publicListings} /> : <p className="border-y public-rule py-10 text-sm text-zinc-500">Este usuario todavía no tiene autos publicados.</p>}
      </section>
    </div>
  </main>;
}
