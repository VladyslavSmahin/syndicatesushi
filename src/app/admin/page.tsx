"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDbProducts, useDbCategories, useDbPromos } from "@/features/admin/db";
import { useAdminAuth } from "@/features/admin/AdminAuthContext";
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

      <div className={s.card}>
        <div className={s.cardHead}>
          <div className={s.cardTitle}>Швидкі дії</div>
        </div>
        <div style={{ padding: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/admin/categories" className={`${s.btn} ${s.btnGhost}`} style={{ textDecoration: "none" }}>
            + Категорія
          </Link>
          <Link href="/admin/products" className={`${s.btn} ${s.btnGhost}`} style={{ textDecoration: "none" }}>
            + Товар
          </Link>
          <Link href="/admin/staff" className={`${s.btn} ${s.btnGhost}`} style={{ textDecoration: "none" }}>
            + Співробітник
          </Link>
        </div>
      </div>
    </div>
  );
}
