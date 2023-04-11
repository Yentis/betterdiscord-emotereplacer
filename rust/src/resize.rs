use image::{imageops::{self, FilterType}, Frame};

pub fn resize(frames: &mut [Frame], target_width: u32, target_height: u32) {
    for frame in frames {
        let new_buffer = imageops::resize(
            frame.buffer(),
            target_width,
            target_height,
            FilterType::Nearest
        );
        
        *frame = Frame::from_parts(
            new_buffer,
            frame.left(),
            frame.top(),
            frame.delay()
        );
    }
}
