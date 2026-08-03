import type { PrivateListingPhoto } from "@/lib/listing-media";
import { MAX_LISTING_PHOTOS } from "@/lib/listing-photo-validation";

export function ListingPhotoGallery({ photos, remainingSlots, showCapacity = true, variant = "private", overlay }: { photos: PrivateListingPhoto[]; remainingSlots?: number; showCapacity?: boolean; variant?: "private" | "public"; overlay?: React.ReactNode }) {
  const remaining = remainingSlots ?? Math.max(0, MAX_LISTING_PHOTOS - photos.length);
  const visiblePhotos = photos.filter((photo) => !photo.deletionPending && photo.signedUrl);
  if (variant === "public") {
    const [cover, ...secondary] = visiblePhotos;
    return <section aria-label="Galería del auto">
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-900 sm:aspect-[16/10] lg:aspect-[16/8]">
        {cover?.signedUrl ? <>
          {/* Las URL firmadas expiran y no se pueden declarar como hosts estáticos. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover.signedUrl} alt={`Fotografía principal del vehículo`} width={cover.width} height={cover.height} className="h-full w-full object-cover" />
        </> : <div className="driven-halftone h-full opacity-25" aria-label="Sin fotografía de portada" />}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(4,5,4,.96)_0%,rgba(4,5,4,.46)_30%,transparent_62%)]" />
        {overlay ? <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:p-10">{overlay}</div> : null}
      </div>
      {secondary.length ? <ol className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-4">
        {secondary.map((photo, index) => <li key={photo.id} className="relative aspect-[4/3] overflow-hidden bg-zinc-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.signedUrl!} alt={`Fotografía ${index + 2} del vehículo`} width={photo.width} height={photo.height} className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]" />
        </li>)}
      </ol> : null}
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
