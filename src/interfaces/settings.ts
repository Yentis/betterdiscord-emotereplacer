export interface Settings {
  emoteSize: number,
  autocompleteEmoteSize: number,
  autocompleteItems: number,
  customEmotes: Record<string, string>,
  requirePrefix: boolean,
  prefix: string,
  resizeMethod: string,
  showStandardEmotes: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Setting<T = any> = {
  id: string;
  name?: string;
  note?: string;
  value?: T;
  disabled?: boolean;
  onChange?: (value: T) => void;
}
