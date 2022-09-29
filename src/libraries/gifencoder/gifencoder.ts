import NeuQuant from './neuquant'
import LZWEncoder from './lzwencoder'
import ByteArray from './bytearray'
import { Buffer } from 'pluginConstants'

export default class GIFEncoder {
  // image size
  width: number

  height: number

  // transparent color if given
  transparent?: number

  // transparent index in color table
  transIndex = 0

  // -1 = no repeat, 0 = forever. anything else is repeat count
  repeat = -1

  // frame delay (hundredths)
  delay = 0

  image?: Uint8ClampedArray | Buffer // current frame

  pixels?: Uint8Array // BGR byte array from frame

  indexedPixels?: Uint8Array // converted frame indexed to palette

  colorDepth?: number // number of bit planes

  colorTab?: number[] // RGB palette

  usedEntry: boolean[] = [] // active palette entries

  palSize = 7 // color table size (bits-1)

  dispose = -1 // disposal code (-1 = use default)

  firstFrame = true

  sample = 10 // default sample interval for quantizer

  started = false // started encoding

  private buffers: Uint8Array[] = []

  out = new ByteArray()

  constructor (width: number, height: number) {
    this.width = ~~width
    this.height = ~~height
  }

  getAndResetBuffer (): Buffer {
    const buffer = Buffer.concat(this.buffers)
    this.buffers = []
    return buffer
  }

  emit (): void {
    if (this.buffers.length === 0 || !this.out.data.length) return

    this.buffers.push(Uint8Array.from(this.out.data))
    this.out.data = []
  }

  /*
    Writes GIF file header
  */
  start (): void {
    this.out.writeUTFBytes('GIF89a')
    this.started = true
    this.emit()
  }

  /*
    Extracts image pixels into byte array pixels
    (removes alphachannel from canvas imagedata)
  */
  getImagePixels (): void {
    const data = this.image
    if (data === undefined) return

    const w = this.width
    const h = this.height
    this.pixels = new Uint8Array(w * h * 3)
    let count = 0

    for (let i = 0; i < h; i++) {
      for (let j = 0; j < w; j++) {
        const b = (i * w * 4) + j * 4

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.pixels[count++] = data[b]
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.pixels[count++] = data[b + 1]
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.pixels[count++] = data[b + 2]
      }
    }
  }

  /*
    Returns index of palette color closest to c
  */
  findClosest (c: number): number {
    if (this.colorTab === undefined) return -1

    const r = (c & 0xFF0000) >> 16
    const g = (c & 0x00FF00) >> 8
    const b = (c & 0x0000FF)
    let minpos = 0
    let dmin = 256 * 256 * 256
    const len = this.colorTab.length

    for (let i = 0; i < len;) {
      const index = i / 3

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const dr = r - (this.colorTab[i++] & 0xff)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const dg = g - (this.colorTab[i++] & 0xff)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const db = b - (this.colorTab[i++] & 0xff)
      const d = dr * dr + dg * dg + db * db

      if ((this.usedEntry[index] ?? false) && (d < dmin)) {
        dmin = d
        minpos = index
      }
    }

    return minpos
  }

  /*
    Analyzes current frame colors and creates color map.
  */
  analyzePixels (): void {
    if (this.pixels === undefined || this.image === undefined) return
    const len = this.pixels.length
    const nPix = len / 3

    this.indexedPixels = new Uint8Array(nPix)

    const imgq = new NeuQuant(this.pixels, this.sample)
    imgq.buildColormap() // create reduced palette
    this.colorTab = imgq.getColormap()

    // map image pixels to new palette
    let k = 0
    for (let j = 0; j < nPix; j++) {
      const index = imgq.lookupRGB(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.pixels[k++] & 0xff,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.pixels[k++] & 0xff,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.pixels[k++] & 0xff
      )
      this.usedEntry[index] = true
      this.indexedPixels[j] = index
    }

    this.pixels = undefined
    this.colorDepth = 8
    this.palSize = 7

    if (this.transparent === undefined) return

    // get closest match to transparent color if specified
    this.transIndex = this.findClosest(this.transparent)

    // ensure that pixels with full transparency in the RGBA image
    // are using the selected transparent color index in the indexed image.
    for (let pixelIndex = 0; pixelIndex < nPix; pixelIndex++) {
      if (this.image[pixelIndex * 4 + 3] === 0) {
        this.indexedPixels[pixelIndex] = this.transIndex
      }
    }
  }

  writeShort (pValue: number): void {
    this.out.writeByte(pValue & 0xFF)
    this.out.writeByte((pValue >> 8) & 0xFF)
  }

  /*
    Writes Logical Screen Descriptor
  */
  writeLSD (): void {
    // logical screen size
    this.writeShort(this.width)
    this.writeShort(this.height)

    // packed fields
    this.out.writeByte(
      0x80 | // 1 : global color table flag = 1 (gct used)
      0x70 | // 2-4 : color resolution = 7
      0x00 | // 5 : gct sort flag = 0
      this.palSize // 6-8 : gct size
    )

    this.out.writeByte(0) // background color index
    this.out.writeByte(0) // pixel aspect ratio - assume 1:1
  }

  /*
    Writes color table
  */
  writePalette (): void {
    if (this.colorTab === undefined) return
    this.out.writeBytes(this.colorTab)
    const n = (3 * 256) - this.colorTab.length
    for (let i = 0; i < n; i++) this.out.writeByte(0)
  }

  /*
    Writes Netscape application extension to define repeat count.
  */
  writeNetscapeExt (): void {
    this.out.writeByte(0x21) // extension introducer
    this.out.writeByte(0xff) // app extension label
    this.out.writeByte(11) // block size
    this.out.writeUTFBytes('NETSCAPE2.0') // app id + auth code
    this.out.writeByte(3) // sub-block size
    this.out.writeByte(1) // loop sub-block id
    this.writeShort(this.repeat) // loop count (extra iterations, 0=repeat forever)
    this.out.writeByte(0) // block terminator
  }

  /*
    Writes Graphic Control Extension
  */
  writeGraphicCtrlExt (): void {
    this.out.writeByte(0x21) // extension introducer
    this.out.writeByte(0xf9) // GCE label
    this.out.writeByte(4) // data block size

    let transp
    let disp
    if (this.transparent === undefined) {
      transp = 0
      disp = 0 // dispose = no action
    } else {
      transp = 1
      disp = 2 // force clear if using transparent color
    }

    if (this.dispose >= 0) {
      disp = this.dispose & 7 // user override
    }
    disp <<= 2

    // packed fields
    this.out.writeByte(
      0 | // 1:3 reserved
      disp | // 4:6 disposal
      0 | // 7 user input - 0 = none
      transp // 8 transparency flag
    )

    this.writeShort(this.delay) // delay x 1/100 sec
    this.out.writeByte(this.transIndex) // transparent color index
    this.out.writeByte(0) // block terminator
  }

  /*
    Writes Image Descriptor
  */
  writeImageDesc (): void {
    this.out.writeByte(0x2c) // image separator
    this.writeShort(0) // image position x,y = 0,0
    this.writeShort(0)
    this.writeShort(this.width) // image size
    this.writeShort(this.height)

    // packed fields
    if (this.firstFrame) {
      // no LCT - GCT is used for first (or only) frame
      this.out.writeByte(0)
    } else {
      // specify normal LCT
      this.out.writeByte(
        0x80 | // 1 local color table 1=yes
        0 | // 2 interlace - 0=no
        0 | // 3 sorted - 0=no
        0 | // 4-5 reserved
        this.palSize // 6-8 size of color table
      )
    }
  }

  /*
    Encodes and writes pixel data
  */
  writePixels (): void {
    if (this.indexedPixels === undefined || this.colorDepth === undefined) return

    const enc = new LZWEncoder(this.width, this.height, this.indexedPixels, this.colorDepth)
    enc.encode(this.out)
  }

  /*
    Adds next GIF frame. The frame is not written immediately, but is
    actually deferred until the next frame is received so that timing
    data can be inserted.  Invoking finish() flushes all frames.
  */
  addFrame (imageData: Buffer): void {
    this.image = imageData

    this.getImagePixels() // convert to correct format if necessary
    this.analyzePixels() // build color table & map pixels

    if (this.firstFrame) {
      this.writeLSD() // logical screen descriptior
      this.writePalette() // global color table
      if (this.repeat >= 0) {
        // use NS app extension to indicate reps
        this.writeNetscapeExt()
      }
    }

    this.writeGraphicCtrlExt() // write graphic control extension
    this.writeImageDesc() // image descriptor
    if (!this.firstFrame) this.writePalette() // local color table
    this.writePixels() // encode and write pixel data

    this.firstFrame = false
    this.emit()
  }

  /*
    Sets the delay time between each frame, or changes it for subsequent frames
    (applies to the next frame added)
  */
  setDelay (milliseconds?: number): void {
    if (milliseconds === undefined) return
    this.delay = Math.round(milliseconds / 10)
  }

  /*
    Sets frame rate in frames per second.
  */
  setFrameRate (fps?: number): void {
    if (fps === undefined) return
    this.delay = Math.round(100 / fps)
  }

  /*
    Sets the GIF frame disposal code for the last added frame and any
    subsequent frames.

    Default is 0 if no transparent color has been set, otherwise 2.
  */
  setDispose (disposalCode?: number): void {
    if (disposalCode === undefined) {
      this.dispose = this.transparent === undefined ? 0 : 2
      return
    }
    if (disposalCode >= 0) this.dispose = disposalCode
  }

  /*
    Sets the number of times the set of GIF frames should be played.

    -1 = play once
    0 = repeat indefinitely

    Default is -1

    Must be invoked before the first image is added
  */
  setRepeat (repeat = -1): void {
    this.repeat = repeat
  }

  /*
    Sets the transparent color for the last added frame and any subsequent
    frames. Since all colors are subject to modification in the quantization
    process, the color in the final palette for each frame closest to the given
    color becomes the transparent color for that frame. May be set to undefined to
    indicate no transparent color.
  */
  setTransparent (color?: number): void {
    this.transparent = color
  }

  end (): void {
    if (this.buffers.length === null) return
    this.emit()
  }

  /*
    Adds final trailer to the GIF buffer, if you don't call the finish method
    the GIF buffer will not be valid.
  */
  finish (): void {
    this.out.writeByte(0x3b) // gif trailer
    this.end()
  }

  /*
    Sets quality of color quantization (conversion of images to the maximum 256
    colors allowed by the GIF specification). Lower values (minimum = 1)
    produce better colors, but slow processing significantly. 10 is the
    default, and produces good color mapping at reasonable speeds. Values
    greater than 20 do not yield significant improvements in speed.
  */
  setQuality (_quality = 10): void {
    let quality = _quality
    if (quality < 1) quality = 1
    this.sample = quality
  }
}

module.exports = GIFEncoder
