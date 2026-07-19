import "server-only";

import { z } from "zod";
import { getPublicEnv } from "@/lib/env";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export function getServerEnv() {
  const publicEnv = getPublicEnv();
  const privateEnv = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!privateEnv.success) {
    throw new Error("Falta la configuración privada de Supabase del servidor.");
  }
  return { ...publicEnv, ...privateEnv.data };
}
