// import shaka from 'shaka-player/dist/shaka-player.compiled.debug.js'
import shaka from 'shaka-player'
import videojs from 'video.js'
import { type Defer, defer } from './defer'
// import { setupAudioTracks } from './setup-audio-tracks.ts'
// import { setupQualityTracks } from './setup-quality-tracks.ts'
// import { setupTextTracks } from './setup-text-tracks.ts'

shaka.polyfill.installAll()

const Html5 = videojs.getTech('Html5') as any

/**
 * Default options for the tech
 */
const defaults = {
  // abr: {
  //   enabled: true,
  // },
}

export class Shaka extends Html5 {
  private declare shaka_: shaka.Player
  private declare player_: ReturnType<typeof videojs> | undefined
  private declare attached_: Defer<void> | undefined

  constructor(options: any, ready: () => void) {
    super(options, ready)
    this.player_ = videojs(options.playerId)
    this.shaka_ = this.initShaka()
    this.addClass('vjs-shaka')
  }

  initShaka() {
    if (shaka.log) {
      if (this.options_.debug) {
        shaka.log.setLevel(shaka.log.Level.DEBUG)
      } else {
        shaka.log.setLevel(shaka.log.Level.ERROR)
      }
    }

    const player = new shaka.Player()
    player.configure({
      ...defaults,
      ...this.options_.configuration,
    })

    if (this.attached_ == null) {
      this.attached_ = defer()
    }

    player
      .attach(this.el_)
      .then(this.attached_.resolve)
      .catch((error: any) => this.proxyError(error))

    player.addEventListener('buffering', (event: any) => {
      if (event.buffering) {
        this.player_?.trigger('waiting')
      } else {
        this.player_?.trigger('playing')
      }
    })

    player.addEventListener('error', (event: any) => {
      this.proxyError(event.detail)
    })

    return player
  }

  setSource(source: any) {
    let src: string | undefined
    let mimeType: string | undefined
    let drm: any

    if (source == null) {
      this.shaka_.unload()
      return
    }

    if (typeof source === 'string') {
      src = source
    } else if (typeof source === 'object') {
      src = source.src
      mimeType = source.type

      if (source.keySystems != null && typeof source.keySystems === 'object') {
        drm = {
          servers: source.keySystems,
        }
      }
    }

    if (src == null) {
      this.shaka_.unload()
      return
    }

    if (this.attached_ == null) {
      this.attached_ = defer()
    }

    this.attached_.promise
      .then(() => drm != null && this.shaka_.configure({ drm }))
      .then(() => this.shaka_.load(src, undefined, mimeType))
      // .then(() => this.initShakaMenus())
      .catch((error: any) => this.proxyError(error))
  }

  // initShakaMenus() {
  //   setupQualityTracks(this, this.shaka_)
  //   setupTextTracks(this, this.shaka_)
  //   setupAudioTracks(this, this.shaka_)
  // }

  /**
   * Map the shaka player error to the appropriate video.js error
   *
   * Shaka error categories:
   *   1 -> NETWORK - Errors from the network stack
   *   2 -> TEXT - Errors parsing text streams
   *   3 -> MEDIA - Errors parsing or processing audio or video streams
   *   4 -> MANIFEST - Errors parsing the Manifest
   *   5 -> STREAMING - Errors related to streaming
   *   6 -> DRM - Errors related to DRM
   *   7 -> PLAYER - Miscellaneous errors from the player
   *   8 -> CAST - Errors related to cast
   *   9 -> STORAGE - Errors in the database storage (offline)
   *   10 -> ADS - Errors related to ad insertion
   *
   * MediaError error codes:
   *   0 -> MEDIA_ERR_CUSTOM - A custom error, not defined by the W3C
   *   1 -> MEDIA_ERR_ABORTED - The fetching of the associated resource was aborted by the user's request
   *   2 -> MEDIA_ERR_NETWORK - Some kind of network error occurred which prevented the media from being successfully fetched, despite having previously been available
   *   3 -> MEDIA_ERR_DECODE - Despite having previously been determined to be usable, an error occurred while trying to decode the media resource, resulting in an error
   *   4 -> MEDIA_ERR_SRC_NOT_SUPPORTED - The associated resource or media provider object (such as a MediaStream) has been found to be unsuitable
   *   5 -> MEDIA_ERR_ENCRYPTED - The media resource is encrypted and the key is not available
   */
  mapErrorCode(event: any) {
    const { message, category } = event
    if (
      typeof message === 'string' &&
      (message.includes('UNSUPPORTED') || message.includes('NOT_SUPPORTED'))
    ) {
      return 4 // MEDIA_ERR_SRC_NOT_SUPPORTED
    }

    if (typeof category === 'number') {
      switch (category) {
        case shaka.util.Error.Category.NETWORK:
          return 2 // MEDIA_ERR_NETWORK

        case shaka.util.Error.Category.TEXT:
        case shaka.util.Error.Category.MEDIA:
        case shaka.util.Error.Category.MANIFEST:
          return 3 // MEDIA_ERR_DECODE

        case shaka.util.Error.Category.STREAMING:
          return 1 // MEDIA_ERR_ABORTED

        case shaka.util.Error.Category.DRM:
          return 5 // MEDIA_ERR_ENCRYPTED

        case shaka.util.Error.Category.PLAYER:
        case shaka.util.Error.Category.CAST:
        case shaka.util.Error.Category.STORAGE:
        case shaka.util.Error.Category.ADS:
          return 0 // MEDIA_ERR_CUSTOM
      }
    }

    return 0 // MEDIA_ERR_CUSTOM
  }

  proxyError(event: any) {
    this.player_?.error({
      code: this.mapErrorCode(event),
      message: `${event.code} - ${event.message}`,
    } as any)
    // setTimeout(() => this.dispose(), 10)
  }

  dispose() {
    super.dispose()
    this.attached_?.reject()
    this.attached_ = undefined
    this.shaka_.unload()
    this.shaka_.destroy()
  }
}

/**
 * Shaka/Tech version number
 */
Shaka.VERSION = shaka.Player.version

/**
 * Check if shaka supports this browser/device
 */
Shaka.isSupported = function () {
  return shaka.Player.isBrowserSupported()
}

/**
 * Check if the tech can support the given type
 */
Shaka.canPlayType = function (type: string, options: any) {
  type = type.toLowerCase()

  const dashTypes = ['application/dash+xml']
  const hlsTypes = [
    'application/vnd.apple.mpegurl', // apple santioned
    'audio/mpegurl', // apple sanctioned for backwards compatibility
    'audio/x-mpegurl', // very common
    'application/x-mpegurl', // very common
    'video/x-mpegurl',
    'video/mpegurl',
    'application/mpegurl',
  ]

  if (options?.dash !== false && dashTypes.includes(type)) return 'probably'
  if (options?.hls !== false && hlsTypes.includes(type)) return 'probably'
  return ''
}

/**
 * Check if the tech can support the given source
 */
Shaka.canPlaySource = function (src: any, options: any) {
  return Shaka.canPlayType(src.type, options)
}
