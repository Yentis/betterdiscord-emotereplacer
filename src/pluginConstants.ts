export const PLUGIN_CHANGELOG = [{
  title: 'Improved',
  type: 'improved',
  items: [
    'Removed reliance on Gifsicle binaries, ' +
    'you may now remove the gifsicle file in your plugin folder'
  ]
}, {
  title: 'Fixed',
  type: 'fixed',
  items: [
    'Plugin not starting properly on first install'
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
