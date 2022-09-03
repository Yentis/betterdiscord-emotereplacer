export default interface Draft {
  changeDraft: () => void
  clearDraft: (channelId: string, draftType: number) => void
}
