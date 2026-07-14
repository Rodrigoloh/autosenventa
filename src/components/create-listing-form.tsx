"use client";

import { useActionState } from "react";
import { createDraftAction } from "@/app/cuenta/anuncios/actions";
import { initialListingActionState } from "@/lib/listing-validation";
import { SubmitButton } from "@/components/submit-button";

export function CreateListingForm() {
  const [state, action] = useActionState(createDraftAction, initialListingActionState);
  return (
    <form action={action} className="mt-8">
      <SubmitButton idle="Crear anuncio" pending="Creando borrador…" />
      {state.status === "error" ? <p role="alert" className="mt-4 text-sm font-medium text-red-700">{state.message}</p> : null}
    </form>
  );
}
