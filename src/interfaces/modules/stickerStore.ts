import { Sticker } from 'interfaces/sticker'

export interface StickerStore {
  getStickerById: (id: string) => Sticker
}
