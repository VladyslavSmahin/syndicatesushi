"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useAccount, signOutCustomer, updatePassword, type AccountOrder } from "@/features/account";
import { MIN_PASSWORD } from "./AuthForm";
import { useRouter } from "next/navigation";
import { formatPhone, isPhoneValid } from "@/lib/phone";
import { kyivNow, addDays } from "@/lib/kyivTime";
import { useFavorites } from "@/features/favorites/FavoritesContext";
import { useCart } from "@/features/cart/CartContext";
import { createClient } from "@/lib/supabase/client";
import FavoriteStar from "./FavoriteStar";
import ProfileHero from "./ProfileHero";
import ProfileBgLayer from "./ProfileBgLayer";
import PasswordInput from "./PasswordInput";
import ThumbImg from "./ThumbImg";

const card: CSSProperties = {
  border: "1px solid var(--border-light)", background: "var(--bg-card)", borderRadius: 10, padding: "clamp(14px, 4vw, 20px)",
};
const label: CSSProperties = {
  display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 6,
};

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** «на коли» для замовлення: «сьогодні о 18:30», «завтра, якнайшвидше»… */
function scheduleLabel(o: AccountOrder): string | null {
  if (!o.scheduledDate) return null;
  const today = kyivNow().date;
  const [y, m, d] = o.scheduledDate.split("-");
  const day = o.scheduledDate === today ? "сьогодні" : o.scheduledDate === addDays(today, 1) ? "завтра" : `${d}.${m}.${y}`;
  if (o.scheduledTime) return `${day} о ${o.scheduledTime}`;
  return `${day}, ${o.deliveryType === "pickup" ? "по готовності" : "якнайшвидше"}`;
}

export default function AccountClient() {
  const { loading, profile, signedIn, orders, saveProfile, refetch } = useAccount();
  const router = useRouter();
  const [tab, setTab] = useState<"profile" | "orders" | "favorites">("profile");
  const { ids: favIds } = useFavorites();
  // параметри з посилань: ?error=auth (callback не вдався), ?confirmed=1 (пошту підтверджено), ?reset=1 (новий пароль)
  const [params, setParams] = useState<{ error: boolean; confirmed: boolean; reset: boolean }>({ error: false, confirmed: false, reset: false });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setParams({ error: q.get("error") === "auth", confirmed: q.get("confirmed") === "1", reset: q.get("reset") === "1" });
    // ?tab=favorites — з плаваючої зірочки «Обране»; ?tab=orders — на майбутнє
    const t = q.get("tab");
    if (t === "favorites" || t === "orders") setTab(t);
  }, []);

  // без профілю окремої сторінки немає: вхід/реєстрація і помилки — модалкою поверх головної
  const toLogin = !loading && !profile;
  useEffect(() => {
    if (!toLogin) return;
    const err = signedIn ? "profile" : params.error ? "auth" : "";
    router.replace(err ? `/?login=1&error=${err}` : "/?login=1");
  }, [toLogin, signedIn, params.error, router]);

  // поки вантажиться (або йде редірект на вхід) — силуети кабінету з переливом замість тексту
  if (loading || !profile) return <AccountSkeleton />;

  if (params.reset) {
    return <NewPasswordCard onDone={() => { setParams((p) => ({ ...p, reset: false })); window.history.replaceState(null, "", "/account"); }} />;
  }

  const active = orders.filter((o) => o.status !== "canceled");
  const sum = active.reduce((s, o) => s + o.total, 0);

  return (
    <div className="acc-root" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {params.confirmed && (
        <p style={{ margin: 0, fontSize: 14, color: "#5BB85B" }}>✓ Пошту підтверджено — реєстрацію завершено.</p>
      )}
      <ProfileBgLayer bg={profile.profileBg} />
      <ProfileHero profile={profile} ordersCount={orders.filter((o) => o.status !== "canceled").length} onChanged={refetch} />
      <div role="tablist" className="acc-tabs">
        {([["profile", "Профіль"], ["orders", `Замовлення${orders.length ? ` · ${orders.length}` : ""}`], ["favorites", `Обране${favIds.length ? ` · ${favIds.length}` : ""}`]] as const).map(([t, l]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            style={{
              padding: "11px 4px", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: "var(--acc-tab-fs, 11px)", letterSpacing: "var(--acc-tab-ls, 2px)", textTransform: "uppercase", whiteSpace: "nowrap",
              // неактивні — теж на напівпрозорій підкладці: фон кабінету може бути будь-якого кольору
              background: tab === t ? "var(--bg-elevated)" : "rgba(13,11,9,0.62)",
              backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
              border: `1px solid ${tab === t ? "var(--accent)" : "var(--border-light)"}`,
              color: tab === t ? "var(--accent)" : "var(--text-secondary)",
            }}>{l}</button>
        ))}
      </div>

      {tab === "profile" ? (
        <>
          {/* без номера блок не згортається — інакше клієнт не побачить, що треба його вказати */}
          <Section title="Мої дані" storageKey={`acc-collapse:${profile.id}:profile`} forceOpen={!profile.phone}>
            <ProfileCard key={profile.id + (profile.phone ?? "")} profile={profile} onSave={saveProfile} />
          </Section>
          <Section title="Статистика" storageKey={`acc-collapse:${profile.id}:stats`}>
            <div className="acc-stats">
              <Stat label="Замовлень" value={String(active.length)} />
              <Stat label="На суму" value={`${sum} грн`} />
              <Stat label="Середній чек" value={active.length ? `${Math.round(sum / active.length)} грн` : "—"} />
              <Stat label="Останнє" value={orders[0] ? new Date(orders[0].createdAt).toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv" }) : "—"} />
            </div>
          </Section>
        </>
      ) : tab === "favorites" ? (
        <FavoritesList ids={favIds} />
      ) : orders.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>Поки що замовлень немає.</p>
      ) : (
        <div style={{ border: "1px solid var(--border-light)", borderRadius: 10, overflow: "hidden", background: "var(--bg-card)" }}>
          {orders.map((o, i) => <OrderRow key={o.id} order={o} first={i === 0} />)}
        </div>
      )}

      <div>
        <button className="btn-secondary" onClick={async () => { await signOutCustomer(); window.location.href = "/"; }}>
          Вийти
        </button>
      </div>
    </div>
  );
}

/** Блок кабінету, що згортається кліком по заголовку. За замовчуванням розгорнутий;
 *  стан пам'ятається в localStorage для цього клієнта (storageKey з його id). */
function Section({ title, storageKey, forceOpen = false, children }: {
  title: string;
  storageKey: string;
  forceOpen?: boolean;
  children: ReactNode;
}) {
  const [stored, setStored] = useState(true);
  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v === "1" || v === "0") setStored(v === "1");
    } catch { /* немає доступу до сховища — лишаємо розгорнутим */ }
  }, [storageKey]);
  const open = forceOpen || stored;

  const toggle = () => {
    if (forceOpen) return;
    setStored((o) => {
      try { localStorage.setItem(storageKey, o ? "0" : "1"); } catch { /* ignore */ }
      return !o;
    });
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button type="button" onClick={toggle} aria-expanded={open} disabled={forceOpen}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: 0, background: "transparent", border: "none",
          cursor: forceOpen ? "default" : "pointer", textAlign: "left", color: "var(--text-secondary)",
          fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
        }}>
        {!forceOpen && (
          <span style={{ display: "inline-flex", fontSize: 14, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>▾</span>
        )}
        {title}
      </button>
      {open && children}
    </section>
  );
}

/** Силует кабінету: шапка профілю, вкладки, картка, плитки. */
function AccountSkeleton() {
  return (
    <div aria-busy="true" aria-label="Завантаження кабінету" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span className="skel" style={{ width: 76, height: 76, borderRadius: "50%" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="skel" style={{ width: "55%", height: 20 }} />
          <span className="skel" style={{ width: "35%", height: 12 }} />
        </div>
      </div>
      <div className="acc-tabs">{[0, 1, 2].map((i) => <span key={i} className="skel" style={{ height: 40 }} />)}</div>
      <span className="skel" style={{ height: 230, borderRadius: 10 }} />
      <div className="acc-stats">{[0, 1, 2, 3].map((i) => <span key={i} className="skel" style={{ height: 76, borderRadius: 10 }} />)}</div>
    </div>
  );
}

/** Силует списку (обране, замовлення). */
function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-busy="true" aria-label="Завантаження" style={{ border: "1px solid var(--border-light)", borderRadius: 10, overflow: "hidden", background: "var(--bg-card)" }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderTop: i ? "1px solid var(--border)" : "none" }}>
          <span className="skel" style={{ width: 48, height: 48, borderRadius: 6 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="skel" style={{ width: "60%", height: 14 }} />
            <span className="skel" style={{ width: "30%", height: 10 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

interface FavProduct { id: string; name: string; slug: string; price: number; weight: string | null; photo: string | null; available: boolean }

/** Вкладка «Обране»: товари в порядку додавання; знята з продажу страва — приглушена. */
function FavoritesList({ ids }: { ids: string[] }) {
  const [items, setItems] = useState<FavProduct[] | null>(null);
  const key = ids.join(",");

  useEffect(() => {
    if (!ids.length) { setItems([]); return; }
    let active = true;
    createClient()
      .from("products")
      .select("id, name, slug, price, weight, image_path, is_available")
      .in("id", ids)
      .then(({ data, error }) => {
        if (error) console.error("favorites products:", error.message);
        if (!active) return;
        const byId = new Map((data ?? []).map((p) => [p.id as string, p]));
        // знятий зовсім (видалений) товар RLS не віддасть — просто не показуємо
        setItems(ids.flatMap((id) => {
          const p = byId.get(id);
          return p ? [{ id, name: p.name, slug: p.slug, price: Number(p.price), weight: p.weight, photo: p.image_path, available: !!p.is_available }] : [];
        }));
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (items === null) return <ListSkeleton rows={Math.min(Math.max(ids.length, 1), 4)} />;
  if (!items.length) {
    return (
      <div style={{ ...card, textAlign: "center", padding: "28px 18px" }}>
        <div className="fav-empty-star" aria-hidden>☆</div>
        <p style={{ margin: "8px 0 14px", color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.5 }}>
          Натискайте зірочку на стравах — вони збережуться тут, щоб швидко знайти улюблене.
        </p>
        <a href="/#menu" className="btn-secondary" style={{ display: "inline-block", textDecoration: "none" }}>До меню</a>
      </div>
    );
  }
  return (
    <div style={{ border: "1px solid var(--border-light)", borderRadius: 10, overflow: "hidden", background: "var(--bg-card)" }}>
      {items.map((p, i) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderTop: i ? "1px solid var(--border)" : "none", opacity: p.available ? 1 : 0.55 }}>
          <a href={`/menu/${p.slug}`} className="mini-thumb" style={{ borderRadius: 6 }} aria-hidden tabIndex={-1}>
            {p.photo && <ThumbImg src={p.photo} alt="" loading="lazy" />}
          </a>
          <a href={`/menu/${p.slug}`} style={{ flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}>
            <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {p.available ? <>{p.price} грн{p.weight ? ` · ${p.weight}` : ""}</> : "Зараз немає в продажу"}
            </span>
          </a>
          <FavoriteStar productId={p.id} name={p.name} variant="inline" size={34} />
        </div>
      ))}
    </div>
  );
}

function ProfileCard({ profile, onSave }: {
  profile: NonNullable<ReturnType<typeof useAccount>["profile"]>;
  onSave: (p: { name: string; phone: string }) => Promise<string | null>;
}) {
  const [name, setName] = useState(profile.name ?? "");
  const [phone, setPhone] = useState(profile.phone ? formatPhone(profile.phone) : "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // номер обовʼязковий (без підтвердження): порожнім профіль не зберігаємо
  const phoneEmpty = !phone.trim();
  const phoneOk = isPhoneValid(phone);
  const dirty = name.trim() !== (profile.name ?? "") || phone !== (profile.phone ? formatPhone(profile.phone) : "");
  const phoneChanged = phone !== (profile.phone ? formatPhone(profile.phone) : "");

  const save = async () => {
    if (!phoneOk || saving) return;
    setSaving(true);
    setMsg(null);
    const err = await onSave({ name: name.trim(), phone: phone.trim() });
    setSaving(false);
    setMsg(err ? { ok: false, text: "Не вдалося зберегти. Спробуйте ще раз." } : { ok: true, text: "Збережено" });
  };

  return (
    <div style={{ ...card, ...(!profile.phone ? { borderColor: "var(--accent)" } : null) }}>
      {!profile.phone && (
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--accent)" }}>
          Щоб завершити реєстрацію, вкажіть номер телефону (підтверджувати не потрібно).
        </p>
      )}
      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
        {profile.email}{" "}
        {profile.emailConfirmed
          ? <span style={{ color: "#5BB85B" }}>· пошту підтверджено</span>
          : <span style={{ color: "#E0A24A" }}>· пошту не підтверджено</span>}
      </div>
      <div className="acc-fields">
        <div>
          <span style={label}>Ім&apos;я</span>
          <input className="form-input" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <span style={label}>Телефон</span>
          <input className="form-input" type="tel" inputMode="numeric" autoComplete="tel" placeholder="093 728 42 98"
            value={phone} maxLength={30} onChange={(e) => setPhone(formatPhone(e.target.value))} />
        </div>
      </div>

      <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)", margin: "12px 0 0" }}>
        {!profile.phone ? (
          "Додайте номер телефону, на який ви замовляли — так ми зможемо підтягнути ваші попередні замовлення."
        ) : profile.phoneVerifiedAt ? (
          <span style={{ color: "#5BB85B" }}>✓ Номер підтверджено — в історії всі замовлення на цей номер.</span>
        ) : (
          "Номер ще не підтверджено. Замовлення, зроблені раніше на цей номер, з'являться в історії після підтвердження — автоматично, щойно ми підтвердимо ваше замовлення з цього акаунта, або вручну адміністратором."
        )}
      </p>
      {phoneChanged && profile.phoneVerifiedAt && (
        <p style={{ fontSize: 12, color: "#E0A24A", margin: "8px 0 0" }}>Після зміни номера його потрібно буде підтвердити знову.</p>
      )}
      {!phoneOk && (
        <p style={{ fontSize: 12, color: "#E0726A", margin: "8px 0 0" }}>
          {phoneEmpty ? "Номер телефону обовʼязковий." : "Невірний формат номера (напр. 093 728 42 98)"}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button className="btn-primary" onClick={save} disabled={!dirty || !phoneOk || saving}>
          {saving ? "Зберігаємо…" : "Зберегти"}
        </button>
        {msg && <span style={{ fontSize: 12, color: msg.ok ? "var(--accent)" : "#E0726A" }}>{msg.text}</span>}
      </div>
    </div>
  );
}

function Stat({ label: l, value }: { label: string; value: string }) {
  return (
    <div style={{ ...card, padding: "12px 14px" }}>
      <div className="acc-stat-num" style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{value}</div>
      <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-secondary)", marginTop: 4 }}>{l}</div>
    </div>
  );
}

/** Рядок історії: дата, сума й короткий склад; по кліку — повний склад і деталі.
 *  Статус замовлення клієнту поки не показуємо (рішення власника, 2026-10-08). */
function OrderRow({ order: o, first }: { order: AccountOrder; first: boolean }) {
  const [open, setOpen] = useState(false);
  const { addMany } = useCart();
  const [repeating, setRepeating] = useState(false);
  const repeatable = o.items.filter((it) => it.productId);

  // «Повторити»: кладемо позиції в кошик зі старими цінами → на головній кошик звіряється з каталогом:
  // ціни стають актуальними (з повідомленням, які змінились), зняті з продажу страви прибираються
  const repeat = () => {
    if (!repeatable.length || repeating) return;
    setRepeating(true);
    addMany(repeatable.map((it) => ({ id: it.productId!, name: it.name, price: it.price, qty: it.quantity })));
    window.location.href = "/?cart=1";
  };
  const when = scheduleLabel(o);
  const date = new Date(o.createdAt).toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", year: "2-digit" });
  const qty = o.items.reduce((n, it) => n + it.quantity, 0);
  const summary = o.items.slice(0, 2).map((it) => it.name).join(", ") + (o.items.length > 2 ? ` +${o.items.length - 2}` : "");

  return (
    <div style={{ borderTop: first ? "none" : "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", background: open ? "var(--bg-elevated)" : "transparent" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        style={{
          flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 12px", alignItems: "center",
          padding: repeatable.length ? "12px 10px 12px 16px" : "12px 16px", background: "transparent", border: "none",
          cursor: "pointer", textAlign: "left", color: "var(--text-primary)", fontFamily: "var(--font-body)",
        }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, minWidth: 0 }}>
          <span style={{ fontWeight: 600 }}>{date}</span>
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap" }}>{o.total} грн</span>
        <span style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {o.deliveryType === "delivery" ? "Доставка" : "Самовивіз"} · {summary}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          {qty} шт <span aria-hidden style={{ display: "inline-block", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>▾</span>
        </span>
      </button>
      {repeatable.length > 0 && (
        <button type="button" onClick={repeat} disabled={repeating} className="repeat-btn"
          aria-label={`Повторити замовлення від ${date}`} title="Повторити замовлення">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={repeating ? "spin" : undefined}>
            <path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" />
          </svg>
        </button>
      )}
      </div>

      {open && (
        <div style={{ padding: "4px 16px 14px", background: "var(--bg-elevated)", fontSize: 13 }}>
          <div style={{ color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.5 }}>
            Оформлено {dateTime(o.createdAt)}
            {when ? ` · ${o.deliveryType === "delivery" ? "доставити" : "забрати"} ${when}` : ""}
            {o.address ? <><br />{o.address}</> : null}
          </div>
          {o.items.map((it, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "2px 0" }}>
              <span>{it.name} × {it.quantity}</span>
              <span style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{it.price * it.quantity} грн</span>
            </div>
          ))}
          {o.discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", marginTop: 4 }}>
              <span>Знижка</span><span>−{o.discount} грн</span>
            </div>
          )}
          {repeatable.length > 0 && repeatable.length < o.items.length && (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--text-secondary)" }}>↻ Повтор додасть лише страви, які ще є в меню.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Новий пароль після переходу за посиланням із листа «скидання пароля». */
function NewPasswordCard({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) { setError(`Пароль — щонайменше ${MIN_PASSWORD} символів.`); return; }
    setBusy(true);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) setError("Не вдалося змінити пароль. Спробуйте ще раз.");
    else onDone();
  };
  return (
    <form onSubmit={save} style={{ ...card, maxWidth: 440, display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ margin: 0, fontSize: 16 }}>Новий пароль</p>
      <PasswordInput className="form-input" autoComplete="new-password" placeholder={`Від ${MIN_PASSWORD} символів`}
        value={password} maxLength={72} onChange={(e) => setPassword(e.target.value)} />
      {error && <p style={{ color: "#E0726A", fontSize: 13, margin: 0 }}>{error}</p>}
      <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Зберігаємо…" : "Зберегти пароль"}</button>
    </form>
  );
}
