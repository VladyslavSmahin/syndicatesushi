"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Modal from "./Modal";
import { CHANGELOG, APP_VERSION, type ChangeItem } from "@/data/changelog";
import { syncSeen } from "@/lib/pushClient";
import s from "./admin.module.css";

const seenKey = (uid: string) => `admin-seen-version:${uid}`;
const fmtDate = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

/**
 * Дзвіночок «Що нового»: крапка — є версія, яку цей співробітник ще не відкривав; клік — патчноути.
 * Перегляд версії йде й на сервер — від нього залежить число на іконці застосунку.
 * ?whatsnew=1 (тап по пушу «Оновлення адмінки») — відкрити одразу.
 */
export function WhatsNewBell({ uid }: { uid: string }) {
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(false);
  const show = () => {
    setOpen(true);
    setUnseen(false);
    try { localStorage.setItem(seenKey(uid), APP_VERSION); } catch { /* ignore */ }
    void syncSeen({ version: true });
  };
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("whatsnew") === "1") {
      url.searchParams.delete("whatsnew");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      show();
      return;
    }
    let seen = false;
    try { seen = localStorage.getItem(seenKey(uid)) === APP_VERSION; } catch { /* без сховища — без крапки */ }
    setUnseen(!seen);
    if (seen) void syncSeen({ version: true }); // бачив до появи серверного обліку — переносимо
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);
  return (
    <>
      <button type="button" onClick={show} className={`${s.btn} ${s.btnGhost} ${s.btnSmall} ${s.bellBtn}`}
        aria-label={unseen ? `Що нового — нова версія ${APP_VERSION}` : "Що нового"} title={`Що нового · версія ${APP_VERSION}`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unseen && <span className={s.bellDot} aria-hidden />}
      </button>
      {open && createPortal(<WhatsNewModal onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

/** Підпис версії внизу меню — теж відкриває «Що нового». */
export function VersionLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={s.versionLink} onClick={() => setOpen(true)}>Версія {APP_VERSION} · що нового</button>
      {open && createPortal(<WhatsNewModal onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

// портал у body: шапка/меню мають backdrop-filter — інакше fixed-вікно рахувалось би від них, а не від екрана
function WhatsNewModal({ onClose }: { onClose: () => void }) {
  // усі версії згорнуті до рядка «версія · назва · дата»; клік — розгорнути зміни
  const [expanded, setExpanded] = useState<string[]>([]);
  const toggle = (v: string) => setExpanded((e) => (e.includes(v) ? e.filter((x) => x !== v) : [...e, v]));
  return (
    <Modal title="Що нового" onClose={onClose}>
      <div className={s.cl}>
        {CHANGELOG.map((r, i) => {
          const isOpen = expanded.includes(r.version);
          return (
            <section key={r.version} className={s.clRelease}>
              <button type="button" className={s.clHead} onClick={() => toggle(r.version)} aria-expanded={isOpen}>
                <span className={s.clVer}>v{r.version}</span>
                <span className={s.clTitle}>{r.title}{i === 0 && <span className={s.clNew}>нове</span>}</span>
                <span className={s.clDate}>{fmtDate(r.date)}</span>
                <span aria-hidden className={s.clChev} style={{ transform: isOpen ? "rotate(180deg)" : "none" }}>▾</span>
              </button>
              {isOpen && r.groups.map((g) => (
                <div key={g.area} className={s.clGroup}>
                  <div className={s.clArea}>{g.area}</div>
                  <ul>{g.items.map((it, k) => <Item key={k} it={it} />)}</ul>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </Modal>
  );
}

function Item({ it }: { it: ChangeItem }) {
  if (typeof it === "string") return <li>{it}</li>;
  return (
    <li>
      {it.text}
      <ul>{it.sub.map((x) => <li key={x}>{x}</li>)}</ul>
    </li>
  );
}
