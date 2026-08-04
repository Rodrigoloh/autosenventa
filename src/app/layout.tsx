import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SITE_NAME } from "@/lib/constants";
import { getViewer } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: "Automóviles interesantes, publicados por sus propietarios.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer = await getViewer();
  const sellHref = viewer ? "/cuenta/anuncios/nuevo" : "/login?next=%2Fcuenta%2Fanuncios%2Fnuevo";
  return (
    <html
      lang="es-MX"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-stone-50 text-stone-950">
        <SiteHeader />
        {children}
        <SiteFooter sellHref={sellHref} />
      </body>
    </html>
  );
}
