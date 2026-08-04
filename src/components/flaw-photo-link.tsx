"use client";

export function FlawPhotoLink({ photoId }: { photoId: string }) {
  return <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("drvn:open-photo", { detail: photoId }))} className="mt-2 text-xs font-semibold text-orange-400 hover:text-orange-300">Ver foto →</button>;
}
