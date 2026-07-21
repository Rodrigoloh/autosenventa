import { z } from "zod";

export const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "staff", "support", "soporte", "root", "api", "auth", "login", "logout",
  "registro", "signup", "signin", "cuenta", "perfil", "profile", "profiles", "usuario", "usuarios",
  "user", "users", "autos", "auto", "anuncios", "listing", "listings", "review", "reviews", "revision",
  "revisiones", "moderacion", "driven", "system", "null", "undefined", "public", "private", "settings", "config",
]);

export const usernameSchema = z.string().trim().toLowerCase()
  .min(3).max(24)
  .regex(/^[a-z][a-z0-9_]*[a-z0-9]$/)
  .refine((value) => !value.includes("__"))
  .refine((value) => !RESERVED_USERNAMES.has(value));

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
