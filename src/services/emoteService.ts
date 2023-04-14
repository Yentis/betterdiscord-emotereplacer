import Cached from 'interfaces/cached'
import Completion from 'interfaces/completion'
import Modifier from 'interfaces/modifier'
import { Logger } from 'utils/logger'
import * as PromiseUtils from 'utils/promiseUtils'
import { BaseService } from './baseService'
import { CompletionsService } from './completionsService'
import { HtmlService } from './htmlService'
import { ListenersService } from './listenersService'
import { SettingsService } from './settingsService'

export class EmoteService extends BaseService {
  listenersService!: ListenersService
  settingsService!: SettingsService
  htmlService!: HtmlService

  emoteNames: Record<string, string> | undefined
  modifiers: Modifier[] = []

  public start (
    listenersService: ListenersService,
    settingsService: SettingsService,
    htmlService: HtmlService
  ): Promise<void> {
    this.listenersService = listenersService
    this.settingsService = settingsService
    this.htmlService = htmlService
    this.initEmotes()

    return Promise.resolve()
  }

  private initEmotes () {
    Promise.all([
      this.getEmoteNames(),
      this.getModifiers()
    ]).then(([emoteNames, modifiers]) => {
      this.setEmoteNames(emoteNames)
      this.modifiers = modifiers

      if (this.htmlService.getEditors().length > 0) {
        this.listenersService.requestAddListeners(CompletionsService.TAG)
      }
    }).catch((error) => {
      Logger.warn('Failed to get emote names and/or modifiers', error)
    })
  }

  public refreshEmotes (): void {
    this.emoteNames = undefined
    BdApi.UI.showToast('Reloading emote database...', { type: 'info' })

    this.getEmoteNames()
      .then((names) => {
        this.setEmoteNames(names)
        BdApi.UI.showToast('Emote database reloaded!', { type: 'success' })
      }).catch((error) => {
        Logger.warn('Failed to get emote names', error)
      })
  }

  private async getEmoteNames (): Promise<Record<string, string>> {
    if (!this.settingsService.settings.showStandardEmotes) {
      return {}
    }

    const data = await PromiseUtils.urlGetBuffer(
      'https://raw.githubusercontent.com/Yentis/yentis.github.io/master/emotes/emotes.json'
    )
    const emoteNames = JSON.parse(data.toString()) as Record<string, string>

    Object.keys(emoteNames).forEach((key) => {
      const split = emoteNames[key]?.split('.')
      const [name, extension] = split ?? []

      delete emoteNames[key]
      if (name === undefined || extension === undefined) return

      emoteNames[name] = 'https://raw.githubusercontent.com/Yentis/yentis.github.io/master/emotes' +
        `/images/${key}.${extension}`
    })

    return emoteNames
  }

  private setEmoteNames (emoteNames: Record<string, string>): void {
    const customEmotes: Record<string, string> = {}

    Object.entries(this.settingsService.settings.customEmotes).forEach(([name, url]) => {
      customEmotes[this.getPrefixedName(name)] = url
    })

    const standardNames: Record<string, string> = {}
    Object.entries(emoteNames).forEach(([name, url]) => {
      const prefixedName = this.getPrefixedName(name)
      standardNames[prefixedName] = url
    })

    this.emoteNames = { ...standardNames, ...customEmotes }
  }

  private async getModifiers (): Promise<Modifier[]> {
    const data = await PromiseUtils.urlGetBuffer(
      'https://raw.githubusercontent.com/Yentis/betterdiscord-emotereplacer/master/modifiers.json'
    )
    return JSON.parse(data.toString()) as Modifier[]
  }

  public getPrefixedName (name: string): string {
    const settingsPrefix = this.settingsService.settings.prefix
    if (name.toLowerCase().startsWith(settingsPrefix)) {
      name = name.replace(settingsPrefix, '')
    }

    return `${settingsPrefix}${name}`
  }

  public shouldCompleteEmote (input: string): boolean {
    const prefix = this.settingsService.settings.requirePrefix
      ? this.escapeRegExp(this.settingsService.settings.prefix)
      : ''

    return new RegExp('(?:^|\\s)' + prefix + '\\w{2,}$').test(input)
  }

  public shouldCompleteCommand (input: string): boolean {
    return this.getRegexCommand().test(input)
  }

  private escapeRegExp (input: string): string {
    return input.replace(/[-\\/\\^$*+?.()|[\]{}]/g, '\\$&')
  }

  private getRegexCommand () {
    const prefix = this.settingsService.settings.requirePrefix
      ? this.escapeRegExp(this.settingsService.settings.prefix)
      : ''

    return new RegExp('((?<!\\/)(?:' + prefix + '|<)[\\w:>]*\\.)([\\w\\.-]*)$')
  }

  public getCompletionsEmote (text: string): Cached {
    const settingsPrefix = this.settingsService.settings.prefix
    const prefix = this.settingsService.settings.requirePrefix
      ? this.escapeRegExp(settingsPrefix)
      : ''

    const match = text.match(new RegExp('(^|\\s)(' + prefix + '\\w{2,})$'))
    if (match === null) {
      return { completions: [], matchText: undefined, matchStart: -1 }
    }

    const emoteArray: Completion[] = []
    Object.entries(this.emoteNames ?? {}).forEach(([key, value]) => {
      emoteArray.push({ name: key, data: value })
    })

    const matchText = (match[2] ?? '').toLowerCase()
    const completions = emoteArray
      .filter((emote) => {
        const matchWithoutPrefix = matchText.startsWith(settingsPrefix)
          ? matchText.replace(settingsPrefix, '')
          : matchText

        if (emote.name.toLowerCase().search(matchWithoutPrefix) !== -1) {
          return emote
        } else {
          return false
        }
      })

    const matchIndex = match.index ?? 0
    const matchFirst = match[1] ?? ''
    const matchStart = matchIndex + matchFirst.length

    return { completions, matchText, matchStart }
  }

  public getCompletionsCommands (text: string): Cached {
    const regex = this.getRegexCommand()
    const match = text.match(regex)
    if (match === null) {
      return { completions: [], matchText: undefined, matchStart: -1 }
    }

    const commandPart = match[2]?.substring(match[2].lastIndexOf('.') + 1) ?? ''
    const commandArray: Completion[] = []

    this.modifiers.forEach((modifier) => {
      commandArray.push({ name: modifier.name, data: modifier })
    })

    const completions = commandArray.filter((command) => {
      return commandPart === '' || command.name.toLowerCase().search(commandPart) !== -1
    })

    const matchText = commandPart
    const matchIndex = match.index ?? 0
    const matchZero = match[0] ?? ''
    const matchStart = matchIndex + matchZero.length

    return { completions, matchText, matchStart }
  }

  public stop (): void {
    this.emoteNames = undefined
    this.modifiers = []
  }
}
