export enum WorkerMessageType {
  INIT,
  APPLY_COMMANDS
}

export interface WorkerMessage {
  type: WorkerMessageType
  data?: unknown
}
