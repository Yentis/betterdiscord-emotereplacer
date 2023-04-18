use image::{
    imageops::{self, FilterType},
    Frame,
};

pub fn resize(frames: &mut [Frame], resize: Resize) {
    let Some(frame) = frames.first() else { return; };
    let width = frame.buffer().width() as f32;
    let height = frame.buffer().height() as f32;

    let scale = resize.scale();
    let target_width = (width * scale.x).round() as u32;
    let target_height = (height * scale.y).round() as u32;

    for frame in frames {
        let new_buffer = imageops::resize(
            frame.buffer(),
            target_width,
            target_height,
            FilterType::Nearest,
        );

        *frame.buffer_mut() = new_buffer;
    }
}

#[derive(Copy, Clone, Default)]
pub enum Resize {
    Scale {
        scale: f32,
    },
    Stretch {
        scale_x: f32,
        scale_y: f32,
    },
    #[default]
    None,
}

pub struct Scale {
    pub x: f32,
    pub y: f32,
}

impl Resize {
    pub fn requires_work(self) -> bool {
        match self {
            Resize::Scale { scale } => scale != 1.0,
            Resize::Stretch { scale_x, scale_y } => scale_x != 1.0 || scale_y != 1.0,
            Resize::None => false,
        }
    }

    pub fn scale(self) -> Scale {
        match self {
            Resize::Scale { scale } => Scale { x: scale, y: scale },
            Resize::Stretch { scale_x, scale_y } => Scale {
                x: scale_x,
                y: scale_y,
            },
            Resize::None => Scale { x: 1.0, y: 1.0 },
        }
    }

    pub fn pre_commands(self) -> bool {
        self.overall_size() < 1.0
    }

    pub fn post_commands(self) -> bool {
        self.overall_size() > 1.0
    }

    pub fn overall_size(self) -> f32 {
        let scales = self.scale();

        scales.x * scales.y
    }
}
