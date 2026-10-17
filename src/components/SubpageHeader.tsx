"use client";

import Link from "next/link";
import BackButton from "./BackButton";
import { useContacts } from "@/features/publicData";
import { telHref, sitePhones } from "@/lib/contacts";
import { ASSET_ICONS } from "@/data/site";

/** Шапка внутрішніх сторінок (страва, категорія): «назад», логотип, телефони. */
export default function SubpageHeader() {
  const contacts = useContacts();
  return (
    <header
      style={{
        position: "sticky", top: 0, zIndex: 10, height: "var(--header-h)",
        borderBottom: "1px solid var(--border)", background: "var(--glass)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center",
      }}
    >
      <div style={{ maxWidth: 1100, width: "100%", margin: "0 auto", padding: "0 var(--page-pad)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <BackButton />
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ASSET_ICONS.logo} alt="Sushi Syndicate" className="site-logo" style={{ height: 34 }} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: 4, color: "var(--text-primary)" }}>SUSHI</span>
        </Link>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          {sitePhones(contacts).map((ph) => (
            <a key={ph} href={telHref(ph)} style={{ fontSize: 13, color: "var(--text-primary)", textDecoration: "none", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
              {ph}
            </a>
          ))}
        </div>
      </div>
    </header>
  );
}
