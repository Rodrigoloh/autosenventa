import type { PrivateListingPhoto } from "@/lib/listing-media";
import { MAX_LISTING_PHOTOS } from "@/lib/listing-photo-validation";

export function ListingPhotoGallery({ photos, remainingSlots, showCapacity = true, variant = "private", overlay }: { photos: PrivateListingPhoto[]; remainingSlots?: number; showCapacity?: boolean; variant?: "private" | "public"; overlay?: React.ReactNode }) {
  const remaining = remainingSlots ?? Math.max(0, MAX_LISTING_PHOTOS - photos.length);
  const visiblePhotos = photos.filter((photo) => !photo.deletionPending && photo.signedUrl);
  if (variant === "public") {
    const [cover] = visiblePhotos;
    const galleryPhotos = visiblePhotos.slice(0, 4);
    return <section aria-label="Galería del auto" className="overflow-hidden rounded-md border public-rule bg-black/35">
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-900 sm:aspect-[16/9] lg:aspect-[16/7]">
        {cover?.signedUrl ? <>
          {/* Las URL firmadas expiran y no se pueden declarar como hosts estáticos. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover.signedUrl} alt={`Fotografía principal del vehículo`} width={cover.width} height={cover.height} className="h-full w-full object-cover" />
        </> : <div className="driven-halftone h-full opacity-25" aria-label="Sin fotografía de portada" />}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,5,4,.92)_0%,rgba(4,5,4,.62)_31%,rgba(4,5,4,.08)_63%),linear-gradient(to_top,rgba(4,5,4,.5)_0%,transparent_38%)]" />
        {overlay ? <div className="absolute inset-0 flex items-end p-5 sm:p-8 lg:items-center lg:p-12">{overlay}</div> : null}
      </div>
      <div className="p-3 sm:p-4"><div className="mb-3 flex items-center justify-between"><h2 className="editorial-kicker">Galería</h2><p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{visiblePhotos.length} {visiblePhotos.length === 1 ? "fotografía" : "fotografías"}</p></div>{galleryPhotos.length ? <ol className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        {galleryPhotos.map((photo, index) => <li key={photo.id} className="group relative aspect-[4/3] overflow-hidden rounded-sm bg-zinc-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.signedUrl!} alt={`Fotografía ${index + 1} del vehículo`} width={photo.width} height={photo.height} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
          <span className="absolute bottom-2 left-2 text-[10px] font-mono text-white/80">{String(index + 1).padStart(2, "0")}</span>
        </li>)}
      </ol> : <p className="border-t public-rule py-4 text-xs text-zinc-600">Las fotografías estarán disponibles próximamente.</p>}</div>
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
