use colors_transform::{Color, Hsl, Rgb};
use image::{Frame, Pixel, RgbaImage};
use rand::Rng;

pub fn rainbow(frames: &mut [Frame], speed: f32) {
    let speed = 4.0 * speed;
    let mut rng = rand::thread_rng();
    let random_black = rng.gen_range(0.0..=360.0);
    let random_white = rng.gen_range(0.0..=360.0);

    for (index, frame) in frames.iter_mut().enumerate() {
        let cycle = (index as f32) % speed;
        let shift = (cycle / speed) * (330.0 - 30.0) + 30.0;

        shift_colors(frame.buffer_mut(), shift, random_black, random_white);
    }
}

fn shift_colors(buffer: &mut RgbaImage, interval: f32, random_black: f32, random_white: f32) {
    for pixel in buffer.pixels_mut() {
        let channels = pixel.channels_mut();
        let transparency = channels[3];
        if transparency == 0 { continue; }

        let mut hsl = shift_color(channels, random_white, random_black, interval);

        while hsl.get_hue() > 360.0 {
            hsl = hsl.adjust_hue(-360.0);
        }

        let (red, green, blue) = hsl.to_rgb().as_tuple();

        channels[0] = red.round() as u8;
        channels[1] = green.round() as u8;
        channels[2] = blue.round() as u8;
    }
}

fn shift_color(channels: &[u8], random_white: f32, random_black: f32, shift_amount: f32) -> Hsl {
    let rgb = Rgb::from(channels[0] as f32, channels[1] as f32, channels[2] as f32);

    let white_threshold = 30.0;
    let black_threshold = 220.0;
    let mut colors: Hsl;

    if
        rgb.get_red() <= white_threshold &&
        rgb.get_green() <= white_threshold &&
        rgb.get_blue() <= white_threshold
    {
        colors = Hsl::from(random_white, 50.0, 20.0);
    } else if
        rgb.get_red() >= black_threshold &&
        rgb.get_green() >= black_threshold &&
        rgb.get_blue() >= black_threshold
    {
        colors = Hsl::from(random_black, 50.0, 80.0);
    } else {
        colors = rgb.to_hsl();
    }

    colors = colors.adjust_hue(shift_amount);
    colors
}
