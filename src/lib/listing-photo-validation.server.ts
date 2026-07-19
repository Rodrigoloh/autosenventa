import "server-only";

import sharp, { type Metadata } from "sharp";
import {
  assertSafeImageDimensions,
  detectImageMime,
  MAX_PHOTO_BYTES,
  MAX_PHOTO_PIXELS,
  type AllowedPhotoMime,
} from "@/lib/listing-photo-validation";

export type ValidatedPhoto = {
  mimeType: AllowedPhotoMime;
  sizeBytes: number;
  width: number;
  height: number;
};

export async function validateUploadedPhoto(bytes: Uint8Array, expectedMimeType: string): Promise<ValidatedPhoto> {
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new Error("El archivo está vacío o supera 10 MiB.");
  }

  const detectedMimeType = detectImageMime(bytes);
  if (!detectedMimeType || detectedMimeType !== expectedMimeType) {
    throw new Error("El contenido real no coincide con el formato declarado.");
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, {
      failOn: "error",
      limitInputPixels: MAX_PHOTO_PIXELS,
      sequentialRead: true,
    }).metadata();
  } catch {
    throw new Error("La imagen no se puede decodificar o excede los límites permitidos.");
  }

  const decodedMimeType = metadata.format === "jpeg"
    ? "image/jpeg"
    : metadata.format === "png"
      ? "image/png"
      : metadata.format === "webp"
        ? "image/webp"
        : null;
  if (decodedMimeType !== detectedMimeType || (metadata.pages ?? 1) !== 1) {
    throw new Error("La imagen decodificada no es JPEG, PNG o WebP estático válido.");
  }

  assertSafeImageDimensions(metadata.width, metadata.height);
  return {
    mimeType: detectedMimeType,
    sizeBytes: bytes.byteLength,
    width: metadata.width!,
    height: metadata.height!,
  };
}
