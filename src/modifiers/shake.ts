import Jimp from 'jimp/browser/lib/jimp'
import GIFEncoder from 'libraries/gifencoder/gifencoder'
import {
  getGifFromBuffer, getBuffer, setEncoderProperties, preparePNGVariables
} from 'utils/gifUtils'
import { SpecialCommand } from 'interfaces/gifData'
import { GifFrame, GifUtil } from 'gifwrap'

function greatestCommonDenominator (a: number, b: number): number {
  return !b ? a : greatestCommonDenominator(b, a % b)
}

function lowestCommonDenominator (a: number, b: number): number {
  return (a * b) / greatestCommonDenominator(a, b)
}

function padGif (frames: GifFrame[], amountCopies: number): GifFrame[] {
  if (amountCopies < 2) return GifUtil.cloneFrames(frames)
  const copiedFrames: GifFrame[] = []

  frames.forEach((frame) => {
    for (let j = 0; j < amountCopies; j++) {
      copiedFrames.push(new GifFrame(frame.bitmap))
    }
  })

  return copiedFrames
}

export async function createShakingGIF (options: SpecialCommand): Promise<Buffer> {
  const inputGif = await getGifFromBuffer(options.buffer)
  // centi secs till next shake position
  // presumably either 8 (default), 6 (fast), 4 (faster), or 2 (hyper)
  let speed = Math.max(2, options.value)
  // centi secs till next gif frame, assuming all frames have the same delay
  let delay = inputGif.frames[0]?.delayCentisecs ?? 0

  let { frames } = inputGif
  // If delay > speed, interval says how many shake positions each frame will have, otherwise = 1
  let interval = 1
  // If speed > delay, 1 / incrValue says how many frames will stay at the same shake position
  // otherwise = 1
  let incrValue = 1

  if (delay !== speed) {
    const padAmount = lowestCommonDenominator(delay, speed) / speed
    // If the padded gif would have too many frames already (800 is arbitrary)
    if (frames.length * padAmount > 800) {
      // Delete every second frame
      frames = frames.filter((_, i) => i % 2 === 0)
      delay *= 2
      speed *= 2
    }
    frames = padGif(frames, padAmount)
    if (delay > speed) {
      delay /= padAmount
      interval = speed / greatestCommonDenominator(delay, speed)
      // Keeping delay above 1 for encoder
      if (delay === 1) interval /= 2
    } else if (delay < speed) {
      delay /= padAmount
      incrValue = greatestCommonDenominator(delay, speed) / speed
      // Keeping delay above 1 for encoder
      if (delay === 1) incrValue /= 2
    }
    // Keeping delay above 1 for encoder
    if (delay === 1) {
      // Make it even amount of frames by deleting one  if necessary
      if (frames.length % 2 !== 0) {
        const frameToDelete = Math.floor(Math.random() * frames.length - 1) + 1
        frames.splice(frameToDelete, 1)
      }
      // Delete every second frame
      frames = frames.filter((_, i) => i % 2 === 0)
      delay = 2
    }
    // Not sure why this here is needed and also no clue
    // whether this breaks the result for some gifs
    incrValue *= 4
  }

  let dx = 0
  let dy = 0
  let sx = 1
  let sy = 1
  // Move dx dy sx dy: 0011 (3) -> 0110 (6) -> 1100 (12) -> 1001 (9) -> 0011 (3)
  let offsets = 3
  let state = 0 // Keeps track of how far it is into the interval

  const encoder = new GIFEncoder(inputGif.width, inputGif.height)

  return new Promise((resolve, reject) => {
    getBuffer(encoder.createReadStream()).then((buffer) => resolve(buffer)).catch(reject)
    setEncoderProperties(encoder, delay * 10)

    for (let i = 0; i < frames.length; i++) {
      state += incrValue
      if (state >= interval) {
        state -= interval
        // Shift dx, dy, sx, sy
        offsets <<= 1
        if (offsets > 16) offsets -= 15 // remove first one (-16) and add it on the right (+1)
        dx = offsets >> 3
        dy = (offsets >> 2) & 1
        sx = (offsets >> 1) & 1
        sy = offsets & 1
      }
      // Shake frame
      const shakenFrame = new Jimp(inputGif.width, inputGif.height, 0x00)
      shakenFrame.blit(
        new Jimp(frames[i]?.bitmap),
        dx, dy, sx, sy,
        inputGif.width - 1, inputGif.height - 1
      )
      encoder.addFrame(shakenFrame.bitmap.data)
    }

    encoder.finish()
  })
}

export async function createShakingPNG (options: SpecialCommand): Promise<Buffer> {
  if (options.buffer instanceof Buffer) throw Error('Was given a buffer instead of a path')
  const image = await Jimp.read(options.buffer)

  const {
    width,
    height,
    encoder
  } = preparePNGVariables(options, image.bitmap)
  image.resize(width, height)

  return new Promise((resolve, reject) => {
    getBuffer(encoder.createReadStream()).then((buffer) => resolve(buffer)).catch(reject)
    setEncoderProperties(encoder, options.value * 10)

    for (let i = 0; i < 4; i++) {
      const frame = new Jimp(width, height, 0x00)
      switch (i) {
        case 0:
          frame.blit(new Jimp(image.bitmap), 0, 0, 1, 1, width - 1, height - 1)
          break
        case 1:
          frame.blit(new Jimp(image.bitmap), 0, 1, 1, 0, width - 1, height - 1)
          break
        case 2:
          frame.blit(new Jimp(image.bitmap), 1, 1, 0, 0, width - 1, height - 1)
          break
        case 3:
          frame.blit(new Jimp(image.bitmap), 1, 0, 0, 1, width - 1, height - 1)
          break
        default:
          break
      }
      encoder.addFrame(frame.bitmap.data)
    }

    encoder.finish()
  })
}
