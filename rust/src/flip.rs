use image::{imageops, Frame};

#[derive(Copy, Clone)]
pub enum Direction {
    Horizontal,
    Vertical,
}

impl From<u8> for Direction {
    fn from(value: u8) -> Self {
        if value == 0 {
            Self::Horizontal
        } else {
            Self::Vertical
        }
    }
}

pub fn flip(frames: &mut [Frame], direction: Direction) {
    for frame in frames {
        match direction {
            Direction::Horizontal => imageops::flip_horizontal_in_place(frame.buffer_mut()),
            Direction::Vertical => imageops::flip_vertical_in_place(frame.buffer_mut()),
        }
    }
}
