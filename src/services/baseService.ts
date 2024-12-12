import EmoteReplacerPlugin from '../index';
import { BoundBdApiExtended } from '../interfaces/bdapi';

export abstract class BaseService {
  plugin: EmoteReplacerPlugin;
  bdApi: BoundBdApiExtended;
  logger: BoundBdApiExtended['Logger'];

  constructor(plugin: EmoteReplacerPlugin) {
    this.plugin = plugin;
    this.bdApi = this.plugin.bdApi;
    this.logger = this.bdApi.Logger;
  }

  public abstract start(...args: unknown[]): Promise<void>;

  public abstract stop(): void;
}
