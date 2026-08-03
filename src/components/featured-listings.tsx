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
    <section aria-label="Auto destacado" className="relative bg-black">
      <div className="grid min-h-[34rem] lg:grid-cols-[minmax(0,3fr)_minmax(15rem,1fr)]">
        <Link href={`/autos/${listing.id}`} className="group relative min-h-[28rem] overflow-hidden bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-orange-500">
          {cover?.url ? <Image src={cover.url} alt={title} fill priority unoptimized sizes="(min-width: 1024px) 75vw, 100vw" className="object-cover transition duration-700 group-hover:scale-[1.015]" /> : <div className="grid h-full place-items-center text-xs font-bold uppercase tracking-[0.25em] text-zinc-600">Fotografía pendiente</div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/5 to-black/15" />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-9">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-400">Selección driven-mx</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">{title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-200">
              <strong className="text-xl text-white sm:text-2xl">{formatMxn(listing.priceMxn)}</strong>
              <span>{listing.mileageKm === null ? "Km no indicados" : `${new Intl.NumberFormat("es-MX").format(listing.mileageKm)} km`}</span>
              <span className="flex items-center gap-1"><MapPin className="size-4" aria-hidden="true" />{[listing.city, listing.stateRegion].filter(Boolean).join(", ") || "México"}</span>
            </div>
          </div>
        </Link>
        <div className="hidden grid-rows-3 gap-px bg-black lg:grid">
          {[1, 2, 3].map((index) => {
            const photo = photos[index];
            return <div key={photo?.id ?? index} className="relative overflow-hidden bg-zinc-900">{photo?.url ? <Image src={photo.url} alt="" fill unoptimized sizes="25vw" className="object-cover" /> : <div className="h-full bg-[linear-gradient(135deg,#18181b,#09090b)]" />}</div>;
          })}
        </div>
      </div>
      {listings.length > 1 ? <div className="absolute right-4 top-4 flex items-center gap-2" aria-label="Cambiar auto destacado">
        <button type="button" onClick={() => change(-1)} aria-label="Destacado anterior" className="grid size-11 place-items-center bg-black/70 text-white backdrop-blur hover:bg-orange-600"><ArrowLeft className="size-4" /></button>
        <span className="bg-black/70 px-3 py-3 text-xs font-bold tabular-nums text-white backdrop-blur">{activeIndex + 1} / {listings.length}</span>
        <button type="button" onClick={() => change(1)} aria-label="Siguiente destacado" className="grid size-11 place-items-center bg-black/70 text-white backdrop-blur hover:bg-orange-600"><ArrowRight className="size-4" /></button>
      </div> : null}
    </section>
  );
}
