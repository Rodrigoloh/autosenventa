import type { Metadata } from "next";
import { CreateListingForm } from "@/components/create-listing-form";

export const metadata: Metadata = { title: "Crear anuncio", robots: { index: false, follow: false } };

export default function NewListingPage() {
  return (
    <section className="max-w-2xl border-y py-12">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Nuevo anuncio</p>
      <h1 className="mt-3 text-4xl font-black tracking-tight">Empieza con un borrador</h1>
      <p className="mt-4 leading-7 text-stone-600">Crearemos un borrador privado a tu nombre. Después podrás completar y guardar los datos del vehículo.</p>
      <CreateListingForm />
    </section>
  );
}
