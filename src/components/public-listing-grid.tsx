import { PublicListingCard } from "@/components/public-listing-card";
import type { PublicListingSummary } from "@/lib/public-marketplace";

export function PublicListingGrid({ listings }: { listings: PublicListingSummary[] }) {
  return <div className="grid min-w-0 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">{listings.map((listing) => <PublicListingCard key={listing.id} listing={listing} />)}</div>;
}
