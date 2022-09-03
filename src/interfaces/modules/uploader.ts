import Message from 'interfaces/message'

export default interface Uploader {
  upload: (options: {
    channelId: string,
    file: File,
    draftType: number,
    message: Message,
    hasSpoiler: boolean,
    filename: string
  }) => void
}
