import { IncomingMessage } from 'http'
import https from 'https'

export function httpsGetPromise (url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        const statusCode = res.statusCode ?? 0
        if (statusCode !== 0 && (statusCode < 200 || statusCode >= 400)) {
          reject(new Error(res.statusMessage))
          return
        }

        resolve(data)
      })
    }).on('error', (error) => {
      reject(error)
    })
  })
}

export function httpsGetStream (url: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      resolve(res)
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
