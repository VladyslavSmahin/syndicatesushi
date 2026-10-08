import { NextResponse } from "next/server";
import { isStaff } from "@/lib/adminAuth";
import { syncTikTok } from "@/lib/tiktokSync.server";

// sharp (обкладинки) потребує Node-рантайму.
export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/tiktok/sync — кнопка «Оновити зараз» в адмінці (лише співробітники).
export async function POST() {
  if (!(await isStaff())) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const r = await syncTikTok(true);
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
