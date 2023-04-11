import { Gif, GifUtil, GifFrame, GifCodec } from 'gifwrap'

export async function getGifFromBuffer (data: Buffer): Promise<Gif> {
  const buffer = data
  const gif = await new GifCodec().decodeGif(buffer)

  if (gif.frames.length > 200) {
    throw Error('Image too large, advanced modifiers not supported!')
  }

  return gif
}

export function alignGif (frames: GifFrame[], interval: number): GifFrame[] {
  // Duplicate frames until interval is reached
  let alignedFrames = GifUtil.cloneFrames(frames)
  while (alignedFrames.length < interval) {
    alignedFrames = alignedFrames.concat(GifUtil.cloneFrames(frames))
  }

  let framesToDelete = alignedFrames.length % interval
  /*
      Removing more than 20% of frames makes it look sucky => add copies until it's below 20%
      Worst case: interval = (frames.length / 2) + 1 e.g. interval 17 with 32 frames
      then framesToDelete = 15/32 (46.9%) -> 13/64 (20.3%) -> 11/96 (11.4%)
    */
  while (framesToDelete / alignedFrames.length > 0.2) {
    alignedFrames = alignedFrames.concat(GifUtil.cloneFrames(frames))
    framesToDelete = alignedFrames.length % interval
  }

  const amountCopies = alignedFrames.length / frames.length
  let currentCopy = 0

  for (let i = 0; i < framesToDelete; i++) {
    const frameToDelete = Math.floor(Math.random() * frames.length - 1) + 1
    alignedFrames.splice(frameToDelete + currentCopy * frames.length, 1)
    // Keep shifting copy so each copy loses about the same amount of frames
    currentCopy = (currentCopy + 1) % amountCopies
  }

  return alignedFrames
}
