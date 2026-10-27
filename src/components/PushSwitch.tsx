"use client";

/** Перемикач-«тумблер» (role=switch) для налаштувань сповіщень — і в адмінці, і в кабінеті. */
export default function PushSwitch({ checked, disabled, onChange, label }: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: "relative", flexShrink: 0, width: 46, height: 28, padding: 0, borderRadius: 999,
        border: `1px solid ${checked ? "var(--accent)" : "var(--border-light)"}`,
        background: checked ? "var(--accent)" : "var(--bg-elevated)",
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, transition: "background 0.2s, border-color 0.2s",
      }}>
      <span aria-hidden style={{
        position: "absolute", top: 3, left: checked ? 21 : 3, width: 20, height: 20, borderRadius: "50%",
        background: checked ? "#0A0908" : "var(--text-secondary)", transition: "left 0.2s",
      }} />
    </button>
  );
}
