export default interface Classes {
  TextArea: {
    channelTextArea: string;
    textArea: string;
  };
  Editor: {
    editor: string;
  };
  Autocomplete: {
    autocomplete: string;
    autocompleteInner: string;
    autocompleteRowContent: string;
    autocompleteRowContentPrimary: string;
    autocompleteRowIcon: string;
    autocompleteRowVertical: string;
    autocompleteRowVerticalSmall: string;
    base: string;
    contentTitle: string;
    clickable: string;
    emojiImage: string;
  };
  Util: {
    autocomplete: string;
    autocompleteInner: string;
  };
}

export interface AutocompleteAttached {
  autocomplete: unknown;
  autocompleteAttached: unknown;
}
