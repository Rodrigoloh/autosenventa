import { EmptyState } from "@/components/empty-state";
export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-14 lg:px-8"><EmptyState title="Marca" description={`Aún no hay publicaciones disponibles de “${slug}”.`} /></main>; }
