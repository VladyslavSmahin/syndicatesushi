'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import '@fontsource/press-start-2p/latin-400.css'
import '@fontsource/press-start-2p/cyrillic-400.css'
import s from './Cat404.module.css'

// 404: чорний екран на всю ширину, піксельна хуртовина — сніг косими штрихами б'ється об кота з мечем, плащ
// шарпає вітер. Поверх — «404», текст і кнопка піксельним шрифтом (Press Start 2P, OFL, роздається з нашого домену).
// Та сама анімація, що й на Accent (KP/Accent → Cat404Animation), але золотом бренду.
// Кот — «карта» public/404/cat-field.png 175×240 (R — кот/меч/сугроб, G — плащ, B — силуэт для брызг), её строит
// scripts/gen-404-field.mjs. Сетка экрана: 240 рядов на высоту блока (до 1024px +90 рядов сверху под текст),
// ширина — сколько клеток влезает. Кот на ПК справа во всю высоту, на телефоне — снизу по центру.
// Настройки утверждены на прототипе: снег 260 (на квадрат 240×240), ветер 14, плащ 12.

const CAT_W = 175
const CAT_H = 240
const MOBILE_TOP = 90
const S = 1438 / CAT_H // исходных px в клетке — для координат из скрипта
const CROP_X = 200
const CAPE_ANCHOR_X = 700
const GOLD = [201, 168, 76] // --gold бренду (#C9A84C)
const FPS = 24
const SNOW_PER_CELL = 260 / (240 * 240)
const WIND = 1.4
const CAPE_AMP = (12 / 4) * (0.6 + WIND * 0.35)

const B8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
]

type Flake = { x: number; y: number; v: number; len: number; a: number }
type Puff = { x: number; y: number; vx: number; vy: number; life: number }

export default function Cat404() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const catRest = new Float32Array(CAT_W * CAT_H)
    const catCape = new Float32Array(CAT_W * CAT_H)
    const catSolid = new Uint8Array(CAT_W * CAT_H)

    // Состояние сетки — пересоздаётся при смене размера
    let W = 0
    let H = 0
    let ox = 0
    let oy = 0
    let img: ImageData
    let rest = new Float32Array(0)
    let solid = new Uint8Array(0)
    let field = new Float32Array(0)
    let snow = new Uint8Array(0)
    let thr = new Float32Array(0)
    let ready = false

    const vx = -(0.9 + WIND)
    const vy = 0.36 * (0.9 + WIND) + 0.15
    const L = Math.hypot(vx, vy)
    const ux = vx / L
    const uy = vy / L

    const flakes: Flake[] = []
    const puffs: Puff[] = []
    const spawn = (f: Flake, anywhere: boolean) => {
      f.x = anywhere ? Math.random() * (W + 60) : W + Math.random() * 40
      f.y = anywhere ? Math.random() * H : Math.random() * (H * 0.6 + 40) - 60
      f.v = 0.8 + Math.random() * 1.6
      f.len = Math.random() < 0.3 ? 1 : 4 + Math.floor(Math.random() * 20)
      f.a = 0.55 + Math.random() * 0.45
      return f
    }

    const layout = () => {
      const box = canvas.getBoundingClientRect()
      if (!box.width || !box.height) return
      const mobile = box.width < 1024
      H = CAT_H + (mobile ? MOBILE_TOP : 0)
      const cell = box.height / H
      W = Math.max(60, Math.round(box.width / cell))
      // ПК: кот справа с отступом; телефон: снизу, чуть правее центра — чтобы плащ (слева) влез
      ox = mobile ? Math.round((W - CAT_W) / 2 + 6) : W - CAT_W - Math.round(W * 0.06)
      oy = H - CAT_H
      canvas.width = W
      canvas.height = H
      img = ctx.createImageData(W, H)
      rest = new Float32Array(W * H)
      solid = new Uint8Array(W * H)
      field = new Float32Array(W * H)
      snow = new Uint8Array(W * H)
      thr = new Float32Array(W * H)
      let seed = 7
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        thr[y * W + x] = Math.min(0.97, Math.max(0.04, ((B8[(y % 8) * 8 + (x % 8)] + 0.5) / 64) * 0.85 + rnd() * 0.15))
      }
      for (let cy = 0; cy < CAT_H; cy++) for (let cx = 0; cx < CAT_W; cx++) {
        const x = cx + ox
        const y = cy + oy
        if (x < 0 || y < 0 || x >= W || y >= H) continue
        rest[y * W + x] = catRest[cy * CAT_W + cx]
        solid[y * W + x] = catSolid[cy * CAT_W + cx]
      }
      const count = Math.round(SNOW_PER_CELL * W * H)
      flakes.length = 0
      for (let i = 0; i < count; i++) flakes.push(spawn({ x: 0, y: 0, v: 0, len: 0, a: 0 }, true))
      puffs.length = 0
    }

    const splash = (x: number, y: number, speed: number) => {
      const n = 3 + Math.floor(Math.random() * 4)
      for (let k = 0; k < n; k++) {
        puffs.push({
          x,
          y,
          vx: -speed * (0.15 + Math.random() * 0.45) + (Math.random() - 0.5) * 0.9,
          vy: -(0.4 + Math.random() * 1.1),
          life: 6 + Math.floor(Math.random() * 10),
        })
      }
    }

    const draw = (now: number) => {
      const time = now / 1000
      field.set(rest)
      snow.fill(0)

      // Плащ: сносит по ветру (влево) порывами и бежит волна от крепления к краю
      const gust = 0.65 + 0.35 * Math.sin(time * 0.9) + 0.25 * Math.max(0, Math.sin(time * 3.7 + Math.sin(time * 1.3) * 2))
      for (let cy = 0; cy < CAT_H; cy++) for (let cx = 0; cx < CAT_W; cx++) {
        const f = Math.min(1, Math.max(0, (CAPE_ANCHOR_X - (CROP_X + (cx + 0.5) * S)) / 330)) ** 1.1
        if (f === 0) continue
        const gx = cx + ox
        const gy = cy + oy
        if (gx < 0 || gx >= W) continue
        const lift = Math.max(0, (1120 - (cy + 0.5) * S) / 450)
        const k = f * (0.6 + lift * 0.7)
        const stretch = CAPE_AMP * k * gust * 1.1
        const wave = CAPE_AMP * k * (0.8 * Math.sin(time * 6.2 + cx * 0.42 - cy * 0.08) + 0.35 * Math.sin(time * 11.3 + cy * 0.37))
        const sx = Math.round(cx + stretch + wave * 0.6)
        const sy = Math.round(cy + CAPE_AMP * k * (0.5 * Math.sin(time * 5.1 + cx * 0.3) + 0.35 * gust))
        if (sx < 0 || sy < 0 || sx >= CAT_W || sy >= CAT_H) continue
        const v = catCape[sy * CAT_W + sx]
        const i = gy * W + gx
        if (v > field[i]) field[i] = v
      }

      // Снег: косые штрихи вправо → влево-вниз, о кота и меч разбивается брызгами
      for (const fl of flakes) {
        const steps = Math.max(1, Math.ceil(L * fl.v))
        let hit = false
        for (let s = 0; s < steps && !hit; s++) {
          fl.x += (ux * fl.v * L) / steps
          fl.y += (uy * fl.v * L) / steps
          const x = Math.round(fl.x)
          const y = Math.round(fl.y)
          if (x >= 0 && y >= 0 && x < W && y < H && solid[y * W + x]) {
            splash(x + 1, y - 1, vx * fl.v)
            spawn(fl, false)
            hit = true
          }
        }
        if (hit) continue
        if (fl.x < -24 || fl.y > H + 24) spawn(fl, false)
        for (let s = 0; s < fl.len; s++) {
          const x = Math.round(fl.x - ux * s)
          const y = Math.round(fl.y - uy * s)
          if (x < 0 || y < 0 || x >= W || y >= H) continue
          const i = y * W + x
          if (rest[i] > 0.25) continue
          if (fl.a * (1 - s / (fl.len + 2)) > 0.35 || (s & 1) === 0) snow[i] = 1
        }
      }
      for (let p = puffs.length - 1; p >= 0; p--) {
        const q = puffs[p]
        q.x += q.vx
        q.y += q.vy
        q.vy += 0.18
        q.vx += vx * 0.02
        q.life--
        if (q.life <= 0) {
          puffs.splice(p, 1)
          continue
        }
        const x = Math.round(q.x)
        const y = Math.round(q.y)
        if (x >= 0 && y >= 0 && x < W && y < H && !solid[y * W + x]) snow[y * W + x] = 1
      }
      if (puffs.length > 1500) puffs.splice(0, puffs.length - 1500)

      const d = img.data
      for (let i = 0; i < field.length; i++) {
        const on = snow[i] === 1 || field[i] > thr[i]
        const k = i * 4
        d[k] = on ? GOLD[0] : 0
        d[k + 1] = on ? GOLD[1] : 0
        d[k + 2] = on ? GOLD[2] : 0
        d[k + 3] = 255
      }
      ctx.putImageData(img, 0, 0)
    }

    let raf = 0
    let last = 0
    let visible = true
    let alive = true
    const loop = (now: number) => {
      if (!alive) return
      raf = requestAnimationFrame(loop)
      if (!ready || !visible || document.hidden || now - last < 1000 / FPS) return
      last = now
      draw(now)
    }

    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
    io.observe(canvas)
    const ro = new ResizeObserver(() => {
      if (!ready) return
      layout()
      if (reduce) draw(0)
    })
    ro.observe(canvas)

    const map = new Image()
    map.src = '/404/cat-field.png'
    map.onload = () => {
      if (!alive) return
      const off = document.createElement('canvas')
      off.width = CAT_W
      off.height = CAT_H
      const o = off.getContext('2d', { willReadFrequently: true })
      if (!o) return
      o.drawImage(map, 0, 0)
      const px = o.getImageData(0, 0, CAT_W, CAT_H).data
      for (let i = 0; i < CAT_W * CAT_H; i++) {
        catRest[i] = px[i * 4] / 255
        catCape[i] = px[i * 4 + 1] / 255
        catSolid[i] = px[i * 4 + 2] > 127 ? 1 : 0
      }
      ready = true
      layout()
      if (reduce) draw(0)
      else raf = requestAnimationFrame(loop)
    }

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
    }
  }, [])

  return (
    <section className={s.hero}>
      <canvas ref={ref} className={s.canvas} role="img" aria-label="Піксельна анімація: кіт із мечем у хуртовину, вітер шарпає плащ" />
      <div className={s.text}>
        <h1 className={s.code}>404</h1>
        <p className={s.title}>Сторінку не знайдено або її видалено.</p>
        <Link href="/" className={s.btn}>На головну &gt;</Link>
      </div>
    </section>
  )
}
