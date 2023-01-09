import { PendingReply } from 'interfaces/pendingReply'
import { AttachService } from 'services/attachService'
import { ModulesService } from 'services/modulesService'
import { Logger } from '../utils/logger'

export default function pendingReplyPatch (
  pluginName: string,
  attachService: AttachService,
  modulesService: ModulesService
): void {
  const pendingReplyDispatcher = modulesService.pendingReplyDispatcher

  const createPendingReply = pendingReplyDispatcher.createPendingReplyKey
  if (createPendingReply === undefined) {
    Logger.warn('Create pending reply function name not found')
    return
  }

  const deletePendingReply = pendingReplyDispatcher.deletePendingReplyKey
  if (deletePendingReply === undefined) {
    Logger.warn('Delete pending reply function name not found')
    return
  }

  BdApi.Patcher.before(
    pluginName,
    pendingReplyDispatcher.module,
    createPendingReply as never,
    (_, args) => {
      if (!args[0]) return
      const reply = args[0] as PendingReply

      attachService.pendingReply = reply
    }
  )

  BdApi.Patcher.instead(
    pluginName,
    pendingReplyDispatcher.module,
    deletePendingReply as never,
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
  } finally {
    attachService.pendingReply = undefined
  }
}
