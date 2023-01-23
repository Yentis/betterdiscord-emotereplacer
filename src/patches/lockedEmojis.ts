import Emoji from 'interfaces/emoji'
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
    (_, args, result) => onGetEmojiUnavailableReason(args, result, attachService, modulesService)
  )

  BdApi.Patcher.after(
    pluginName,
    emojiStore,
    'isEmojiDisabled',
    (_, args) => onIsEmojiDisabled(args, emojiStore)
  )
}

function onGetEmojiUnavailableReason (
  args: unknown[],
  result: unknown,
  attachService: AttachService,
  modulesService: ModulesService
): unknown {
  if (!attachService.canAttach) return result
  const EmojiDisabledReasons = modulesService.emojiDisabledReasons
  const options = args[0] as { emoji?: Emoji, intention?: number } | undefined

  const isReactIntention = options?.intention === 0
  if (isReactIntention) return result

  if (result === EmojiDisabledReasons.DISALLOW_EXTERNAL) {
    const emojiId = options?.emoji?.id
    if (emojiId === undefined) return result

    attachService.externalEmotes.add(emojiId)
    result = null
  } else if (
    result === EmojiDisabledReasons.PREMIUM_LOCKED ||
    result === EmojiDisabledReasons.GUILD_SUBSCRIPTION_UNAVAILABLE
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
