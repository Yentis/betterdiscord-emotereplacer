export const PLUGIN_CHANGELOG = [{
  title: 'Added',
  type: 'added',
  items: [
    'It\'s now possible to add custom emotes directly from your PC instead of entering a URL',
    'Allow uploading images to channels that don\'t allow external emotes',
    'Emotes are now shown as disabled in the reactions menu, as they cannot be used for reacting'
  ]
}, {
  title: 'Fixed',
  type: 'fixed',
  items: [
    'Custom emote menu no longer shows broken emotes from the standard set',
    'Custom emotes starting with numbers or containing spaces can now be removed'
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
