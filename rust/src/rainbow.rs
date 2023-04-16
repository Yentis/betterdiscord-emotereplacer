use colors_transform::{Color, Hsl, Rgb};
use image::{Frame, Pixel, RgbaImage};

use crate::utils::{align_gif, align_speed, get_delay_centisecs};

pub fn rainbow(frames: &mut Vec<Frame>, speed: f32) {
    align_speed(frames, 8.0);
    let Some(frame) = frames.first() else { return };

    let delay_centisecs = get_delay_centisecs(frame.delay());
    let centisecs_per_cycle = (120.0 * speed) / 8.0;
    let shift_step = (360.0 * delay_centisecs) / centisecs_per_cycle;
    let interval = (360.0 / shift_step).floor() as usize;

    *frames = align_gif(frames, interval);

    for (index, frame) in frames.iter_mut().enumerate() {
        let shift = (index as f32 * shift_step) % 360.0;
        shift_colors(frame.buffer_mut(), shift);
    }
}

fn shift_colors(buffer: &mut RgbaImage, shift: f32) {
    for pixel in buffer.pixels_mut() {
        let channels = pixel.channels_mut();
        let transparency = channels[3];
        if transparency == 0 { continue; }

        let mut hsl = shift_color(channels, shift);

        while hsl.get_hue() > 360.0 {
            hsl = hsl.adjust_hue(-360.0);
        }

        let (red, green, blue) = hsl.to_rgb().as_tuple();

        channels[0] = red.round() as u8;
        channels[1] = green.round() as u8;
        channels[2] = blue.round() as u8;
    }
}

fn shift_color(channels: &[u8], shift_amount: f32) -> Hsl {
    let rgb = Rgb::from(channels[0] as f32, channels[1] as f32, channels[2] as f32);

    let white_threshold = 30.0;
    let black_threshold = 220.0;

    let mut colors = if
        rgb.get_red() <= white_threshold &&
        rgb.get_green() <= white_threshold &&
        rgb.get_blue() <= white_threshold
    {
        Hsl::from(90.0, 50.0, 20.0)
    } else if
        rgb.get_red() >= black_threshold &&
        rgb.get_green() >= black_threshold &&
        rgb.get_blue() >= black_threshold
    {
        Hsl::from(180.0, 50.0, 80.0)
    } else {
        rgb.to_hsl()
    };

    colors = if shift_amount < 180.0 {
        colors.adjust_hue(shift_amount)
    } else {
        colors.adjust_hue(180.0 - shift_amount)
    };

    colors
}
