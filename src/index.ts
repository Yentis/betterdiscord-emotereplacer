import { RawPlugin } from './classes/rawPlugin'
import { EmoteReplacerPlugin } from './classes/emoteReplacerPlugin'
import ZeresPluginLibrary from './interfaces/zeresPluginLibrary'

export interface BdWindow {
  ZeresPluginLibrary: ZeresPluginLibrary
}
const bdWindow = (window as unknown) as BdWindow

export default bdWindow.ZeresPluginLibrary === undefined ? RawPlugin : EmoteReplacerPlugin
