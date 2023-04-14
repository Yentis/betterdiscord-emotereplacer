export enum WorkerMessageType {
  INIT,
  APPLY_COMMANDS
}

export interface WorkerMessage {
  type: WorkerMessageType
  data?: unknown
}

export class GifWorker {
  private worker: Worker

  onterminate?: () => void
  onerror?: (error: ErrorEvent) => void
  onmessage?: (message: MessageEvent<{ data: unknown }>) => void

  constructor (worker: Worker) {
    this.worker = worker
    worker.onerror = (error) => { this.onerror?.(error) }
    worker.onmessage = (message: MessageEvent<{ data: unknown }>) => {
      this.onmessage?.(message)
    }
  }

  public postMessage (message: WorkerMessage): void {
    this.worker.postMessage(message)
  }

  public terminate (): void {
    this.onterminate?.()
    this.worker.terminate()
  }
}
