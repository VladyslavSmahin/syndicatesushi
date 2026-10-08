import type { Metadata } from "next";
import InfoPageShell from "@/components/InfoPageShell";
import AccountClient from "@/components/AccountClient";

export const metadata: Metadata = {
  title: "Особистий кабінет",
  alternates: { canonical: "/account" },
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <InfoPageShell title="Особистий кабінет">
      <AccountClient />
    </InfoPageShell>
  );
}
