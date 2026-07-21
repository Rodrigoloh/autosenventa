"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { checkUsernameAvailabilityAction, signUp } from "@/app/auth-actions";

export function RegistrationForm({ error }: { error?: boolean }) {
  const [usernameMessage, setUsernameMessage] = useState("");
  const [checking, startChecking] = useTransition();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const mismatch = confirmation.length > 0 && password !== confirmation;

  function checkUsername(value: string) {
    startChecking(async () => {
      const result = await checkUsernameAvailabilityAction(value);
      setUsernameMessage(result.message);
    });
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-20">
      <h1 className="text-4xl font-black tracking-tight">Crear cuenta</h1>
      {error ? <p role="alert" className="mt-6 border px-4 py-3 text-sm">No fue posible crear la cuenta. Revisa el username y los datos.</p> : null}
      <form action={signUp} className="mt-10 space-y-5">
        <label className="block text-sm font-semibold">Username
          <input name="username" required minLength={3} maxLength={24} pattern="[a-z][a-z0-9_]*[a-z0-9]" autoComplete="username" onBlur={(event) => checkUsername(event.target.value)} className="mt-2 h-12 w-full border bg-white px-3 font-normal" />
        </label>
        <p className="text-xs text-stone-600">3–24 caracteres: minúsculas, números y guion bajo.</p>
        <p role="status" className="text-sm font-semibold">{checking ? "Comprobando disponibilidad…" : usernameMessage}</p>
        <label className="block text-sm font-semibold">Correo<input name="email" type="email" required autoComplete="email" className="mt-2 h-12 w-full border bg-white px-3 font-normal" /></label>
        <label className="block text-sm font-semibold">Contraseña<input name="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-12 w-full border bg-white px-3 font-normal" /></label>
        <label className="block text-sm font-semibold">Repetir contraseña<input name="confirm_password" type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 h-12 w-full border bg-white px-3 font-normal" /></label>
        {mismatch ? <p role="alert" className="text-sm font-semibold text-red-700">Las contraseñas no coinciden.</p> : null}
        <button type="submit" disabled={mismatch} className="h-12 w-full bg-stone-950 text-sm font-bold text-white hover:bg-accent disabled:opacity-50">Registrarme</button>
      </form>
      <Link href="/login" className="mt-6 inline-block text-sm underline underline-offset-4">Ya tengo una cuenta</Link>
    </main>
  );
}
