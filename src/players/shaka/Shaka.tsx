import * as shaka from 'shaka-player'
import { For, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import '../PlayerCommon.css'

const NAME = 'Shaka'
const COLOR = 'red'

/**
 * Shaka Player default configuration options
 */
const options = {
  // shaka configuration options
}

shaka.polyfill.installAll()

interface ShakaProps {
  playbackUrl?: string | null
  licenseUrl?: string | null
}

export function Shaka(props: ShakaProps) {
  let videoRef!: HTMLVideoElement
  let player: shaka.Player | null = null
  const [playerStatus, setPlayerStatus] = createSignal<string | null>(null)

  let loadStartTime: number | null = null
  let lastStateChangeTime: number | null = null
  let lastState: string | null = null
  const [stateLog, setStateLog] = createSignal<string[]>([])

  const create = async () => {
    try {
      player = new shaka.Player()
      if (player) {
        await player.attach(videoRef)
        player.configure(options)

        player.addEventListener('error', (event: any) => {
          const error = event.detail
          console.error('Shaka: Error code', error.code, 'object', error)
          setPlayerStatus(`error: ${error.code}`)
        })

        player.addEventListener('statechanged', (event: any) => {
          const { newstate: state, timeStamp: time } = event
          if (lastState !== 'playing' && lastStateChangeTime != null) {
            const duration = ((time - lastStateChangeTime) / 1000).toFixed(2)
            setStateLog((log) => [`${lastState} for ${duration}s`, ...log])
          }
          lastStateChangeTime = time
          lastState = state
          setPlayerStatus((s) => (s?.startsWith('error') ? s : state)) // preserve error state
        })
      }

      videoRef.muted = true
      videoRef.addEventListener('loadeddata', () => {
        if (loadStartTime !== null) {
          const loadEndTime = performance.now()
          const timeToLoad = ((loadEndTime - loadStartTime) / 1000).toFixed(2)
          setStateLog((log) => [`▶ loaded in ${timeToLoad}s`, ...log])
        }
      })
    } catch (error) {
      console.error('Shaka: Error initializing Shaka player:', error)
    }
  }

  const load = async (url?: string | null, licenseUrl?: string | null) => {
    setStateLog([])
    setPlayerStatus('loading')
    lastStateChangeTime = null
    lastState = null

    if (!player) return

    if (url == null) {
      setPlayerStatus(null)
      await player.unload()
      return
    }

    try {
      loadStartTime = performance.now()

      if (licenseUrl) {
        player.configure({
          drm: {
            servers: {
              'com.widevine.alpha': licenseUrl,
            },
          },
        })
      }

      await player.attach(videoRef)
      await player.load(url)

      videoRef
        .play()
        .catch((err) => console.error('Shaka: Error auto-playing video:', err))
    } catch (error: any) {
      console.error('Shaka: Error code', error.code, 'object', error)
      setPlayerStatus(`error: ${error.code || 'unknown'}`)
    }
  }

  const destroy = async () => {
    try {
      await player?.destroy()
    } catch (error) {
      console.error('Shaka: Error destroying Shaka player:', error)
    }
  }

  onMount(() => create())
  createEffect(() => load(props.playbackUrl, props.licenseUrl))
  onCleanup(() => destroy())

  return (
    <div class="player-container">
      <div class="player-label player-name-label" style={{ background: COLOR }}>
        {NAME}
      </div>
      <div class="player-label player-status-label">{playerStatus()}</div>
      <div class="player-label player-time-label">
        <For each={stateLog()}>{(log) => <div>{log}</div>}</For>
      </div>
      <video ref={videoRef} muted width="320" height="240" />
    </div>
  )
}
