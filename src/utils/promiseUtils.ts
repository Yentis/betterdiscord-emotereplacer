import * as https from 'https'
import * as fs from 'fs'
import { Buffer } from 'buffer'

export function urlGetBuffer (url: string): Promise<Buffer> {
  if (url.startsWith('http')) return httpsGetBuffer(url)
  else return fsGetBuffer(url)
}

async function fsGetBuffer (url: string): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const data = fs.readFileSync(url, '')
  return await Promise.resolve(Buffer.from(data))
}

function httpsGetBuffer (url: string): Promise<Buffer> {
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

export async function loadImagePromise (
  url: string,
  waitForLoad = true,
  element?: HTMLImageElement
): Promise<HTMLImageElement> {
  const image = element ?? new Image()

  const loadPromise = new Promise<void>((resolve, reject) => {
    image.onload = () => { resolve() }
    image.onerror = () => { reject(new Error(`Failed to load image for url ${url}`)) }
  })

  if (url.startsWith('http') && !waitForLoad) {
    image.src = url
  } else {
    const buffer = await urlGetBuffer(url)
    image.src = URL.createObjectURL(new Blob([buffer]))
  }

  if (waitForLoad) await loadPromise
  return image
}

export function delay (duration: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, duration)
  })
}
