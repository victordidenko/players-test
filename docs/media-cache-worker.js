const CACHE_NAME = 'media-chunks-cache'
const MAX_CACHE_SIZE = 1024 * 1024 * 1024 // 1gb

// store in-flight requests to deduplicate concurrent requests
const inFlightRequests = new Map()

// simple lru tracking for cache management
let cacheUsage = 0
const cacheEntries = []

// stats tracking
let cacheHits = 0

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// handle messages from clients
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'GET_CACHE_STATS') {
    const client = event.source
    if (client) {
      client.postMessage({
        type: 'CACHE_STATS',
        stats: {
          size: cacheUsage,
          count: cacheEntries.length,
          hits: cacheHits,
        },
      })
    }
  }
})

async function updateCacheSize(response) {
  const clone = response.clone()
  const buffer = await clone.arrayBuffer()
  const size = buffer.byteLength

  cacheUsage += size
  cacheEntries.push({
    url: response.url,
    size: size,
    timestamp: Date.now(),
  })

  if (cacheUsage > MAX_CACHE_SIZE) {
    await cleanCache()
  }

  return size
}

async function cleanCache() {
  const cache = await caches.open(CACHE_NAME)

  cacheEntries.sort((a, b) => a.timestamp - b.timestamp) // oldest first

  while (cacheUsage > MAX_CACHE_SIZE * 0.8 && cacheEntries.length > 0) {
    const entry = cacheEntries.shift()
    await cache.delete(entry.url)
    cacheUsage -= entry.size
  }
}

function isMediaChunkRequest(url) {
  const path = new URL(url).pathname.toLowerCase()
  const domain = new URL(url).hostname.toLowerCase()

  // skip obvious non-media requests
  if (
    path.endsWith('.js') ||
    path.endsWith('.mjs') ||
    path.endsWith('.css') ||
    path.endsWith('.html') ||
    path.endsWith('.json') ||
    path.endsWith('.woff') ||
    path.endsWith('.woff2') ||
    path.endsWith('.svg') ||
    path.endsWith('.png') ||
    path.endsWith('.jpg') ||
    path.endsWith('.jpeg') ||
    path.endsWith('.gif') ||
    path.endsWith('.ico')
  ) {
    return false
  }

  // skip typescript files - make sure not to cache these unless they're media segments
  if (
    (path.endsWith('.ts') || path.endsWith('.tsx')) &&
    !path.includes('media') &&
    !path.includes('segment') &&
    !path.includes('chunk')
  ) {
    return false
  }

  // don't cache manifest files - players need fresh manifests
  if (path.endsWith('.mpd') || path.endsWith('.m3u8')) {
    return false
  }

  // skip drm license requests
  if (domain.endsWith('ezdrm.com')) {
    return false
  }

  // be permissive with everything else
  return true
}

function shouldCacheResource(url, contentType) {
  // don't cache manifest files - players need fresh manifests
  if (
    contentType.includes('application/dash+xml') ||
    contentType.includes('application/vnd.apple.mpegurl') ||
    contentType.includes('audio/mpegurl') ||
    contentType.includes('audio/x-mpegurl') ||
    contentType.includes('application/x-mpegurl') ||
    contentType.includes('video/x-mpegurl') ||
    contentType.includes('video/mpegurl') ||
    contentType.includes('application/mpegurl')
  ) {
    return false
  }

  // determine if this is actually media content based on response content type or url patterns
  if (
    contentType.includes('video/') ||
    contentType.includes('audio/') ||
    (contentType.includes('application/octet-stream') &&
      (url.pathname.match(/\.(m4s|mp4|ts|aac|dash)($|\?)/) ||
        url.pathname.includes('segment') ||
        url.pathname.includes('chunk') ||
        url.pathname.includes('media')))
  ) {
    return true
  }

  return false
}

// handle fetch events
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // skip non-get requests
  if (event.request.method !== 'GET') {
    return
  }

  // initial screening based on url patterns only
  if (!isMediaChunkRequest(url.href)) {
    return
  }

  // use url string as key for deduplication
  const requestKey = url.href

  event.respondWith(
    (async () => {
      // check cache first
      const cache = await caches.open(CACHE_NAME)
      const cachedResponse = await cache.match(event.request)

      if (cachedResponse) {
        // increment cache hit counter
        cacheHits++
        return cachedResponse
      }

      // check if this url is already being fetched
      const inFlightRequest = inFlightRequests.get(requestKey)
      if (inFlightRequest) {
        return inFlightRequest?.then((response) => response.clone())
      }

      // if not, make the network request and store the promise
      const fetchPromise = fetch(event.request)
        .then(async (response) => {
          if (response?.ok) {
            const contentType = response.headers.get('Content-Type') || ''

            if (shouldCacheResource(url, contentType)) {
              const clonedResponse = response.clone()
              cache.put(event.request, clonedResponse)

              await updateCacheSize(response.clone())
            }
          }

          inFlightRequests.delete(requestKey)
          return response
        })
        .catch((err) => {
          inFlightRequests.delete(requestKey)
          throw err
        })

      // store the fetch promise for potential reuse
      inFlightRequests.set(requestKey, fetchPromise)

      return fetchPromise.then((response) => response.clone())
    })(),
  )
})
