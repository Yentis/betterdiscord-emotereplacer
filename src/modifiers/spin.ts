import GIFEncoder from 'libraries/gifencoder/gifencoder'
import { SpecialCommand } from 'interfaces/gifData'
import {
  getGifFromBuffer, setEncoderProperties, alignGif, preparePNGVariables
} from 'utils/gifUtils'
import JimpType from 'jimp'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import JimpImport from 'libraries/jimp'
const Jimp = JimpImport as typeof JimpType

function prepareSpinVariables (
  delay: number,
  centisecsPerRotation: number,
  reverse: boolean,
  width: number,
  height: number
) {
  let degrees = (360 * delay) / centisecsPerRotation
  const interval = Math.floor(360 / degrees)
  degrees *= reverse ? 1 : -1
  let margin = (width - height) / 2
  if (height > width) margin *= -1

  return {
    degrees,
    interval,
    max: Math.max(width, height),
    margin
  }
}

export async function createSpinningGIF (options: SpecialCommand): Promise<Buffer> {
  const inputGif = await getGifFromBuffer(options.buffer)
  const max = Math.max(inputGif.width, inputGif.height)
  const encoder = new GIFEncoder(max, max)

  setEncoderProperties(encoder)

  const {
    degrees,
    interval,
    margin
  } = prepareSpinVariables(
    inputGif.frames[0]?.delayCentisecs ?? 0, // assuming all frames have the same delay
    (200 * options.value) / 8, // 100cs per rotation -> 1 rotation per second
    options.name === 'spinrev',
    inputGif.width,
    inputGif.height
  )

  const frames = alignGif(inputGif.frames, interval)
  for (let i = 0; i < frames.length; i++) {
    encoder.setDelay((frames[i]?.delayCentisecs ?? 0) * 10)
    const adjustedImg = new Jimp(max, max)

    if (inputGif.width > inputGif.height) {
      adjustedImg.blit(new Jimp(frames[i]?.bitmap), 0, margin)
    } else {
      adjustedImg.blit(new Jimp(frames[i]?.bitmap), margin, 0)
    }

    adjustedImg.rotate((i * degrees) % 360, false)
    encoder.addFrame(adjustedImg.bitmap.data)
  }

  encoder.finish()
  return encoder.getAndResetBuffer()
}

export async function createSpinningPNG (options: SpecialCommand): Promise<Buffer> {
  let image = await Jimp.read(options.buffer)

  const {
    width,
    height
  } = preparePNGVariables(options, image.bitmap)

  const {
    degrees,
    interval,
    max,
    margin
  } = prepareSpinVariables(
    options.value, // delay
    (200 * options.value) / 8, // 100cs per rotation -> 1 rotation per second
    options.name === 'spinrev',
    width,
    height
  )

  const encoder = new GIFEncoder(max, max)
  image.resize(width, height)

  const resizedImage = new Jimp(max, max)
  image = width > height
    ? resizedImage.blit(image, 0, margin)
    : resizedImage.blit(image, margin, 0)

  setEncoderProperties(encoder, options.value * 10)

  for (let i = 0; i < interval; i++) {
    const rotatedImage = new Jimp(resizedImage.bitmap)
    rotatedImage.rotate(i * degrees, false)
    encoder.addFrame(rotatedImage.bitmap.data)
  }

  encoder.finish()
  return encoder.getAndResetBuffer()
}
