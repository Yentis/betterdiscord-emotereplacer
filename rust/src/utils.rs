use std::io::Cursor;
use image::{Frame, codecs::{gif::GifDecoder, png::PngDecoder}, AnimationDecoder, Delay, DynamicImage, Rgba};
use js_sys::Math;

pub fn get_frames(data: &[u8], extension: &str) -> Result<Vec<Frame>, String> {
    let frames = match extension {
        "gif" => {
            let reader = GifDecoder::new(Cursor::new(data))
                .map_err(|e| format!("Failed to create reader: {}", e))?;

            reader
                .into_frames()
                .collect_frames()
                .map_err(|e| format!("Failed to collect frames: {}", e))?
        },
        "png" => {
            let reader = PngDecoder::new(Cursor::new(data))
                .map_err(|e| format!("Failed to create reader: {}", e))?;

            let mut image = DynamicImage::from_decoder(reader)
                .map_err(|e| format!("Failed to create dynamic image: {}", e))?
                .into_rgba8();

            // GIFs only have one pixel value indicating transparency, so if alpha is 0 then change the pixel to that pixel value
            for pixel in image.pixels_mut() {
                if pixel.0[3] == 0 { *pixel = Rgba([0, 0, 0, 0]) }
            }

            // Set delay as low as it can go for maximum support for modifiers
            let frame = Frame::from_parts(image, 0, 0, get_delay(2));

            vec![frame]
        },
        _ => return Err(format!("Unsupported extension: {}", extension))
    };

    Ok(frames)
}

// TODO: make gifs faster if needed so that shake works better on slow gifs
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
        let frame_to_delete = get_random_u32(0, frames.len() as u32 - 1) as usize;
        let index = frame_to_delete + current_copy * (frames.len() - i - 1);
        aligned_frames.remove(index);

        // Keep shifting copy so each copy loses about the same amount of frames
        current_copy = (current_copy + 1) % amount_copies;
    }

    aligned_frames
}

pub fn get_delay(delay_centisecs: u32) -> Delay {
    Delay::from_numer_denom_ms(delay_centisecs * 10, 1)
}

pub fn get_random_u32(min: u32, max: u32) -> u32 {
    let min = min as f64;
    let max = max as f64;

    (Math::random() * (max - min) + min).floor() as u32
}

pub fn get_random_f32(min: f32, max: f32) -> f32 {
    let min = min as f64;
    let max = max as f64;

    (Math::random() * (max - min) + min) as f32
}
