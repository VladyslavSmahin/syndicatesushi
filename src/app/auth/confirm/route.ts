import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Посилання з листів (відновлення пароля, підтвердження пошти): ?token_hash=…&type=recovery|signup|email&next=/account?reset=1
// На відміну від /auth/callback (PKCE: ключ лежить у браузері, з якого просили лист), тут токен перевіряє сервер —
// тож посилання працює, навіть якщо лист відкрили на іншому пристрої чи в поштовому застосунку.
const TYPES: EmailOtpType[] = ["recovery", "signup", "email", "invite", "magiclink", "email_change"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // лише відносний шлях на цьому ж домені — захист від open redirect
  const rawNext = searchParams.get("next") ?? "";
  const fallbackNext = type === "recovery" ? "/account?reset=1" : "/account?confirmed=1";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\") ? rawNext : fallbackNext;

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("auth confirm:", error.message);
  }
  // посилання прострочене / вже використане — модалка входу з поясненням
  return NextResponse.redirect(`${origin}/?login=1&error=${type === "recovery" ? "reset" : "auth"}`);
}
