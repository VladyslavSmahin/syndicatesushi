// node scripts/gen-pwa-icons.mjs — іконки PWA (магазин + адмінка) з src/app/icon.png (512×512)
// Иконки PWA суши-шопа из src/app/icon.png (512×512): магазин, маскируемая, админка.
import sharp from 'sharp'
const S = new URL('..', import.meta.url).pathname.replace(/\/$/, '')
const src = `${S}/src/app/icon.png`
const out = `${S}/public/pwa`
const BG = '#000000'
const GOLD = '#C9A84C'

const logo = (size) => sharp(src).resize(size, size).png().toBuffer()

// Маскируемая: безопасная зона — круг 80% → логотип ~72% по центру на чёрном
async function maskable(size) {
  const inner = Math.round(size * 0.72)
  return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: await logo(inner), gravity: 'center' }]).png().toBuffer()
}

// Админка: логотип чуть выше и меньше + золотая плашка «АДМІН» снизу
async function admin(size, maskableSafe = false) {
  const scale = maskableSafe ? 0.62 : 0.8
  const inner = Math.round(size * scale)
  const ribbonH = Math.round(size * (maskableSafe ? 0.12 : 0.17))
  const ribbonW = Math.round(size * (maskableSafe ? 0.5 : 0.72))
  const ribbonY = Math.round(size * (maskableSafe ? 0.67 : 0.76))
  const font = Math.round(ribbonH * 0.62)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect x="${(size - ribbonW) / 2}" y="${ribbonY}" width="${ribbonW}" height="${ribbonH}" rx="${ribbonH / 2}" fill="${GOLD}"/>
    <text x="50%" y="${ribbonY + ribbonH / 2}" dominant-baseline="central" text-anchor="middle"
      font-family="Helvetica Neue, Arial, sans-serif" font-weight="700" font-size="${font}" letter-spacing="${font * 0.12}" fill="#1A1208">АДМІН</text>
  </svg>`
  const logoTop = Math.round(size * (maskableSafe ? 0.16 : 0.04))
  return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([
      { input: await logo(inner), top: logoTop, left: Math.round((size - inner) / 2) },
      { input: Buffer.from(svg), top: 0, left: 0 },
    ]).png().toBuffer()
}

const files = {
  'icon-192.png': await logo(192),
  'icon-512.png': await logo(512),
  'icon-maskable-512.png': await maskable(512),
  'admin-icon-192.png': await admin(192),
  'admin-icon-512.png': await admin(512),
  'admin-icon-maskable-512.png': await admin(512, true),
  'admin-apple-touch-icon.png': await admin(180),
}
for (const [name, buf] of Object.entries(files)) await sharp(buf).toFile(`${out}/${name}`)
console.log(Object.keys(files).join(', '))
