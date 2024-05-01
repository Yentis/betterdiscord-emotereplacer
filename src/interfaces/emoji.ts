export default interface Emoji {
  id: string
  name: string
  originalName?: string
  allNamesString: string

  animated: boolean
  available: boolean
  managed: boolean
}
