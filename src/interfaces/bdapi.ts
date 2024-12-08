import { ReactElement } from 'react'
import { Setting } from './settings'

export type ChangelogChanges = {
  title: string;
  type: 'fixed' | 'added' | 'progress' | 'changed';
  items: string[];
  blurb?: string;
}

type ChangelogOptions = {
  title: string;
  subtitle?: string;
  blurb?: string;
  banner?: string;
  video?: string;
  poster?: string;
  footer?: string | ReactElement | (string | ReactElement)[];
  changes?: ChangelogChanges[];
}

type SettingsPanelOptions = {
  settings: Setting[];
  onChange: (categoryId: string | null, settingId: string, settingValue: unknown) => void;
  onDrawerToggle?: (categoryId: string, state: boolean) => void;
  getDrawerState?: (categoryId: string, defaultState: boolean) => void;
}

// TODO: remove custom TS type when BD types are updated
export type BdApiExtended = typeof BdApi & {
  UI: {
    showChangelogModal: (options: ChangelogOptions) => string;
    buildSetting: (setting: Setting) => ReactElement;
    buildSettingsPanel: (options: SettingsPanelOptions) => ReactElement;
  }
  Components: {
    Group: string;
    TextInput: string;
  }
  ReactDOM: {
    createRoot: (element: HTMLElement) => {
      render: (element: ReactElement) => void
    }
  }
};
