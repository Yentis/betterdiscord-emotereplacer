import ChannelStore from 'interfaces/modules/channelStore';
import Classes from 'interfaces/modules/classes';
import ComponentDispatcher from 'interfaces/modules/componentDispatcher';
import EmojiDisabledReasons from 'interfaces/modules/emojiDisabledReasons';
import DiscordPermissions from 'interfaces/modules/discordPermissions';
import Dispatcher from 'interfaces/modules/dispatcher';
import Draft from 'interfaces/modules/draft';
import { EmojiSearch } from 'interfaces/modules/emojiSearch';
import EmojiStore from 'interfaces/modules/emojiStore';
import { MessageStore } from 'interfaces/modules/messageStore';
import Permissions from 'interfaces/modules/permissions';
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
  draft!: Draft;
  draftStore!: DraftStore;
  permissions!: Permissions;
  discordPermissions!: DiscordPermissions;
  dispatcher!: Dispatcher;
  componentDispatcher!: ComponentDispatcher;
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

  private classMapping = {
    TextArea: {
      channelTextArea: 'channelTextArea_',
      textArea: 'textArea_',
    },
    Editor: {
      editor: 'editor_',
      placeholder: 'placeholder_',
    },
    Autocomplete: {
      autocomplete: 'autocomplete_',
      autocompleteInner: 'autocompleteInner_',
      autocompleteRowContent: 'autocompleteRowContent_',
      autocompleteRowContentPrimary: 'autocompleteRowContentPrimary_',
      autocompleteRowIcon: 'autocompleteRowIcon_',
      autocompleteRowVertical: 'autocompleteRowVertical_',
      autocompleteRowVerticalSmall: 'autocompleteRowVerticalSmall_',
      base: 'base_',
      contentTitle: 'contentTitle_',
      clickable: 'clickable_',
      emojiImage: 'emojiImage_',
    },
    Autocomplete2: {
      autocomplete: 'autocomplete_',
      autocompleteInner: 'autocompleteInner_',
      autocompleteAttached: 'autocompleteAttached_',
      scroller: 'scroller_',
    },
  };

  public start(): Promise<void> {
    this.channelStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('getChannel', 'hasChannel')
    );

    this.draft = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byKeys('changeDraft'));

    this.draftStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('getDraft', 'getRecentlyEditedDrafts')
    );

    this.permissions = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('getChannelPermissions')
    );

    this.discordPermissions = this.getModule(
      (module: Record<string, unknown>) => {
        return typeof module.CREATE_INSTANT_INVITE === 'bigint';
      },
      { searchExports: true }
    );

    this.dispatcher = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('dispatch', 'subscribe'),
      { searchExports: true }
    );

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

    this.emojiStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('getEmojiUnavailableReason')
    );

    this.emojiSearch = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('getDisambiguatedEmojiContext')
    );

    this.emojiDisabledReasons = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('PREMIUM_LOCKED'),
      { searchExports: true }
    );

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
    });

    this.stickerFormatType = this.getModule(
      (module: Record<string | number, unknown>) => {
        return module.LOTTIE !== undefined && module.GIF !== undefined && module[1] !== undefined;
      },
      { searchExports: true }
    );

    this.stickerStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byKeys('getStickerById', 'getStickersByGuildId')
    );

    this.userStore = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byKeys('getCurrentUser'));
    this.messageStore = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byKeys('sendMessage'));

    this.CloudUploader = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byStrings('uploadFileToCloud'),
      { searchExports: true }
    );

    const TextArea = this.getClassNames('TextArea', this.classMapping.TextArea);
    const Editor = this.getClassNames('Editor', this.classMapping.Editor);
    const Autocomplete = this.getClassNames('Autocomplete', this.classMapping.Autocomplete);
    const Autocomplete2 = this.getClassNames('Autocomplete2', this.classMapping.Autocomplete2);

    this.classes = {
      TextArea,
      Editor,
      Autocomplete,
      Util: {
        autocomplete: [
          Autocomplete2?.autocomplete,
          Autocomplete2?.autocompleteAttached,
          Autocomplete?.autocomplete,
        ].join(' '),
        autocompleteInner: [Autocomplete?.autocompleteInner, Autocomplete2.autocompleteInner].join(
          ' '
        ),
      },
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
    }, searchOptions);
  }

  private getClassNames<T extends Record<string, string>>(name: string, classMapping: T): T {
    const module: Record<string, string> = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.bySource(...Object.values(classMapping))
    );
    if (module === undefined) this.logger.error(`${name} not found!`);

    const classNames: Record<string, string> = {};
    Object.values(module).forEach((value) => {
      Object.entries(classMapping).forEach(([key, mapping]) => {
        if (!value.startsWith(mapping)) return;
        classNames[key] = value;
      });
    });

    return classNames as T;
  }

  public stop(): void {
    // Do nothing
  }
}
