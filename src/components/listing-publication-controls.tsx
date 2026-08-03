"use client";

import { useActionState } from "react";
import {
  controlListingPublicationAction,
  type PublicationControlOperation,
  type PublicationControlState,
} from "@/app/staff/anuncios/actions";

const initialState: PublicationControlState = { status: "idle" };

function ConfirmedControl({
  listingId, returnView, operation, title, explanation, label, tone,
}: {
  listingId: string;
  returnView: string;
  operation: Exclude<PublicationControlOperation, "resume">;
  title: string;
  explanation: string;
  label: string;
  tone: "primary" | "danger";
}) {
  const [state, action, pending] = useActionState(
    controlListingPublicationAction.bind(null, listingId, operation), initialState,
  );
  return <details className="border p-4">
    <summary className={`cursor-pointer font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${tone === "danger" ? "text-red-900" : "text-stone-950"}`}>{title}</summary>
    <p className="mt-3 text-sm text-stone-700">{explanation}</p>
    <form action={action} className="mt-4">
      <input type="hidden" name="return_view" value={returnView} />
      <label className="block text-sm font-bold">Motivo
        <textarea name="reason" required minLength={20} maxLength={2000} rows={4} className="mt-2 w-full border p-3 font-normal" />
      </label>
      <button disabled={pending || state.status === "success"} className={`mt-3 px-5 py-3 text-sm font-bold text-white disabled:opacity-50 ${tone === "danger" ? "bg-red-800" : "bg-stone-950"}`}>
        {pending ? "Actualizando…" : label}
      </button>
      {state.message ? <p role={state.status === "error" ? "alert" : "status"} className="mt-3 text-sm font-bold">{state.message}</p> : null}
    </form>
  </details>;
}

function ResumeControl({ listingId, returnView }: { listingId: string; returnView: string }) {
  const [state, action, pending] = useActionState(
    controlListingPublicationAction.bind(null, listingId, "resume"), initialState,
  );
  return <form action={action} className="border-2 border-emerald-800 bg-emerald-50 p-5">
    <input type="hidden" name="return_view" value={returnView} />
    <h2 className="text-xl font-black">Reanudar publicación</h2>
    <p className="mt-2 text-sm text-stone-700">El anuncio volverá a ser visible con su fecha de publicación original.</p>
    <button disabled={pending || state.status === "success"} className="mt-4 bg-emerald-800 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
      {pending ? "Reanudando…" : "Reanudar publicación"}
    </button>
    {state.message ? <p role={state.status === "error" ? "alert" : "status"} className="mt-3 text-sm font-bold">{state.message}</p> : null}
  </form>;
}

export function ListingPublicationControls({ listingId, status, returnView }: { listingId: string; status: "published" | "paused"; returnView: string }) {
  if (status === "paused") return <section className="mt-7" aria-label="Controles de publicación"><ResumeControl listingId={listingId} returnView={returnView} /></section>;
  return <section className="mt-7" aria-labelledby="publication-controls-heading">
    <h2 id="publication-controls-heading" className="text-2xl font-black">Acciones de publicación</h2>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <ConfirmedControl listingId={listingId} returnView={returnView} operation="return_to_review" title="Regresar a revisión" label="Confirmar regreso a revisión" tone="primary" explanation="El anuncio dejará de ser público y volverá al flujo de moderación." />
      <ConfirmedControl listingId={listingId} returnView={returnView} operation="pause" title="Pausar publicación" label="Confirmar pausa" tone="danger" explanation="El anuncio dejará de ser visible, pero podrá reanudarse." />
    </div>
  </section>;
}
