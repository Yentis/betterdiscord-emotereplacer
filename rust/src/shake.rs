use image::{imageops, Frame, RgbaImage};

use crate::utils::align_gif;

pub fn shake(frames: &mut Vec<Frame>, strength: f32) {
    let Some(frame) = frames.first() else { return; };
    let width = frame.buffer().width();
    let height = frame.buffer().height();
    let (numerator, denominator) = frame.delay().numer_denom_ms();
    let delay_centisecs = ((numerator * denominator) / 10) as f32;

    let centisecs_per_shake = 20.0;
    let divisor = (4.0 * delay_centisecs) / centisecs_per_shake;
    let interval = (4.0 / divisor).floor().max(4.0) as usize;

    let strength_base = (10.0 - strength) / 2.0;
    let multiplier_width = width as f32 / 48.0;
    let multiplier_height = height as f32 / 48.0;

    // Ensure at least a strength of 1
    let strength_width = (strength_base * multiplier_width).ceil() as i64;
    let strength_height = (strength_base * multiplier_height).ceil() as i64;

    // TODO: min speed = 5
    *frames = align_gif(frames, interval);

    for (index, frame) in frames.iter_mut().enumerate() {
        let cycle = index % interval;
        let shake_step = interval / 4;

        let mut shaken_buffer = RgbaImage::new(width, height);

        if cycle < shake_step {
            imageops::overlay(
                &mut shaken_buffer,
                frame.buffer(),
                -strength_width,
                -strength_height,
            );
        } else if cycle < shake_step * 2 {
            imageops::overlay(
                &mut shaken_buffer,
                frame.buffer(),
                -strength_width,
                strength_height,
            );
        } else if cycle < shake_step * 3 {
            imageops::overlay(
                &mut shaken_buffer,
                frame.buffer(),
                strength_width,
                strength_height,
            );
        } else if cycle < shake_step * 4 {
            imageops::overlay(
                &mut shaken_buffer,
                frame.buffer(),
                strength_width,
                -strength_height,
            );
        } else {
            continue;
        }

        *frame.buffer_mut() = shaken_buffer;
    }
}
