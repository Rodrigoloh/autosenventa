"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env";
import { credentialsSchema, emailSchema, registrationSchema, usernameSchema } from "@/lib/auth-validation";
import { defaultPathForRole, safeInternalPath } from "@/lib/auth-policy";
import { getViewer } from "@/lib/auth";


export async function signIn(formData: FormData) {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/login?error=invalid");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/login?error=credentials");
  const viewer = await getViewer();
  const fallback = viewer ? defaultPathForRole(viewer.role) : "/cuenta";
  redirect(safeInternalPath(formData.get("next")?.toString() ?? null, fallback));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?signedOut=1");
}

export async function signUp(formData: FormData) {
  const parsed = registrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/registro?error=invalid");
  const supabase = await createClient();
  const env = getPublicEnv();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      data: { username: parsed.data.username },
    },
  });
  if (error) redirect("/registro?error=signup");
  redirect("/login?registered=1");
}

export async function checkUsernameAvailabilityAction(value: string) {
  const parsed = usernameSchema.safeParse(value);
  if (!parsed.success) return { available: false, message: "El username no cumple el formato requerido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_username_available", { candidate: parsed.data });
  if (error) return { available: false, message: "No pudimos comprobar la disponibilidad." };
  return data === true
    ? { available: true, message: "Username disponible." }
    : { available: false, message: "Ese username no está disponible." };
}

export async function resetPassword(formData: FormData) {
  const parsed = emailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/recuperar-password?error=invalid");
  const supabase = await createClient();
  const env = getPublicEnv();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/actualizar-password`,
  });
  redirect("/login?reset=sent");
}
