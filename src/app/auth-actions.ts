"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentials = z.object({ email: z.email(), password: z.string().min(8) });

export async function signIn(formData: FormData) {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/login?error=invalid");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/login?error=credentials");
  redirect("/cuenta");
}

export async function signUp(formData: FormData) {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/registro?error=invalid");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp(parsed.data);
  if (error) redirect("/registro?error=signup");
  redirect("/login?registered=1");
}

export async function resetPassword(formData: FormData) {
  const parsed = z.object({ email: z.email() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/recuperar-password?error=invalid");
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email);
  redirect("/login?reset=sent");
}
