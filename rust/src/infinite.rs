use image::{
    imageops::{self, FilterType},
    Frame, GenericImageView
};

use crate::{utils::align_gif, log};

pub fn infinite(frames: Vec<Frame>, speed: f32) -> Vec<Frame> {
    let scales_amount: u32 = 5;
    let scale_diff: f32 = 0.9; // Difference between each scale
    let scale_step = (0.03 * 8.0) / speed; // Scale shift between frames
    let frames = align_gif(frames, scale_diff / scale_step);

    let mut scales: Vec<f32> = Vec::new();
    set_scales(&mut scales, scales_amount, scale_diff, scale_step);

    frames
        .into_iter()
        .map(|mut frame| {
            infinite_shift_frame(&scales, &mut frame);
            shift_infinite_scales(&mut scales, scale_diff, scale_step);

            frame
        })
        .collect()
}

fn set_scales(scales: &mut Vec<f32>, scales_amount: u32, scale_diff: f32, scale_step: f32) {
    scales.clear();

    for depth in 0..scales_amount {
        scales.push(((scales_amount as f32) - (depth as f32) - 1.0) * scale_diff + scale_step);
    }
}

fn shift_infinite_scales(scales: &mut Vec<f32>, scale_diff: f32, scale_step: f32) {
    let scale = scales.get(0).unwrap_or(&0.0);

    if scale >= &((scales.len() as f32) * scale_diff) {
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

    scales.iter().for_each(|scale| {
        log(format!("Scale: {}", scale).as_str());
        let scaled_width = (buffer_width * scale).round();
        let scaled_height = (buffer_height * scale).round();

        let scaled_buffer = imageops::resize(
            frame.buffer(),
            scaled_width as u32,
            scaled_height as u32,
            FilterType::Nearest
        );

        let dx = ((scaled_width - buffer_width) / 2.0).round() as i64;
        let dy = ((scaled_height - buffer_height) / 2.0).round() as i64;
        
        log(format!("X: {}, Y: {}, Width: {}, Height: {}, Scale width: {}, Scale height: {}", dx, dy, buffer_width, buffer_height, scaled_width, scaled_height).as_str());
        if scale > &1.0 {
            imageops::overlay(
                frame.buffer_mut(),
                &scaled_buffer.view(
                    dx as u32,
                    dy as u32,
                    buffer_width as u32,
                    buffer_height as u32
                ).to_image(),
                0,
                0
            );
        } else {
            imageops::overlay(frame.buffer_mut(), &scaled_buffer, -dx, -dy);
        }
    });
}
