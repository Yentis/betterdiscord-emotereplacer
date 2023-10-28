import { BaseService } from './baseService'
import { Logger } from '../utils/logger'
import { Command } from '../interfaces/gifData'
import Worker from 'web-worker:../worker.ts'
import { GifWorker, WorkerMessage, WorkerMessageType } from '../interfaces/workerData'
import { Utils } from '../utils/utils'

export class GifProcessingService extends BaseService {
  public isProcessing = false
  private worker?: GifWorker

  public async start (): Promise<void> {
    await this.getWorker()
  }

  private async getWorker (): Promise<GifWorker> {
    if (this.worker) return this.worker

    const worker = new GifWorker(new Worker())
    const request: WorkerMessage = {
      type: WorkerMessageType.INIT
    }

    await Utils.workerMessagePromise(worker, request)

    this.worker = worker
    return worker
  }

  private stopWorker () {
    this.isProcessing = false
    if (!this.worker) return

    this.worker.terminate()
    this.worker = undefined
  }

  public modifyGif (url: string, formatType: string, options: string[][]): {
    cancel?: () => void,
    result: Promise<Uint8Array>
  } {
    if (this.isProcessing) {
      return { result: Promise.reject(new Error('Already processing, please wait.')) }
    }
    this.isProcessing = true

    return {
      cancel: () => { this.stopWorker() },
      result: this.modifyGifImpl(url, formatType, options).finally(() => {
        this.isProcessing = false
      })
    }
  }

  private async modifyGifImpl (
    url: string,
    formatType: string,
    options: string[][]
  ): Promise<Uint8Array> {
    Logger.info('Got GIF request', url, options)
    const commands = this.getCommands(options)
    Logger.info('Processed request commands', commands)

    const result = await this.processCommands(url, formatType, commands)
    Logger.info('Processed modified emote', { length: result.length })

    return result
  }

  private getCommands (options: string[][]): Command[] {
    const commands: Command[] = []

    options.forEach((option) => {
      switch (option[0]) {
        case 'resize': {
          const command: Command = {
            name: option[0],
            param: option[1]
          }

          commands.push(command)
          break
        }
        case 'reverse': {
          commands.push({ name: option[0] })
          break
        }
        case 'flip':
          commands.push({ name: option[0], param: '0' })
          break
        case 'flap':
          commands.push({ name: 'flip', param: '1' })
          break
        case 'speed': {
          const param = option[1]?.toString() ?? ''

          commands.push({
            name: option[0],
            param: Math.max(2, parseFloat(param)).toString()
          })
          break
        }
        case 'hyperspeed':
          commands.push({ name: 'hyperspeed' })
          break
        case 'rotate':
          commands.push({ name: option[0], param: option[1] })
          break
        case 'rain':
          commands.push({
            name: option[0],
            param: option[1] === 'glitter' ? '1' : '0'
          })
          break
        case 'spin':
        case 'spinrev':
        case 'shake':
        case 'rainbow':
        case 'infinite':
        case 'slide':
        case 'sliderev':
        case 'wiggle': {
          let speed = '8'
          const param = option[1]

          if (param === 'fast') speed = '6'
          else if (param === 'faster') speed = '4'
          else if (param === 'hyper') speed = '2'

          commands.push({ name: option[0], param: speed })
          break
        }
        default:
          break
      }
    })

    return commands
  }

  private async processCommands (
    url: string,
    formatType: string,
    commands: Command[]
  ): Promise<Uint8Array> {
    const data = await Utils.urlGetBuffer(url)
    const worker = await this.getWorker()

    const request: WorkerMessage = {
      type: WorkerMessageType.APPLY_COMMANDS,
      data: { data, formatType, commands }
    }

    const response = await Utils.workerMessagePromise(worker, request)
    if (!(response instanceof Uint8Array)) throw Error('Did not process gif!')

    return response
  }

  public stop (): void {
    this.stopWorker()
  }
}
