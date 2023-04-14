import { Plugin } from 'betterdiscord'
import changeDraftPatch from 'patches/changeDraft'
import pendingReplyPatch from 'patches/pendingReply'
import emojiSearchPatch from 'patches/emojiSearch'
import lockedEmojisPatch from 'patches/lockedEmojis'
import {
  CURRENT_VERSION_INFO_KEY,
  PLUGIN_CHANGELOG
} from 'pluginConstants'
import { Logger, setLogger } from 'utils/logger'
import { BdWindow } from 'index'
import { EmoteService } from 'services/emoteService'
import { CompletionsService } from 'services/completionsService'
import { AttachService } from 'services/attachService'
import { SettingsService } from 'services/settingsService'
import { ListenersService } from 'services/listenersService'
import { GifProcessingService } from 'services/gifProcessingService'
import { ModulesService } from 'services/modulesService'
import { SendMessageService } from 'services/sendMessageService'
import { CurrentVersionInfo } from 'interfaces/currentVersionInfo'
import ZeresPluginLibrary from 'interfaces/zeresPluginLibrary'
import { HtmlService } from 'services/htmlService'
import { ExtendedMeta } from 'interfaces/extendedMeta'

export class EmoteReplacerPlugin implements Plugin {
  settingsService: SettingsService | undefined
  emoteService: EmoteService | undefined
  completionsService: CompletionsService | undefined
  attachService: AttachService | undefined
  listenersService: ListenersService | undefined
  gifProcessingService: GifProcessingService | undefined
  modulesService: ModulesService | undefined
  sendMessageService: SendMessageService | undefined
  htmlService: HtmlService | undefined

  public meta: ExtendedMeta
  private updateInterval: ReturnType<typeof setInterval> | undefined

  constructor (meta: ExtendedMeta) {
    this.meta = meta
    setLogger(meta.name)
  }

  start (): void {
    this.doStart().catch((error) => {
      Logger.error(error)
    })
  }

  private async doStart (): Promise<void> {
    const zeresPluginLibrary = (window as unknown as BdWindow).ZeresPluginLibrary

    this.showChangelogIfNeeded(zeresPluginLibrary)
    await this.startServicesAndPatches()
  }

  private showChangelogIfNeeded (zeresPluginLibrary: ZeresPluginLibrary): void {
    const currentVersionInfo = (BdApi.Data.load(
      this.meta.name, CURRENT_VERSION_INFO_KEY
    ) as CurrentVersionInfo) ?? {}

    if (
      currentVersionInfo.hasShownChangelog !== true ||
      currentVersionInfo.version !== this.meta.version
    ) {
      zeresPluginLibrary.Modals.showChangelogModal(
        `${this.meta.name} Changelog`,
        this.meta.version,
        PLUGIN_CHANGELOG
      )

      const newVersionInfo: CurrentVersionInfo = {
        version: this.meta.version,
        hasShownChangelog: true
      }

      BdApi.Data.save(this.meta.name, CURRENT_VERSION_INFO_KEY, newVersionInfo)
    }
  }

  private async startServicesAndPatches (): Promise<void> {
    const zeresPluginLibrary = (window as unknown as BdWindow).ZeresPluginLibrary

    this.listenersService = new ListenersService(this, zeresPluginLibrary)
    await this.listenersService.start()

    this.settingsService = new SettingsService(this, zeresPluginLibrary)
    await this.settingsService.start(this.listenersService)

    this.modulesService = new ModulesService(this, zeresPluginLibrary)
    await this.modulesService.start()

    this.htmlService = new HtmlService(this, zeresPluginLibrary)
    await this.htmlService.start(this.modulesService)

    this.emoteService = new EmoteService(this, zeresPluginLibrary)
    await this.emoteService.start(this.listenersService, this.settingsService, this.htmlService)

    this.attachService = new AttachService(this, zeresPluginLibrary)
    await this.attachService.start(this.modulesService)

    this.completionsService = new CompletionsService(this, zeresPluginLibrary)
    await this.completionsService.start(
      this.emoteService,
      this.settingsService,
      this.modulesService,
      this.listenersService,
      this.htmlService,
      this.attachService
    )

    this.gifProcessingService = new GifProcessingService(this, zeresPluginLibrary)
    await this.gifProcessingService.start()

    this.sendMessageService = new SendMessageService(this, zeresPluginLibrary)
    await this.sendMessageService.start(
      this.emoteService,
      this.attachService,
      this.modulesService,
      this.settingsService,
      this.gifProcessingService
    )

    const pluginName = this.meta.name

    changeDraftPatch(
      pluginName,
      this.attachService,
      this.completionsService,
      this.emoteService,
      this.modulesService
    )

    pendingReplyPatch(pluginName, this.attachService, this.modulesService)
    emojiSearchPatch(pluginName, this.attachService, this.modulesService)
    lockedEmojisPatch(pluginName, this.attachService, this.modulesService)
  }

  observer (e: MutationRecord) {
    if (!e.addedNodes.length || !(e.addedNodes[0] instanceof Element)) return
    const elem = e.addedNodes[0]

    const modulesService = this.modulesService
    if (!modulesService) return

    const textAreaSelector = this.htmlService?.getClassSelector(
      modulesService.classes.TextArea.textArea
    )

    if (textAreaSelector !== undefined && elem.querySelector(textAreaSelector)) {
      this.listenersService?.requestAddListeners(CompletionsService.TAG)
    }
  }

  onSwitch () {
    this.completionsService?.destroyCompletions()
  }

  getSettingsPanel () {
    return this.settingsService?.getSettingsElement() ?? new HTMLElement()
  }

  stop (): void {
    BdApi.Patcher.unpatchAll(this.meta.name)

    if (this.updateInterval) {
      clearTimeout(this.updateInterval)
      this.updateInterval = undefined
    }

    this.sendMessageService?.stop()
    this.sendMessageService = undefined

    this.gifProcessingService?.stop()
    this.gifProcessingService = undefined

    this.completionsService?.stop()
    this.completionsService = undefined

    this.attachService?.stop()
    this.attachService = undefined

    this.emoteService?.stop()
    this.emoteService = undefined

    this.htmlService?.stop()
    this.htmlService = undefined

    this.modulesService?.stop()
    this.modulesService = undefined

    this.settingsService?.stop()
    this.settingsService = undefined

    this.listenersService?.stop()
    this.listenersService = undefined
  }
}
