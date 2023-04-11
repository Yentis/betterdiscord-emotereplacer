use image::{imageops, Frame};

enum Direction {
    Horizontal,
    Vertical,
}

pub fn flip(frames: Vec<Frame>, direction: f32) -> Vec<Frame> {
    let direction = if direction == 0.0 {
        Direction::Horizontal
    } else {
        Direction::Vertical
    };

    frames
        .into_iter()
        .map(|mut frame| {
            match direction {
                Direction::Horizontal => imageops::flip_horizontal_in_place(frame.buffer_mut()),
                Direction::Vertical => imageops::flip_vertical_in_place(frame.buffer_mut()),
            };
            
            frame
        })
        .collect()
}
