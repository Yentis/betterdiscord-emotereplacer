use image::Frame;

use crate::{rotate::rotate_frame, utils::align_gif};

pub enum Direction {
    Clockwise,
    CounterClockwise
}

pub fn spin(frames: &mut Vec<Frame>, speed: f32, direction: Direction) {
    let Some(frame) = frames.first() else { return };
    let (numerator, denominator) = frame.delay().numer_denom_ms();

    let delay_centisecs = (numerator as f32 * denominator as f32) / 10.0;
    let centisecs_per_rotation = (200.0 * speed) / 8.0;
    let mut degrees = (360.0 * delay_centisecs) / centisecs_per_rotation;
    let interval = (360.0 / degrees).floor();
    
    match direction {
        Direction::Clockwise => degrees *= 1.0,
        Direction::CounterClockwise => degrees *= -1.0
    };

    *frames = align_gif(frames, interval as usize);

    for (index, frame) in frames.into_iter().enumerate() {
        let degrees = (index as f32 * degrees) % 360.0;
        *frame = rotate_frame(frame, degrees);
    }
}

