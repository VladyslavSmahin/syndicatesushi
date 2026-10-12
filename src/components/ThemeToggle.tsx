"use client";

import { useEffect, useState } from "react";
import { applyTheme, currentTheme, type Theme } from "@/lib/theme";

/** Перемикач теми — іконка: місяць (темна) ↔ сонце (світла). У шапці на ПК і в шапці мобільного меню. */
export default function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null); // null — до монтування (тема відома лише в браузері)
  useEffect(() => {
    setTheme(currentTheme());
    const on = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener("ss-theme", on);
    return () => window.removeEventListener("ss-theme", on);
  }, []);

  const next: Theme = theme === "light" ? "dark" : "light";
  const label = next === "light" ? "Світла тема" : "Темна тема";
  const toggle = () => applyTheme(next);

  return (
    <button type="button" onClick={toggle} aria-label={label} title={label} className={`hdr-btn theme-btn${className ? ` ${className}` : ""}`}>
      <span className="theme-ico" key={theme ?? "x"} aria-hidden>{theme === "light" ? <Sun /> : <Moon />}</span>
    </button>
  );
}

function Moon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
    </svg>
  );
}
function Sun() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
    </svg>
  );
}
