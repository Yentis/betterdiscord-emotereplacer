use image::Frame;
use rand::Rng;
use wasm_bindgen::UnwrapThrowExt;

use crate::rotate::rotate_frame;

pub enum Direction {
    Clockwise,
    CounterClockwise
}

pub fn spin(frames: Vec<Frame>, speed: f32, direction: Direction) -> Vec<Frame> {
    let frame = frames.get(0).expect_throw("No frames found");
    let (numerator, denominator) = frame.delay().numer_denom_ms();

    let delay_centisecs = (numerator as f32 * denominator as f32) / 10.0;
    let centisecs_per_rotation = (200.0 * speed) / 8.0;
    let mut degrees = (360.0 * delay_centisecs) / centisecs_per_rotation;
    let interval = (360.0 / degrees).floor();
    
    match direction {
        Direction::Clockwise => degrees *= 1.0,
        Direction::CounterClockwise => degrees *= -1.0
    };

    let frames = align_gif(frames, interval);
    frames
        .into_iter()
        .enumerate()
        .map(|(index, frame)| {
            let degrees = (index as f32 * degrees) % 360.0;
            rotate_frame(&frame, degrees)
        })
        .collect()
}

fn align_gif(frames: Vec<Frame>, interval: f32) -> Vec<Frame> {
    // Duplicate frames until interval is reached
    let mut aligned_frames = frames.clone();
    while aligned_frames.len() < interval as usize {
        aligned_frames.append(&mut frames.clone());
    }

    let mut frames_to_delete = aligned_frames.len() % interval as usize;
    /*
      Removing more than 20% of frames makes it look sucky => add copies until it's below 20%
      Worst case: interval = (frames.length / 2) + 1 e.g. interval 17 with 32 frames
      then frames_to_delete = 15/32 (46.9%) -> 13/64 (20.3%) -> 11/96 (11.4%)
     */
    while frames_to_delete as f32 / frames.len() as f32 > 0.2 {
        aligned_frames.append(&mut frames.clone());
        frames_to_delete = aligned_frames.len() % interval as usize;
    }

    let amount_copies = aligned_frames.len() / frames.len();
    let mut current_copy = 0;
    let mut rng = rand::thread_rng();

    for _i in 0..frames_to_delete {
        let frame_to_delete = rng.gen_range(0..frames.len());
        let index = frame_to_delete + current_copy * frames.len();
        aligned_frames.remove(index);

        // Keep shifting copy so each copy loses about the same amount of frames
        current_copy = (current_copy + 1) % amount_copies;
    }

    aligned_frames
}
