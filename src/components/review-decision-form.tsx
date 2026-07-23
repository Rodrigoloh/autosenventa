"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { decideListingReviewAction, type ReviewDecisionState } from "@/app/staff/anuncios/actions";

const initialState: ReviewDecisionState = { status: "idle" };

export function ReviewDecisionForm({ listingId, returnView }: { listingId: string; returnView: string }) {
  const [state, action, pending] = useActionState(decideListingReviewAction.bind(null, listingId), initialState);
  const router = useRouter();
  useEffect(() => { if (state.status === "success") router.refresh(); }, [router, state.status]);
  return <section className="mt-8 border-2 border-stone-950 p-5"><h2 className="text-2xl font-black">Decisión de revisión</h2><form action={action} className="mt-5"><input type="hidden" name="return_view" value={returnView} /><label className="block text-sm font-bold">Mensaje para el propietario<textarea name="message" rows={4} className="mt-2 w-full border p-3 font-normal" placeholder="Obligatorio para solicitar cambios o rechazar (mínimo 20 caracteres)." /></label><div className="mt-4 flex flex-wrap gap-3"><button name="decision" value="approved" disabled={pending || state.status === "success"} className="bg-emerald-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Aprobar y publicar</button><button name="decision" value="changes_requested" disabled={pending || state.status === "success"} className="bg-amber-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Solicitar cambios</button><button name="decision" value="rejected" disabled={pending || state.status === "success"} className="bg-red-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Rechazar</button></div><p role={state.status === "error" ? "alert" : "status"} className="mt-3 text-sm font-bold">{state.message}</p></form></section>;
}
