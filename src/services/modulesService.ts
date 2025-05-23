import ChannelStore from 'interfaces/modules/channelStore';
import Classes, { AutocompleteAttached } from 'interfaces/modules/classes';
import ComponentDispatcher from 'interfaces/modules/componentDispatcher';
import { PendingReplyDispatcher } from 'interfaces/modules/pendingReplyDispatcher';
import EmojiDisabledReasons from 'interfaces/modules/emojiDisabledReasons';
import DiscordPermissions from 'interfaces/modules/discordPermissions';
import Dispatcher from 'interfaces/modules/dispatcher';
import Draft from 'interfaces/modules/draft';
import { EmojiSearch } from 'interfaces/modules/emojiSearch';
import EmojiStore from 'interfaces/modules/emojiStore';
import { MessageStore } from 'interfaces/modules/messageStore';
import Permissions from 'interfaces/modules/permissions';
import Uploader from 'interfaces/modules/uploader';
import UserStore from 'interfaces/modules/userStore';
import { BaseService } from './baseService';
import { CloudUpload } from 'interfaces/modules/cloudUploader';
import DraftStore from 'interfaces/modules/draftStore';
import {
  StickerFormatType,
  StickerSendableType,
  StickerType,
} from 'interfaces/modules/stickerTypes';
import { BaseSearchOptions, ModuleFilter } from 'betterdiscord';
import { StickerStore } from 'interfaces/modules/stickerStore';
import {
  StickerSendabilityStore,
  stickerSendableFunc,
} from 'interfaces/modules/stickerSendabilityStore';

export class ModulesService extends BaseService {
  channelStore!: ChannelStore;
  uploader!: Uploader;
  draft!: Draft;
  draftStore!: DraftStore;
  permissions!: Permissions;
  discordPermissions!: DiscordPermissions;
  dispatcher!: Dispatcher;
  componentDispatcher!: ComponentDispatcher;
  pendingReplyDispatcher: PendingReplyDispatcher = {};
  emojiStore!: EmojiStore;
  emojiSearch!: EmojiSearch;
  emojiDisabledReasons!: EmojiDisabledReasons;
  stickerSendabilityStore!: StickerSendabilityStore;
  stickerType!: StickerType;
  stickerFormatType!: StickerFormatType;
  stickerStore!: StickerStore;
  userStore!: UserStore;
  messageStore!: MessageStore;
  classes!: Classes;
  CloudUploader!: CloudUpload;

  public start(): Promise<void> {
    this.channelStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('getChannel', 'hasChannel')
    ) as ChannelStore;

    this.uploader = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('uploadFiles')
    ) as Uploader;

    this.draft = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byKeys('changeDraft')) as Draft;

    this.draftStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('getDraft', 'getRecentlyEditedDrafts')
    ) as DraftStore;

    this.permissions = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('getChannelPermissions')
    ) as Permissions;

    this.discordPermissions = this.getModule(
      (module: Record<string, unknown>) => {
        return typeof module.CREATE_INSTANT_INVITE === 'bigint';
      },
      { searchExports: true }
    );

    this.dispatcher = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('dispatch', 'subscribe')
    ) as Dispatcher;

    this.componentDispatcher = this.getModule(
      (module: Record<string, unknown>) => {
        if (module.dispatchToLastSubscribed !== undefined) {
          const componentDispatcher = module as unknown as ComponentDispatcher;
          return componentDispatcher.emitter.listeners('SHAKE_APP').length > 0;
        }

        return false;
      },
      { searchExports: true }
    );

    this.pendingReplyDispatcher.module = this.getModule(
      (module: Record<string, (() => string) | undefined>) => {
        Object.entries(module).forEach(([key, value]) => {
          if (!(typeof value === 'function')) return;
          const valueString = value.toString();

          if (valueString.includes('DELETE_PENDING_REPLY')) {
            this.pendingReplyDispatcher.deletePendingReplyKey = key;
          } else if (valueString.includes('CREATE_PENDING_REPLY')) {
            this.pendingReplyDispatcher.createPendingReplyKey = key;
          } else if (valueString.includes('SET_PENDING_REPLY_SHOULD_MENTION')) {
            this.pendingReplyDispatcher.setPendingReplyShouldMentionKey = key;
          }
        });

        return this.pendingReplyDispatcher.deletePendingReplyKey !== undefined;
      }
    );

    if (this.pendingReplyDispatcher.module === undefined) {
      this.logger.error('pendingReplyDispatcher module not found!');
    }

    this.emojiStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('getEmojiUnavailableReason')
    ) as EmojiStore;

    this.emojiSearch = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('getDisambiguatedEmojiContext')
    ) as EmojiSearch;

    this.emojiDisabledReasons = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('PREMIUM_LOCKED'),
      { searchExports: true }
    ) as EmojiDisabledReasons;

    const [module] = BdApi.Webpack.getWithKey(
      BdApi.Webpack.Filters.byStrings('canUseCustomStickersEverywhere')
    ) as [Record<string, unknown>, string];

    this.stickerSendabilityStore = {
      module,
    };

    const entries = Object.entries(module);
    entries.forEach(([key, value], index) => {
      if (index >= 3) return;

      if ('SENDABLE_WITH_PREMIUM' in (value as Record<string, unknown>)) {
        this.stickerSendabilityStore.StickerSendability = value as StickerSendableType;
      } else if (
        typeof value === 'function' &&
        value.toString().includes('canUseCustomStickersEverywhere')
      ) {
        this.stickerSendabilityStore.getStickerSendabilityKey = key;
      } else {
        this.stickerSendabilityStore.isSendableSticker = {
          key,
          method: value as stickerSendableFunc,
        };
      }
    });

    Object.entries(this.stickerSendabilityStore).forEach(([key, value]) => {
      if (value !== undefined) return;
      this.logger.error(`${key} not found!`);
    });

    this.stickerType = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byKeys('STANDARD', 'GUILD'), {
      searchExports: true,
    }) as StickerType;

    this.stickerFormatType = this.getModule(
      (module: Record<string | number, unknown>) => {
        return module.LOTTIE !== undefined && module.GIF !== undefined && module[1] !== undefined;
      },
      { searchExports: true }
    );

    this.stickerStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('getStickerById', 'getStickersByGuildId')
    ) as StickerStore;

    this.userStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('getCurrentUser')
    ) as UserStore;

    this.messageStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('sendMessage')
    ) as MessageStore;

    this.CloudUploader = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byStrings('uploadFileToCloud'),
      { searchExports: true }
    ) as CloudUpload;

    const TextArea = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('channelTextArea', 'textArea')
    ) as Classes['TextArea'];
    if (TextArea === undefined) this.logger.error('TextArea not found!');

    const Editor = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('editor', 'placeholder')
    ) as Classes['Editor'];
    if (Editor === undefined) this.logger.error('Editor not found!');

    const Autocomplete = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('autocomplete', 'autocompleteInner', 'autocompleteRowVertical')
    ) as Classes['Autocomplete'];
    if (Autocomplete === undefined) this.logger.error('Autocomplete not found!');

    const autocompleteAttached = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('autocomplete', 'autocompleteAttached')
    ) as AutocompleteAttached;
    if (autocompleteAttached === undefined) this.logger.error('autocompleteAttached not found!');

    const Wrapper = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('wrapper', 'base')
    ) as Classes['Wrapper'];
    if (Wrapper === undefined) this.logger.error('Wrapper not found!');

    const Size = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byKeys('size12')) as Classes['Size'];
    if (Size === undefined) this.logger.error('Size not found!');

    this.classes = {
      TextArea,
      Editor,

      Autocomplete: {
        ...Autocomplete,
        autocomplete: [
          autocompleteAttached?.autocomplete,
          autocompleteAttached?.autocompleteAttached,
          Autocomplete?.autocomplete,
        ].join(' '),
      },

      Wrapper,
      Size,
    };

    Object.entries(this).forEach(([key, value]) => {
      if (value !== undefined) return;
      this.logger.error(`${key} not found!`);
    });

    return Promise.resolve();
  }

  private getModule<T>(filter: ModuleFilter, searchOptions?: BaseSearchOptions): T {
    return BdApi.Webpack.getModule((...args) => {
      try {
        return filter(...args);
      } catch (ignored) {
        return false;
      }
    }, searchOptions) as T;
  }

  public stop(): void {
    // Do nothing
  }
}
