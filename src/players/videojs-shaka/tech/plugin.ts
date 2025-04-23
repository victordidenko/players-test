import videojs from 'video.js'
import { Shaka } from './shaka.ts'

export const Tech = videojs.getTech('Tech') as any
Tech.registerTech('Shaka', Shaka)
