use image::{Frame, Rgba, RgbaImage};
use rand::{Rng, rngs::ThreadRng};
use wasm_bindgen::UnwrapThrowExt;

enum RainType {
  Regular,
  Glitter
}

struct Drop {
  rng: ThreadRng,

  width: u32,
  height: u32,
  delay: u32,

  x: u32,
  y: u32,
  
  speed: u32,
  len: u32,
  size: u32,

  r: u8,
  g: u8,
  b: u8
}

impl Drop {
  pub fn new(width: u32, height: u32, delay: u32, rain_type: &RainType) -> Self {
    let mut rng = rand::thread_rng();
    let x = rng.gen_range(0..width);
    let y = rng.gen_range(0..height);

    let (
      speed,
      len,
      size
    ) = Self::reset_drop_static(
      &mut rng,
      delay
    );

    let r: u8;
    let g: u8;
    let b: u8;

    match rain_type {
      RainType::Glitter => {
        r = rng.gen_range(0..=255);
        g = rng.gen_range(0..=255);
        b = rng.gen_range(0..=255);
      },
      RainType::Regular => {
        r = 0;
        g = 120;
        b = 255;
      }
    }

    Self {
      rng,
      width,
      height,
      delay,
      x,
      y,
      speed,
      len,
      size,
      r,
      g,
      b
    }
  }

  fn reset_drop_static(rng: &mut ThreadRng, delay: u32) -> (u32, u32, u32) {
    let random: f32 = rng.gen();
    let delay = delay as f32;

    let speed = (random * delay + delay).floor() as u32;
    let len = (random * 5.0 + 1.0).floor() as u32;
    let size = (random * 2.0 + 1.0).floor() as u32;

    (speed, len, size)
  }

  fn reset_drop(&mut self) {
    let (
      speed,
      len,
      size
    ) = Self::reset_drop_static(
      &mut self.rng,
      self.delay
    );

    self.speed = speed;
    self.len = len;
    self.size = size;
  }

  fn fall(&mut self) {
    self.y += self.speed;

    if self.y > self.height {
      self.y = 0;
      self.reset_drop();
    }
  }
}

pub fn rain(frames: &mut [Frame], rain_type: f32) {
  let rain_type = if rain_type == 0.0 {
    RainType::Regular
  } else {
    RainType::Glitter
  };

  let frame = frames.get(0).expect_throw("No frames found");
  let width = frame.buffer().width();
  let height = frame.buffer().height();
  let (numerator, denominator) = frame.delay().numer_denom_ms();
  let delay_centisecs = (numerator * denominator) / 10;
  let mut drops = create_drops(width, height, rain_type, delay_centisecs);

  for frame in frames {
    write_drops(&mut drops, frame.buffer_mut());
  }
}

fn create_drops(width: u32, height: u32, rain_type: RainType, delay: u32) -> Vec<Drop> {
  let mut drops: Vec<Drop> = Vec::new();
  let amount = (width + height) / 5;

  for _i in 0..amount {
    drops.push(Drop::new(width, height, delay, &rain_type));
  }

  drops
}

fn write_drops(
  drops: &mut [Drop],
  buffer: &mut RgbaImage
) {
  for drop in drops {
    for i in 0..drop.len {
      for j in 0..drop.size {
        let pixel = Rgba([drop.r, drop.g, drop.b, 255]);
        let x = drop.x + j;
        let y = drop.y + i;
        
        if x >= drop.width || y >= drop.height { continue; }
        buffer.put_pixel(drop.x + j, drop.y + i, pixel);
      }
    }

    drop.fall();
  }
}
