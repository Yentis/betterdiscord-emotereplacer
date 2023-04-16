export default interface DraftStore {
  addChangeListener: (listener: () => void) => void
  removeChangeListener: (listener: () => void) => void
}
