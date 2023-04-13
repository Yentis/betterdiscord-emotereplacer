use std::fmt::{Formatter, Result as FmtResult};

use serde::{
    de::{Error as DeError, MapAccess, Visitor},
    Deserialize, Deserializer,
};

pub struct Command {
    pub name: String,
    pub param: f32,
}

impl<'de> Deserialize<'de> for Command {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct CommandVisitor;

        impl<'de> Visitor<'de> for CommandVisitor {
            type Value = Command;

            fn expecting(&self, f: &mut Formatter<'_>) -> FmtResult {
                f.write_str("a Command")
            }

            #[inline]
            fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Self::Value, A::Error> {
                let mut name: Option<String> = None;
                let mut param: Option<f32> = None;

                // serde_wasm_bindgen's Deserializer unfortunately only deals with allocated Strings
                while let Some(key) = map.next_key::<String>()? {
                    match key.as_str() {
                        "name" => name = Some(map.next_value()?),
                        "param" => param = Some(map.next_value()?),
                        other => return Err(DeError::unknown_field(other, &["name", "param"])),
                    }
                }

                Ok(Command {
                    name: name.ok_or_else(|| DeError::missing_field("name"))?,
                    param: param.ok_or_else(|| DeError::missing_field("param"))?,
                })
            }
        }

        d.deserialize_map(CommandVisitor)
    }
}
