import { Readable } from 'stream'

export default function convert (buf: Buffer, _chunkSize?: number): Readable {
  const reader = new Readable()

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  // eslint-disable-next-line max-len
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, no-underscore-dangle
  const hwm: number = reader._readableState.highWaterMark
  const len = buf.length
  let start = 0
  let chunkSize: number

  // If chunkSize is invalid, set to highWaterMark.
  if (_chunkSize === undefined || _chunkSize < 1 || _chunkSize > hwm) {
    chunkSize = hwm
  } else {
    chunkSize = _chunkSize
  }

  // Overwrite _read method to push data from buffer.
  // eslint-disable-next-line no-underscore-dangle
  reader._read = () => {
    const chunk = buf.slice(start, (start += chunkSize))

    while (reader.push(chunk)) {
      // If all data pushed, just break the loop.
      if (start >= len) {
        reader.push(null)
        break
      }
    }
  }

  return reader
}
