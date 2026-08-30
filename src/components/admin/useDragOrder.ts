"use client";

import { useState } from "react";

/**
 * Перетягування для впорядкованих списків адмінки (товари, категорії).
 * Дає пропси для рядка + стрілки ↑/↓ (єдиний спосіб на тач-екранах, де
 * HTML5 drag-and-drop не працює). Порядок застосовується колбеком onReorder,
 * який отримує новий масив id.
 */
export function useDragOrder(onReorder: (ids: string[]) => void) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // тягнути можна лише за «ручку» ⠿ — інакше не виділити текст у рядку
  const [armedId, setArmedId] = useState<string | null>(null);

  const reorder = (ids: string[], from: number, to: number) => {
    if (from < 0 || to < 0 || from === to) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };

  /** пропси рядка списку: ids — поточний порядок групи, id — цей рядок */
  const rowProps = (ids: string[], id: string) => ({
    draggable: armedId === id,
    onDragStart: () => setDragId(id),
    onDragEnter: () => { if (dragId && dragId !== id) setOverId(id); },
    onDragOver: (e: React.DragEvent) => { if (dragId) e.preventDefault(); },
    onDragEnd: () => { setDragId(null); setOverId(null); setArmedId(null); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const from = dragId ? ids.indexOf(dragId) : -1;
      setDragId(null); setOverId(null); setArmedId(null);
      if (from >= 0) reorder(ids, from, ids.indexOf(id));
    },
  });

  /** пропси «ручки»: вмикає draggable саме для цього рядка */
  const handleProps = (id: string) => ({
    onMouseDown: () => setArmedId(id),
    onMouseUp: () => setArmedId(null),
    onTouchStart: () => setArmedId(id),
  });

  /** зсув на один крок стрілками */
  const move = (ids: string[], id: string, dir: -1 | 1) => {
    const i = ids.indexOf(id);
    reorder(ids, i, i + dir);
  };

  return { dragId, overId, rowProps, handleProps, move };
}
