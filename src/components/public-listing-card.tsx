import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { formatMxn } from "@/lib/listing-display";
import type { PublicListingSummary } from "@/lib/public-marketplace";

export function PublicListingCard({ listing }: { listing: PublicListingSummary }) {
  const cover = listing.photos[0];
  const vehicle = [listing.year, listing.brandName, listing.modelName].filter(Boolean).join(" ") || listing.title;
  return (
    <article className="group min-w-0" data-listing-id={listing.id}>
      <Link href={`/autos/${listing.id}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500">
        <div className="relative aspect-[4/3] overflow-hidden bg-zinc-900">
          {cover?.url ? (
            <Image src={cover.url} alt={vehicle} fill unoptimized sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-[1.025]" />
          ) : <div className="grid h-full place-items-center text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">Fotografía pendiente</div>}
          {listing.isFeatured ? <span className="absolute left-3 top-3 bg-emerald-900/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-50">Destacado</span> : null}
        </div>
        <div className="pt-4">
          <h3 className="truncate text-base font-semibold tracking-[-0.02em] text-zinc-100">{vehicle}</h3>
          <p className="mt-1 text-lg font-bold tracking-tight text-white">{formatMxn(listing.priceMxn)}</p>
          <div className="mt-2 flex min-w-0 items-center justify-between gap-3 text-xs text-zinc-400">
            <span>{listing.mileageKm === null ? "Km no indicados" : `${new Intl.NumberFormat("es-MX").format(listing.mileageKm)} km`}</span>
            <span className="flex min-w-0 items-center gap-1"><MapPin className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{[listing.city, listing.stateRegion].filter(Boolean).join(", ") || "México"}</span></span>
          </div>
        </div>
      </Link>
    </article>
  );
}
