"use client";

import { useEffect, useRef, useState } from "react";
import Header from "./Header";
import Hero from "./Hero";
import Hits from "./Hits";
import FullMenu from "./FullMenu";
import ReviewsList from "./ReviewsList";
import MapSection from "./MapSection";
import AboutSection from "./AboutSection";
import SeoTextBlock from "./SeoTextBlock";
import Footer from "./Footer";
import CartDrawer from "./CartDrawer";
import ProductModal from "./ProductModal";
import MobileMenu from "./MobileMenu";
import MobileCategoryBar from "./MobileCategoryBar";
import { useCart } from "@/features/cart/CartContext";
import { usePublicCatalog } from "@/features/publicData";
import {
  beginHomeRestore, scheduleEndHomeRestore, cancelEndHomeRestore, isHomeRestoring, saveHomeState, clearPendingPop,
  MODAL_STATE_KEY, MODAL_LIST_KEY,
} from "@/features/navHistory";
import type { Product, NavCategory } from "@/lib/types";
import { isScrollLocked, currentScrollY } from "@/lib/scrollLock";

type NavFilter = NonNullable<NavCategory["filter"]>;

const HEADER_OFFSET = 84;

export default function HomeClient() {
  const { add } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [modalItem, setModalItem] = useState<Product | null>(null);
  // список, з якого відкрили товар — по ньому гортаємо свайпом
  const [modalList, setModalList] = useState<Product[]>([]);
  const [navFilter, setNavFilter] = useState<NavFilter | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const catalog = usePublicCatalog();
  // повернулися «назад» — збережений стан (читаємо до ефектів дочірніх компонентів)
  const [restore] = useState(() => (typeof window === "undefined" ? null : beginHomeRestore()));

  // позиція скролу на момент відкриття картки: «назад» браузер відновлює по-своєму — повертаємо нашу
  const scrollAtModal = useRef(0);
  // вже викликали history.back() для закриття — повторні виклики (Esc із автоповтором,
  // подвійний тап) не мають зробити ще один «назад» і вивести з сайту
  const closing = useRef(false);

  const byIds = (ids: string[] | undefined) =>
    (ids ?? []).map((id) => catalog.find((p) => p.id === id)).filter((p): p is Product => !!p);

  // список для гортання: збережений у цьому кроці історії, інакше — категорія товару
  const listFor = (it: Product): Product[] => {
    const saved = byIds(window.history.state?.[MODAL_LIST_KEY]);
    return saved.some((p) => p.id === it.id) ? saved : catalog.filter((p) => p.category === it.category);
  };

  // у history.state лишилась картка, яку не відкриваємо (F5, товар прибрали) — прибираємо ключ,
  // інакше перше «назад» нічого видимо не зробить
  const dropStaleModalState = () => {
    const st = window.history.state;
    if (!st?.[MODAL_STATE_KEY]) return;
    const { [MODAL_STATE_KEY]: _m, [MODAL_LIST_KEY]: _l, ...rest } = st;
    window.history.replaceState(rest, "");
  };

  // відновлення: категорія → (рендер списків) → скрол → відкрита картка, якщо була
  useEffect(() => {
    if (!restore) { dropStaleModalState(); return; }
    cancelEndHomeRestore();
    if (restore.navFilter !== undefined) setNavFilter(restore.navFilter ?? null);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        window.scrollTo({ top: restore.scrollY ?? 0, behavior: "instant" });
        const slug = window.history.state?.[MODAL_STATE_KEY];
        const it = slug ? catalog.find((p) => p.slug === slug) : undefined;
        if (it) { scrollAtModal.current = restore.scrollY ?? 0; setModalList(listFor(it)); setModalItem(it); }
        else dropStaleModalState();
        scheduleEndHomeRestore(150);
      });
    });
    // якщо пішли зі сторінки посеред відновлення — все одно його завершуємо
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); scheduleEndHomeRestore(500); };
    // лише при монтуванні
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // запам'ятовуємо категорію і позицію скролу
  useEffect(() => { if (!isHomeRestoring()) saveHomeState({ navFilter }); }, [navFilter]);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      // перехід на іншу сторінку прокручує її вгору — цей скрол не наш, не зберігаємо
      // під модалкою body зафіксовано (scrollY = 0) — це не справжня позиція
      if (isHomeRestoring() || isScrollLocked() || window.location.pathname !== "/") return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (window.location.pathname === "/" && !isScrollLocked()) saveHomeState({ scrollY: window.scrollY });
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  // відкрита картка = окремий крок історії: системне «назад» закриває її, а не йде з сайту
  useEffect(() => {
    const onPop = () => {
      if (window.location.pathname !== "/") return;
      clearPendingPop(); // це наш popstate (модалка), а не повернення на сторінку
      closing.current = false;
      const slug = window.history.state?.[MODAL_STATE_KEY];
      const it = slug ? catalog.find((p) => p.slug === slug) : undefined;
      if (it) setModalList(listFor(it));
      setModalItem(it ?? null);
      if (!it) {
        const y = scrollAtModal.current;
        requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" }));
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [catalog]);

  // повернення зі сторінки страви з «Перейти до кошика» — /?cart=1 відкриває кошик
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("cart")) return;
    setCartOpen(true);
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  }, []);

  const openProduct = (item: Product, list: Product[]) => {
    setModalList(list);
    setModalItem(item);
    closing.current = false;
    // з пошуку відкриваємо під блокуванням скролу (scrollY = 0) — беремо справжню позицію
    const y = currentScrollY();
    scrollAtModal.current = y;
    saveHomeState({ scrollY: y });
    // список — у самому кроці історії: у кожної відкритої картки свій
    const modalState = { [MODAL_STATE_KEY]: item.slug, [MODAL_LIST_KEY]: list.map((p) => p.id) };
    const st = window.history.state ?? {};
    if (st[MODAL_STATE_KEY]) window.history.replaceState({ ...st, ...modalState }, "");
    else window.history.pushState(modalState, "");
  };

  // гортання свайпом — замінюємо крок історії, щоб «назад» закривав картку одним натиском
  const navigateProduct = (item: Product) => {
    setModalItem(item);
    window.history.replaceState({ ...(window.history.state ?? {}), [MODAL_STATE_KEY]: item.slug }, "");
  };

  const closeProduct = () => {
    if (closing.current) return;
    if (window.history.state?.[MODAL_STATE_KEY]) {
      closing.current = true;
      window.history.back(); // popstate закриє модалку
    } else setModalItem(null);
  };

  const scrollTo = (id: string, tries = 10): void => {
    // клік з меню/шторки: спершу вона закривається й знімає блокування скролу — чекаємо
    if (isScrollLocked() && tries > 0) { requestAnimationFrame(() => scrollTo(id, tries - 1)); return; }
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  const handleNavClick = (cat: NavCategory) => {
    if (cat.scrollTo) {
      scrollTo(cat.scrollTo);
      setNavFilter(null);
    } else if (cat.filter) {
      setNavFilter(cat.filter);
      setTimeout(() => scrollTo("menu"), 50);
    } else {
      scrollTo("menu");
    }
  };

  return (
    <>
      <Header
        onCartOpen={() => setCartOpen(true)}
        onNavClick={handleNavClick}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((v) => !v)}
        onProductOpen={openProduct}
      />
      <Hero
        onCtaOrder={() => setCartOpen(true)}
        onCtaMenu={() => scrollTo("menu")}
      />
      <Hits onAdd={add} onCardClick={openProduct} />
      <FullMenu
        onAdd={add}
        onCardClick={openProduct}
        navFilter={navFilter}
        setNavFilter={setNavFilter}
      />
      <ReviewsList />
      <MapSection />
      <AboutSection />
      <SeoTextBlock />
      <Footer />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
      <ProductModal item={modalItem} list={modalList} onNavigate={navigateProduct} onClose={closeProduct} onAdd={add} />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavClick={handleNavClick} />
      <MobileCategoryBar active={navFilter} onNavClick={handleNavClick} />
    </>
  );
}
