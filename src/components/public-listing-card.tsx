import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { formatMxn } from "@/lib/listing-display";
import type { PublicListingSummary } from "@/lib/public-marketplace";

export function PublicListingCard({ listing }: { listing: PublicListingSummary }) {
  const cover = listing.photos[0];
  const vehicle = listing.brandName || listing.modelName
    ? [listing.year, listing.brandName, listing.modelName].filter(Boolean).join(" ")
    : listing.title;
  return (
    <article className="group min-w-0 border-b border-white/10 pb-4 transition-colors hover:border-emerald-500/60" data-listing-id={listing.id}>
      <Link href={`/autos/${listing.id}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500">
        <div className="relative aspect-[16/10] overflow-hidden bg-zinc-900">
          {cover?.url ? (
            <Image src={cover.url} alt={vehicle} fill unoptimized sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition duration-500 ease-out group-hover:scale-[1.035]" />
          ) : <div className="driven-halftone grid h-full place-items-center text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500"><span className="bg-zinc-950/85 px-3 py-2">Fotografía pendiente</span></div>}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          {listing.isFeatured ? <span className="driven-halftone absolute left-3 top-3 bg-emerald-950/90 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-50">Destacado</span> : null}
        </div>
        <div className="pt-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><h3 className="truncate text-[17px] font-bold tracking-[-0.025em] text-zinc-100">{vehicle}</h3>{listing.variant ? <p className="mt-0.5 truncate text-xs text-zinc-500">{listing.variant}</p> : null}</div>
            <p className="shrink-0 text-base font-bold tracking-tight text-white">{formatMxn(listing.priceMxn)}</p>
          </div>
          <div className="mt-3 flex min-w-0 items-center justify-between gap-3 text-[11px] text-zinc-400">
            <span>{listing.mileageKm === null ? "Km no indicados" : `${new Intl.NumberFormat("es-MX").format(listing.mileageKm)} km`}</span>
            <span className="flex min-w-0 items-center gap-1"><MapPin className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{[listing.city, listing.stateRegion].filter(Boolean).join(", ") || "México"}</span></span>
          </div>
        </div>
      </Link>
    </article>
  );
}
