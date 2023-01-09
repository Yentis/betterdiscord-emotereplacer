import { Upload } from 'interfaces/upload'

export interface CloudUploader {
  n: {
    new (
      fileData: { file: File, platform: number },
      channelId: string
    ): Upload
  }
}
