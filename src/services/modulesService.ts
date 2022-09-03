import ChannelStore from 'interfaces/modules/channelStore'
import Classes, { AutocompleteAttached } from 'interfaces/modules/classes'
import ComponentDispatcher from 'interfaces/modules/componentDispatcher'
import { DeletePendingReply } from 'interfaces/modules/deletePendingReply'
import DiscordConstants from 'interfaces/modules/discordConstants'
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
  deletePendingReply!: DeletePendingReply
  emojiStore!: EmojiStore
  emojiSearch!: EmojiSearch
  discordConstants!: DiscordConstants
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
      deletePendingReply,
      emojiStore,
      emojiSearch,
      discordConstants,
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
        filter: BdApi.Webpack.Filters.byProps('Permissions', 'ActivityTypes', 'StatusTypes')
      }, {
        filter: BdApi.Webpack.Filters.byProps('dispatch', 'subscribe')
      }, {
        filter: BdApi.Webpack.Filters.byProps('ComponentDispatch')
      }, {
        filter: BdApi.Webpack.Filters.byProps('deletePendingReply')
      }, {
        filter: BdApi.Webpack.Filters.byProps('getEmojiUnavailableReason')
      }, {
        filter: BdApi.Webpack.Filters.byProps('getDisambiguatedEmojiContext')
      }, {
        filter: BdApi.Webpack.Filters.byProps('EmojiDisabledReasons')
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
      DeletePendingReply,
      EmojiStore,
      EmojiSearch,
      DiscordConstants,
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
    this.deletePendingReply = deletePendingReply
    this.emojiSearch = emojiSearch
    this.discordConstants = discordConstants
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
