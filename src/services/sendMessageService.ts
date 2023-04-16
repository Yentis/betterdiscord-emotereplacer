import { BaseService } from './baseService'
import Message from '../interfaces/message'
import { InternalEmote, InternalEmoteSimple } from '../interfaces/internalEmote'
import Emoji from '../interfaces/emoji'
import { EmoteService } from './emoteService'
import { AttachService } from './attachService'
import { ModulesService } from './modulesService'
import { Logger } from '../utils/logger'
import { SettingsService } from './settingsService'
import { GifProcessingService } from './gifProcessingService'
import { UploadOptions } from '../interfaces/modules/uploader'
import { PromiseUtils } from '../utils/promiseUtils'
import { CloseNotice } from 'betterdiscord'

export class SendMessageService extends BaseService {
  emoteService!: EmoteService
  attachService!: AttachService
  modulesService!: ModulesService
  settingsService!: SettingsService
  gifProcessingService!: GifProcessingService

  public start (
    emoteService: EmoteService,
    attachService: AttachService,
    modulesService: ModulesService,
    settingsService: SettingsService,
    gifProcessingService: GifProcessingService
  ): Promise<void> {
    this.emoteService = emoteService
    this.attachService = attachService
    this.modulesService = modulesService
    this.settingsService = settingsService
    this.gifProcessingService = gifProcessingService

    BdApi.Patcher.instead(
      this.plugin.meta.name,
      modulesService.messageStore,
      'sendMessage',
      (_, args, original: unknown) => this.onSendMessage(args, original)
    )

    return Promise.resolve()
  }

  private async onSendMessage (
    args: unknown[],
    original: unknown
  ): Promise<void> {
    const callDefault = original as (...args: unknown[]) => unknown

    const channelId = args[0] as string | undefined
    const message = args[1] as Message | undefined
    if (channelId === undefined || !message) {
      callDefault(...args)
      return
    }

    try {
      const discordEmotes = this.getTargetEmoteFromMessage(message)
      let content = message.content

      const foundEmote = this.getTextPos(
        content,
        { ...this.emoteService.emoteNames, ...discordEmotes }
      )

      if (!foundEmote) {
        callDefault(...args)
        return
      }

      if (!this.attachService.canAttach) {
        BdApi.UI.showToast('This channel does not allow sending images!', { type: 'error' })
        callDefault(...args)
        return
      }

      content = (
        content.substring(0, foundEmote.pos) +
        content.substring(foundEmote.pos + foundEmote.nameAndCommand.length)
      ).trim()

      foundEmote.content = content
      foundEmote.channel = channelId

      try {
        this.attachService.pendingUpload = this.fetchBlobAndUpload(foundEmote)
        await this.attachService.pendingUpload
        return
      } catch (error: unknown) {
        const errorMessage = error instanceof Error
          ? error.message
          : error as string

        BdApi.UI.showToast(errorMessage, { type: 'error' })
        if (content === '') return

        message.content = content
      } finally {
        this.attachService.pendingUpload = undefined
      }

      callDefault(...args)
      return
    } catch (error) {
      Logger.warn('Error in onSendMessage', error)
    }
  }

  private getTargetEmoteFromMessage (message: Message): Record<string, InternalEmoteSimple> {
    const invalidEmojis = message.invalidEmojis ?? []
    const validNonShortcutEmojis = message.validNonShortcutEmojis ?? []

    let emoji: Emoji | undefined
    let validEmoji = false

    if (invalidEmojis.length > 0) {
      const count = invalidEmojis.length
      emoji = invalidEmojis[count - 1]
    } else if (validNonShortcutEmojis?.length > 0) {
      const count = validNonShortcutEmojis.length
      emoji = validNonShortcutEmojis[count - 1]

      // Ignore built-in emotes
      if (emoji?.managed === true) return {}
      validEmoji = emoji?.available === true && !this.attachService.externalEmotes.has(emoji.id)
    } else return {}

    if (!emoji) return {}

    const emojiName = emoji.originalName ?? emoji.name
    const allNamesString = emoji.allNamesString.replace(emoji.name, emojiName)
    const emojiText = `<${emoji.animated ? 'a' : ''}${allNamesString}${emoji.id}>`

    const result: Record<string, InternalEmoteSimple> = {}
    const url = emoji.url.split('?')[0] ?? ''
    if (!url) return {}
    const extensionIndex = url.lastIndexOf('.')

    result[emojiText] = {
      name: emojiName,
      url: url.substring(extensionIndex) === '.webp'
        ? `${url.substring(0, extensionIndex)}.png`
        : url
    }

    const foundEmote = this.getTextPos(message.content, result)
    if (!foundEmote) return {}
    // Only parse valid emojis if they contain commands
    if (validEmoji && foundEmote.commands.length === 0) return {}

    return result
  }

  private getTextPos (
    content: string,
    emoteCandidates: Record<string, InternalEmoteSimple | string>
  ): InternalEmote | undefined {
    const foundEmotes: InternalEmote[] = []

    Object.entries(emoteCandidates).forEach(([key, value]) => {
      const regex = new RegExp('(?<!\\/)' + key + '(?<=\\b|>)', 'g')
      const regexCommand = new RegExp(key + '(\\.\\S{4,}\\b)+')
      const matches = content.match(regex)
      const command = content.match(regexCommand)

      if (!matches || matches.length === 0) return
      for (let i = 0; i < matches.length; i++) {
        const pos = this.getNthIndexOf(content, key, i)
        const emote: InternalEmote = {
          name: typeof value === 'string' ? key : value.name,
          nameAndCommand: key,
          url: typeof value === 'string' ? value : value.url,
          emoteLength: key.length,
          pos,
          spoiler: false,
          commands: []
        }

        if (command) {
          const commands = command[0]?.split('.') ?? []
          emote.commands = commands
            .filter((command) => command !== key)
            .map(command => {
              const split = command.split('-')

              return [
                split[0] ?? '',
                split[1] ?? ''
              ]
            })

          emote.nameAndCommand = command[0] ?? ''
        }

        const beforeEmote = content.substring(0, pos)
        const afterEmote = content.substring(pos + emote.nameAndCommand.length)

        if (beforeEmote.includes('||') && afterEmote.includes('||')) {
          const spoilerStart = beforeEmote.substring(beforeEmote.indexOf('||'))
          emote.nameAndCommand = spoilerStart + emote.nameAndCommand
          emote.pos -= spoilerStart.length

          const spoilerEnd = afterEmote.substring(0, afterEmote.indexOf('||') + 2)
          emote.nameAndCommand = emote.nameAndCommand + spoilerEnd
          emote.spoiler = true
        }

        if (!beforeEmote.includes('`') || !afterEmote.includes('`')) {
          foundEmotes.push(emote)
        }
      }
    })

    return foundEmotes.pop()
  }

  private getNthIndexOf (input: string, search: string, nth: number): number {
    const firstIndex = input.indexOf(search)
    const startPos = firstIndex + search.length

    if (nth === 0) {
      return firstIndex
    } else {
      const inputAfterFirstOccurrence = input.substring(startPos)
      const nextOccurrence = this.getNthIndexOf(inputAfterFirstOccurrence, search, nth - 1)

      if (nextOccurrence === -1) {
        return -1
      } else {
        return startPos + nextOccurrence
      }
    }
  }

  private async fetchBlobAndUpload (emote: InternalEmote): Promise<void> {
    const url = emote.url, name = emote.name, commands = emote.commands

    if (url.endsWith('.gif') || this.findCommand(commands, this.getGifModifiers())) {
      return this.getMetaAndModifyGif(emote)
    }

    const resultBlob = (await this.compress(url, commands)) ?? new Blob([])
    if (resultBlob.size === 0) throw new Error('Emote URL did not contain data')

    this.uploadFile({
      fileData: resultBlob,
      fullName: name + '.png',
      emote
    })
  }

  private findCommand (
    commands: InternalEmote['commands'],
    names: string[]
  ): (string | undefined)[] | undefined {
    let foundCommand: (string | undefined)[] | undefined

    commands.forEach((command) => {
      names.forEach((name) => {
        if (command[0] === name) foundCommand = command
      })
    })

    return foundCommand
  }

  private getGifModifiers (): string[] {
    const gifModifiers: string[] = []

    this.emoteService.modifiers.forEach((modifier) => {
      if (modifier.type === 'gif') {
        gifModifiers.push(modifier.name)
      }
    })

    return gifModifiers
  }

  private async getMetaAndModifyGif (emote: InternalEmote): Promise<void> {
    const image = await PromiseUtils.loadImagePromise(emote.url)

    const commands = emote.commands
    this.addResizeCommand(commands, image)
    let closeNotice: CloseNotice | undefined

    // Wait a bit before showing to prevent flickering
    const timeout = setTimeout(() => {
      closeNotice = BdApi.UI.showNotice(`Processing gif ${emote.name}...`, {
        type: 'info',
        buttons: [{
          label: 'Cancel',
          onClick: () => {
            cancel?.()
            cancel = undefined

            closeNotice?.()
            closeNotice = undefined
          }
        }]
      })
    }, 250)

    let { cancel, result } = this.gifProcessingService.modifyGif(emote.url, commands)
    const buffer = await result.finally(() => {
      cancel = undefined
      clearTimeout(timeout)

      closeNotice?.()
      closeNotice = undefined
    })

    if (buffer.length === 0) {
      throw Error('Failed to process gif')
    }

    this.uploadFile({
      fileData: buffer,
      fullName: emote.name + '.gif',
      emote
    })
  }

  private addResizeCommand (commands: InternalEmote['commands'], image: HTMLImageElement): void {
    const scaleFactorNum = this.getScaleFactor(commands, image)
    let scaleFactor = scaleFactorNum.toString()

    const wideCommand = this.findCommand(commands, ['wide'])
    if (wideCommand) {
      const wideness = this.getEmoteWideness(wideCommand)
      scaleFactor = `${(scaleFactorNum * wideness)}x${scaleFactorNum}}`
    }

    commands.push(['resize', scaleFactor])
  }

  private getScaleFactor (commands: InternalEmote['commands'], image: HTMLImageElement): number {
    const size = this.getEmoteSize(commands)
    let scaleFactor

    if (this.settingsService.settings.resizeMethod === 'largest') {
      if (image.width > image.height) {
        scaleFactor = size / image.width
      } else scaleFactor = size / image.height
    } else {
      if (image.width < image.height) {
        scaleFactor = size / image.width
      } else scaleFactor = size / image.height
    }

    return scaleFactor
  }

  private getEmoteSize (commands: InternalEmote['commands']): number {
    let resizeCommand: (string | undefined)[] = []
    let size: number | string

    commands.forEach((command, index, object) => {
      if (command[0] === 'resize') {
        resizeCommand = command
        object.splice(index, 1)
      }
    })

    const resizeCommandSize = resizeCommand[1] ?? ''
    if (resizeCommandSize !== '') {
      size = resizeCommandSize
    } else {
      size = Math.round(this.settingsService.settings.emoteSize)
    }

    if (size === 'large' || size === 'big') {
      return 128
    } else if (size === 'medium' || size === 'normal') {
      return 64
    } else {
      const sizeNumber = typeof size === 'string' ? parseInt(size) : size
      if (!isNaN(sizeNumber)) {
        return Math.min(Math.max(sizeNumber, 32), 128)
      }

      return 48
    }
  }

  private getEmoteWideness (wideCommand: (string | undefined)[]): number {
    const param = wideCommand[1]
    const paramNum = parseInt(param ?? '')

    if (!isNaN(paramNum)) {
      return Math.max(Math.min(paramNum, 8), 2)
    } else if (param === 'extreme') {
      return 8
    } else if (param === 'huge') {
      return 6
    } else if (param === 'big') {
      return 4
    } else {
      return 2
    }
  }

  private uploadFile (
    params: {
      fileData: Buffer | Blob,
      fullName: string,
      emote: InternalEmote
    }
  ): void {
    const { fileData, fullName, emote } = params
    const content = emote.content ?? ''
    const channelId = emote.channel ?? ''
    if (!channelId) {
      Logger.error('Channel ID not found for emote:', emote)
      return
    }

    // eslint-disable-next-line new-cap
    const upload = new this.modulesService.cloudUploader.n(
      { file: new File([fileData], fullName), platform: 1 },
      channelId
    )
    upload.spoiler = emote.spoiler

    const uploadOptions: UploadOptions = {
      channelId,
      uploads: [upload],
      draftType: 0,
      parsedMessage: { content, invalidEmojis: [], tts: false, channel_id: channelId }
    }

    const pendingReply = this.attachService.pendingReply
    if (pendingReply) {
      uploadOptions.options = {
        allowedMentions: {
          replied_user: pendingReply.shouldMention
        },
        messageReference: {
          channel_id: pendingReply.message.channel_id,
          guild_id: pendingReply.channel.guild_id,
          message_id: pendingReply.message.id
        }
      }
    }

    this.modulesService.uploader.uploadFiles(uploadOptions)
  }

  private async compress (
    url: string,
    commands: InternalEmote['commands']
  ): Promise<Blob | undefined> {
    const image = await PromiseUtils.loadImagePromise(url)
    const canvas = await this.applyScaling(image, commands)

    return await new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob ?? undefined)
      }, 'image/png', 1)
    })
  }

  private async applyScaling (
    image: HTMLImageElement,
    commands: InternalEmote['commands']
  ): Promise<HTMLCanvasElement> {
    const scaleFactor = this.getScaleFactor(commands, image)

    let canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height

    if (commands.length > 0) {
      canvas = this.applyCommands(image, canvas, commands)
    } else {
      canvas.getContext('2d')?.drawImage(image, 0, 0)
    }

    const scaledBitmap = await createImageBitmap(
      canvas,
      {
        resizeWidth: Math.ceil(canvas.width * scaleFactor),
        resizeHeight: Math.ceil(canvas.height * scaleFactor),
        resizeQuality: 'high'
      }
    )

    const resizedCanvas = document.createElement('canvas')
    resizedCanvas.width = scaledBitmap.width
    resizedCanvas.height = scaledBitmap.height

    const resizedContext = resizedCanvas.getContext('bitmaprenderer')
    if (!resizedContext) throw new Error('Bitmap context not found')
    resizedContext.transferFromImageBitmap(scaledBitmap)

    return resizedCanvas
  }

  private applyCommands (
    image: HTMLImageElement,
    canvas: HTMLCanvasElement,
    commands: InternalEmote['commands']
  ): HTMLCanvasElement {
    let scaleH = 1,
      scaleV = 1,
      posX = 0,
      posY = 0

    if (this.findCommand(commands, ['flip'])) {
      scaleH = -1 // Set horizontal scale to -1 if flip horizontal
      posX = canvas.width * -1 // Set x position to -100% if flip horizontal
    }

    if (this.findCommand(commands, ['flap'])) {
      scaleV = -1 // Set vertical scale to -1 if flip vertical
      posY = canvas.height * -1 // Set y position to -100% if flip vertical
    }

    const ctx = canvas.getContext('2d')

    const wideCommand = this.findCommand(commands, ['wide'])
    if (wideCommand) {
      const wideness = this.getEmoteWideness(wideCommand)
      image.width = image.width * wideness
      canvas.width = canvas.width * wideness
    }

    const rotateCommand = this.findCommand(commands, ['rotate'])
    if (rotateCommand) {
      const angle = parseInt(rotateCommand[1] ?? '0') * Math.PI / 180,
        sin = Math.sin(angle),
        cos = Math.cos(angle)

      const newWidth = Math.abs(canvas.width * cos) + Math.abs(canvas.height * sin)
      const newHeight = Math.abs(canvas.width * sin) + Math.abs(canvas.height * cos)

      canvas.width = newWidth
      canvas.height = newHeight

      ctx?.translate(canvas.width / 2, canvas.height / 2)
      ctx?.rotate(angle)

      posX = -image.width / 2
      posY = -image.height / 2
    }

    ctx?.scale(scaleH, scaleV) // Set scale to flip the image
    ctx?.drawImage(image, posX, posY, image.width, image.height)

    return canvas
  }

  public stop (): void {
    // Do nothing
  }
}
