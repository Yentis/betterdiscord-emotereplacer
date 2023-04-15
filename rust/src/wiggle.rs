use image::{imageops, Frame, GenericImageView, RgbaImage};

use crate::utils::{align_gif, align_speed};

#[derive(Copy, Clone)]
struct WiggleData {
    shift: f32,
    shift_size: f32,
    stripe_height: f32,
    left: bool,
    margin: f32,
}

impl WiggleData {
    pub fn new(buffer_width: f32, buffer_height: f32, speed: f32) -> Self {
        let width = buffer_width + 2.0 * ((buffer_width * speed * 0.1) / 15.0).floor();
        let margin = width - buffer_width;
        let shift = margin / 2.0; // Initial offset of wiggle
        let shift_size = (margin / 6.0).max(1.0);
        let stripe_height = (buffer_height / 32.0).floor().max(1.0);

        Self {
            shift,
            shift_size,
            stripe_height,
            left: true,
            margin,
        }
    }

    fn shift_wiggle_step(&mut self) {
        if self.left {
            self.shift -= self.shift_size;

            if self.shift < -self.shift_size {
                self.left = false;
            }
        } else {
            self.shift += self.shift_size;

            if self.shift > self.margin + self.shift_size {
                self.left = true;
            }
        }
    }
}

// TODO: normalize speed (see spin.rs)
pub fn wiggle(frames: &mut Vec<Frame>, speed: f32) {
    align_speed(frames, 8.0);
    let Some(frame) = frames.first() else { return };
    let buffer_width = frame.buffer().width() as f32;
    let buffer_height = frame.buffer().height() as f32;

    let mut wiggle_data = WiggleData::new(buffer_width, buffer_height, speed);
    let interval = 2.0 * (wiggle_data.margin / wiggle_data.shift_size + 4.0);

    *frames = align_gif(frames, interval as usize);

    for frame in frames {
        wiggle_frame_data(
            frame,
            buffer_width as u32,
            buffer_height as u32,
            wiggle_data,
        );

        // Set initial wiggle offset for next frame
        wiggle_data.shift_wiggle_step();
    }
}

fn wiggle_frame_data(frame: &mut Frame, width: u32, height: u32, mut wiggle_data: WiggleData) {
    let mut wiggled_buffer = RgbaImage::new(width, height);

    (0..height)
        .step_by(wiggle_data.stripe_height as usize)
        .for_each(|stripe| {
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

            wiggle_data.shift_wiggle_step();
        });

    *frame.buffer_mut() = wiggled_buffer;
}
