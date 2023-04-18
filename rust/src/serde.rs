use std::{
    fmt::{Formatter, Result as FmtResult},
    str::FromStr,
};

use serde::{
    de::{Error as DeError, IgnoredAny, MapAccess, SeqAccess, Unexpected, Visitor},
    Deserialize, Deserializer,
};

use crate::{
    command::{Command, Commands},
    resize::Resize,
    slide, spin,
};

impl<'de> Deserialize<'de> for Commands {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct CommandsVisitor;

        impl<'de> Visitor<'de> for CommandsVisitor {
            type Value = Commands;

            fn expecting(&self, f: &mut Formatter<'_>) -> FmtResult {
                f.write_str("a sequence of Commands")
            }

            fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Self::Value, A::Error> {
                let mut commands = Vec::with_capacity(seq.size_hint().unwrap_or(0));
                let mut resize = None;

                while let Some(elem) = seq.next_element()? {
                    match elem {
                        CommandOrResize::Command(command) => commands.push(command),
                        CommandOrResize::Resize(resize_) => resize = Some(resize_),
                    }
                }

                let resize = resize.unwrap_or_default();

                Ok(Commands::new(commands, resize))
            }
        }

        d.deserialize_seq(CommandsVisitor)
    }
}

enum CommandOrResize {
    Command(Command),
    Resize(Resize),
}

impl<'de> Deserialize<'de> for CommandOrResize {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct CommandVisitor;

        impl<'de> Visitor<'de> for CommandVisitor {
            type Value = CommandOrResize;

            fn expecting(&self, f: &mut Formatter<'_>) -> FmtResult {
                f.write_str("a Command")
            }

            fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Self::Value, A::Error> {
                let key: String = map
                    .next_key()?
                    .ok_or_else(|| DeError::custom("unexpected empty map"))?;

                if key != "name" {
                    return Err(DeError::custom(
                        "deserialization requires \"name\" as first field",
                    ));
                }

                let name: String = map.next_value()?;

                fn parse_param<'de, T, A>(map: &mut A) -> Result<T, A::Error>
                where
                    T: FromStr,
                    A: MapAccess<'de>,
                {
                    let (_, param) = map
                        .next_entry::<IgnoredAny, String>()?
                        .ok_or_else(|| DeError::missing_field("param"))?;

                    param
                        .parse()
                        .map_err(|_| DeError::custom(format!("failed to parse param `{param}`")))
                }

                match name.as_str() {
                    "flip" => {
                        let direction: u8 = parse_param(&mut map)?;

                        Ok(CommandOrResize::Command(Command::Flip {
                            direction: direction.into(),
                        }))
                    }
                    "hyperspeed" => Ok(CommandOrResize::Command(Command::Hyperspeed)),
                    "infinite" => {
                        let speed = parse_param(&mut map)?;

                        Ok(CommandOrResize::Command(Command::Infinite { speed }))
                    }
                    "rain" => {
                        let ty: u8 = parse_param(&mut map)?;

                        Ok(CommandOrResize::Command(Command::Rain { ty: ty.into() }))
                    }
                    "rainbow" => {
                        let speed = parse_param(&mut map)?;

                        Ok(CommandOrResize::Command(Command::Rainbow { speed }))
                    }
                    "reverse" => Ok(CommandOrResize::Command(Command::Reverse)),
                    "resize" => {
                        let (_, resize) = map
                            .next_entry::<IgnoredAny, Resize>()?
                            .ok_or_else(|| DeError::missing_field("param"))?;

                        Ok(CommandOrResize::Resize(resize))
                    }
                    "rotate" => {
                        let degrees = parse_param(&mut map)?;

                        Ok(CommandOrResize::Command(Command::Rotate { degrees }))
                    }
                    "shake" => {
                        let strength = parse_param(&mut map)?;

                        Ok(CommandOrResize::Command(Command::Shake { strength }))
                    }
                    "slide" => {
                        let speed = parse_param(&mut map)?;

                        Ok(CommandOrResize::Command(Command::Slide {
                            direction: slide::Direction::Forwards,
                            speed,
                        }))
                    }
                    "sliderev" => {
                        let speed = parse_param(&mut map)?;

                        Ok(CommandOrResize::Command(Command::Slide {
                            direction: slide::Direction::Backwards,
                            speed,
                        }))
                    }
                    "speed" => {
                        let value = parse_param(&mut map)?;

                        Ok(CommandOrResize::Command(Command::Speed { value }))
                    }
                    "spin" => {
                        let speed = parse_param(&mut map)?;

                        Ok(CommandOrResize::Command(Command::Spin {
                            direction: spin::Direction::Clockwise,
                            speed,
                        }))
                    }
                    "spinrev" => {
                        let speed = parse_param(&mut map)?;

                        Ok(CommandOrResize::Command(Command::Spin {
                            direction: spin::Direction::CounterClockwise,
                            speed,
                        }))
                    }
                    "wiggle" => {
                        let speed = parse_param(&mut map)?;

                        Ok(CommandOrResize::Command(Command::Wiggle { speed }))
                    }
                    _ => Err(DeError::custom(format!("unknown command name `{name}`"))),
                }
            }
        }

        d.deserialize_map(CommandVisitor)
    }
}

impl<'de> Deserialize<'de> for Resize {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct ResizeVisitor;

        impl<'de> Visitor<'de> for ResizeVisitor {
            type Value = Resize;

            fn expecting(&self, f: &mut Formatter<'_>) -> FmtResult {
                f.write_str("a resize value")
            }

            fn visit_str<E: DeError>(self, v: &str) -> Result<Self::Value, E> {
                match v.split_once('x') {
                    None => Ok(Resize::Scale {
                        scale: v.parse().map_err(|_| {
                            DeError::invalid_value(Unexpected::Str(v), &"a stringified number")
                        })?,
                    }),
                    Some((x, y)) => Ok(Resize::Stretch {
                        scale_x: x.parse().map_err(|_| {
                            DeError::invalid_value(Unexpected::Str(x), &"a stringified number")
                        })?,
                        scale_y: y.parse().map_err(|_| {
                            DeError::invalid_value(Unexpected::Str(y), &"a stringified number")
                        })?,
                    }),
                }
            }
        }

        d.deserialize_str(ResizeVisitor)
    }
}
