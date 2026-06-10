"use client";

import { Icon } from "./icons";

export default function ArrowBtn({
  dir,
  onClick,
}: {
  dir: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={dir}
      style={{
        width: 44, height: 44, border: "1px solid var(--border-light)", background: "transparent",
        color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-light)"; e.currentTarget.style.color = "var(--text-primary)"; }}
    >
      <Icon.Arrow width="16" height="16" style={{ transform: dir === "left" ? "rotate(180deg)" : "none" }} />
    </button>
  );
}
