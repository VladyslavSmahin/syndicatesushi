"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  useDbProducts, useDbCategories, useDbPromos, useDbNavSpecials,
  dbReorderCategories, dbUpdateCategory, dbSetNavSpecialVisible, type DbCategory,
} from "@/features/admin/db";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
import OrderHandle from "@/components/admin/OrderHandle";
import { useDragOrder } from "@/components/admin/useDragOrder";
import s from "@/components/admin/admin.module.css";

export default function DashboardPage() {
  const { categories: cats } = useDbCategories();
  const { products: allProducts } = useDbProducts();
  const products = allProducts.filter((p) => !p.deletedAt);
  const { promos } = useDbPromos();
  const { user } = useAdminAuth();
  const supabase = useMemo(() => createClient(), []);
  const [staffCount, setStaffCount] = useState<number | null>(null);

  useEffect(() => {
    if (user?.role !== "admin") return;
    supabase.from("allowed_staff").select("id", { count: "exact", head: true })
      .then(({ count }) => setStaffCount(count ?? 0));
  }, [supabase, user?.role]);

  const stats = [
    { num: cats.length, label: "Категорії", href: "/admin/categories" },
    { num: products.length, label: "Товари", href: "/admin/products" },
    { num: products.filter((m) => m.badge === "ХІТ").length, label: "Хіти", href: "/admin/products" },
    { num: promos.length, label: "Акції", href: "/admin/promos" },
    { num: staffCount ?? "—", label: "Співробітники", href: "/admin/staff" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--text-primary)" }}>
          Вітаємо, {user?.name}!
        </h2>
        <p className={s.hint} style={{ marginTop: 6 }}>
          Ваша роль: <b style={{ color: "var(--accent)" }}>{user?.role}</b>.{" "}
          {user?.role === "editor"
            ? "Ви можете створювати та редагувати, але не видаляти."
            : "Ви маєте повний доступ."}
        </p>
      </div>

      <div className={s.statGrid}>
        {stats.map((st) => (
          <Link key={st.label} href={st.href} className={s.card} style={{ textDecoration: "none" }}>
            <div className={s.stat}>
              <div className={s.statNum}>{st.num}</div>
              <div className={s.statLabel}>{st.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <NavMenuPanel />
    </div>
  );
}

/** Пункти меню сайту: порядок перетягуванням + вмикання/вимикання в навігації. */
function NavMenuPanel() {
  const { categories, loading, refetch } = useDbCategories();
  const { specials, refetch: refetchSpecials } = useDbNavSpecials();

  // локальна копія — щоб перетягування було миттєвим, до відповіді БД
  const [items, setItems] = useState<DbCategory[]>([]);
  useEffect(() => { setItems(categories); }, [categories]);

  const ids = items.map((c) => c.id);
  const applyOrder = async (next: string[]) => {
    const byId = new Map(items.map((c) => [c.id, c] as const));
    setItems(next.map((id) => byId.get(id)).filter((c): c is DbCategory => !!c));
    await dbReorderCategories(next);
    refetch();
  };
  const drag = useDragOrder(applyOrder);

  const toggleNav = async (c: DbCategory) => {
    setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, showInNav: !x.showInNav } : x)));
    await dbUpdateCategory(c.id, { showInNav: !c.showInNav });
    refetch();
  };
  const toggleSpecial = async (id: string, visible: boolean) => {
    await dbSetNavSpecialVisible(specials, id, visible);
    refetchSpecials();
  };

  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <div className={s.cardTitle}>Меню сайту</div>
        <Link href="/admin/categories" className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`} style={{ textDecoration: "none" }}>
          Категорії
        </Link>
      </div>

      <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
        <p className={s.hint} style={{ margin: 0 }}>
          Порядок пунктів у шапці сайту та в бургер-меню. Перетягніть за ⠿ або скористайтесь ▲▼ —
          у цьому ж порядку йдуть товари в «Повному меню» (напр. «Додатково» варто тримати останнім).
          «Новинки» та «Акції» — закріплені пункти, вони завжди перед категоріями.
        </p>

        {specials.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {specials.map((sp) => (
              <div key={sp.id} className={s.sortRow} style={{ opacity: sp.showInNav ? 1 : 0.55 }}>
                <span className={s.dragCell} style={{ opacity: 0.3, paddingLeft: 4 }} aria-hidden>📌</span>
                <span style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>{sp.label}</span>
                <button className={`${s.pill} ${sp.showInNav ? s.pillOn : s.pillOff}`} style={{ cursor: "pointer", border: "none" }}
                  onClick={() => toggleSpecial(sp.id, !sp.showInNav)}>
                  {sp.showInNav ? "У меню" : "Прихований"}
                </button>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <p className={s.hint} style={{ margin: 0 }}>Завантаження…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((c, i) => (
              <div
                key={c.id}
                {...drag.rowProps(ids, c.id)}
                className={`${s.sortRow} ${drag.overId === c.id ? s.sortRowOver : ""}`}
                style={{ opacity: drag.dragId === c.id ? 0.45 : c.showInNav && c.isActive ? 1 : 0.55 }}
              >
                <OrderHandle
                  handleProps={drag.handleProps(c.id)}
                  canUp={i > 0}
                  canDown={i < items.length - 1}
                  onUp={() => drag.move(ids, c.id, -1)}
                  onDown={() => drag.move(ids, c.id, 1)}
                />
                <span style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>{c.name}</span>
                {!c.isActive && <span className={`${s.pill} ${s.pillOff}`}>Неактивна</span>}
                <button className={`${s.pill} ${c.showInNav ? s.pillOn : s.pillOff}`} style={{ cursor: "pointer", border: "none" }}
                  onClick={() => toggleNav(c)}>
                  {c.showInNav ? "У меню" : "Прихована"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
