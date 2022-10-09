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
import SelectedChannelStore from 'interfaces/modules/selectedChannelStore'
import Uploader from 'interfaces/modules/uploader'
import UserStore from 'interfaces/modules/userStore'
import { BaseService } from './baseService'

export class ModulesService extends BaseService {
  selectedChannelStore!: SelectedChannelStore
  channelStore!: ChannelStore
  uploader!: Uploader
  draft!: Draft
  permissions!: Permissions
  discordPermissions!: DiscordPermissions
  dispatcher!: Dispatcher
  componentDispatcher!: ComponentDispatcher
  pendingReplyDispatcher: PendingReplyDispatcher = {}
  emojiStore!: EmojiStore
  emojiSearch!: EmojiSearch
  emojiDisabledReasons!: EmojiDisabledReasons
  userStore!: UserStore
  messageStore!: MessageStore
  classes!: Classes

  public start (): Promise<void> {
    const [
      selectedChannelStore,
      channelStore,
      uploader,
      draft,
      permissions,
      discordPermissions,
      dispatcher,
      componentDispatcher,
      pendingReplyModule,
      emojiStore,
      emojiSearch,
      emojiDisabledReasons,
      userStore,
      messageStore,
      TextArea,
      Autocomplete,
      autocompleteAttached,
      Wrapper,
      Size
    ] = BdApi.Webpack.getBulk(
      {
        filter: BdApi.Webpack.Filters.byProps('getChannelId', 'getVoiceChannelId')
      }, {
        filter: BdApi.Webpack.Filters.byProps('getChannel', 'hasChannel')
      }, {
        filter: BdApi.Webpack.Filters.byProps('instantBatchUpload')
      }, {
        filter: BdApi.Webpack.Filters.byProps('changeDraft')
      }, {
        filter: BdApi.Webpack.Filters.byProps('getChannelPermissions')
      }, {
        filter: (module: Record<string, unknown>) => {
          return typeof module.CREATE_INSTANT_INVITE === 'bigint'
        },
        searchExports: true
      }, {
        filter: BdApi.Webpack.Filters.byProps('dispatch', 'subscribe')
      }, {
        filter: (module: Record<string, unknown>) => {
          if (module.dispatchToLastSubscribed !== undefined) {
            const componentDispatcher = (module as unknown) as ComponentDispatcher
            return componentDispatcher.emitter.listeners('SHAKE_APP').length > 0
          }

          return false
        },
        searchExports: true
      }, {
        filter: (module: Record<string, (() => string) | undefined>) => {
          const deletePendingReply = Object.entries(module).find(([_key, value]) => {
            if (!(typeof value === 'function')) return false
            const valueString: string = value.toString()
            return valueString.includes('DELETE_PENDING_REPLY')
          })

          if (deletePendingReply) this.pendingReplyDispatcher.key = deletePendingReply[0]
          return !!deletePendingReply
        }
      }, {
        filter: BdApi.Webpack.Filters.byProps('getEmojiUnavailableReason')
      }, {
        filter: BdApi.Webpack.Filters.byProps('getDisambiguatedEmojiContext')
      }, {
        filter: BdApi.Webpack.Filters.byProps('PREMIUM_LOCKED'),
        searchExports: true
      }, {
        filter: BdApi.Webpack.Filters.byProps('getCurrentUser')
      }, {
        filter: BdApi.Webpack.Filters.byProps('sendMessage')
      }, {
        filter: BdApi.Webpack.Filters.byProps('channelTextArea', 'textAreaHeight')
      }, {
        filter: BdApi.Webpack.Filters.byProps(
          'autocomplete',
          'autocompleteInner',
          'autocompleteRowVertical'
        )
      }, {
        filter: BdApi.Webpack.Filters.byProps('autocomplete', 'autocompleteAttached')
      }, {
        filter: BdApi.Webpack.Filters.byProps('wrapper', 'base')
      }, {
        filter: BdApi.Webpack.Filters.byProps('size12')
      }
    ) as [
      SelectedChannelStore,
      ChannelStore,
      Uploader,
      Draft,
      Permissions,
      DiscordPermissions,
      Dispatcher,
      ComponentDispatcher,
      Record<string, unknown>,
      EmojiStore,
      EmojiSearch,
      EmojiDisabledReasons,
      UserStore,
      MessageStore,
      Classes['TextArea'],
      Classes['Autocomplete'],
      AutocompleteAttached,
      Classes['Wrapper'],
      Classes['Size']
    ]

    this.selectedChannelStore = selectedChannelStore
    this.channelStore = channelStore
    this.uploader = uploader
    this.draft = draft
    this.permissions = permissions
    this.discordPermissions = discordPermissions
    this.dispatcher = dispatcher
    this.componentDispatcher = componentDispatcher
    this.pendingReplyDispatcher.module = pendingReplyModule
    this.emojiSearch = emojiSearch
    this.emojiDisabledReasons = emojiDisabledReasons
    this.emojiStore = emojiStore
    this.userStore = userStore
    this.messageStore = messageStore

    this.classes = {
      TextArea,

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

  public stop (): void {
    // Do nothing
  }
}
