use image::Frame;
use wasm_bindgen::UnwrapThrowExt;

pub enum Direction {
  Clockwise,
  CounterClockwise
}

pub fn spin(frames: Vec<Frame>, speed: f32, direction: Direction) -> Vec<Frame> {
  let frame = frames.get(0).expect_throw("No frames found");
  let width = frame.buffer().width();
  let height = frame.buffer().height();
  let (numerator, denominator) = frame.delay().numer_denom_ms();

  let max = width.max(height);
  let delay_centisecs = (numerator as f32 * denominator as f32) / 10.0;
  let centisecs_per_rotation = (200.0 * speed) / 8.0;
  let mut degrees = (360.0 * delay_centisecs) / centisecs_per_rotation;
  let interval = (360.0 / degrees).floor();
  
  match direction {
    Direction::Clockwise => degrees *= 1.0,
    Direction::CounterClockwise => degrees *= -1.0
  };

  let mut margin = (width as f32 - height as f32) / 2.0;
  if height > width { margin *= -1.0; }

  frames
}

/*
export async function createSpinningGIF (options: SpecialCommand): Promise<Buffer> {
  const frames = alignGif(inputGif.frames, interval)
  frames.forEach((frame, index) => {
    const adjustedImg = new Jimp(max, max)

    if (inputGif.width > inputGif.height) {
      adjustedImg.blit(new Jimp(frame.bitmap), 0, margin)
    } else {
      adjustedImg.blit(new Jimp(frame.bitmap), margin, 0)
    }

    adjustedImg.rotate((index * degrees) % 360, false)
    frame.bitmap = adjustedImg.bitmap
    frame.disposalMethod = disposalMethod as GifFrame['disposalMethod']
    GifUtil.quantizeDekker(frame, 256)
  })

  const gif = await new GifCodec().encodeGif(frames, {})
  return gif.buffer
} */