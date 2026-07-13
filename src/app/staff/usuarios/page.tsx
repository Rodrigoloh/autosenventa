import { EmptyState } from "@/components/empty-state"; import { requireRole } from "@/lib/auth";
export default async function UsersPage() { await requireRole(["admin"]); return <EmptyState title="Usuarios" description="La gestión de roles estará disponible cuando exista un proyecto Supabase conectado." />; }
