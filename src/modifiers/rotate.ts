import Jimp from 'jimp/browser/lib/jimp'
import GIFEncoder from 'libraries/gifencoder/gifencoder'
import { SpecialCommand } from 'interfaces/gifData'
import {
  getGifFromBuffer, getBuffer, setEncoderProperties, preparePNGVariables
} from 'utils/gifUtils'

function prepareRotateVariables (
  width: number,
  height: number
) {
  let margin = (width - height) / 2
  if (height > width) margin *= -1
  return {
    max: Math.max(width, height),
    margin
  }
}

export async function createRotatedGIF (options: SpecialCommand): Promise<Buffer> {
  const inputGif = await getGifFromBuffer(options.buffer)
  const max = Math.max(inputGif.width, inputGif.height)
  const encoder = new GIFEncoder(max, max)

  return new Promise((resolve, reject) => {
    getBuffer(encoder.createReadStream()).then((buffer) => resolve(buffer)).catch(reject)
    setEncoderProperties(encoder)

    // Flip the rotation because jimp rotates the wrong way
    const degrees = -(options.value)
    const {
      margin
    } = prepareRotateVariables(
      inputGif.width,
      inputGif.height
    )

    const { frames } = inputGif
    for (let i = 0; i < frames.length; i++) {
      encoder.setDelay((frames[i]?.delayCentisecs ?? 0) * 10)
      const adjustedImg = new Jimp(max, max)

      if (inputGif.width > inputGif.height) {
        adjustedImg.blit(new Jimp(frames[i]?.bitmap), 0, margin)
      } else {
        adjustedImg.blit(new Jimp(frames[i]?.bitmap), margin, 0)
      }

      adjustedImg.rotate(degrees, false)
      encoder.addFrame(adjustedImg.bitmap.data)
    }

    encoder.finish()
  })
}

export async function createRotatedPNG (options: SpecialCommand): Promise<Buffer> {
  if (options.buffer instanceof Buffer) throw Error('Was given a buffer instead of a path')
  let image = await Jimp.read(options.buffer)

  const {
    width,
    height
  } = preparePNGVariables(options, image.bitmap)

  const degrees = options.value
  const {
    max,
    margin
  } = prepareRotateVariables(
    width,
    height
  )

  const encoder = new GIFEncoder(max, max)
  image.resize(width, height)

  const resizedImage = new Jimp(max, max)
  image = width > height
    ? resizedImage.blit(image, 0, margin)
    : resizedImage.blit(image, margin, 0)

  return new Promise((resolve, reject) => {
    getBuffer(encoder.createReadStream()).then((buffer) => resolve(buffer)).catch(reject)
    setEncoderProperties(encoder, options.value * 10)

    const rotatedImage = new Jimp(resizedImage.bitmap)
    rotatedImage.rotate(degrees, false)
    encoder.addFrame(rotatedImage.bitmap.data)
    encoder.finish()
  })
}
