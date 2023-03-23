import Message from 'interfaces/message'
import { Upload } from 'interfaces/upload'

export interface UploadOptions {
  channelId: string,
  uploads: Upload[],
  draftType: number,
  parsedMessage: Message,
  options?: {
    allowedMentions: {
      replied_user: boolean
    },
    messageReference: {
      channel_id: string
      guild_id: string
      message_id?: string
    }
  }
}

export default interface Uploader {
  uploadFiles: (options: UploadOptions) => void
}
