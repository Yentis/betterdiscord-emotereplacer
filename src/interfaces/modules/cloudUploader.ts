import { Attachment } from '../attachment';

export type CloudUpload = new (
  fileData: { file: File; platform: number; isThumbnail: boolean },
  channelId: string,
  showLargeMessageDialog: boolean,
  reactNativeFileIndex: number
) => Attachment;
