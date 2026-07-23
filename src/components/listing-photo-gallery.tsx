import type { PrivateListingPhoto } from "@/lib/listing-media";
import { MAX_LISTING_PHOTOS } from "@/lib/listing-photo-validation";

export function ListingPhotoGallery({ photos, remainingSlots, showCapacity = true }: { photos: PrivateListingPhoto[]; remainingSlots?: number; showCapacity?: boolean }) {
  const remaining = remainingSlots ?? Math.max(0, MAX_LISTING_PHOTOS - photos.length);
  const visiblePhotos = photos.filter((photo) => !photo.deletionPending && photo.signedUrl);
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
