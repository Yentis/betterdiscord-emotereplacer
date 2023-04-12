use image::{imageops, Frame};

enum Direction {
    Horizontal,
    Vertical,
}

pub fn flip(frames: &mut [Frame], direction: f32) {
    let direction = if direction == 0.0 {
        Direction::Horizontal
    } else {
        Direction::Vertical
    };

    for frame in frames {
        match direction {
            Direction::Horizontal => imageops::flip_horizontal_in_place(frame.buffer_mut()),
            Direction::Vertical => imageops::flip_vertical_in_place(frame.buffer_mut()),
        }
    }
}
