import { AttachService } from 'services/attachService'
import { ModulesService } from 'services/modulesService'

interface SearchResult {
  unlocked: unknown[]
  locked: unknown[]
}

export default function emojiSearchPatch (
  pluginName: string,
  attachService: AttachService,
  modulesService: ModulesService
): void {
  BdApi.Patcher.after(
    pluginName,
    modulesService.emojiSearch,
    'search',
    (_, _2, result) => onEmojiSearch(result, attachService)
  )
}

function onEmojiSearch (
  result: unknown,
  attachService: AttachService
): void {
  if (!attachService.canAttach) return
  const searchResult = result as SearchResult

  searchResult.unlocked.push(...searchResult.locked)
  searchResult.locked = []
}
