import Hls, { type HlsConfig } from 'hls.js'
import { For, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import '../PlayerCommon.css'

const NAME = 'HLS.js'
const COLOR = 'darkcyan'

/**
 * HLS.js default configuration options
 */
const options = {
  // hls.js configuration options
}

interface HlsjsProps {
  playbackUrl?: string | null
  licenseUrl?: string | null
}

export function Hlsjs(props: HlsjsProps) {
  let videoRef!: HTMLVideoElement
  let player: Hls | undefined
  const [playerStatus, setPlayerStatus] = createSignal<string | null>(null)

  let loadStartTime: number | null = null
  let lastStateChangeTime: number | null = null
  let lastState: string | null = null
  const [stateLog, setStateLog] = createSignal<string[]>([])

  const create = async () => {
    try {
      videoRef.muted = true
      videoRef.addEventListener('loadeddata', () => {
        if (loadStartTime !== null) {
          const loadEndTime = performance.now()
          const timeToLoad = ((loadEndTime - loadStartTime) / 1000).toFixed(2)
          setStateLog((log) => [`▶ loaded in ${timeToLoad}s`, ...log])
        }
      })
    } catch (error) {
      console.error('Hlsjs: Error creating Hlsjs player:', error)
    }
  }

  const load = async (url?: string | null, licenseUrl?: string | null) => {
    setStateLog([])
    setPlayerStatus('loading')
    lastStateChangeTime = null
    lastState = null

    player?.detachMedia()
    player?.destroy()
    player = undefined

    if (url == null) {
      setPlayerStatus(null)
      return
    }

    try {
      loadStartTime = performance.now()

      const opts: Partial<HlsConfig> = { ...options }

      if (licenseUrl) {
        opts.emeEnabled = true
        opts.enableWorker = true
        opts.drmSystems = {
          'com.widevine.alpha': {
            licenseUrl: licenseUrl,
          },
        }
      }

      player = new Hls(opts)
      player.loadSource(url)
      player.attachMedia(videoRef)

      player.on(Hls.Events.ERROR, (_event, data) => {
        const error = data.error as any
        console.error('Hlsjs: Error code', error.code, 'object', error)
        setPlayerStatus(`error: ${error.code || 'unknown'}`)
      })

      player.on(Hls.Events.MEDIA_ATTACHED, () => {
        videoRef.play().catch((err) => {
          console.error('Hlsjs: Error auto-playing video:', err)
        })
      })
    } catch (error) {
      console.error('Hlsjs: Error loading player:', error)
    }
  }

  const destroy = async () => {
    try {
      player?.detachMedia()
      player?.destroy()
      player = undefined
    } catch (error) {
      console.error('Hlsjs: Error destroying Hlsjs player:', error)
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
