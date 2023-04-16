use image::{Frame, Pixel, Rgba};

use crate::utils::{align_gif, align_speed, get_delay_centisecs};

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
    align_speed(frames, 6.0);
    let Some(frame) = frames.first() else { return };
    let width = frame.buffer().width() as f32;

    let delay_centisecs = get_delay_centisecs(frame.delay());
    let centisecs_per_slide = (50.0 * speed) / 8.0;
    let shift_size = (width * delay_centisecs) / centisecs_per_slide;
    let interval = (width / shift_size).floor();

    *frames = align_gif(frames, interval as usize);

    let row_len = width as usize * CHANNEL_COUNT;
    let rotate_vec = direction.rotate_vec();

    for (index, frame) in frames.iter_mut().enumerate() {
        let shift = ((index as f32 * shift_size) % width).round() as usize;
        shift_frame_data(frame, shift * CHANNEL_COUNT, row_len, rotate_vec);
    }
}

fn shift_frame_data(frame: &mut Frame, shift: usize, row_len: usize, rotate_vec: fn(&mut [u8], usize)) {
    for row in frame.buffer_mut().chunks_exact_mut(row_len) {
        rotate_vec(row, shift);
    }
}
