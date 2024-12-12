export default interface EmojiStore {
  getEmojiUnavailableReason: (params: {
    emoji: unknown;
    channel: unknown;
    intention: unknown;
  }) => unknown;
  getEmojiUnavailableReasons: (params: unknown) => { emojiNitroLocked: boolean };
  isEmojiCategoryNitroLocked: (params: unknown) => boolean;
  isEmojiDisabled: unknown;
}
