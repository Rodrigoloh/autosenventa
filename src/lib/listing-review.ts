export const ATTESTATION_VERSION = "2026-07-20-v1";

export const READINESS_MESSAGES = {
  missing_public_username: ["Perfil", "Completa tu username público."],
  missing_vehicle_fields: ["Vehículo", "Completa categoría, marca, modelo, año, kilometraje, color exterior, carrocería, transmisión y combustible."],
  invalid_taxonomy: ["Vehículo", "La categoría, marca o modelo ya no está activo o no corresponde."],
  invalid_price: ["Precio", "Ingresa un precio mayor que cero."],
  missing_location: ["Ubicación", "Completa ciudad y estado o región."],
  description_too_short: ["Historia", "La descripción general debe tener al menos 120 caracteres."],
  ownership_history_too_short: ["Historia", "La historia de propiedad debe tener al menos 60 caracteres."],
  maintenance_history_too_short: ["Historia", "El historial de mantenimiento debe tener al menos 40 caracteres."],
  missing_modifications_statement: ["Historia", "Declara las modificaciones o escribe “Sin modificaciones”."],
  missing_known_issues_statement: ["Historia", "Declara los problemas conocidos o escribe “Ninguno”."],
  insufficient_photos: ["Fotografías", "Agrega al menos 8 fotografías finalizadas."],
  missing_cover: ["Fotografías", "Selecciona exactamente una fotografía de portada."],
  invalid_photo_order: ["Fotografías", "Corrige el orden de las fotografías."],
  photo_operation_pending: ["Fotografías", "Finaliza o cancela todas las subidas y eliminaciones pendientes."],
  missing_storage_object: ["Fotografías", "Una fotografía no tiene su archivo privado correspondiente."],
  deletion_in_progress: ["Fotografías", "El borrado completo del anuncio está en curso."],
  missing_attestations: ["Declaraciones", "Acepta las cuatro declaraciones obligatorias."],
  listing_not_draft: ["Declaraciones", "El anuncio ya no está disponible para enviarse."],
} as const;

export type ReadinessCode = keyof typeof READINESS_MESSAGES;
export const READINESS_CATEGORIES = ["Perfil", "Vehículo", "Precio", "Ubicación", "Historia", "Fotografías", "Declaraciones"] as const;

export function readinessItems(codes: readonly string[], includeAttestations = true) {
  const normalized = [...new Set(codes.filter((code): code is ReadinessCode => code in READINESS_MESSAGES))]
    .filter((code) => includeAttestations || code !== "missing_attestations");
  if (includeAttestations && !normalized.includes("missing_attestations")) normalized.push("missing_attestations");
  return normalized.map((code) => ({ code, category: READINESS_MESSAGES[code][0], message: READINESS_MESSAGES[code][1] }));
}

export function textMeetsMinimum(value: string | null | undefined, minimum: number) {
  return (value?.trim().length ?? 0) >= minimum;
}

export function validReviewPrice(value: number | string | null | undefined) {
  return value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) > 0;
}
