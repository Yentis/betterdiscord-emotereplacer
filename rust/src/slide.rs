use image::{Frame, Pixel, Rgba};

use crate::utils::align_gif;

#[derive(Copy, Clone)]
pub enum Direction {
    Forwards,
    Backwards,
}

impl Direction {
    fn rotate_vec(self) -> fn(&mut [u8], usize) {
        match self {
            Direction::Forwards => <[u8]>::rotate_right,
            Direction::Backwards => <[u8]>::rotate_left,
        }
    }
}

const CHANNEL_COUNT: usize = <Rgba<u8> as Pixel>::CHANNEL_COUNT as usize;

pub fn slide(frames: &mut Vec<Frame>, speed: f32, direction: Direction) {
    let Some(frame) = frames.first() else { return };
    let interval = speed * 2.0;
    let width = frame.buffer().width() as usize;

    let mut shift: usize = 0;
    let shift_size = (width as f32 / interval).round() as usize;
    *frames = align_gif(frames, interval as usize);

    let row_len = width * CHANNEL_COUNT;
    let rotate_vec = direction.rotate_vec();

    for frame in frames {
        shift_frame_data(frame, shift * CHANNEL_COUNT, row_len, rotate_vec);
        shift = (shift + shift_size) % width;
    }
}

fn shift_frame_data(frame: &mut Frame, shift: usize, row_len: usize, rotate_vec: fn(&mut [u8], usize)) {
    for row in frame.buffer_mut().chunks_exact_mut(row_len) {
        rotate_vec(row, shift);
    }
}
