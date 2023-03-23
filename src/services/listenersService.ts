import { Listener } from 'interfaces/listener'
import { BaseService } from './baseService'

export class ListenersService extends BaseService {
  private listeners: Record<string, Listener> = {}

  addListenersWatchers: Record<string, { onAddListeners: () => void }> = {}

  public start (): Promise<void> {
    return Promise.resolve()
  }

  public addListener (id: string, listener: Listener): void {
    if (this.listeners[id]) this.removeListener(id)
    this.listeners[id] = listener
  }

  public removeListeners (idPrefix: string): void {
    const listeners = Object.keys(this.listeners).filter((id) => id.startsWith(idPrefix))
    if (listeners.length === 0) return

    listeners.forEach((id) => {
      this.removeListener(id)
    })
  }

  public removeListener (id: string): void {
    const listener = this.listeners[id]
    if (!listener) return
    const { element, name, callback } = listener

    if (element) {
      element.removeEventListener(name, callback)
    }

    delete this.listeners[id]
  }

  public requestAddListeners (targetId: string): void {
    Object.entries(this.addListenersWatchers).forEach(([id, addListenersWatcher]) => {
      if (id !== targetId) return
      addListenersWatcher.onAddListeners()
    })
  }

  public stop (): void {
    Object.keys(this.listeners).forEach((id) => {
      this.removeListener(id)
    })
  }
}
