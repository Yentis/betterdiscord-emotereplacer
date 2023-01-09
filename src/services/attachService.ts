import { PendingReply } from 'interfaces/pendingReply'
import { BaseService } from './baseService'
import { ModulesService } from './modulesService'

export class AttachService extends BaseService {
  modulesService!: ModulesService

  canAttach = false
  pendingUpload?: Promise<void>
  pendingReply?: PendingReply

  onMessagesLoaded: ((data: { channelId: string }) => void) | undefined
  onChannelSelect: ((data: { channelId: string }) => void) | undefined

  public async start (modulesService: ModulesService): Promise<void> {
    this.modulesService = modulesService

    const userId = await this.getUserId()
    this.initChannelSubscription(userId)
  }

  private getUserId (): Promise<string> {
    return new Promise((resolve) => {
      const getCurrentUser = this.modulesService.userStore.getCurrentUser
      let user = getCurrentUser()

      if (user) {
        const userId = user.id
        this.setCanAttach(this.modulesService.selectedChannelStore.getChannelId(), userId)

        resolve(userId)
        return
      }

      // Not fully booted yet, wait for channel messages to load
      this.onMessagesLoaded = (data) => {
        user = getCurrentUser()
        const userId = user?.id ?? ''

        if (this.onMessagesLoaded) {
          this.modulesService.dispatcher.unsubscribe('LOAD_MESSAGES_SUCCESS', this.onMessagesLoaded)
          this.onMessagesLoaded = undefined
        }

        if (!userId) return
        this.setCanAttach(data.channelId, userId)

        resolve(userId)
      }
      this.modulesService.dispatcher.subscribe('LOAD_MESSAGES_SUCCESS', this.onMessagesLoaded)
    })
  }

  private setCanAttach (_channelId: string | undefined, userId: string): void {
    const channelId = _channelId ?? ''
    if (!channelId) {
      this.canAttach = true
      return
    }

    const channel = this.modulesService.channelStore.getChannel(channelId)
    if (!channel) {
      this.canAttach = true
      return
    }

    const guildId = channel.guild_id ?? ''
    if (!guildId) {
      this.canAttach = true
      return
    }

    const attachFilesPermission = this.modulesService.discordPermissions.ATTACH_FILES
    this.canAttach = this.modulesService.permissions.can(attachFilesPermission, channel, userId)
  }

  private initChannelSubscription (userId: string): void {
    this.onChannelSelect = (data) => {
      this.setCanAttach(data.channelId, userId)
    }
    this.modulesService.dispatcher.subscribe('CHANNEL_SELECT', this.onChannelSelect)
  }

  public stop (): void {
    if (this.onMessagesLoaded) {
      this.modulesService.dispatcher.unsubscribe('LOAD_MESSAGES_SUCCESS', this.onMessagesLoaded)
      this.onMessagesLoaded = undefined
    }

    if (this.onChannelSelect) {
      this.modulesService.dispatcher.unsubscribe('CHANNEL_SELECT', this.onChannelSelect)
      this.onChannelSelect = undefined
    }

    this.canAttach = false
    this.pendingUpload = undefined
  }
}
