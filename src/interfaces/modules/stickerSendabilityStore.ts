import { Sticker } from 'interfaces/sticker'
import { StickerSendableType } from './stickerTypes'
import User from 'interfaces/user'
import Channel from 'interfaces/channel'

export type stickerSendableFunc = (sticker: Sticker, user: User, channel: Channel) => boolean

export type IsSendableSticker = {
  key: string;
  method: stickerSendableFunc
}

export interface StickerSendabilityStore {
  module: Record<string, unknown>
  StickerSendability?: StickerSendableType
  getStickerSendabilityKey?: string
  isSendableSticker?: IsSendableSticker
}
