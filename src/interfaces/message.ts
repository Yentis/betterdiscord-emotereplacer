import Emoji from './emoji'

export default interface Message {
  id?: string
  content: string
  channel_id: string
  tts: boolean
  invalidEmojis?: Emoji[]
  validNonShortcutEmojis?: Emoji[]
}
