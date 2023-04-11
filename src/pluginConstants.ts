export const PLUGIN_CHANGELOG = [{
  title: '1.13.1',
  type: 'fixed',
  items: [
    'Fix emote upload not working',
    'Fix emotes with reply always pinging even when turned off',
    'Fix emotes not working in threads when using split view'
  ]
}, {
  title: '1.13.0',
  type: 'added',
  items: [
    'It\'s now possible to add custom emotes directly from your PC instead of entering a URL',
    'Allow uploading images to channels that don\'t allow external emotes',
    'Emotes are now shown as disabled in the reactions menu, as they cannot be used for reacting'
  ]
}, {
  title: '1.13.0',
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
