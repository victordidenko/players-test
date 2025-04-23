import { For, createSignal, onCleanup, onMount } from 'solid-js'
import { PlayerGrid } from './components/PlayerGrid'
import { ServiceWorkerStatus } from './components/ServiceWorkerStatus'
import './App.css'

const sources = [
  {
    name: 'Big Buck Bunny',
    playbackUrl: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
    licenseUrl: '',
  },
  {
    name: 'Big Buck Bunny',
    playbackUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    licenseUrl: '',
  },
  {
    name: 'Sintel',
    playbackUrl:
      'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    licenseUrl: '',
  },
  {
    name: 'Tears of Steel',
    playbackUrl:
      'https://media.axprod.net/TestVectors/v7-Clear/Manifest_1080p.mpd',
    licenseUrl: '',
  },
  {
    name: 'Tears of Steel',
    playbackUrl:
      'https://cdn.bitmovin.com/content/demos/4k/38e843e0-1998-11e9-8a92-c734cd79b4dc/manifest.m3u8',
    licenseUrl: '',
  },
  {
    name: 'Forbidden Planet',
    playbackUrl:
      'http://sample.vodobox.com/planete_interdite/planete_interdite_alternate.m3u8',
    licenseUrl: '',
  },
]

export function App() {
  const [src, setSrc] = createSignal<{
    playbackUrl?: string | null
    licenseUrl?: string | null
  } | null>(null)

  const [inputValue, setInputValue] = createSignal('')
  const [licenseInputValue, setLicenseInputValue] = createSignal('')
  const [dynamicSources, setDynamicSources] = createSignal([...sources])

  onMount(() => {
    const savedPlaybackUrl = localStorage.getItem('playbackUrl')
    const savedLicenseUrl = localStorage.getItem('licenseUrl')
    const savedSources = localStorage.getItem('dynamicSources')

    if (savedSources) {
      setDynamicSources(JSON.parse(savedSources))
    }

    if (savedPlaybackUrl) {
      setInputValue(savedPlaybackUrl)
      setLicenseInputValue(savedLicenseUrl || '')
      setSrc({
        playbackUrl: savedPlaybackUrl,
        licenseUrl: savedLicenseUrl || '',
      })
    } else {
      setInputValue(src()?.playbackUrl || '')
      setLicenseInputValue(src()?.licenseUrl || '')
    }

    // handle global document paste event
    document.addEventListener('paste', handlePaste)
    onCleanup(() => {
      document.removeEventListener('paste', handlePaste)
    })
  })

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    const newStream = {
      name: 'Custom Stream',
      playbackUrl: inputValue(),
      licenseUrl: licenseInputValue(),
    }

    // Check if the stream already exists in the sources list
    const exists = dynamicSources().some(
      (stream) => stream.playbackUrl === newStream.playbackUrl,
    )

    if (!exists && newStream.playbackUrl) {
      const updatedSources = [...dynamicSources(), newStream]
      setDynamicSources(updatedSources)

      // Save updated sources to localStorage
      localStorage.setItem('dynamicSources', JSON.stringify(updatedSources))
    }

    setSrc({
      playbackUrl: inputValue() || null,
      licenseUrl: licenseInputValue() || null,
    })

    // Save to localStorage
    localStorage.setItem('playbackUrl', inputValue())
    localStorage.setItem('licenseUrl', licenseInputValue())
  }

  const selectStream = (url: string, licenseUrl: string) => {
    setInputValue(url)
    setLicenseInputValue(licenseUrl)
    setSrc({
      playbackUrl: url,
      licenseUrl: licenseUrl,
    })

    // Save to localStorage
    localStorage.setItem('playbackUrl', url)
    localStorage.setItem('licenseUrl', licenseUrl)
  }

  const stopAllPlayers = () => {
    setSrc(null)
  }

  const deleteStream = (playbackUrl: string) => {
    const updatedSources = dynamicSources().filter(
      (stream) => stream.playbackUrl !== playbackUrl,
    )
    setDynamicSources(updatedSources)

    // Save updated sources to localStorage
    localStorage.setItem('dynamicSources', JSON.stringify(updatedSources))
  }

  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData?.getData('text')
    if (pasted) {
      try {
        const parsed = JSON.parse(pasted)
        if (
          Array.isArray(parsed) &&
          parsed.every(
            (item) =>
              item != null && typeof item === 'object' && item.playbackUrl,
          )
        ) {
          const newStreams = parsed.map((item) => ({
            name: item.name || 'Custom Stream',
            playbackUrl: item.playbackUrl,
            licenseUrl: item.licenseUrl || '',
          }))
          const updatedSources = [...dynamicSources(), ...newStreams]
          setDynamicSources(updatedSources)

          // Save updated sources to localStorage
          localStorage.setItem('dynamicSources', JSON.stringify(updatedSources))
        } else if (parsed.payload?.playbackUrl) {
          setInputValue(parsed.payload.playbackUrl)
          if (parsed.payload?.drm?.la?.WIDEVINE?.licenseUrl) {
            setLicenseInputValue(parsed.payload.drm.la.WIDEVINE.licenseUrl)
          } else {
            setLicenseInputValue('')
          }
        } else {
          setInputValue(pasted)
          setLicenseInputValue('')
        }
      } catch (error) {
        setInputValue(pasted)
        setLicenseInputValue('')
      }
    }
  }

  return (
    <>
      <ServiceWorkerStatus />

      <div class="main-container">
        <div class="stream-list-container">
          <For each={dynamicSources()}>
            {(stream) => {
              const streamType = stream.playbackUrl.includes('.m3u8')
                ? 'hls'
                : 'dash'
              return (
                <div class="stream-item-container">
                  <span class={`stream-type-label ${streamType}`}>
                    {streamType}
                  </span>
                  <button
                    type="button"
                    class={`stream-item ${src()?.playbackUrl === stream.playbackUrl ? 'active' : ''}`}
                    onClick={() =>
                      selectStream(stream.playbackUrl, stream.licenseUrl)
                    }
                  >
                    <strong>{stream.name}</strong> {stream.playbackUrl}
                  </button>
                  <button
                    type="button"
                    class="delete-btn"
                    onClick={() => deleteStream(stream.playbackUrl)}
                  >
                    &times;
                  </button>
                </div>
              )
            }}
          </For>
        </div>

        <form onSubmit={handleSubmit} class="url-form">
          <div class="input-group">
            <label for="playback-url">Playback URL: </label>
            <input
              id="playback-url"
              type="text"
              value={inputValue()}
              on:input={(e) => setInputValue(e.target.value)}
              on:paste={(e) => e.stopPropagation()}
              class="url-input"
            />
            <button type="submit" class="btn">
              Play
            </button>
          </div>
          <div class="input-group">
            <label for="license-url">License URL (Widevine): </label>
            <input
              id="license-url"
              type="text"
              value={licenseInputValue()}
              on:input={(e) => setLicenseInputValue(e.target.value)}
              on:paste={(e) => e.stopPropagation()}
              class="url-input"
            />
            <button
              type="button"
              class="btn btn-secondary"
              onClick={stopAllPlayers}
            >
              Stop
            </button>
          </div>
        </form>
      </div>

      <PlayerGrid
        playbackUrl={src()?.playbackUrl}
        licenseUrl={src()?.licenseUrl}
      />
    </>
  )
}
