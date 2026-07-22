"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env";
import {
  credentialsSchema,
  emailSchema,
  normalizeUsername,
  registrationSchema,
  USERNAME_MESSAGES,
  usernameSchema,
  usernameValidationCode,
  usernameValidationMessage,
} from "@/lib/auth-validation";
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
  const input = Object.fromEntries(formData);
  const rawUsername = typeof input.username === "string" ? input.username : "";
  const usernameCode = usernameValidationCode(rawUsername);
  if (usernameCode) redirect(`/registro?error=${usernameCode}`);
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) redirect("/registro?error=invalid");
  const supabase = await createClient();
  const availability = await supabase.rpc("is_username_available", { candidate: parsed.data.username });
  if (!availability.error && availability.data !== true) redirect("/registro?error=occupied");
  const env = getPublicEnv();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      data: { username: parsed.data.username },
    },
  });
  if (error) {
    const retry = await supabase.rpc("is_username_available", { candidate: parsed.data.username });
    redirect(!retry.error && retry.data !== true ? "/registro?error=occupied" : "/registro?error=signup");
  }
  redirect("/login?registered=1");
}

export async function checkUsernameAvailabilityAction(value: string) {
  const normalized = normalizeUsername(value);
  const validationMessage = usernameValidationMessage(normalized);
  if (validationMessage) return { available: false, message: validationMessage, normalized };
  const parsed = usernameSchema.safeParse(normalized);
  if (!parsed.success) return { available: false, message: parsed.error.issues[0]?.message ?? USERNAME_MESSAGES.characters, normalized };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_username_available", { candidate: parsed.data });
  if (error) return { available: false, message: "No pudimos comprobar la disponibilidad.", normalized };
  return data === true
    ? { available: true, message: "Username disponible.", normalized }
    : { available: false, message: USERNAME_MESSAGES.occupied, normalized };
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
