use std::io::Cursor;
use image::{Frame, codecs::{gif::GifDecoder, png::PngDecoder}, AnimationDecoder, RgbaImage, ImageDecoder, Delay};
use rand::Rng;

pub fn get_frames(data: &[u8], extension: &str) -> Result<Vec<Frame>, String> {
    let frames = match extension {
        "gif" => {
            let reader = GifDecoder::new(Cursor::new(data))
                .map_err(|e| format!("Failed to create reader: {}", e))?;

            let mut frames: Vec<Frame> = Vec::new();
            for frame in reader.into_frames() {
                let frame = frame.map_err(|e| format!("Failed to get next frame: {}", e))?;
                frames.push(frame);
            }

            frames
        },
        "png" => {
            let reader = PngDecoder::new(Cursor::new(data))
                .map_err(|e| format!("Failed to create reader: {}", e))?;

            let (width, height) = reader.dimensions();
            let mut data: Vec<u8> = vec![0; reader.total_bytes() as usize];

            reader.read_image(&mut data)
                .map_err(|e| format!("Failed to read image: {}", e))?;
            
            let image = RgbaImage::from_raw(width, height, data).ok_or("Failed to create RGBA image")?;
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
    let mut rng = rand::thread_rng();

    for i in 0..frames_to_delete {
        let frame_to_delete = rng.gen_range(0..frames.len() - i);
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
