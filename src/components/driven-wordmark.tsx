import Image from "next/image";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export function DrivenWordmark({ className = "" }: { className?: string }) {
  return <Link href="/" aria-label={SITE_NAME} className={`driven-wordmark ${className}`}>
    <Image src="/drvn-mx-logo.png" alt="" width={1656} height={269} priority className="h-auto w-full" />
  </Link>;
}
