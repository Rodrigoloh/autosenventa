import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
export default async function ReviewListingPage() { await requireRole(["staff", "admin"]); notFound(); }
