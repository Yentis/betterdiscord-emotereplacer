use image::{imageops::{self, FilterType}, Frame};

pub fn resize(frames: &mut [Frame], target_size: f32) {
    let Some(frame) = frames.first() else { return; };
    let width = frame.buffer().width() as f32;
    let height = frame.buffer().height() as f32;

    let target_width = (width * target_size).round() as u32;
    let target_height = (height * target_size).round() as u32;

    for frame in frames {
        let new_buffer = imageops::resize(
            frame.buffer(),
            target_width,
            target_height,
            FilterType::Nearest
        );
        
        *frame.buffer_mut() = new_buffer;
    }
}
