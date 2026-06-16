import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Оновлює сесію (refresh токенів у cookies) і захищає /admin:
// без сесії → редірект на /admin/login; із сесією на /admin/login → в /admin.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Роль із profiles (заповнюється з allowed_staff). Перевіряємо на сервері,
  // а не лише на клієнті — інакше будь-який залогінений Google-акаунт бачив би /admin.
  let isStaff = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    isStaff = profile?.role === "admin" || profile?.role === "editor";
  }

  const path = request.nextUrl.pathname;
  const isLogin = path === "/admin/login";

  if (!isLogin) {
    // немає сесії → на логін; є сесія, але не staff → відмова (без доступу до сторінок)
    if (!user || !isStaff) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      if (user && !isStaff) url.searchParams.set("denied", "1");
      return NextResponse.redirect(url);
    }
  } else if (isStaff) {
    // staff на сторінці логіну → одразу в адмінку
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
