"use client";

import { useActionState } from "react";
import { setMyUsernameAction, type UsernameActionState } from "@/app/cuenta/profile-actions";

const initialState: UsernameActionState = { status: "idle" };

export function CompleteProfileForm() {
  const [state, action, pending] = useActionState(setMyUsernameAction, initialState);
  return <section id="completar-perfil" className="mt-10 border-2 border-amber-600 bg-amber-50 p-6"><h2 className="text-2xl font-black">Completar perfil</h2><p className="mt-2 text-sm text-amber-950">Elige tu username público. Para este MVP será permanente.</p><form action={action} className="mt-5 flex max-w-lg flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="profile-username">Username</label><input id="profile-username" name="username" required minLength={3} maxLength={24} pattern="[a-z][a-z0-9_]*[a-z0-9]" placeholder="username" className="h-12 flex-1 border bg-white px-3" /><button disabled={pending} className="h-12 bg-stone-950 px-5 text-sm font-bold text-white disabled:opacity-50">{pending ? "Guardando…" : "Establecer username"}</button></form><p role={state.status === "error" ? "alert" : "status"} className="mt-3 text-sm font-semibold">{state.message}</p></section>;
}
