import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { CartProvider } from "@/features/cart/CartContext";
import { FavoritesProvider } from "@/features/favorites/FavoritesContext";
import ScrollTopButton from "@/components/ScrollTopButton";
import NavTracker from "@/components/NavTracker";
import PhoneRequiredModal from "@/components/PhoneRequiredModal";
import FavoritesFab from "@/components/FavoritesFab";
import RefCapture from "@/components/RefCapture";
import { THEME_BOOT } from "@/lib/theme";
import { SITE_URL, SITE_NAME, CITY, DEFAULT_TITLE, TITLE_TEMPLATE, DEFAULT_DESCRIPTION } from "@/lib/seo";
import { fetchOgImage } from "@/features/ogImage.server";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const jost = Jost({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-jost",
  display: "swap",
});

// PWA: колір рядка стану/шапки; viewport-fit=cover — щоб env(safe-area-inset-*) працювали
// у застосунку на iPhone (відступ від «смужки» внизу в кошику, тостах, модалках)
export const viewport: Viewport = {
  themeColor: "#0D0B09",
  viewportFit: "cover",
};

// картинку превʼю посилання змінюють в адмінці (SEO) — тому метадані читаємо з БД (кеш PUBLIC_TAG)
export async function generateMetadata(): Promise<Metadata> {
  const ogImage = await fetchOgImage();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: DEFAULT_TITLE, template: TITLE_TEMPLATE },
    description: DEFAULT_DESCRIPTION,
    applicationName: SITE_NAME,
    // iPhone: «На екран Додому» відкриває сайт як застосунок; назва під іконкою — title
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black" },
    // старіші iOS читають лише цей тег (Next виводить стандартний mobile-web-app-capable)
    other: { "apple-mobile-web-app-capable": "yes" },
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: "uk_UA",
      url: "/",
      siteName: SITE_NAME,
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${SITE_NAME} — суші та роли, ${CITY}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: data-theme ставить скрипт до гідрації (світла тема)
    <html lang="uk" className={`${cormorant.variable} ${jost.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <CartProvider><FavoritesProvider>{children}<FavoritesFab /></FavoritesProvider></CartProvider>
        <ScrollTopButton />
        <NavTracker />
        <PhoneRequiredModal />
        <RefCapture />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
