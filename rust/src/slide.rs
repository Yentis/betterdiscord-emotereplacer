use image::{imageops, Frame, RgbaImage};

use crate::utils::align_gif;

#[derive(Copy, Clone)]
pub enum Direction {
    Forwards,
    Backwards,
}

pub fn slide(frames: &mut Vec<Frame>, speed: f32, direction: Direction) {
    let Some(frame) = frames.first() else { return };
    let interval = speed * 2.0;
    let width = frame.buffer().width();
    let height = frame.buffer().height();

    let mut shift: i64 = 0;
    let shift_size = (width as f32 / interval).round() as i64;
    *frames = align_gif(frames, interval as usize);

    let direction_num: i64 = match direction {
        Direction::Forwards => 1,
        Direction::Backwards => -1,
    };

    for frame in frames {
        shift_frame_data(frame, shift, width, height, direction);
        shift = (shift + direction_num * shift_size) % width as i64
    }
}

fn shift_frame_data(frame: &mut Frame, shift: i64, width: u32, height: u32, direction: Direction) {
    let mut shifted_buffer = RgbaImage::new(width, height);

    imageops::overlay(&mut shifted_buffer, frame.buffer(), shift, 0);

    let x = match direction {
        Direction::Forwards => -(width as i64 - shift),
        Direction::Backwards => width as i64 + shift,
    };

    imageops::overlay(&mut shifted_buffer, frame.buffer(), x, 0);

    *frame.buffer_mut() = shifted_buffer;
}
