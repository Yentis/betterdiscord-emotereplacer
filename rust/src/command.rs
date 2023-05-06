use std::fmt::{Formatter, Result as FmtResult};

use serde::{
    de::{Error as DeError, MapAccess, Visitor},
    Deserialize, Deserializer,
};

pub struct Command {
    pub name: String,
    pub param: f32,
    pub param_extra: Option<f32>,
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
                let mut param_extra: Option<f32> = None;

                // serde_wasm_bindgen's Deserializer unfortunately only deals with allocated Strings
                while let Some(key) = map.next_key::<String>()? {
                    match key.as_str() {
                        "name" => name = Some(map.next_value()?),
                        "param" => {
                            let value = map.next_value::<String>()?;

                            if !value.contains('x') {
                                param = Some(js_sys::parse_float(&value) as f32);
                            } else {
                                let mut split = value.split('x');
                                param = split.next().map(|item| js_sys::parse_float(item) as f32);
                                param_extra = split.next().map(|item| js_sys::parse_float(item) as f32);
                            }
                        },
                        other => return Err(DeError::unknown_field(other, &["name", "param"])),
                    }
                }

                Ok(Command {
                    name: name.ok_or_else(|| DeError::missing_field("name"))?,
                    param: param.unwrap_or(0.0),
                    param_extra,
                })
            }
        }

        d.deserialize_map(CommandVisitor)
    }
}
