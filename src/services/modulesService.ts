import ChannelStore from 'interfaces/modules/channelStore'
import Classes, { AutocompleteAttached } from 'interfaces/modules/classes'
import ComponentDispatcher from 'interfaces/modules/componentDispatcher'
import { PendingReplyDispatcher } from 'interfaces/modules/pendingReplyDispatcher'
import EmojiDisabledReasons from 'interfaces/modules/emojiDisabledReasons'
import DiscordPermissions from 'interfaces/modules/discordPermissions'
import Dispatcher from 'interfaces/modules/dispatcher'
import Draft from 'interfaces/modules/draft'
import { EmojiSearch } from 'interfaces/modules/emojiSearch'
import EmojiStore from 'interfaces/modules/emojiStore'
import { MessageStore } from 'interfaces/modules/messageStore'
import Permissions from 'interfaces/modules/permissions'
import Uploader from 'interfaces/modules/uploader'
import UserStore from 'interfaces/modules/userStore'
import { BaseService } from './baseService'
import { CloudUploader } from 'interfaces/modules/cloudUploader'
import DraftStore from 'interfaces/modules/draftStore'
import { StickerSendable } from 'interfaces/modules/stickerSendable'
import {
  StickerFormatType,
  StickerSendableType,
  StickerType
} from 'interfaces/modules/stickerTypes'
import { BaseSearchOptions, ModuleFilter } from 'betterdiscord'
import { StickerStore } from 'interfaces/modules/stickerStore'
import { Sticker } from 'interfaces/sticker'
import Channel from 'interfaces/channel'

export class ModulesService extends BaseService {
  channelStore!: ChannelStore
  uploader!: Uploader
  draft!: Draft
  draftStore!: DraftStore
  permissions!: Permissions
  discordPermissions!: DiscordPermissions
  dispatcher!: Dispatcher
  componentDispatcher!: ComponentDispatcher
  pendingReplyDispatcher: PendingReplyDispatcher = {}
  emojiStore!: EmojiStore
  emojiSearch!: EmojiSearch
  emojiDisabledReasons!: EmojiDisabledReasons
  stickerSendable: StickerSendable = {}
  stickerType!: StickerType
  stickerSendableType!: StickerSendableType
  stickerFormatType!: StickerFormatType
  stickerStore!: StickerStore
  userStore!: UserStore
  messageStore!: MessageStore
  classes!: Classes
  cloudUploader!: CloudUploader

  public start (): Promise<void> {
    this.channelStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('getChannel', 'hasChannel')
    ) as ChannelStore

    this.uploader = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('instantBatchUpload')
    ) as Uploader

    this.draft = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('changeDraft')
    ) as Draft

    this.draftStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('getDraft', 'getRecentlyEditedDrafts')
    ) as DraftStore

    this.permissions = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('getChannelPermissions')
    ) as Permissions

    this.discordPermissions = this.getModule((module: Record<string, unknown>) => {
      return typeof module.CREATE_INSTANT_INVITE === 'bigint'
    }, { searchExports: true })

    this.dispatcher = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('dispatch', 'subscribe')
    ) as Dispatcher

    this.componentDispatcher = this.getModule((module: Record<string, unknown>) => {
      if (module.dispatchToLastSubscribed !== undefined) {
        const componentDispatcher = (module as unknown) as ComponentDispatcher
        return componentDispatcher.emitter.listeners('SHAKE_APP').length > 0
      }

      return false
    }, { searchExports: true })

    this.pendingReplyDispatcher.module = this.getModule(
      (module: Record<string, (() => string) | undefined>) => {
        Object.entries(module).forEach(([key, value]) => {
          if (!(typeof value === 'function')) return
          const valueString = value.toString()

          if (valueString.includes('DELETE_PENDING_REPLY')) {
            this.pendingReplyDispatcher.deletePendingReplyKey = key
          } else if (valueString.includes('CREATE_PENDING_REPLY')) {
            this.pendingReplyDispatcher.createPendingReplyKey = key
          } else if (valueString.includes('SET_PENDING_REPLY_SHOULD_MENTION')) {
            this.pendingReplyDispatcher.setPendingReplyShouldMentionKey = key
          }
        })

        return this.pendingReplyDispatcher.deletePendingReplyKey !== undefined
      }
    )

    this.emojiStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('getEmojiUnavailableReason')
    ) as EmojiStore

    this.emojiSearch = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('getDisambiguatedEmojiContext')
    ) as EmojiSearch

    this.emojiDisabledReasons = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('PREMIUM_LOCKED'), { searchExports: true }
    ) as EmojiDisabledReasons

    this.stickerSendable.module = this.getModule(
      (module: Record<string, (() => string) | Record<string, unknown> | undefined>) => {
        Object.entries(module).forEach(([key, value]) => {
          if (typeof value === 'object') {
            if (value.SENDABLE_WITH_PREMIUM === undefined) return
            this.stickerSendable.stickerSendableType = value as unknown as StickerSendableType
          }

          if (typeof value !== 'function') return
          const valueString = value.toString()

          if (valueString.includes('canUseStickersEverywhere')) {
            this.stickerSendable.stickerSuggestionKey = key
          } else if (valueString.includes('SENDABLE')) {
            this.stickerSendable.stickerSendableKey = key
            this.stickerSendable.stickerSendable = module[key] as unknown as (
              sticker: Sticker,
              userId: string,
              channel: Channel
            ) => boolean
          }
        })

        return this.stickerSendable.stickerSendableKey !== undefined
      }
    )

    this.stickerType = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('STANDARD', 'GUILD'), { searchExports: true }
    ) as StickerType

    this.stickerFormatType = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('LOTTIE', 'GIF', 'APNG'), { searchExports: true }
    ) as StickerFormatType

    this.stickerStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('getStickerById', 'getStickersByGuildId')
    ) as StickerStore

    this.userStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('getCurrentUser')
    ) as UserStore

    this.messageStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('sendMessage')
    ) as MessageStore

    this.cloudUploader = this.getModule((module: Record<string, unknown>) => {
      return Object.values(module).some((value) => {
        if (typeof value !== 'object' || value === null) return false
        const curValue = value as Record<string, unknown>

        return curValue.NOT_STARTED !== undefined &&
                curValue.UPLOADING !== undefined &&
                module.n !== undefined
      })
    })

    const TextArea = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('channelTextArea', 'textAreaHeight')
    ) as Classes['TextArea']

    const Editor = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('editor', 'placeholder')
    ) as Classes['Editor']

    const Autocomplete = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps(
        'autocomplete',
        'autocompleteInner',
        'autocompleteRowVertical'
      )
    ) as Classes['Autocomplete']

    const autocompleteAttached = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('autocomplete', 'autocompleteAttached')
    ) as AutocompleteAttached

    const Wrapper = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('wrapper', 'base')
    ) as Classes['Wrapper']

    const Size = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('size12')
    ) as Classes['Size']

    this.classes = {
      TextArea,
      Editor,

      Autocomplete: {
        ...Autocomplete,
        autocomplete: [
          autocompleteAttached?.autocomplete,
          autocompleteAttached?.autocompleteAttached,
          Autocomplete?.autocomplete
        ].join(' ')
      },

      Wrapper,
      Size
    }

    return Promise.resolve()
  }

  private getModule<T> (filter: ModuleFilter, searchOptions?: BaseSearchOptions): T {
    return BdApi.Webpack.getModule((...args) => {
      try {
        return filter(...args)
      } catch (ignored) {
        return false
      }
    }, searchOptions) as T
  }

  public stop (): void {
    // Do nothing
  }
}
