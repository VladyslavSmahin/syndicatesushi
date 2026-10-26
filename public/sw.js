// Service worker адмінки (PWA «SS Адмінка»). Лише пуш-сповіщення персоналу — сторінки й файли
// НЕ кешуємо: після деплою застосунок завжди відкриває свіжу версію. Реєструється зі scope /admin.
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
  const tasks = [
    self.registration.showNotification(data.title || 'SS Адмінка', {
      body: data.body || '',
      icon: '/pwa/admin-icon-192.png',
      badge: '/pwa/admin-icon-192.png',
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/admin' },
    }),
  ]
  // Число нових замовлень на іконці (iOS 16.4+ / Chrome, якщо сповіщення дозволені)
  if (typeof data.badge === 'number' && self.navigator.setAppBadge) {
    tasks.push(data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge())
  }
  event.waitUntil(Promise.all(tasks).catch(() => {}))
})

// Тап по сповіщенню: відкрити потрібний екран у вже запущеному застосунку або запустити його
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/admin', self.location.origin).href
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const client = all.find((c) => new URL(c.url).pathname.startsWith('/admin'))
    if (client) {
      await client.focus()
      if ('navigate' in client) return client.navigate(url).catch(() => client.postMessage({ type: 'open', url }))
      return
    }
    return self.clients.openWindow(url)
  })())
})
