export default interface Dispatcher {
  subscribe: <T> (event: string, callback: (data: T) => void) => void
  unsubscribe: <T> (event: string, callback: (data: T) => void) => void
}
