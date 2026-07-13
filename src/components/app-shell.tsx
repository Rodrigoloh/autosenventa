import Link from "next/link";

export function AppShell({ title, nav, children }: {
  title: string; nav: { href: string; label: string }[]; children: React.ReactNode;
}) {
  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-8 px-5 py-10 md:grid-cols-[220px_1fr] lg:px-8">
      <aside>
        <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-stone-500">{title}</p>
        <nav className="flex flex-col gap-1">{nav.map((item) => (
          <Link key={item.href} href={item.href} className="border-l-2 px-3 py-2 text-sm hover:border-accent hover:text-accent">{item.label}</Link>
        ))}</nav>
      </aside>
      <div>{children}</div>
    </main>
  );
}
