"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAdminAuth, type Role } from "@/features/admin/AdminAuthContext";
import s from "./admin.module.css";

const NAV: { group: string; items: { href: string; label: string }[] }[] = [
  {
    group: "Каталог",
    items: [
      { href: "/admin", label: "Огляд" },
      { href: "/admin/categories", label: "Категорії" },
      { href: "/admin/products", label: "Товари" },
      { href: "/admin/ingredients", label: "Інгредієнти" },
    ],
  },
  {
    group: "Маркетинг",
    items: [
      { href: "/admin/promos", label: "Акції" },
      { href: "/admin/promo-codes", label: "Промокоди" },
    ],
  },
  {
    group: "Замовлення",
    items: [
      { href: "/admin/orders", label: "Замовлення" },
      { href: "/admin/reviews", label: "Відгуки" },
    ],
  },
  {
    group: "Система",
    items: [{ href: "/admin/staff", label: "Співробітники" }],
  },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout, setRole } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  const isLogin = pathname === "/admin/login";

  // guard: не залогінений → на /admin/login
  useEffect(() => {
    if (!isLogin && user === null) router.replace("/admin/login");
  }, [isLogin, user, router]);

  useEffect(() => { setNavOpen(false); }, [pathname]);

  // сторінка логіну — без оболонки
  if (isLogin) return <>{children}</>;
  // поки немає юзера (редірект у процесі) — нічого не рендеримо
  if (!user) return null;

  const title =
    NAV.flatMap((g) => g.items).find((i) => i.href === pathname)?.label ?? "Адмінка";

  return (
    <div className={s.shell}>
      {navOpen && <div className={s.overlay} onClick={() => setNavOpen(false)} />}
      <aside className={`${s.sidebar} ${navOpen ? s.sidebarOpen : ""}`}>
        <Link href="/admin" className={s.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo-fish.png" alt="" style={{ height: 34 }} />
          <div>
            <div className={s.brandText}>SUSHI</div>
            <div className={s.brandSub}>Адмінпанель</div>
          </div>
        </Link>

        {NAV.map((g) => (
          <div key={g.group}>
            <div className={s.navGroupLabel}>{g.group}</div>
            {g.items.map((it) => {
              const active = pathname === it.href;
              return (
                <Link key={it.href} href={it.href} className={`${s.navItem} ${active ? s.navItemActive : ""}`}>
                  {it.label}
                </Link>
              );
            })}
          </div>
        ))}

        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <Link href="/" className={s.navItem}>← На сайт</Link>
          <button className={s.navItem} style={{ width: "100%", textAlign: "left", background: "transparent" }} onClick={logout}>
            Вийти
          </button>
        </div>
      </aside>

      <div className={s.main}>
        <div className={s.topbar}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className={s.menuBtn} aria-label="Меню" onClick={() => setNavOpen(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <div className={s.topTitle}>{title}</div>
          </div>

          <div className={s.userBox}>
            {/* ДЕМО: перемикач ролі, щоб побачити обмеження editor */}
            <div className={s.roleSwitch} title="Демо: перемкнути роль">
              {(["admin", "editor"] as Role[]).map((r) => (
                <button
                  key={r}
                  className={`${s.roleBtn} ${user.role === r ? s.roleBtnActive : ""}`}
                  onClick={() => setRole(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className={s.avatar}>{user.name.charAt(0)}</div>
          </div>
        </div>

        <div className={s.content}>{children}</div>
      </div>
    </div>
  );
}
