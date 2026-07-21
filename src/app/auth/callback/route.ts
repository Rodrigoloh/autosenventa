import { NextResponse, type NextRequest } from "next/server";
import { defaultPathForRole, safeInternalPath } from "@/lib/auth-policy";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=confirmation", request.url));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=confirmation", request.url));
  const { data: authData } = await supabase.auth.getUser();
  const { data: profile } = authData.user
    ? await supabase.from("profiles").select("role").eq("id", authData.user.id).maybeSingle()
    : { data: null };
  const fallback = profile ? defaultPathForRole(profile.role) : "/cuenta";
  const next = safeInternalPath(request.nextUrl.searchParams.get("next"), fallback);
  return NextResponse.redirect(new URL(next, request.url));
}
