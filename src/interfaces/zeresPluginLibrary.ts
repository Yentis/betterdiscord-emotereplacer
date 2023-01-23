interface SettingsFieldProps {
  noteOnTop: boolean
}

export interface SettingsField {
  name: string | undefined
  note: string | undefined
  onChange: ((newValue: unknown) => void) | undefined
  settingtype: HTMLElement
  props?: SettingsFieldProps

  getElement: () => Element
}

export interface SettingGroup {
  groupName: string

  append: (...elements: (Element | SettingsField)[]) => void
}

interface SliderOptions {
  units: string
  markers: number[]
}

interface Slider extends SettingsField {
  min: number
  max: number
  value: number
  options?: SliderOptions
}

interface Switch extends SettingsField {
  isChecked: boolean
}

interface Textbox extends SettingsField {
  value?: string
}

interface DropdownValue {
  label: string
  value: string
}

interface Dropdown extends SettingsField {
  defaultValue: string
  values: DropdownValue[]
}

interface RadioItem {
  name: string
  value: string
  desc?: string
  color?: string
}

interface RadioGroup extends SettingsField {
  defaultValue: string
  values: RadioItem[]
}

interface Changelog {
  title: string
  type: string
  items: string[]
}

export default interface ZeresPluginLibrary {
  Modals: {
    showChangelogModal: (title: string, version: string, changelog: Changelog[]) => void
  }

  Settings: {
    SettingPanel: {
      build: (
        onChange: (value: unknown) => void,
        ...settings: (SettingsField | SettingGroup)[]
      ) => HTMLElement
    }

    SettingField: new (
      name: string | undefined,
      note: string | undefined,
      onChange: ((newValue: unknown) => void) | undefined,
      settingtype: HTMLElement,
      props?: SettingsFieldProps
    ) => SettingsField

    SettingGroup: new (
      groupName: string
    ) => SettingGroup

    Slider: new (
      name: string | undefined,
      note: string | undefined,
      min: number,
      max: number,
      value: number,
      onChange: ((newValue: number) => void) | undefined,
      options?: SliderOptions
    ) => Slider

    Switch: new (
      name: string | undefined,
      note: string | undefined,
      isChecked: boolean,
      onChange?: ((newValue: boolean) => void)
    ) => Switch

    Textbox: new (
      name: string | undefined,
      note: string | undefined,
      value: string | undefined,
      onChange?: ((newValue: string) => void)
    ) => Textbox

    Dropdown: new (
      name: string | undefined,
      note: string | undefined,
      defaultValue: string,
      values: DropdownValue[],
      onChange?: ((newValue: string) => void)
    ) => Dropdown

    RadioGroup: new (
      name: string | undefined,
      note: string | undefined,
      defaultValue: string,
      values: RadioItem[],
      onChange?: ((newValue: string) => void)
    ) => RadioGroup
  }
}
