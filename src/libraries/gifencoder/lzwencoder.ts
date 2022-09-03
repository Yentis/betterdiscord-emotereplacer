// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/*
  LZWEncoder.js

  Authors
  Kevin Weiner (original Java version - kweiner@fmsware.com)
  Thibault Imbert (AS3 version - bytearray.org)
  Johan Nordberg (JS version - code@johan-nordberg.com)

  Acknowledgements
  GIFCOMPR.C - GIF Image compression routines
  Lempel-Ziv compression based on 'compress'. GIF modifications by
  David Rowley (mgardi@watdcsu.waterloo.edu)
  GIF Image compression - modified 'compress'
  Based on: compress.c - File compression ala IEEE Computer, June 1984.
  By Authors: Spencer W. Thomas (decvax!harpo!utah-cs!utah-gr!thomas)
  Jim McKie (decvax!mcvax!jim)
  Steve Davies (decvax!vax135!petsd!peora!srd)
  Ken Turkowski (decvax!decwrl!turtlevax!ken)
  James A. Woods (decvax!ihnp4!ames!jaw)
  Joe Orost (decvax!vax135!petsd!joe)
*/
import ByteArray from './bytearray'

const EOF = -1
const BITS = 12
const HSIZE = 5003 // 80% occupancy
const masks = [
  0x0000, 0x0001, 0x0003, 0x0007, 0x000F, 0x001F,
  0x003F, 0x007F, 0x00FF, 0x01FF, 0x03FF, 0x07FF,
  0x0FFF, 0x1FFF, 0x3FFF, 0x7FFF, 0xFFFF
]

export default class LZWEncoder {
  width: number

  height: number

  pixels: Uint8Array

  colorDepth: number

  initCodeSize: number

  accum = new Uint8Array(256)

  htab = new Int32Array(HSIZE)

  codetab = new Int32Array(HSIZE)

  curAccum = 0

  curBits = 0

  aCount = 0

  freeEnt = 0 // first unused entry

  maxcode = 0

  // block compression parameters -- after all codes are used up,
  // and compression rate changes, start over.
  clearFlg = false

  // Algorithm: use open addressing double hashing (no chaining) on the
  // prefix code / next character combination. We do a variant of Knuth's
  // algorithm D (vol. 3, sec. 6.4) along with G. Knott's relatively-prime
  // secondary probe. Here, the modular division first probe is gives way
  // to a faster exclusive-or manipulation. Also do block compression with
  // an adaptive reset, whereby the code table is cleared when the compression
  // ratio decreases, but after the table fills. The variable-length output
  // codes are re-sized at this point, and a special CLEAR code is generated
  // for the decompressor. Late addition: construct the table according to
  // file size for noticeable speed improvement on small files. Please direct
  // questions about this implementation to ames!jaw.
  gInitBits = 0

  nBits = 0

  ClearCode = 0

  EOFCode?: number

  remaining = 0

  curPixel = 0

  constructor (width: number, height: number, pixels: Uint8Array, colorDepth: number) {
    this.width = width
    this.height = height
    this.pixels = pixels
    this.colorDepth = colorDepth
    this.initCodeSize = Math.max(2, colorDepth)
  }

  // Flush the packet to disk, and reset the accumulator
  private flushChar (outs: ByteArray): void {
    if (this.aCount > 0) {
      outs.writeByte(this.aCount)
      outs.writeBytes(this.accum, 0, this.aCount)
      this.aCount = 0
    }
  }

  // Add a character to the end of the current packet, and if it is 254
  // characters, flush the packet to disk.
  private charOut (c: number, outs: ByteArray): void {
    this.accum[this.aCount++] = c
    if (this.aCount >= 254) this.flushChar(outs)
  }

  // Reset code table
  private clHash (hsize: number): void {
    for (let i = 0; i < hsize; ++i) this.htab[i] = -1
  }

  private static MAXCODE (nBits: number): number {
    return (1 << nBits) - 1
  }

  private output (code: number, outs: ByteArray): void {
    this.curAccum &= masks[this.curBits]

    if (this.curBits > 0) this.curAccum |= (code << this.curBits)
    else this.curAccum = code

    this.curBits += this.nBits

    while (this.curBits >= 8) {
      this.charOut((this.curAccum & 0xff), outs)
      this.curAccum >>= 8
      this.curBits -= 8
    }

    // If the next entry is going to be too big for the code size,
    // then increase it, if possible.
    if (this.freeEnt > this.maxcode || this.clearFlg) {
      if (this.clearFlg) {
        this.maxcode = LZWEncoder.MAXCODE(this.nBits = this.gInitBits)
        this.clearFlg = false
      } else {
        ++this.nBits
        if (this.nBits === BITS) this.maxcode = 1 << BITS
        else this.maxcode = LZWEncoder.MAXCODE(this.nBits)
      }
    }

    if (code === this.EOFCode) {
      // At EOF, write the rest of the buffer.
      while (this.curBits > 0) {
        this.charOut((this.curAccum & 0xff), outs)
        this.curAccum >>= 8
        this.curBits -= 8
      }
      this.flushChar(outs)
    }
  }

  // Clear out the hash table
  // table clear for block compress
  private clBlock (outs: ByteArray): void {
    this.clHash(HSIZE)
    this.freeEnt = this.ClearCode + 2
    this.clearFlg = true
    this.output(this.ClearCode, outs)
  }

  // Return the next pixel from the image
  private nextPixel (): number {
    if (this.remaining === 0) return EOF
    --this.remaining
    const pix = this.pixels[this.curPixel++]
    return pix & 0xff
  }

  private compress (initBits: number, outs: ByteArray): void {
    // Set up the globals: gInitBits - initial number of bits
    this.gInitBits = initBits

    // Set up the necessary values
    this.clearFlg = false
    this.nBits = this.gInitBits
    this.maxcode = LZWEncoder.MAXCODE(this.nBits)

    this.ClearCode = 1 << (initBits - 1)
    this.EOFCode = this.ClearCode + 1
    this.freeEnt = this.ClearCode + 2

    this.aCount = 0 // clear packet

    let ent = this.nextPixel()

    let hshift = 0
    let fcode
    for (fcode = HSIZE; fcode < 65536; fcode *= 2) ++hshift

    hshift = 8 - hshift // set hash code range bound
    this.clHash(HSIZE) // clear hash table

    this.output(this.ClearCode, outs)

    let c
    // eslint-disable-next-line no-labels
    outerLoop: do {
      c = this.nextPixel()

      fcode = (c << BITS) + ent
      let i: number = (c << hshift) ^ ent // xor hashing

      if (this.htab[i] === fcode) {
        ent = this.codetab[i]
        continue
      }

      if (this.htab[i] >= 0) { // non-empty slot
        let disp = HSIZE - i // secondary hash (after G. Knott)
        if (i === 0) disp = 1

        do {
          i -= disp
          if (i < 0) i += HSIZE
          if (this.htab[i] === fcode) {
            ent = this.codetab[i]
            // eslint-disable-next-line no-labels
            continue outerLoop
          }
        } while (this.htab[i] >= 0)
      }

      this.output(ent, outs)
      ent = c

      if (this.freeEnt < 1 << BITS) {
        this.codetab[i] = this.freeEnt++ // code -> hashtable
        this.htab[i] = fcode
      } else {
        this.clBlock(outs)
      }
    } while (c !== EOF)

    // Put out the final code.
    this.output(ent, outs)
    this.output(this.EOFCode, outs)
  }

  encode (outs: ByteArray): void {
    outs.writeByte(this.initCodeSize) // write "initial code size" byte
    this.remaining = this.width * this.height // reset navigation variables
    this.curPixel = 0
    this.compress(this.initCodeSize + 1, outs) // compress and write the pixel data
    outs.writeByte(0) // write block terminator
  }
}
