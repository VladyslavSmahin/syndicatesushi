"use client";

import { useState, type InputHTMLAttributes } from "react";

/** Поле пароля з «оком»: тап — показати/сховати введене. */
export default function PasswordInput({ className, style, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input {...rest} type={shown ? "text" : "password"} className={className}
        style={{ ...style, width: "100%", paddingRight: 46 }} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? "Сховати пароль" : "Показати пароль"}
        aria-pressed={shown}
        title={shown ? "Сховати пароль" : "Показати пароль"}
        style={{
          position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", width: 38, height: 38,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
          background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)",
          WebkitTapHighlightColor: "transparent", outline: "none",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {shown && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}
