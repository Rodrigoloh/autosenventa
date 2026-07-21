"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { claimListingForReviewAction, type ClaimActionState } from "@/app/staff/anuncios/actions";

const initialState: ClaimActionState = { status: "idle" };

export function ClaimReviewForm({ listingId }: { listingId: string }) {
  const [state, action] = useActionState(claimListingForReviewAction.bind(null, listingId), initialState);
  const router = useRouter();
  useEffect(() => { if (state.status !== "idle") router.refresh(); }, [router, state.status]);
  return <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-center"><ClaimButton settled={state.status !== "idle"} /><p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sm font-bold text-red-700" : "text-sm font-bold text-emerald-700"}>{state.message}</p></form>;
}

function ClaimButton({ settled }: { settled: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending || settled} className="inline-flex min-h-11 items-center justify-center bg-stone-950 px-5 py-3 text-sm font-bold text-white hover:bg-accent disabled:cursor-wait disabled:opacity-60">{pending ? "Tomando…" : "Tomar revisión"}</button>;
}
