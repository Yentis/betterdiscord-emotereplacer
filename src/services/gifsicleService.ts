import { BaseService } from './baseService'
import { Logger } from 'utils/logger'
import { Command } from 'interfaces/gifData'
import * as PromiseUtils from 'utils/promiseUtils'
import { Buffer } from 'buffer'
import init, { applyCommands, initPanicHook } from '../../rust/pkg/gif_wasm'
import wasm from '../../rust/pkg/gif_wasm_bg.wasm'

export class GifsicleService extends BaseService {
  public async start (): Promise<void> {
    const instance = await wasm()
    await init(instance)
    initPanicHook()
  }

  public async modifyGif (url: string, options: (string | undefined)[][]): Promise<Buffer> {
    Logger.info('Got GIF request', url, options)
    const commands = this.getCommands(options)
    Logger.info('Processed request commands', commands)

    const buffer = await this.processCommands(url, commands)
    Logger.info('Processed modified emote', { length: buffer.length })

    return buffer
  }

  private getCommands (options: (string | undefined)[][]): Command[] {
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
          commands.push({ name: option[0], param: 0 })
          break
        case 'flap':
          commands.push({ name: 'flip', param: 1 })
          break
        case 'speed': {
          const param = option[1]?.toString() ?? ''

          commands.push({
            name: option[0],
            param: Math.max(2, parseFloat(param))
          })
          break
        }
        case 'hyperspeed':
          commands.push({ name: 'hyperspeed' })
          break
        case 'rotate':
          commands.push({ name: option[0], param: option[1] })
          break
        case 'wiggle': {
          let size = 2
          const param = option[1]

          if (param === 'big') size = 4
          else if (param === 'bigger') size = 6
          else if (param === 'huge') size = 10

          commands.push({ name: option[0], param: size })
          break
        }
        case 'rain':
          commands.push({
            name: option[0],
            param: option[1] === 'glitter' ? 0 : 1
          })
          break
        case 'spin':
        case 'spinrev':
        case 'shake':
        case 'rainbow':
        case 'infinite':
        case 'slide':
        case 'sliderev': {
          let speed = 8
          const param = option[1]

          if (param === 'fast') speed = 6
          else if (param === 'faster') speed = 4
          else if (param === 'hyper') speed = 2

          commands.push({ name: option[0], param: speed })
          break
        }
        default:
          break
      }
    })

    return commands
  }

  private async processCommands (url: string, commands: Command[]): Promise<Buffer> {
    let buffer = await PromiseUtils.urlGetBuffer(url)

    commands.forEach((command) => {
      const value = (command.param ?? 0).toString()
      command.param = parseFloat(value)
    })

    console.log('Commands:', commands)
    const result = applyCommands(buffer, commands)
    buffer = Buffer.from(result)

    if (!(buffer instanceof Buffer)) throw Error('Did not process gif!')
    return buffer
  }

  public stop (): void {
    // Do nothing
  }
}
