import * as fs from 'fs'
import { GifWorker, WorkerMessage } from 'interfaces/workerData'

export class Utils {
  public static urlGetBuffer (url: string): Promise<Uint8Array> {
    if (url.startsWith('http')) return Utils.fetchGetBuffer(url)
    else return Utils.fsGetBuffer(url)
  }

  private static async fsGetBuffer (url: string): Promise<Uint8Array> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const data = fs.readFileSync(url, '')
    return await Promise.resolve(data)
  }

  private static async fetchGetBuffer (url: string): Promise<Uint8Array> {
    // TODO: remove custom TS type when BD types are updated
    type BdApiExtended = typeof BdApi & {
      Net: {
        fetch: (url: string) => Promise<Response>
      }
    };

    const response = await (BdApi as BdApiExtended).Net.fetch(url)
    const statusCode = response.status
    if (statusCode !== 0 && (statusCode < 200 || statusCode >= 400)) {
      throw new Error(response.statusText)
    }
    if (!response.body) throw new Error(`No response body for url: ${url}`)

    const arrayBuffer = await response.arrayBuffer()
    return new Uint8Array(arrayBuffer)
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
      const buffer = await Utils.urlGetBuffer(url)
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
    worker: GifWorker,
    request: WorkerMessage
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      worker.onterminate = () => {
        reject(new Error('Cancelled'))
      }

      worker.onerror = (error) => {
        reject(error)
      }

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

  public static clamp (num: number, min: number, max: number): number {
    return Math.min(Math.max(num, min), max)
  }
}
