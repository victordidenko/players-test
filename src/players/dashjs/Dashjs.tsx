import * as dashjs from 'dashjs'
import { For, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import '../PlayerCommon.css'

const NAME = 'Dash.js'
const COLOR = 'green'

/**
 * Dash.js default configuration options
 */
const options = {
  // dash.js configuration options
}

interface DashjsProps {
  playbackUrl?: string | null
  licenseUrl?: string | null
}

export function Dashjs(props: DashjsProps) {
  let videoRef!: HTMLVideoElement
  let player: dashjs.MediaPlayerClass | undefined
  const [playerStatus, setPlayerStatus] = createSignal<string | null>(null)

  let loadStartTime: number | null = null
  let lastStateChangeTime: number | null = null
  let lastState: string | null = null
  const [stateLog, setStateLog] = createSignal<string[]>([])

  const create = async () => {
    player = dashjs.MediaPlayer().create()
    player.initialize(videoRef, undefined, true)

    // biome-ignore format: because
    for (const event of ['PLAYBACK_ENDED','PLAYBACK_ERROR','PLAYBACK_PAUSED','PLAYBACK_PLAYING','PLAYBACK_STALLED','PLAYBACK_WAITING'] as (keyof dashjs.MediaPlayerEvents)[]) {
      player.on(dashjs.MediaPlayer.events[event], (event) => {
        let state = event.type?.toLowerCase().replace('playback', '')
        if (state === 'waiting') state = 'buffering'
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
      player.attachSource(null as any)
      return
    }

    try {
      loadStartTime = performance.now()

      player.attachSource(url)

      if (licenseUrl) {
        const protData = {
          'com.widevine.alpha': {
            serverURL: licenseUrl,
          },
        }
        player.setProtectionData(protData)
      }

      player.updateSettings(options)
    } catch (error: any) {
      console.error('Dashjs: Error code', error.code, 'object', error)
      setPlayerStatus(`error: ${error.code || 'unknown'}`)
    }
  }

  const destroy = async () => {
    try {
      player?.destroy()
    } catch (error) {
      console.error('Dashjs: Error destroying Dashjs player:', error)
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
