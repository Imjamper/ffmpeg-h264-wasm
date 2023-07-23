//
//  Copyright (c) 2013 Sam Leitch. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to
//  deal in the Software without restriction, including without limitation the
//  rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
//  sell copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
//  IN THE SOFTWARE.
//

import { libavh264 } from './H264Worker'
import { FfmpegH264Frame } from './index'
import { YUVFormat } from '../types/yuv-buffer'
import YUVBuffer from './yuv-buffer/yuv-buffer'

export class H264Decoder {
  private readonly codecContext: number
  private readonly dataIn: number

  private readonly yPlaneOut: number
  private readonly uPlaneOut: number
  private readonly vPlaneOut: number
  private readonly isKeyFrameOut: number
  private readonly strideOut: number

  private readonly width: number
  private readonly height: number

  private readonly format: YUVFormat

  constructor(
    private readonly libavH264Module: libavh264,
    private readonly onPictureReady: (output: FfmpegH264Frame) => void,
    width: number,
    height: number,
  ) {
    this.codecContext = this.libavH264Module._create_codec_context()
    this.dataIn = this.libavH264Module._malloc(1024 * 1024)

    this.yPlaneOut = this.libavH264Module._malloc(4)
    this.uPlaneOut = this.libavH264Module._malloc(4)
    this.vPlaneOut = this.libavH264Module._malloc(4)

    this.width = width
    this.height = height
    this.isKeyFrameOut = this.libavH264Module._malloc(4)
    this.strideOut = this.libavH264Module._malloc(4)

    this.format = YUVBuffer.format({
      width: width,
      height: height,

      chromaWidth: width / 2,
      chromaHeight: height / 2,

      cropLeft: 0,
      cropTop: 4,
      cropWidth: width,
      cropHeight: height,

      displayWidth: width,
      displayHeight: height,
    })
  }

  release() {
    this.libavH264Module._destroy_codec_context(this.codecContext)
    this.libavH264Module._free(this.dataIn)
    this.libavH264Module._free(this.yPlaneOut)
    this.libavH264Module._free(this.uPlaneOut)
    this.libavH264Module._free(this.vPlaneOut)

    this.libavH264Module._free(this.isKeyFrameOut)
    this.libavH264Module._free(this.strideOut)
  }

  decode(nal: Uint8Array) {
    this.libavH264Module.HEAPU8.set(nal, this.dataIn)
    const ptr = this.libavH264Module._decode(
      this.codecContext,
      this.dataIn,
      nal.byteLength,

      this.yPlaneOut,
      this.uPlaneOut,
      this.vPlaneOut,

      this.strideOut,
      this.isKeyFrameOut,
    )

    const yPlanePtr = this.libavH264Module.getValue(this.yPlaneOut, 'i8*')
    const uPlanePtr = this.libavH264Module.getValue(this.uPlaneOut, 'i8*')
    const vPlanePtr = this.libavH264Module.getValue(this.vPlaneOut, 'i8*')

    const stride = this.libavH264Module.getValue(this.strideOut, 'i32')
    const isKeyFrame = this.libavH264Module.getValue(this.isKeyFrameOut, 'i32')

    // We assume I420 output else this will fail miserably
    // TODO we should probably handle other formats as well
    const lumaSize = this.height * stride
    const chromaSize = (this.height * stride) / 2

    if (yPlanePtr === 0) {
      return
    }

    const frame = YUVBuffer.frame(
      this.format,
      YUVBuffer.lumaPlane(this.format, this.libavH264Module.HEAPU8, yPlanePtr, yPlanePtr + lumaSize),
      YUVBuffer.chromaPlane(this.format, this.libavH264Module.HEAPU8, uPlanePtr, uPlanePtr + chromaSize),
      YUVBuffer.chromaPlane(this.format, this.libavH264Module.HEAPU8, vPlanePtr, vPlanePtr + chromaSize),
    )

    this.onPictureReady({ ptr: ptr, isKeyFrame: isKeyFrame === 1, frame })
  }

  closeFrame(framePtr: number) {
    this.libavH264Module._close_frame(framePtr)
  }
}
