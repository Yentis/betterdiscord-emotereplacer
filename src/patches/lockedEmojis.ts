import EmojiStore from 'interfaces/modules/emojiStore'
import { AttachService } from 'services/attachService'
import { ModulesService } from 'services/modulesService'

export default function lockedEmojisPatch (
  pluginName: string,
  attachService: AttachService,
  modulesService: ModulesService
): void {
  const emojiStore = modulesService.emojiStore

  BdApi.Patcher.after(
    pluginName,
    emojiStore,
    'getEmojiUnavailableReason',
    (_, _2, result) => onGetEmojiUnavailableReason(result, attachService, modulesService)
  )

  BdApi.Patcher.after(
    pluginName,
    emojiStore,
    'isEmojiDisabled',
    (_, args) => onIsEmojiDisabled(args, emojiStore)
  )
}

function onGetEmojiUnavailableReason (
  result: unknown,
  attachService: AttachService,
  modulesService: ModulesService
): unknown {
  const EmojiDisabledReasons = modulesService.discordConstants.EmojiDisabledReasons

  if (
    (result === EmojiDisabledReasons.PREMIUM_LOCKED ||
     result === EmojiDisabledReasons.GUILD_SUBSCRIPTION_UNAVAILABLE
    ) && attachService.canAttach
  ) {
    result = null
  }

  return result
}

function onIsEmojiDisabled (args: unknown[], emojiStore: EmojiStore): boolean {
  const [emoji, channel, intention] = args

  const reason = emojiStore.getEmojiUnavailableReason({
    emoji,
    channel,
    intention
  })

  return reason !== null
}
