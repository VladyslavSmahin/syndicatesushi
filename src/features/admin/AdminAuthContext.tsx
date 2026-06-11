"use client";

// Реальна авторизація адмінки через Supabase Auth (Google OAuth).
// Роль береться з таблиці profiles (її заповнює тригер handle_new_user лише для
// email із білого списку allowed_staff). Якщо профілю немає — доступу немає (denied).

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export type Role = "admin" | "editor";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

interface AdminAuthValue {
  user: CurrentUser | null;
  /** ще завантажуємо сесію/роль */
  loading: boolean;
  /** залогінений у Google, але email не в білому списку (немає profile) */
  denied: string | null;
  logout: () => Promise<void>;
}

const Ctx = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const resolve = async (session: { user: { id: string; email?: string; user_metadata?: Record<string, unknown> } } | null) => {
      if (!session?.user) {
        if (active) { setUser(null); setDenied(null); setLoading(false); }
        return;
      }
      const au = session.user;
      // роль із profiles (заповнюється тригером лише для білого списку)
      const { data } = await supabase.from("profiles").select("role").eq("id", au.id).maybeSingle();
      if (!active) return;
      if (data?.role) {
        setUser({
          id: au.id,
          email: au.email ?? "",
          name: (au.user_metadata?.full_name as string) ?? (au.user_metadata?.name as string) ?? au.email ?? "",
          role: data.role as Role,
        });
        setDenied(null);
      } else {
        setUser(null);
        setDenied(au.email ?? "невідомий email");
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => resolve(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(true);
      resolve(session);
    });

    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [supabase]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setDenied(null);
  }, [supabase]);

  return <Ctx.Provider value={{ user, loading, denied, logout }}>{children}</Ctx.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
