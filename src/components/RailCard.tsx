"use client";

import { Icon, PhotoSlot } from "./icons";
import { useGloss } from "@/features/publicData";
import FavoriteStar from "./FavoriteStar";
import type { Product } from "@/lib/types";

/** Картка стрічки «Новинки / Хіти / Акції»: вертикальне фото на всю картку,
 *  назва й ціна — поверх затемнення знизу. Клік — модалка страви, «+» — у кошик. */
export default function RailCard({ item, onAdd, onClick }: {
  item: Product;
  onAdd: (item: Product) => void;
  onClick: () => void;
}) {
  const badgeHit = useGloss("badge_hit");
  const badgeNew = useGloss("badge_new");
  const badgeLabel = item.badge === "ХІТ" ? badgeHit : item.badge === "НОВЕ" ? badgeNew : item.badge;
  const off = item.oldPrice && item.oldPrice > item.price ? Math.round((1 - item.price / item.oldPrice) * 100) : 0;
  const pcs = /^\d+$/.test(item.pieces?.trim() ?? "") ? `${item.pieces.trim()} шт` : item.pieces;
  const meta = [item.weight, pcs].filter(Boolean).join(" · ");

  return (
    <div className="rail-card" onClick={onClick}>
      <div className="rail-photo">
        <PhotoSlot h="100%" photo={item.photo} alt={`${item.name} — суші та роли, Тульчин`} thumb />
      </div>
      <div className="rail-shade" aria-hidden />
      <FavoriteStar productId={item.id} name={item.name} size={30} />
      <div className="rail-tags">
        {off > 0 && <span className="rail-off">−{off}%</span>}
        {item.badge && <span className={`rail-badge${item.badge === "НОВЕ" ? " new" : ""}`}>{badgeLabel}</span>}
      </div>

      <div className="rail-info">
        <h3 className="rail-name">
          {/* справжнє посилання для пошуковиків; звичайний клік — модалка (як у MenuCard) */}
          <a href={`/menu/${item.slug}`} onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) { e.stopPropagation(); return; }
            e.preventDefault();
          }}>{item.name}</a>
        </h3>
        {meta && <div className="rail-meta">{meta}</div>}
        <div className="rail-row">
          <div className="rail-price">
            {item.oldPrice && <s>{item.oldPrice}</s>}
            <b className={item.oldPrice ? "promo" : ""}>{item.price}</b> <span>грн</span>
          </div>
          <button type="button" className="rail-add" aria-label={`Додати ${item.name}`}
            onClick={(e) => { e.stopPropagation(); onAdd(item); }}>
            <Icon.Plus width="14" height="14" />
          </button>
        </div>
      </div>
    </div>
  );
}
