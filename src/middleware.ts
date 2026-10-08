import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Оновлення сесії: адмінка (з гардом) і кабінет клієнта (лише refresh токенів).
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
