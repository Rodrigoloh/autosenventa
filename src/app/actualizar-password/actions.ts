"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const parsed = z.object({ password: z.string().min(8) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/actualizar-password?error=invalid");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) redirect("/actualizar-password?error=update");
  redirect("/cuenta");
}
