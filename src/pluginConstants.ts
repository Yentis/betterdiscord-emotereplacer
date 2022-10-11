export const PLUGIN_CHANGELOG = [{
  title: 'Improved',
  type: 'improved',
  items: [
    'Removed update checking as this is now built-in'
  ]
}, {
  title: 'Fixed',
  type: 'fixed',
  items: [
    'Use browser version of Jimp',
    'Remove node module usage',
    'Fix all broken webpack filters',
    'Fix emote uploading',
    'Fix GIF processing'
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
