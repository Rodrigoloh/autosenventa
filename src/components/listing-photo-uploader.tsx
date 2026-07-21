"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import {
  cancelPhotoUploadAction,
  finalizePhotoUploadAction,
  reservePhotoUploadAction,
} from "@/app/cuenta/anuncios/photo-actions";
import {
  extensionFromFilename,
  MAX_LISTING_PHOTOS,
  photoUploadRequestSchema,
} from "@/lib/listing-photo-validation";
import { createClient } from "@/lib/supabase/client";

type UploadStatus = "pendiente" | "subiendo" | "validando" | "completada" | "cancelada" | "error";
type UploadItem = { id: string; name: string; status: UploadStatus; message?: string; reservationId?: string };

const STATUS_LABELS: Record<UploadStatus, string> = {
  pendiente: "Pendiente",
  subiendo: "Subiendo",
  validando: "Validando",
  completada: "Completada",
  cancelada: "Cancelada",
  error: "Error",
};

const subscribeToHydration = () => () => {};

export function ListingPhotoUploader({ listingId, initialAvailableSlots }: { listingId: string; initialAvailableSlots: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const availableSlots = initialAvailableSlots;

  function updateItem(id: string, values: Partial<UploadItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...values } : item));
  }

  async function cleanFailedReservation(itemId: string, reservationId: string, failureMessage: string) {
    const cleanup = await cancelPhotoUploadAction(reservationId);
    if (cleanup.ok) {
      updateItem(itemId, {
        status: "cancelada",
        message: `${failureMessage} Subida cancelada.`,
        reservationId: undefined,
      });
      setNotice("La subida fallida se canceló y el espacio volvió a estar disponible.");
      router.refresh();
      return;
    }
    updateItem(itemId, {
      status: "error",
      message: `${failureMessage} ${cleanup.message}`,
      reservationId,
    });
    setNotice("La reserva sigue pendiente. Reintenta la limpieza.");
    router.refresh();
  }

  async function processFile(file: File, itemId: string) {
    const extension = extensionFromFilename(file.name);
    const payload = {
      listingId,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      extension,
    };
    const parsed = photoUploadRequestSchema.safeParse(payload);
    if (!parsed.success) {
      updateItem(itemId, { status: "error", message: parsed.error.issues[0]?.message ?? "Archivo no permitido." });
      return false;
    }

    const reservation = await reservePhotoUploadAction(parsed.data);
    if (!reservation.ok) {
      updateItem(itemId, {
        status: reservation.cleanupCompleted ? "cancelada" : "error",
        message: reservation.message,
        reservationId: reservation.reservationId,
      });
      router.refresh();
      return false;
    }

    updateItem(itemId, { status: "subiendo", message: undefined, reservationId: reservation.reservationId });
    const supabase = createClient();
    const uploaded = await supabase.storage.from("listing-media").uploadToSignedUrl(
      reservation.storagePath,
      reservation.token,
      file,
      { contentType: parsed.data.mimeType },
    );
    if (uploaded.error) {
      await cleanFailedReservation(itemId, reservation.reservationId, "No pudimos subir el archivo privado.");
      return false;
    }

    updateItem(itemId, { status: "validando" });
    const finalized = await finalizePhotoUploadAction(reservation.reservationId);
    if (!finalized.ok) {
      await cleanFailedReservation(itemId, reservation.reservationId, finalized.message);
      return false;
    }

    updateItem(itemId, { status: "completada", reservationId: undefined });
    router.refresh();
    return true;
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length || busy) return;
    const selected = Array.from(files);
    if (selected.length > availableSlots) {
      setNotice(`Sólo quedan ${availableSlots} espacios disponibles.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setNotice("");
    setBusy(true);
    const queued = selected.map((file) => ({ id: crypto.randomUUID(), name: file.name, status: "pendiente" as const }));
    setItems((current) => [...queued, ...current]);
    let completed = 0;
    for (let index = 0; index < selected.length; index += 1) {
      if (await processFile(selected[index], queued[index].id)) completed += 1;
    }
    setNotice(completed === selected.length
      ? `${completed} ${completed === 1 ? "fotografía cargada" : "fotografías cargadas"} correctamente.`
      : `Se completaron ${completed} de ${selected.length} fotografías.`);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section aria-labelledby="photo-upload-title" className="border-t pt-8">
      <h2 id="photo-upload-title" className="text-xl font-black tracking-tight">Subir fotografías</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
        JPEG, PNG o WebP; máximo 10 MiB por archivo y {MAX_LISTING_PHOTOS} fotografías por anuncio.
        La primera fotografía será la portada.
      </p>
      <label className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center bg-stone-950 px-5 py-3 text-sm font-bold text-white hover:bg-accent has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
        Seleccionar fotografías
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          disabled={!hydrated || busy || availableSlots === 0}
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </label>
      <p className="mt-2 text-sm font-semibold">{availableSlots} espacios disponibles</p>
      {notice ? <p className="mt-3 text-sm font-medium" role="status">{notice}</p> : null}
      {items.length ? (
        <ul className="mt-5 space-y-2" aria-label="Estado de las fotografías seleccionadas">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0 truncate font-semibold">{item.name}</span>
              <span role={item.status === "error" ? "alert" : "status"} className={item.status === "error" ? "text-red-700" : "text-stone-600"}>
                {STATUS_LABELS[item.status]}{item.message ? `: ${item.message}` : ""}
              </span>
              {item.status === "error" && item.reservationId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void cleanFailedReservation(item.id, item.reservationId!, "No pudimos completar la limpieza anterior.")}
                  className="font-bold text-red-800 underline disabled:opacity-50"
                >
                  Reintentar limpieza
                </button>
              ) : null}
              {item.status === "cancelada" ? (
                <button
                  type="button"
                  onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}
                  className="font-bold underline"
                >
                  Descartar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
