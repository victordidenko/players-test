import { For, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import videojs from 'video.js'
import 'videojs-contrib-eme'
import '../PlayerCommon.css'

const NAME = 'VideoJS w/VHS'
const COLOR = 'blue'

/**
 * Video.js default configuration options
 */
const options = {
  muted: true,
  autoplay: true,
  controls: false,
  children: [],
}

interface VideojsProps {
  playbackUrl?: string | null
  licenseUrl?: string | null
}

export function Videojs(props: VideojsProps) {
  let videoRef!: HTMLVideoElement
  let player: any
  const [playerStatus, setPlayerStatus] = createSignal<string | null>(null)

  let loadStartTime: number | null = null
  let lastStateChangeTime: number | null = null
  let lastState: string | null = null
  const [stateLog, setStateLog] = createSignal<string[]>([])

  const create = async () => {
    player = videojs(videoRef, options)
    player.eme()

    player.on('error', () => {
      const error = player.error()
      console.error('VideoJS: Error code', error?.code, 'object', error)
      setPlayerStatus(`error: ${error?.code ?? 'unknown'}`)
    })

    // biome-ignore format: because
    for (const eventName of ['suspend','loadedmetadata','loadeddata','durationchange','liveedgechange','timeupdate','progress','stalled','abort','canplay','canplaythrough','seeking','seeked','play','playing','pause','ended','waiting','error']) {
      player.on(eventName, () => {
        const state = (() => {
          if (player.error()) return `error ${player.error()?.code ?? 'unknown'}`
          if (player.readyState() < 3 && !player.paused()) return 'buffering'
          if (!player.hasStarted()) return
          if (player.ended()) return 'ended'
          if (player.paused()) return player.currentTime() !== 0 ? 'paused' : undefined
          return 'playing'
        })()
        if (state == null || state === lastState) return

        const time = performance.now()
        if (lastState !== 'playing' && lastStateChangeTime != null) {
          const duration = ((time - lastStateChangeTime) / 1000).toFixed(2)
          setStateLog((log) => [`${lastState} for ${duration}s`, ...log])
        }
        lastStateChangeTime = time
        lastState = state
        setPlayerStatus(state)
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
  }

  const load = async (url?: string | null, licenseUrl?: string | null) => {
    setStateLog([])
    setPlayerStatus('loading')
    lastStateChangeTime = null
    lastState = null

    if (!player) return

    if (url == null) {
      setPlayerStatus(null)
      player.reset()
      return
    }

    try {
      loadStartTime = performance.now()

      const src: any = {
        src: url,
        // type: 'application/dash+xml',
      }

      if (licenseUrl) {
        src.keySystems = {
          'com.widevine.alpha': licenseUrl,
        }
      }

      player.src(src)
      player.play()
    } catch (error: any) {
      console.error('VideoJS: Error code', error.code, 'object', error)
      setPlayerStatus(`error: ${error.code || 'unknown'}`)
    }
  }

  const destroy = async () => {
    try {
      player?.dispose()
    } catch (error) {
      console.error('VideoJS: Error destroying VideoJS player:', error)
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
      <div data-vjs-player>
        <video ref={videoRef} muted width="320" height="240" />
      </div>
    </div>
  )
}
