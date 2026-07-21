"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { usernameSchema } from "@/lib/auth-validation";
import { createClient } from "@/lib/supabase/server";

export type UsernameActionState = { status: "idle" | "success" | "error"; message?: string };

export async function setMyUsernameAction(
  _previous: UsernameActionState,
  formData: FormData,
): Promise<UsernameActionState> {
  await requireUser();
  const parsed = usernameSchema.safeParse(formData.get("username"));
  if (!parsed.success) return { status: "error", message: "El username no cumple el formato requerido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_my_username", { candidate: parsed.data }).single();
  if (error || !data) return { status: "error", message: "No pudimos establecer el username." };
  const result = data as { success: boolean; error_code: string | null; assigned_username: string | null };
  if (!result.success) return {
    status: "error",
    message: result.error_code === "username_unavailable"
      ? "Ese username ya no está disponible."
      : result.error_code === "username_immutable"
        ? "El username ya fue establecido y no puede cambiarse."
        : "El username no cumple el formato requerido.",
  };
  revalidatePath("/", "layout");
  revalidatePath("/cuenta");
  revalidatePath("/cuenta/anuncios");
  return { status: "success", message: `Username @${result.assigned_username} establecido.` };
}
