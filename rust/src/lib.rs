extern crate console_error_panic_hook;

use std::mem;
use image::{codecs::gif::{GifEncoder, Repeat}, Frame};
use infinite::infinite;
use rain::rain;
use rainbow::rainbow;
use resize::resize;
use rotate::rotate;
use serde::Deserialize;
use flip::flip;
use shake::shake;
use slide::slide;
use spin::spin;
use utils::{get_frames, get_delay};
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};
use wiggle::wiggle;

mod flip;
mod rain;
mod rainbow;
mod resize;
mod rotate;
mod spin;
mod infinite;
mod utils;
mod slide;
mod wiggle;
mod shake;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[derive(Deserialize)]
struct Command {
    pub name: String,
    pub param: f32,
}

#[wasm_bindgen(js_name = "initPanicHook")]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen(js_name = "applyCommands")]
pub fn apply_commands(data: Vec<u8>, extension: String, commands: JsValue) -> Result<Vec<u8>, String> {
    let commands: Vec<Command> = serde_wasm_bindgen::from_value(commands)
        .map_err(|e| format!("Failed to parse commands: {}", e))?;

    let mut frames = get_frames(&data, &extension)?;
    let Some(frame) = frames.first() else { return Ok(data); };
    let width = frame.buffer().width();
    let height = frame.buffer().height();

    let target_size = get_target_size(&commands);
    let target_width = ((width as f32) * target_size).round() as u32;
    let target_height = ((height as f32) * target_size).round() as u32;

    let mut output = Vec::new();
    {
        let mut writer = GifEncoder::new_with_speed(&mut output, 10);
        writer
            .set_repeat(Repeat::Infinite)
            .map_err(|e| format!("Failed to set repeat: {}", e))?;

        if target_size < 1.0 {
            resize(&mut frames, target_width, target_height);
        }

        for command in &commands {
            let name = command.name.as_str();
            match name {
                "speed" => speed(&mut frames, command.param),
                "hyperspeed" => hyperspeed(&mut frames),
                "reverse" => reverse(&mut frames),
                "flip" => flip(&mut frames, command.param),
                "rain" => rain(&mut frames, command.param),
                "rainbow" => rainbow(&mut frames, command.param),
                "rotate" => rotate(&mut frames, command.param),
                "spin" => spin(&mut frames, command.param, spin::Direction::Clockwise),
                "spinrev" => spin(&mut frames, command.param, spin::Direction::CounterClockwise),
                "infinite" => infinite(&mut frames, command.param),
                "slide" => slide(&mut frames, command.param, slide::Direction::Forwards),
                "sliderev" => slide(&mut frames, command.param, slide::Direction::Backwards),
                "wiggle" => wiggle(&mut frames, command.param),
                "shake" => shake(&mut frames, command.param),
                _ => log(name),
            };
        }

        if target_size > 1.0 {
            resize(&mut frames, target_width, target_height);
        }

        for frame in frames {
            writer
                .encode_frame(frame)
                .map_err(|e| format!("Failed to write frame: {}", e))?;
        }
    };

    Ok(output)
}

fn get_target_size(commands: &[Command]) -> f32 {
    commands
        .iter()
        .rev()
        .find(|command| command.name == "resize")
        .map(|command| command.param)
        .unwrap_or(1.0)
}

fn speed(frames: &mut [Frame], value: f32) {
    for frame in frames {
        set_speed(frame, value as u32);
    }
}

fn set_speed(frame: &mut Frame, speed: u32) {
    let left = frame.left();
    let top = frame.top();

    *frame = Frame::from_parts(
        mem::take(frame.buffer_mut()),
        left,
        top,
        get_delay(speed),
    );
}

fn hyperspeed(frames: &mut Vec<Frame>) {
    if frames.len() <= 4 { return speed(frames, 2.0); }

    let mut index = 0;
    frames.retain_mut(|frame| {
        let retain = index % 2 == 0;
        index += 1;

        if retain { set_speed(frame, 2); }
        retain
    });
}

fn reverse(frames: &mut [Frame]) {
    frames.reverse();
}
