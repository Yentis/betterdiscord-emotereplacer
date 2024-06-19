import { Upload } from 'interfaces/upload'

export type CloudUpload = new (
    fileData: { file: File; platform: number },
    channelId: string
) => Upload;
