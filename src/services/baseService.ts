import { EmoteReplacerPlugin } from 'classes/emoteReplacerPlugin'
import ZeresPluginLibrary from 'interfaces/zeresPluginLibrary'

export abstract class BaseService {
  plugin: EmoteReplacerPlugin
  zeresPluginLibrary: ZeresPluginLibrary

  constructor (plugin: EmoteReplacerPlugin, zeresPluginLibrary: ZeresPluginLibrary) {
    this.plugin = plugin
    this.zeresPluginLibrary = zeresPluginLibrary
  }

  public abstract start (...args: unknown[]): Promise<void>

  public abstract stop (): void
}
