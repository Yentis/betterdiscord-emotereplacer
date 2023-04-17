import { PendingReply } from 'interfaces/pendingReply'
import { BaseService } from './baseService'
import { ModulesService } from './modulesService'

export class AttachService extends BaseService {
  modulesService!: ModulesService

  canAttach = false
  externalEmotes = new Set<string>()
  userId?: string
  curChannelId?: string

  pendingUpload?: Promise<void>
  pendingReply?: PendingReply

  onMessagesLoaded: ((data: { channelId: string }) => void) | undefined
  onChannelSelect: ((data: { channelId: string }) => void) | undefined

  public async start (modulesService: ModulesService): Promise<void> {
    this.modulesService = modulesService
    this.userId = await this.getUserId()
  }

  private getUserId (): Promise<string> {
    return new Promise((resolve) => {
      const getCurrentUser = this.modulesService.userStore.getCurrentUser
      let user = getCurrentUser()

      if (user) {
        resolve(user.id)
        return
      }

      // Not fully booted yet, wait for channel messages to load
      this.onMessagesLoaded = () => {
        user = getCurrentUser()
        const userId = user?.id ?? ''

        if (this.onMessagesLoaded) {
          this.modulesService.dispatcher.unsubscribe('LOAD_MESSAGES_SUCCESS', this.onMessagesLoaded)
          this.onMessagesLoaded = undefined
        }

        if (!userId) return
        resolve(userId)
      }

      this.modulesService.dispatcher.subscribe('LOAD_MESSAGES_SUCCESS', this.onMessagesLoaded)
    })
  }

  public setCanAttach (_channelId: string | undefined): void {
    if (_channelId !== undefined && _channelId === this.curChannelId) return
    this.externalEmotes.clear()

    const channelId = _channelId ?? ''
    this.curChannelId = channelId

    if (!channelId) {
      this.canAttach = true
      return
    }

    if (this.userId === undefined) {
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

    const permissions = this.modulesService.discordPermissions
    this.canAttach = this.modulesService.permissions.can(
      permissions.ATTACH_FILES,
      channel,
      this.userId
    )
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
