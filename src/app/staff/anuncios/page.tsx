import { EmptyState } from "@/components/empty-state";
import { requireRole } from "@/lib/auth";
export default async function ReviewQueuePage() { await requireRole(["staff", "admin"]); return <EmptyState title="Cola de revisión" description="No hay anuncios pendientes de revisión." />; }
