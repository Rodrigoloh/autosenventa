"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DrivenWordmark } from "@/components/driven-wordmark";

const publicPrefixes = ["/autos", "/eventos", "/nosotros", "/u/", "/marcas/", "/categorias/", "/terminos", "/privacidad"];

export function SiteFooter({ sellHref }: { sellHref: string }) {
  const pathname = usePathname();
  const isPublic = pathname === "/" || publicPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (!isPublic) return null;

  return <footer className="public-shell border-t public-rule">
    <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-14">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <DrivenWordmark className="w-40" />
          <p className="mt-5 max-w-xs text-sm leading-6 text-zinc-500">Autos interesantes, publicados por quienes los conocen mejor.</p>
          <div className="mt-6 flex gap-2">
            <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram" className="grid size-10 place-items-center rounded-full border public-rule text-[10px] font-bold text-zinc-400 transition hover:border-orange-500 hover:text-white">IG</a>
            <a href="https://www.youtube.com/" target="_blank" rel="noreferrer" aria-label="YouTube" className="grid size-10 place-items-center rounded-full border public-rule text-[10px] font-bold text-zinc-400 transition hover:border-orange-500 hover:text-white">YT</a>
            <a href="https://x.com/" target="_blank" rel="noreferrer" aria-label="X" className="grid size-10 place-items-center rounded-full border public-rule text-xs font-bold text-zinc-400 transition hover:border-orange-500 hover:text-white">X</a>
          </div>
        </div>
        <FooterGroup title="Qué es" links={[{ href: "/nosotros", label: "Nosotros" }, { href: "/autos", label: "Explorar autos" }, { href: "/eventos", label: "Eventos" }]} />
        <FooterGroup title="Vendedores" links={[{ href: sellHref, label: "Vende tu auto" }, { href: "/cuenta/anuncios", label: "Mis anuncios" }, { href: "/nosotros#vendedores", label: "Cómo publicar" }]} />
        <FooterGroup title="Links de ayuda" links={[{ href: "/nosotros#ayuda", label: "Preguntas frecuentes" }, { href: "mailto:ayuda@drvn.mx", label: "Contacto" }, { href: "/nosotros#seguridad", label: "Seguridad" }]} />
      </div>
      <div className="mt-12 flex flex-col gap-4 border-t public-rule pt-6 text-[11px] text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} drvn.mx</p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2"><Link href="/terminos" className="hover:text-zinc-300">Términos de uso</Link><Link href="/privacidad" className="hover:text-zinc-300">Privacidad</Link><a href="mailto:ayuda@drvn.mx" className="hover:text-zinc-300">Contacto</a></nav>
      </div>
    </div>
  </footer>;
}

function FooterGroup({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return <section><h2 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-200">{title}</h2><ul className="mt-5 space-y-3 text-sm text-zinc-500">{links.map((link) => <li key={link.href}><Link href={link.href} className="transition-colors hover:text-white">{link.label}</Link></li>)}</ul></section>;
}
