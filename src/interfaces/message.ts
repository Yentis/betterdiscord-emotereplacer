import Emoji from './emoji'

export default interface Message {
  content: string
  channel_id: string
  tts: boolean
  invalidEmojis?: Emoji[]
  validNonShortcutEmojis?: Emoji[]
}
