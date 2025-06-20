export interface Attachment {
  classification: string;
  spoiler: boolean;
  isImage: boolean;
  isThumbnail: boolean;
  mimeType: string;
  upload: () => void;
}
