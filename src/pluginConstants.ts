export const PLUGIN_CHANGELOG = [{
  title: 'Fixed',
  type: 'fixed',
  items: [
    'Emote upload not working',
    'Autocomplete for custom emotes not working'
  ]
}]

export const SETTINGS_KEY = 'settings'
export const CURRENT_VERSION_INFO_KEY = 'currentVersionInfo'
export const DEFAULT_SETTINGS = {
  emoteSize: 48,
  autocompleteEmoteSize: 15,
  autocompleteItems: 10,
  customEmotes: {},
  requirePrefix: true,
  prefix: ';',
  resizeMethod: 'smallest',
  showStandardEmotes: true
}

export let Buffer: BufferConstructor
export function setBuffer (buffer: BufferConstructor) {
  Buffer = buffer
}
