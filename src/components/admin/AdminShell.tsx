"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ScrollTop from "./ScrollTop";
import RefreshButton from "./RefreshButton";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import { refreshAdminAction } from "@/features/admin/actions/common";
import s from "./admin.module.css";

const NAV: { group: string; items: { href: string; label: string }[] }[] = [
  {
    group: "Каталог",
    items: [
      { href: "/admin", label: "Огляд" },
      { href: "/admin/categories", label: "Категорії" },
      { href: "/admin/subcategories", label: "Підкатегорії" },
      { href: "/admin/products", label: "Товари" },
      { href: "/admin/deleted", label: "Кошик" },
      { href: "/admin/ingredients", label: "Інгредієнти" },
      { href: "/admin/price-history", label: "Історія цін" },
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
      { href: "/admin/orders/board", label: "Дошка замовлень" },
      { href: "/admin/orders", label: "Замовлення (список)" },
      { href: "/admin/reviews", label: "Відгуки" },
    ],
  },
  {
    group: "Система",
    items: [
      { href: "/admin/settings", label: "Доставка" },
      { href: "/admin/glossary", label: "Глосарій" },
      { href: "/admin/staff", label: "Співробітники" },
    ],
  },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, denied, logout } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  // куди йде перехід — для миттєвого візуального відгуку (спінер + підсвітка),
  // щоб не складалося враження зависання й не тиснули кілька разів
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const isLogin = pathname === "/admin/login";

  // перехід завершено (маршрут змінився) — прибираємо індикатор
  useEffect(() => { setNavOpen(false); setPendingHref(null); }, [pathname]);

  const signOut = async () => { await logout(); router.replace("/admin/login"); };

  // сторінка логіну — без оболонки
  if (isLogin) return <>{children}</>;

  // завантаження сесії/ролі
  if (loading) {
    return (
      <div className={s.login}>
        <div className={s.loginCard}><p className={s.hint}>Завантаження…</p></div>
      </div>
    );
  }

  // залогінений у Google, але email не в білому списку
  if (denied) {
    return (
      <div className={s.login}>
        <div className={s.loginCard}>
          <div className={s.placeholderTitle} style={{ marginBottom: 8 }}>Немає доступу</div>
          <p className={s.hint} style={{ marginBottom: 18 }}>
            Акаунт <b>{denied}</b> не входить у білий список співробітників.
            Зверніться до адміністратора, щоб вас додали.
          </p>
          <button className={`${s.btn} ${s.btnGhost}`} onClick={signOut}>Вийти</button>
        </div>
      </div>
    );
  }

  // немає сесії (middleware перенаправить) — нічого не рендеримо
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
              const pending = pendingHref === it.href;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => { if (pathname !== it.href) setPendingHref(it.href); }}
                  className={`${s.navItem} ${active || pending ? s.navItemActive : ""}`}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
                >
                  {it.label}
                  {pending && <Spinner />}
                </Link>
              );
            })}
          </div>
        ))}

        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <Link href="/" className={s.navItem}>← На сайт</Link>
          <button className={s.navItem} style={{ width: "100%", textAlign: "left", background: "transparent" }} onClick={signOut}>
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
            <RefreshButton action={refreshAdminAction} />
            <div className={s.avatar} title={`${user.name} · ${user.role}`}>{user.name.charAt(0).toUpperCase()}</div>
          </div>
        </div>

        <div className={s.content}>{children}</div>
      </div>
      <ScrollTop />
    </div>
  );
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
      strokeLinecap="round" style={{ animation: "spin 0.7s linear infinite", flexShrink: 0, opacity: 0.9 }}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}
