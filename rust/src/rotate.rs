use image::{Frame, Rgba};
use imageproc::geometric_transformations::{self, Interpolation};

pub fn rotate(frames: &mut [Frame], degrees: f32) {
    for frame in frames {
        *frame = rotate_frame(frame, degrees);
    }
}

pub fn rotate_frame(frame: &Frame, degrees: f32) -> Frame {
    let new_buffer = geometric_transformations::rotate_about_center(
        frame.buffer(),
        degrees.to_radians(),
        Interpolation::Nearest,
        Rgba([0, 0, 0, 0])
    );
    
    Frame::from_parts(
        new_buffer,
        frame.left(),
        frame.top(),
        frame.delay()
    )
}