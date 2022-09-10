import Jimp from 'jimp/browser/lib/jimp'
import GIFEncoder from 'libraries/gifencoder/gifencoder'
import { SpecialCommand } from 'interfaces/gifData'
import {
  getGifFromBuffer, getBuffer, setEncoderProperties, preparePNGVariables
} from 'utils/gifUtils'

function resetDrop (delay: number) {
  let speed = Math.random()
  // Map len between 1 and 5, depending on the speed
  const len = Math.floor(speed * 5 + 1)
  // Map thickness between 1 and 2, depending on the speed
  const size = Math.floor(speed * 2 + 1)
  // Adjust speed to frame delay i.e. the longer the delay, the faster the drop
  speed = Math.floor(speed * delay + delay)
  return {
    speed,
    len,
    size
  }
}

class Drop {
  width: number

  height: number

  delay: number

  x: number

  y: number

  speed: number

  len: number

  size: number

  r = 0

  g = 0

  b = 0

  constructor (width: number, height: number, delay: number) {
    this.width = width
    this.height = height
    this.delay = delay
    this.x = Math.random() * width
    this.y = Math.random() * height

    const {
      speed,
      len,
      size
    } = resetDrop(this.delay)
    this.speed = speed
    this.len = len
    this.size = size
  }

  fall () {
    this.y += this.speed
    if (this.y > this.height) {
      this.y = 0
      const {
        speed,
        len,
        size
      } = resetDrop(this.delay)
      this.speed = speed
      this.len = len
      this.size = size
    }
  }

  setColor (r: number, g: number, b: number) {
    this.r = r
    this.g = g
    this.b = b
  }
}

function rainImageGenerator (width: number, height: number, glitter: boolean, delay: number) {
  // Generate single drops
  const drops: Drop[] = []
  for (let i = 0, amount = (width + height) / 5; i < amount; i++) {
    drops.push(new Drop(width, height, delay))
  }

  // Set colors of drops
  if (glitter) {
    drops.forEach((drop) => {
      drop.setColor(Math.random() * 256, Math.random() * 256, Math.random() * 256)
    })
  } else {
    drops.forEach((drop) => drop.setColor(0, 120, 255))
  }

  const rainGenerator = {
    next () {
      const img = new Jimp(width, height, 0x00)

      // Draw raindrops
      drops.forEach((drop) => {
        for (let j = 0; j < drop.len; j++) {
          for (let k = 0; k < drop.size; k++) {
            const pos = (Math.floor(drop.y + j) * width + Math.floor(drop.x + k)) * 4
            img.bitmap.data[pos + 0] = drop.r
            img.bitmap.data[pos + 1] = drop.g
            img.bitmap.data[pos + 2] = drop.b
            img.bitmap.data[pos + 3] = 255
          }
        }

        // Simulate next step
        drop.fall()
      })

      return img
    }
  }
  return rainGenerator
}

export async function createRainingGIF (options: SpecialCommand): Promise<Buffer> {
  const inputGif = await getGifFromBuffer(options.buffer)
  const encoder = new GIFEncoder(inputGif.width, inputGif.height)

  return new Promise((resolve, reject) => {
    getBuffer(encoder.createReadStream()).then((buffer) => resolve(buffer)).catch(reject)
    setEncoderProperties(encoder)

    const { frames } = inputGif
    const glitter = options.value === 1
    const rainGenerator = rainImageGenerator(
      inputGif.width,
      inputGif.height,
      glitter,
      frames[0]?.delayCentisecs ?? 0
    )

    frames.forEach((frame) => {
      encoder.setDelay(frame.delayCentisecs * 10)
      const jimpFrame = new Jimp(frame.bitmap)
      jimpFrame.blit(rainGenerator.next(), 0, 0)
      encoder.addFrame(jimpFrame.bitmap.data)
    })

    encoder.finish()
  })
}

export async function createRainingPNG (options: SpecialCommand): Promise<Buffer> {
  if (options.buffer instanceof Buffer) throw Error('Was given a buffer instead of a path')
  const image = await Jimp.read(options.buffer)

  const {
    width,
    height,
    encoder
  } = preparePNGVariables(options, image.bitmap)
  image.resize(width, height)
  const delay = 8

  return new Promise((resolve, reject) => {
    getBuffer(encoder.createReadStream()).then(resolve).catch(reject)
    setEncoderProperties(encoder, delay * 10)

    const interval = 12
    const glitter = options.value === 1
    const rainGenerator = rainImageGenerator(width, height, glitter, delay)

    for (let i = 0; i < interval; i++) {
      const img = new Jimp(image.bitmap)
      img.blit(rainGenerator.next(), 0, 0)
      encoder.addFrame(img.bitmap.data)
    }

    encoder.finish()
  })
}
