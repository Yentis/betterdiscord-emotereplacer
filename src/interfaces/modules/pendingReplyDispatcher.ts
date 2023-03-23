export interface PendingReplyDispatcher {
  createPendingReplyKey?: string
  deletePendingReplyKey?: string
  setPendingReplyShouldMentionKey?: string
  module?: Record<string, unknown>
}
