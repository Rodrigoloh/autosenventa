import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export function DrivenWordmark({ className = "" }: { className?: string }) {
  return <Link href="/" aria-label={SITE_NAME} className={`driven-wordmark ${className}`} data-wordmark={SITE_NAME}>{SITE_NAME}</Link>;
}
