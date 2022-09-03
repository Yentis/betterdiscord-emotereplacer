export default interface Emoji {
  id: string
  name: string
  originalName?: string
  allNamesString: string
  url: string

  animated: boolean
  available: boolean
  managed: boolean
}
