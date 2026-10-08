"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import RefreshButton from "./RefreshButton";
import BrandMark from "../BrandMark";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import { refreshAdminAction } from "@/features/admin/actions/common";
import { useScrollLock } from "@/lib/scrollLock";
import s from "./admin.module.css";

// Кошик (видалені товари) — не пункт меню, а іконка в топбарі: заходять рідко
const TRASH = { href: "/admin/deleted", label: "Кошик" };

// групи меню за замовчуванням згорнуті; стан запамʼятовуємо для кожного співробітника (localStorage, ключ з id)
const collapsedKey = (uid: string) => `admin-nav-collapsed:${uid}`;

const NAV: { group: string; items: { href: string; label: string }[] }[] = [
  {
    group: "Каталог",
    items: [
      { href: "/admin", label: "Огляд" },
      { href: "/admin/categories", label: "Категорії" },
      { href: "/admin/subcategories", label: "Підкатегорії" },
      { href: "/admin/products", label: "Товари" },
      { href: "/admin/ingredients", label: "Інгредієнти" },
      { href: "/admin/price-history", label: "Історія цін" },
    ],
  },
  {
    group: "Маркетинг",
    items: [
      { href: "/admin/promos", label: "Акції" },
      { href: "/admin/promo-codes", label: "Промокоди" },
      { href: "/admin/hero-bg", label: "Фон головної" },
    ],
  },
  {
    group: "Замовлення",
    items: [
      { href: "/admin/orders/board", label: "Дошка замовлень" },
      { href: "/admin/reviews", label: "Відгуки" },
    ],
  },
  {
    group: "Клієнти",
    items: [
      { href: "/admin/customers", label: "Клієнти" },
      { href: "/admin/stats", label: "Статистика" },
    ],
  },
  {
    group: "Система",
    items: [
      { href: "/admin/settings", label: "Доставка" },
      { href: "/admin/contacts", label: "Контакти" },
      { href: "/admin/seo-text", label: "SEO-текст" },
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
  const [collapsed, setCollapsed] = useState<string[]>(() => NAV.map((g) => g.group));
  const uid = user?.id ?? null;

  const save = useCallback((next: string[]) => {
    if (!uid) return;
    try { localStorage.setItem(collapsedKey(uid), JSON.stringify(next)); } catch { /* ignore */ }
  }, [uid]);

  /** Група поточної сторінки має бути розгорнута (щоб було видно, де ви). */
  const withActiveOpen = useCallback((list: string[]) => {
    const active = NAV.find((g) => g.items.some((it) => it.href === pathname))?.group;
    return active && list.includes(active) ? list.filter((g) => g !== active) : list;
  }, [pathname]);

  // збережений стан цього співробітника
  useEffect(() => {
    if (!uid) return;
    let list: string[] = NAV.map((g) => g.group);
    try {
      const parsed = JSON.parse(localStorage.getItem(collapsedKey(uid)) ?? "null");
      if (Array.isArray(parsed)) list = parsed.filter((g): g is string => typeof g === "string");
    } catch { /* немає доступу до сховища — лишаємо дефолт */ }
    setCollapsed(withActiveOpen(list));
    // лише при зміні співробітника; перехід між сторінками обробляє ефект нижче
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const toggleGroup = (group: string) =>
    setCollapsed((prev) => {
      const next = prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group];
      save(next);
      return next;
    });

  // відкрите бургер-меню — сторінка адмінки під ним не прокручується
  useScrollLock(navOpen);

  // ---- свайп вліво/вправо (телефон) — сусідній розділ меню, наскрізь через групи ----
  const touch = useRef<{ x: number; y: number; t: number; skip: boolean } | null>(null);
  const flat = NAV.flatMap((g) => g.items);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now(), skip: e.touches.length > 1 || !swipeAllowed(e.target as HTMLElement) };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const st = touch.current;
    touch.current = null;
    if (!st || st.skip || window.innerWidth > 880) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - st.x, dy = t.clientY - st.y;
    // чіткий горизонтальний жест: довгий, швидкий, майже без вертикалі
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - st.t > 700) return;
    const i = flat.findIndex((it) => it.href === pathname);
    if (i < 0) return;
    const next = flat[i + (dx < 0 ? 1 : -1)];
    if (!next) return; // крайні розділи — далі нікуди
    setPendingHref(next.href);
    router.push(next.href);
  };

  const isLogin = pathname === "/admin/login";

  // перехід завершено (маршрут змінився) — прибираємо індикатор
  useEffect(() => { setNavOpen(false); setPendingHref(null); }, [pathname]);

  // перейшли на сторінку зі згорнутої групи — розгортаємо її (далі користувач може знову згорнути)
  useEffect(() => {
    setCollapsed((prev) => {
      const next = withActiveOpen(prev);
      if (next !== prev) save(next);
      return next;
    });
  }, [withActiveOpen, save]);

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
    [...NAV.flatMap((g) => g.items), TRASH].find((i) => i.href === pathname)?.label ?? "Адмінка";

  return (
    <div className={s.frame}>
      {/* шапка спільна з сайтом: той самий логотип, клік — на сайт */}
      <header className={s.topbar}>
        <div className={s.topLeft}>
          <button className={s.menuBtn} aria-label="Меню" onClick={() => setNavOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <BrandMark href="/" title="На сайт" />
          <span className={s.adminTag}>Адмінпанель</span>
        </div>

        <div className={s.userBox}>
          <RefreshButton action={refreshAdminAction} />
          <Link
            href={TRASH.href}
            title="Кошик (видалені товари)"
            aria-label="Кошик"
            className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`}
            style={{ display: "inline-flex", alignItems: "center", ...(pathname === TRASH.href ? { color: "var(--accent)", borderColor: "var(--accent)" } : {}) }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
            </svg>
          </Link>
          {/* аватар — у свій профіль (кабінет на сайті) */}
          <Link href="/account" className={s.avatar} title={`Мій профіль · ${user.name} · ${user.role}`} aria-label="Мій профіль" style={{ textDecoration: "none" }}>
            {user.name.charAt(0).toUpperCase()}
          </Link>
        </div>
      </header>

    <div className={s.shell}>
      {navOpen && <div className={s.overlay} onClick={() => setNavOpen(false)} />}
      <aside className={`${s.sidebar} ${navOpen ? s.sidebarOpen : ""}`}>

        {NAV.map((g) => {
          const open = !collapsed.includes(g.group);
          return (
          <div key={g.group}>
            <button
              type="button"
              className={`${s.navGroupLabel} ${s.navGroupToggle}`}
              onClick={() => toggleGroup(g.group)}
              aria-expanded={open}
            >
              {g.group}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {open && g.items.map((it) => {
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
          );
        })}

        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <button className={s.navItem} style={{ width: "100%", textAlign: "left", background: "transparent" }} onClick={signOut}>
            Вийти
          </button>
        </div>
      </aside>

      <div className={s.main} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <h1 className={s.pageTitle}>{title}</h1>
        <div className={s.content}>{children}</div>
      </div>
    </div>
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

/** Чи можна починати свайп-перехід із цього елемента: не з полів вводу, не з модалки
 *  і не з горизонтально прокручуваних блоків (слайдери чипів, таблиці, графік). */
function swipeAllowed(el: HTMLElement | null): boolean {
  if (document.body.style.overflow === "hidden") return false; // відкрита модалка адмінки
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName) || n.isContentEditable) return false;
    if (n.getAttribute("draggable") === "true") return false; // перетягування рядків
    const ox = getComputedStyle(n).overflowX;
    if ((ox === "auto" || ox === "scroll") && n.scrollWidth > n.clientWidth + 2) return false;
  }
  return true;
}
