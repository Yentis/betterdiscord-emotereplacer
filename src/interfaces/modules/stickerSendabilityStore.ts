import { Sticker } from 'interfaces/sticker'
import { StickerSendableType } from './stickerTypes'
import User from 'interfaces/user'
import Channel from 'interfaces/channel'

type stickerSendabilityFunc = (sticker: Sticker, user: User, channel: Channel) => number

export interface StickerSendabilityStore {
  StickerSendability: StickerSendableType
  getStickerSendability: stickerSendabilityFunc
  isSendableSticker: stickerSendabilityFunc
  isSendableStickerOriginal: stickerSendabilityFunc
}
