extern crate console_error_panic_hook;

use command::Commands;
use image::codecs::gif::{GifEncoder, Repeat};
use infinite::infinite;
use rain::rain;
use rainbow::rainbow;
use rotate::rotate;
use flip::flip;
use shake::shake;
use slide::slide;
use spin::spin;
use utils::get_frames;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue, JsError};
use wiggle::wiggle;

mod command;
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
mod serde;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen(js_name = "initPanicHook")]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen(js_name = "applyCommands")]
pub fn apply_commands(data: Vec<u8>, extension: String, commands: JsValue) -> Result<Vec<u8>, JsError> {
    let mut commands: Commands = serde_wasm_bindgen::from_value(commands)?;

    let Some(mut frames) = get_frames(&data, &extension, &mut commands)? else {
        return Ok(data);
    };

    let mut output = Vec::new();

    {
        let mut writer = GifEncoder::new_with_speed(&mut output, 10);
        writer.set_repeat(Repeat::Infinite)?;

        commands.apply(&mut frames);

        for frame in frames {
            writer.encode_frame(frame)?;
        }
    };

    Ok(output)
}
