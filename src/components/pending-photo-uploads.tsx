"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelPhotoUploadAction } from "@/app/cuenta/anuncios/photo-actions";
import type { PendingListingPhotoUpload } from "@/lib/listing-media";

export function PendingPhotoUploads({ uploads }: { uploads: PendingListingPhotoUpload[] }) {
  const router = useRouter();
  const [items, setItems] = useState(uploads);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function clean(id: string) {
    if (busy) return;
    setBusy(id);
    setMessage("Limpiando subida…");
    const result = await cancelPhotoUploadAction(id);
    if (result.ok) {
      setItems((current) => current.filter((item) => item.id !== id));
      setMessage("Subida cancelada.");
      router.refresh();
    } else {
      setMessage(result.message);
    }
    setBusy(null);
  }

  if (!items.length) return null;
  return (
    <section className="border-y border-amber-700 bg-amber-50 p-5" aria-labelledby="pending-uploads-title">
      <h2 id="pending-uploads-title" className="text-xl font-black">Subidas pendientes</h2>
      <p className="mt-1 text-sm text-amber-950">Estas reservas bloquean el envío hasta limpiarse.</p>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.id} className="border border-amber-300 bg-white p-3 text-sm">
            <p className="font-bold">
              {item.expectedMimeType} · {new Intl.NumberFormat("es-MX").format(item.expectedSizeBytes)} bytes
            </p>
            <p className="mt-1 text-stone-600">
              {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}
              {" · "}{item.expired ? "Expirada" : "Vigente"}
            </p>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void clean(item.id)}
              className="mt-3 border border-red-700 px-3 py-2 font-bold text-red-800 disabled:opacity-50"
            >
              {busy === item.id ? "Limpiando…" : "Cancelar y limpiar subida"}
            </button>
          </li>
        ))}
      </ul>
      <p role="status" className="mt-3 text-sm font-bold">{message}</p>
    </section>
  );
}
