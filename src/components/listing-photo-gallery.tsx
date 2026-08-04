"use client";
/* eslint-disable @next/next/no-img-element -- las fotografías usan URLs privadas firmadas y efímeras */

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { PrivateListingPhoto } from "@/lib/listing-media";
import { MAX_LISTING_PHOTOS } from "@/lib/listing-photo-validation";

export function ListingPhotoGallery({ photos, remainingSlots, showCapacity = true, variant = "private", overlay }: { photos: PrivateListingPhoto[]; remainingSlots?: number; showCapacity?: boolean; variant?: "private" | "public"; overlay?: React.ReactNode }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const touchStart = useRef<number | null>(null);
  const remaining = remainingSlots ?? Math.max(0, MAX_LISTING_PHOTOS - photos.length);
  const visiblePhotos = photos.filter((photo) => !photo.deletionPending && photo.signedUrl);
  const changePhoto = useCallback((step: number) => setLightboxIndex((current) => current === null ? null : (current + step + visiblePhotos.length) % visiblePhotos.length), [visiblePhotos.length]);
  useEffect(() => {
    if (lightboxIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxIndex(null);
      if (event.key === "ArrowLeft") changePhoto(-1);
      if (event.key === "ArrowRight") changePhoto(1);
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKey); openerRef.current?.focus(); };
  }, [changePhoto, lightboxIndex]);
  useEffect(() => {
    const openRequestedPhoto = (event: Event) => {
      const photoId = (event as CustomEvent<string>).detail;
      const index = visiblePhotos.findIndex((photo) => photo.id === photoId);
      if (index >= 0) { openerRef.current = null; setLightboxIndex(index); }
    };
    window.addEventListener("drvn:open-photo", openRequestedPhoto);
    return () => window.removeEventListener("drvn:open-photo", openRequestedPhoto);
  }, [visiblePhotos]);
  const openLightbox = (index: number, opener: HTMLElement) => { openerRef.current = opener; setLightboxIndex(index); };
  const lightbox = lightboxIndex === null ? null : <div role="dialog" aria-modal="true" aria-label="Galería fullscreen" className="fixed inset-0 z-[100] flex flex-col bg-black text-white" onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { if (touchStart.current === null) return; const delta = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current; if (Math.abs(delta) > 45) changePhoto(delta > 0 ? -1 : 1); touchStart.current = null; }}>
    <div className="flex h-14 items-center justify-between px-4"><span className="text-xs font-bold tabular-nums">{lightboxIndex + 1} / {visiblePhotos.length}</span><button ref={closeRef} type="button" aria-label="Cerrar galería" onClick={() => setLightboxIndex(null)} className="grid size-10 place-items-center rounded-full border border-white/20"><X className="size-5" /></button></div>
    <div className="relative min-h-0 flex-1">{/* Las URLs firmadas no tienen un host estático. */}<img src={visiblePhotos[lightboxIndex]?.signedUrl ?? ""} alt={`Fotografía ${lightboxIndex + 1} del vehículo`} className="h-full w-full object-contain" /><button type="button" aria-label="Fotografía anterior" onClick={() => changePhoto(-1)} className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/65"><ChevronLeft /></button><button type="button" aria-label="Siguiente fotografía" onClick={() => changePhoto(1)} className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/65"><ChevronRight /></button></div>
    <div className="flex h-24 gap-2 overflow-x-auto p-3">{visiblePhotos.map((photo,index) => <button key={photo.id} type="button" aria-label={`Abrir fotografía ${index + 1}`} onClick={() => setLightboxIndex(index)} className={`relative aspect-[4/3] h-full shrink-0 overflow-hidden border ${index===lightboxIndex ? "border-orange-500" : "border-white/15"}`}><img src={photo.signedUrl!} alt="" className="h-full w-full object-cover" /></button>)}</div>
  </div>;
  if (variant === "public") {
    const [cover] = visiblePhotos;
    const galleryPhotos = visiblePhotos.slice(0, 4);
    return <section aria-label="Galería del auto" className="overflow-hidden rounded-md border public-rule bg-black/35">
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-900 sm:aspect-[16/9] lg:aspect-[16/7]">
        {cover?.signedUrl ? <button type="button" aria-label="Abrir fotografía principal" onClick={(event) => openLightbox(0,event.currentTarget)} className="absolute inset-0">
          {/* Las URL firmadas expiran y no se pueden declarar como hosts estáticos. */}
          <img src={cover.signedUrl} alt={`Fotografía principal del vehículo`} width={cover.width} height={cover.height} className="h-full w-full object-cover" />
        </button> : <div className="driven-halftone h-full opacity-25" aria-label="Sin fotografía de portada" />}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(4,5,4,.92)_0%,rgba(4,5,4,.62)_31%,rgba(4,5,4,.08)_63%),linear-gradient(to_top,rgba(4,5,4,.5)_0%,transparent_38%)]" />
        {overlay ? <div className="pointer-events-none absolute inset-0 flex items-end p-5 sm:p-8 lg:items-center lg:p-12 [&_a]:pointer-events-auto">{overlay}</div> : null}
      </div>
      <div className="p-3 sm:p-4"><div className="mb-3 flex items-center justify-between"><h2 className="editorial-kicker">Galería</h2><p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{visiblePhotos.length} {visiblePhotos.length === 1 ? "fotografía" : "fotografías"}</p></div>{galleryPhotos.length ? <ol className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        {galleryPhotos.map((photo, index) => <li key={photo.id} className="group relative aspect-[4/3] overflow-hidden rounded-sm bg-zinc-900"><button type="button" aria-label={`Abrir fotografía ${index + 1}`} onClick={(event) => openLightbox(index,event.currentTarget)} className="absolute inset-0">
          <img src={photo.signedUrl!} alt={`Fotografía ${index + 1} del vehículo`} width={photo.width} height={photo.height} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
          <span className="absolute bottom-2 left-2 text-[10px] font-mono text-white/80">{String(index + 1).padStart(2, "0")}</span>
        </button></li>)}
      </ol> : <p className="border-t public-rule py-4 text-xs text-zinc-600">Las fotografías estarán disponibles próximamente.</p>}</div>
      {lightbox}
    </section>;
  }
  return (
    <section aria-labelledby="photo-gallery-title" className="border-t pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="photo-gallery-title" className="text-xl font-black tracking-tight">Fotografías</h2>
          <p className="mt-1 text-sm text-stone-600">{showCapacity ? `${photos.length} de ${MAX_LISTING_PHOTOS} · ${remaining} espacios disponibles` : `${photos.length} fotografías`}</p>
        </div>
      </div>
      {visiblePhotos.length ? (
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visiblePhotos.map((photo, index) => {
            if (!photo.signedUrl) return null;
            return <li key={photo.id} className="relative overflow-hidden border bg-stone-100">
              {/* La URL firmada privada expira y no se puede declarar como host estático de next/image. */}
              <img
                src={photo.signedUrl}
                alt={`Fotografía ${index + 1} del vehículo${photo.isCover ? ", portada" : ""}`}
                width={photo.width}
                height={photo.height}
                className="aspect-[4/3] h-auto w-full object-cover"
              />
              <div className="flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wide">
                <span>Foto {index + 1}</span>
                {photo.isCover ? <span className="bg-stone-950 px-2 py-1 text-white">Portada</span> : null}
              </div>
            </li>;
          })}
        </ol>
      ) : <p className="mt-5 border border-dashed p-6 text-sm text-stone-600">Todavía no hay fotografías finalizadas.</p>}
    </section>
  );
}
