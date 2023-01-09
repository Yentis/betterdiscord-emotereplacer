import Message from 'interfaces/message'
import { Upload } from 'interfaces/upload'

export default interface Uploader {
  uploadFiles: (options: {
    channelId: string,
    uploads: Upload[],
    draftType: number,
    parsedMessage: Message
  }) => void
}
