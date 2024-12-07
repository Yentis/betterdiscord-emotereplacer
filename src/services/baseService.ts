import EmoteReplacerPlugin from '../index'

export abstract class BaseService {
  plugin: EmoteReplacerPlugin

  constructor (plugin: EmoteReplacerPlugin) {
    this.plugin = plugin
  }

  public abstract start (...args: unknown[]): Promise<void>

  public abstract stop (): void
}
