"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { deleteDraftAction, saveListingAction } from "@/app/cuenta/anuncios/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  BODY_STYLES,
  DELETABLE_LISTING_STATUSES,
  DRIVETRAINS,
  FUEL_TYPES,
  initialListingActionState,
  TRANSMISSIONS,
} from "@/lib/listing-validation";
import type { ListingStatus } from "@/lib/constants";

type TaxonomyItem = { id: number; name: string };
type ModelItem = TaxonomyItem & { brand_id: number };
type ListingFormData = {
  id: string;
  category_id: number | null;
  brand_id: number | null;
  model_id: number | null;
  variant: string | null;
  year: number | null;
  city: string | null;
  state_region: string | null;
  price_mxn: number | string | null;
  mileage_km: number | null;
  exterior_color: string | null;
  interior_color: string | null;
  body_style: string | null;
  transmission: string | null;
  drivetrain: string | null;
  fuel_type: string | null;
  engine: string | null;
  owner_description: string | null;
  ownership_history: string | null;
  maintenance_history: string | null;
  modifications: string | null;
  known_issues: string | null;
  sale_reason: string | null;
  status: ListingStatus;
};

const inputClass = "mt-2 min-h-11 w-full border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-2 focus:outline-offset-2";

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? <p className="mt-1 text-sm text-red-700">{errors[0]}</p> : null;
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t pt-8">
      <legend className="text-xl font-black tracking-tight">{title}</legend>
      <p className="mt-1 text-sm text-stone-600">{description}</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function TextInput({ name, label, value, type = "text", min, max, step, errors }: {
  name: string; label: string; value: string | number | null; type?: string; min?: number; max?: number; step?: string; errors?: string[];
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input className={inputClass} name={name} type={type} min={min} max={max} step={step} defaultValue={value ?? ""} aria-invalid={errors?.length ? true : undefined} />
      <FieldError errors={errors} />
    </label>
  );
}

function SelectInput({ name, label, value, options, errors }: {
  name: string; label: string; value: string | null; options: readonly string[]; errors?: string[];
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <select className={inputClass} name={name} defaultValue={value ?? ""} aria-invalid={errors?.length ? true : undefined}>
        <option value="">Sin especificar</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <FieldError errors={errors} />
    </label>
  );
}

function StoryField({ name, label, value, errors, span = false }: { name: string; label: string; value: string | null; errors?: string[]; span?: boolean }) {
  return (
    <label className={`block text-sm font-semibold ${span ? "sm:col-span-2" : ""}`}>
      {label}
      <textarea className={`${inputClass} min-h-32 resize-y`} name={name} defaultValue={value ?? ""} aria-invalid={errors?.length ? true : undefined} />
      <FieldError errors={errors} />
    </label>
  );
}

export function ListingForm({ listing, categories, brands, models }: {
  listing: ListingFormData; categories: TaxonomyItem[]; brands: TaxonomyItem[]; models: ModelItem[];
}) {
  const action = saveListingAction.bind(null, listing.id);
  const [state, formAction] = useActionState(action, initialListingActionState);
  const [brandId, setBrandId] = useState(listing.brand_id?.toString() ?? "");
  const [modelId, setModelId] = useState(listing.model_id?.toString() ?? "");
  const [taxonomyNotice, setTaxonomyNotice] = useState("");
  const availableModels = models.filter((model) => model.brand_id.toString() === brandId);
  const errors = state.fieldErrors ?? {};
  const hasCategories = categories.length > 0;
  const hasBrands = brands.length > 0;
  const hasModelsForBrand = !brandId || availableModels.length > 0;

  return (
    <>
      <form action={formAction} onReset={(event) => event.preventDefault()} className="mt-10 space-y-10" noValidate>
        <Section title="Identificación" description="Los catálogos activos provienen de Supabase.">
          <label className="block text-sm font-semibold">
            Categoría
            <select className={inputClass} name="category_id" defaultValue={listing.category_id ?? ""} disabled={!hasCategories} aria-invalid={errors.category_id?.length ? true : undefined}>
              <option value="">{hasCategories ? "Selecciona una categoría" : "No hay categorías activas disponibles"}</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {!hasCategories ? <p className="mt-1 text-sm text-amber-800">No encontramos categorías activas. Revisa que la migración de taxonomías esté aplicada.</p> : null}
            <FieldError errors={errors.category_id} />
          </label>
          <label className="block text-sm font-semibold">
            Marca
            <select className={inputClass} name="brand_id" value={brandId} disabled={!hasBrands} onChange={(event) => {
              const nextBrand = event.target.value;
              const currentModel = models.find((model) => model.id.toString() === modelId);
              if (currentModel && currentModel.brand_id.toString() !== nextBrand) {
                setModelId("");
                setTaxonomyNotice("El modelo se limpió porque no pertenece a la nueva marca.");
              } else setTaxonomyNotice("");
              setBrandId(nextBrand);
            }} aria-invalid={errors.brand_id?.length ? true : undefined}>
              <option value="">{hasBrands ? "Selecciona una marca" : "No hay marcas activas disponibles"}</option>
              {brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {!hasBrands ? <p className="mt-1 text-sm text-amber-800">No encontramos marcas activas. Revisa que la migración de taxonomías esté aplicada.</p> : null}
            <FieldError errors={errors.brand_id} />
          </label>
          <label className="block text-sm font-semibold">
            Modelo
            <select className={inputClass} name="model_id" value={modelId} onChange={(event) => setModelId(event.target.value)} disabled={!brandId || !hasModelsForBrand} aria-invalid={errors.model_id?.length ? true : undefined}>
              <option value="">{brandId ? (hasModelsForBrand ? "Selecciona un modelo" : "No hay modelos activos para esta marca") : "Selecciona primero una marca"}</option>
              {availableModels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {brandId && !hasModelsForBrand ? <p className="mt-1 text-sm text-amber-800">La marca seleccionada no tiene modelos activos disponibles.</p> : null}
            <FieldError errors={errors.model_id} />
            <p aria-live="polite" className="mt-1 text-sm text-amber-800">{taxonomyNotice}</p>
          </label>
          <TextInput name="variant" label="Variante" value={listing.variant} errors={errors.variant} />
          <TextInput name="year" label="Año" type="number" min={1886} max={new Date().getFullYear() + 1} value={listing.year} errors={errors.year} />
          <TextInput name="city" label="Ciudad" value={listing.city} errors={errors.city} />
          <TextInput name="state_region" label="Estado" value={listing.state_region} errors={errors.state_region} />
        </Section>

      <Section title="Datos comerciales" description="Importes y kilometraje se guardan sin valores negativos.">
        <TextInput name="price_mxn" label="Precio en MXN" type="number" min={0} step="0.01" value={listing.price_mxn} errors={errors.price_mxn} />
        <TextInput name="mileage_km" label="Kilometraje" type="number" min={0} step="1" value={listing.mileage_km} errors={errors.mileage_km} />
        <TextInput name="exterior_color" label="Color exterior" value={listing.exterior_color} errors={errors.exterior_color} />
        <TextInput name="interior_color" label="Color interior" value={listing.interior_color} errors={errors.interior_color} />
      </Section>

      <Section title="Especificaciones" description="Describe la configuración actual del vehículo.">
        <SelectInput name="body_style" label="Carrocería" value={listing.body_style} options={BODY_STYLES} errors={errors.body_style} />
        <SelectInput name="transmission" label="Transmisión" value={listing.transmission} options={TRANSMISSIONS} errors={errors.transmission} />
        <SelectInput name="drivetrain" label="Tracción" value={listing.drivetrain} options={DRIVETRAINS} errors={errors.drivetrain} />
        <SelectInput name="fuel_type" label="Combustible" value={listing.fuel_type} options={FUEL_TYPES} errors={errors.fuel_type} />
        <TextInput name="engine" label="Motor" value={listing.engine} errors={errors.engine} />
      </Section>

      <Section title="Historia del propietario" description="Estos textos son tuyos y se mantienen separados de la edición reservada para staff.">
        <StoryField name="owner_description" label="Descripción general" value={listing.owner_description} errors={errors.owner_description} span />
        <StoryField name="ownership_history" label="Historia de propiedad" value={listing.ownership_history} errors={errors.ownership_history} />
        <StoryField name="maintenance_history" label="Historial de mantenimiento" value={listing.maintenance_history} errors={errors.maintenance_history} />
        <StoryField name="modifications" label="Modificaciones" value={listing.modifications} errors={errors.modifications} />
        <StoryField name="known_issues" label="Problemas conocidos" value={listing.known_issues} errors={errors.known_issues} />
        <StoryField name="sale_reason" label="Motivo de venta" value={listing.sale_reason} errors={errors.sale_reason} span />
      </Section>

        <div className="sticky bottom-0 flex flex-col gap-3 border-t bg-stone-50/95 py-4 backdrop-blur sm:flex-row sm:items-center">
          <SubmitButton idle="Guardar borrador" pending="Guardando…" />
          <Link href={`/cuenta/anuncios/${listing.id}/vista-previa`} className="inline-flex min-h-11 items-center justify-center border px-5 py-3 text-sm font-bold hover:border-accent hover:text-accent">Vista previa</Link>
          <p role={state.status === "error" ? "alert" : "status"} className={`text-sm font-medium ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p>
        </div>
      </form>
      {DELETABLE_LISTING_STATUSES.includes(listing.status as (typeof DELETABLE_LISTING_STATUSES)[number]) ? <DeleteDraftForm listingId={listing.id} /> : null}
    </>
  );
}

function DeleteDraftForm({ listingId }: { listingId: string }) {
  const action = deleteDraftAction.bind(null, listingId);
  const [state, formAction] = useActionState(action, initialListingActionState);
  return (
    <form action={formAction} className="mt-10 border-t pt-8">
      <h2 className="text-lg font-black tracking-tight">Eliminar borrador</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">Esta acción elimina el borrador privado, todas sus fotografías en Storage y sus relaciones guardadas.</p>
      <label className="mt-4 flex max-w-2xl items-start gap-3 text-sm font-semibold">
        <input className="mt-1" type="checkbox" name="confirm_delete" value="yes" />
        Confirmo que quiero eliminar este borrador.
      </label>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton idle="Eliminar borrador" pending="Eliminando…" className="inline-flex min-h-11 items-center justify-center border border-red-700 px-5 py-3 text-sm font-bold text-red-700 hover:bg-red-700 hover:text-white disabled:cursor-wait disabled:opacity-60" />
        {state.message ? <p role={state.status === "error" ? "alert" : "status"} className={`text-sm font-medium ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p> : null}
      </div>
    </form>
  );
}
