import { Sticker } from 'interfaces/sticker'
import { StickerSendableType } from './stickerTypes'
import Channel from 'interfaces/channel'

export interface StickerSendable {
  stickerSendableKey?: string
  stickerSuggestionKey?: string
  stickerSendableType?: StickerSendableType
  module?: Record<string, unknown>
  stickerSendable?: (sticker: Sticker, userId: string, channel: Channel) => boolean
}
