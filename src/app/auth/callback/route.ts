import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth-callback: обмінюємо code на сесію (PKCE) і повертаємось в адмінку.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // лише відносний шлях на цьому ж домені — захист від open redirect («//evil.com», «/\\evil.com»)
  const rawNext = searchParams.get("next") ?? "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\") ? rawNext : "/admin";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/admin/login?error=auth`);
}
