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
    <section aria-label="Auto destacado" className="public-shell relative px-0 sm:px-5 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-1 lg:h-[25rem] lg:grid-cols-[minmax(0,2fr)_minmax(19rem,1fr)]">
        <div className="group relative min-h-[24rem] overflow-hidden rounded-md bg-zinc-900 sm:min-h-[28rem] lg:min-h-0">
          <Link href={`/autos/${listing.id}`} aria-label={`Ver ${title}`} className="absolute inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-orange-500">
          {cover?.url ? <Image src={cover.url} alt={title} fill priority unoptimized sizes="(min-width: 1024px) 75vw, 100vw" className="object-cover transition duration-700 group-hover:scale-[1.015]" /> : <div className="grid h-full place-items-center text-xs font-bold uppercase tracking-[0.25em] text-zinc-600">Fotografía pendiente</div>}
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(4,5,4,.92)_0%,rgba(4,5,4,.38)_32%,transparent_60%)]" />
          <div className="absolute inset-x-0 bottom-0 p-5 pr-28 sm:p-7 sm:pr-36">
            <span className="inline-flex bg-emerald-950/85 px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.18em] text-emerald-100">Destacado</span>
            <h1 className="mt-2 text-xl font-bold tracking-[-0.03em] text-white sm:text-2xl">{title}</h1>
            {listing.variant ? <p className="mt-0.5 text-xs font-medium text-zinc-300 sm:text-sm">{listing.variant}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-200 sm:text-xs">
              <strong className="text-base text-white sm:text-lg">{formatMxn(listing.priceMxn)}</strong>
              <span>{listing.mileageKm === null ? "Km no indicados" : `${new Intl.NumberFormat("es-MX").format(listing.mileageKm)} km`}</span>
              <span className="flex items-center gap-1"><MapPin className="size-3" aria-hidden="true" />{[listing.city, listing.stateRegion].filter(Boolean).join(", ") || "México"}</span>
            </div>
          </div>
          </Link>
          {listings.length > 1 ? <div className="absolute bottom-5 right-4 z-10 flex items-center gap-1.5 sm:bottom-6 sm:right-6" aria-label="Cambiar auto destacado">
            <button type="button" onClick={() => change(-1)} aria-label="Destacado anterior" className="grid size-9 place-items-center rounded-full border border-white/25 bg-black/55 text-white backdrop-blur transition-colors hover:border-orange-500 hover:bg-orange-600"><ArrowLeft className="size-3.5" /></button>
            <span className="rounded-full border border-white/20 bg-black/55 px-2.5 py-2.5 text-[9px] font-bold tabular-nums text-zinc-300 backdrop-blur">{String(activeIndex + 1).padStart(2, "0")} / {String(listings.length).padStart(2, "0")}</span>
            <button type="button" onClick={() => change(1)} aria-label="Siguiente destacado" className="grid size-9 place-items-center rounded-full border border-white/25 bg-black/55 text-white backdrop-blur transition-colors hover:border-orange-500 hover:bg-orange-600"><ArrowRight className="size-3.5" /></button>
          </div> : null}
        </div>
        <div className="grid h-20 grid-cols-3 gap-1 sm:h-28 lg:h-full lg:grid-cols-1 lg:grid-rows-[3fr_2fr]">
          <div className="relative overflow-hidden rounded-md bg-zinc-900">{photos[1]?.url ? <Image src={photos[1].url} alt="" fill unoptimized sizes="(min-width: 1024px) 33vw, 33vw" className="object-cover" /> : null}</div>
          <div className="contents lg:grid lg:grid-cols-2 lg:gap-1">
            {[2, 3].map((index) => <div key={photos[index]?.id ?? index} className="relative overflow-hidden rounded-md bg-zinc-900">{photos[index]?.url ? <Image src={photos[index].url} alt="" fill unoptimized sizes="(min-width: 1024px) 17vw, 33vw" className="object-cover" /> : null}</div>)}
          </div>
        </div>
      </div>
    </section>
  );
}
