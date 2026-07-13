import Link from "next/link";

export function EmptyState({ title, description, href, action }: {
  title: string; description: string; href?: string; action?: string;
}) {
  return (
    <section className="border-y py-20 text-center">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mx-auto mt-4 max-w-xl text-stone-600">{description}</p>
      {href && action ? (
        <Link href={href} className="mt-8 inline-flex bg-stone-950 px-5 py-3 text-sm font-semibold text-white hover:bg-accent">
          {action}
        </Link>
      ) : null}
    </section>
  );
}
