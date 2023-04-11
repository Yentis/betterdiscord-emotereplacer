use image::Frame;
use rand::Rng;

pub fn align_gif(frames: &[Frame], interval: usize) -> Vec<Frame> {
  // Duplicate frames until interval is reached
  let copies = (interval.saturating_sub(1) / frames.len()) + 1;
  let mut aligned_frames = Vec::with_capacity(copies * frames.len());
  while aligned_frames.len() < interval {
      aligned_frames.extend_from_slice(frames);
  }

  let mut frames_to_delete = aligned_frames.len() % interval as usize;
  /*
    Removing more than 20% of frames makes it look sucky => add copies until it's below 20%
    Worst case: interval = (frames.length / 2) + 1 e.g. interval 17 with 32 frames
    then frames_to_delete = 15/32 (46.9%) -> 13/64 (20.3%) -> 11/96 (11.4%)
   */
  while frames_to_delete as f32 / frames.len() as f32 > 0.2 {
      aligned_frames.extend_from_slice(frames);
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
