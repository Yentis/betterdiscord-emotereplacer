export default interface ComponentDispatcher {
  dispatchToLastSubscribed: (dispatchType: string, data?: unknown) => void

  emitter: {
    listeners: (listenerType: string) => unknown[]
  }
}
