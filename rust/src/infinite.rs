use image::{
    imageops::{self, FilterType},
    Frame, RgbaImage,
};

use crate::utils::{align_gif, align_speed, get_delay_centisecs};

pub fn infinite(frames: &mut Vec<Frame>, speed: f32)  {
    align_speed(frames, 8.0);
    let Some(frame) = frames.first() else { return; };

    let delay_centisecs = get_delay_centisecs(frame.delay());
    let centisecs_per_infinite = (100.0 * speed) / 8.0;

    let scales_amount: u32 = 5;
    let scale_diff: f32 = 1.0; // Difference between each scale
    let scale_step = delay_centisecs / centisecs_per_infinite; // Scale shift between frames
    let interval = (scale_diff / scale_step).floor() as usize;

    *frames = align_gif(frames, interval);

    let mut scales: Vec<f32> = Vec::new();
    set_scales(&mut scales, scales_amount, scale_diff, scale_step);

    for frame in frames {
        infinite_shift_frame(&scales, frame);
        shift_infinite_scales(&mut scales, scale_diff, scale_step);
    }
}

fn set_scales(scales: &mut Vec<f32>, scales_amount: u32, scale_diff: f32, scale_step: f32) {
    scales.clear();

    let new_scales = (0..scales_amount)
        .map(|depth| ((scales_amount as f32) - (depth as f32) - 1.0) * scale_diff + scale_step);

    scales.extend(new_scales);
}

fn shift_infinite_scales(scales: &mut Vec<f32>, scale_diff: f32, scale_step: f32) {
    let scale = scales.first().copied().unwrap_or(0.0);

    if scale >= (scales.len() as f32) * scale_diff {
        set_scales(scales, scales.len() as u32, scale_diff, scale_step);
    } else {
        for scale in scales {
            *scale += scale_step;
        }
    }
}

fn infinite_shift_frame(scales: &[f32], frame: &mut Frame) {
    let buffer_width = frame.buffer().width() as f32;
    let buffer_height = frame.buffer().height() as f32;

    let mut stacked_buffer = RgbaImage::new(
        buffer_width as u32,
        buffer_height as u32
    );

    for &scale in scales.iter() {
        let scaled_width = (buffer_width * scale).round();
        let scaled_height = (buffer_height * scale).round();

        let scaled_buffer = imageops::resize(
            frame.buffer(),
            scaled_width as u32,
            scaled_height as u32,
            FilterType::Nearest,
        );

        let dx = ((scaled_width - buffer_width) / 2.0).round() as i64;
        let dy = ((scaled_height - buffer_height) / 2.0).round() as i64;

        imageops::overlay(&mut stacked_buffer, &scaled_buffer, -dx, -dy);
    }

    *frame.buffer_mut() = stacked_buffer;
}
