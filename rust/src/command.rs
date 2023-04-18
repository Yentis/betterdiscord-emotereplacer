use std::mem;

use image::Frame;

use crate::{
    flip, infinite, rain, rainbow, resize::Resize, rotate, shake, slide, spin, utils::get_delay,
    wiggle,
};

pub struct Commands {
    resize: Resize,
    commands: Vec<Command>,
}

impl Commands {
    pub fn new(commands: Vec<Command>, resize: Resize) -> Self {
        Self { commands, resize }
    }

    pub fn require_work(&self) -> bool {
        !self.commands.is_empty() || self.resize.requires_work()
    }

    pub fn apply(&self, frames: &mut Vec<Frame>) {
        self.resize.apply_before_commands(frames);

        for command in self.commands.iter() {
            command.apply(frames);
        }

        self.resize.apply_after_commands(frames);
    }
}

#[derive(Copy, Clone)]
pub enum Command {
    Flip {
        direction: flip::Direction,
    },
    Hyperspeed,
    Infinite {
        speed: f32,
    },
    Rain {
        ty: rain::RainType,
    },
    Rainbow {
        speed: f32,
    },
    Reverse,
    Rotate {
        degrees: f32,
    },
    Shake {
        strength: f32,
    },
    Slide {
        direction: slide::Direction,
        speed: f32,
    },
    Speed {
        value: f32,
    },
    Spin {
        direction: spin::Direction,
        speed: f32,
    },
    Wiggle {
        speed: f32,
    },
}

impl Command {
    pub fn apply(self, frames: &mut Vec<Frame>) {
        match self {
            Self::Flip { direction } => flip::flip(frames, direction),
            Self::Hyperspeed => hyperspeed(frames),
            Self::Infinite { speed } => infinite::infinite(frames, speed),
            Self::Rain { ty } => rain::rain(frames, ty),
            Self::Rainbow { speed } => rainbow::rainbow(frames, speed),
            Self::Reverse => reverse(frames),
            Self::Rotate { degrees } => rotate::rotate(frames, degrees),
            Self::Shake { strength } => shake::shake(frames, strength),
            Self::Slide { direction, speed } => slide(frames, speed, direction),
            Self::Speed { value } => speed(frames, value),
            Self::Spin { direction, speed } => spin(frames, speed, direction),
            Self::Wiggle { speed } => wiggle::wiggle(frames, speed),
        }
    }
}

pub fn speed(frames: &mut [Frame], value: f32) {
    for frame in frames {
        set_speed(frame, value as u32);
    }
}

pub fn set_speed(frame: &mut Frame, speed: u32) {
    let left = frame.left();
    let top = frame.top();

    *frame = Frame::from_parts(mem::take(frame.buffer_mut()), left, top, get_delay(speed));
}

fn hyperspeed(frames: &mut Vec<Frame>) {
    if frames.len() <= 4 {
        return speed(frames, 2.0);
    }

    let mut index = 0;
    
    frames.retain_mut(|frame| {
        let retain = index % 2 == 0;
        if retain { set_speed(frame, 2) }
        index += 1;

        retain
    });
}

fn reverse(frames: &mut [Frame]) {
    frames.reverse();
}
