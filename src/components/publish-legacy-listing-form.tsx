"use client";

import { useActionState } from "react";
import { publishLegacyApprovedListingAction, type LegacyPublishActionState } from "@/app/staff/anuncios/actions";

const initialState: LegacyPublishActionState = { status: "idle" };

export function PublishLegacyListingForm({ listingId, returnView }: { listingId: string; returnView: string }) {
  const [state, action, pending] = useActionState(
    publishLegacyApprovedListingAction.bind(null, listingId),
    initialState,
  );
  return <form action={action} className="mt-6 border-2 border-emerald-800 bg-emerald-50 p-5">
    <input type="hidden" name="return_view" value={returnView} />
    <h2 className="text-xl font-black">Aprobación legada</h2>
    <p className="mt-2 text-sm text-stone-700">Este anuncio ya tiene una decisión aprobada, pero todavía no fue publicado.</p>
    <button disabled={pending || state.status === "success"} className="mt-4 bg-emerald-800 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
      {pending ? "Publicando…" : "Publicar anuncio"}
    </button>
    <p role={state.status === "error" ? "alert" : "status"} className="mt-3 text-sm font-bold">{state.message}</p>
  </form>;
}
