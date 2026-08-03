"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import { useState } from "react";
import { formatMxn } from "@/lib/listing-display";
import type { PublicListingSummary } from "@/lib/public-marketplace";

export function FeaturedListings({ listings }: { listings: PublicListingSummary[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listing = listings[activeIndex];
  if (!listing) return null;
  const photos = listing.photos.slice(0, 4);
  const cover = photos[0];
  const title = [listing.year, listing.brandName, listing.modelName].filter(Boolean).join(" ") || listing.title;
  const change = (step: number) => setActiveIndex((current) => (current + step + listings.length) % listings.length);

  return (
    <section aria-label="Auto destacado" className="public-shell relative px-0 pb-2 sm:px-5 lg:px-8">
      <div className="mx-auto grid max-w-[90rem] gap-1 lg:grid-cols-[minmax(0,4fr)_minmax(14rem,1fr)]">
        <Link href={`/autos/${listing.id}`} className="group relative min-h-[27rem] overflow-hidden bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-orange-500 sm:min-h-[36rem] lg:min-h-[42rem]">
          {cover?.url ? <Image src={cover.url} alt={title} fill priority unoptimized sizes="(min-width: 1024px) 75vw, 100vw" className="object-cover transition duration-700 group-hover:scale-[1.015]" /> : <div className="grid h-full place-items-center text-xs font-bold uppercase tracking-[0.25em] text-zinc-600">Fotografía pendiente</div>}
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(4,5,4,.94)_0%,rgba(4,5,4,.48)_28%,transparent_58%)]" />
          <div className="absolute inset-x-0 bottom-0 max-w-3xl p-5 sm:p-8 lg:p-10">
            <span className="driven-halftone inline-flex border border-emerald-100/15 bg-emerald-950/80 px-2.5 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.2em] text-emerald-100">Destacado</span>
            <h1 className="mt-3 text-2xl font-bold tracking-[-0.035em] text-white sm:text-3xl">{title}</h1>
            {listing.variant ? <p className="mt-1 text-sm font-medium text-zinc-300 sm:text-base">{listing.variant}</p> : null}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/25 pt-4 text-xs text-zinc-200 sm:text-sm">
              <strong className="text-lg text-white sm:text-xl">{formatMxn(listing.priceMxn)}</strong>
              <span>{listing.mileageKm === null ? "Km no indicados" : `${new Intl.NumberFormat("es-MX").format(listing.mileageKm)} km`}</span>
              <span className="flex items-center gap-1"><MapPin className="size-4" aria-hidden="true" />{[listing.city, listing.stateRegion].filter(Boolean).join(", ") || "México"}</span>
            </div>
          </div>
        </Link>
        <div className="grid h-24 grid-cols-3 gap-1 sm:h-32 lg:h-auto lg:grid-cols-1 lg:grid-rows-3">
          {[1, 2, 3].map((index) => {
            const photo = photos[index];
            return <div key={photo?.id ?? index} className="relative overflow-hidden bg-zinc-900">{photo?.url ? <Image src={photo.url} alt="" fill unoptimized sizes="(min-width: 1024px) 20vw, 33vw" className="object-cover opacity-90" /> : <div className="driven-halftone h-full opacity-20" />}</div>;
          })}
        </div>
      </div>
      {listings.length > 1 ? <div className="absolute right-3 top-3 flex items-center border border-white/15 bg-black/65 backdrop-blur sm:right-8 sm:top-5 lg:right-12" aria-label="Cambiar auto destacado">
        <button type="button" onClick={() => change(-1)} aria-label="Destacado anterior" className="grid size-10 place-items-center text-white transition-colors hover:bg-orange-600"><ArrowLeft className="size-4" /></button>
        <span className="border-x border-white/15 px-3 py-3 text-[10px] font-bold tabular-nums text-zinc-300">{String(activeIndex + 1).padStart(2, "0")} / {String(listings.length).padStart(2, "0")}</span>
        <button type="button" onClick={() => change(1)} aria-label="Siguiente destacado" className="grid size-10 place-items-center text-white transition-colors hover:bg-orange-600"><ArrowRight className="size-4" /></button>
      </div> : null}
    </section>
  );
}
