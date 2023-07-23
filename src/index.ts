import { YUVFrame } from '../types/yuv-buffer'

export { init } from './H264Worker'
export type FfmpegH264Frame = {
  ptr: number
  frame: YUVFrame
  isKeyFrame: boolean
}
