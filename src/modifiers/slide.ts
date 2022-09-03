import Jimp from 'jimp'
import GIFEncoder from 'libraries/gifencoder/gifencoder'
import { SpecialCommand } from 'interfaces/gifData'
import {
  getGifFromBuffer, getBuffer, setEncoderProperties, alignGif, preparePNGVariables
} from 'utils/gifUtils'

function prepareSlidingVariables (width: number, speed: number) {
  const interval = speed * 2

  return {
    interval,
    shift: 0,
    shiftSize: width / interval
  }
}

function getShiftedFrameData (oldFrame: Jimp, shift: number): Jimp['bitmap'] {
  const { width } = oldFrame.bitmap
  const { height } = oldFrame.bitmap
  const newFrame = new Jimp(width, height, 0x00)

  newFrame.blit(oldFrame, shift, 0, 0, 0, width - shift, height)
  newFrame.blit(oldFrame, 0, 0, width - shift, 0, shift, height)

  return newFrame.bitmap
}

export async function createSlidingGIF (options: SpecialCommand): Promise<Buffer> {
  const inputGif = await getGifFromBuffer(options.buffer)
  const encoder = new GIFEncoder(inputGif.width, inputGif.height)

  return new Promise((resolve, reject) => {
    getBuffer(encoder.createReadStream()).then(resolve).catch(reject)
    setEncoderProperties(encoder)

    const { width } = inputGif
    const slidingVariables = prepareSlidingVariables(width, options.value)
    const { interval, shiftSize } = slidingVariables
    let { shift } = slidingVariables
    const frames = alignGif(inputGif.frames, interval)

    const direction = options.name === 'sliderev' ? 1 : -1
    frames.forEach((frame) => {
      encoder.setDelay(frame.delayCentisecs * 10)
      const shiftedBitmap = getShiftedFrameData(new Jimp(frame.bitmap), shift)
      encoder.addFrame(shiftedBitmap.data)
      shift = (shift + direction * shiftSize) % width
    })

    encoder.finish()
  })
}

export async function createSlidingPNG (options: SpecialCommand): Promise<Buffer> {
  if (options.buffer instanceof Buffer) throw Error('Was given a buffer instead of a path')
  const image = await Jimp.read(options.buffer)

  const {
    width,
    height,
    encoder
  } = preparePNGVariables(options, image.bitmap)
  image.resize(width, height)

  const slidingVariables = prepareSlidingVariables(width, options.value)
  const { interval, shiftSize } = slidingVariables
  let { shift } = slidingVariables

  return new Promise((resolve, reject) => {
    getBuffer(encoder.createReadStream()).then(resolve).catch(reject)
    setEncoderProperties(encoder, 40)

    const direction = options.name === 'sliderev' ? 1 : -1
    for (let i = 0; i < interval; i++) {
      const frameData = getShiftedFrameData(image, shift)
      encoder.addFrame(frameData.data)
      shift = (shift + direction * shiftSize) % width
    }

    encoder.finish()
  })
}
