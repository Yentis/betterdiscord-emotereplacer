import Channel from './channel'
import Message from './message'

export interface PendingReply {
  message: Message
  channel: Channel
  shouldMention: boolean
}
