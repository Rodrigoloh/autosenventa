"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ idle, pending, className }: { idle: string; pending: string; className?: string }) {
  const { pending: isPending } = useFormStatus();
  return (
    <button type="submit" disabled={isPending} className={className ?? "inline-flex min-h-11 items-center justify-center bg-stone-950 px-5 py-3 text-sm font-bold text-white hover:bg-accent disabled:cursor-wait disabled:opacity-60"}>
      {isPending ? pending : idle}
    </button>
  );
}
