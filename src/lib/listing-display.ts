import type { ListingStatus } from "@/lib/constants";

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: "Borrador",
  submitted: "Enviado",
  in_review: "En revisión",
  changes_requested: "Cambios solicitados",
  approved: "Aprobado",
  published: "Publicado",
  rejected: "Rechazado",
  archived: "Archivado",
};

const COMPLETION_FIELDS = [
  "category_id", "brand_id", "model_id", "variant", "year", "city", "state_region",
  "price_mxn", "mileage_km", "exterior_color", "interior_color", "body_style",
  "transmission", "drivetrain", "fuel_type", "engine", "owner_description",
  "ownership_history", "maintenance_history", "sale_reason",
] as const;

export function listingCompletion(listing: Record<string, unknown>) {
  const completed = COMPLETION_FIELDS.filter((field) => listing[field] !== null && listing[field] !== undefined && listing[field] !== "").length;
  return Math.round((completed / COMPLETION_FIELDS.length) * 100);
}

export function formatMxn(value: number | string | null) {
  if (value === null || value === "") return "Sin precio";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(value));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
