"use client";

import { useActionState, useState } from "react";
import { submitListingForReviewAction, type SubmissionActionState } from "@/app/cuenta/anuncios/actions";
import { SubmitButton } from "@/components/submit-button";
import { READINESS_CATEGORIES, readinessItems } from "@/lib/listing-review";

const initialState: SubmissionActionState = { status: "idle" };
const declarations = [
  ["attest_owner_authorized", "Soy propietario del vehículo o estoy autorizado para venderlo."],
  ["attest_information_truthful", "La información proporcionada es veraz."],
  ["attest_modifications_and_issues_disclosed", "Declaré las modificaciones y los problemas conocidos."],
  ["attest_legal_documentation", "Cuento con documentación para acreditar propiedad y situación legal."],
] as const;

export function ListingSubmissionPanel({ listingId, readinessCodes }: { listingId: string; readinessCodes: string[] }) {
  const action = submitListingForReviewAction.bind(null, listingId);
  const [state, formAction] = useActionState(action, initialState);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const allAccepted = declarations.every(([name]) => accepted[name]);
  const items = readinessItems(state.readinessCodes ?? readinessCodes, !allAccepted);

  return (
    <section className="border-y py-8" aria-labelledby="submission-title">
      <h2 id="submission-title" className="text-2xl font-black tracking-tight">Preparación para revisión</h2>
      <p className="mt-2 text-sm text-stone-600">La validación definitiva se repite en servidor al enviar.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {READINESS_CATEGORIES.map((category) => {
          const missing = items.filter((item) => item.category === category);
          return <div key={category} className="border p-4"><h3 className="font-black">{category}</h3>{missing.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">{missing.map((item) => <li key={item.code}>{item.message}</li>)}</ul> : <p className="mt-2 text-sm font-bold text-emerald-700">Completo</p>}</div>;
        })}
      </div>
      <form action={formAction} className="mt-7 space-y-4">
        <fieldset><legend className="font-black">Declaraciones obligatorias</legend><div className="mt-3 space-y-3">{declarations.map(([name, label]) => <label key={name} className="flex items-start gap-3 text-sm font-semibold"><input className="mt-1" type="checkbox" name={name} value="yes" checked={Boolean(accepted[name])} onChange={(event) => setAccepted((current) => ({ ...current, [name]: event.target.checked }))} />{label}</label>)}</div></fieldset>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><SubmitButton idle="Enviar a revisión" pending="Enviando…" /><p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sm font-semibold text-red-700" : "text-sm font-semibold text-emerald-700"}>{state.message}</p></div>
      </form>
    </section>
  );
}
