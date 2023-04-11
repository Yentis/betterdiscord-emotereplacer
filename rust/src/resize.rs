use image::{imageops::{self, FilterType}, Frame};

pub fn resize(frames: Vec<Frame>, target_width: u32, target_height: u32) -> Vec<Frame> {
    frames
        .into_iter()
        .map(|frame| {
            let new_buffer = imageops::resize(
                frame.buffer(),
                target_width,
                target_height,
                FilterType::Nearest
            );
            
            Frame::from_parts(
                new_buffer,
                frame.left(),
                frame.top(),
                frame.delay()
            )
        })
        .collect()
}
