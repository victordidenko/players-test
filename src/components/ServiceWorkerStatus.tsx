import { createSignal, onMount } from 'solid-js'
import './ServiceWorkerStatus.css'

export type CacheStats = {
  size: number
  count: number
  hits: number
}

export function ServiceWorkerStatus() {
  const [swStatus, setSwStatus] = createSignal(
    'Checking service worker status...',
  )
  const [cacheStats, setCacheStats] = createSignal<CacheStats>({
    size: 0,
    count: 0,
    hits: 0,
  })

  onMount(() => {
    // Check service worker status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => {
          setSwStatus('Media caching service worker active')

          // Listen for messages from service worker
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'CACHE_STATS') {
              setCacheStats(event.data.stats)
            }
          })

          // Request initial stats
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'GET_CACHE_STATS',
            })
          }
        })
        .catch((err) => {
          setSwStatus(`Service worker error: ${err.message}`)
        })
    } else {
      setSwStatus('Service workers not supported in this browser')
    }

    // Set up periodic stats updates
    const statsInterval = setInterval(() => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'GET_CACHE_STATS',
        })
      }
    }, 2000)

    return () => clearInterval(statsInterval)
  })

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
  }

  return (
    <div class="status-panel">
      <div>
        <strong>Service Worker:</strong> {swStatus()}
      </div>
      <div class="status-stats">
        <div>
          <strong>Cache size:</strong> {formatBytes(cacheStats().size)}
        </div>
        <div>
          <strong>Files cached:</strong> {cacheStats().count}
        </div>
        <div>
          <strong>Cache hits:</strong> {cacheStats().hits}
        </div>
      </div>
    </div>
  )
}
