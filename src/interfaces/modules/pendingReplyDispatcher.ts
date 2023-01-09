export interface PendingReplyDispatcher {
  createPendingReplyKey?: string
  deletePendingReplyKey?: string
  module?: Record<string, unknown>
}
