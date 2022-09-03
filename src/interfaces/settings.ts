export default interface Settings {
  emoteSize: number,
  autocompleteEmoteSize: number,
  autocompleteItems: number,
  customEmotes: Record<string, string>,
  requirePrefix: boolean,
  prefix: string,
  resizeMethod: string,
  showStandardEmotes: boolean
}
