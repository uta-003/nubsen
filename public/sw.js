/* AbsenKu Service Worker
 * Strategi caching:
 *  - Navigasi halaman : network-first → fallback cache index.html → offline.html
 *  - /assets/*        : cache-first (file ber-hash dari build Vite)
 *  - /api/* (GET)     : network-first → cache → respons offline JSON
 *  - Lainnya          : stale-while-revalidate
 */
const VERSION = 'v1.4.0'
const STATIC_CACHE = `absenku-static-${VERSION}`
const RUNTIME_CACHE = `absenku-runtime-${VERSION}`

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/logo-icon.png',
  '/logo-mark.png',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// ============ Web Push (server → perangkat) ============
// Payload JSON: { judul, pesan, tag?, url? }. Dipakai untuk pemberitahuan
// penting seperti perubahan jadwal kerja — muncul walau aplikasi tertutup.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { pesan: event.data && event.data.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.judul || 'NUBSEN', {
      body: data.pesan || '',
      icon: '/logo-icon.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'nubsen-push',
      data: { url: data.url || '/' },
    }),
  )
})

// Klik notifikasi → buka/fokus aplikasi pada halaman terkait.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    (async () => {
      const daftar = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const klien of daftar) {
        if (klien.url.startsWith(self.location.origin)) {
          await klien.focus()
          if ('navigate' in klien && !klien.url.includes(url)) await klien.navigate(url)
          return
        }
      }
      return self.clients.openWindow(url)
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return // POST (absen/izin) selalu ke jaringan

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // 1) Navigasi halaman
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, { fallback: '/index.html', final: '/offline.html' }),
    )
    return
  }

  // 2) Aset build ber-hash
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  // 3) API GET
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      networkFirst(request, {
        offlineResponse: new Response(
          JSON.stringify({ error: 'Luring: server tidak terjangkau dari cache.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        ),
      }),
    )
    return
  }

  // 4) Lainnya (ikon, manifest, dsb.)
  event.respondWith(staleWhileRevalidate(request))
})

async function networkFirst(request, { fallback = null, final = null, offlineResponse = null } = {}) {
  try {
    const res = await fetch(request)
    const cache = await caches.open(RUNTIME_CACHE)
    cache.put(request, res.clone())
    return res
  } catch {
    const cached =
      (await caches.match(request)) ||
      (fallback && (await caches.match(fallback))) ||
      (final && (await caches.match(final)))
    return cached || offlineResponse || Response.error()
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) {
    // Perbarui cache di latar belakang (stale-while-revalidate ringan)
    fetch(request)
      .then((res) => caches.open(RUNTIME_CACHE).then((c) => c.put(request, res)))
      .catch(() => {})
    return cached
  }
  const res = await fetch(request)
  const cache = await caches.open(RUNTIME_CACHE)
  cache.put(request, res.clone())
  return res
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request)
  const network = fetch(request)
    .then((res) => {
      caches.open(RUNTIME_CACHE).then((c) => c.put(request, res.clone()))
      return res
    })
    .catch(() => cached || Response.error())
  return cached || network
}
