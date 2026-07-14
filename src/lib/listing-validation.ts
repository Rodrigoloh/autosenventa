import { z } from "zod";

export const EDITABLE_LISTING_STATUSES = ["draft", "changes_requested"] as const;

export const BODY_STYLES = ["Coupé", "Sedán", "Convertible", "Hatchback", "SUV", "Pickup", "Vagoneta", "Otro"] as const;
export const TRANSMISSIONS = ["Manual", "Automática", "Automatizada", "CVT", "Otra"] as const;
export const DRIVETRAINS = ["Delantera", "Trasera", "Integral", "4x4", "Otra"] as const;
export const FUEL_TYPES = ["Gasolina", "Diésel", "Híbrido", "Eléctrico", "Otro"] as const;

const optionalText = (maximum: number) => z.string().trim().max(maximum).transform((value) => value || null);
const optionalId = z.string().trim().refine((value) => value === "" || /^\d+$/.test(value), "Selecciona una opción válida.")
  .transform((value) => value ? Number(value) : null);
const optionalNumber = (schema: z.ZodNumber) => z.string().trim().refine(
  (value) => value === "" || Number.isFinite(Number(value)),
  "Ingresa un número válido.",
).transform((value) => value === "" ? null : Number(value)).pipe(schema.nullable());

export const listingDraftSchema = z.object({
  category_id: optionalId,
  brand_id: optionalId,
  model_id: optionalId,
  variant: optionalText(100),
  year: optionalNumber(z.number().int().min(1886).max(new Date().getFullYear() + 1)),
  city: optionalText(100),
  state_region: optionalText(100),
  price_mxn: optionalNumber(z.number().min(0).max(9_999_999_999.99)),
  mileage_km: optionalNumber(z.number().int().min(0).max(99_999_999)),
  exterior_color: optionalText(60),
  interior_color: optionalText(60),
  body_style: z.union([z.literal(""), z.enum(BODY_STYLES)]).transform((value) => value || null),
  transmission: z.union([z.literal(""), z.enum(TRANSMISSIONS)]).transform((value) => value || null),
  drivetrain: z.union([z.literal(""), z.enum(DRIVETRAINS)]).transform((value) => value || null),
  fuel_type: z.union([z.literal(""), z.enum(FUEL_TYPES)]).transform((value) => value || null),
  engine: optionalText(120),
  owner_description: optionalText(5000),
  ownership_history: optionalText(5000),
  maintenance_history: optionalText(5000),
  modifications: optionalText(5000),
  known_issues: optionalText(5000),
  sale_reason: optionalText(2000),
}).superRefine((value, context) => {
  if (value.model_id !== null && value.brand_id === null) {
    context.addIssue({ code: "custom", path: ["model_id"], message: "Selecciona primero la marca." });
  }
});

export type ListingDraftValues = z.infer<typeof listingDraftSchema>;
export type ListingActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialListingActionState: ListingActionState = { status: "idle" };

export function listingDraftFromFormData(formData: FormData) {
  return listingDraftSchema.safeParse(Object.fromEntries(
    Object.keys(listingDraftSchema.shape).map((key) => [key, formData.get(key) ?? ""]),
  ));
}

export function provisionalTitle(parts: { year?: number | null; brand?: string | null; model?: string | null; variant?: string | null }) {
  return [parts.year, parts.brand, parts.model, parts.variant?.trim()].filter(Boolean).join(" ") || "Borrador sin identificar";
}
