import https from 'https'
import { Buffer } from 'pluginConstants'

export function httpsGetBuffer (url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const buffers: Uint8Array[] = []

      res.on('data', (chunk: Uint8Array) => {
        buffers.push(chunk)
      })

      res.on('end', () => {
        const statusCode = res.statusCode ?? 0
        if (statusCode !== 0 && (statusCode < 200 || statusCode >= 400)) {
          reject(new Error(res.statusMessage))
          return
        }

        resolve(Buffer.concat(buffers))
      })
    }).on('error', (error) => {
      reject(error)
    })
  })
}

export function loadImagePromise (url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => { resolve(image) }
    image.onerror = () => { reject(new Error(`Failed to load image from url: ${url}`)) }

    image.src = url
  })
}

export function fileReaderPromise (blob: Blob): Promise<string | ArrayBuffer | undefined> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(blob)

    reader.onload = (event) => { resolve(event.target?.result ?? undefined) }
    reader.onerror = (error) => { reject(error) }
  })
}
