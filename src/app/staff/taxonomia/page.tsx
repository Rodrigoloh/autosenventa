import { EmptyState } from "@/components/empty-state";
import { requireRole } from "@/lib/auth";
export default async function TaxonomyPage() { await requireRole(["staff", "admin"]); return <EmptyState title="Taxonomía" description="La administración de categorías, marcas y modelos se habilitará en la fase de catálogo." />; }
