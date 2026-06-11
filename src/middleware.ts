import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Гард та оновлення сесії лише для адмінки.
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*"],
};
