export default interface EmojiStore {
  getEmojiUnavailableReason: (params: {
    emoji: unknown
    channel: unknown
    intention: unknown
  }) => unknown
  isEmojiDisabled: unknown
}
