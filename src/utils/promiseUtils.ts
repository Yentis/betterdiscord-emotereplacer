import * as https from 'https'
import * as fs from 'fs'
import { Buffer } from 'buffer'
import { WorkerMessage } from 'interfaces/workerData'

export class PromiseUtils {
  public static urlGetBuffer (url: string): Promise<Buffer> {
    if (url.startsWith('http')) return PromiseUtils.httpsGetBuffer(url)
    else return PromiseUtils.fsGetBuffer(url)
  }

  private static async fsGetBuffer (url: string): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const data = fs.readFileSync(url, '')
    return await Promise.resolve(Buffer.from(data))
  }

  private static httpsGetBuffer (url: string): Promise<Buffer> {
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

  public static async loadImagePromise (
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
      const buffer = await PromiseUtils.urlGetBuffer(url)
      image.src = URL.createObjectURL(new Blob([buffer]))
    }

    if (waitForLoad) await loadPromise
    return image
  }

  public static delay (duration: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve()
      }, duration)
    })
  }

  public static workerMessagePromise (
    worker: Worker,
    request: WorkerMessage
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      worker.onmessage = (message) => {
        const response = message.data as WorkerMessage
        if (response.type !== request.type) return

        if (response.data instanceof Error) {
          reject(response.data)
        } else {
          resolve(response.data)
        }
      }

      worker.postMessage(request)
    })
  }
}
