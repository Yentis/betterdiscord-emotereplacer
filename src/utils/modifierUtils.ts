import { SpecialCommand } from 'interfaces/gifData'

import * as rotate from 'modifiers/rotate'
import * as spin from 'modifiers/spin'
import * as shake from 'modifiers/shake'
import * as rainbow from 'modifiers/rainbow'
import * as wiggle from 'modifiers/wiggle'
import * as infinite from 'modifiers/infinite'
import * as slide from 'modifiers/slide'
import * as rain from 'modifiers/rain'

export function rotateEmote (options: SpecialCommand): Promise<Buffer> {
  if (options.type === 'gif') {
    return rotate.createRotatedGIF(options)
  }
  return rotate.createRotatedPNG(options)
}

export function spinEmote (options: SpecialCommand): Promise<Buffer> {
  if (options.type === 'gif') {
    return spin.createSpinningGIF(options)
  }
  return spin.createSpinningPNG(options)
}

export function shakeEmote (options: SpecialCommand): Promise<Buffer> {
  if (options.type === 'gif') {
    return shake.createShakingGIF(options)
  }
  return shake.createShakingPNG(options)
}

export function rainbowEmote (options: SpecialCommand): Promise<Buffer> {
  if (options.type === 'gif') {
    return rainbow.createRainbowGIF(options)
  }
  return rainbow.createRainbowPNG(options)
}

export function wiggleEmote (options: SpecialCommand): Promise<Buffer> {
  if (options.type === 'gif') {
    return wiggle.createWigglingGIF(options)
  }
  return wiggle.createWigglingPNG(options)
}

export function infiniteEmote (options: SpecialCommand): Promise<Buffer> {
  if (options.type === 'gif') {
    return infinite.createInfiniteGIF(options)
  }
  return infinite.createInfinitePNG(options)
}

export function slideEmote (options: SpecialCommand): Promise<Buffer> {
  if (options.type === 'gif') {
    return slide.createSlidingGIF(options)
  }
  return slide.createSlidingPNG(options)
}

export function rainEmote (options: SpecialCommand): Promise<Buffer> {
  if (options.type === 'gif') {
    return rain.createRainingGIF(options)
  }
  return rain.createRainingPNG(options)
}
