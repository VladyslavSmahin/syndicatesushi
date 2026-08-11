import { SITE_URL, SITE_NAME, CITY, DEFAULT_DESCRIPTION } from "@/lib/seo";
import { telHref, type SiteContacts } from "@/lib/contacts";
import type { DeliverySettings } from "@/lib/delivery";
import type { SeoBlock } from "@/lib/seoBlock";

/** «11:00 — 22:00» → { opens: "11:00", closes: "22:00" }; невдалий парс → null. */
function parseHours(hours: string): { opens: string; closes: string } | null {
  const m = (hours || "").match(/(\d{1,2}[:.]\d{2})\D+(\d{1,2}[:.]\d{2})/);
  if (!m) return null;
  return { opens: m[1].replace(".", ":"), closes: m[2].replace(".", ":") };
}

/** «вул. Незалежності, 7, м. Тульчин» → вулиця без міста (місто передаємо окремо). */
function streetOnly(address: string): string {
  return (address || "").split(",").slice(0, 2).join(",").trim();
}

/**
 * Розмітка Restaurant + WebSite для Google. Дає шанс на локальну видачу
 * («суші тульчин»), картку з адресою/годинами та коректний сайтлінк-пошук.
 */
export default function StructuredData({
  contacts,
  delivery,
  seoBlock,
  priceRange,
}: {
  contacts: SiteContacts;
  delivery: DeliverySettings;
  seoBlock?: SeoBlock;
  priceRange?: string;
}) {
  const hours = parseHours(contacts.hours);
  const phone = telHref(contacts.phone).replace("tel:", "");
  const sameAs = [contacts.instagram, contacts.telegram, contacts.facebook].filter(Boolean);

  const restaurant = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${SITE_URL}/#restaurant`,
    name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    image: `${SITE_URL}/og-cover.jpg`,
    servesCuisine: ["Суші", "Японська кухня", "Азійська кухня"],
    ...(priceRange ? { priceRange } : {}),
    ...(phone ? { telephone: phone } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: streetOnly(contacts.address),
      addressLocality: CITY,
      addressRegion: "Вінницька область",
      addressCountry: "UA",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: delivery.originLat,
      longitude: delivery.originLng,
    },
    ...(hours
      ? {
          openingHoursSpecification: [
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
              opens: hours.opens,
              closes: hours.closes,
            },
          ],
        }
      : {}),
    hasMenu: `${SITE_URL}/#menu`,
    acceptsReservations: false,
    areaServed: { "@type": "City", name: CITY },
    potentialAction: {
      "@type": "OrderAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/#menu`, inLanguage: "uk" },
      deliveryMethod: ["http://purl.org/goodrelations/v1#DeliveryModeOwnFleet", "http://purl.org/goodrelations/v1#DeliveryModePickUp"],
    },
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    inLanguage: "uk-UA",
    publisher: { "@id": `${SITE_URL}/#restaurant` },
  };

  // FAQ віддаємо Google лише коли він реально показаний на сторінці — інакше це порушення правил
  const faq = seoBlock?.enabled && seoBlock.faq.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: seoBlock.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }
    : null;

  return (
    <script
      type="application/ld+json"
      // дані наші (з БД), не користувацький ввід — але лишаємо екранування «<» на випадок HTML у полях
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faq ? [restaurant, website, faq] : [restaurant, website]).replace(/</g, "\\u003c") }}
    />
  );
}
