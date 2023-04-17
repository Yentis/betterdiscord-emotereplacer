use std::io::Cursor;
use image::{Frame, codecs::{gif::GifDecoder, png::PngDecoder}, AnimationDecoder, Delay, DynamicImage, Rgba};
use js_sys::Math;
use wasm_bindgen::JsError;

use crate::{command::Command, speed};

pub fn get_frames_and_scale(data: &[u8], extension: &str, commands: &mut Vec<Command>) -> Result<(Vec<Frame>, (f32, f32)), JsError> {
    let scale = get_scale(commands);

    let frames = match extension {
        "gif" => {
            let reader = GifDecoder::new(Cursor::new(data))?;

            if scale.0 == 1.0 && scale.1 == 1.0 && commands.is_empty() {
                return Ok((vec![], scale));
            }

            reader
                .into_frames()
                .collect_frames()?
        },
        "png" => {
            let reader = PngDecoder::new(Cursor::new(data))?;

            let mut image = DynamicImage::from_decoder(reader)?
                .into_rgba8();

            // GIFs only have one pixel value indicating transparency, so if alpha is 0 then change the pixel to that pixel value
            for pixel in image.pixels_mut() {
                if pixel.0[3] == 0 { *pixel = Rgba([0, 0, 0, 0]) }
            }

            // Set delay as low as it can go for maximum support for modifiers
            let frame = Frame::from_parts(image, 0, 0, get_delay(2));

            vec![frame]
        },
        _ => return Err(JsError::new(format!("Unsupported extension: {}", extension).as_str()))
    };

    Ok((frames, scale))
}

pub fn align_gif(frames: &[Frame], interval: usize) -> Vec<Frame> {
    // Duplicate frames until interval is reached
    let copies = (interval.saturating_sub(1) / frames.len()) + 1;
    let mut aligned_frames = Vec::with_capacity(copies * frames.len());
    while aligned_frames.len() < interval {
        aligned_frames.extend_from_slice(frames);
    }

    let mut frames_to_delete = aligned_frames.len() % interval;
    /*
     Removing more than 20% of frames makes it look sucky => add copies until it's below 20%
     Worst case: interval = (frames.length / 2) + 1 e.g. interval 17 with 32 frames
     then frames_to_delete = 15/32 (46.9%) -> 13/64 (20.3%) -> 11/96 (11.4%)
    */
    while frames_to_delete as f32 / frames.len() as f32 > 0.2 {
        aligned_frames.extend_from_slice(frames);
        frames_to_delete = aligned_frames.len() % interval;
    }

    let amount_copies = aligned_frames.len() / frames.len();
    let mut current_copy = 0;

    for i in 0..frames_to_delete {
        let cur_frame_len = frames.len() - i;

        let frame_to_delete = get_random_u32(0, cur_frame_len as u32) as usize;
        let index = frame_to_delete + current_copy * (cur_frame_len - 1);
        aligned_frames.remove(index);

        // Keep shifting copy so each copy loses about the same amount of frames
        current_copy = (current_copy + 1) % amount_copies;
    }

    aligned_frames
}

pub fn align_speed(frames: &mut Vec<Frame>, target_delay_centisecs: f32) {
    let Some(frame) = frames.first() else { return; };
    let delay_centisecs = get_delay_centisecs(frame.delay());

    if delay_centisecs <= target_delay_centisecs { return; }
    let mut new_delay_centisecs = delay_centisecs;

    let mut aligned_frames = frames.to_vec();
    let mut cur_copy = 1;

    while new_delay_centisecs > target_delay_centisecs {
        if new_delay_centisecs <= 2.0 { break; }

        frames.iter().enumerate().for_each(|(index, frame)| {
            let target = (index * 2) + cur_copy;
            aligned_frames.insert(target, frame.clone());
        });

        cur_copy += 1;
        new_delay_centisecs = delay_centisecs / (aligned_frames.len() as f32 / frames.len() as f32);
    }

    speed(&mut aligned_frames, new_delay_centisecs);
    *frames = aligned_frames
}

pub fn get_delay(delay_centisecs: u32) -> Delay {
    Delay::from_numer_denom_ms(delay_centisecs * 10, 1)
}

pub fn get_delay_centisecs(delay: Delay) -> f32 {
    let (numerator, denominator) = delay.numer_denom_ms();
    (numerator as f32 * denominator as f32) / 10.0
}

pub fn get_random_u32(min: u32, max: u32) -> u32 {
    let min = min as f64;
    let max = max as f64;

    (Math::random() * (max - min) + min).floor() as u32
}

fn get_scale(commands: &mut Vec<Command>) -> (f32, f32) {
    let mut scale_x: f32 = 1.0;
    let mut scale_y: f32 = 1.0;

    commands
        .retain(|command| {
            let retain = command.name != "resize";

            if !retain {
                scale_x = command.param;
                scale_y = match command.param_extra {
                    Some(y) => y,
                    None => command.param
                };
            }

            retain
        });

    (scale_x, scale_y)
}
