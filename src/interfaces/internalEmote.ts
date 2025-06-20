export interface InternalEmoteSimple {
  name: string;
  url: string;
}

export interface InternalEmote extends InternalEmoteSimple {
  nameAndCommand: string;
  emoteLength: number;
  pos: number;
  spoiler: boolean;
  commands: string[][];
  formatType: string;
  channel?: string;
}
