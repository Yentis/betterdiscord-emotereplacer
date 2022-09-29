// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

export default class ByteArray {
  data: number[] = []

  private getData (): Buffer {
    return Buffer.from(this.data)
  }

  writeByte (val: number): void {
    this.data.push(val)
  }

  writeUTFBytes (text: string): void {
    for (let l = text.length, i = 0; i < l; i++) {
      this.writeByte(text.charCodeAt(i))
    }
  }

  writeBytes (array: number[] | Uint8Array, offset?: number, length?: number): void {
    for (let l = length || array.length, i = offset || 0; i < l; i++) {
      this.writeByte(array[i])
    }
  }
}
