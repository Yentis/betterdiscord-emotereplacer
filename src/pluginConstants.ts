import Modifier from './interfaces/modifier'

export const PLUGIN_CHANGELOG = [{
  title: '2.0.1',
  type: 'fixed',
  items: [
    'Fix custom emote autocomplete not working in DMs'
  ]
}, {
  title: 'Improved',
  type: 'improved',
  items: [
    'Drastically reduced plugin size',
    'Drastically improved code readability',
    'GIF quality improved',
    'GIF processing now happens much faster using WASM',
    'GIF processing no longer freezes the client and can be cancelled',
    'All modifiers were improved to behave more consistently'
  ]
}, {
  title: 'Fixed',
  type: 'fixed',
  items: [
    'Rain modifier now works for PNGs',
    'Fixed issues with custom emote selection'
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

export const EMOTE_MODIFIERS: Modifier[] = [{
  name: 'flip',
  type: 'normal',
  info: 'Flip emote horizontally'
}, {
  name: 'flap',
  type: 'normal',
  info: 'Flip emote vertically'
}, {
  name: 'rotate',
  type: 'normal',
  info: 'Rotate by x degrees',
  arguments: ['number']
}, {
  name: 'speed',
  type: 'normal',
  info: 'Delay between frames in hundredths of a second',
  arguments: ['number']
}, {
  name: 'hyperspeed',
  type: 'normal',
  info: 'Remove every other frame and use minimum frame delay'
}, {
  name: 'reverse',
  type: 'normal',
  info: 'Play animation backwards'
}, {
  name: 'spin',
  type: 'gif',
  info: 'Spin emote clockwise, options: empty, fast, faster, hyper',
  arguments: ['', 'fast', 'faster', 'hyper']
}, {
  name: 'spinrev',
  type: 'gif',
  info: 'Spin emote counter-clockwise, options: empty, fast, faster, hyper',
  arguments: ['', 'fast', 'faster', 'hyper']
}, {
  name: 'slide',
  type: 'gif',
  info: 'Slide emote from right to left, options: empty, fast, faster, hyper',
  arguments: ['', 'fast', 'faster', 'hyper']
}, {
  name: 'sliderev',
  type: 'gif',
  info: 'Slide emote from left to right, options: empty, fast, faster, hyper',
  arguments: ['', 'fast', 'faster', 'hyper']
}, {
  name: 'shake',
  type: 'gif',
  info: 'Shake emote, options: empty, fast, faster, hyper',
  arguments: ['', 'fast', 'faster', 'hyper']
}, {
  name: 'rainbow',
  type: 'gif',
  info: 'Strobe emote, options: empty, fast, faster, hyper',
  arguments: ['', 'fast', 'faster', 'hyper']
}, {
  name: 'infinite',
  type: 'gif',
  info: 'Pulse emote outwards, options: empty, fast, faster, hyper',
  arguments: ['', 'fast', 'faster', 'hyper']
}, {
  name: 'wiggle',
  type: 'gif',
  info: 'Wiggle emote, options: empty, fast, faster, hyper',
  arguments: ['', 'fast', 'faster', 'hyper']
}, {
  name: 'wide',
  type: 'normal',
  info: 'Increase emote width, options: empty, big, huge, extreme, 2 - 8',
  arguments: ['', 'big', 'huge', 'extreme', 'number']
}, {
  name: 'resize',
  type: 'normal',
  info: 'Resize emote, options: small, medium, large, 32 - 128',
  arguments: ['small', 'medium', 'large', 'number']
}, {
  name: 'rain',
  type: 'gif',
  info: 'Add rain, options: empty, glitter',
  arguments: ['', 'glitter']
}]
