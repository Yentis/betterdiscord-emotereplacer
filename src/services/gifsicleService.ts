import arch from 'libraries/arch'
import { BASE_GIFSICLE_URL } from 'pluginConstants'
import { BaseService } from './baseService'
import fs from 'fs'
import https from 'https'
import { Logger } from 'utils/logger'
import { Command, GifCommands, SpecialCommand } from 'interfaces/gifData'
import Gifsicle from 'libraries/gifiscle'
import { Stream } from 'stream'
import toStream from 'libraries/buffer-to-stream'
import {
  infiniteEmote,
  rainbowEmote,
  rainEmote,
  rotateEmote,
  shakeEmote,
  slideEmote,
  spinEmote,
  wiggleEmote
} from 'utils/modifierUtils'
import * as PromiseUtils from 'utils/promiseUtils'

let Buffer: BufferConstructor

export class GifsicleService extends BaseService {
  gifsiclePath: string | undefined

  public async start (): Promise<void> {
    Buffer = (await import('buffer')).Buffer

    this.tryDownloadGifsicle()
  }

  private tryDownloadGifsicle (): void {
    const binFilename = process.platform === 'win32' ? 'gifsicle.exe' : 'gifsicle'
    const gifsiclePath = BdApi.Plugins.folder + '/' + binFilename

    let gifsicleUrl
    switch (process.platform) {
      case 'darwin':
        gifsicleUrl = `${BASE_GIFSICLE_URL}macos/${binFilename}`
        break
      case 'linux':
      case 'freebsd':
        if (arch() === 'x64') {
          gifsicleUrl = `${BASE_GIFSICLE_URL}${process.platform}/x64/${binFilename}`
        } else {
          gifsicleUrl = `${BASE_GIFSICLE_URL}${process.platform}/x86/${binFilename}`
        }
        break
      case 'win32':
        if (arch() === 'x64') {
          gifsicleUrl = `${BASE_GIFSICLE_URL}win/x64/${binFilename}`
        } else {
          gifsicleUrl = `${BASE_GIFSICLE_URL}win/x86/${binFilename}`
        }
        break
      default:
        return
    }

    this.gifsiclePath = gifsiclePath
    if (!fs.existsSync(gifsiclePath)) {
      const file = fs.createWriteStream(gifsiclePath)
      https.get(gifsicleUrl, (response) => {
        response.pipe(file)
        file.on('finish', () => {
          file.close()
          fs.chmodSync(gifsiclePath, '0777')
        })
      }).on('error', (err) => {
        fs.unlink(gifsiclePath, () => { /* Do nothing */ })
        Logger.warn('Failed to get Gifsicle', err)
      })
    }
  }

  public async modifyGif (url: string, options: (string | undefined)[][]): Promise<Buffer> {
    Logger.info('Got GIF request', url, options)
    const commands = this.getCommands(options)
    Logger.info('Processed request commands', commands)

    const buffer = await this.processCommands(url, commands)
    Logger.info('Processed modified emote', { length: buffer.length })

    return buffer
  }

  private getCommands (options: (string | undefined)[][]): GifCommands {
    const normal: Command[] = []
    const special: Command[] = []
    const priority: Command[] = []

    options.forEach((option) => {
      switch (option[0]) {
        case 'resize': {
          const command: Command = {
            name: '--scale',
            param: option[1]
          }

          const split = command.param?.toString().split('x')
          const shouldProcessAfter = split?.some((axis) => parseFloat(axis) > 1) === true

          if (shouldProcessAfter) {
            normal.push(command)
          } else {
            priority.push(command)
          }
          break
        }
        case 'reverse': {
          normal.push({ name: '#-1-0' })
          break
        }
        case 'flip':
          normal.push({ name: '--flip-horizontal' })
          break
        case 'flap':
          normal.push({ name: '--flip-vertical' })
          break
        case 'speed': {
          const param = option[1]?.toString() ?? ''
          if (param) {
            normal.push({ name: `-d${Math.max(2, parseFloat(param))}` })
          }

          break
        }
        case 'hyperspeed':
          normal.push({ name: 'hyperspeed' })
          break
        case 'rotate':
          special.push({ name: option[0], param: option[1] })
          break
        case 'wiggle': {
          let size = 2
          const param = option[1]

          if (param === 'big') size = 4
          else if (param === 'bigger') size = 6
          else if (param === 'huge') size = 10

          special.push({ name: option[0], param: size })
          break
        }
        case 'rain':
          special.push({ name: option[0], param: option[1] === 'glitter' ? 1 : 0 })
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

          special.push({ name: option[0], param: speed })
          break
        }
        default:
          break
      }
    })

    return {
      normal,
      special,
      priority
    }
  }

  private async processCommands (url: string, commands: GifCommands): Promise<Buffer> {
    const fileType = url.endsWith('gif') ? 'gif' : 'png'
    let buffer: string | Buffer = url
    let size: string | number | undefined

    if (fileType === 'gif') {
      // Priority commands (namely resizing) must be done before unoptimizing
      // or it will cause glitches
      if (commands.priority.length > 0) {
        buffer = await this.doModification(buffer, commands.priority)
      }

      buffer = await this.doModification(buffer, [{
        name: '--unoptimize'
      }])
    }

    if (fileType === 'png') {
      const scaleIndex = this.getCommandIndex(commands.priority, '--scale')
      if (scaleIndex !== undefined) {
        size = commands.priority[scaleIndex]?.param
      }
    }

    if (commands.special.length > 0) {
      buffer = await this.processSpecialCommands({
        data: buffer,
        commands: commands.special,
        fileType,
        size
      })
    }

    if (commands.normal.length > 0) {
      buffer = await this.processNormalCommands(buffer, commands.normal)
    }

    if (!(buffer instanceof Buffer)) throw Error('Did not process gif!')
    return buffer
  }

  private async doModification (
    data: string | Buffer,
    options: Command[],
    _retryCount = 0
  ): Promise<Buffer> {
    if (data.length === 0 || this.gifsiclePath === undefined) {
      return Buffer.concat([])
    }
    let retryCount = _retryCount

    const gifsicleParams: string[] = []
    options.forEach((option) => {
      const param = option.param ?? ''
      gifsicleParams.push(option.name)

      if (param !== '') {
        gifsicleParams.push(param.toString())
      }
    })

    const gifProcessor = new Gifsicle(this.gifsiclePath, gifsicleParams)
    let readStream: Stream

    if (Buffer.isBuffer(data)) {
      readStream = toStream(data)
    } else {
      readStream = await PromiseUtils.httpsGetStream(data)
    }

    const buffers: Uint8Array[] = []
    return new Promise((resolve, reject) => {
      readStream
        .pipe(gifProcessor)
        .on('data', (chunk: Uint8Array) => {
          buffers.push(chunk)
        })
        .on('error', (err) => reject(err))
        .on('end', () => {
          if (buffers.length === 0 && retryCount < 5) {
            retryCount++
            resolve(this.doModification(data, options, retryCount))
          } else {
            resolve(Buffer.concat(buffers))
          }
        })
    })
  }

  private getCommandIndex (
    commands: Command[],
    name: string
  ): number | undefined {
    const index = commands.findIndex((command: Command) => command.name === name)
    return index !== -1 ? index : undefined
  }

  private async processSpecialCommands (
    options: {
      data: string | Buffer,
      commands: Command[],
      fileType: string,
      size: string | number | undefined
    }
  ): Promise<string | Buffer> {
    const { commands } = options
    let currentBuffer = options.data

    Logger.info(`Commands count: ${commands.length}`)

    for (const [index, command] of commands.entries()) {
      const value = (command.param ?? 0).toString()
      const size = (options.size ?? 1).toString()
      // eslint-disable-next-line no-await-in-loop
      currentBuffer = await this.processSpecialCommand({
        name: command.name,
        value: parseFloat(value),
        buffer: currentBuffer,
        type: index === 0 ? options.fileType : 'gif',
        size,
        isResized: index > 0
      })
    }

    return currentBuffer
  }

  private processSpecialCommand (
    command: SpecialCommand
  ): Promise<string | Buffer> {
    Logger.info(`Command name: ${command.name}`)

    switch (command.name) {
      case 'rotate':
        return rotateEmote(command)
      case 'spin':
      case 'spinrev':
        return spinEmote(command)
      case 'shake':
        return shakeEmote(command)
      case 'rainbow':
        return rainbowEmote(command)
      case 'wiggle':
        return wiggleEmote(command)
      case 'infinite':
        return infiniteEmote(command)
      case 'slide':
      case 'sliderev':
        return slideEmote(command)
      case 'rain':
        return rainEmote(command)
      default:
        return Promise.resolve(command.buffer)
    }
  }

  private async processNormalCommands (
    buffer: string | Buffer,
    _commands: Command[]
  ): Promise<Buffer> {
    let commands = _commands

    const info = await this.doModification(buffer, [{
      name: '-I'
    }])

    commands.unshift({
      name: '-U'
    })

    const hyperspeedIndex = this.getCommandIndex(commands, 'hyperspeed')
    if (hyperspeedIndex !== undefined) {
      commands.splice(hyperspeedIndex, 1)
      commands = this.removeEveryOtherFrame(2, commands, info)
    }

    return this.doModification(buffer, commands)
  }

  private removeEveryOtherFrame (frameInterval: number, commands: Command[], data: Buffer) {
    commands.push({
      name: '-d2'
    })

    const frameCount = data.toString('utf8').split('image #').length - 1
    if (frameCount <= 4) return commands
    commands.push({
      name: '--delete'
    })

    for (let i = 1; i < frameCount; i += frameInterval) {
      commands.push({
        name: `#${i}`
      })
    }

    return commands
  }

  public stop (): void {
    this.gifsiclePath = undefined
  }
}
