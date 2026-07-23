"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteListingPhotoAction,
  reorderListingPhotosAction,
  setListingPhotoCoverAction,
} from "@/app/cuenta/anuncios/photo-actions";
import type { PrivateListingPhoto } from "@/lib/listing-media";
import { MAX_LISTING_PHOTOS } from "@/lib/listing-photo-validation";

type Props = {
  listingId: string;
  initialPhotos: PrivateListingPhoto[];
  remainingSlots: number;
};

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return items;
  next.splice(to, 0, item);
  return next;
}

export function ListingPhotoManager({ listingId, initialPhotos, remainingSlots }: Props) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initialPhotos);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const hasPendingDeletion = photos.some((photo) => photo.deletionPending);
  const resultStorageKey = `listing-photo-manager-result:${listingId}`;

  useEffect(() => {
    const persisted = window.sessionStorage.getItem(resultStorageKey);
    if (persisted) {
      window.sessionStorage.removeItem(resultStorageKey);
      const timeout = window.setTimeout(() => setMessage(persisted), 0);
      return () => window.clearTimeout(timeout);
    }
  }, [resultStorageKey]);

  function refreshKeepingMessage(resultMessage: string) {
    window.sessionStorage.setItem(resultStorageKey, resultMessage);
    router.refresh();
  }

  async function saveOrder(next: PrivateListingPhoto[], previous: PrivateListingPhoto[]) {
    setPhotos(next);
    setBusy("order");
    setMessage("Guardando el orden…");
    const result = await reorderListingPhotosAction({ listingId, mediaIds: next.map((photo) => photo.id) });
    if (!result.ok) setPhotos(previous);
    setMessage(result.message);
    setBusy(null);
    if (result.ok) refreshKeepingMessage(result.message);
  }

  async function movePhoto(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= photos.length || busy) return;
    await saveOrder(moveItem(photos, index, destination), photos);
  }

  async function dropPhoto(targetIndex: number) {
    if (!draggedId || busy) return;
    const sourceIndex = photos.findIndex((photo) => photo.id === draggedId);
    setDraggedId(null);
    if (sourceIndex < 0 || sourceIndex === targetIndex) return;
    await saveOrder(moveItem(photos, sourceIndex, targetIndex), photos);
  }

  async function chooseCover(mediaId: string) {
    if (busy) return;
    setBusy(mediaId);
    setMessage("Guardando la portada…");
    const result = await setListingPhotoCoverAction(mediaId);
    if (result.ok) setPhotos((current) => current.map((photo) => ({ ...photo, isCover: photo.id === mediaId })));
    setMessage(result.message);
    setBusy(null);
    if (result.ok) refreshKeepingMessage(result.message);
  }

  async function deletePhoto(mediaId: string) {
    if (busy || !window.confirm("¿Eliminar esta fotografía? El archivo privado también se borrará de Storage.")) return;
    setBusy(mediaId);
    setMessage("Eliminando la fotografía…");
    const deletedWasCover = photos.find((photo) => photo.id === mediaId)?.isCover;
    const result = await deleteListingPhotoAction(mediaId);
    if (result.ok) {
      setPhotos((current) => {
        const next = current.filter((photo) => photo.id !== mediaId);
        return deletedWasCover && next.length
          ? next.map((photo, index) => ({ ...photo, isCover: index === 0 }))
          : next;
      });
    }
    setMessage(result.message);
    setBusy(null);
    if (result.ok) refreshKeepingMessage(result.message);
  }

  const disabled = busy !== null;
  const available = Math.max(0, remainingSlots + initialPhotos.length - photos.length);

  return (
    <section aria-labelledby="photo-manager-title" className="border-t pt-8">
      <div>
        <h2 id="photo-manager-title" className="text-xl font-black tracking-tight">Administrar fotografías</h2>
        <p className="mt-1 text-sm text-stone-600">{photos.length} de {MAX_LISTING_PHOTOS} · {available} espacios disponibles</p>
        <p className="mt-1 text-sm text-stone-600">Arrastra las tarjetas o usa los botones para cambiar el orden.</p>
      </div>
      <div aria-live="polite" className="mt-3 min-h-6 text-sm font-bold">{message}</div>
      {photos.length ? (
        <ol className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              draggable={!disabled && !hasPendingDeletion}
              onDragStart={() => setDraggedId(photo.id)}
              onDragEnd={() => setDraggedId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => void dropPhoto(index)}
              className="overflow-hidden border bg-stone-100"
              aria-label={`Fotografía ${index + 1}${photo.isCover ? ", portada" : ""}`}
            >
              {photo.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.signedUrl} alt={`Fotografía ${index + 1} del vehículo${photo.isCover ? ", portada" : ""}`} width={photo.width} height={photo.height} className="aspect-[4/3] h-auto w-full object-cover" />
              ) : <div className="flex aspect-[4/3] items-center justify-center bg-stone-200 p-6 text-center text-sm font-bold text-stone-700">El archivo ya se eliminó. Completa el cierre en la base.</div>}
              <div className="space-y-3 p-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide">
                  <span>Foto {index + 1}</span>
                  {photo.isCover ? <span className="bg-stone-950 px-2 py-1 text-white">Portada</span> : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={disabled || hasPendingDeletion || index === 0} onClick={() => void movePhoto(index, -1)} className="border bg-white px-2 py-2 text-xs font-bold disabled:opacity-40">Mover antes</button>
                  <button type="button" disabled={disabled || hasPendingDeletion || index === photos.length - 1} onClick={() => void movePhoto(index, 1)} className="border bg-white px-2 py-2 text-xs font-bold disabled:opacity-40">Mover después</button>
                  <button type="button" disabled={disabled || hasPendingDeletion || photo.isCover} onClick={() => void chooseCover(photo.id)} className="border bg-white px-2 py-2 text-xs font-bold disabled:opacity-40">Elegir portada</button>
                  <button type="button" disabled={disabled || (hasPendingDeletion && !photo.deletionPending)} onClick={() => void deletePhoto(photo.id)} className="border border-red-700 bg-white px-2 py-2 text-xs font-bold text-red-800 disabled:opacity-40">{photo.deletionPending ? "Reintentar eliminación" : "Eliminar foto"}</button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="mt-3 border border-dashed p-6 text-sm text-stone-600">Todavía no hay fotografías finalizadas.</p>}
    </section>
  );
}
