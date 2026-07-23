import Link from "next/link";
import { CompleteProfileForm } from "@/components/complete-profile-form";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/listing-display";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AccountUpdate = {
  id: string;
  title: string;
  status: "changes_requested" | "approved" | "published" | "rejected";
};

type ReviewDecision = {
  listing_id: string;
  created_at: string;
};

export default async function AccountPage() {
  const viewer = await requireUser();
  const supabase = await createClient();
  const { data: updatesData } = await supabase
    .from("listings")
    .select("id,title,status")
    .eq("owner_id", viewer.id)
    .in("status", ["changes_requested", "approved", "published", "rejected"])
    .order("updated_at", { ascending: false });
  const updates = (updatesData ?? []) as AccountUpdate[];
  const { data: decisionsData } = updates.length
    ? await supabase
      .from("listing_review_decisions")
      .select("listing_id,created_at")
      .in("listing_id", updates.map((listing) => listing.id))
      .order("created_at", { ascending: false })
    : { data: [] as ReviewDecision[] };
  const decisionDates = new Map<string, string>();
  for (const decision of (decisionsData ?? []) as ReviewDecision[]) {
    if (!decisionDates.has(decision.listing_id)) decisionDates.set(decision.listing_id, decision.created_at);
  }

  return <>
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Cuenta</p>
    <h1 className="mt-3 text-4xl font-black tracking-tight">Hola{viewer.display_name ? `, ${viewer.display_name}` : ""}</h1>
    <p className="mt-4 text-stone-600">Administra tus borradores y revisa cómo se verá la información que proporcionaste.</p>
    <dl className="mt-6 grid max-w-xl gap-3 border-y py-5 text-sm"><div><dt className="font-bold">Username</dt><dd>{viewer.username ? `@${viewer.username}` : "Usuario sin username"}</dd></div><div><dt className="font-bold">Correo privado</dt><dd>{viewer.email ?? "No disponible"}</dd></div><div><dt className="font-bold">Rol</dt><dd>{viewer.role === "user" ? "Usuario" : viewer.role === "staff" ? "Staff" : "Admin"}</dd></div></dl>
    {!viewer.username ? <CompleteProfileForm /> : null}
    <section className="mt-10 border-t pt-8" aria-labelledby="listing-updates-heading">
      <h2 id="listing-updates-heading" className="text-2xl font-black tracking-tight">Actualizaciones de tus anuncios</h2>
      {updates.length ? (
        <div className="mt-5 divide-y border-y">
          {updates.map((listing) => {
            const decisionDate = decisionDates.get(listing.id);
            return (
              <article key={listing.id} className="py-5">
                <p className="font-black">{listing.status === "changes_requested" ? "Tu anuncio requiere cambios." : listing.status === "published" ? "Tu anuncio ya está publicado." : listing.status === "approved" ? "Tu anuncio fue aprobado y está pendiente de publicación." : "Tu anuncio fue rechazado."}</p>
                <p className="mt-1 text-sm font-semibold text-stone-700">{listing.title}</p>
                {listing.status === "published" ? <p className="mt-2 text-sm text-stone-600">Tu anuncio ya está visible en el marketplace.</p> : null}
                {decisionDate ? <p className="mt-2 text-xs text-stone-500">Decisión del {formatDate(decisionDate)}</p> : null}
                <Link href={listing.status === "published" ? `/autos/${listing.id}` : `/cuenta/anuncios/${listing.id}/${listing.status === "changes_requested" ? "editar" : "vista-previa"}`} className="mt-3 inline-flex min-h-11 items-center font-bold underline">
                  {listing.status === "changes_requested" ? "Editar y corregir" : listing.status === "published" ? "Ver publicación" : listing.status === "approved" ? "Ver anuncio" : "Ver motivo"}
                </Link>
              </article>
            );
          })}
        </div>
      ) : <p className="mt-4 text-sm text-stone-600">No tienes actualizaciones de revisión pendientes.</p>}
    </section>
    <div className="mt-8 flex flex-wrap gap-3">
      <Link href="/cuenta/anuncios" className="bg-stone-950 px-5 py-3 text-sm font-bold text-white hover:bg-accent">Mis anuncios</Link>
    </div>
  </>;
}
