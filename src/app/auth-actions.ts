"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env";
import { credentialsSchema, emailSchema } from "@/lib/auth-validation";


export async function signIn(formData: FormData) {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/login?error=invalid");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/login?error=credentials");
  redirect("/cuenta");
}

export async function signUp(formData: FormData) {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/registro?error=invalid");
  const supabase = await createClient();
  const env = getPublicEnv();
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/cuenta` },
  });
  if (error) redirect("/registro?error=signup");
  redirect("/login?registered=1");
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
