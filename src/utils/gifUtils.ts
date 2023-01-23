import Jimp from 'jimp'
import GIFEncoder from 'libraries/gifencoder/gifencoder'
import { SpecialCommand } from 'interfaces/gifData'
import { Gif, GifUtil, GifFrame, GifCodec } from 'gifwrap'

export async function getGifFromBuffer (data: Buffer): Promise<Gif> {
  const buffer = data
  const gif = await new GifCodec().decodeGif(buffer)

  if (gif.frames.length > 200) {
    throw Error('Image too large, advanced modifiers not supported!')
  }

  return gif
}

export function alignGif (frames: GifFrame[], interval: number): GifFrame[] {
  // Duplicate frames until interval is reached
  let alignedFrames = GifUtil.cloneFrames(frames)
  while (alignedFrames.length < interval) {
    alignedFrames = alignedFrames.concat(GifUtil.cloneFrames(frames))
  }

  let framesToDelete = alignedFrames.length % interval
  /*
      Removing more than 20% of frames makes it look sucky => add copies until it's below 20%
      Worst case: interval = (frames.length / 2) + 1 e.g. interval 17 with 32 frames
      then framesToDelete = 15/32 (46.9%) -> 13/64 (20.3%) -> 11/96 (11.4%)
    */
  while (framesToDelete / alignedFrames.length > 0.2) {
    alignedFrames = alignedFrames.concat(GifUtil.cloneFrames(frames))
    framesToDelete = alignedFrames.length % interval
  }

  const amountCopies = alignedFrames.length / frames.length
  let currentCopy = 0

  for (let i = 0; i < framesToDelete; i++) {
    const frameToDelete = Math.floor(Math.random() * frames.length - 1) + 1
    alignedFrames.splice(frameToDelete + currentCopy * frames.length, 1)
    // Keep shifting copy so each copy loses about the same amount of frames
    currentCopy = (currentCopy + 1) % amountCopies
  }

  return alignedFrames
}

export function setEncoderProperties (encoder: GIFEncoder, delay?: number): void {
  encoder.start()
  encoder.setRepeat(0)
  encoder.setQuality(5)

  if (delay !== undefined) {
    encoder.setDelay(delay)
  }

  encoder.setTransparent(0x00000000)
}

function getSizeFromOptions (options: SpecialCommand) {
  let widthModifier = 1
  let heightModifier = 1

  if (!options.isResized) {
    const { size } = options

    if (size.includes('x')) {
      const split = size.split('x')
      widthModifier = parseFloat(split[0] ?? '1')
      heightModifier = parseFloat(split[1] ?? '1')
    } else {
      widthModifier = parseFloat(size)
      heightModifier = parseFloat(size)
    }
  }

  return {
    widthModifier,
    heightModifier
  }
}

export function preparePNGVariables (
  options: SpecialCommand,
  image: Jimp['bitmap']
): { width: number, height: number, encoder: GIFEncoder } {
  const {
    widthModifier,
    heightModifier
  } = getSizeFromOptions(options)
  // Flooring to elude rounding errors
  const width = Math.floor(widthModifier * image.width)
  const height = Math.floor(heightModifier * image.height)

  return {
    width,
    height,
    encoder: new GIFEncoder(width, height)
  }
}
