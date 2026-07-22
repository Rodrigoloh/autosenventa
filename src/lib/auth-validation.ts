import { z } from "zod";

export const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "staff", "support", "soporte", "root", "api", "auth", "login", "logout",
  "registro", "signup", "signin", "cuenta", "perfil", "profile", "profiles", "usuario", "usuarios",
  "user", "users", "autos", "auto", "anuncios", "listing", "listings", "review", "reviews", "revision",
  "revisiones", "moderacion", "driven", "system", "null", "undefined", "public", "private", "settings", "config",
]);

export const USERNAME_HELP = "De 3 a 24 caracteres. Usa letras, números y guion bajo.";

export const USERNAME_MESSAGES = {
  length: "El username debe tener entre 3 y 24 caracteres.",
  characters: "Usa únicamente letras, números y guion bajo.",
  starts_with_letter: "El username debe comenzar con una letra.",
  trailing_underscore: "El username no puede terminar en guion bajo.",
  consecutive_underscores: "No uses dos guiones bajos consecutivos.",
  reserved: "Este username no está disponible.",
  occupied: "Este username ya está ocupado.",
} as const;

export type UsernameValidationCode = Exclude<keyof typeof USERNAME_MESSAGES, "occupied">;

export function normalizeUsername(value: string) {
  return value.toLowerCase();
}

export function usernameValidationCode(value: string): UsernameValidationCode | null {
  const normalized = normalizeUsername(value);
  if (normalized.length < 3 || normalized.length > 24) return "length";
  if (!/^[a-z0-9_]+$/.test(normalized)) return "characters";
  if (!/^[a-z]/.test(normalized)) return "starts_with_letter";
  if (normalized.endsWith("_")) return "trailing_underscore";
  if (normalized.includes("__")) return "consecutive_underscores";
  if (RESERVED_USERNAMES.has(normalized)) return "reserved";
  return null;
}

export function usernameValidationMessage(value: string) {
  const code = usernameValidationCode(value);
  return code ? USERNAME_MESSAGES[code] : null;
}

export const usernameSchema = z.string().transform(normalizeUsername).superRefine((value, context) => {
  const message = usernameValidationMessage(value);
  if (message) context.addIssue({ code: "custom", message });
});

export const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const registrationSchema = z.object({
  username: usernameSchema,
  email: z.email(),
  password: z.string().min(8),
  confirm_password: z.string().min(8),
}).refine((data) => data.password === data.confirm_password, {
  path: ["confirm_password"],
  message: "Las contraseñas deben coincidir.",
});

export const emailSchema = z.object({ email: z.email() });
