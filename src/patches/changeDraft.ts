import { AttachService } from 'services/attachService'
import { CompletionsService } from 'services/completionsService'
import { EmoteService } from 'services/emoteService'
import { ModulesService } from 'services/modulesService'
import { Logger } from '../utils/logger'

export default function changeDraftPatch (
  pluginName: string,
  attachService: AttachService,
  completionsService: CompletionsService,
  emoteService: EmoteService,
  modulesService: ModulesService
): void {
  BdApi.Patcher.before(
    pluginName,
    modulesService.draft,
    'changeDraft',
    (_, args) => onChangeDraft(args, attachService, completionsService, emoteService)
  )
}

function onChangeDraft (
  args: unknown[],
  attachService: AttachService,
  completionsService: CompletionsService,
  emoteService: EmoteService
): void {
  const channelId = args[0] as string | undefined
  if (channelId !== undefined) attachService.setCanAttach(channelId)
  if (!attachService.canAttach) return

  const draft = args[1] as string | undefined
  if (draft === undefined) return
  completionsService.draft = draft

  try {
    const lastText = completionsService.cached?.draft

    if (!emoteService.shouldCompleteEmote(draft) && !emoteService.shouldCompleteCommand(draft)) {
      completionsService.destroyCompletions()
      return
    }

    if (lastText !== draft) {
      completionsService.renderCompletions()
    }
  } catch (err) {
    Logger.warn('Error in onChangeDraft', err)
  }
}
