use image::Frame;

use crate::{rotate::rotate_frame, utils::{align_gif, get_delay_centisecs, align_speed}};

pub enum Direction {
    Clockwise,
    CounterClockwise
}

pub fn spin(frames: &mut Vec<Frame>, speed: f32, direction: Direction) {
    align_speed(frames, 8.0);
    let Some(frame) = frames.first() else { return };

    let delay_centisecs = get_delay_centisecs(frame.delay());
    let centisecs_per_rotation = (200.0 * speed) / 8.0;
    let mut degrees = (360.0 * delay_centisecs) / centisecs_per_rotation;
    let interval = (360.0 / degrees).floor();
    
    match direction {
        Direction::Clockwise => degrees *= 1.0,
        Direction::CounterClockwise => degrees *= -1.0
    };

    *frames = align_gif(frames, interval as usize);

    for (index, frame) in frames.iter_mut().enumerate() {
        let degrees = (index as f32 * degrees) % 360.0;
        rotate_frame(frame, degrees);
    }
}
