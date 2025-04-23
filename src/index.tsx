/* @refresh reload */
import { render } from 'solid-js/web'
import { App } from './App.tsx'

// Register media caching service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/media-cache-worker.js')
      .then((registration) => {
        console.log(
          'Media caching service worker registered:',
          registration.scope,
        )
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error)
      })
  })
}

const root = document.getElementById('root')

render(() => <App />, root!)
