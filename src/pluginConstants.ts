export const PLUGIN_CHANGELOG = [{
  title: 'Improved',
  type: 'improved',
  items: [
    'Unobfuscate gif util code',
    'Embed all external JS',
    'Remove deprecated API usage',
    'Don\'t add property to global object',
    'Various code improvements'
  ]
}, {
  title: 'Fixed',
  type: 'fixed',
  items: [
    'Unable to select resize method in settings',
    'Autocomplete for custom emotes not working if text is capitalized'
  ]
}]

export const BASE_GIFSICLE_URL = 'https://raw.githubusercontent.com/imagemin/gifsicle-bin' +
  '/v4.0.1/vendor/'

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
