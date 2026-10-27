// Service worker для пуш-сповіщень двох застосунків: «SS Адмінка» (scope /admin, персонал) і сайт
// (scope /, клієнти). Сторінки й файли НЕ кешуємо: після деплою завжди відкривається свіжа версія.
//
// Пуш від сервера (lib/push.server.ts) — JSON { title, body, url, tag, badge }.
// iOS вимагає показати сповіщення на кожен пуш (userVisibleOnly), інакше відкличе підписку.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const icon = isAdminScope() ? '/pwa/admin-icon-192.png' : '/pwa/icon-192.png'
  const tasks = [
    self.registration.showNotification(data.title || 'SS Адмінка', {
      body: data.body || '',
      icon,
      badge: icon,
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || scopePath() },
    }),
  ]
  // Число нових замовлень на іконці (iOS 16.4+ / Chrome, якщо сповіщення дозволені)
  if (typeof data.badge === 'number' && self.navigator.setAppBadge) {
    tasks.push(data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge())
  }
  event.waitUntil(Promise.all(tasks).catch(() => {}))
})

function scopePath() {
  return new URL(self.registration.scope).pathname
}
function isAdminScope() {
  return scopePath().startsWith('/admin')
}

// Тап по сповіщенню: відкрити потрібний екран у вже запущеному застосунку або запустити його
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || scopePath(), self.location.origin).href
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // вікно саме цього застосунку: для сайту — будь-яке, крім адмінки
    const client = all.find((c) => new URL(c.url).pathname.startsWith('/admin') === isAdminScope())
    if (client) {
      await client.focus()
      if ('navigate' in client) return client.navigate(url).catch(() => client.postMessage({ type: 'open', url }))
      return
    }
    return self.clients.openWindow(url)
  })())
})
