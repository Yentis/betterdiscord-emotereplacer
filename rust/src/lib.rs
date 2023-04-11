extern crate console_error_panic_hook;

use std::io::Cursor;
use image::{codecs::gif::{GifEncoder, GifDecoder, Repeat}, ImageDecoder, Frame, AnimationDecoder, Delay};
use infinite::infinite;
use rain::rain;
use rainbow::rainbow;
use resize::resize;
use rotate::rotate;
use serde::Deserialize;
use flip::flip;
use spin::{spin, Direction};
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

mod flip;
mod resize;
mod rain;
mod rainbow;
mod rotate;
mod spin;
mod infinite;
mod utils;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[derive(Deserialize)]
struct Command {
    pub name: String,
    pub param: f32
}

#[wasm_bindgen(js_name="initPanicHook")]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen(js_name="applyCommands")]
pub fn apply_commands(data: Vec<u8>, commands: JsValue) -> Result<Vec<u8>, String> {
    let commands: Vec<Command> = serde_wasm_bindgen::from_value(commands)
        .map_err(|e| format!("Failed to parse commands: {}", e))?;

    let reader = GifDecoder::new(Cursor::new(data))
        .map_err(|e| format!("Failed to create reader: {}", e))?;
    
    let (width, height) = reader.dimensions();
    let target_size = get_target_size(&commands);
    let target_width = ((width as f32) * target_size).round() as u32;
    let target_height = ((height as f32) * target_size).round() as u32;

    let mut output = Vec::new();
    {
        let mut writer = GifEncoder::new_with_speed(&mut output, 10);
        writer
            .set_repeat(Repeat::Infinite)
            .map_err(|e| format!("Failed to set repeat: {}", e))?;
    
        let mut frames: Vec<Frame> = Vec::new();
        for frame in reader.into_frames() {
            let frame = frame.map_err(|e| format!("Failed to get next frame: {}", e))?;
            frames.push(frame);
        }
    
        if target_size < 1.0 {
            frames = resize(
                frames,
                target_width,
                target_height
            )
        }
    
        for command in &commands {
            let name = command.name.as_str();
            frames = match name {
                "speed" => speed(frames, command.param),
                "hyperspeed" => hyperspeed(frames),
                "reverse" => reverse(frames),
                "flip" => flip(frames, command.param),
                "rain" => rain(frames, command.param),
                "rainbow" => rainbow(frames, command.param),
                "rotate" => rotate(frames, command.param),
                "spin" => spin(frames, command.param, Direction::Clockwise),
                "spinrev" => spin(frames, command.param, Direction::CounterClockwise),
                "infinite" => infinite(frames, command.param),
                _ => {
                    log(name);
                    frames
                }
            };
        }
    
        if target_size > 1.0 {
            frames = resize(
                frames,
                target_width,
                target_height
            )
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

fn speed(frames: Vec<Frame>, value: f32) -> Vec<Frame> {
    frames
        .into_iter()
        .map(|frame| set_speed(frame, value as u32))
        .collect()
}

fn set_speed(frame: Frame, speed: u32) -> Frame {
    let left = frame.left();
    let top = frame.top();

    Frame::from_parts(
        frame.into_buffer(),
        left,
        top,
        Delay::from_numer_denom_ms(speed * 10, 1)
    )
}

fn hyperspeed(frames: Vec<Frame>) -> Vec<Frame> {
    if frames.len() <= 4 { return speed(frames, 2.0); }

    frames
        .into_iter()
        .step_by(2)
        .map(|frame| set_speed(frame, 2))
        .collect()
}

fn reverse(mut frames: Vec<Frame>) -> Vec<Frame> {
    frames.reverse();
    frames
}
