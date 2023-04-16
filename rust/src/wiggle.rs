use image::{imageops, Frame, GenericImageView, RgbaImage};

use crate::utils::{align_gif, align_speed, get_delay_centisecs};

#[derive(Copy, Clone)]
struct WiggleData {
    shift: f32,
    shift_size: f32,
    stripe_height: f32,
    step: usize,
}

impl WiggleData {
    pub fn new(buffer_width: f32, buffer_height: f32) -> Self {
        // Shift by 2%
        let shift_size = ((buffer_width / 100.0) * 2.0).max(1.0);
        let stripe_height = (buffer_height / 48.0).floor().max(1.0);

        Self {
            shift: 0.0,
            shift_size,
            stripe_height,
            step: 0,
        }
    }

    fn set_shift(&mut self, cycle: f32, interval: f32) {
        let shift_step = interval / 8.0;

        let mut cur_shift_step = shift_step;
        let mut step = 0;

        while cycle >= cur_shift_step {
            cur_shift_step += shift_step;
            step += 1;
        }

        self.step = step;
        self.set_shift_by_step(0);
    }

    fn set_shift_by_step(&mut self, offset: usize) {
        let step = (self.step + offset) % 8;

        let shift = match step {
            0 => 0,
            1 => -1,
            2 => -2,
            3 => -1,
            4 => 0,
            5 => 1,
            6 => 2,
            7 => 1,
            _ => 0,
        };

        self.shift = shift as f32 * self.shift_size;
        self.step = step;
    }
}

pub fn wiggle(frames: &mut Vec<Frame>, speed: f32) {
    align_speed(frames, 6.0);
    let Some(frame) = frames.first() else { return };
    let buffer_width = frame.buffer().width() as f32;
    let buffer_height = frame.buffer().height() as f32;

    let delay_centisecs = get_delay_centisecs(frame.delay());
    let centisecs_per_wiggle = (64.0 * speed) / 8.0;
    let frame_cycle = 32.0;

    let wiggle_step = (frame_cycle * delay_centisecs) / centisecs_per_wiggle;
    let interval = frame_cycle / wiggle_step;
    let wiggle_data = WiggleData::new(buffer_width, buffer_height);

    *frames = align_gif(frames, interval.floor() as usize);

    for (index, frame) in frames.iter_mut().enumerate() {
        wiggle_frame_data(
            frame,
            buffer_width as u32,
            buffer_height as u32,
            wiggle_data,
            index as f32,
            interval,
        );
    }
}

fn wiggle_frame_data(
    frame: &mut Frame,
    width: u32,
    height: u32,
    mut wiggle_data: WiggleData,
    frame_index: f32,
    interval: f32,
) {
    let mut wiggled_buffer = RgbaImage::new(width, height);

    (0..height)
        .step_by(wiggle_data.stripe_height as usize)
        .enumerate()
        .for_each(|(index, stripe)| {
            if stripe + wiggle_data.stripe_height as u32 > height {
                return;
            }

            let cycle = frame_index % interval;
            wiggle_data.set_shift(cycle, interval);
            wiggle_data.set_shift_by_step(index);

            let cropped_buffer = frame
                .buffer()
                .view(0, stripe, width, wiggle_data.stripe_height as u32)
                .to_image();

            imageops::overlay(
                &mut wiggled_buffer,
                &cropped_buffer,
                wiggle_data.shift as i64,
                stripe as i64,
            );
        });

    *frame.buffer_mut() = wiggled_buffer;
}
