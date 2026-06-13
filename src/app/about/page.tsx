import type { Metadata } from "next";
import InfoPageShell from "@/components/InfoPageShell";

export const metadata: Metadata = {
  title: "Про нас — Sushi Syndicate",
  description: "Про Sushi Syndicate — преміальна доставка свіжих суші у Тульчині.",
};

const p: React.CSSProperties = { margin: "0 0 16px" };

export default function AboutPage() {
  return (
    <InfoPageShell title="Про нас">
      <div style={{ padding: "14px 16px", marginBottom: 24, border: "1px solid var(--border-light)", borderRadius: 8, background: "var(--bg-elevated)", fontSize: 13, color: "var(--text-secondary)" }}>
        ⚠️ Чернетка. Текст про заклад додамо разом із клієнтом (історія, цінності, команда, фото).
      </div>
      <p style={p}>
        Sushi Syndicate — це преміальна доставка свіжих суші у Тульчині. Усі роли готуються лише після
        оформлення замовлення, з відбірних інгредієнтів.
      </p>
      <p style={p}>
        Тут зʼявиться розповідь про заклад: як ми починали, наша філософія, команда та принципи якості.
      </p>
    </InfoPageShell>
  );
}
