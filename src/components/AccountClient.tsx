"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useAccount, signOutCustomer, updatePassword, type AccountOrder, type AccountOrderStatus } from "@/features/account";
import { MIN_PASSWORD } from "./AuthForm";
import { useRouter } from "next/navigation";
import { formatPhone, isPhoneValid } from "@/lib/phone";
import { kyivNow, addDays } from "@/lib/kyivTime";

const STATUS: Record<AccountOrderStatus, { label: string; color: string }> = {
  new: { label: "Нове", color: "#E0A24A" },
  confirmed: { label: "Підтверджено", color: "#4A9DE0" },
  done: { label: "Виконано", color: "#5BB85B" },
  canceled: { label: "Скасовано", color: "#8A8A8A" },
};

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
  const { loading, profile, signedIn, orders, saveProfile } = useAccount();
  const router = useRouter();
  const [tab, setTab] = useState<"profile" | "orders">("profile");
  // параметри з посилань: ?error=auth (callback не вдався), ?confirmed=1 (пошту підтверджено), ?reset=1 (новий пароль)
  const [params, setParams] = useState<{ error: boolean; confirmed: boolean; reset: boolean }>({ error: false, confirmed: false, reset: false });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setParams({ error: q.get("error") === "auth", confirmed: q.get("confirmed") === "1", reset: q.get("reset") === "1" });
  }, []);

  // без профілю окремої сторінки немає: вхід/реєстрація і помилки — модалкою поверх головної
  const toLogin = !loading && !profile;
  useEffect(() => {
    if (!toLogin) return;
    const err = signedIn ? "profile" : params.error ? "auth" : "";
    router.replace(err ? `/?login=1&error=${err}` : "/?login=1");
  }, [toLogin, signedIn, params.error, router]);

  if (loading) return <p style={{ color: "var(--text-secondary)" }}>Завантаження…</p>;

  if (!profile) return <p style={{ color: "var(--text-secondary)" }}>Перенаправлення…</p>;

  if (params.reset) {
    return <NewPasswordCard onDone={() => { setParams((p) => ({ ...p, reset: false })); window.history.replaceState(null, "", "/account"); }} />;
  }

  const active = orders.filter((o) => o.status !== "canceled");
  const sum = active.reduce((s, o) => s + o.total, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {params.confirmed && (
        <p style={{ margin: 0, fontSize: 14, color: "#5BB85B" }}>✓ Пошту підтверджено — реєстрацію завершено.</p>
      )}
      {profile.staffRole && (
        <a href="/admin" className="btn-primary" style={{ alignSelf: "flex-start", textDecoration: "none" }}>
          Адмінка
        </a>
      )}
      <div role="tablist" className="acc-tabs">
        {([["profile", "Профіль"], ["orders", `Замовлення${orders.length ? ` · ${orders.length}` : ""}`]] as const).map(([t, l]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            style={{
              padding: "11px 0", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
              background: tab === t ? "var(--bg-elevated)" : "transparent",
              border: `1px solid ${tab === t ? "var(--accent)" : "var(--border-light)"}`,
              color: tab === t ? "var(--accent)" : "var(--text-secondary)",
            }}>{l}</button>
        ))}
      </div>

      {tab === "profile" ? (
        <>
          <ProfileCard key={profile.id + (profile.phone ?? "")} profile={profile} onSave={saveProfile} />
          <div className="acc-stats">
            <Stat label="Замовлень" value={String(active.length)} />
            <Stat label="На суму" value={`${sum} грн`} />
            <Stat label="Середній чек" value={active.length ? `${Math.round(sum / active.length)} грн` : "—"} />
            <Stat label="Останнє" value={orders[0] ? new Date(orders[0].createdAt).toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv" }) : "—"} />
          </div>
        </>
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

function ProfileCard({ profile, onSave }: {
  profile: NonNullable<ReturnType<typeof useAccount>["profile"]>;
  onSave: (p: { name: string; phone: string }) => Promise<string | null>;
}) {
  const [name, setName] = useState(profile.name ?? "");
  const [phone, setPhone] = useState(profile.phone ? formatPhone(profile.phone) : "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const phoneOk = !phone.trim() || isPhoneValid(phone);
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
          Щоб завершити реєстрацію, вкажіть номер телефону.
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
      {!phoneOk && <p style={{ fontSize: 12, color: "#E0726A", margin: "8px 0 0" }}>Невірний формат номера (напр. 093 728 42 98)</p>}

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

/** Рядок історії: дата, статус, сума й короткий склад; по кліку — повний склад і деталі. */
function OrderRow({ order: o, first }: { order: AccountOrder; first: boolean }) {
  const [open, setOpen] = useState(false);
  const st = STATUS[o.status] ?? STATUS.new;
  const when = scheduleLabel(o);
  const date = new Date(o.createdAt).toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", year: "2-digit" });
  const qty = o.items.reduce((n, it) => n + it.quantity, 0);
  const summary = o.items.slice(0, 2).map((it) => it.name).join(", ") + (o.items.length > 2 ? ` +${o.items.length - 2}` : "");

  return (
    <div style={{ borderTop: first ? "none" : "1px solid var(--border)", opacity: o.status === "canceled" ? 0.55 : 1 }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        style={{
          width: "100%", display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 12px", alignItems: "center",
          padding: "12px 16px", background: open ? "var(--bg-elevated)" : "transparent", border: "none",
          cursor: "pointer", textAlign: "left", color: "var(--text-primary)", fontFamily: "var(--font-body)",
        }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, minWidth: 0 }}>
          <span style={{ fontWeight: 600 }}>{date}</span>
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: st.color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: st.color }}>{st.label}</span>
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap" }}>{o.total} грн</span>
        <span style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {o.deliveryType === "delivery" ? "Доставка" : "Самовивіз"} · {summary}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          {qty} шт <span aria-hidden style={{ display: "inline-block", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>▾</span>
        </span>
      </button>

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
      <input className="form-input" type="password" autoComplete="new-password" placeholder={`Від ${MIN_PASSWORD} символів`}
        value={password} maxLength={72} onChange={(e) => setPassword(e.target.value)} />
      {error && <p style={{ color: "#E0726A", fontSize: 13, margin: 0 }}>{error}</p>}
      <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Зберігаємо…" : "Зберегти пароль"}</button>
    </form>
  );
}
