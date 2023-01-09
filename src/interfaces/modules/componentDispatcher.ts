export default interface ComponentDispatcher {
  dispatch: (dispatchType: string, data?: unknown) => void
  emitter: {
    listeners: (listenerType: string) => unknown[]
  }
}
