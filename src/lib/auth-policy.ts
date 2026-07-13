import { z } from "zod";
import { APP_ROLES, type AppRole } from "./constants";

export const profileSchema = z.object({
  id: z.uuid(),
  role: z.enum(APP_ROLES),
  display_name: z.string().nullable(),
});

export type Viewer = z.infer<typeof profileSchema>;

export function resolveViewer(profile: unknown): Viewer | null {
  const parsed = profileSchema.safeParse(profile);
  return parsed.success ? parsed.data : null;
}

export function hasRequiredRole(viewer: Viewer, allowed: readonly AppRole[]) {
  return allowed.includes(viewer.role);
}

export function accessDecision(viewer: Viewer | null, allowed?: readonly AppRole[]) {
  if (!viewer) return "login" as const;
  if (allowed && !hasRequiredRole(viewer, allowed)) return "forbidden" as const;
  return "allowed" as const;
}

export function safeInternalPath(value: string | null, fallback = "/cuenta") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const parsed = new URL(value, "http://local.invalid");
    return parsed.origin === "http://local.invalid"
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}
