use image::{Frame, Rgba};
use imageproc::geometric_transformations::{self, Interpolation};

pub fn rotate(frames: &mut [Frame], degrees: f32) {
    for frame in frames {
        rotate_frame(frame, degrees);
    }
}

pub fn rotate_frame(frame: &mut Frame, degrees: f32) {
    let new_buffer = geometric_transformations::rotate_about_center(
        frame.buffer(),
        degrees.to_radians(),
        Interpolation::Nearest,
        Rgba([0, 0, 0, 0])
    );
    
    *frame.buffer_mut() = new_buffer;
}
