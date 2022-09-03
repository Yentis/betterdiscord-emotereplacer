export default interface ComponentDispatcher {
  ComponentDispatch: {
    dispatch: (dispatchType: string, data: unknown) => void
  }
}
