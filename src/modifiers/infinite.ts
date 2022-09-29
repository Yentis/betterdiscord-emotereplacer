import GIFEncoder from 'libraries/gifencoder/gifencoder'
import { SpecialCommand } from 'interfaces/gifData'
import {
  getGifFromBuffer, setEncoderProperties, alignGif, preparePNGVariables
} from 'utils/gifUtils'
import { JimpBitmap } from 'gifwrap'
import JimpType from 'jimp'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import JimpImport from 'libraries/jimp'
const Jimp = JimpImport as typeof JimpType

function resetInfiniteScales (
  scalesAmount: number,
  scaleDiff: number,
  scaleStep: number
): number[] {
  const scales = []
  for (let depth = 0; depth < scalesAmount; depth++) {
    scales.push((scalesAmount - depth - 1) * scaleDiff + scaleStep)
  }
  return scales
}

function getInfiniteShiftedFrameData (
  frameBitmap: JimpBitmap,
  scales: number[]
): JimpType['bitmap'] {
  const newFrame = new Jimp(frameBitmap.width, frameBitmap.height, 0x00)
  // Add appropriate frame with each depth scale

  scales.forEach((scale) => {
    const scaledFrame = new Jimp(frameBitmap)
    scaledFrame.scale(scale)
    const dx = (scaledFrame.bitmap.width - frameBitmap.width) / 2
    const dy = (scaledFrame.bitmap.height - frameBitmap.height) / 2

    // Blit frame properly with respect to the scale
    if (scale > 1) {
      newFrame.blit(scaledFrame, 0, 0, dx, dy, frameBitmap.width, frameBitmap.height)
    } else {
      newFrame.blit(scaledFrame, -dx, -dy)
    }
  })

  return newFrame.bitmap
}

function shiftInfiniteScales (_scales: number[], scaleDiff: number, scaleStep: number): number[] {
  let scales = _scales

  if ((scales[0] ?? 0) >= scales.length * scaleDiff) {
    scales = resetInfiniteScales(scales.length, scaleDiff, scaleStep)
  } else {
    for (let depth = 0; depth < scales.length; depth++) {
      scales[depth] += scaleStep
    }
  }

  return scales
}

export async function createInfiniteGIF (options: SpecialCommand): Promise<Buffer> {
  const inputGif = await getGifFromBuffer(options.buffer)
  const encoder = new GIFEncoder(inputGif.width, inputGif.height)

  setEncoderProperties(encoder)

  const scalesAmount = 5
  const scaleDiff = 0.9 // Difference between each scale
  const scaleStep = (0.03 * 8) / options.value // Scale shift between frames
  let scales = resetInfiniteScales(scalesAmount, scaleDiff, scaleStep)
  const frames = alignGif(inputGif.frames, scaleDiff / scaleStep)

  frames.forEach((frame) => {
    encoder.setDelay(frame.delayCentisecs * 10)
    const frameData = getInfiniteShiftedFrameData(frame.bitmap, scales)
    encoder.addFrame(frameData.data)
    // Shift scales for next frame
    scales = shiftInfiniteScales(scales, scaleDiff, scaleStep)
  })

  encoder.finish()
  return encoder.getAndResetBuffer()
}

export async function createInfinitePNG (options: SpecialCommand): Promise<Buffer> {
  if (options.buffer instanceof Buffer) throw Error('Was given a buffer instead of a path')
  const image = await Jimp.read(options.buffer)

  const {
    width,
    height,
    encoder
  } = preparePNGVariables(options, image.bitmap)
  image.resize(width, height)

  setEncoderProperties(encoder, options.value * 10)

  const scalesAmount = 5
  const scaleDiff = 0.9 // Difference between each scale
  const scaleStep = 0.06 // Scale shift between frames
  const frames = scaleDiff / scaleStep - 1
  let scales = resetInfiniteScales(scalesAmount, scaleDiff, scaleStep)

  for (let i = 0; i < frames; i++) {
    const frameData = getInfiniteShiftedFrameData(image.bitmap, scales)
    encoder.addFrame(frameData.data)
    // Shift scales for next frame
    scales = shiftInfiniteScales(scales, scaleDiff, scaleStep)
  }

  encoder.finish()
  return encoder.getAndResetBuffer()
}
