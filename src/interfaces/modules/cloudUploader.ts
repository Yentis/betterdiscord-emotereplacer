import { Upload } from 'interfaces/upload'

export interface CloudUploader {
  CloudUpload: {
    new (
      fileData: { file: File, platform: number },
      channelId: string
    ): Upload
  }
}
