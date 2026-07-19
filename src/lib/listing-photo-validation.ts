import { z } from "zod";

export const MAX_LISTING_PHOTOS = 20;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTO_PIXELS = 25_000_000;
export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PHOTO_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

const photoMimeSchema = z.enum(PHOTO_MIME_TYPES);
const photoExtensionSchema = z.enum(PHOTO_EXTENSIONS);

export const photoUploadRequestSchema = z.object({
  listingId: z.uuid(),
  originalName: z.string().trim().min(1).max(255).refine(
    (value) => !/[\u0000-\u001f\u007f]/.test(value),
    "El nombre del archivo contiene caracteres no permitidos.",
  ),
  mimeType: photoMimeSchema,
  sizeBytes: z.number().int().min(1).max(MAX_PHOTO_BYTES),
  extension: photoExtensionSchema,
}).strict().superRefine((value, context) => {
  const derivedExtension = extensionFromFilename(value.originalName);
  if (derivedExtension !== value.extension) {
    context.addIssue({ code: "custom", path: ["extension"], message: "La extensión no coincide con el nombre del archivo." });
  }
  if (!mimeMatchesExtension(value.mimeType, value.extension)) {
    context.addIssue({ code: "custom", path: ["mimeType"], message: "El tipo de imagen no coincide con su extensión." });
  }
});

export type PhotoUploadRequest = z.infer<typeof photoUploadRequestSchema>;
export type AllowedPhotoMime = (typeof PHOTO_MIME_TYPES)[number];
export type AllowedPhotoExtension = (typeof PHOTO_EXTENSIONS)[number];

export function extensionFromFilename(filename: string): string | null {
  const separator = filename.lastIndexOf(".");
  if (separator < 1 || separator === filename.length - 1) return null;
  return filename.slice(separator + 1).toLowerCase();
}

export function mimeMatchesExtension(mimeType: string, extension: string) {
  if (mimeType === "image/jpeg") return extension === "jpg" || extension === "jpeg";
  if (mimeType === "image/png") return extension === "png";
  if (mimeType === "image/webp") return extension === "webp";
  return false;
}

export function detectImageMime(bytes: Uint8Array): AllowedPhotoMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return "image/png";
  }
  if (bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "image/webp";
  }
  return null;
}

export function assertSafeImageDimensions(width: number | undefined, height: number | undefined) {
  if (!width || !height || width < 1 || height < 1 || width * height > MAX_PHOTO_PIXELS) {
    throw new Error("La imagen supera 25 megapíxeles o tiene dimensiones inválidas.");
  }
}
