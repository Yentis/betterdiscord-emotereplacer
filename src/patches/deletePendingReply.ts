import { AttachService } from 'services/attachService'
import { ModulesService } from 'services/modulesService'
import { Logger } from '../utils/logger'

export default function deletePendingReplyPatch (
  pluginName: string,
  attachService: AttachService,
  modulesService: ModulesService
): void {
  BdApi.Patcher.instead(
    pluginName,
    modulesService.deletePendingReply,
    'deletePendingReply',
    (_, args, original) => onDeletePendingReply(args, original, attachService)
  )
}

async function onDeletePendingReply (
  args: unknown[],
  original: unknown,
  attachService: AttachService
): Promise<void> {
  const callDefault = original as (...args: unknown[]) => unknown

  try {
    // Prevent Discord from deleting the pending reply until our emote has been uploaded
    if (attachService.pendingUpload) await attachService.pendingUpload
    callDefault(...args)
  } catch (err) {
    Logger.warn('Error in onDeletePendingReply', err)
  }
}
