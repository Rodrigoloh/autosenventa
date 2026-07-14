import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ListingForm } from "@/components/listing-form";
import { requireUser } from "@/lib/auth";
import { LISTING_STATUS_LABELS } from "@/lib/listing-display";
import { EDITABLE_LISTING_STATUSES } from "@/lib/listing-validation";
import { createClient } from "@/lib/supabase/server";
import type { ListingStatus } from "@/lib/constants";

const listingFields = "id,category_id,brand_id,model_id,variant,year,city,state_region,price_mxn,mileage_km,exterior_color,interior_color,body_style,transmission,drivetrain,fuel_type,engine,owner_description,ownership_history,maintenance_history,modifications,known_issues,sale_reason,status";

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("listings").select(listingFields).eq("id", id).eq("owner_id", viewer.id).maybeSingle();
  if (!data) notFound();

  const status = data.status as ListingStatus;
  if (!EDITABLE_LISTING_STATUSES.includes(status as (typeof EDITABLE_LISTING_STATUSES)[number])) {
    return (
      <section className="max-w-2xl border-y py-12">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">{LISTING_STATUS_LABELS[status]}</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Este anuncio no se puede editar</h1>
        <p className="mt-4 leading-7 text-stone-600">Sólo los borradores y los anuncios con cambios solicitados admiten modificaciones del propietario.</p>
        <Link href={`/cuenta/anuncios/${id}/vista-previa`} className="mt-8 inline-flex bg-stone-950 px-5 py-3 text-sm font-bold text-white hover:bg-accent">Abrir vista previa</Link>
      </section>
    );
  }

  const [{ data: categories }, { data: brands }, { data: models }] = await Promise.all([
    supabase.from("categories").select("id,name").eq("active", true).order("name"),
    supabase.from("brands").select("id,name").eq("active", true).order("name"),
    supabase.from("models").select("id,brand_id,name").eq("active", true).order("name"),
  ]);

  return (
    <section>
      <div className="border-b pb-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">{LISTING_STATUS_LABELS[status]}</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Datos del vehículo</h1>
        <p className="mt-3 max-w-2xl leading-7 text-stone-600">Guarda tu avance cuando quieras. El anuncio sigue siendo privado y su estado no cambiará.</p>
      </div>
      <ListingForm listing={data} categories={categories ?? []} brands={brands ?? []} models={models ?? []} />
    </section>
  );
}
