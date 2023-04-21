/**
 * @name EmoteReplacer
 * @version 2.1.0
 * @description Check for known emote names and replace them with an embedded image of the emote. Also supports modifiers similar to BetterDiscord's emotes. Standard emotes: https://yentis.github.io/emotes/
 * @license MIT
 * @author Yentis
 * @authorId 68834122860077056
 * @website https://github.com/Yentis/betterdiscord-emotereplacer
 * @source https://raw.githubusercontent.com/Yentis/betterdiscord-emotereplacer/master/EmoteReplacer.plugin.js
 */
'use strict';

var request = require('request');
var electron = require('electron');
var fs = require('fs');
var path = require('path');
var https = require('https');
var buffer = require('buffer');

class Logger {
  static pluginName;

  static setLogger(pluginName) {
    this.pluginName = pluginName;
  }

  static debug(...args) {
    console.debug(this.pluginName, ...args);
  }

  static info(...args) {
    console.info(this.pluginName, ...args);
  }

  static warn(...args) {
    console.warn(this.pluginName, ...args);
  }

  static error(...args) {
    console.error(this.pluginName, ...args);
  }
}

class RawPlugin {
  meta;

  constructor(meta) {
    this.meta = meta;
    Logger.setLogger(meta.name);
  }

  start() {
    this.showLibraryMissingModal();
  }

  showLibraryMissingModal() {
    BdApi.UI.showConfirmationModal(
      'Library Missing',
      `The library plugin needed for ${this.meta.name} is missing. ` +
        'Please click Download Now to install it.',
      {
        confirmText: 'Download Now',
        cancelText: 'Cancel',
        onConfirm: () => {
          request.get(
            'https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js',
            undefined,
            (error, _response, body) => {
              if (error !== undefined && error !== null) {
                electron.shell
                  .openExternal(
                    'https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi' +
                      '/BDPluginLibrary/master/release/0PluginLibrary.plugin.js'
                  )
                  .catch((error) => {
                    Logger.error(error);
                  });

                return;
              }

              fs.writeFile(
                path.join(BdApi.Plugins.folder, '0PluginLibrary.plugin.js'),
                body,
                () => {
                  /* Do nothing */
                }
              );
            }
          );
        },
      }
    );
  }

  stop() {
    // Do nothing
  }
}

const PLUGIN_CHANGELOG = [
  {
    title: '2.1.0',
    type: 'added',
    items: [
      'Sticker support!',
      'Fix processing failed for gifs where no resize is necessary',
    ],
  },
  {
    title: '2.0.1',
    type: 'fixed',
    items: ['Fix custom emote autocomplete not working in DMs'],
  },
  {
    title: 'Improved',
    type: 'improved',
    items: [
      'Drastically reduced plugin size',
      'Drastically improved code readability',
      'GIF quality improved',
      'GIF processing now happens much faster using WASM',
      'GIF processing no longer freezes the client and can be cancelled',
      'All modifiers were improved to behave more consistently',
    ],
  },
  {
    title: 'Fixed',
    type: 'fixed',
    items: [
      'Rain modifier now works for PNGs',
      'Fixed issues with custom emote selection',
    ],
  },
];

const SETTINGS_KEY = 'settings';
const CURRENT_VERSION_INFO_KEY = 'currentVersionInfo';
const DEFAULT_SETTINGS = {
  emoteSize: 48,
  autocompleteEmoteSize: 15,
  autocompleteItems: 10,
  customEmotes: {},
  requirePrefix: true,
  prefix: ';',
  resizeMethod: 'smallest',
  showStandardEmotes: true,
};

const EMOTE_MODIFIERS = [
  {
    name: 'flip',
    type: 'normal',
    info: 'Flip emote horizontally',
  },
  {
    name: 'flap',
    type: 'normal',
    info: 'Flip emote vertically',
  },
  {
    name: 'rotate',
    type: 'normal',
    info: 'Rotate by x degrees',
    arguments: ['number'],
  },
  {
    name: 'speed',
    type: 'normal',
    info: 'Delay between frames in hundredths of a second',
    arguments: ['number'],
  },
  {
    name: 'hyperspeed',
    type: 'normal',
    info: 'Remove every other frame and use minimum frame delay',
  },
  {
    name: 'reverse',
    type: 'normal',
    info: 'Play animation backwards',
  },
  {
    name: 'spin',
    type: 'gif',
    info: 'Spin emote clockwise, options: empty, fast, faster, hyper',
    arguments: ['', 'fast', 'faster', 'hyper'],
  },
  {
    name: 'spinrev',
    type: 'gif',
    info: 'Spin emote counter-clockwise, options: empty, fast, faster, hyper',
    arguments: ['', 'fast', 'faster', 'hyper'],
  },
  {
    name: 'slide',
    type: 'gif',
    info: 'Slide emote from right to left, options: empty, fast, faster, hyper',
    arguments: ['', 'fast', 'faster', 'hyper'],
  },
  {
    name: 'sliderev',
    type: 'gif',
    info: 'Slide emote from left to right, options: empty, fast, faster, hyper',
    arguments: ['', 'fast', 'faster', 'hyper'],
  },
  {
    name: 'shake',
    type: 'gif',
    info: 'Shake emote, options: empty, fast, faster, hyper',
    arguments: ['', 'fast', 'faster', 'hyper'],
  },
  {
    name: 'rainbow',
    type: 'gif',
    info: 'Strobe emote, options: empty, fast, faster, hyper',
    arguments: ['', 'fast', 'faster', 'hyper'],
  },
  {
    name: 'infinite',
    type: 'gif',
    info: 'Pulse emote outwards, options: empty, fast, faster, hyper',
    arguments: ['', 'fast', 'faster', 'hyper'],
  },
  {
    name: 'wiggle',
    type: 'gif',
    info: 'Wiggle emote, options: empty, fast, faster, hyper',
    arguments: ['', 'fast', 'faster', 'hyper'],
  },
  {
    name: 'wide',
    type: 'normal',
    info: 'Increase emote width, options: empty, big, huge, extreme, 2 - 8',
    arguments: ['', 'big', 'huge', 'extreme', 'number'],
  },
  {
    name: 'resize',
    type: 'normal',
    info: 'Resize emote, options: small, medium, large, 32 - 128',
    arguments: ['small', 'medium', 'large', 'number'],
  },
  {
    name: 'rain',
    type: 'gif',
    info: 'Add rain, options: empty, glitter',
    arguments: ['', 'glitter'],
  },
];

class BaseService {
  plugin;
  zeresPluginLibrary;

  constructor(plugin, zeresPluginLibrary) {
    this.plugin = plugin;
    this.zeresPluginLibrary = zeresPluginLibrary;
  }
}

class PromiseUtils {
  static urlGetBuffer(url) {
    if (url.startsWith('http')) return PromiseUtils.httpsGetBuffer(url);
    else return PromiseUtils.fsGetBuffer(url);
  }

  static async fsGetBuffer(url) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const data = fs.readFileSync(url, '');
    return await Promise.resolve(buffer.Buffer.from(data));
  }

  static httpsGetBuffer(url) {
    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          const buffers = [];

          res.on('data', (chunk) => {
            buffers.push(chunk);
          });

          res.on('end', () => {
            const statusCode = res.statusCode ?? 0;
            if (statusCode !== 0 && (statusCode < 200 || statusCode >= 400)) {
              reject(new Error(res.statusMessage));
              return;
            }

            resolve(buffer.Buffer.concat(buffers));
          });
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  static async loadImagePromise(url, waitForLoad = true, element) {
    const image = element ?? new Image();

    const loadPromise = new Promise((resolve, reject) => {
      image.onload = () => {
        resolve();
      };
      image.onerror = () => {
        reject(new Error(`Failed to load image for url ${url}`));
      };
    });

    if (url.startsWith('http') && !waitForLoad) {
      image.src = url;
    } else {
      const buffer = await PromiseUtils.urlGetBuffer(url);
      image.src = URL.createObjectURL(new Blob([buffer]));
    }

    if (waitForLoad) await loadPromise;
    return image;
  }

  static delay(duration) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, duration);
    });
  }

  static workerMessagePromise(worker, request) {
    return new Promise((resolve, reject) => {
      worker.onterminate = () => {
        reject(new Error('Cancelled'));
      };

      worker.onerror = (error) => {
        reject(error);
      };

      worker.onmessage = (message) => {
        const response = message.data;
        if (response.type !== request.type) return;

        if (response.data instanceof Error) {
          reject(response.data);
        } else {
          resolve(response.data);
        }
      };

      worker.postMessage(request);
    });
  }
}

class CompletionsService extends BaseService {
  static TAG = CompletionsService.name;
  static TEXTAREA_KEYDOWN_LISTENER = 'textAreaKeydown';
  static TEXTAREA_WHEEL_LISTENER = 'textAreaWheel';
  static TEXTAREA_FOCUS_LISTENER = 'textAreaFocus';
  static TEXTAREA_BLUR_LISTENER = 'textAreaBlur';
  static AUTOCOMPLETE_DIV_WHEEL_LISTENER = 'autocompleteDivWheel';
  static EMOTE_ROW_MOUSEENTER_LISTENER = 'emoteRowMouseenter';
  static EMOTE_ROW_MOUSEDOWN_LISTENER = 'emoteRowMousedown';

  emoteService;
  settingsService;
  modulesService;
  listenersService;
  htmlService;
  attachService;

  draft = '';
  cached;
  curEditor;

  start(
    emoteService,
    settingsService,
    modulesService,
    listenersService,
    htmlService,
    attachService
  ) {
    this.emoteService = emoteService;
    this.settingsService = settingsService;
    this.modulesService = modulesService;
    this.listenersService = listenersService;
    this.htmlService = htmlService;
    this.attachService = attachService;

    this.listenersService.addListenersWatchers[CompletionsService.TAG] = {
      onAddListeners: () => {
        this.addListeners();
      },
    };
    this.addListeners();

    return Promise.resolve();
  }

  addListeners() {
    const editors = this.htmlService.getEditors();
    if (editors.length === 0) return;
    this.curEditor = editors[0];

    this.listenersService.removeListeners(
      CompletionsService.TEXTAREA_KEYDOWN_LISTENER
    );
    this.listenersService.removeListeners(
      CompletionsService.TEXTAREA_WHEEL_LISTENER
    );
    this.listenersService.removeListeners(
      CompletionsService.TEXTAREA_FOCUS_LISTENER
    );
    this.listenersService.removeListeners(
      CompletionsService.TEXTAREA_BLUR_LISTENER
    );

    editors.forEach((editor, index) => {
      const focusListener = {
        element: editor,
        name: 'focus',
        callback: () => {
          this.curEditor = editor;
        },
      };

      editor.addEventListener(focusListener.name, focusListener.callback);
      this.listenersService.addListener(
        `${CompletionsService.TEXTAREA_FOCUS_LISTENER}${index}`,
        focusListener
      );

      const blurListener = {
        element: editor,
        name: 'blur',
        callback: () => {
          this.destroyCompletions();
          this.curEditor = undefined;
        },
      };

      editor.addEventListener(blurListener.name, blurListener.callback);
      this.listenersService.addListener(
        `${CompletionsService.TEXTAREA_BLUR_LISTENER}${index}`,
        blurListener
      );

      const textArea = this.htmlService.getTextAreaField(editor);
      if (!textArea) return;

      const keydownListener = {
        element: textArea,
        name: 'keydown',
        callback: (evt) => {
          this.browseCompletions(evt);
        },
      };

      textArea.addEventListener(keydownListener.name, keydownListener.callback);
      this.listenersService.addListener(
        `${CompletionsService.TEXTAREA_KEYDOWN_LISTENER}${index}`,
        keydownListener
      );

      const wheelListener = {
        element: textArea,
        name: 'wheel',
        callback: (evt) => {
          this.scrollCompletions(evt);
        },
      };

      textArea.addEventListener(wheelListener.name, wheelListener.callback);
      this.listenersService.addListener(
        `${CompletionsService.TEXTAREA_WHEEL_LISTENER}${index}`,
        wheelListener
      );
    });
  }

  browseCompletions(event) {
    if (
      !this.emoteService.shouldCompleteEmote(this.draft) &&
      !this.emoteService.shouldCompleteCommand(this.draft)
    ) {
      return;
    }

    let delta = 0,
      options;
    const autocompleteItems = Math.round(
      this.settingsService.settings.autocompleteItems
    );

    switch (event.which) {
      // Tab
      case 9:
      // Enter
      case 13:
        if (!this.prepareCompletions()) {
          break;
        }

        // Prevent Discord's default behavior (send message)
        event.stopPropagation();
        // Prevent adding a tab or line break to text
        event.preventDefault();

        this.insertSelectedCompletion().catch((error) => Logger.error(error));
        break;

      // Up
      case 38:
        delta = -1;
        break;

      // Down
      case 40:
        delta = 1;
        break;

      // Page Up
      case 33:
        delta = -autocompleteItems;
        options = { locked: true, clamped: true };
        break;

      // Page Down
      case 34:
        delta = autocompleteItems;
        options = { locked: true, clamped: true };
        break;
    }

    if (delta !== 0 && this.prepareCompletions()) {
      // Prevent Discord's default behavior
      event.stopPropagation();
      // Prevent cursor movement
      event.preventDefault();

      this.scrollWindow(delta, options);
    }
  }

  prepareCompletions() {
    const candidateText = this.draft;
    const lastText = this.cached?.candidateText;

    if (lastText !== candidateText) {
      if (this.emoteService.shouldCompleteEmote(candidateText)) {
        const { completions, matchText, matchStart } =
          this.emoteService.getCompletionsEmote(candidateText);

        this.cached = {
          candidateText,
          completions,
          matchText,
          matchStart,
          selectedIndex: 0,
          windowOffset: 0,
        };
      } else if (this.emoteService.shouldCompleteCommand(candidateText)) {
        const { completions, matchText, matchStart } =
          this.emoteService.getCompletionsCommands(candidateText);

        this.cached = {
          candidateText,
          completions,
          matchText,
          matchStart,
          selectedIndex: 0,
          windowOffset: 0,
        };
      }
    }

    const { completions } = this.cached ?? {};
    return completions !== undefined && completions.length !== 0;
  }

  async insertSelectedCompletion() {
    const { completions, matchText, selectedIndex } = this.cached ?? {};
    const curDraft = this.draft;
    const matchTextLength = matchText?.length ?? 0;
    const channelId = this.attachService.curChannelId;

    if (
      completions === undefined ||
      selectedIndex === undefined ||
      channelId === undefined
    ) {
      return;
    }

    const selectedCompletion = completions[selectedIndex];
    if (!selectedCompletion) return;
    const completionValueArguments =
      typeof selectedCompletion.data === 'string'
        ? undefined
        : selectedCompletion.data.arguments;

    let suffix = ' ';
    if (completionValueArguments) {
      const argumentOptional = completionValueArguments.some((argument) => {
        return argument === '';
      });

      if (!argumentOptional) suffix = '-';
    }
    selectedCompletion.name += suffix;

    const newDraft = curDraft.substring(0, curDraft.length - matchTextLength);
    this.destroyCompletions();

    await this.insertDraft(channelId, newDraft + selectedCompletion.name);
  }

  async insertDraft(channelId, draft) {
    await new Promise((resolve) => {
      const listener = () => {
        resolve();
        this.modulesService.draftStore.removeChangeListener(listener);
      };

      this.modulesService.draftStore.addChangeListener(listener);
      this.modulesService.draft.clearDraft(channelId, 0);
    });

    this.modulesService.componentDispatcher.dispatchToLastSubscribed(
      'INSERT_TEXT',
      { plainText: draft }
    );
  }

  destroyCompletions() {
    const textAreaContainer = this.htmlService.getTextAreaContainer(
      this.curEditor
    );

    if (textAreaContainer) {
      const completions = this.htmlService
        .getTextAreaContainer(this.curEditor)
        ?.querySelectorAll(`.${this.plugin.meta.name}`);

      completions?.forEach((completion) => {
        completion.remove();
      });
    }

    this.cached = undefined;
    this.renderCompletions.cancel();
  }

  renderCompletions = _.debounce(() => {
    const channelTextArea = this.htmlService.getTextAreaContainer(
      this.curEditor
    );
    if (!channelTextArea) return;

    const oldAutoComplete =
      channelTextArea?.querySelectorAll(`.${this.plugin.meta.name}`) ?? [];
    const discordClasses = this.modulesService.classes;
    const isEmote = this.emoteService.shouldCompleteEmote(this.draft);

    for (const autoComplete of oldAutoComplete) {
      autoComplete.remove();
    }

    if (
      (!this.emoteService.shouldCompleteEmote(this.draft) &&
        !this.emoteService.shouldCompleteCommand(this.draft)) ||
      !this.prepareCompletions()
    ) {
      return;
    }

    const { completions, matchText, selectedIndex } = this.cached ?? {};
    const firstIndex = this.cached?.windowOffset ?? 0;
    const matchList = completions?.slice(
      firstIndex,
      firstIndex + Math.round(this.settingsService.settings.autocompleteItems)
    );

    const autocompleteDiv = document.createElement('div');
    this.htmlService.addClasses(
      autocompleteDiv,
      discordClasses.Autocomplete.autocomplete,
      this.plugin.meta.name
    );
    const autocompleteListener = {
      element: autocompleteDiv,
      name: 'wheel',
      callback: (evt) => {
        this.scrollCompletions(evt, { locked: true });
      },
    };

    autocompleteDiv.addEventListener(
      autocompleteListener.name,
      autocompleteListener.callback
    );
    this.listenersService.addListener(
      CompletionsService.AUTOCOMPLETE_DIV_WHEEL_LISTENER,
      autocompleteListener
    );
    channelTextArea.append(autocompleteDiv);

    const autocompleteInnerDiv = document.createElement('div');
    this.htmlService.addClasses(
      autocompleteInnerDiv,
      discordClasses.Autocomplete.autocompleteInner
    );
    autocompleteDiv.append(autocompleteInnerDiv);

    const titleRow = document.createElement('div');
    this.htmlService.addClasses(
      titleRow,
      discordClasses.Autocomplete.autocompleteRowVertical
    );
    autocompleteInnerDiv.append(titleRow);

    const selector = document.createElement('div');
    this.htmlService.addClasses(selector, discordClasses.Autocomplete.base);
    titleRow.append(selector);

    const contentTitle = document.createElement('h3');
    this.htmlService.addClasses(
      contentTitle,
      discordClasses.Autocomplete.contentTitle,
      discordClasses.Wrapper.base,
      discordClasses.Size.size12
    );

    contentTitle.innerText = isEmote ? 'Emoji matching ' : 'Commands ';
    selector.append(contentTitle);

    const matchTextElement = document.createElement('strong');
    matchTextElement.textContent = matchText ?? '';
    contentTitle.append(matchTextElement);

    for (const [index, { name, data }] of matchList?.entries() ?? []) {
      const emoteRow = document.createElement('div');
      emoteRow.setAttribute('aria-disabled', 'false');

      this.htmlService.addClasses(
        emoteRow,
        discordClasses.Autocomplete.clickable,
        discordClasses.Autocomplete.autocompleteRowVertical,
        discordClasses.Autocomplete.autocompleteRowVerticalSmall
      );

      const mouseEnterListener = {
        element: emoteRow,
        name: 'mouseenter',
        callback: () => {
          if (!this.cached) this.cached = {};
          this.cached.selectedIndex = index + firstIndex;

          for (const child of titleRow.parentElement?.children ?? []) {
            child.setAttribute('aria-selected', 'false');

            for (const nestedChild of child.children) {
              this.htmlService.addClasses(
                nestedChild,
                discordClasses.Autocomplete.base
              );
            }
          }
        },
      };
      emoteRow.addEventListener(
        mouseEnterListener.name,
        mouseEnterListener.callback
      );
      this.listenersService.addListener(
        `${CompletionsService.EMOTE_ROW_MOUSEENTER_LISTENER}${index}`,
        mouseEnterListener
      );

      const mouseDownListener = {
        element: emoteRow,
        name: 'mousedown',
        callback: (evt) => {
          // Prevent loss of focus
          evt.preventDefault();

          if (!this.cached) this.cached = {};
          this.cached.selectedIndex = index + firstIndex;
          this.insertSelectedCompletion().catch((error) => Logger.error(error));
        },
      };
      emoteRow.addEventListener(
        mouseDownListener.name,
        mouseDownListener.callback
      );
      this.listenersService.addListener(
        `${CompletionsService.EMOTE_ROW_MOUSEDOWN_LISTENER}${index}`,
        mouseDownListener
      );
      autocompleteInnerDiv.append(emoteRow);

      const emoteSelector = document.createElement('div');
      this.htmlService.addClasses(
        emoteSelector,
        discordClasses.Autocomplete.base
      );
      emoteRow.append(emoteSelector);

      if (index + firstIndex === selectedIndex) {
        emoteRow.setAttribute('aria-selected', 'true');
      }

      const emoteContainer = document.createElement('div');
      this.htmlService.addClasses(
        emoteContainer,
        discordClasses.Autocomplete.autocompleteRowContent
      );
      emoteSelector.append(emoteContainer);

      if (isEmote) {
        const containerIcon = document.createElement('div');
        this.htmlService.addClasses(
          containerIcon,
          discordClasses.Autocomplete.autocompleteRowIcon
        );
        emoteContainer.append(containerIcon);

        const settingsAutocompleteEmoteSize =
          this.settingsService.settings.autocompleteEmoteSize;
        const containerImage = document.createElement('img');
        containerImage.alt = name;
        containerImage.title = name;
        containerImage.style.minWidth = `${Math.round(
          settingsAutocompleteEmoteSize
        )}px`;
        containerImage.style.minHeight = `${Math.round(
          settingsAutocompleteEmoteSize
        )}px`;
        containerImage.style.width = `${Math.round(
          settingsAutocompleteEmoteSize
        )}px`;
        containerImage.style.height = `${Math.round(
          settingsAutocompleteEmoteSize
        )}px`;

        this.htmlService.addClasses(
          containerImage,
          discordClasses.Autocomplete.emojiImage
        );
        containerIcon.append(containerImage);

        if (typeof data === 'string') {
          PromiseUtils.loadImagePromise(data, false, containerImage).catch(
            (error) => Logger.error(error)
          );
        }
      }

      const containerContent = document.createElement('div');
      containerContent.style.color = 'var(--interactive-active)';
      this.htmlService.addClasses(
        containerContent,
        discordClasses.Autocomplete.autocompleteRowContentPrimary
      );
      emoteContainer.append(containerContent);

      if (isEmote || typeof data === 'string') {
        containerContent.textContent = name;
      } else {
        containerContent.style.display = 'flex';
        containerContent.style.flexDirection = 'column';

        const containerContentName = document.createElement('span');
        containerContentName.style.paddingBottom = '0.5em';
        containerContentName.textContent = name;
        containerContent.append(containerContentName);

        const containerContentInfo = document.createElement('span');
        containerContentInfo.style.color = 'var(--interactive-normal)';
        containerContentInfo.textContent = data.info;
        containerContent.append(containerContentInfo);
      }
    }
  }, 250);

  scrollCompletions(e, options) {
    const delta = Math.sign(e.deltaY);
    this.scrollWindow(delta, options);
  }

  scrollWindow(delta, { locked = false, clamped = false } = {}) {
    if (!this.cached) return;

    const preScroll = 2;
    const { completions, selectedIndex: prevSel, windowOffset } = this.cached;
    const autocompleteItems = Math.round(
      this.settingsService.settings.autocompleteItems
    );

    if (!completions) {
      return;
    }

    // Change selected index
    const num = completions.length;
    let sel = (prevSel ?? 0) + delta;
    if (clamped) {
      sel = _.clamp(sel, 0, num - 1);
    } else {
      sel = (sel % num) + (sel < 0 ? num : 0);
    }
    this.cached.selectedIndex = sel;

    // Clamp window position to bounds based on new selected index
    const boundLower = _.clamp(
      sel + preScroll - (autocompleteItems - 1),
      0,
      num - autocompleteItems
    );

    const boundUpper = _.clamp(sel - preScroll, 0, num - autocompleteItems);
    this.cached.windowOffset = _.clamp(
      (windowOffset ?? 0) + (locked ? delta : 0),
      boundLower,
      boundUpper
    );

    // Render immediately
    this.renderCompletions();
    this.renderCompletions.flush();
  }

  stop() {
    this.draft = '';
    this.cached = undefined;
    this.curEditor = undefined;
  }
}

class EmoteService extends BaseService {
  listenersService;
  settingsService;
  htmlService;

  emoteNames;
  modifiers = EMOTE_MODIFIERS;

  start(listenersService, settingsService, htmlService) {
    this.listenersService = listenersService;
    this.settingsService = settingsService;
    this.htmlService = htmlService;
    this.initEmotes();

    return Promise.resolve();
  }

  initEmotes() {
    this.getEmoteNames()
      .then((emoteNames) => {
        this.setEmoteNames(emoteNames);

        if (this.htmlService.getEditors().length > 0) {
          this.listenersService.requestAddListeners(CompletionsService.TAG);
        }
      })
      .catch((error) => {
        Logger.warn('Failed to get emote names and/or modifiers', error);
      });
  }

  refreshEmotes() {
    this.emoteNames = undefined;
    BdApi.UI.showToast('Reloading emote database...', { type: 'info' });

    this.getEmoteNames()
      .then((names) => {
        this.setEmoteNames(names);
        BdApi.UI.showToast('Emote database reloaded!', { type: 'success' });
      })
      .catch((error) => {
        Logger.warn('Failed to get emote names', error);
      });
  }

  async getEmoteNames() {
    if (!this.settingsService.settings.showStandardEmotes) {
      return {};
    }

    const data = await PromiseUtils.urlGetBuffer(
      'https://raw.githubusercontent.com/Yentis/yentis.github.io/master/emotes/emotes.json'
    );
    const emoteNames = JSON.parse(data.toString());

    Object.keys(emoteNames).forEach((key) => {
      const split = emoteNames[key]?.split('.');
      const [name, extension] = split ?? [];

      delete emoteNames[key];
      if (name === undefined || extension === undefined) return;

      emoteNames[name] =
        'https://raw.githubusercontent.com/Yentis/yentis.github.io/master/emotes' +
        `/images/${key}.${extension}`;
    });

    return emoteNames;
  }

  setEmoteNames(emoteNames) {
    const customEmotes = {};

    Object.entries(this.settingsService.settings.customEmotes).forEach(
      ([name, url]) => {
        customEmotes[this.getPrefixedName(name)] = url;
      }
    );

    const standardNames = {};
    Object.entries(emoteNames).forEach(([name, url]) => {
      const prefixedName = this.getPrefixedName(name);
      standardNames[prefixedName] = url;
    });

    this.emoteNames = { ...standardNames, ...customEmotes };
  }

  getPrefixedName(name) {
    const settingsPrefix = this.settingsService.settings.prefix;
    if (name.toLowerCase().startsWith(settingsPrefix)) {
      name = name.replace(settingsPrefix, '');
    }

    return `${settingsPrefix}${name}`;
  }

  shouldCompleteEmote(input) {
    const prefix = this.settingsService.settings.requirePrefix
      ? this.escapeRegExp(this.settingsService.settings.prefix)
      : '';

    return new RegExp('(?:^|\\s)' + prefix + '\\w{2,}$').test(input);
  }

  shouldCompleteCommand(input) {
    return this.getRegexCommand().test(input);
  }

  escapeRegExp(input) {
    return input.replace(/[-\\/\\^$*+?.()|[\]{}]/g, '\\$&');
  }

  getRegexCommand() {
    const prefix = this.settingsService.settings.requirePrefix
      ? this.escapeRegExp(this.settingsService.settings.prefix)
      : '';

    return new RegExp('((?<!\\/)(?:' + prefix + '|<)[\\w:>]*\\.)([\\w\\.-]*)$');
  }

  getCompletionsEmote(text) {
    const settingsPrefix = this.settingsService.settings.prefix;
    const prefix = this.settingsService.settings.requirePrefix
      ? this.escapeRegExp(settingsPrefix)
      : '';

    const match = text.match(new RegExp('(^|\\s)(' + prefix + '\\w{2,})$'));
    if (match === null) {
      return { completions: [], matchText: undefined, matchStart: -1 };
    }

    const emoteArray = [];
    Object.entries(this.emoteNames ?? {}).forEach(([key, value]) => {
      emoteArray.push({ name: key, data: value });
    });

    const matchText = (match[2] ?? '').toLowerCase();
    const completions = emoteArray.filter((emote) => {
      const matchWithoutPrefix = matchText.startsWith(settingsPrefix)
        ? matchText.replace(settingsPrefix, '')
        : matchText;

      if (emote.name.toLowerCase().search(matchWithoutPrefix) !== -1) {
        return emote;
      } else {
        return false;
      }
    });

    const matchIndex = match.index ?? 0;
    const matchFirst = match[1] ?? '';
    const matchStart = matchIndex + matchFirst.length;

    return { completions, matchText, matchStart };
  }

  getCompletionsCommands(text) {
    const regex = this.getRegexCommand();
    const match = text.match(regex);
    if (match === null) {
      return { completions: [], matchText: undefined, matchStart: -1 };
    }

    const commandPart =
      match[2]?.substring(match[2].lastIndexOf('.') + 1) ?? '';
    const commandArray = [];

    this.modifiers.forEach((modifier) => {
      commandArray.push({ name: modifier.name, data: modifier });
    });

    const completions = commandArray.filter((command) => {
      return (
        commandPart === '' ||
        command.name.toLowerCase().search(commandPart) !== -1
      );
    });

    const matchText = commandPart;
    const matchIndex = match.index ?? 0;
    const matchZero = match[0] ?? '';
    const matchStart = matchIndex + matchZero.length;

    return { completions, matchText, matchStart };
  }

  stop() {
    this.emoteNames = undefined;
    this.modifiers = [];
  }
}

class AttachService extends BaseService {
  modulesService;

  canAttach = false;
  externalEmotes = new Set();
  userId;
  curChannelId;

  pendingUpload;
  pendingReply;

  onMessagesLoaded;
  onChannelSelect;

  async start(modulesService) {
    this.modulesService = modulesService;
    this.userId = await this.getUserId();
  }

  getUserId() {
    return new Promise((resolve) => {
      const getCurrentUser = this.modulesService.userStore.getCurrentUser;
      let user = getCurrentUser();

      if (user) {
        resolve(user.id);
        return;
      }

      // Not fully booted yet, wait for channel messages to load
      this.onMessagesLoaded = () => {
        user = getCurrentUser();
        const userId = user?.id ?? '';

        if (this.onMessagesLoaded) {
          this.modulesService.dispatcher.unsubscribe(
            'LOAD_MESSAGES_SUCCESS',
            this.onMessagesLoaded
          );
          this.onMessagesLoaded = undefined;
        }

        if (!userId) return;
        resolve(userId);
      };

      this.modulesService.dispatcher.subscribe(
        'LOAD_MESSAGES_SUCCESS',
        this.onMessagesLoaded
      );
    });
  }

  setCanAttach(_channelId) {
    if (_channelId !== undefined && _channelId === this.curChannelId) return;
    this.externalEmotes.clear();

    const channelId = _channelId ?? '';
    this.curChannelId = channelId;

    if (!channelId) {
      this.canAttach = true;
      return;
    }

    if (this.userId === undefined) {
      this.canAttach = true;
      return;
    }

    const channel = this.modulesService.channelStore.getChannel(channelId);
    if (!channel) {
      this.canAttach = true;
      return;
    }

    const guildId = channel.guild_id ?? '';
    if (!guildId) {
      this.canAttach = true;
      return;
    }

    const permissions = this.modulesService.discordPermissions;
    this.canAttach = this.modulesService.permissions.can(
      permissions.ATTACH_FILES,
      channel,
      this.userId
    );
  }

  stop() {
    if (this.onMessagesLoaded) {
      this.modulesService.dispatcher.unsubscribe(
        'LOAD_MESSAGES_SUCCESS',
        this.onMessagesLoaded
      );
      this.onMessagesLoaded = undefined;
    }

    if (this.onChannelSelect) {
      this.modulesService.dispatcher.unsubscribe(
        'CHANNEL_SELECT',
        this.onChannelSelect
      );
      this.onChannelSelect = undefined;
    }

    this.canAttach = false;
    this.pendingUpload = undefined;
  }
}

class SettingsService extends BaseService {
  static ADD_BUTTON_CLICK_LISTENER = 'addButtonClick';
  static REFRESH_BUTTON_CLICK_LISTENER = 'refreshButtonClick';
  static DELETE_BUTTON_CLICK_LISTENER = 'deleteButtonClick';

  listenersService;

  settings = DEFAULT_SETTINGS;

  start(listenersService) {
    this.listenersService = listenersService;

    const savedSettings = BdApi.Data.load(this.plugin.meta.name, SETTINGS_KEY);
    this.settings = Object.assign({}, DEFAULT_SETTINGS, savedSettings);

    return Promise.resolve();
  }

  getSettingsElement() {
    const emoteService = this.plugin.emoteService;
    if (!emoteService) return new HTMLElement();

    const Settings = this.zeresPluginLibrary.Settings;
    const settings = [];

    this.pushRegularSettings(settings, emoteService);

    const emoteFolderPicker = document.createElement('input');
    emoteFolderPicker.type = 'file';
    emoteFolderPicker.multiple = true;
    emoteFolderPicker.accept = '.png,.gif';

    let emoteName;
    const emoteNameTextbox = new Settings.Textbox(
      undefined,
      'Emote name',
      undefined,
      (val) => {
        emoteName = val;
      }
    );

    let imageUrl;
    const imageUrlTextbox = new Settings.Textbox(
      undefined,
      'Image URL (must end with .gif or .png, 128px recommended)',
      undefined,
      (val) => {
        imageUrl = val;
      }
    );

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.classList.add('bd-button');
    addButton.textContent = 'Add';
    const addSettingField = new Settings.SettingField(
      undefined,
      undefined,
      undefined,
      addButton
    );

    const customEmotesContainer = document.createElement('div');
    const addListener = {
      element: addButton,
      name: 'click',
      callback: () => {
        const files = emoteFolderPicker.files ?? [];

        const addPromises = (
          files.length > 0
            ? Array.from(files).map((file) => {
                const fileName = file.name.substring(
                  0,
                  file.name.lastIndexOf('.')
                );
                return this.addEmote(fileName, file.path);
              })
            : [this.addEmote(emoteName, imageUrl)]
        ).map(async (promise) => {
          const emoteName = await promise;
          customEmotesContainer.append(
            this.createCustomEmoteContainer(emoteName, emoteService)
          );
        });

        Promise.allSettled(addPromises)
          .then((results) => {
            const errors = [];
            results.forEach((result) => {
              if (result.status === 'fulfilled') return;
              errors.push(result.reason);
              Logger.error(result.reason);
            });

            const firstError = errors[0];
            if (firstError) {
              BdApi.UI.showToast(
                `${firstError.message}${
                  errors.length > 1 ? '\nSee console for all errors' : ''
                }`,
                { type: 'error' }
              );

              if (addPromises.length === 1) return;
            }

            emoteFolderPicker.value = '';
            const emoteNameTextboxInput = emoteNameTextbox
              .getElement()
              .querySelector('input');
            if (emoteNameTextboxInput) emoteNameTextboxInput.value = '';

            const imageUrlTextboxInput = imageUrlTextbox
              .getElement()
              .querySelector('input');
            if (imageUrlTextboxInput) imageUrlTextboxInput.value = '';

            BdApi.Data.save(this.plugin.meta.name, SETTINGS_KEY, this.settings);
            BdApi.UI.showToast('Emote(s) have been saved', { type: 'success' });
          })
          .catch((error) => {
            BdApi.UI.showToast(error.message, { type: 'error' });
          });
      },
    };
    addButton.addEventListener(addListener.name, addListener.callback);
    this.listenersService.addListener(
      SettingsService.ADD_BUTTON_CLICK_LISTENER,
      addListener
    );

    Object.keys(this.settings.customEmotes).forEach((key) => {
      customEmotesContainer.append(
        this.createCustomEmoteContainer(key, emoteService)
      );
    });

    const customEmoteGroup = new Settings.SettingGroup('Custom emotes');
    customEmoteGroup.append(
      emoteFolderPicker,
      emoteNameTextbox,
      imageUrlTextbox,
      addSettingField,
      customEmotesContainer
    );
    settings.push(customEmoteGroup);

    const refreshButton = document.createElement('button');
    refreshButton.type = 'button';
    refreshButton.classList.add('bd-button');
    refreshButton.textContent = 'Refresh emote list';
    const refreshSettingField = new Settings.SettingField(
      undefined,
      undefined,
      undefined,
      refreshButton
    );

    const refreshListener = {
      element: refreshButton,
      name: 'click',
      callback: () => {
        emoteService.refreshEmotes();
      },
    };
    refreshButton.addEventListener(
      refreshListener.name,
      refreshListener.callback
    );
    this.listenersService.addListener(
      SettingsService.REFRESH_BUTTON_CLICK_LISTENER,
      refreshListener
    );
    settings.push(refreshSettingField);

    return Settings.SettingPanel.build(() => {
      BdApi.Data.save(this.plugin.meta.name, SETTINGS_KEY, this.settings);
    }, ...settings);
  }

  async addEmote(emoteName, imageUrl) {
    if (!emoteName) throw new Error('No emote name entered!');
    if (!imageUrl) throw new Error('No image URL entered!');

    if (!imageUrl.endsWith('.gif') && !imageUrl.endsWith('.png')) {
      throw new Error('Image URL must end with .gif or .png!');
    }

    const emoteService = this.plugin.emoteService;
    if (!emoteService) throw new Error('Emote service not found');

    const emoteNames = emoteService.emoteNames ?? {};
    const targetEmoteName =
      emoteNames[emoteService.getPrefixedName(emoteName)] ?? '';
    if (targetEmoteName) throw new Error('Emote name already exists!');

    this.settings.customEmotes[emoteName] = imageUrl;
    emoteNames[emoteService.getPrefixedName(emoteName)] = imageUrl;

    emoteService.emoteNames = emoteNames;
    return await Promise.resolve(emoteName);
  }

  pushRegularSettings(settings, emoteService) {
    const Settings = this.zeresPluginLibrary.Settings;

    settings.push(
      new Settings.Slider(
        'Emote Size',
        'The size of emotes. (default 48)',
        32,
        128,
        this.settings.emoteSize,
        (val) => {
          this.settings.emoteSize = Math.round(val);
        },
        { units: 'px', markers: [32, 48, 64, 96, 128] }
      )
    );

    settings.push(
      new Settings.Slider(
        'Autocomplete Emote Size',
        'The size of emotes in the autocomplete window. (default 15)',
        15,
        64,
        this.settings.autocompleteEmoteSize,
        (val) => {
          this.settings.autocompleteEmoteSize = Math.round(val);
        },
        { units: 'px', markers: [15, 32, 48, 64] }
      )
    );

    settings.push(
      new Settings.Slider(
        'Autocomplete Items',
        'The amount of emotes shown in the autocomplete window. (default 10)',
        1,
        25,
        this.settings.autocompleteItems,
        (val) => {
          this.settings.autocompleteItems = Math.round(val);
        },
        { units: ' items', markers: [1, 5, 10, 15, 20, 25] }
      )
    );

    settings.push(
      new Settings.Switch(
        'Require prefix',
        'If this is enabled, ' +
          'the autocomplete list will not be shown unless the prefix is also typed.',
        this.settings.requirePrefix,
        (checked) => {
          this.settings.requirePrefix = checked;
        }
      )
    );

    settings.push(
      new Settings.Switch(
        'Show standard custom emotes',
        'If this is enabled, the standard custom emotes will be visible.',
        this.settings.showStandardEmotes,
        (checked) => {
          this.settings.showStandardEmotes = checked;
          emoteService.refreshEmotes();
        }
      )
    );

    settings.push(
      new Settings.Textbox(
        'Prefix',
        'The prefix to check against for the above setting. ' +
          'It is recommended to use a single character not in use by other chat functionality, ' +
          'other prefixes may cause issues.',
        this.settings.prefix,
        _.debounce((val) => {
          if (val === this.settings.prefix) return;

          const previousPrefix = this.settings.prefix;
          this.settings.prefix = val;
          BdApi.Data.save(this.plugin.meta.name, SETTINGS_KEY, this.settings);

          const previousEmoteNames = Object.assign({}, emoteService.emoteNames);
          const emoteNames = {};

          Object.entries(previousEmoteNames).forEach(([name, value]) => {
            const prefixedName = emoteService.getPrefixedName(
              name.replace(previousPrefix, '')
            );
            emoteNames[prefixedName] = value;
          });

          emoteService.emoteNames = emoteNames;
        }, 2000)
      )
    );

    settings.push(
      new Settings.RadioGroup(
        'Resize Method',
        'How emotes will be scaled down to fit your selected emote size',
        this.settings.resizeMethod,
        [
          {
            name: 'Scale down smallest side',
            value: 'smallest',
          },
          {
            name: 'Scale down largest side',
            value: 'largest',
          },
        ],
        (val) => {
          this.settings.resizeMethod = val;
        }
      )
    );
  }

  createCustomEmoteContainer(emoteName, emoteService) {
    const Settings = this.zeresPluginLibrary.Settings;

    const customEmoteContainer = document.createElement('div');
    customEmoteContainer.style.display = 'flex';

    const url = this.settings.customEmotes[emoteName] ?? '';
    const containerImage = document.createElement('img');
    containerImage.alt = emoteName;
    containerImage.title = emoteName;
    containerImage.style.minWidth = `${Math.round(
      this.settings.autocompleteEmoteSize
    )}px`;
    containerImage.style.minHeight = `${Math.round(
      this.settings.autocompleteEmoteSize
    )}px`;
    containerImage.style.width = `${Math.round(
      this.settings.autocompleteEmoteSize
    )}px`;
    containerImage.style.height = `${Math.round(
      this.settings.autocompleteEmoteSize
    )}px`;
    containerImage.style.marginRight = '0.5rem';

    customEmoteContainer.append(containerImage);
    PromiseUtils.loadImagePromise(url, false, containerImage).catch((error) =>
      Logger.error(error)
    );

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.classList.add('bd-button', 'bd-button-danger');
    deleteButton.innerHTML =
      '<svg class="" fill="#FFFFFF" viewBox="0 0 24 24" ' +
      'style="width: 20px; height: 20px;"><path fill="none" d="M0 0h24v24H0V0z"></path>' +
      '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm2.46-7.12l1.41-1.41L12 12.59l2.12-2.' +
      '12 1.41 1.41L13.41 14l2.12 2.12-1.41 1.41L12 15.41l-2.12 2.12-1.41-1.41L10.59 14l-2.13-2.1' +
      '2zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"></path><path fill="none" d="M0 0h24v24H0z"></path></svg>';
    customEmoteContainer.append(deleteButton);

    const deleteListener = {
      element: deleteButton,
      name: 'click',
      callback: () => {
        delete this.settings.customEmotes[emoteName];
        if (emoteService.emoteNames) {
          delete emoteService.emoteNames[
            emoteService.getPrefixedName(emoteName)
          ];
        }

        BdApi.Data.save(this.plugin.meta.name, SETTINGS_KEY, this.settings);
        BdApi.UI.showToast(`Emote ${emoteName} has been deleted!`, {
          type: 'success',
        });

        document.getElementById(emoteName)?.remove();
      },
    };
    deleteButton.addEventListener(deleteListener.name, deleteListener.callback);
    this.listenersService.addListener(
      `${SettingsService.DELETE_BUTTON_CLICK_LISTENER}${emoteName}`,
      deleteListener
    );

    const targetEmote = this.settings.customEmotes[emoteName];
    const existingEmote = new Settings.SettingField(
      emoteName,
      targetEmote,
      undefined,
      customEmoteContainer,
      { noteOnTop: true }
    );

    existingEmote.getElement().id = emoteName;
    return existingEmote.getElement();
  }

  stop() {
    // Do nothing
  }
}

class ListenersService extends BaseService {
  listeners = {};

  addListenersWatchers = {};

  start() {
    return Promise.resolve();
  }

  addListener(id, listener) {
    if (this.listeners[id]) this.removeListener(id);
    this.listeners[id] = listener;
  }

  removeListeners(idPrefix) {
    const listeners = Object.keys(this.listeners).filter((id) =>
      id.startsWith(idPrefix)
    );
    if (listeners.length === 0) return;

    listeners.forEach((id) => {
      this.removeListener(id);
    });
  }

  removeListener(id) {
    const listener = this.listeners[id];
    if (!listener) return;
    const { element, name, callback } = listener;

    if (element) {
      element.removeEventListener(name, callback);
    }

    delete this.listeners[id];
  }

  requestAddListeners(targetId) {
    Object.entries(this.addListenersWatchers).forEach(
      ([id, addListenersWatcher]) => {
        if (id !== targetId) return;
        addListenersWatcher.onAddListeners();
      }
    );
  }

  stop() {
    Object.keys(this.listeners).forEach((id) => {
      this.removeListener(id);
    });
  }
}

function funcToSource(fn, sourcemapArg) {
  var sourcemap = sourcemapArg === undefined ? null : sourcemapArg;
  var source = fn.toString();
  var lines = source.split('\n');
  lines.pop();
  lines.shift();
  var blankPrefixLength = lines[0].search(/\S/);
  var regex = /(['"])__worker_loader_strict__(['"])/g;
  for (var i = 0, n = lines.length; i < n; ++i) {
    lines[i] =
      lines[i].substring(blankPrefixLength).replace(regex, '$1use strict$2') +
      '\n';
  }
  if (sourcemap) {
    lines.push('//# sourceMappingURL=' + sourcemap + '\n');
  }
  return lines;
}

function createURL(fn, sourcemapArg) {
  var lines = funcToSource(fn, sourcemapArg);
  var blob = new Blob(lines, { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}

function createInlineWorkerFactory(fn, sourcemapArg) {
  var url;
  return function WorkerFactory(options) {
    url = url || createURL(fn, sourcemapArg);
    return new Worker(url, options);
  };
}

var WorkerFactory = createInlineWorkerFactory(
  /* rollup-plugin-web-worker-loader */ function () {
    (function () {
      '__worker_loader_strict__';

      var WorkerMessageType;
      (function (WorkerMessageType) {
        const INIT = 0;
        WorkerMessageType[(WorkerMessageType['INIT'] = INIT)] = 'INIT';
        const APPLY_COMMANDS = INIT + 1;
        WorkerMessageType[
          (WorkerMessageType['APPLY_COMMANDS'] = APPLY_COMMANDS)
        ] = 'APPLY_COMMANDS';
      })(WorkerMessageType || (WorkerMessageType = {}));

      let wasm;

      const heap = new Array(128).fill(undefined);

      heap.push(undefined, null, true, false);

      function getObject(idx) {
        return heap[idx];
      }

      let heap_next = heap.length;

      function dropObject(idx) {
        if (idx < 132) return;
        heap[idx] = heap_next;
        heap_next = idx;
      }

      function takeObject(idx) {
        const ret = getObject(idx);
        dropObject(idx);
        return ret;
      }

      const cachedTextDecoder = new TextDecoder('utf-8', {
        ignoreBOM: true,
        fatal: true,
      });

      cachedTextDecoder.decode();

      let cachedUint8Memory0 = null;

      function getUint8Memory0() {
        if (
          cachedUint8Memory0 === null ||
          cachedUint8Memory0.byteLength === 0
        ) {
          cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
        }
        return cachedUint8Memory0;
      }

      function getStringFromWasm0(ptr, len) {
        return cachedTextDecoder.decode(
          getUint8Memory0().subarray(ptr, ptr + len)
        );
      }

      function addHeapObject(obj) {
        if (heap_next === heap.length) heap.push(heap.length + 1);
        const idx = heap_next;
        heap_next = heap[idx];

        heap[idx] = obj;
        return idx;
      }

      let WASM_VECTOR_LEN = 0;

      const cachedTextEncoder = new TextEncoder('utf-8');

      const encodeString =
        typeof cachedTextEncoder.encodeInto === 'function'
          ? function (arg, view) {
              return cachedTextEncoder.encodeInto(arg, view);
            }
          : function (arg, view) {
              const buf = cachedTextEncoder.encode(arg);
              view.set(buf);
              return {
                read: arg.length,
                written: buf.length,
              };
            };

      function passStringToWasm0(arg, malloc, realloc) {
        if (realloc === undefined) {
          const buf = cachedTextEncoder.encode(arg);
          const ptr = malloc(buf.length);
          getUint8Memory0()
            .subarray(ptr, ptr + buf.length)
            .set(buf);
          WASM_VECTOR_LEN = buf.length;
          return ptr;
        }

        let len = arg.length;
        let ptr = malloc(len);

        const mem = getUint8Memory0();

        let offset = 0;

        for (; offset < len; offset++) {
          const code = arg.charCodeAt(offset);
          if (code > 0x7f) break;
          mem[ptr + offset] = code;
        }

        if (offset !== len) {
          if (offset !== 0) {
            arg = arg.slice(offset);
          }
          ptr = realloc(ptr, len, (len = offset + arg.length * 3));
          const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
          const ret = encodeString(arg, view);

          offset += ret.written;
        }

        WASM_VECTOR_LEN = offset;
        return ptr;
      }

      function isLikeNone(x) {
        return x === undefined || x === null;
      }

      let cachedInt32Memory0 = null;

      function getInt32Memory0() {
        if (
          cachedInt32Memory0 === null ||
          cachedInt32Memory0.byteLength === 0
        ) {
          cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
        }
        return cachedInt32Memory0;
      }

      let cachedFloat64Memory0 = null;

      function getFloat64Memory0() {
        if (
          cachedFloat64Memory0 === null ||
          cachedFloat64Memory0.byteLength === 0
        ) {
          cachedFloat64Memory0 = new Float64Array(wasm.memory.buffer);
        }
        return cachedFloat64Memory0;
      }

      function debugString(val) {
        // primitive types
        const type = typeof val;
        if (type == 'number' || type == 'boolean' || val == null) {
          return `${val}`;
        }
        if (type == 'string') {
          return `"${val}"`;
        }
        if (type == 'symbol') {
          const description = val.description;
          if (description == null) {
            return 'Symbol';
          } else {
            return `Symbol(${description})`;
          }
        }
        if (type == 'function') {
          const name = val.name;
          if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
          } else {
            return 'Function';
          }
        }
        // objects
        if (Array.isArray(val)) {
          const length = val.length;
          let debug = '[';
          if (length > 0) {
            debug += debugString(val[0]);
          }
          for (let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
          }
          debug += ']';
          return debug;
        }
        // Test for built-in
        const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
        let className;
        if (builtInMatches.length > 1) {
          className = builtInMatches[1];
        } else {
          // Failed to match the standard '[object ClassName]'
          return toString.call(val);
        }
        if (className == 'Object') {
          // we're a user defined class or Object
          // JSON.stringify avoids problems with cycles, and is generally much
          // easier than looping through ownProperties of `val`.
          try {
            return 'Object(' + JSON.stringify(val) + ')';
          } catch (_) {
            return 'Object';
          }
        }
        // errors
        if (val instanceof Error) {
          return `${val.name}: ${val.message}\n${val.stack}`;
        }
        // TODO we could test for more things here, like `Set`s and `Map`s.
        return className;
      }
      /**
       */
      function initPanicHook() {
        wasm.initPanicHook();
      }

      function passArray8ToWasm0(arg, malloc) {
        const ptr = malloc(arg.length * 1);
        getUint8Memory0().set(arg, ptr / 1);
        WASM_VECTOR_LEN = arg.length;
        return ptr;
      }

      function getArrayU8FromWasm0(ptr, len) {
        return getUint8Memory0().subarray(ptr / 1, ptr / 1 + len);
      }
      /**
       * @param {Uint8Array} data
       * @param {string} format_type
       * @param {any} commands
       * @returns {Uint8Array}
       */
      function applyCommands(data, format_type, commands) {
        try {
          const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
          const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
          const len0 = WASM_VECTOR_LEN;
          const ptr1 = passStringToWasm0(
            format_type,
            wasm.__wbindgen_malloc,
            wasm.__wbindgen_realloc
          );
          const len1 = WASM_VECTOR_LEN;
          wasm.applyCommands(
            retptr,
            ptr0,
            len0,
            ptr1,
            len1,
            addHeapObject(commands)
          );
          var r0 = getInt32Memory0()[retptr / 4 + 0];
          var r1 = getInt32Memory0()[retptr / 4 + 1];
          var r2 = getInt32Memory0()[retptr / 4 + 2];
          var r3 = getInt32Memory0()[retptr / 4 + 3];
          if (r3) {
            throw takeObject(r2);
          }
          var v2 = getArrayU8FromWasm0(r0, r1).slice();
          wasm.__wbindgen_free(r0, r1 * 1);
          return v2;
        } finally {
          wasm.__wbindgen_add_to_stack_pointer(16);
        }
      }

      function handleError(f, args) {
        try {
          return f.apply(this, args);
        } catch (e) {
          wasm.__wbindgen_exn_store(addHeapObject(e));
        }
      }

      function notDefined(what) {
        return () => {
          throw new Error(`${what} is not defined`);
        };
      }

      async function load(module, imports) {
        if (typeof Response === 'function' && module instanceof Response) {
          if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
              return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
              if (module.headers.get('Content-Type') != 'application/wasm') {
                console.warn(
                  '`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
                  e
                );
              } else {
                throw e;
              }
            }
          }

          const bytes = await module.arrayBuffer();
          return await WebAssembly.instantiate(bytes, imports);
        } else {
          const instance = await WebAssembly.instantiate(module, imports);

          if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
          } else {
            return instance;
          }
        }
      }

      function getImports() {
        const imports = {};
        imports.wbg = {};
        imports.wbg.__wbindgen_object_drop_ref = function (arg0) {
          takeObject(arg0);
        };
        imports.wbg.__wbindgen_error_new = function (arg0, arg1) {
          const ret = new Error(getStringFromWasm0(arg0, arg1));
          return addHeapObject(ret);
        };
        imports.wbg.__wbindgen_string_get = function (arg0, arg1) {
          const obj = getObject(arg1);
          const ret = typeof obj === 'string' ? obj : undefined;
          var ptr0 = isLikeNone(ret)
            ? 0
            : passStringToWasm0(
                ret,
                wasm.__wbindgen_malloc,
                wasm.__wbindgen_realloc
              );
          var len0 = WASM_VECTOR_LEN;
          getInt32Memory0()[arg0 / 4 + 1] = len0;
          getInt32Memory0()[arg0 / 4 + 0] = ptr0;
        };
        imports.wbg.__wbindgen_is_object = function (arg0) {
          const val = getObject(arg0);
          const ret = typeof val === 'object' && val !== null;
          return ret;
        };
        imports.wbg.__wbindgen_jsval_loose_eq = function (arg0, arg1) {
          const ret = getObject(arg0) == getObject(arg1);
          return ret;
        };
        imports.wbg.__wbindgen_boolean_get = function (arg0) {
          const v = getObject(arg0);
          const ret = typeof v === 'boolean' ? (v ? 1 : 0) : 2;
          return ret;
        };
        imports.wbg.__wbindgen_number_get = function (arg0, arg1) {
          const obj = getObject(arg1);
          const ret = typeof obj === 'number' ? obj : undefined;
          getFloat64Memory0()[arg0 / 8 + 1] = isLikeNone(ret) ? 0 : ret;
          getInt32Memory0()[arg0 / 4 + 0] = !isLikeNone(ret);
        };
        imports.wbg.__wbg_String_88810dfeb4021902 = function (arg0, arg1) {
          const ret = String(getObject(arg1));
          const ptr0 = passStringToWasm0(
            ret,
            wasm.__wbindgen_malloc,
            wasm.__wbindgen_realloc
          );
          const len0 = WASM_VECTOR_LEN;
          getInt32Memory0()[arg0 / 4 + 1] = len0;
          getInt32Memory0()[arg0 / 4 + 0] = ptr0;
        };
        imports.wbg.__wbg_get_27fe3dac1c4d0224 = function (arg0, arg1) {
          const ret = getObject(arg0)[arg1 >>> 0];
          return addHeapObject(ret);
        };
        imports.wbg.__wbg_length_e498fbc24f9c1d4f = function (arg0) {
          const ret = getObject(arg0).length;
          return ret;
        };
        imports.wbg.__wbindgen_is_function = function (arg0) {
          const ret = typeof getObject(arg0) === 'function';
          return ret;
        };
        imports.wbg.__wbg_next_b7d530c04fd8b217 = function (arg0) {
          const ret = getObject(arg0).next;
          return addHeapObject(ret);
        };
        imports.wbg.__wbg_next_88560ec06a094dea = function () {
          return handleError(function (arg0) {
            const ret = getObject(arg0).next();
            return addHeapObject(ret);
          }, arguments);
        };
        imports.wbg.__wbg_done_1ebec03bbd919843 = function (arg0) {
          const ret = getObject(arg0).done;
          return ret;
        };
        imports.wbg.__wbg_value_6ac8da5cc5b3efda = function (arg0) {
          const ret = getObject(arg0).value;
          return addHeapObject(ret);
        };
        imports.wbg.__wbg_iterator_55f114446221aa5a = function () {
          const ret = Symbol.iterator;
          return addHeapObject(ret);
        };
        imports.wbg.__wbg_get_baf4855f9a986186 = function () {
          return handleError(function (arg0, arg1) {
            const ret = Reflect.get(getObject(arg0), getObject(arg1));
            return addHeapObject(ret);
          }, arguments);
        };
        imports.wbg.__wbg_call_95d1ea488d03e4e8 = function () {
          return handleError(function (arg0, arg1) {
            const ret = getObject(arg0).call(getObject(arg1));
            return addHeapObject(ret);
          }, arguments);
        };
        imports.wbg.__wbg_parseFloat_cb5f4687ae0be33e = function (arg0, arg1) {
          const ret = parseFloat(getStringFromWasm0(arg0, arg1));
          return ret;
        };
        imports.wbg.__wbg_isArray_39d28997bf6b96b4 = function (arg0) {
          const ret = Array.isArray(getObject(arg0));
          return ret;
        };
        imports.wbg.__wbg_instanceof_ArrayBuffer_a69f02ee4c4f5065 = function (
          arg0
        ) {
          let result;
          try {
            result = getObject(arg0) instanceof ArrayBuffer;
          } catch {
            result = false;
          }
          const ret = result;
          return ret;
        };
        imports.wbg.__wbg_entries_4e1315b774245952 = function (arg0) {
          const ret = Object.entries(getObject(arg0));
          return addHeapObject(ret);
        };
        imports.wbg.__wbg_buffer_cf65c07de34b9a08 = function (arg0) {
          const ret = getObject(arg0).buffer;
          return addHeapObject(ret);
        };
        imports.wbg.__wbg_new_537b7341ce90bb31 = function (arg0) {
          const ret = new Uint8Array(getObject(arg0));
          return addHeapObject(ret);
        };
        imports.wbg.__wbg_set_17499e8aa4003ebd = function (arg0, arg1, arg2) {
          getObject(arg0).set(getObject(arg1), arg2 >>> 0);
        };
        imports.wbg.__wbg_length_27a2afe8ab42b09f = function (arg0) {
          const ret = getObject(arg0).length;
          return ret;
        };
        imports.wbg.__wbg_instanceof_Uint8Array_01cebe79ca606cca = function (
          arg0
        ) {
          let result;
          try {
            result = getObject(arg0) instanceof Uint8Array;
          } catch {
            result = false;
          }
          const ret = result;
          return ret;
        };
        imports.wbg.__wbg_random_afb3265527cf67c8 =
          typeof Math.random == 'function'
            ? Math.random
            : notDefined('Math.random');
        imports.wbg.__wbg_new_abda76e883ba8a5f = function () {
          const ret = new Error();
          return addHeapObject(ret);
        };
        imports.wbg.__wbg_stack_658279fe44541cf6 = function (arg0, arg1) {
          const ret = getObject(arg1).stack;
          const ptr0 = passStringToWasm0(
            ret,
            wasm.__wbindgen_malloc,
            wasm.__wbindgen_realloc
          );
          const len0 = WASM_VECTOR_LEN;
          getInt32Memory0()[arg0 / 4 + 1] = len0;
          getInt32Memory0()[arg0 / 4 + 0] = ptr0;
        };
        imports.wbg.__wbg_error_f851667af71bcfc6 = function (arg0, arg1) {
          try {
            console.error(getStringFromWasm0(arg0, arg1));
          } finally {
            wasm.__wbindgen_free(arg0, arg1);
          }
        };
        imports.wbg.__wbindgen_debug_string = function (arg0, arg1) {
          const ret = debugString(getObject(arg1));
          const ptr0 = passStringToWasm0(
            ret,
            wasm.__wbindgen_malloc,
            wasm.__wbindgen_realloc
          );
          const len0 = WASM_VECTOR_LEN;
          getInt32Memory0()[arg0 / 4 + 1] = len0;
          getInt32Memory0()[arg0 / 4 + 0] = ptr0;
        };
        imports.wbg.__wbindgen_throw = function (arg0, arg1) {
          throw new Error(getStringFromWasm0(arg0, arg1));
        };
        imports.wbg.__wbindgen_memory = function () {
          const ret = wasm.memory;
          return addHeapObject(ret);
        };

        return imports;
      }

      function finalizeInit(instance, module) {
        wasm = instance.exports;
        init.__wbindgen_wasm_module = module;
        cachedFloat64Memory0 = null;
        cachedInt32Memory0 = null;
        cachedUint8Memory0 = null;

        return wasm;
      }

      async function init(input) {
        if (typeof input === 'undefined') {
          input = new URL(
            'gif_wasm_bg.wasm',
            (document.currentScript && document.currentScript.src) ||
              new URL('worker.js', document.baseURI).href
          );
        }
        const imports = getImports();

        if (
          typeof input === 'string' ||
          (typeof Request === 'function' && input instanceof Request) ||
          (typeof URL === 'function' && input instanceof URL)
        ) {
          input = fetch(input);
        }

        const { instance, module } = await load(await input, imports);

        return finalizeInit(instance, module);
      }

      function _loadWasmModule(sync, filepath, src, imports) {
        function _instantiateOrCompile(source, imports, stream) {
          var instantiateFunc = stream
            ? WebAssembly.instantiateStreaming
            : WebAssembly.instantiate;
          var compileFunc = stream
            ? WebAssembly.compileStreaming
            : WebAssembly.compile;

          if (imports) {
            return instantiateFunc(source, imports);
          } else {
            return compileFunc(source);
          }
        }

        var buf = null;
        var isNode =
          typeof process !== 'undefined' &&
          process.versions != null &&
          process.versions.node != null;
        if (isNode) {
          buf = Buffer.from(src, 'base64');
        } else {
          var raw = globalThis.atob(src);
          var rawLength = raw.length;
          buf = new Uint8Array(new ArrayBuffer(rawLength));
          for (var i = 0; i < rawLength; i++) {
            buf[i] = raw.charCodeAt(i);
          }
        }

        if (sync) {
          var mod = new WebAssembly.Module(buf);
          return imports ? new WebAssembly.Instance(mod, imports) : mod;
        } else {
          return _instantiateOrCompile(buf, imports, false);
        }
      }

      function gifWasm(imports) {
        return _loadWasmModule(
          0,
          null,
          'AGFzbQEAAAABuAIqYAJ/fwF/YAJ/fwBgA39/fwF/YAF/AGABfwF/YAN/f38AYAR/f39/AGAGf39/f39/AGABfwF+YAV/f39/fwBgAn99AX1gBX9/f39/AX9gAAF/YAN/f30AYAAAYAJ9fQF9YAJ/fwF8YAF9AX1gBn9/f39/fwF/YAN/fX8AYAd/f39/f39/AX9gA399fQBgBH9/f38Bf2AAAXxgCH9/f39/f39/AGACf30AYAR/f35+AGAHf39/f39/fwBgCX9/f39/f35+fgBgAn9/AX5gA35/fwF/YAR/f319AGATf39/f39/f39/f39/f39/f39/fwF/YAt/f39/f39/f39/fwF/YAN/fn4AYAV/f31/fwBgBH99f38AYAV/f35/fwBgBH9+f38AYAV/f3x/fwBgBH98f38AYAF8AXwCgAkiA3diZxpfX3diaW5kZ2VuX29iamVjdF9kcm9wX3JlZgADA3diZxRfX3diaW5kZ2VuX2Vycm9yX25ldwAAA3diZxVfX3diaW5kZ2VuX3N0cmluZ19nZXQAAQN3YmcUX193YmluZGdlbl9pc19vYmplY3QABAN3YmcZX193YmluZGdlbl9qc3ZhbF9sb29zZV9lcQAAA3diZxZfX3diaW5kZ2VuX2Jvb2xlYW5fZ2V0AAQDd2JnFV9fd2JpbmRnZW5fbnVtYmVyX2dldAABA3diZx1fX3diZ19TdHJpbmdfODg4MTBkZmViNDAyMTkwMgABA3diZxpfX3diZ19nZXRfMjdmZTNkYWMxYzRkMDIyNAAAA3diZx1fX3diZ19sZW5ndGhfZTQ5OGZiYzI0ZjljMWQ0ZgAEA3diZxZfX3diaW5kZ2VuX2lzX2Z1bmN0aW9uAAQDd2JnG19fd2JnX25leHRfYjdkNTMwYzA0ZmQ4YjIxNwAEA3diZxtfX3diZ19uZXh0Xzg4NTYwZWMwNmEwOTRkZWEABAN3YmcbX193YmdfZG9uZV8xZWJlYzAzYmJkOTE5ODQzAAQDd2JnHF9fd2JnX3ZhbHVlXzZhYzhkYTVjYzViM2VmZGEABAN3YmcfX193YmdfaXRlcmF0b3JfNTVmMTE0NDQ2MjIxYWE1YQAMA3diZxpfX3diZ19nZXRfYmFmNDg1NWY5YTk4NjE4NgAAA3diZxtfX3diZ19jYWxsXzk1ZDFlYTQ4OGQwM2U0ZTgAAAN3YmchX193YmdfcGFyc2VGbG9hdF9jYjVmNDY4N2FlMGJlMzNlABADd2JnHl9fd2JnX2lzQXJyYXlfMzlkMjg5OTdiZjZiOTZiNAAEA3diZy1fX3diZ19pbnN0YW5jZW9mX0FycmF5QnVmZmVyX2E2OWYwMmVlNGM0ZjUwNjUABAN3YmceX193YmdfZW50cmllc180ZTEzMTViNzc0MjQ1OTUyAAQDd2JnHV9fd2JnX2J1ZmZlcl9jZjY1YzA3ZGUzNGI5YTA4AAQDd2JnGl9fd2JnX25ld181MzdiNzM0MWNlOTBiYjMxAAQDd2JnGl9fd2JnX3NldF8xNzQ5OWU4YWE0MDAzZWJkAAUDd2JnHV9fd2JnX2xlbmd0aF8yN2EyYWZlOGFiNDJiMDlmAAQDd2JnLF9fd2JnX2luc3RhbmNlb2ZfVWludDhBcnJheV8wMWNlYmU3OWNhNjA2Y2NhAAQDd2JnHV9fd2JnX3JhbmRvbV9hZmIzMjY1NTI3Y2Y2N2M4ABcDd2JnGl9fd2JnX25ld19hYmRhNzZlODgzYmE4YTVmAAwDd2JnHF9fd2JnX3N0YWNrXzY1ODI3OWZlNDQ1NDFjZjYAAQN3YmccX193YmdfZXJyb3JfZjg1MTY2N2FmNzFiY2ZjNgABA3diZxdfX3diaW5kZ2VuX2RlYnVnX3N0cmluZwABA3diZxBfX3diaW5kZ2VuX3Rocm93AAEDd2JnEV9fd2JpbmRnZW5fbWVtb3J5AAwD1QPTAwkYBwcNAgYHAQQBBgcFAAcBBgEFBgEBABkAEQMABQUJGgICBQUBARIFBwkGAxMEAgUCBgEAAwUBAQEBAQMBCwEBEwECAwIBAAEBGwAcAAAHABQEDQIACwAAAAAAAB0eBQMGAAYDAwAfAgEBBQEADAABAwMBBQEGAAABAAcEBQUFAAABBQEBAQEBAQUFAQEFBQAgAAkLBgsBIQYDBBQBAAcAAAAAAAEDFQABBAMBAQAJACICBQUBBQAMFQAAAQEEAQAAAwAJAAAAAAABAAAAAAAAAAAAAAAABAMNAwAAAwEBDgABAQABAQMDAAAAAAAAAQEFAAICBgICAQcCAgEDDgEBAAULAAAAAAAAAQEBAAMAAAQFDgAAAAAABQUBBgUAAAABAQMFBgMCBQASAQAAAAAJCyMlJwABAAEDAwEG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EWxBfwJ/IAwgAkMAAIBPXXEEQCACqQwBC0EAC0EAIAwbIAJD//9/T14bakECdGooAAALIQwgBiANNgJYIABBA00NBCABIAw2AAAgC0EBaiELIAEgDWohASAAIA1rIgANAAsLIAkgCmohCSAIQQFqIQggByAKayIHDQALDAMLDAQLDAILIAYgCkECdCIONgJYIApFDQIgB0UNACABQQxqKAIAIRAgASgCBLMhEyABKAIAIhGzIRQgBioCxAEhFSAGKgLAASEWIAYqArwBIRcgBioCuAEhGCAGKgK0ASEZIAYqArABIRpBACEIA0AgCUUNASAHIA4gByAOSRsiCgRAIBYgCLMiApQhGyAZIAKUIRxBACELIAkhASAKIQADQEEEIAAgAEEETxshDSAYIBwgGiALsyISlJKSEPsCIQIgFSAbIBcgEpSSkhD7AiESAn9BACACQwAAAABdDQAaQQAgAiAUYA0AGkEAIBJDAAAAAF0NABpBACASIBNgDQAaIAJDAAAAAGAhDCAQQX8CfyASQwAAAABgIg8gEkMAAIBPXXEEQCASqQwBC0EAC0EAIA8bIBJD//9/T14bIBFsQX8CfyAMIAJDAACAT11xBEAgAqkMAQtBAAtBACAMGyACQ///f09eG2pBAnRqKAAACyEMIAYgDTYCWCAAQQNNDQQgASAMNgAAIAtBAWohCyABIA1qIQEgACANayIADQALCyAJIApqIQkgCEEBaiEIIAcgCmsiBw0ACwsgBkHQAmokAA8LIAZBADYCiAJBACAGQdgAakGAncAAIAZBgAJqQYSdwAAQ5gEACyAGQQA2ApQCIAZBtKnAADYCkAIgBkEBNgKMAiAGQdypwAA2AogCIAZBADYCgAJBASAGQdgAakG0qcAAIAZBgAJqQbSqwAAQ5gEAC4AbAhl/A3wjAEGwBGsiAyQAIANCADcDmAEgA0IANwOQASADQgA3A4gBIANCADcDgAEgA0IANwN4IANCADcDcCADQgA3A2ggA0IANwNgIANCADcDWCADQgA3A1AgA0IANwNIIANCADcDQCADQgA3AzggA0IANwMwIANCADcDKCADQgA3AyAgA0IANwMYIANCADcDECADQgA3AwggA0IANwMAIANCADcDuAIgA0IANwOwAiADQgA3A6gCIANCADcDoAIgA0IANwOYAiADQgA3A5ACIANC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AwAgCUEgaiAKQbAEaikDADcDACAKKQKUBCE4IAkgCigCnAQ2AgwgCSA4NwIEDBYLIApBuARqIgUgCkEIakGIBBDQAxogCkGQBGogBRBbIAooApAEIghBBkYNEiAJIAopA6AENwMQIAlBGGogCkGoBGopAwA3AwAgCUEgaiAKQbAEaikDADcDACAKKQKUBCE4IAkgCigCnAQ2AgwgCSA4NwIEDBULIApBuARqIgUgCkEIakGIBBDQAxogCkGQBGogBRBaIAooApAEIghBBkYNECAJIAopA6AENwMQIAlBGGogCkGoBGopAwA3AwAgCUEgaiAKQbAEaikDADcDACAKKQKUBCE4IAkgCigCnAQ2AgwgCSA4NwIEDBQLIApBuARqIgUgCkEIakGIBBDQAxogCkGQBGogBRBaIAooApAEIghBBkYNDiAJIAopA6AENwMQIAlBGGogCkGoBGopAwA3AwAgCUEgaiAKQbAEaikDADcDACAKKQKUBCE4IAkgCigCnAQ2AgwgCSA4NwIEDBMLIApBuARqIgUgCkEIakGIBBDQAxogCkGQBGogBRBaIAooApAEIghBBkYNDCAJIAopA6AENwMQIAlBGGogCkGoBGopAwA3AwAgCUEgaiAKQbAEaikDADcDACAKKQKUBCE4IAkgCigCnAQ2AgwgCSA4NwIEDBILIApBuARqIgUgCkEIakGIBBDQAxogCkGQBGogBRBaIAooApAEIghBBkYNCiAJIAopA6AENwMQIAlBGGogCkGoBGopAwA3AwAgCUEgaiAKQbAEaikDADcDACAKKQKUBCE4IAkgCigCnAQ2AgwgCSA4NwIEDBELIApBuARqIgUgCkEIakGIBBDQAxogCkGQBGogBRBdIAooApAEIghBBkYNCCAJIAopA6AENwMQIAlBGGogCkGoBGopAwA3AwAgCUEgaiAKQbAEaikDADcDACAKKQKUBCE4IAkgCigCnAQ2AgwgCSA4NwIEDBALIApBuARqIgUgCkEIakGIBBDQAxogCkGQBGogBRBdIAooApAEIghBBkYNBiAJIAopA6AENwMQIAlBGGogCkGoBGopAwA3AwAgCUEgaiAKQbAEaikDADcDACAKKQKUBCE4IAkgCigCnAQ2AgwgCSA4NwIEDA8LIApBuARqIgUgCkEIakGIBBDQAxogCkGQBGogBRBdIAoo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QQFrDgIBAgALIAFBmARqKAIAIQYCQCABQZwEaigCACIDRQRAQQEhBAwBCyADQQBOIgVFDRIgAyAFEIwDIgRFDRcLIAQgBiADENADIQQgAUGQBGooAgAhBSABKAKMBCEGIAFBqARqKAIABEAgAUGsBGooAgAQPQsgASADNgKoBCABIAY2AqAEIAFBsARqIAM2AgAgAUGsBGogBDYCACABQaQEaiAFNgIADAILIAFBmARqKAIAIQYCQCABQZwEaigCACIDRQRAQQEhBAwBCyADQQBOIgVFDREgAyAFEIwDIgRFDRYLIAQgBiADENADIQQgAUGQBGooAgAhBiABKAKMBCIHIQUgAUGoBGooAgAEQCABQawEaigCABA9IAEoAowEIQULIAEgAzYCqAQgASAHNgKgBCABQbAEaiADNgIAIAFBrARqIAQ2AgAgAUGkBGogBjYCACAFQf////8DcSAFRw0EIAE1ApAEIAVBAnStfiISQiCIpw0EIBKnIgMgAUGcBGooAgAiBEsNBSADRQ0BIAFBmARqKAIAQQAgAxDOAxoMAQsgAUGsBGooAgAhBgJAIAFBsARqKAIAIgNFBEBBASEEDAELIANBAE4iBUUNECADIAUQjAMiBEUNFQsgBCAGIAMQ0AMhBCABQaQEaigCACEFIAEoAqAEIQYgAUGUBGooAgAEQCABQZgEaigCABA9CyABIAM2ApQEIAEgBjYCjAQgAUGcBGogAzYCACABQZgEaiAENgIAIAFBkARqIAU2AgALIAFBQGsoAgBBAkYNEiACQRhqIAFBEGoiDRC8AyACKAIcIQMgAigCGCEEIAJBEGogARCSAQJAIAMgAi0AECACLQARIAQQ1AFBAWtsIgNFBEBBASEFDAELIANBAE4iBEUNDyADIAQQjQMiBUUNBQsgAkHYAGogASAFIAMQLQJ/AkACQCACLQBYQSNHBEAgAkGAAWogAkHoAGooAgA2AgAgAkH4AGogAkHgAGopAwA3AwAgAiACKQNYNwNwIAJBmAFqIAJB8ABqEGggAigCmAEiBEEGRw0BCyABKAJAQQJGDRUgDRDwAiIHDQEgAUHUAGooAgAhBiABQdAAaigCACEEQQEMAgsgAkFAayACQagBaigCADYCACACQcwAaiACQbQBaikCADcCACACQdQAaiACQbwBaigCADYCACACIAIpA6ABNwM4IAIgAikCrAE3AkQgAigCnAEhASADRQ0DIAUQPQwDCyAHKAIQIQogBygCDCELIAcoAgghBiAHKAIEIQQgBy0AGSABIActABg6ALQERQshBwJAAkACQAJAAkACQAJAAkACQAJAIAgtAAAOCAECAwQPDw8PAAtBjI7AAEGUjsAAEJECAAsgBK0gBq1+IhJCIIhQIBKnIANNcQ0FIAMEQCAFED0LQamMwABBK0HQj8AAEJMCAAsCQCAEIARqIgggBEkNACAIrSAGrX4iEkIgiKcNACASpyADTQ0ECyADBEAgBRA9C0GpjMAAQStB+I7AABCTAgALAkAgBK1CA34iEkIgiKcNACASp60gBq1+IhJCIIinDQAgEqcgA00NAgsgAwRAIAUQPQtBqYzAAEErQeiOwAAQkwIACwJAIARB/////wNxIARHDQAgBEECdK0gBq1+IhJCIIinDQAgEqcgA00NBAsgAwRAIAUQPQtBqYzAAEErQdiOwAAQkwIACyACQawBaiADNgIAIAJBqAFqIAU2AgAgAkGkAWogAzYCACACQaABaiAGNgIAIAIgBDYCnAEgAkECNgKYASACQdgAaiACQZgBahDOASAHDQ8MAwsgAkGsAWogAzYCACACQagBaiAFNgIAIAJBpAFqIAM2AgAgAkGgAWogBjYCACACIAQ2ApwBIAJBATYCmAEgAkHYAGogAkGYAWoQzgEgBw0ODAILIAJBrAFqIAM2AgAgAkGoAWogBTYCACACQaQBaiADNgIAIAJBoAFqIAY2AgAgAiAENgKcASACQQA2ApgBIAJB2ABqIAJBmAFqEM4BIAdFDQEMDQsgAiADNgJoIAIgBTYCZCACIAM2AmAgAiAGNgJcIAIgBDYCWCAHDQwLIAIoAlgiBkH/////A3EgBkcNBiAGQQJ0rSACKAJcIgStfiISQiCIpw0GIBKnIgMgAkHoAGooAgAiBUsNByADRQ0MQQAgBCAGbEECdGshCCAGRSEFIAJB5ABqKAIAIQQgAUGYBGohDyABQZwEaiEQQQAhAwNAIAEoAowEIgcgAyALaiIJTSAFIApqIgwgASgCkAQiEU9yDQkgByAMbCAJakECdCIJQQRqIQcgCUF8Rg0KIAcgECgCACIMSw0LIA8oAgAgCWogBBBfIANBAWoiB0EAIAYgB0sbIQMgBSAGIAdNaiEFIARBBGohBCAIQQRqIggNAAsMDAsgAkFAayACQagBaikDADcDACACQcgAaiACQbABaikDADcDACACQdAAaiACQbgBaikDADcDACACIAIpA6ABNwM4IAIoApwBIQELIAAgAikDODcDCCAAIAE2AgQgACAENgIAIABBIGogAkHQAGopAwA3AwAgAEEYaiACQcgAaikDADcDACAAQRBqIAJBQGspAwA3AwAMCwtBmInAAEErQbCKwAAQkwIACyADIARBoIrAABClAwALIAMgBBDKAwALQcCOwABByI7AABCRAgALQZiJwABBK0HEicAAEJMCAAsgAyAFQYiJwAAQpQMACyACQfwAakEFNgIAIAJBpAFqQQI2AgAgAkGsAWpBAjYCACACIAw2AsQBIAIgCTYCwAEgAkGgkcAANgKgASACQQA2ApgBIAJBBTYCdCACIBE2AswBIAIgBzYCyAEgAiACQfAAajYCqAEgAiACQcgBajYCeCACIAJBwAFqNgJwIAJBmAFqQbCRwAAQrAIAC0F8IAdB9JDAABCmAwALIAcgDEH0kMAAEKUDAAsgAkHwAGogAUGMBGogAkHYAGogCyAKEEwgAigCcEEGRg0AIAJBuAFqIAJBkAFqKQMANwMAIAJBsAFqIAJBiAFqKQMANwMAIAJBqAFqIAJBgAFqKQMANwMAIAJBoAFqIAJB+ABqKQMANwMAIAIgAikDcDcDmAFBiI/AAEElIAJBmAFqQbCPwABBwI/AABDRAQALIAEgDkEBazYCiAQgAigCYARAIAJB5ABqKAIAED0LIAFBmARqKAIAIQYCQCABQZwEaigCACIFRQRAQQEhBAwBCyAFQQBOIgNFDQIgBSADEIwDIgRFDQMLIAQgBiAFENADIQggASgCQEECRg0FIAFBkARqKAIAIQogASgCjAQhCyANEPACIgFFDQMCfyABLwEUIgNFBEBBACEEQQEMAQtBASEEQQEgA0HoB2wiBiABLwEWIgFB5AAgARsiB0YNABogBiAHcmghBAJAIAYgBmh2IgMgByAHaHYiAUYEQCADIQEMAQsDQAJAIAEgA08EQCABIANrIgEgAWh2IQEMAQsgAyABayIDIANodiEDCyABIANHDQALCyABIAR0IgFFDQUgBiABbiEEIAcgAW4LIQEgAkEIaiAEIAEQkAMgAigCDCEBIAIoAgghAyACIAU2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EIwDIgEEQCACQgA3ApQRIAJCgIACNwKMESACIAE2AogRIwBBEGsiAyQAIAJBmA5qIgFBADYBAiABQQVqQQA2AAAgAxCSAyADKAIIIQQgAykDACEJQYCAAkEBEIwDIgVFBEBBgIACQQEQygMACyABQagCahCUASABQaACakEANgIAIAFBnAJqIAU2AgAgAUGYAmpBgIACNgIAIAFBkAJqQgA3AwAgAUGIAmogBDYCACABIAk3A4ACIAFBADsBACABQQA6ANoCIAFBADsB2AIgAUEANgLQAiABQUBrQQI2AgAgA0EQaiQAIAJBKGoiAyABQYgDENADGiACQQA6AMADIAJBADYCuAMgAkEAOgCwAyACQX9C/////w8gByAHQv////8PWhunIAhQGzYCvAMgAkHIA2ogAxCbASACQZgOaiEDIAJBCGohBAJAAkACfyACLQDIA0EjRgRAIAIoAswDDAELIAJBqApqIAJB2ANqKAIANgIAIAJBoApqIAJB0ANqKQMANwMAIAIgAikDyAM3A5gKIAJBmA5qIAJBmApqEGggAigCmA4iAUEGRw0BIAIoApwOCyIBKAJAIQUgASgCRCEBAkACQAJAIAQoAhBBAUYEQCAEQRRqKAIAIAVJDQELIAQoAhhBAUYEQCAEQRxqKAIAIAFJDQILIANBBjYCAAwCCyADQgI3AgggA0EDNgIADAELIANCAjcCCCADQQM2AgALAkACQCACKAKYDiIBQQZGBEAgAkEQNgK4AyACQZgSaiIEIAJBKGpBoAMQ0AMaIAJBmA5qIQMjAEGgBGsiASQAIAFBCGogBBCbAQJAIAEtAAgiBUEjRgRAIAQgBC0AmAM6ANoCIAFBCGoiBSAEQZADENADGiAEKQOQAyEHIAFB1ANqIgRCADcCACAEQQA6ACggBEEQakIANwIAIARBCGpCADcCACABQcADakIBNwMAIAFBuANqQgA3AwAgAUHQA2pBADYCACABQQE6AIAEIAFCgICAgBA3A7ADIAFBATYCmAMgAUKAgICAEDcDyAMgAUIANwOgAyABIAc3A6gDIAFBiARqIAVBARA1IAEtAIgEIgRBI0YEQCADIAFBCGpBgAQQ0AMaDAILIAMgASkAiQQ3AAEgA0EQaiABQZgEaigAADYAACADQQlqIAFBkQRqKQAANwAAIANBAjYC0AIgAyAEOgAAIAFBCGoQVyABKAKwAwRAIAEoArQDED0LIAEoArwDBEAgASgCwAMQPQsgASgCyANFDQEgASgCzAMQPQwBCyADIAEvAAk7AAEgAyABKQMQNwIIIANBA2ogAS0ACzoAACADQRBqIAFBGGooAgA2AgAgASgCDCEGIANBAjYC0AIgAyAGNgIEIAMgBToAACAEEFcLIAFBoARqJAAgAigC6BBBAkcNASACQagSaiACQagOaigCADYCACACQaASaiACQaAOaikDADcDACACIAIpA5gONwOYEiACQZgKaiACQZgSahBoDAILIAAgAikCnA43AgQgAEEkaiACQbwOaigCADYCACAAQRxqIAJBtA5qKQIANwIAIABBFGogAkGsDmopAgA3AgAgAEEMaiACQaQOaikCADcCAAwDCyACQZgKaiACQZgOakGABBDQAxogAigC6AwiAUECRw0FCyACQegHaiACQbgKaikDACIHNwMAIAJB4AdqIAJBsApqKQMAIgg3AwAgAkHYB2ogAkGoCmopAwAiCTcDACACQdAHaiACQaAKaikDACIKNwMAIAIgAikDmAoiCzcDyAcgAEEgaiAHNwMAIABBGGogCDcDACAAQRBqIAk3AwAgAEEIaiAKNwMAIAAgCzcDACAAQQI2AtACDAULIAAgAikDoA43AwggAEEQaiACQagOaikDADcDACAAQRhqIAJBsA5qKQMANwMAIABBIGogAkG4DmopAwA3AwAgACACKAKcDjYCBAsgACABNgIAIABBAjYC0AIgAkEoahBXDAMLQYCAAkEBEMoDAAsgACACKQKcDjcCBCAAQSRqIAJBvA5qKAIANgIAIABBHGogAkG0DmopAgA3AgAgAEEUaiACQawOaikCADcCACAAQQxqIAJBpA5qKQIANwIAIABBAjYC0AIgACADNgIADAELIAJByAdqIgMgAkGYCmpB0AIQ0AMaIAJBnAZqIAJB7AxqQawBENADGiACQcgDaiIEIANB0AIQ0AMaIAIgATYCmAYgAiAEEJIBIAItAAEhAwJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIAItAABBAWsOBhQBBAIUAwALQQAhASADQQJrDg8NEw4TExMRExMTExMTEw8MC0ECIQEgA0ECaw4PCBIJEhISEBISEhISEhIKBwtBASEBIANB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azYCCCACQRBqJAAgAEEjOgAADAYLIABBIjoAAAwFCyADKAJQBEAgAygCVBA9CyADQQA2AlggA0KAgICAEDcDUCADQeAAaiABIANB0ABqEFIgAy0AeSICQQ5HDQALCyADQUBrIAZBCGooAgAiATYCACADIAYpAgAiCjcDOCADKQNgIQsgAEEQaiABNgIAIAAgCjcCCCAAIAs3AgALIAMoAlBFDQEgAygCVBA9DAELIANBATYCOCADQdAAaiADQThqEOoCIANB6wBqIANB2ABqKAIANgAAIAMgAykDUDcAYyAAQSE6AAAgACADKQBgNwABIABBCGogA0HnAGopAAA3AAALIANBkAFqJAAPC0Hcn8AAQStBvKLAABCTAgALswwBCX8CfwJAAkACQAJAAkACQAJAAkACQAJAAkACQCABQSBqKAIAIgogAkH//wNxIgdLBEAgAUEcaigCACAHQQF0ai8BACIFQQx2IggOAgECBAsgByAKQai9wgAQ2AEACyABQRRqKAIAIgcgBUH/H3EiBEsNASAEIAdBuL3CABDYAQALIAFBCGooAgAiBCAFQf8fcSICTQ0FQRAgAUEEaigCACACQTJsaiIGLQAwIgIgAkEQTxshAiAGQQJrIQQgBkEgaiEGIANB/wFxIQsDQCACRQ0CIAJBAWshAiAEQQJqIQQgBi0AACAGQQFqIQYgC0cNAAsgBC8BACECQQAMCgtBACABQRBqKAIAIARBCXRqIANB/wFxQQF0ai8BACICQYAgSQ0JGiABQRhqIQsMAQsgAUEYaiELAkACQCAIDgIBAwALIAFBCGoiBCgCACIGIQIgASgCACAGRgRAIwBBIGsiAiQAAkACQCAGQQFqIgVFDQBBBCABKAIAIghBAXQiCSAFIAUgCUkbIgUgBUEETRsiBUEybCEJIAVBqbi9FElBAXQhDAJAIAgEQCACQQI2AhggAiAIQTJsNgIUIAIgAUEEaigCADYCEAwBCyACQQA2AhgLIAIgCSAMIAJBEGoQuwEgAigCBCEIIAIoAgBFBEAgASAFNgIAIAFBBGogCDYCAAwCCyACQQhqKAIAIgVBgYCAgHhGDQEgBUUNACAIIAUQygMACxCgAgALIAJBIGokACAEKAIAIQILIAFBBGoiBSgCACACQTJsaiICQgA3AQAgAkEwakEAOgAAIAJBKGpCADcBACAC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BUEIaikCADcCACAAQQQ2AgAMBgsgAEEHNgIADAULIAIgCDYCQCACIAU2AjwgAiAINgI4IAIgBDYCNCACIAM2AjAgAigCHCACKAIYciABKAL4ASIIIANHckUgBCABKAL8ASIERnFFBEAgAiACQTBqNgKIASACIAJBDGo2AoQBIAIgAkEQajYCgAEgAkHoAGohAyACQYABaiEJIwBBQGoiASQAAkACQAJAAkACQAJAAkACQAJAIAhB/////wNxIAhHDQAgCEECdK0gBK1+IhlCIIinDQACQCAZpyIFRQRAIAMgBDYCBCADIAg2AgAgA0EQaiAFNgIAIANBDGpBATYCACADQQhqIAU2AgAMAQsgBUEATiIHRQ0CIAUgBxCNAyIGRQ0DIAMgBDYCBCADIAg2AgAgA0EQaiAFNgIAIANBDGogBjYCACADQQhqIAU2AgBBACAEIAhsQQJ0ayEDIAkoAgQhDyAJKAIAIQwgCEUhB0EBIQRBACEFA0AgDygCACIKQYQCaigCACELIAooAoACIg0gBU0gByALT3INBSAHIA1sIAVqQQJ0Ig1BBGohCyANQXxGDQYgCyAKQZACaigCACIOSw0HIApBjAJqKAIAIA1qIQsgBgJ/AkAgBSAMKAIIayIKIAkoAggiBSgCACINSQRAIAcgDCgCDGsiDiAFKAIESQ0BCyALKAAADAELIA0gDmwgCmpBAnQiDUEEaiEKIA1BfEYNCSAKIAVBEGooAgAiDksNCiABIAVBDGooAgAgDWooAAA2AgggDC0AGCALIAFBCGoQtAIgASgCCAs2AAAgByAEIAhPaiEHIARBACAEIAhJGyIFQQFqIQQgBkEEaiEGIANBBGoiAw0ACwsgAUFAayQADAgLQeCKwABBM0GUi8AAEKgDAAsQoAIACyAFIAcQygMACyABQSxqQQU2AgAgAUEUakECNgIAIAFBHGpBAjYCACABIAc2AjQgASAFNgIwIAFBgIrAADYCECABQQA2AgggAUEFNgIkIAEgCzYCPCABIA02AjggASABQSBqNgIYIAEgAUE4ajYCKCABIAFBMGo2AiAgAUEIakGQisAAEKwCAAtBfCALQdSJwAAQpgMACyALIA5B1InAABClAwALQXwgCkHAisAAEKYDAAsgCiAOQcCKwAAQpQMACyACQZABaiACQfgAaigCADYCACACQYgBaiACQfAAaikDADcDACACIAIpA2g3A4ABIABBBGogCUEAQQAgAigCECACKAIUEJsCIABBBjYCACACKAI4RQ0FIAIoAjwQPQwFCyACQYABaiEDAkACQAJAIAJBMGoiBSgCACIEQf////8DcSAERw0AIAU1AgQgBEECdK1+IhlCIIinDQAgGaciBiAFQRBqKAIAIgdLDQEgAyAENgIIIANCADcCACADQRhqQoCAgIDAADcCACADQRBqIAY2AgAgAyAFQQxqKAIAIgU2AgwgA0EUaiAFIAZqNgIADAILQZiJwABBK0GwisAAEJMCAAsgBiAHQaCKwAAQpQMACwJAAkACQAJAAkAgAigCkAEiAyACKAKcASIFSQ0AIAIoAowBIQYgBUEERgRAIAItACghDCACKAKAASIEQQAgBCACKAKIASIHSRshBSACKAKEASAEIAdPaiEEIAFBjAJqIQogAUGQAmohCwNAIAZFDQIgASgCgAIiCCAFTSABKAKEAiIJIARNcg0EIAQgCGwgBWpBAnQiCUEEaiEIIAlBfEYNBSAIIAsoAgAiDUsNBiAMIAooAgAgCWogBhC0AiAFQQFqIghBACAHIAhLGyEFIAQgByAITWohBCAGQQRqIQYgA0EEayIDQQRPDQALDAELIAYNAQsgAkGQAWogAkFAaygCADYCACACQYgBaiACQThqKQMANwMAIAIgAikDMDcDgAEgAEEEaiACQYABakEAQQAgAigCECACKAIUEJsCIABBBjYCAAwICyACIAU2AqABIAJBADYCiAFBACACQaABakGAncAAIAJBgAFqQYSdwAAQ5gEACyACQawBakEFNgIAIAJBjAFqQQI2AgAgAkGUAWpBAjYCACACIAQ2AlwgAiAFNgJYIAJBgLvAADYCiAEgAkEANgKAASACQQU2AqQBIAIgCTYCTCACIAg2AkggAiACQaABajYCkAEgAiACQcgAajYCqAEgAiACQdgAajYCoAEgAkGAAWpBkLvAABCsAgALQXwgCEHUusAAEKYDAAsgCCANQdS6wAAQpQMACyACQYgBaiACQfAAaigCADYCACACIAIpA2g3A4ABIAAgAkGAAWoQ3gEgCEUNAyAFED0MAwsgAkGIAWogAkHwAGooAgA2AgAgAiACKQNoNwOAASAAIAJBgAFqEN4BDAILEKACAAsgCCADEMoDAAsg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ACACLQAAajoAACAFQQNqIgIgBkEDai0AACACLQAAajoAACADIApBBGoiCkcNAAsLIBFFDQogByAKaiESIAogDWohCgNAIBIgCi0AACASLQAAajoAACASQQFqIRIgCkEBaiEKIBFBAWsiEQ0ACwwKC0EADQggBCASSQ0BIAQNAwwHC0EADQcgBCASTw0BC0H/g8EAIRBBPyERDAcLIARFDQEgByANLQAAIActAABqOgAAAkAgAkH/AXFBAUYNACAEQQFGDQIgByANLQABIActAAFqOgABIAJB/wFxQQJGDQAgBEECRg0CIAcgDS0AAiAHLQACajoAAiACQf8BcUEDRg0AIARBA0YNAiAHIA0tAAMgBy0AA2o6AAMgAkH/AXFBBEYNACAEQQRGDQIgByANLQAEIActAARqOgAEIAJB/wFxQQVGDQAgBEEFRg0CIAcgDS0ABSAHLQAFajoABSACQf8BcUEGRg0AIARBBkYNAiAHIA0tAAYgBy0ABmo6AAYgAkH/AXFBB0YNACAEQQdGDQIgByANLQAHIActAAdqOgAHCyAEIAQgEnBrIgMgEkkNAiADIBJrIhwgEkkNBiAHIBJqIQggDSASaiELIAJB/wFxIhhBAUYhBQNAIAggCmoiFCAULQAAIAcgCmoiFS0AACIJIAogDWoiFi0AACIDIAogC2oiFy0AACICIAIgCWogA2siECACayICIAJBEHRBH3UiAnMgAmtB//8DcSIGIBAgA2siAiACQRB0QR91IgJzIAJrQf//A3EiEUsbIgMgECAJayICIAJBEHRBH3UiAnMgAmtB//8DcSICIBFNGyADIAIgBk0bajoAAAJAIAUNACAUQQFqIgIgAi0AACAVQQFqLQAAIgkgFkEBai0AACIDIBdBAWotAAAiAiACIAlqIANrIhAgAmsiAiACQRB0QR91IgJzIAJrQf//A3EiBiAQIANrIgIgAkEQdEEfdSICcyACa0H//wNxIhFLGyIDIBAgCWsiAiACQRB0QR91IgJzIAJrQf//A3EiAiARTRsgAyACIAZNG2o6AAAgGEECRg0AIBRBAmoiAiACLQAAIBVBAmotAAAiCSAWQQJqLQAAIgMgF0ECai0AACICIAIgCWogA2siECACayICIAJBEHRBH3UiAnMgAmtB//8DcSIGIBAgA2siAiACQRB0QR91IgJzIAJrQf//A3EiEUsbIgMgECAJayICIAJBEHRBH3UiAnMgAmtB//8DcSICIBFNGyADIAIgBk0bajoAACAYQQNGDQAgFEEDaiICIAItAAAgFUEDai0AACIJIBZBA2otAAAiAyAXQQNqLQAAIgIgAiAJaiADayIQIAJrIgIgAkEQdEEfdSICcyACa0H//wNxIgYgECADayICIAJBEHRBH3UiAnMgAmtB//8DcSIRSxsiAyAQIAlrIgIgAkEQdEEfdSICcyACa0H//wNxIgIgEU0bIAMgAiAGTRtqOgAAIBhBBEYNACAUQQRqIgIgAi0AACAVQQRqLQAAIgkgFkEEai0AACIDIBdBBGotAAAiAiACIAlqIANrIhAgAmsiAiACQRB0QR91IgJzIAJrQf//A3EiBiAQIANrIgIgAkEQdEEfdSICcyACa0H//wNxIhFLGyIDIBAgCWsiAiACQRB0QR91IgJzIAJrQf//A3EiAiARTRsgAyACIAZNG2o6AAAgGEEFRg0AIBRBBWoiAiACLQAAIBVBBWotAAAiCSAWQQVqLQAAIgMgF0EFai0AACICIAIgCWogA2siECACayICIAJBEHRBH3UiAnMgAmtB//8DcSIGIBAgA2siAiACQRB0QR91IgJzIAJrQf//A3EiEUsbIgMgECAJayICIAJBEHRBH3UiAnMgAmtB//8DcSICIBFNGyADIAIgBk0bajoAACAYQQZGDQAgFEEGaiICIAItAAAgFUEGai0AACIJIBZBBmotAAAiAyAXQQZqLQAAIgIgAiAJaiADayIQIAJrIgIgAkEQdEEfdSICcyACa0H//wNxIgYgECADayICIAJBEHRBH3UiAnMgAmtB//8DcSIRSxsiAyAQIAlrIgIgAkEQdEEfdSICcyACa0H//wNxIgIgEU0bIAMgAiAGTRtqOgAAIBhBB0YNACAUQQdqIgIgAi0AACAVQQdqLQAAIgkgFkEHai0AACIDIBdBB2otAAAiAiACIAlqIANrIhAgAmsiAiACQRB0QR91IgJzIAJrQf//A3EiBiAQIANrIgIgAkEQdEEfdSICcyACa0H//wNxIhFLGyIDIBAgCWsiAiACQRB0QR91IgJzIAJrQf//A3EiAiARTRsgAyACIAZNG2o6AAALIAogEmohCkEAIRAgEiAcIBJrIhxNDQALDAYLIAcgBy0AACANLQAA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EJMCAAsgCiAEQZyFwQAQ2AEACyAEIARBjIXBABDYAQALQayFwQAhEEExIRELIBsgETYCBCAbIBA2AgAgDigCCCICBEAgDigCDCEBIA4gAjYCNCAOQR06ADAgDiABNgI4IABBBGogDkEwahC9AiAAQQE2AgAMAQsgDyABQbADaiIDKAIAIgJLDQYgAUGsA2oiAigCACAaIA8Q0AMaIAEgASgCnAMgD2o2ApwDIA8gAygCACIBSw0HIABBADYCACAAQRRqIBk2AgAgAEEQaiATNgIAIABBDWogDDoAACAAQQxqIB06AAAgAEEIaiAENgIAIAAgAigCAEEBajYCBAsgDkHQAGokAA8LIAUgC0GooMAAEKQDAAtBAEEAQbigwAAQ2AEAC0EBQQBByKDAABCmAwALIA8gBEHIoMAAEKUDAAsgDyAEQdigwAAQpQMACyAPIAJB6KDAABClAwALIA8gAUH4oMAAEKUDAAuOCgEBfyMAQTBrIgIkAAJ/AkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIAAtAABBAWsOEQECAwQFBgcICQoLDA0ODxARAAsgAiAALQABOgAIIAJBJGpBAjYCACACQSxqQQE2AgAgAkHEwMAANgIgIAJBADYCGCACQeIANgIUIAIgAkEQajYCKCACIAJBCGo2AhAgASACQRhqEPMBDBELIAIgACkDCDcDCCACQSRqQQI2AgAgAkEsakEBNgIAIAJBqMDAADYCICACQQA2AhggAkHjADYCFCACIAJBEGo2AiggAiACQQhqNgIQIAEgAkEYahDzAQwQCyACIAApAwg3AwggAkEkakECNgIAIAJBLGpBATYCACACQajAwAA2AiAgAkEANgIYIAJB5AA2AhQgAiACQRBqNgIoIAIgAkEIajYCECABIAJBGGoQ8wEMDwsgAiAAKwMIOQMIIAJBJGpBAjYCACACQSxqQQE2AgAgAkGMwMAANgIgIAJBADYCGCACQeUANgIUIAIgAkEQajYCKCACIAJBCGo2AhAgASACQRhqEPMBDA4LIAIgACgCBDYCCCACQSRqQQI2AgAgAkEsakEBNgIAIAJB7L/AADYCICACQQA2AhggAkHmADYCFCACIAJBEGo2AiggAiACQQhqNgIQIAEgAkEYahDzAQwNCyACIAApAgQ3AwggAkEkakEB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B3Q2AgAgACAENgKgASAADwtBf0EoQZiOwwAQ2AEAC8UIAQV/AkACQCACLQAAIgVFDQAgAi8BAg0AIAJBBGovAQBFDQELAkAgASgCACIDBEAgAUEAIAMbIgQoAgAiASgCACABKAIIIgNGBEAgASADQQEQrAEgASgCCCEDCyABIANBAWo2AgggASgCBCADakEhOgAAIAUEQCACQQRqLwEAIQUgAi8BAgJ/IAQoAgAiASgCACABKAIIIgNHBEAgAQwBCyABIANBARCsASABKAIIIQMgBCgCAAshAiABIANBAWo2AgggASgCBCADakH/AToAACACKAIIIgMgAigCAEcEfyACBSACIANBARCsASACKAIIIQMgBCgCAAshASACIANBAWo2AgggAigCBCADakELOgAAIAEoAgAgASgCCCICa0EKTQRAIAEgAkELEKwBIAEoAgghAgsgASACQQtqNgIIIAEoAgQgAmoiAUG7pMAAKQAANwAAIAFBB2pBwqTAACgAADYAAAJ/IAQoAgAiASgCACABKAIIIgNHBEAgAQwBCyABIANBARCsASABKAIIIQMgBCgCAAshAiABIANBAWo2AgggASgCBCADakEDOgAAIAIoAggiASACKAIARgRAIAIgAUEBEKwBIAIoAgghAQsgAiABQQFqNgIIIAIoAgQgAWpBAToAAARAIAQoAgAiAigCACACKAIIIgFrQQFNBEAgAiABQQIQrAEgAigCCCEBCyACIAFBAmo2AgggAigCBCABakEAOwAADAMLIAQoAgAiAigCACACKAIIIgFrQQFNBEAgAiABQQIQrAEgAigCCCEBCyACIAFBAmo2AgggAigCBCABaiIBIAVBgP4DcUEIdjoAASABIAU6AAAMAgsgAi0AAiEGIAIvAQQhBSACLQABIQcCfyAEKAIAIgEoAgAgASgCCCIDRwRAIAEMAQsgASADQQEQrAEgASgCCCEDIAQoAgALIQIgASADQQFqNgIIIAEoAgQgA2pB+QE6AAAgAigCCCIDIAIoAgBHBH8gAgUgAiADQQEQrAEgAigCCCEDIAQoAgALIQEgAiADQQFqNgIIIAIoAgQgA2pBBDoAACABKAIIIgIgASgCAEYEQCABIAJBARCsASABKAIIIQILIAEgAkEBajYCCCABKAIEIAJqIAc6AAAgBUGA/gNxQQh2IQcCfyAE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ACgCABEDACADKAIAIgNBBGooAgBFDQQgA0EIaigCABogAigCFBA9DAQLAkAgAigCBEECRw0AIAJBCGooAgBFDQAgAkEMaigCABA9CyACQRRqKAIAIgNFDQMgAyACQRhqIgMoAgAoAgARAwAgAygCACIDQQRqKAIARQ0DIANBCGooAgAaIAIoAhQQPQwDCwJAIAJBFGotAABBAWtBAUsNACACQRhqKAIARQ0AIAJBHGooAgAQPQsCQEEBIAItAAQiA0EEayADQQNNG0H/AXEOAgMAAgsgA0EBa0ECSQ0BDAILIAAgBSkCADcCACAAQRhqIAVBGGooAgA2AgAgAEEQaiAFQRBqKQIANwIAIABBCGogBUEIaikCADcCACAAIAg2AiAgACAHNgIcDAMLIAJBCGooAgBFDQAgAkEMaigCABA9CyACIAE2AgAgAiAINgIkIAIgBzYCICACIAUpAgA3AgQgAkEMaiAFQQhqKQIANwIAIAJBFGogBUEQaikCADcCACACQRxqIAVBGGooAgA2AgALIABBADYCHAsgBEEwaiQAC/QFAQd/An8gAQRAQStBgIDEACAAKAIYIglBAXEiARshCiABIAVqDAELIAAoAhghCUEtIQogBUEBagshCAJAIAlBBHFFBEBBACECDAELAkAgA0EQTwRAIAIgAxA7IQYMAQsgA0UEQAwBCyADQQNxIQsCQCADQQFrQQNJBEAgAiEBDAELIANBfHEhByACIQEDQCAGIAEsAABBv39KaiABLAABQb9/SmogASwAAkG/f0pqIAEsAANBv39KaiEGIAFBBGohASAHQQRrIgcNAAsLIAtFDQADQCAGIAEsAABBv39KaiEGIAFBAWohASALQQFrIgsNAAsLIAYgCGohCAsCQAJAIAAoAghFBEBBASEBIAAoAgAiByAAQQRqKAIAIgAgCiACIAMQpQINAQwCCwJAAkACQAJAIAggAEEMaigCACIHSQRAIAlBCHENBCAHIAhrIgYhB0EBIAAtACAiASABQQNGG0EDcSIBQQFrDgIBAgMLQQEhASAAKAIAIgcgAEEEaigCACIAIAogAiADEKUCDQQMBQtBACEHIAYhAQwBCyAGQQF2IQEgBkEBakEBdiEHCyABQQFqIQEgAEEEaigCACEGIAAoAhwhCCAAKAIAIQACQANAIAFBAWsiAUUNASAAIAgg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zcxMPl4NAAsLIAUgAm4hCSAEBEAgB0EgaiEIIAIgBUsNBkEAIQUDQAJ/EBsgAriiRAAAAAAAAAAAoJwiCkQAAAAAAADwQWMgCkQAAAAAAAAAAGYiAXEEQCAKqwwBC0EACyEGIAAoAggiAyACQQFrIgIgBWxBfyAGQQAgARsgCkQAAOD////vQWQbaiIGTQ0FIAdBEGogACgCBCAGQSRsaiIBQQhqKQIANwMAIAdBGGogAUEQaikCADcDACAIIAFBGGopAgA3AwAgB0EoaiABQSBqKAIANgIAIAcgASkCADcDCCABIAFBJGogAyAGQX9zakEkbBDRAyAAIANBAWs2AgggCCgCAARAIAcoAiQQPQsgBUEBaiAJcCEFIARBAWsiBA0ACwsgB0EwaiQADwsQoAIACyAGIAUQygMAC0GAsMAAQTlB7LLAABCTAgALIAYgAxDXAQALQdCywABBGUG4ssAAEJMCAAsgB0EIaiEDQX8CfxAbIAK4okQAAAAAAAAAAKCcIgpEAAAAAAAA8EFjIApEAAAAAAAAAABmIgFxBEAgCqsMAQtBAAtBACABGyAKRAAA4P///+9BZBshAgJAIAIgACgCCCIESQRAIAMgACgCBCACQSRsaiIBKQIANwIAIANBCGogAUEIaikCADcCACADQRBqIAFBEGopAgA3AgAgA0EYaiABQRhqKQIANwIAIANBIGogAUEgaigCADYCACABIAFBJGogBCACQX9zakEkbBDRAyAAIARBAWs2AggMAQsgAiAEENcBAAsgCBDcAkGAsMAAQTlBjLPAABCTAgALpwQBAn8gAEH0AmooAgAEQCAAQfACaigCABA9CyAAQZgCaigCAARAIABBnAJqKAIAED0LIABBsAJqKAIAED0gAEG0AmooAgAEQCAAQbgCaigCABA9CyAAQcACaigCAARAIABBxAJqKAIAED0LAkAgAEFAaygCAEECRg0AAkACQCAAKAIQDgMBAAEACyAAQRRqKAIARQ0AIABBGGooAgAQPQsCQAJAIABBIGooAgAOAwEAAQALIABBJGooAgBFDQAgAEEoaigCABA9CwJAAkAgAEEwaigCAA4DAQABAAsgAEE0aigCAEUNACAAQThqKAIAED0LIABB4ABqKAIAIgIEQCAAQdwAaigCACIBIAJBGGxqIQIDQCABKAIABEAgAUEEaigCABA9CyABQQxqKAIABEAgAUEQaigCABA9CyABQRhqIgEgAkcNAAsLIAAoAlgEQCAAQdwAaigCABA9CyAAQewAaigCACIBBEAgAUEcbCECIABB6ABqKAIAQRRqIQEDQCABQQRrKAIABEAgASgCABA9CyABQRBrKAIABEAgAUEMaygCABA9CyABQRxqIQEgAkEcayICDQALCyAAKAJkBEAgAEHoAGooAgAQPQsgAEHwAGoiARC8ASABKAIARQ0AIABB9ABqKAIAED0LIAAoAqgDBEAgAEGsA2ooAgAQPQsgACgCtAMEQCAAQbgDaigCABA9CyAAKALAAwRAIABBxANqKAIAED0LC/8EAgh/An0jAEEwayIDJAAgAEMAAMBAEDoCQAJAIABBCGooAgAiBEUNACAAQQRqKAIAIgUQ1gMoAgAhBiADQQhqIAUQtAMgAyADKAIIIAMoAgwQkAMgA0EYaiAFIARBfwJ/IAazIgsgCyADKAIAsyADKAIEs5RDAAAgQZWUIAFDAABIQpRDAAAAPpSVIgyVjiIBQwAAgE9dIAFDAAAAAGAiBnEEQCABqQwBC0EAC0EAIAYbIAFD//9/T14bEE0gBEEkbCEEA0AgBSAHaiIGQRhqKAIABEAgBkEcaigCABA9CyAEIAdBJGoiB0cNAAsgACgCAARAIAUQPQsgACADKQMYNwIAIABBCGoiBSADQSBqKAIANgIAAn8gC0MAAAAAYCIHIAtDAACAT11xBEAgC6kMAQtBAAshBCAFKAIAIgZFDQAgAEEEaigCACEAQX8gBEEAIAcbIAtD//9/T14bQQJ0IgVFDQFBPkE/IAIbIQkgACAGQSRsaiEGQQAhAgNAAn8gDCACs5QgCxDhAxD7AiIBQwAAgE9dIAFDAAAAAGAiCHEEQCABqQwBC0EACyEKIAAQ1gMhBCAAQSRqIQAgBSAEQRBqKAIAIgcgByAFcGsiB00EQEF/IApBACAIGyABQ///f09eG0ECdCEIIARBDGooAgAhBANAIAQgBSAIIAkRBQAgBCAFaiEEIAcgBWsiByAFTw0ACwsgAkEBaiECIAAgBkcNAAsLIANBMGokAA8LIAAQ1gMaIANBADYCFCADQQA2AiwgA0GgrsAANgIoIANBATYCJCADQdyvwAA2AiAgA0EANgIYQQEgA0EUakG0r8AAIANBGGpB5K/AABDmAQALmhMCBn8BfiMAQUBqIgUkACAFQQA2AgggBUKAgICAEDcDACAFQRBqIgIgBUHAk8AAEMYCIwBBMGsiAyQAAn8CQAJAAkACQAJAAkAgACgCAEEBaw4FAQIDBAUACyMAQTBrIgEkAAJ/AkAgAEEEaiIEKAIQRQRAIAQtAABBA0cNASABQRRqQQE2AgAgAUEcakEANgIAIAFBjM/AADYCECABQcjJwAA2AhggAUEANgIIIAIgAUEIahDzAQwCCyABIARBEGo2AgQgAUEUakECNgIAIAFBHGpBAjYCACABQSxqQY0BNgIAIAFB6M7AADYCECABQQA2AgggAUGMATYCJCABIAQ2AiAgASABQSBqNgIYIAEgAUEEajYCKCACIAFBCGoQ8wEMAQsgAUEUakEBNgIAIAFBHGpBATYCACABQfjOwAA2AhAgAUEANgIIIAFBjAE2AiQgASAENgIgIAEgAUEgajYCGCACIAFBCGoQ8wELIAFBMGokAAwFCyAAQQRqIQEgAEEUaiIEKAIARQRAIANBJGpBATYCACADQSxqQQE2AgAgA0HIzsAANgIgIANBADYCGCADQYwBNgIMIAMgATYCCCADIANBCGo2AiggAiADQRhqEPMBDAULIAMgBDYCBCADQSRqQQI2AgAgA0EsakECNgIAIANBFGpBjQE2AgAgA0G4zsAANgIgIANBADYCGCADQYwBNgIMIAMgATYCCCADIANBCGo2AiggAyADQQRqNgIQIAIgA0EYahDzAQwECyMAQTBrIgEkAAJAAkACQAJAAkACQCAAQQRqIgYoAgBBAWsOAwABAgMLQQEhBCABQRxqQQE2AgAgAUEkakEANgIAIAFBzM3AADYCGCABQcjJwAA2AiAgAUEANgIQIAIgAUEQahDzAUUNAwwECyABIAZBBGo2AgxBASEEIAFBHGpBATYCACABQSRqQQE2AgAgAUGAzcAANgIYIAFBADYCECABQYoBNgIsIAEgAUEoajYCICABIAFBDGo2AiggAiABQRBqEPMBRQ0CDAMLQQEhBCABQRxqQQE2AgAgAUEkakEANgIAIAFB3MzAADYCGCABQcjJwAA2AiAgAUEANgIQIAIgAUEQahDzAUUNAQwCC0EBIQQgAUEcakEBNgIAIAFBJGpBADYCACABQYzOwAA2AhggAUHIycAANgIgIAFBADYCECACIAFBEGoQ8wENAQsgBigCEEUEQEEAIQQMAQsgASAGQRBqNgIMIAFBHGpBATYCACABQSRqQQE2AgAgAUGYzsAANgIYIAFBADYCECABQY0BNgIsIAEgAUEoajYCICABIAFBDGo2AiggAiABQRBqEPMBIQQLIAFBMGokACAEDAMLAkACQAJAQQIgACkDCCIHp0ECayAHQgFYG0EBaw4CAQIACyADQSRqQQE2AgAgA0EsakEANgIAIANBnNDAADYCICADQcjJwAA2AiggA0EANgIYIAIgA0EYahDzAQwECyADQSRqQQE2AgAgA0EsakEANgIAIANBgNDAADYCICADQcjJwAA2AiggA0EANgIYIAIgA0EYahDzAQwDCyADQSRqQQE2AgAgA0EsakEANgIAIANB5M/AADYCICADQcjJwAA2AiggA0EANgIYIAIgA0EYahDzAQwCCyMAQTBrIgEkAAJ/AkACQAJAAkACQAJAQQEgAEEEaiIELQAAIgZBBGsgBkEDTRtB/wFxQQFrDgIBAgALIAEgBEEBajYCBCABQRRqQQM2AgAgAUEcakECNgIAIAFBLGpBjgE2AgAgAUGczMAANgIQIAFBADYCCCABQYwBNgIkIAEgBEEQajYCICABIAFBIGo2AhggASABQQRqNgIoIAIgAUEIahDzAQwFCyAGQQJrDgICAwELIAEgBEEEajYCACAELQAQQQNGBEAgAUEUakEBNgIAIAFBHGpBATYCACABQcDKwAA2AhAgAUEANgIIIAFBigE2AiQgASABQSBqNgIYIAEgATYCICACIAFBCGoQ8wEMBAsgASAEQRBqNgIEIAFBFGpBAjYCACABQRxqQQI2AgAgAUEsakGKATYCACABQYDKwAA2AhAgAUEANgIIIAFBjwE2AiQgASABQSBqNgIYIAEgATYCKCABIAFBBGo2AiAgAiABQQhqEPMBDAMLIAEgBDYCBCABQRRqQQI2AgAgAUEcakEBNgIAIAFB7MrAADYCECABQQA2AgggAUGPATYCJCABIAFBIGo2AhggASABQQRqNgIgIAIgAUEIahDzAQwCCyABIAQ2AgQgAUEUakECNgIAIAFBHGpBATYCACABQejLwAA2AhAgAUEANgIIIAFBjwE2AiQgASABQSBqNgIYIAEgAUEEajYCICACIAFBCGoQ8wEMAQsgAUEUakEBNgIA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QRRqKAIADQEgAyEEDAMLQQAhAyABQRRqKAIADQFBASECDAQLIANBD0sNACAHKAIERQ0CCyADIANqIgQgA0kNAQsgBEUNAAJAIARBAE4EQCAEQQEQjAMiAkUNASAEIQMMAwsQoAIACyAEQQEQygMAC0EBIQJBACEDCyAAQQA2AgggACACNgIEIAAgAzYCACAFIAA2AgwgBUEgaiABQRBqKQIANwMAIAVBGGogAUEIaikCADcDACAFIAEpAgA3AxAgBUEMakGs2cIAIAVBEGoQUwRAQYzawgBBMyAFQShqQcDawgBB6NrCABDRAQALIAVBMGokAAvFBQIGfwF8IwBB0ABrIgMkAAJAIAAoAgAiBUGBARAEBEBBByEGQQAhAAwBCwJAAkACQCAFEAUOAgIBAAsgA0EQaiAFEAYgAygCEARAQQMhBiADKwMYIQlBACEADAMLIANBCGogBRACAn8gAygCCCIFBEAgAygCDCEEIAMgBTYCJCADIAQ2AiggAyAENgIgQQEhAEEFIQZBAAwBCwJ/AkACQCAAKAIAEBpFBEAgACgCABAURQ0CIAMgACgCABAXNgIgIANBOGogA0EgahDHASADKAJAIQQgAygCPCEFIAMoAjghByADKAIgIgZBhAFJDQEgBhAADAELIANBOGogABDHASADKAJAIQQgAygCPCEFIAMoAjghBwsgBUUNAEEGIQZBAAwBCyADQcoANgI0IAMgADYCMCADQQE2AkwgA0EBNgJEIANBvLvAADYCQCADQQA2AjggAyADQTBqNgJIIANBIGogA0E4ahBkQREhBiADKAIoIQQgAygCJCEFQQELIgBBAXMLIQggBK2/IQkMAgtBASEEC0EAIQALIAMgCTkDQCADIAU2AjwgAyAEOgA5IAMgBjoAOCMAQTBrIgQkACAEIAI2AgQgBCABNgIAIARBFGpBzwA2AgAgBEHQADYCDCAEIANBOGo2AgggBCAENgIQIARBAjYCLCAEQQI2AiQgBEG0vcAANgIgIARBADYCGCAEIARBCGo2AigCfyMAQUBqIgEkACABQQA2AgggAUKAgICAEDcDACABQRBqIgIgAUHcu8AAEMYCIARBGGogAhDxAUUEQCABKAIEIAEoAggQASABKAIABEAgASgCBBA9CyABQUBrJAAMAQtB9LvAAEE3IAFBOGpBrLzAAEGIvcAAENEBAAsgBEEwaiQAIAhFIAdFckUEQCAFED0LAkAgAEUNACADKAIgRQ0AIAUQPQsgA0HQAGokAAv/AgECfyAAQRRqKAIABEAgAEEQaigCABA9CwJAIABBOGooAgAiAUUNACABIABBPGoiASgCACgCABEDACABKAIAIgFBBGooAgBFDQAgAUEIaigCABogACgCOBA9CyAAQcQAaigCAARAIABByABqKAIAED0LIABB0ABqKAIABEAgAEHUAGooAgAQPQsgACgCKARAIABBLGooAgAQPQsCQCAAQegAaigCACIBQQJGDQACQCAAQfwAaigCACICRQ0AIABB+ABqKAIARQ0AIAIQPSAAKAJoIQELIAFFDQAgAEHsAGooAgBFDQAgAEHwAGooAgAQPQsCQCAAQbABaigCACIBRQ0AIAAoAqwBRQ0AIAEQPQsCQCAAQdgBaigCACIBRQ0AIABB1AFqKAIARQ0AIAEQPQsCQCAAKALEAUUNACAAQcgBaigCAEUNACAAQcwBaigCABA9CyAAKAK4AQRAIABBvAFqKAIAED0LIABBiAJqKAIABEAgAEGMAmooAgAQPQsLlAMBC38jAEEwayIDJAAgA0KBgICAoAE3AyAgAyACNgIcIANBADYCGCADIAI2AhQgAyABNgIQIAMgAjYCDCADQQA2AgggACgCBCEIIAAoAgAhCSAAKAIIIQoCfwNAAkAgBkUEQAJAIAIgBEkNAANAIAEgBGohBgJ/IAIgBGsiBUEITwRAIANBCiAGIAUQgwEgAygCBCEAIAMoAgAMAQtBACEAQQAgBUUNABoDQEEBIAAgBmotAABBCkYNARogBSAAQQFqIgBHDQALIAUhAEEAC0EBRwRAIAIhBAwCCyAAIARqIgBBAWohBAJAIAAgAk8NACAAIAFqLQAAQQpHDQBBACEGIAQhBSAEIQAMBAsgAiAETw0ACwtBASEGIAIiACAHIgVHDQELQQAMAgsCQCAKLQAABEAgCUHI98IAQQQgCCgCDBECAA0BCyABIAdqIQsgACAHayEMIAogACAHRwR/IAsgDGpBAWstAABBCkYFIA0LOgAAIAUhByAJIAsgDCAIKAIMEQIARQ0BCwtBAQsgA0EwaiQAC84DAQJ/IwBB4ABrIgIkAAJAAkACQAJAAkACQAJAQQEgAS0AACIDQR9rIANBHk0bQf8BcUEBaw4DAQIDAAsgAEEFNgIAIAAgASkCBDcCBAwDCyAAQQA7AQRBFEEEEIwDIgNFDQMgAEEANgIAIAMgASkCADcCACAAQRhqQezFwAA2AgAgAEEUaiADNgIAIANBEGogAUEQaigCADYCACADQQhqIAFBCGopAgA3AgAMAgsgAkEYaiABQRBqKAIANgIAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEANgIoIAJCgICAgBA3AyAgAkEwaiIBIAJBIGpBjMjAABDGAiACQQhqIAEQdw0DIABBCGogAikDIDcCACAAQRBqIAJBKGooAgA2AgAgAEEUakEANgIAIABCgoCAgCA3AwAgAi0ACEEfRw0BIAItAAxBA0cNASACQRBqKAIAIgAoAgAgACgCBCgCABEDACAAKAIEIgFBBGooAgAEQCABQQhqKAIAGiAAKAIAED0LIAIoAhAQPQwBCyAAQQM2AgAgAEIDNwMICyACQeAAaiQADwtBFEEEEMoDAAtBpMjAAEE3IAJB2ABqQdzIwABBuMnAABDRAQALwAQBA38jAEEwayICJAACfwJAAkACQAJAIAAoAgQiAw4DAAIDAQsjAEEQayIAJAAgAEGIwsAANgIIIABBDjYCBCAAQfrBwAA2AgAjAEEQayIBJAAgAUEIaiAAQQhqKAIANgIAIAEgACkCADcDACMAQRBrIgAkACAAIAEpAgA3AwggAEEIakGgwsAAQQAgASgCCEEBELUBAAsgAkEkakEBNgIAIAJBLGpBADYCACACQdzAwAA2AiAgAkH4vcAANgIoIAJBADYCGEEBIAEgAkEYahDzAQ0CGiADQQN0IQMgACgCACEAAkADQCACIAA2AhQgBARAIAJBATYCJCACQejAwAA2AiAgAkEANgIsIAJB+L3AADYCKCACQQA2AhggASACQRhqEPMBDQILIAJBAjYCJCACQfDAwAA2AiAgAkEBNgIsIAJBADYCGCACQegANgIEIAIgAjYCKCACIAJBFGo2AgAgASACQRhqEPMBDQEgAEEIaiEAIARBAWshBCADQQhrIgMNAAtBAAwDC0EBDAILIAJBJGpBAjYCACACQSxqQQE2AgAgAkHwwMAANgIgIAJBADYCGCACQekANgIEIAIgACgCADYCACACIAI2AiggASACQRhqEPMBDAELIAJBDGpB6QA2AgAgAkEk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NCADIAY2AjAgAyAINwMoIAMgBzcDICADIANBCGo2AhhBASABIANBGGogAigCDBEAAA0AGiADKAIYQc/3wgBBAiADKAIcKAIMEQIACzoACCAAIAVBAWo2AgAgA0FAayQAIAALowIBBH8gAEIANwIQIAACf0EAIAFBgAJJDQAaQR8gAUH///8HSw0AGiABQQYgAUEIdmciAmt2QQFxIAJBAXRrQT5qCyIDNgIcIANBAnRBoJrDAGohAgJAAkACQAJAQbydwwAoAgAiBEEBIAN0IgVxBEAgAigCACECIAMQ+QIhAyACEMYDIAFHDQEgAiEDDAILQbydwwAgBCAFcjYCACACIAA2AgAMAwsgASADdCEEA0AgAiAEQR12QQRxakEQaiIFKAIAIgNFDQIgBEEBdCEEIAMiAhDGAyABRw0ACwsgAygCCCIBIAA2AgwgAyAANgIIIAAgAzYCDCAAIAE2AgggAEEANgIYDwsgBSAANgIACyAAIAI2AhggACAANgIIIAAgADYCDAu9AgEFfyMAQRBrIgMkABAPIQUgASgCACICIAUQECEBIANBCGoQxQIgAygCDCABIAMoAggiBBshAQJAAkACQAJAIARFBEAgARAKQQFGDQEgAEECOgAEIAFBhAFJDQIgARAADAILIABBAzoABCAAIAE2AgAMAQsgASACEBEhAiADEMUCIAMoAgQgAiADKAIAIgQbIQICQAJAAkACQCAERQRAIAIQA0EBRw0DIAIQCyIEEAohBiAEQYQBSQ0BIAQQACAGQQFGDQIMAwsgAEEDOgAEIAAgAjYCAAwDCyAGQQFHDQELIABBADoABCAAIAI2AgAgAUGEAU8EQCABEAALIAVBgwFLDQMMBAsgAEECOgAEIAJBhAFJDQAgAhAACyABQYQBSQ0AIAEQAAsgBUGDAU0NAQsgBRAACyADQRBqJAALpwYBCX8jAEHQAGsiAyQAIANBBjYCCCADIAI2AkQgAyABNgJAIAMgA0EIajYCSCADQTBqIQQjAEHgAGsiASQAIAFBEGogA0FAayICQQhqKAIANgIAIAEgAikCADcDCCABQThqIAFBCGoQSAJAAkACQCABKAJURQRAIARBADYCCCAEQoCAgIDAADcCACABKAIIIAEoAgwoAgARAwAgASgCDCICQQRqKAIARQ0BIAJBCGooAgAaIAEoAggQPQwBC0GQAUEEEIwDIgJFDQEgAiABKQM4NwIAIAJBIGogAUHYAGoiCCgCADYCACACQRhqIAFB0ABqIgkpAwA3AgAgAkEQaiABQcgAaiIKKQMANwIAIAJBCGogAUFAayILKQMANwIAIAFBATYCICABIAI2AhwgAUEENgIYIAFBMGogAUEQaigCADYCACABIAEpAwg3AyggAUE4aiABQShqEEggASgCVARAQSQhB0EBIQUDQCABKAIYIAVGBEAgAUEYaiAFQQEQpQEgASgCHCECCyACIAdqIgYgASkDODcCACAGQSBqIAgoAgA2AgAgBkEYaiAJKQMANwIAIAZBEGogCikDADcCACAGQQhqIAspAwA3AgAgASAFQQFqIgU2AiAgB0EkaiEHIAFBOGogAUEoahBIIAEoAlQNAAsLIAEoAiggASgCLCgCABEDACABKAIsIgJBBGooAgAEQCACQQhqKAIAGiABKAIoED0LIAQgASkDGDcCACAEQQhqIAFBIGooAgA2AgALIAFB4ABqJAAMAQtBkAFBBBDKAwALAkAgAygCCEEGRgRAIAAgAykDMDcCBCAAQQY2AgAgAEEMaiADQThqKAIANgIADAELIAAgAykDCDcDACAAQSBqIANBKGopAwA3AwAgAEEYaiADQSBqKQMANwMAIABBEGogA0EYaikDADcDACAAQQhqIANBEGopAwA3AwAgAygCNCEBIAMoAjgiAARAIABBJGwhAiABQRxqIQADQCAAQQRrKAIABEAgACgCABA9CyAAQSRqIQAgAkEkayICDQALCyADKAIwRQ0AIAEQPQsgA0HQAGokAAulAgEFfyMAQTBrIgIkACAAAn8CQCABQRBqKAIABEAgAkEYaiABQQhqEJ4CIAIoAhgNAQsgAEEIakEANgIAQQAMAQsgAkEQaiACKAIcEIQCIAIoAhQhBSACKAIQIQMgASABKAIUQQFqNgIUIAFBBGohBAJAIAEoAgBFDQAgBCgCACIGQYQBSQ0AIAYQAAsgAUEBNgIAIAQgBTYCACACIAMiATYCJCACQQhqIAEQAgJAIAIoAggiBARAIAIoAgwhAwwBCyACQSRqIAJBKGpBtKXAABBlIQNBACEEIAIoAiQhAQsgAUGEAU8EQCABEAALIAQEQCAAIAM2AgQgAEEMaiADNgIAIABBCGogBDYCAEEADAELIAAgAzYC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QR92IQQCQCACBEAgA0EBNgIYIAMgAjYCFCADIABBBGooAgA2AhAMAQsgA0EANgIYCyADIAEgBCADQRBqELcBIAMoAgQhAiADKAIARQRAIAAgATYCACAAQQRqIAI2AgAMAgsgA0EIaigCACIAQYGAgIB4Rg0BIABFDQAgAiAAEMoDAAsQoAIACyADQSBqJAALzQEBA38jAEEgayICJAACQAJAIAFBAWoiAUUNAEEIIAAoAgAiA0EBdCIEIAEgASAESRsiASABQQhNGyIBQX9zQR92IQQCQCADBEAgAkEBNgIYIAIgAzYCFCACIABBBGooAgA2AhAMAQsgAkEANgIYCyACIAEgBCACQRBqELsBIAIoAgQhAyACKAIARQRAIAAgATYCACAAQQRqIAM2AgAMAgsgAkEIaigCACIAQYGAgIB4Rg0BIABFDQAgAyAAEMoDAAsQoAIACyACQSBqJAALzQEBA38jAEEgayICJAACQAJAIAFBAWoiAUUNAEEIIAAoAgAiA0EBdCIEIAEgASAESRsiASABQQhNGyIBQX9zQR92IQQCQCADBEAgAkEBNgIYIAIgAzYCFCACIABBBGooAgA2AhAMAQsgAkEANgIYCyACIAEgBCACQRBqELcBIAIoAgQhAyACKAIARQRAIAAgATYCACAAQQRqIAM2AgAMAgsgAkEIaigCACIAQYGAgIB4Rg0BIABFDQAgAyAAEMoDAAsQoAIACyACQSBqJAALzAEBAn8jAEEgayIDJAACQAJAIAEgASACaiIBSw0AQQggACgCACICQQF0IgQgASABIARJGyIBIAFBCE0bIgFBf3NBH3YhBAJAIAIEQCADQQE2AhggAyACNgIUIAMgAEEEaigCADYCEAwBCyADQQA2AhgLIAMgASAEIANBEGoQuwEgAygCBCECIAMoAgBFBEAgACABNgIAIAAgAjYCBAwCCyADQQhqKAIAIgBBgYCAgHhGDQEgAEUNACACIAAQygMACxCgAgALIANBIGokAAvMAQECfyMAQSBrIgMkAAJAAkAgASABIAJqIgFLDQBBCCAAKAIAIgJBAXQiBCABIAEgBEkbIgEgAUEITRsiAUF/c0EfdiEEAkAgAgRAIANBATYCGCADIAI2AhQgAyAAQQRqKAIANgIQDAELIANBADYCGAsgAyABIAQgA0EQahC3ASADKAIEIQIgAygCAEUEQCAAIAE2AgAgACACNgIEDAILIANBCGooAgAiAEGBgICAeEYNASAARQ0AIAIgABDKAwALEKACAAsgA0EgaiQAC9QBAQF/IwBBMGsiAiQAAn8gACgCACgCACIAKAIARQRAIAIgACgCBDYCACACIAAoAgg2AgQgAkEkakECNgIAIAJBLGpBAjYCACACQRRqQcQANgIAIAJB5PnAADYCICACQQA2AhggAkHEADYCDCACIAJBCGo2AiggAiACQQRqNgIQIAIgAjYCCCABIAJBGGoQ8wEMAQsgAkEkakEBNgIAIAJBLGpBADYCACACQbz5wAA2AiAgAkGg98AANgIoIAJBADYCGCABIAJBGGoQ8wELIAJBMGokAAvYAQEBfyMAQRBrIhMkACAAKAIAIAEgAiAAKAIEKAIMEQIAIQEgE0EAOgANIBMgAToADCATIAA2AgggE0EIaiADIAQgBSAGEHggByAIIAkgChB4IAsgDCANIA4QeCAPIBAgESASEHghAQJ/IBMtAAwiACATLQANRQ0AGiAAQf8BcSECQQEgAg0AGiABKAIAIgAtABhBBHFFBEAgACgCAEHX98IAQQIgACgCBCgCDBECAAwBCyAAKAIAQdb3wgBBASAAKAIEKAIMEQIACyATQRBqJABB/wFxQQBHC+cBAQF/IwBBEGsiAiQAIAIgADYCACACIABBBGo2AgQgASgCAEG5j8MAQQkgASgCBCgCDBECACEAIAJBADoADSACIAA6AAwgAiABNgIIIAJBCGpBwo/DAEELIAJBpI/DABB4Qc2PwwBBCSACQQRqQdiPwwAQeCEAAn8gAi0ADCIBIAItAA1FDQAaIAFB/wFxIQFBASABDQAaIAAoAgAiAC0AGEEEcUUEQCAAKAIAQdf3wgBBAiAAKAIEKAIMEQIADAELIAAoAgBB1vfCAEEBIAAoAgQoAgwRAgALIAJBEGokAEH/AXFBAEcLiAIBAn8jAEEgayIFJABBgJrDAEGAmsMAKAIAIgZBAWo2AgACQAJAIAZBAEgNAEHkncMAQeSdwwAoAgBBAWoiBjYCACAGQQJLDQAgBSAEOgAYIAUgAzYCFCAFIAI2AhAgBUHwzMIANgIMIAVBlMPCADYCCEHwmcMAKAIAIgJBAEgNAEHwmcMAIAJBAWoiAjYCAEHwmcMAQfiZwwAoAgAEfyAFIAAgASgCEBEBACAFIAUpAwA3AwhB+JnDACgCACAFQQhqQfyZwwAoAgAoAhQRAQBB8JnDACgCAAUgAgtBAWs2AgAgBkEBSw0AIAQNAQsACyMAQRBrIgIkACACIAE2AgwgAiAANgIIAAvUAQEBfyMAQRBrIgUkACAFIAAoAgAgASACIAAoAgQoAgwRAgA6AAggBSAANgIEIAUgAkU6AAkgBUEANgIAIAUgA0HE78AAEIoBIARBtO/AABCKASEAAn8gBS0ACCIBIAAoAgAiAkUNABpBASABDQAaIAUoAgQhAAJAIAJBAUcNACAFLQAJRQ0AIAAtABhBBHENAEEBIAAoAgBB3PfCAEEBIAAoAgQoAgwRAgANARoLIAAoAgBB3PTCAEEBIAAoAgQoAgwRAgALIAVBEGokAEH/AXFBAEcLugEAAkAgAgRAAkACQAJ/AkACQCABQQBOBEAgAygCCA0BIAENAkEBIQIMBAsMBgsgAygCBCICRQRAIAFFBEBBASECDAQLIAFBARCMAwwCCyADKAIAIAJBASABEP8CDAELIAFBARCMAwsiAkUNAQsgACACNgIEIABBCGogATYCACAAQQA2AgAPCyAAIAE2AgQgAEEIakEBNgIAIABBATYCAA8LIAAgATYCBAsgAEEIakEANgIAIABBATYCAAvPAQEBfyMAQRBrIgUkACAFIAAoAgAgASACIAAoAgQoAgwRAgA6AAggBSAANgIEIAUgAkU6AAkgBUEANgIAIAUgAyAEEIoBIQECfyAFLQAIIgAgASgCACICRQ0AGiAAQf8BcSEBQQEgAQ0AGiAFKAIEIQECQCACQQFHDQAgBS0ACUUNACABLQAYQQRxDQBBASABKAIAQdz3wgBBASABKAIEKAIMEQIADQEaCyABKAIAQdz0wgBBASABKAIEKAIMEQIACyAFQRBqJABB/wFxQQBHC7oBAgF+A38CQCABKAIYIgVFDQACQCABKQMAIgJQBEAgASgCECEEIAEoAgghAwNAIARBIGshBCADKQMAIANBCGohA0J/hUKAgYKEiJCgwIB/gyICUA0ACyABIAQ2AhAgASADNgIIIAEgAkIBfSACgzcDAAwBCyABIAJCAX0gAoM3AwAgASgCECIERQ0BCyABIAVBAWs2AhhBASEDIAAgBCACeqdBAXZBPHFrQQRrKAAANgABCyAAIAM6AAALxAEBAX8jAEEQayILJAAgACgCACABIAIgACgCBCgCDBECACEBIAtBADoADSALIAE6AAwgCyAANgIIIAtBCGogAyAEIAUgBhB4IAcgCCAJIAoQeCEBAn8gCy0ADCIAIAstAA1FDQAaIABB/wFxIQJBASACDQAaIAEoAgAiAC0AGEEEcUUEQCAAKAIAQdf3wgBBAiAAKAIEKAIMEQIADAELIAAoAgBB1vfCAEEBIAAoAgQoAgwRAgALIAtBEGokAEH/AXFBAEcLrQEBAX8CQCACBEACfwJAAkACQCABQQBOBEAgAygCCEUNAiADKAIEIgQNASABDQMgAgwECyAAQQhqQQA2AgAMBQsgAygCACAEIAIgARD/AgwCCyABDQAgAgwBCyABIAIQjAMLIgMEQCAAIAM2AgQgAEEIaiABNgIAIABBADYCAA8LIAAgATYCBCAAQQhqIAI2AgAMAQsgACABNgIEIABBCGpBADYCAAsgAEEBNgIAC4gBAQN/IAAoAggiAQRAIAAoAgQhAiABQThsIQNBACEBA0AgASACaiIAQRBqKAIABEAgAEEUaigCABA9CyAAQRxqKAIABEAgAEEgaigCABA9CyAAQShqKAIABEAgAEEsaigCABA9CyAAQQRqKAIABEAgAEEIaigCABA9CyADIAFBOGoiAUcNAAsLC6sBAQF/IwBB4ABrIgEkACABQRhqIABBEGopAgA3AwAgAUEQaiAAQQhqKQIANwMAIAEgACkCADcDCCABQQA2AiggAUKAgICAEDcDICABQTBqIgAgAUEgakHkrMAAEMYCIAFBCGogABDxAUUEQCABKAIkIAEoAigQASABKAIgBEAgASgCJBA9CyABQeAAaiQADwtB/KzAAEE3IAFB2ABqQbStwABBkK7AABDRAQALugEBAX8jAEEQayIHJAAgACgCACABIAIgACgCBCgCDBECACEBIAdBADoADSAHIAE6AAwgByAANgIIIAdBCGogAyAEIAUgBhB4IQECfyAHLQAMIgAgBy0ADUUNABogAEH/AXEhAkEBIAINABogASgCACIALQAYQQRxRQRAIAAoAgBB1/fCAEECIAAoAgQoAgwRAgAMAQsgACgCAEHW98IAQQEgACgCBCgCDBECAAsgB0EQaiQAQf8BcUEARwupAQEDfyMAQTBrIgIkACABKAIERQRAIAEoAgwh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AEEEaiABEIQBCyACQSBqJAALgAEBAX8jAEEQayICJAACfwJAAkACQAJAIAAoAgAiACgCAEEBaw4DAQIDAAsgAUHa08AAQREQhQMMAwsgAUHN08AAQQ0QhQMMAgsgAiAAQQRqNgIMIAFBxtPAAEEHIAJBDGpByNLAABC4AQwBCyABQbzTwABBChCFAwsgAkEQaiQAC3cBAX8CQCABKAIARQRAIABBgAQ7AQRBDEEEEIwDIgJFDQEgAiABKQIANwIAIABBGGpBqMbAADYCACAAQRRqIAI2AgAgAkEIaiABQQhqKAIANgIAIABBADYCAA8LIAAgASkCBDcCBCAAQQU2AgAPC0EMQQQQygMAC3MAIwBBMGsiASQAQciZwwAtAAAEQCABQRRqQQI2AgAgAUEcakEBNgIAIAFB6MrCADYCECABQQA2AgggAUHEADYCJCABIAA2AiwgASABQSBqNgIYIAEgAUEsajYCICABQQhqQZDLwgAQrAIACyABQTBqJAALdgEBfyAALQAEIQEgAC0ABQRAIAFB/wFxIQEgAAJ/QQEgAQ0AGiAAKAIAIgEtABhBBHFFBEAgASgCAEHX98IAQQIgASgCBCgCDBECAAwBCyABKAIAQdb3wgBBASABKAIEKAIMEQIACyIBOgAECyABQf8BcUEARwttAQN/IAFBBGooAgAhBAJAAkACQCABQQhqKAIAIgFFBEBBASECDAELIAFBAE4iA0UNASABIAMQjAMiAkUNAgsgACACNgIEIAAgATYCACACIAQgARDQAxogACABNgIIDwsQoAIACyABIAMQygMAC2oBAX8jAEEwayICJAAgAiABNgIMIAIgADYCCCACQRxqQQI2AgAgAkEkakEBNgIAIAJBpLHAADYCGCACQQA2AhAgAkEKNgIsIAIgAkEoajYCICACIAJBCGo2AiggAkEQahC9ASACQTBqJAALdQEBfyMAQRBrIgIkAAJ/IAAoAgAiACgCAEUEQCACIABBBGo2AgggAiAAQQhqNgIMIAFBzf3AAEEPQdz9wABBCCACQQhqQeT9wABB9P3AAEEGIAJBDGpB5P3AABC6AQwBCyABQbj9wABBFRCFAwsgAkEQaiQACz4AIAAoAhAEQCAAQRRqKAIAED0LIABBHGooAgAEQCAAQSBqKAIAED0LIABBKGooAgAEQCAAQSxqKAIAED0LC1gBAn8jAEEgayICJAAgASgCBCEDIAEoAgAgAkEYaiAAKAIAIgBBEGopAgA3AwAgAkEQaiAAQQhqKQIANwMAIAIgACkCADcDCCADIAJBCGoQUyACQSBqJAALYgEBfyMAQSBrIgUkACAFIAI2AgQgBSABNgIAIAVBGGogA0EQaikCADcDACAFQRBqIANBCGopAgA3AwAgBSADKQIANwMIIAAgBUHAi8AAIAVBBGpBwIvAACAFQQhqIAQQbAALXQECfyMAQSBrIgIkACACQQhqIgMgAUH8lMAAQQAQvgIgAiAANgIYIAIgAEEEajYCHCADIAJBGGpB/JTAABCKARogAyACQRxqQfyUwAAQigEaIAMQzAEgAkEgaiQAC2cBAX8jAEEQayICJAACfyAAKAIAIgApAwBQBEAgAiAAQQhqNgIIIAFBrKzAAEECIAJBCGpBsKzAABC4AQwBCyACIABBCGo2AgwgAUGYrMAAQQMgAkEMakGcrMAAELgBCyACQRBqJAALlAIBAn8jAEEQayICJAAgAiAAKAIAIgA2AgQgAiAAQQRqNgIIIAIgAEEIajYCDCMAQRBrIgAkACABKAIAQa/6wABBDyABKAIEKAIMEQIAIQMgAEEAOgANIAAgAzoADCAAIAE2AgggAEEIakG++sAAQQQgAkEEakHE+sAAEHhB1PrAAEEEIAJBCGpBxPrAABB4Qdj6wABBBCACQQxqQdz6wAAQeCEBAn8gAC0ADCIDIAAtAA1FDQAaQQEgAw0AGiABKAIAIgEtABhBBHFFBEAgASgCAEHX98IAQQIgASgCBCgCDBECAAwBCyABKAIAQdb3wgBBASABKAIEKAIMEQIACyAAQRBqJABB/wFxQQBHIAJBEGokAAtZAQF/IwBBIGsiAiQAIAIgACgCADYCBCACQRhqIAFBEGopAgA3AwAgAkEQaiABQQhqKQIANwMAIAIgASkCADcDCCACQQRqQdSlwAAgAkEIahBTIAJBIGokAAtZAQF/IwBBIGsiAiQAIAIgACgCADYCBCACQRhqIAFBEGopAgA3AwAgAkEQaiABQQhqKQIANwMAIAIgASkCADcDCCACQQRqQcS7wAAgAkEIahBTIAJBIGokAAtqAQF+IAEpAgAhAgJAIAEtAABBBEYEQCAAQYAEOwEEQQhBBBCMAyIBRQ0BIAEgAjcCACAAQRhqQeTGwAA2AgAgAEEUaiABNgIAIABBATYCAA8LIAAgAjcCBCAAQQU2AgAPC0EIQQQQygMAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB3NnAACACQQhqEFMgAkEgaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpByMLCACACQQhqEFMgAkEgaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB/MLCACACQQhqEFMgAkEgaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBrNnCACACQQhqEFMgAkEgaiQAC1MBAn8jAEEgayICJAAgASgCBCEDIAEoAgAgAkEYaiAAQRBqKQIANwMAIAJBEGogAEEIaikCADcDACACIAApAgA3AwggAyACQQhqEFMgAkEgaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB6PnCACACQQhqEFMgAkEgaiQAC1MBAn8jAEEgayICJAAgACgCBCEDIAAoAgAgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAyACQQhqEFMgAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB1KXAACACQQhqEFMgAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBxLvAACACQQhqEFMgAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiAB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KAIAIgA2AgggAiAAQRBqNgIMIAFBnNPAAEEOQaTSwABBBCACQQhqQazTwABBgdPAAEEKIAJBDGpBjNPAABC6ASACQRBqJAALWAEBfyMAQRBrIgIkACACIAAoAgAiADYCCCACIABBEGo2AgwgAUHr08AAQQ1BjNLAAEEGIAJBCGpBlNLAAEGB08AAQQogAkEMakGM08AAELoBIAJBEGokAAtYAQF/IwBBEGsiAiQAIAIgACgCACIANgIIIAIgAEEQajYCDCABQfTSwABBDUGM0sAAQQYgAkEIakGU0sAAQYHTwABBCiACQQxqQYzTwAAQugEgAkEQaiQAC1gBAX8jAEEQayICJAAgAiAAKAIAIgBBEGo2AgggAiAANgIMIAFB/NHAAEEQQYzSwABBBiACQQhqQZTSwABBpNLAAEEEIAJBDGpBqNLAABC6ASACQRBqJAALUwEBfyMAQRBrIgIkAAJ/IAAoAgAiACgCAEUEQCABQbDawABBBBCFAwwBCyACIABBBGo2AgwgAUGc2sAAQQQgAkEMakG02sAAELgBCyACQRBqJAALWAEBfyMAQRBrIgIkACACIAAoAgAiADYCCCACIABBBGo2AgwgAUHw/MAAQRBBgP3AAEEKIAJBCGpBxPrAAEGK/cAAQQkgAkEMakHE+sAAELoBIAJBEGokAAtSAQF/IwBBIGsiAiQAIAJBDGpBATYCACACQRRqQQE2AgAgAkHwjcAANgIIIAJBADYCACACQQo2AhwgAiAANgIYIAIgAkEYajYCECACIAEQrAIAC1IBAX8jAEEgayICJAAgAkEMakEBNgIAIAJBFGpBATYCACACQfiiwAA2AgggAkEANgIAIAJBCjYCHCACIAA2AhggAiACQRhqNgIQIAIgARCsAgALUgEBfyMAQSBrIgMkACADQQxqQQE2AgAgA0EUakEANgIAIANBrNzCADYCECADQQA2AgAgAyABNgIcIAMgADYCGCADIANBGGo2AgggAyACEKwCAAtQAQF/IwBBEGsiAiQAAn8gACgCACIAKAIARQRAIAFBsNrAAEEEEIUDDAELIAIgADYCDCABQZzawABBBCACQQxqQcTawAAQuAELIAJBEGokAAtIAQF/IAIgACgCACIAKAIAIAAoAggiA2tLBEAgACADIAIQrAEgACgCCCEDCyAAKAIEIANqIAEgAhDQAxogACACIANqNgIIQQALSAEBfyACIAAoAgAiACgCACAAKAIIIgNrSwRAIAAgAyACEK0BIAAoAgghAwsgACgCBCADaiABIAIQ0AMaIAAgAiADajYCCEEACz8BAX4gACABwEEDdEGA/sAAaikDACADrSACrUL/AYN+fiIEQvH/////AFQ2AgAgACAEQgd8QgOIp0EBajYCBAtIAQF/IAIgACgCACIAKAIAIAAoAggiA2tLBEAgACADIAIQsAEgACgCCCEDCyAAKAIEIANqIAEgAhDQAxogACACIANqNgIIQQALSAEBfyACIAAoAgAiACgCACAAKAIIIgNrSwRAIAAgAyACELEBIAAoAgghAwsgACgCBCADaiABIAIQ0AMaIAAgAiADajYCCEEAC0UBAX0gAAJ/IAEqAgAQ+wIiAkMAAIBPXSACQwAAAABgcQRAIAKpDAELQQALOgABIAAgAkMAAIBDXSACQwAAgL9ecToAAAtIACAAIAM2AgwgACACNgIIIAAgBTYCBCAAIAQ2AgAgACABKQIANwIQIABBIGogAUEQaigCADYCACAAQRhqIAFBCGopAgA3AgALQwEBfyACIAAoAgAgACgCCCIDa0sEQCAAIAMgAhCsASAAKAIIIQMLIAAoAgQgA2ogASACENADGiAAIAIgA2o2AghBAAtDAQF/IAIgACgCACAAKAIIIgNrSwRAIAAgAyACEK0BIAAoAgghAwsgACgCBCADaiABIAIQ0AMaIAAgAiADajYCCEEAC0EBAX8gASgCACICIAEoAgRPBH9BAAUgASACQQFqNgIAIAEoAggoAgAgAhAIIQFBAQshAiAAIAE2AgQgACACNgIACz4BAn8gACAALQBGIgFBAWoiAjoACiAAQQEgAUEPcXRBAmo7AUAgAEF/IAJBD3F0QX9zOwEIIABBIGogARBrC0oBAX8jAEEgayIAJAAgAEEUakEBNgIAIABBHGpBADYCACAAQfTZwgA2AhAgAEHE2cIANgIYIABBADYCCCAAQQhqQfzZwgAQrAIACzwAIAAgASkDADcDACAAQRhqIAFBGGopAwA3AwAgAEEQaiABQRBqKQMANwMAIABBCGogAUEIaikDADcDAAtGAQJ/IAEoAgQhAiABKAIAIQNBCEEEEIwDIgFFBEBBCEEEEMoDAAsgASACNgIEIAEgAzYCACAAQbjMwgA2AgQgACABNgIAC5l3AxZ+In8BfCABKAIYQQFxIRggACsDACE6AkACQAJAIAEoAhBBAUYEQAJ/IAEhJCABQRRqKAIAIScjAEHwCGsiHyQAIDq9IQMCQCA6IDpiBEBBAiEBDAELIANC/////////weDIgZCgICAgICAgAiEIANCAYZC/v///////w+DIANCNIinQf8PcSIAGyIEQgGDIQVBAyEBAkACQAJAQQFBAkEEIANCgICAgICAgPj/AIMiB1AiGRsgB0KAgICAgICA+P8AURtBA0EEIBkbIAZQG0ECaw4DAAECAwtBBCEBDAILIABBswhrIRwgBVAhAUIBIQIMAQtCgICAgICAgCAgBEIBhiAEQoCAgICAgIAIUSIZGyEEQgJCASAZGyECIAVQIQFBy3dBzHcgGRsgAGohHAsgHyAcOwHoCCAfIAI3A+AIIB9CATcD2AggHyAENwPQCCAfIAE6AOoIAn9BrNzCACABQQJGDQAaIBhFBEAgA0I/iKchLEGb9MIAQazcwgAgA0IAUxsMAQtBASEsQZv0wgBBnPTCACADQgBTGwshMkEBIQACQAJAAn8CQAJAAkACQEEDIAFBAmsgAUEBTRtB/wFxQQFrDgMCAQADC0F0QQUgHMEiAEEASBsgAGwiAEG//QBLDQQgH0GQCGohICAfQRBqISIgAEEEdkEVaiIaIRxBgIB+QQAgJ2sgJ0GAgAJPGyEbAkACQAJAAkACQAJAAkAgH0HQCGoiACkDACICUEUEQCACQv//////////H1YNASAcRQ0DQaB/IAAvARgiAEEgayAAIAJCgICAgBBUIgAbIgFBEGsgASACQiCGIAIgABsiAkKAgICAgIDAAFQiABsiAUEIayABIAJCEIYgAiAAGyICQoCAgICAgICAAVQiABsiAUEEayABIAJCCIYgAiAAGyICQoCAgICAgICAEFQiABsiAUECayABIAJCBIYgAiAAGyICQoCAgICAgICAwABUIgAbIAJCAoYgAiAAGyICQj+Hp0F/c2oiAWvBQdAAbEGwpwVqQc4QbSIAQdEATw0CIABBBHQiAEGq5MIAai8BACEeAn8CQAJAIABBoOTCAGopAwAiA0L/////D4MiBCACIAJCf4VCP4iGIgJCIIgiBX4iBkIgiCADQiCIIgMgBX58IAMgAkL/////D4MiAn4iA0Ig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KAIIRQRAIAAgARA3DAELIABBBzYCAAsgA0EQaiQACzkAAkACfyACQYCAxABHBEBBASAAIAIgASgCEBEAAA0BGgsgAw0BQQALDwsgACADIAQgASgCDBECAAs7AQF/IwBBEGsiAiQAIAIgACgCADYCDCABQdrEwABBDEHmxMAAQQ8gAkEMakH4xMAAEL4BIAJBEGokAAs7AQF/IwBBEGsiAiQAIAIgACgCADYCDCABQfjTwABBCkGk0sAAQQQgAkEMakGE1MAAEL4BIAJBEGokAAs7AQF/IwBBEGsiAiQAIAIgACgCADYCDCABQbDywABBC0G78sAAQQUgAkEMakHA8sAAEL4BIAJBEGokAAs7AQF/IwBBEGsiAiQAIAIgACgCADYCDCABQZP9wABBDkGh/cAAQQUgAkEMakGo/cAAEL4BIAJBEGokAAs7AQF/IwBBEGsiAiQAIAIgACgCADYCDCABQbajwgBBE0HJo8IAQQogAkEMakHUo8IAEL4BIAJBEGokAAs7AQF/IwBBEGsiAiQAIAIgACgCADYCDCABQayxwgBBE0G/scIAQQQgAkEMakHEscIAEL4BIAJBEGokAAvkAgECfyMAQSBrIgIkACACQQE6ABggAiABNgIUIAIgADYCECACQej1wgA2AgwgAkGs3MIANgIIIwBBEGsiASQAAkAgAkEIaiIAKAIMIgIEQCAAKAIIIgNFDQEgASACNgIIIAEgADYCBCABIAM2AgAjAEEQayIAJAAgAEEIaiABQQhqKAIANgIAIAAgASkCADcDACMAQRBrIgEkACAAKAIAIgJBFGooAgAhAwJAAn8CQAJAIAJBDGooAgAOAgABAwsgAw0CQQAhAkGUw8IADAELIAMNASACKAIIIgMoAgQhAiADKAIACyEDIAEgAjYCBCABIAM2AgAgAUHczMIAIAAoAgQiASgCCCAAKAIIIAEtABAQtQEACyABQQA2AgQgASACNgIMIAFByMzCACAAKAIEIgEoAgggACgCCCABLQAQELUBAAtBlMPCAEErQZjMwgAQkwIAC0GUw8IAQStBiMzCABCTAgALNgEBfyMAQRBrIgIkACACQQhqIAEQxAIgAigCDCEBIAAgAigCCDYCACAAIAE2AgQgAkEQaiQACzYBAX8jAEEQayICJAAgAkEIaiABEOwCIAIoAgwhASAAIAIoAgg2AgAgACABNgIEIAJBEGokAAtJAQJ/QY77wAAhAkEEIQMCQAJAAkAgACgCAC0AAEEBaw4CAAECCyABQYT7wABBChCFAw8LQfz6wAAhAkEIIQMLIAEgAiADEIUDCzQBAX8gACgCACAAKAIEKAIAEQMAIAAoAgQiAUEEaigCAARAIAFBCGooAgAaIAAoAgAQPQsLOAEBfyMAQRBrIgIkACACIAA2AgwgAUG2o8IAQRNByaPCAEEKIAJBDGpB1KPCABC+ASACQRBqJAALOAEBfyMAQRBrIgIkACACIAA2AgwgAUGsscIAQRNBv7HCAEEEIAJBDGpBxLHCABC+ASACQRBqJAALMwACQCAAQfz///8HSw0AIABFBEBBBA8LIAAgAEH9////B0lBAnQQjAMiAEUNACAADwsACzwBAX8gAi0AA0UEQCACIAEoAAA2AAALAkACQAJAIABB/wFxQQJrDgIBAgALIAIoAAAhAwsgASADNgAACwvlBAEGfyMAQRBrIgQkAEHJmcMALQAAQQNHBEAgBEEBOgAPIARBD2ohASMAQSBrIgAkAAJAAkACQAJAAkACQAJAQcmZwwAtAABBAWsOAwIEAQALQcmZwwBBAjoAACABLQAAIAFBADoAACAAQcmZwwA2AghBAXFFDQIjAEEgayIBJAACQAJAAkBBgJrDACgCAEH/////B3EEQBDaA0UNAQtB8JnDACgCAEHwmcMAQX82AgANAQJAAkBBgJrDACgCAEH/////B3FFBEBB/JnDACgCACECQfyZwwBB7IHAADYCAEH4mcMAKAIAIQNB+JnDAEEBNgIADAELENoDQfyZwwAoAgAhAkH8mcMAQeyBwAA2AgBB+JnDACgCACEDQfiZwwBBATYCAEUNAQtBgJrDACgCAEH/////B3FFDQAQ2gMNAEH0mcMAQQE6AAALQfCZwwBBADYCAAJAIANFDQAgAyACKAIAEQMAIAJBBGooAgBFDQAgAkEIaigCABogAxA9CyABQSBqJAAMAgsgAUEUakEBNgIAIAFBHGpBADYCACABQdTLwgA2AhAgAUGUw8IANgIYIAFBADYCCCABQQhqQfjLwgAQrAIACwALIABBAzoADCAAQQhqIgEoAgAgAS0ABDoAAAsgAEEgaiQADAQLIABBFGpBATYCACAAQRxqQQA2AgAgAEHwgsAANgIQDAILQfiCwABBK0Hwg8AAEJMCAAsgAEEUakEBNgIAIABBHGpBADYCACAAQbyCwAA2AhALIABBxILAADYCGCAAQQA2AgggAEEIakHkhcAAEKwCAAsLIARBEGokAAvIAwIBfgR/IAAoAgAhACABEJsDRQRAIAEQnANFBEAgACABEKsDDwsjAEGAAWsiBCQAIAApAwAhAkGAASEAIARBgAFqIQUCQAJAA0AgAEUEQEEAIQAMAwsgBUEBa0EwQTcgAqciA0EPcSIGQQpJGyAGajoAACACQhBaBEAgBUECayIFQTBBNyADQf8BcSIDQaABSRsgA0EEdmo6AAAgAEECayEAIAJCgAJUIAJCCIghAkUNAQwCCwsgAEEBayEACyAAQYEBSQ0AIABBgAFBjPjCABCkAwALIAFBAUGc+MIAQQIgACAEakGAASAAaxBJIARBgAFqJAAPCyMAQYABayIEJAAgACkDACECQYABIQAgBEGAAWohBQJAAkADQCAARQRAQQAhAAwDCyAFQQFrQTBB1wAgAqciA0EPcSIGQQpJGyAGajoAACACQhBaBEAgBUECayIFQTBB1wAgA0H/AXEiA0GgAUkbIANBBHZqOgAAIABBAmshACACQoACVCACQgiIIQJFDQEMAgsLIABBAWshAAsgAEGBAUkNACAAQYABQYz4wgAQpAMACyABQQFBnPjCAEECIAAgBGpBgAEgAGsQSSAEQYABaiQACzIAIAAoAgAhACABEJsDRQRAIAEQnANFBEAgACABEKcDDwsgACABEMYBDwsgACABEMUBC7cBAQN/IAAoAgAhACABEJsDRQRAIAEQnANFBEAgACABEKoDDwsgACABEMQBDwsjAEGAAWsiAyQAIAAtAAAhAANAIAIgA2pB/wBqQTBB1wAgAEEPcSIEQQpJGyAEajoAACACQQFrIQIgACIEQQR2IQAgBEEPSw0ACyACQYABaiIAQYEBTwRAIABBgAFBjPjCABCkAwALIAFBAUGc+MIAQQIgAiADakGAAWpBACACaxBJIANBgAFqJAALvgIBA38gACgCACEAIAEQmwNFBEAgARCcA0UEQCAAMwEAQQEgARCAAQ8LIwBBgAFrIgMkACAALwEAIQADQCACIANqQf8AakEwQTcgAEEPcSIEQQpJGyAEajoAACACQQFrIQIgACIEQQR2IQAgBEEPSw0ACyACQYABaiIAQYEBTwRAIABBgAFBjPjCABCkAwALIAFBAUGc+MIAQQIgAiADakGAAWpBACACaxBJIANBgAFqJAAPCyMAQYABayIDJAAgAC8BACEAA0AgAiADakH/AGpBMEHXACAAQQ9xIgRBCkkbIARqOgAAIAJBAWshAiAAIgRBBHYhACAEQQ9LDQALIAJBgAFqIgBBgQFPBEAgAEGAAUGM+MIAEKQDAAsgAUEBQZz4wgBBAiACIANqQYABakEAIAJrEEkgA0GAAWokAAssAQF/IwBBEGsiACQAIABBCGoiAiABQb/DwgBBCxDHAiACEOABIABBEGokAAsuACAAQQQ6AAQgAEEENgIAIABBBmogAjoAACAAQQVqIAE6AAAgAEEUakEAOwEACysAIAEgAk8EQCABIAJrIgEgACABaiACEEAPC0GAr8AAQSFBpK/AABCTAgALLAAgACABKQIANwIAIABBEGogAUEQaigCADYCACAAQQhqIAFBCGopAgA3AgALMQAgACABKAIAIAIgAyABKAIEKAIMEQIAOgAIIAAgATYCBCAAIANFOgAJIABBADYCAAspACABIAJPBEAgAiAAIAJqIAEgAmsQQA8LQcCswABBI0HwrsAAEJMCAAsuACABIAAoAgAtAABBBHNBB3FBAnQiAEHY/8AAaigCACAAQbj/wABqKAIAEIUDCyoAIAAoAgBFBEAgACgCBCABIABBCGooAgAoAhARAAAPCyAAQQRqIAEQcAssAAJAIAEQmwNFBEAgARCcAw0BIAAgARDLAg8LIAAgARDFAQ8LIAAgARDGAQsnACAAIAAoAgRBAXEgAXJBAnI2AgQgACABaiIAIAAoAgRBAXI2AgQLLQEBfyAAQeCwwgBBpLDCACABLQAAQQRGIgIbNgIEIAAgAUEBaiABIAIbNgIACzoBAn9BzJnDAC0AACEBQcyZwwBBADoAAEHQmcMAKAIAIQJB0JnDAEEANgIAIAAgAjYCBCAAIAE2AgALMQAgAEEDOgAgIABCgICAgIAENwIYIABBADYCECAAQQA2AgggACACNgIEIAAgATYCAAstACABKAIAIAIgAyABKAIEKAIMEQIAIQIgAEEAOgAFIAAgAjoABCAAIAE2AgALIAEBfwJAIABBBGooAgAiAUUNACAAKAIARQ0AIAEQPQsLIwACQCABQfz///8HTQRAIAAgAUEEIAIQ/wIiAA0BCwALIAALIwAgAiACKAIEQX5xNgIEIAAgAUEBcjYCBCAAIAFqIAE2AgALHwAgACgCACIArUIAIACsfSAAQQBOIgAbIAAgARCAAQslACAARQRAQcS9wABBMhDFAwALIAAgAiADIAQgBSABKAIQEQsACyMAIABBADYCECAAIAEpAgA3AgAgAEEIaiABQQhqKQIANwIACygAIAEgACgCAC0AAEECdCIAQaDZwABqKAIAIABB5NjAAGooAgAQhQMLKAAgASAAKAIALQAAQQJ0IgBBjInBAGooAgAgAEHsiMEAaigCABCFAwsoACABIAAoAgAtAABBAnQiAEGE18IAaigCACAAQeDVwgBqKAIAEIUDCyABAn4gACkDACICIAJCP4ciA4UgA30gAkIAWSABEIABCyMAIABFBEBBxL3AAEEyEMUDAAsgACACIAMgBCABKAIQEQYACyMAIABFBEBBxL3AAEEyEMUDAAsgACACIAMgBCABKAIQERYACyMAIABFBEBBxL3AAEEyEMUDAAsgACACIAMgBCABKAIQESQACyMAIABFBEBBxL3AAEEyEMUDAAsgACACIAMgBCABKAIQESYACyMAIABFBEBBxL3AAEEyEMUDAAsgACACIAMgBCABKAIQESgACyUAIAEgAC0AAEECdCIAQYDYwABqKAIAIABB2NfAAGooAgAQhQMLIQAgAEGM28AANgIEIAAgAUEEakEAIAEtAABBH0YbNgIACyUAIAEgAC0AAEECdCIAQYTXwgBqKAIAIABB4NXCAGooAgAQhQMLHgAgACABQQNyNgIEIAAgAWoiACAAKAIEQQFyNgIECwoAIABBCBDKAwALFAAgACgCAARAIABBBGooAgAQPQsLIgEBfyABKAIAEAkhAiAAIAE2AgggACACNgIEIABBADYCAAshACAARQRAQcS9wABBMhDFAwALIAAgAiADIAEoAhARBQALIwAgAUHs+sAAQfH6wAAgACgCAC0AACIAG0EFQQsgABsQhQMLIwAgAUGS+8AAQZb7wAAgACgCAC0AACIAG0EEQQYgABsQhQMLLAEBfwJAAkAgAEH/AXFBAWsOEAAAAQABAQEAAQEBAQEBAQABCyAAIQELIAEL7wwBBH8gACAAKQMAIAKtfDcDACAAQQhqIgUoAgBBf3MhAyACQcAATwRAA0AgAS0AMyABLQAjIAEtABMgAS0AACADQf8BcXNBAnRB2JTCAGooAgAgAUEBai0AACADQQh2Qf8BcXNBAnRB2IzCAGooAgAgAUECai0AACADQRB2Qf8BcXNBAnRB2ITCAGooAgAgAUEDai0AACADQRh2c0ECdEHY/MEAaigCACABQQRqLQAAQQJ0Qdj0wQBqKAIAIAFBBWotAABBAnRB2OzBAGooAgAgAUEGai0AAEECdEHY5MEAaigCACABQQdqLQAAQQJ0QdjcwQBqKAIAIAFBCGotAABBAnRB2NTBAGooAgAgAUEJai0AAEECdEHYzMEAaigCACABQQpqLQAAQQJ0QdjEwQBqKAIAIAFBC2otAABBAnRB2LzBAGooAgAgAUEMai0AAEECdEHYtMEAaigCACABQQ1qLQAAQQJ0QdiswQBqKAIAIAFBD2otAABBAnRB2JzBAGooAgAgAUEOai0AAEECdEHYpMEAaigCAHNzc3Nzc3Nzc3Nzc3NzcyIAQRh2c0ECdEHY/MEAaigCACABLQAUQQJ0Qdj0wQBqKAIAIAEtABVBAnRB2OzBAGooAgAgAS0AFkECdEHY5MEAaigCACABLQAXQQJ0QdjcwQBqKAIAIAEtABhBAnRB2NTBAGooAgAgAS0AGUECdEHYzMEAaigCACABLQAaQQJ0QdjEwQBqKAIAIAEtABtBAnRB2LzBAGooAgAgAS0AHEECdEHYtMEAaigCACABLQAdQQJ0QdiswQBqKAIAIAEtAB9BAnRB2JzBAGooAgAgAS0AHkECdEHYpMEAaigCAHNzc3Nzc3Nzc3NzcyABLQASIABBEHZB/wFxc0ECdEHYhMIAaigCAHMgAS0AESAAQQh2Qf8BcXNBAnRB2IzCAGooAgBzIAEtABAgAEH/AXFzQQJ0QdiUwgBqKAIAcyIAQRh2c0ECdEHY/MEAaigCACABLQAkQQJ0Qdj0wQBqKAIAIAEtACVBAnRB2OzBAGooAgAgAS0AJkECdEHY5MEAaigCACABLQAnQQJ0QdjcwQBqKAIAIAEtAChBAnRB2NTBAGooAgAgAS0AKUECdEHYzMEAaigCACABLQAqQQJ0QdjEwQBqKAIAIAEtACtBAnRB2LzBAGooAgAgAS0ALEECdEHYtMEAaigCACABLQAtQQJ0QdiswQBqKAIAIAEtAC9BAnRB2JzBAGooAgAgAS0ALkECdEHYpMEAaigCAHNzc3Nzc3Nzc3NzcyABLQAiIABBEHZB/wFxc0ECdEHYhMIAaigCAHMgAS0AISAAQQh2Qf8BcXNBAnRB2IzCAGooAgBzIAEtACAgAEH/AXFzQQJ0QdiUwgBqKAIAcyIAQRh2c0ECdEHY/MEAaigCACABLQA0QQJ0Qdj0wQBqKAIAIAEtADVBAnRB2OzBAGooAgAgAS0ANkECdEHY5MEAaigCACABLQA3QQJ0QdjcwQBqKAIAIAEtADhBAnRB2NTBAGooAgAgAS0AOUECdEHYzMEAaigCACABLQA6QQJ0QdjEwQBqKAIAIAEtADtBAnRB2LzBAGooAgAgAS0APEECdEHYtMEAaigCACABLQA9QQJ0QdiswQBqKAIAIAEtAD5BAnRB2KTBAGooAgAgAS0AP0ECdEHYnMEAaigCAHNzc3Nzc3Nzc3NzcyABLQAyIABBEHZB/wFxc0ECdEHYhMIAaigCAHMgAS0AMSAAQQh2Qf8BcXNBAnRB2IzCAGooAgBzIAEtADAgAEH/AXFzQQJ0QdiUwgBqKAIAcyEDIAFBQGshASACQUBqIgJBP0sNAAsLAkAgAkUNACACQQFrAkAgAkEDcSIERQRAIAEhAAwBCyABIQADQCAALQAAIANzQf8BcUECdEHYnMEAaigCACADQQh2cyEDIABBAWohACAEQQFrIgQNAAsLQQNJDQAgASACaiEBA0AgAC0AACADc0H/AXFBAnRB2JzBAGooAgAgA0EIdnMiAiAAQQFqLQAAc0H/AXFBAnRB2JzBAGooAgAgAkEIdnMiAiAAQQJqLQAAc0H/AXFBAnRB2JzBAGooAgAgAkEIdnMiAiAAQQNqLQAAc0H/AXFBAnRB2JzBAGooAgAgAkEIdnMhAyAAQQRqIgAgAUcNAAsLIAUgA0F/czYCAAsjACABQYyxwgBBn7HCACAAKAIALQAAIgAbQRNBDSAAGxCFAwsiACAALQAARQRAIAFBoPvCAEEFEEMPCyABQZz7wgBBBBBDCx8AIABFBEBBxL3AAEEyEMUDAAsgACACIAEoAhARAAALHQAgASgCAEUEQAALIABBtMLAADYCBCAAIAE2AgALIgAgAEEANgIYIABBADYCECAAQoCAgIACNwMIIABCATcDAAsbACAAKAIAIgBBBGooAgAgAEEIaigCACABEEQLHAAgACgCACIAQQRqKAIAIABBCGooAgAgARDLAwscACAAIAEpAgA3AgAgAEEIaiABQQhqKAIANgIACx0AIAEoAgBFBEAACyAAQeyRwQA2AgQgACABNgIACyEAIAAgAUEEajYCACAAQfCdwgBBrJ7CACABKAIAGzYCBAsdACABKAIARQRAAAsgAEHIpcIANgIEIAAgATYCAAscACAAKAIAIgAoAgAgASAAQQRqKAIAKAIMEQAACxwAIAAoAgAiACgCACABIABBBGooAgAoAhARAAALFwAgAEH4AGpBACAAQZEBai0AAEECRxsLHAAgACABKAIAIAIgAyAEIAUgASgCBCgCDBEHAAsZAQF/IAAoAhAiAQR/IAEFIABBFGooAgALCxQAIAEgASAAIAAgAV0bIAAgAFwbCxQAIAAgACABIAAgAV0bIAEgAVwbCxEAIADAQQJ0Qbj+wABqKAIACxgAIAAoAgAiACgCACAAQQRqKAIAIAEQRAsXACAAQQRqKAIAIABBCGooAgAgARDLAwsWACAAQQRqKAIAIABBCGooAgAgARBECxIAQRkgAEEBdmtBACAAQR9HGwsWACAAIAFBAXI2AgQgACABaiABNgIACxgAIAC8QYCAgIB4cUH////3A3K+IACSjwshACAAvUKAgICAgICAgIB/g0L/////////7z+EvyAAoJ0LEwEBfyAALQA5IABBAToAOUEBcQsQACAAIAFqQQFrQQAgAWtxC5AGAQZ/An8gACEFAkACQAJAIAJBCU8EQCADIAIQbSIHDQFBAAwEC0EIQQgQ/gIhAEEUQQgQ/gIhAUEQQQgQ/gIhAkEAQRBBCBD+AkECdGsiBEGAgHwgAiAAIAFqamtBd3FBA2siACAAIARLGyADTQ0BQRAgA0EEakEQQQgQ/gJBBWsgA0sbQQgQ/gIhAiAFEN8DIgAgABDGAyIEENwDIQECQAJAAkACQAJAAkACQCAAEJ8DRQRAIAIgBE0NASABQcydwwAoAgBGDQIgAUHIncMAKAIARg0DIAEQmAMNByABEMYDIgYgBGoiCCACSQ0HIAggAmshBCAGQYACSQ0EIAEQhwEMBQsgABDGAyEBIAJBgAJJDQYgASACa0GBgAhJIAJBBGogAU1xDQUgASAAKAIAIgFqQRBqIQQgAkEfakGAgAQQ/gIhAgwGC0EQQQgQ/gIgBCACayIBSw0EIAAgAhDcAyEEIAAgAhDDAiAEIAEQwwIgBCABEFwMBAtBxJ3DACgCACAEaiIEIAJNDQQgACACENwDIQEgACACEMMCIAEgBCACayICQQFyNgIEQcSdwwAgAjYCAEHMncMAIAE2AgAMAwtBwJ3DACgCACAEaiIEIAJJDQMCQEEQQQgQ/gIgBCACayIBSwRAIAAgBBDDAkEAIQFBACEEDAELIAAgAhDcAyIEIAEQ3AMhBiAAIAIQwwIgBCABEPoCIAYgBigCBEF+cTYCBAtByJ3DACAENgIAQcCdwwAgATYCAAwCCyABQQxqKAIAIgkgAUEIaigCACIBRwRAIAEgCTYCDCAJIAE2AggMAQtBuJ3DAEG4ncMAKAIAQX4gBkEDdndxNgIAC0EQQQgQ/gIgBE0EQCAAIAIQ3AMhASAAIAIQwwIgASAEEMMCIAEgBBBcDAELIAAgCBDDAgsgAA0DCyADECsiAUUNASABIAUgABDGA0F4QXwgABCfAxtqIgAgAyAAIANJGxDQAyAFED0MAwsgByAFIAEgAyABIANJGxDQAxogBRA9CyAHDAELIAAQnwMaIAAQ3gMLCxYAIAAoAgAiACgCACAAKAIEIAEQywMLDgAgAMBBudfAAGotAAALCwAgAQRAIAAQPQsLDwAgAEEBdCIAQQAgAGtyCxUAIAEgACgCACIAKAIAIAAoAgQQQwsWACAAKAIAIAEgAiAAKAIEKAIMEQIACxkAIAEoAgBBtI/DAEEFIAEoAgQoAgwRAgALEQAgAEG8AWpBACAAKAK4ARsLFAAgACgCACABIAAoAgQoAhARAAALFAAgACgCACABIAAoAgQoAgwRAAAL0AgBA38jAEHwAGsiBSQAIAUgAzYCDCAFIAI2AggCQAJAAkACQCAFAn8CQAJAIAFBgQJPBEADQCAAIAZqIAZBAWshBkGAAmosAABBv39MDQALIAZBgQJqIgcgAUkNAiABQYECayAGRw0EIAUgBzYCFAwBCyAFIAE2AhQLIAUgADYCEEGs3MIAIQZBAAwBCyAAIAZqQYECaiwAAEG/f0wNASAFIAc2AhQgBSAANgIQQYCAwwAhBkEFCzYCHCAFIAY2AhgCQCABIAJJIgYgASADSXJFBEACfwJAAkAgAiADTQRAAkACQCACRQ0AIAEgAk0EQCABIAJGDQEMAgsgACACaiwAAEFASA0BCyADIQILIAUgAjYCICACIAEiBkkEQCACQQFqIgYgAkEDayIDQQAgAiADTxsiA0kNBiAAIAZqIAAgA2prIQYDQCAGQQFrIQYgACACaiACQQFrIQIsAABBQEgNAAsgAkEBaiEGCwJAIAZFDQAgASAGTQRAIAEgBkYNAQwKCyAAIAZqLAAAQb9/TA0JCyABIAZGDQcCQCAAIAZqIgIsAAAiA0EASARAIAItAAFBP3EhACADQR9xIQEgA0FfSw0BIAFBBnQgAHIhAAwECyAFIANB/wFxNgIkQQEMBAsgAi0AAkE/cSAAQQZ0ciEAIANBcE8NASAAIAFBDHRyIQAMAgsgBUHkAGpBvAI2AgAgBUHcAGpBvAI2AgAgBUHUAGpBxAA2AgAgBUE8akEENgIAIAVBxABqQQQ2AgAgBUHkgMMANgI4IAVBADYCMCAFQcQANgJMIAUgBUHIAGo2AkAgBSAFQRhqNgJgIAUgBUEQajYCWCAFIAVBDGo2AlAgBSAFQQhqNgJIDAgLIAFBEnRBgIDwAHEgAi0AA0E/cSAAQQZ0cnIiAEGAgMQARg0FCyAFIAA2AiRBASAAQYABSQ0AGkECIABBgBBJDQAaQQNBBCAAQYCABEkbCyEAIAUgBjYCKCAFIAAgBmo2AiwgBUE8akEFNgIAIAVBxABqQQU2AgAgBUHsAGpBvAI2AgAgBUHkAGpBvAI2AgAgBUHcAGpBwAI2AgAgBUHUAGpBwQI2AgAgBUG4gcMANgI4IAVBADYCMCAFQcQANgJMIAUgBUHIAGo2AkAgBSAFQRhqNgJoIAUgBUEQajYCYCAFIAVBKGo2AlggBSAFQSRqNgJQIAUgBUEgajYCSAwFCyAFIAIgAyAGGzYCKCAFQTxqQQM2AgAgBUHEAGpBAzYCACAFQdwAakG8AjYCACAFQdQAakG8AjYCACAFQaiAwwA2AjggBUEANgIwIAVBxAA2AkwgBSAFQcgAajYCQCAFIAVBGGo2AlggBSAFQRBqNgJQIAUgBUEoajYCSAwECyADIAZB/IHDABCmAwALIAAgAUEAIAcgBBCKAwALQZ3xwgBBKyAEEJMCAAsgACABIAYgASAEEIoDAAsgBUEwaiAEEKwCAAsRACAAKAIAIAAoAgQgARDLAwsIACAAIAEQbQsmAAJAIAAgARBtIgFFDQAgARDfAxCfAw0AIAFBACAAEM4DGgsgAQsQACAAKAIAIAAoAgQgARBECxMAIABBKDYCBCAAQbDEwAA2AgALEAAgACACNgIEIAAgATYCAAsTACAAQSg2AgQgAEH02cAANgIACxAAIABBADYCCCAAQgA3AwALEwAgAEEoNgIEIABB2JzCADYCAAsTACAAQSg2AgQgAEGAr8IANgIACxAAIABBBDoAACAAIAE6AAELFgBB0JnDACAANgIAQcyZwwBBAToAAAsTACAAQbjMwgA2AgQgACABNgIACw0AIAAtAARBAnFBAXYLDwAgACABQQRqKQIANwMACxAAIAEgACgCACAAKAIEEEMLDQAgAC0AGEEQcUEEdgsNACAALQAYQSBxQQV2Cw0AIABBAEGgGxDOAxoLCgBBACAAayAAcQsLACAALQAEQQNxRQsMACAAIAFBA3I2AgQLDQAgACgCACAAKAIEaguUBAEFfyAAKAIAIQAjAEEQayIDJAACQAJ/AkAgAUGAAU8EQCADQQA2AgwgAUGAEE8NASADIAFBP3FBgAFyOgANIAMgAUEGdkHAAXI6AAxBAgwCCyAAKAIIIgIgACgCAEYEQCMAQSBrIgQkAAJAAkAgAkEBaiICRQ0AQQggACgCACIFQQF0IgYgAiACIAZJGyICIAJBCE0bIgJBf3NBH3YhBgJAIAUEQCAEQQE2AhggBCAFNgIUIAQgAEEEaigCADYCEAwBCyAEQQA2AhgLIAQgAiAGIARBEGoQtwEgBCgCBCEFIAQoAgBFBEAgACACNgIAIAAgBTYCBAwCCyAEQQhqKAIAIgJBgYCAgHhGDQEgAkUNACAFIAIQygMACxCgAgALIARBIGokACAAKAIIIQILIAAgAkEBajYCCCAAKAIEIAJqIAE6AAAMAgsgAUGAgARPBEAgAyABQT9xQYABcjoADyADIAFBBnZBP3FBgAFyOgAOIAMgAUEMdkE/cUGAAXI6AA0gAyABQRJ2QQdxQfABcjoADEEEDAELIAMgAUE/cUGAAXI6AA4gAyABQQx2QeABcjoADCADIAFBBnZBP3FBgAFyOgANQQMLIQEgASAAKAIAIAAoAggiAmtLBEAgACACIAEQsQEgACgCCCECCyAAKAIEIAJqIANBDGogARDQAxogACABIAJqNgIICyADQRBqJABBAAsOACAAKAIAGgNADAALAAt5AQF/IwBBMGsiAyQAIAMgATYCBCADIAA2AgAgA0EUakECNgIAIANBHGpBAjYCACADQSxqQcQANgIAIANBsPzCADYCECADQQA2AgggA0HEADYCJCADIANBIGo2AhggAyADQQRqNgIoIAMgAzYCICADQQhqIAIQrAIAC3kBAX8jAEEwayIDJAAgAyABNgIEIAMgADYCACADQRRqQQI2AgAgA0EcakECNgIAIANBLGpBxAA2AgAgA0HQ/MIANgIQIANBADYCCCADQcQANgIkIAMgA0EgajYCGCADIANBBGo2AiggAyADNgIgIANBCGogAhCsAgALeQEBfyMAQTBrIgMkACADIAE2AgQgAyAANgIAIANBFGpBAjYCACADQRxqQQI2AgAgA0EsakHEADYCACADQYT9wgA2AhAgA0EANgIIIANBxAA2AiQgAyADQSBqNgIYIAMgA0EEajYCKCADIAM2AiAgA0EIaiACEKwCAAsOACAANQIAQQEgARCAAQttAQF/IwBBEGsiAyQAIAMgATYCDCADIAA2AggjAEEgayIAJAAgAEEMakEBNgIAIABBFGpBATYCACAAQfj1wgA2AgggAEEANgIAIABBvAI2AhwgACADQQhqNgIYIAAgAEEYajYCECAAIAIQrAIACw0AIAAoAgAgASACEGcLDgAgADEAAEEBIAEQgAELDgAgACkDAEEBIAEQgAELzAIBA38gACgCAC0AACECIwBBgAFrIgQkAAJAAkACQAJAIAEoAhgiAEEQcUUEQCAAQSBxDQEgAq1C/wGDQQEgARCAASECDAQLQQAhAANAIAAgBGpB/wBqQTBB1wAgAkEPcSIDQQpJGyADajoAACAAQQFrIQAgAkH/AXEiA0EEdiECIANBD0sNAAsgAEGAAWoiAkGBAU8NASABQQFBnPjCAEECIAAgBGpBgAFqQQAgAGsQSSECDAMLQQAhAANAIAAgBGpB/wBqQTBBNyACQQ9xIgNBCkkbIANqOgAAIABBAWshACACQf8BcSIDQQR2IQIgA0EPSw0ACyAAQYABaiICQYEBTw0BIAFBAUGc+MIAQQIgACAEakGAAWpBACAAaxBJIQIMAgsgAkGAAUGM+MIAEKQDAAsgAkGAAUGM+MIAEKQDAAsgBEGAAWokACACC8gDAgF+BH8gACgCACkDACECIwBBgAFrIgUkAAJAAkACQAJAIAEo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QTRqQQE2AgAgAEE8akEANgIAIABBrOnAADYCMCAAQfzawAA2AjggAEEANgIoIAEgAEEoahDzAQwYCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQfzowAA2AjAgAEEANgIoIABBrAE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ8wEMFwsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEHI6MAANgIwIABBADYCKCAAQawBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEPMBDBYLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBmOjAADYCMCAAQQA2AiggAEGsATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDzAQwVCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQejnwAA2AjAgAEEANgIoIABBrAE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ8wEMFAsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEGs58AANgIwIABBADYCKCAAQawBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEPMBDBMLIAAgAkEEajYCICAAIAJBCGo2AiQgAEE0akEDNgIAIABBPGpBAjYCACAAQRRqQa4BNgIAIABB9ObAADYCMCAAQQA2AiggAEGuATYCDCAAIABBCGo2AjggACAAQSBqNgIQIAAgAEEkajYCCCABIABBKGoQ8wEMEgsgACACQQRqNgIgIAAgAkEIajYCJCAAQTRqQQM2AgAgAEE8akECNgIAIABBFGpBrwE2AgAgAEGw5sAANgIwIABBADYCKCAAQa8BNgIMIAAgAEEIajYCOCAAIABBJGo2AhAgACAAQSBqNgIIIAEgAEEoahDzAQwRCyAAQTRqQQE2AgAgAEE8akEANgIAIABBgObAADYCMCAAQfzawAA2AjggAEEANgIoIAEgAEEoahDzAQwQCyAAIAJBAmo2AiAgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQI2AgAgAEEUakGwATYCACAAQczlwAA2AjAgAEEANgIoIABBsQE2AgwgACAAQQhqNgI4IAAgAEEkajYCECAAIABBIGo2AgggASAAQShqEPMBDA8LIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBkOXAADYCMCAAQQA2AiggAEGxATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDzAQwOCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQdjkwAA2AjAgAEEANgIoIABBsgE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ8wEMDQsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEGs5MAANgIwIABBADYCKCAAQbIBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEPMBDAwLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBiOTAADYCMCAAQQA2AiggAEGyATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDzAQwLCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQeTjwAA2AjAgAEEANgIoIABBsgE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ8wEMCgsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEHA48AANgIwIABBADYCKCAAQbIBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEPMBDAkLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBjOPAADYCMCAAQQA2AiggAEGyATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDzAQwICyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQdziwAA2AjAgAEEANgIoIABBsgE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ8wEMBwsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEGw4sAANgIwIABBADYCKCAAQbIBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEPMBDAYLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBiOLAADYCMCAAQQA2AiggAEGyATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDzAQwFCyAAQTRqQQE2AgAgAEE8akEANgIAIABB5OHAADYCMCAAQfzawAA2AjggAEEANgIoIAEgAEEoahDzAQwECyAAQTRqQQE2AgAgAEE8akEANgIAIABByN/AADYCMCAAQfzawAA2AjggAEEANgIoIAEgAEEoahDzAQwDCyAAIAJBBGo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQYTfwAA2AjAgAEEANgIoIABBswE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ8wEMAgsCQAJAAkACQAJAAkACQAJAIAItAAFBAWsOBwECAwQFBgcACyAAQTRqQQE2AgAgAEE8akEANgIAIABB+N7AADYCMCAAQfzawAA2AjggAEEANgIoIAEgAEEoahDzAQwICyAAQTRqQQE2AgAgAEE8akEANgIAIABBzN7AADYCMCAAQfzawAA2AjggAEEANgIoIAEgAEEoahDzAQwHCyAAQTRqQQE2AgAgAEE8akEANgIAIABBnN7AADYCMCAAQfzawAA2AjggAEEANgIoIAEgAEEoahDzAQwGCyAAQTRqQQE2AgAgAEE8akEANgIAIABB9N3AADYCMCAAQfzawAA2AjggAEEANgIoIAEgAEEoahDzAQwFCyAAQTRqQQE2AgAgAEE8akEANgIAIABBzN3AADYCMCAAQfzawAA2AjggAEEANgIoIAEgAEEoahDzAQwECyAAQTRqQQE2AgAgAEE8akEANgIAIABBkN3AADYCMCAAQfzawAA2AjggAEEANgIoIAEgAEEoahDzAQwDCyAAQTRqQQE2AgAgAEE8akEANgIAIABB1NzAADYCMCAAQfzawAA2AjggAEEANgIoIAEgAEEoahDzAQwCCyAAQTRqQQE2AgAgAEE8akEANgIAIABBhNzAADYCMCAAQfzawAA2AjggAEEANgIoIAEgAEEoahDzAQwBCyAAIAJBAWoiAjYCJCAAQTRqQQE2AgAgAEE8akEANgIAIABB6N/AADYCMCAAQfzawAA2AjggAEEANgIoQQEgASAAQShqEPMBDQAaAkACQAJAAkAgAi0AACICDgMBAgMACwJAAkACQAJAIAJB/AFrDgMBAgMACyAAQTRqQQI2AgAgAEE8akEBNgIAIABBgODAADYCMCAAQQA2AiggAEG0ATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDzAQwGCyAAQTRqQQE2AgAgAEE8akEANgIAIABBwOHAADYCMCAAQfzawAA2AjggAEEANgIoIAEgAEEoahDzAQwFCyAAQTRqQQE2AgAgAEE8akEANgIAIABBoOHAADYCMCAAQfzawAA2AjggAEEANgIoIAEgAEEoahDzAQwECyAAQTRqQQE2AgAgAEE8akEANgIAIABB/ODAADYCMCAAQfzawAA2AjggAEEANgIoIAEgAEEoahDzAQwDCyAAQTRqQQE2AgAgAEE8akEANgIAIABB3ODAADYCMCAAQfzawAA2AjggAEEANgIoIAEgAEEoahDzAQwCCyAAQTRqQQE2AgAgAEE8akEANgIAIABBvODAADYCMCAAQfzawAA2AjggAEEANgIoIAEgAEEoahDzAQwBCyAAQTRqQQE2AgAgAEE8akEANgIAIABBoODAADYCMCAAQfzawAA2AjggAEEANgIoIAEgAEEoahDzAQsgAEFAayQACwwAIAAgASkCQDcDAAvQAQEBfyAAKAIAIQIjAEEQayIAJAAgACABQfj/wABBCRDHAiAAIAIoAAAiATYCCCAAQYGAwQBBBCAAQQhqQYiAwQAQeCAAIAFBf3NBBXZBAXE6AAxBmIDBAEEIIABBDGpBoIDBABB4IAAgAUENdkEBcToADUGwgMEAQQcgAEENakGggMEAEHggACABQRV2QQFxOgAOQbeAwQBBCCAAQQ5qQaCAwQAQeCAAIAFBHXZBAXE6AA9Bv4DBAEEIIABBD2pBoIDBABB4EOABIABBEGokAAs0ACABIAAoAgAtAABBGHRBgICAIGpBGHVBAnQiAEG8nMEAaigCACAAQaCcwQBqKAIAEIUDCwsAIAAoAgAgARBwCwwAIAAoAgAgARDkAgsMACAAKAIAIAEQpwMLDAAgACgCACABEKoDCwwAIAAoAgAgARDFAQsOACABQZC7wgBBCxCFAwsJACAAIAEQIAALCgAgACgCBEF4cQsKACAAKAIEQQFxCwoAIAAoAgxBAXELCgAgACgCDEEBdgsaACAAIAFB7JnDACgCACIAQaECIAAbEQEAAAsKACACIAAgARBDCwwAIAAoAgAgARCEAQsNACABQcj7wgBBAhBDC68BAQN/IAEhBQJAIAJBD00EQCAAIQEMAQsgAEEAIABrQQNxIgNqIQQgAwRAIAAhAQNAIAEgBToAACABQQFqIgEgBEkNAAsLIAQgAiADayICQXxxIgNqIQEgA0EASgRAIAVB/wFxQYGChAhsIQMDQCAEIAM2AgAgBEEEaiIEIAFJDQALCyACQQNxIQILIAIEQCABIAJqIQIDQCABIAU6AAAgAUEBaiIBIAJJDQALCyAAC0MBA38CQCACRQ0AA0AgAC0AACIEIAEtAAAiBUYEQCAAQQFqIQAgAUEBaiEBIAJBAWsiAg0BDAILCyAEIAVrIQMLIAMLswIBB38CQCACIgRBD00EQCAAIQIMAQsgAEEAIABrQQNxIgNqIQUgAwRAIAAhAiABIQYDQCACIAYtAAA6AAAgBkEBaiEGIAJBAWoiAiAFSQ0ACwsgBSAEIANrIghBfHEiB2ohAgJAIAEgA2oiA0EDcSIEBEAgB0EATA0BIANBfHEiBkEEaiEBQQAgBEEDdCIJa0EYcSEEIAYoAgAhBgNAIAUgBiAJdiABKAIAIgYgBHRyNgIAIAFBBGohASAFQQRqIgUgAkkNAAsMAQsgB0EATA0AIAMhAQNAIAUgASgCADYCACABQQRqIQEgBUEEaiIFIAJJDQALCyAIQQNxIQQgAyAHaiEBCyAEBEAgAiAEaiEDA0AgAiABLQAAOgAAIAFBAWohASACQQFqIgIgA0kNAAsLIAALlAUBB38CQAJAAn8CQCACIgMgACABa0sEQCABIANqIQUgACADaiECIANBD0sNASAADAILIANBD00EQCAAIQIMAwsgAEEAIABrQQNxIgVqIQQgBQRAIAAhAiABIQADQCACIAAtAAA6AAAgAEEBaiEAIAJBAWoiAiAESQ0ACwsgBCADIAVrIgNBfHEiBmohAgJAIAEgBWoiBUEDcSIABEAgBkEATA0BIAVBfHEiB0EEaiEBQQAgAEEDdCIIa0EYcSEJIAcoAgAhAANAIAQgACAIdiABKAIAIgAgCXRyNgIAIAFBBGohASAEQQRqIgQgAkkNAAsMAQsgBkEATA0AIAUhAQNAIAQgASgCADYCACABQQRqIQEgBEEEaiIEIAJJDQALCyADQQNxIQMgBSAGaiEBDAILIAJBfHEhAEEAIAJBA3EiBmshByAGBEAgASADakEBayEEA0AgAkEBayICIAQtAAA6AAAgBEEBayEEIAAgAkkNAAsLIAAgAyAGayIGQXxxIgNrIQJBACADayEDAkAgBSAHaiIFQQNxIgQEQCADQQBODQEgBUF8cSIHQQRrIQFBACAEQQN0IghrQRhxIQkgBygCACEEA0AgAEEEayIAIAQgCXQgASgCACIEIAh2cjYCACABQQRrIQEgACACSw0ACwwBCyADQQBODQAgASAGakEEayEBA0AgAEEEayIAIAEoAgA2AgAgAUEEayEBIAAgAksNAAsLIAZBA3EiAEUNAiADIAVqIQUgAiAAawshACAFQQFrIQEDQCACQQFrIgIgAS0AADoAACABQQFrIQEgACACSQ0ACwwBCyADRQ0AIAIgA2ohAANAIAIgAS0AADoAACABQQFqIQEgAkEBaiICIABJDQALCwsOACABQZjCwABBCBCFAwsJACAAQQA2AgALCQAgAEIANwIACwgAIAAgARASCwcAIABBEGoLCQAgACABEOQCCwkAIABBADoARwsJACAAQQA6ADkLCwBB5J3DACgCAEULxQMBAn8CfyMAQTBrIgIkAAJAAkACQAJAAkACQCAALQAAQQFrDgMBAgMACyACIAAoAgQ2AgwgAkEQaiIAIAFB+MnCAEECEMcCIABB+snCAEEEIAJBDGpBgMrCABB4IAJBKDoAH0HGycIAQQQgAkEfakHMycIAEHhBFEEBEIwDIgBFDQQgAEEQakHb0cIAKAAANgAAIABBCGpB09HCACkAADcAACAAQcvRwgApAAA3AAAgAkEUNgIoIAIgADYCJCACQRQ2AiBB3MnCAEEHIAJBIGpBkMrCABB4EOABIQAgAigCIEUNAyACKAIkED0MAwsgAiAALQABOgAQIAJBIGoiACABQfTJwgBBBBC+AiAAIAJBEGpBzMnCABCKARDMASEADAILIAAoAgQhACACQSBqIgMgAUHBycIAQQUQxwIgA0HGycIAQQQgAEEIakHMycIAEHhB3MnCAEEHIABB5MnCABB4EOABIQAMAQsgAiAAKAIEIgBBCGo2AhAgAiAANgIgIAFBnM3CAEEGQcbJwgBBBCACQRBqQYzNwgBBos3CAEEFIAJBIGpBqM3CABC6ASEACyACQTBqJAAgAAwBC0EUQQEQygMACwsHACAAIAFqCwcAIAAgAWsLBwAgAEEIagsHACAAQQhrC+kCAQd/An8gASECQYCAxAAhAQJAAkACQAJAQQMgACgCBCIFQYCAxABrIAVB///DAE0b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cmF3X3ZlYy5ycywAEABMAAAAqgEAAAkAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2FsbG9jL3NyYy92ZWMvbW9kLnJziAAQAEwAAADUBwAAJAAAAHJlc2l6ZQAAAQAAAAAAAAABAAAAAgAAAAMAAAAEAAAAb25lLXRpbWUgaW5pdGlhbGl6YXRpb24gbWF5IG5vdCBiZSBwZXJmb3JtZWQgcmVjdXJzaXZlbHkEARAAOAAAAE9uY2UgaW5zdGFuY2UgaGFzIHByZXZpb3VzbHkgYmVlbiBwb2lzb25lZAAARAEQACoAAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9zdGQvc3JjL3N5bmMvb25jZS5ycwCjARAATAAAAI8AAAAyAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9jb3JlL3NyYy9vcHMvYXJpdGgucnMAAAAAAhAATQAAAOgBAAABAAAAYXR0ZW1wdCB0byBkaXZpZGUgYnkgemVyb0M6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGNvbnNvbGVfZXJyb3JfcGFuaWNfaG9vay0wLjEuN1xzcmNcbGliLnJzAAAAeQIQAGgAAACVAAAADgAAAHNwZWVkaHlwZXJzcGVlZHJldmVyc2VyYWluYm93cm90YXRlc3BpbnJldnNsaWRld2lnZ2xlc2hha2Vhc3NlcnRpb24gZmFpbGVkOiB4IGFzIHU2NCArIHdpZHRoIGFzIHU2NCA8PSBzZWxmLndpZHRoKCkgYXMgdTY0QzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcaW1hZ2UtMC4yNC42XC4vc3JjXGltYWdlLnJzbgMQAFoAAAC9AwAACQAAAGFzc2VydGlvbiBmYWlsZWQ6IHkgYXMgdTY0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c3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xnaWYtMC4xMi4wXHNyY1xlbmNvZGVyLnJzTkVUU0NBUEUyLjAAAOMREABYAAAAFQEAACYAAADjERAAWAAAAAMBAAAbAAAA4xEQAFgAAAD9AAAAJgAAAOMREABYAAAA5QAAACYAAABHSUY4OWEAAOMREABYAAAAxAAAACYAAAACAAAAKwAAAAAAAAABAAAALAAAACsAAAAAAAAAAQAAAC0AAAArAAAAAAAAAAEAAAAuAAAAKwAAAAQAAAAEAAAALwAAADAAAAAxAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9jb3JlL3NyYy9zdHIvcGF0dGVybi5yc2Fzc2VydGlvbiBmYWlsZWQ6IHN0ZXAgIT0gMC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvY29yZS9zcmMvaXRlci9hZGFwdGVycy9zdGVwX2J5LnJzAFYTEABZAAAAFQAAAAkAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xpbWFnZS0wLjI0LjZcLi9zcmNcYnVmZmVyLnJzAMATEABbAAAAtwMAAEYAAABJbWFnZSBpbmRleCAgb3V0IG9mIGJvdW5kcyAALBQQAAwAAAA4FBAADwAAAMATEABbAAAAsgMAABUAAADsEhAATwAAALgBAAAmAAAAbmFtZXBhcmFtAAAAeBQQAAQAAAB8FBAABQBBmqnAAAvXBoC/AAAAwAAAgL8AAAAAAACAPwAAAEAAAIA/AAAAAGNodW5rcyBjYW5ub3QgaGF2ZSBhIHNpemUgb2YgemVybwAAALgUEAAhAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9tb2QucnMAAADkFBAATQAAAHEDAAAJAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcaW1hZ2Vwcm9jLTAuMjMuMFxzcmNcZ2VvbWV0cmljX3RyYW5zZm9ybWF0aW9ucy5yc0QVEABwAAAAiQIAAA0AAABgdW53cmFwX3Rocm93YCBmYWlsZWQAAAAyAAAADAAAAAQAAAAzAAAAMgAAAAwAAAAEAAAANAAAADMAAADcFRAANQAAADYAAAA3AAAAOAAAADkAAABFcnIAOgAAAAQAAAAEAAAAOwAAAE9rAAA6AAAABAAAAAQAAAA8AAAAYXNzZXJ0aW9uIGZhaWxlZDogbWlkIDw9IHNlbGYubGVuKCkAQAAAAAwAAAAEAAAAQQAAAEIAAAAVAAAAYSBEaXNwbGF5IGltcGxlbWVudGF0aW9uIHJldHVybmVkIGFuIGVycm9yIHVuZXhwZWN0ZWRseQBDAAAAAAAAAAEAAAAXAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9hbGxvYy9zcmMvc3RyaW5nLnJzAMQWEABLAAAA6QkAAA4AAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL21vZC5ycwAAACAXEABNAAAADQwAAAkAAABhc3NlcnRpb24gZmFpbGVkOiBrIDw9IHNlbGYubGVuKCkAAAAgFxAATQAAADgMAAAJAAAAAAAAAGNodW5rcyBjYW5ub3QgaGF2ZSBhIHNpemUgb2YgemVybwAAALgXEAAhAAAAIBcQAE0AAADAAwAACQBBgLDAAAvFAmF0dGVtcHQgdG8gY2FsY3VsYXRlIHRoZSByZW1haW5kZXIgd2l0aCBhIGRpdmlzb3Igb2YgemVyby9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvYWxsb2Mvc3JjL3NsaWNlLnJzADkYEABKAAAAkgAAABEAAABtaXNzaW5nIGZpZWxkIGBglBgQAA8AAACjGBAAAQAAAHVua25vd24gZmllbGQgYGAsIGV4cGVjdGVkIAC0GBAADwAAAMMYEAAMAAAAYCwgdGhlcmUgYXJlIG5vIGZpZWxkcwAAtBgQAA8AAADgGBAAFgAAAGdpZnBuZ1Vuc3VwcG9ydGVkIGZvcm1hdDogAAAOGRAAFAAAAHNyY1x1dGlscy5ycywZEAAMAAAAOwAAABIAQdCywAAL0QVhdHRlbXB0IHRvIGRpdmlkZSBieSB6ZXJvAAAALBkQAAwAAABBAAAAIAAAACwZEAAMAAAAVAAAABgAAAAsGRAADAAAAFcAAAAYAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcZ2lmLTAuMTIuMFxzcmNccmVhZGVyXG1vZC5ycwCcGRAAWwAAAHgBAAAjAAAAnBkQAFsAAAB6AQAAGAAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWUAnBkQAFsAAACCAQAAKwAAAJwZEABbAAAAgwEAACAAAABubyBjb2xvciB0YWJsZSBhdmFpbGFibGUgZm9yIGN1cnJlbnQgZnJhbWUAAJwZEABbAAAAPwEAACsAAABpbWFnZSB0cnVuY2F0ZWQAnBkQAFsAAABEAQAAHAAAAGludGVybmFsIGVycm9yOiBlbnRlcmVkIHVucmVhY2hhYmxlIGNvZGWcGRAAWwAAAO8AAAAVAAAAZmlsZSBkb2VzIG5vdCBjb250YWluIGFueSBpbWFnZSBkYXRhdW5leHBlY3RlZCBFT0ZJbWFnZSBkaW1lbnNpb25zICgsICkgYXJlIHRvbyBsYXJnZQAAACobEAASAAAAPBsQAAIAAAA+GxAADwAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvc3RkL3NyYy9pby9jdXJzb3IucnNoGxAATAAAAOsAAAAKAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9jb3JlL3NyYy9vcHMvYXJpdGgucnMAAADEGxAATQAAAOgBAAABAEGwuMAAC9JRYXR0ZW1wdCB0byBkaXZpZGUgYnkgemVybwAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWVDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xpbWFnZS0wLjI0LjZcLi9zcmNcY29kZWNzXGdpZi5ycwAAdxwQAF8AAAArAgAANQAAAHccEABfAAAAIgIAACgAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xpbWFnZS0wLjI0LjZcLi9zcmNcYnVmZmVyLnJzAPgcEABbAAAAtwMAAEYAAABJbWFnZSBpbmRleCAgb3V0IG9mIGJvdW5kcyAAZB0QAAwAAABwHRAADwAAAPgcEABbAAAAsgMAABUAAABFAAAAGAEAAAgAAABGAAAARwAAAEgAAABJAAAAvB0QAAAAAABLAAAABAAAAAQAAABMAAAATQAAAE4AAABRAAAADAAAAAQAAABSAAAAUwAAAFQAAABhIERpc3BsYXkgaW1wbGVtZW50YXRpb24gcmV0dXJuZWQgYW4gZXJyb3IgdW5leHBlY3RlZGx5AFUAAAAAAAAAAQAAABcAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2FsbG9jL3NyYy9zdHJpbmcucnMAPB4QAEsAAADpCQAADgAAAGludmFsaWQgdHlwZTogLCBleHBlY3RlZCAAAACYHhAADgAAAKYeEAALAAAAY2xvc3VyZSBpbnZva2VkIHJlY3Vyc2l2ZWx5IG9yIGFmdGVyIGJlaW5nIGRyb3BwZWQAAHN0cnVjdCB2YXJpYW50AAD4HhAADgAAAHR1cGxlIHZhcmlhbnQAAAAQHxAADQAAAG5ld3R5cGUgdmFyaWFudAAoHxAADwAAAHVuaXQgdmFyaWFudEAfEAAMAAAAZW51bVQfEAAEAAAAbWFwAGAfEAADAAAAc2VxdWVuY2VsHxAACAAAAG5ld3R5cGUgc3RydWN0AAB8HxAADgAAAE9wdGlvbiB2YWx1ZZQfEAAMAAAAdW5pdCB2YWx1ZQAAqB8QAAoAAABieXRlIGFycmF5AAC8HxAACgAAAHN0cmluZyAA0B8QAAcAAABjaGFyYWN0ZXIgYGDgHxAACwAAAOsfEAABAAAAZmxvYXRpbmcgcG9pbnQgYPwfEAAQAAAA6x8QAAEAAABpbnRlZ2VyIGAAAAAcIBAACQAAAOsfEAABAAAAYm9vbGVhbiBgAAAAOCAQAAkAAADrHxAAAQAAAG9uZSBvZiAAVCAQAAcAAAAsIAAAZCAQAAIAAADrHxAAAQAAAOsfEAABAAAAYCBvciBgAADrHxAAAQAAAIAgEAAGAAAA6x8QAAEAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xzZXJkZS0xLjAuMTU5XHNyY1xkZVxtb2QucnNleHBsaWNpdCBwYW5pY6AgEABaAAAA7AgAABIAAABhIHN0cmluZ2oAAAAIAAAABAAAAGsAAABsAAAAbQAAAAgAAAAEAAAAbgAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xidWZmZXIucnMARCEQAFsAAADKAgAACgAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWUARCEQAFsAAADJAgAAQwAAAEJ1ZmZlciBsZW5ndGggaW4gYEltYWdlQnVmZmVyOjpuZXdgIG92ZXJmbG93cyB1c2l6ZQBEIRAAWwAAAN8EAAAOAAAAZGVzY3JpcHRpb24oKSBpcyBkZXByZWNhdGVkOyB1c2UgRGlzcGxheSgpTGltaXRTdXBwb3J0X25vbl9leGhhdXN0aXZlAAAAbwAAAAQAAAAEAAAAcAAAAExpbWl0c21heF9pbWFnZV93aWR0aAAAAG8AAAAEAAAABAAAAHEAAABtYXhfaW1hZ2VfaGVpZ2h0bWF4X2FsbG9jAAAAbwAAAAQAAAAEAAAAcgAAAHMAAAAUAAAABAAAAHQAAABzAAAAFAAAAAQAAAB1AAAAdAAAANwiEAB2AAAAdwAAAHgAAAB5AAAAegAAAHsAAAAMAAAABAAAAHwAAAB7AAAADAAAAAQAAAB9AAAAfAAAABgjEAB+AAAAfwAAAIAAAACBAAAAggAAAIMAAAAIAAAABAAAAIQAAACDAAAACAAAAAQAAACFAAAAhAAAAFQjEACGAAAAhwAAAIAAAACIAAAAggAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvY29yZS9zcmMvb3BzL2FyaXRoLnJzAAAAkCMQAE0AAADoAQAAAQAAAGF0dGVtcHQgdG8gZGl2aWRlIGJ5IHplcm8AAACQAAAADAAAAAQAAACRAAAAkgAAAJMAAABhIERpc3BsYXkgaW1wbGVtZW50YXRpb24gcmV0dXJuZWQgYW4gZXJyb3IgdW5leHBlY3RlZGx5AJQAAAAAAAAAAQAAABcAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2FsbG9jL3NyYy9zdHJpbmcucnMAbCQQAEsAAADpCQAADgAAAFRoZSBkZWNvZGVyIGZvciAgZG9lcyBub3Qgc3VwcG9ydCB0aGUgZm9ybWF0IGZlYXR1cmVzIAAAyCQQABAAAADYJBAAJgAAAFRoZSBkZWNvZGVyIGRvZXMgbm90IHN1cHBvcnQgdGhlIGZvcm1hdCBmZWF0dXJlIBAlEAAwAAAAVGhlIGltYWdlIGZvcm1hdCAgaXMgbm90IHN1cHBvcnRlZAAASCUQABEAAABZJRAAEQAAAFRoZSBpbWFnZSBmb3JtYXQgY291bGQgbm90IGJlIGRldGVybWluZWR8JRAAKAAAAFRoZSBmaWxlIGV4dGVuc2lvbiAgd2FzIG5vdCByZWNvZ25pemVkIGFzIGFuIGltYWdlIGZvcm1hdAAAAKwlEAATAAAAvyUQACYAAAAgZG9lcyBub3Qgc3VwcG9ydCB0aGUgY29sb3IgdHlwZSBgYADIJBAAEAAAAPglEAAiAAAAGiYQAAEAAABUaGUgZW5kIG9mIHRoZSBpbWFnZSBoYXMgYmVlbiByZWFjaGVkAAAANCYQACUAAABUaGUgcGFyYW1ldGVyIGlzIG1hbGZvcm1lZDogZCYQABwAAABUaGUgZW5kIHRoZSBpbWFnZSBzdHJlYW0gaGFzIGJlZW4gcmVhY2hlZCBkdWUgdG8gYSBwcmV2aW91cyBlcnJvcgAAAIgmEABBAAAAVGhlIEltYWdlJ3MgZGltZW5zaW9ucyBhcmUgZWl0aGVyIHRvbyBzbWFsbCBvciB0b28gbGFyZ2XUJhAAOAAAAAoAAAAUJxAAAQAAAEZvcm1hdCBl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IGEgY29tcHJlc3Npb24gZmxhZyBmb3IgaVRYdCBjaHVuay4ADC4QAEcAAABVc2luZyBhbiB1bnJlY29nbml6ZWQgYnl0ZSBhcyBjb21wcmVzc2lvbiBtZXRob2QuAAAAXC4QADEAAABPdXQgb2YgZGVjb21wcmVzc2lvbiBzcGFjZS4gVHJ5IHdpdGggYSBsYXJnZXIgbGltaXQumC4QADQAAABJbnZhbGlkIGNvbXByZXNzZWQgdGV4dCBkYXRhLgAAANQuEAAdAAAATm8gbnVsbCBzZXBhcmF0b3IgaW4gdEVYdCBjaHVuay78LhAAIAAAAEtleXdvcmQgZW1wdHkgb3IgbG9uZ2VyIHRoYW4gNzkgYnl0ZXMuAAAkLxAAJgAAAFVucmVwcmVzZW50YWJsZSBkYXRhIGluIHRFWHQgY2h1bmsuAFQvEAAjAAAALgAAAHwtEAAAAAAAgC8QAAEAAABJREFUIG9yIGZEQVQgY2h1bmsgaXMgaGFzIG5vdCBlbm91Z2ggZGF0YSBmb3IgaW1hZ2UulC8QADQAAABDb3JydXB0IGRlZmxhdGUgc3RyZWFtLiDQLxAAGAAAAEVycm9yIG51bWJlciAAAADwLxAADQAAAIAvEAABAAAASGFzIG1vcmUgb3V0cHV0LhAwEAAQAAAATmVlZHMgbW9yZSBpbnB1dC4AAAAoMBAAEQAAAFVuZXhwZWN0ZWQgZG9uZSBzdGF0dXMuAEQwEAAXAAAAQWRsZXIzMiBjaGVja3N1bSBmYWlsZWQuZDAQABgAAABJbnZhbGlkIGlucHV0IHBhcmFtZXRlcnMuAAAAhDAQABkAAABVbmV4cGVjdGVkIGVuZCBvZiBkYXRhLgCoMBAAFwAAAFN1YiBmcmFtZSBpcyBvdXQtb2YtYm91bmRzLgDIMBAAGwAAAFVua25vd24gaW50ZXJsYWNlIG1ldGhvZCAAAADsMBAAGQAAAIAvEAABAAAAVW5rbm93biBmaWx0ZXIgbWV0aG9kIAAAGDEQABYAAACALxAAAQAAAFVua25vd24gY29tcHJlc3Npb24gbWV0aG9kIABAMRAAGwAAAIAvEAABAAAASW52YWxpZCBzUkdCIHJlbmRlcmluZyBpbnRlbnQgAABsMRAAHgAAAIAvEAABAAAASW52YWxpZCBwaHlzaWNhbCBwaXhlbCBzaXplIHVuaXQgAAAAnDEQACEAAACALxAAAQAAAEludmFsaWQgYmxlbmQgb3AgAAAA0DEQABEAAACALxAAAQAAAEludmFsaWQgZGlzcG9zZSBvcCAA9DEQABMAAACALxAAAQAAAEludmFsaWQgY29sb3IgdHlwZSAAGDIQABMAAACALxAAAQAAAEludmFsaWQgZGlzcG9zZSBvcGVyYXRpb24gAAA8MhAAGgAAAIAvEAABAAAAVHJhbnNwYXJlbmN5IGNodW5rIGZvdW5kIGZvciBjb2xvciB0eXBlIGgyEAAoAAAAgC8QAAEAAABJbnZhbGlkIGNvbG9yL2RlcHRoIGNvbWJpbmF0aW9uIGluIGhlYWRlcjogL6AyEAArAAAAyzIQAAEAAABNaXNzaW5nIHBhbGV0dGUgb2YgaW5kZXhlZCBpbWFnZS4AAADcMhAAIQAAAE5vdCBlbm91Z2ggcGFsZXR0ZSBlbnRyaWVzLCBleHBlY3QgIGdvdCAIMxAAIwAAACszEAAFAAAAgC8QAAEAAABTZXF1ZW5jZSBpcyBub3QgaW4gb3JkZXIsIGV4cGVjdGVkICMgZ290ICMAAEgzEAAkAAAAbDMQAAYAAACALxAAAQAAAENodW5rICBtdXN0IGFwcGVhciBhdCBtb3N0IG9uY2UujDMQAAYAAACSMxAAGgAAACBtdXN0IGFwcGVhciBiZXR3ZWVuIFBMVEUgYW5kIElEQVQgY2h1bmtzLgAAjDMQAAYAAAC8MxAAKgAAACBpcyBpbnZhbGlkIGFmdGVyIFBMVEUgY2h1bmsuAAAAjDMQAAYAAAD4MxAAHQAAACBpcyBpbnZhbGlkIGFmdGVyIElEQVQgY2h1bmsuAAAAjDMQAAYAAAAoNBAAHQAAACBjaHVuayBhcHBlYXJlZCBiZWZvcmUgSUhEUiBjaHVuawAAAHwtEAAAAAAAWDQQACEAAABJREFUIG9yIGZEQVQgY2h1bmsgaXMgbWlzc2luZy4AAIw0EAAeAAAAZmNUTCBjaHVuayBtaXNzaW5nIGJlZm9yZSBmZEFUIGNodW5rLgAAALQ0EAAlAAAASUhEUiBjaHVuayBtaXNzaW5nAADkNBAAEgAAAFVuZXhwZWN0ZWQgZW5kIG9mIGRhdGEgd2l0aGluIGEgY2h1bmsuAAAANRAAJgAAAFVuZXhwZWN0ZWQgZW5kIG9mIGRhdGEgYmVmb3JlIGltYWdlIGVuZC4wNRAAKAAAAEludmFsaWQgUE5HIHNpZ25hdHVyZS4AAGA1EAAWAAAAQ1JDIGVycm9yOiBleHBlY3RlZCAweCBoYXZlIDB4IHdoaWxlIGRlY29kaW5nICBjaHVuay4AAACANRAAFgAAAJY1EAAIAAAAnjUQABAAAACuNRAABwAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHBuZy0wLjE3Ljdcc3JjXGRlY29kZXJcc3RyZWFtLnJzANg1EABfAAAA5wEAABwAAADYNRAAXwAAAOUBAAA5AAAA2DUQAF8AAACpAgAAIwAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWUA2DUQAF8AAAAlAwAAHAAAANg1EABfAAAAJAMAABwAAADYNRAAXwAAADQDAAAgAAAA2DUQAF8AAAA6AwAAJwAAANg1EABfAAAARwMAACcAAADYNRAAXwAAAIQDAAAnAAAA2DUQAF8AAAChAwAAJwAAANg1EABfAAAA0wMAACcAAADYNRAAXwAAAOwDAAAnAAAA2DUQAF8AAAAsBAAAGAAAANg1EABfAAAABQQAACcAAADYNRAAXwAAAJkEAAAOAAAA2DUQAF8AAACrBAAAHAAAANg1EABfAAAAxgQAACMAAADYNRAAXwAAAMgEAAAlAAAA2DUQAF8AAADPBAAADgAAANg1EABfAAAA0QQAABsAAADYNRAAXwAAANMEAAAcAAAAwAAAAAQAAAAEAAAArAAAAMAAAAAEAAAABAAAAMEAAADAAAAABAAAAAQAAADCAAAAUGFydGlhbENodW5rwAAAAAQAAAAEAAAAwwAAAEltYWdlRW5kSW1hZ2VEYXRhRmx1c2hlZEltYWdlRGF0YUZyYW1lQ29udHJvbAAAAMAAAAAEAAAABAAAAMQAAABBbmltYXRpb25Db250cm9swAAAAAQAAAAEAAAAxQAAAFBpeGVsRGltZW5zaW9ucwDAAAAABAAAAAQAAADGAAAAQ2h1bmtDb21wbGV0ZUNodW5rQmVnaW5IZWFkZXIAAADAAAAABAAAAAQAAACwAAAAwAAAAAQAAAAEAAAAsQAAAMAAAAAEAAAABAAAAMcAAABOb3RoaW5nTGltaXRzRXhjZWVkZWRQYXJhbWV0ZXIAAMAAAAAEAAAABAAAAMgAAABGb3JtYXQAAMAAAAAEAAAABAAAAMkAAABJb0Vycm9yAMAAAAAEAAAABAAAAMoAAABGb3JtYXRFcnJvcmlubmVywAAAAAQAAAAEAAAAywAAAEJhZFRleHRFbmNvZGluZwDAAAAABAAAAAQAAADMAAAAQmFkRmlsdGVyAAAAwAAAAAQAAAAEAAAAzQAAAE5vTW9yZUltYWdlRGF0YUNvcnJ1cHRGbGF0ZVN0cmVhbWVycsAAAAAEAAAABAAAALQAAABCYWRTdWJGcmFtZUJvdW5kc1Vua25vd25JbnRlcmxhY2VNZXRob2RVbmtub3duRmlsdGVyTWV0aG9kVW5rbm93bkNvbXByZXNzaW9uTWV0aG9kSW52YWxpZFNyZ2JSZW5kZXJpbmdJbnRlbnRJbnZhbGlkVW5pdEludmFsaWRCbGVuZE9wSW52YWxpZERpc3Bvc2VPcEludmFsaWRDb2xvclR5cGVJbnZhbGlkQml0RGVwdGhDb2xvcldpdGhCYWRUcm5zSW52YWxpZENvbG9yQml0RGVwdGhjb2xvcl90eXBlYml0X2RlcHRoUGFsZXR0ZVJlcXVpcmVkU2hvcnRQYWxldHRlZXhwZWN0ZWRsZW5BcG5nT3JkZXJwcmVzZW50RHVwbGljYXRlQ2h1bmtraW5kT3V0c2lkZVBsdGVJZGF0QWZ0ZXJQbHRlQWZ0ZXJJZGF0Q2h1bmtCZWZvcmVJaGRyTWlzc2luZ0ltYWdlRGF0YU1pc3NpbmdGY3RsTWlzc2luZ0loZHJVbmV4cGVjdGVkRW5kT2ZDaHVua1VuZXhwZWN0ZWRFb2ZJbnZhbGlkU2lnbmF0dXJlQ3JjTWlzbWF0Y2hyZWNvdmVyY3JjX3ZhbGNyY19zdW1jaHVuawBpbnRlcm5hbCBlcnJvcjogZW50ZXJlZCB1bnJlYWNoYWJsZSBjb2RlOiAAAKA7EAAqAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNccG5nLTAuMTcuN1xzcmNcY29tbW9uLnJzAAAAAABhdHRlbXB0IHRvIGRpdmlk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YmxlANkAAAAIAAAABAAAANoAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xwbmctMC4xNy43XHNyY1x0ZXh0X21ldGFkYXRhLnJzAABcQxAAXgAAALkAAAAmAAAASW52YWxpZEtleXdvcmRTaXplVW5yZXByZXNlbnRhYmxlTWlzc2luZ0NvbXByZXNzaW9uRmxhZ0ludmFsaWRDb21wcmVzc2lvbkZsYWdJbnZhbGlkQ29tcHJlc3Npb25NZXRob2RPdXRPZkRlY29tcHJlc3Npb25TcGFjZUluZmxhdGlvbkVycm9yTWlzc2luZ051bGxTZXBhcmF0b3IAAA8AAAASAAAAFAAAAA4AAAAXAAAAGAAAABYAAAAWAAAA3kMQAMxDEABWRBAASEQQADFEEAAZRBAAA0QQAO1DEABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xwbmctMC4xNy43XHNyY1x1dGlscy5ycwBBkIrBAAuNB2F0dGVtcHQgdG8gZGl2aWRlIGJ5IHplcm8AAACsRBAAVgAAACQAAAAWAAAArEQQAFYAAAAlAAAAGgAAAP9DOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xwbmctMC4xNy43XHNyY1xkZWNvZGVyXG1vZC5ycwAAAE1FEABcAAAAmgMAAAkAAABNRRAAXAAAAKADAAAZAAAAAgAAAAEAAAAEAAAAAQAAAAEAAAABAAAAAwAAAAEAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2FsbG9jL3NyYy92ZWMvbW9kLnJz7EUQAEwAAADUBwAAJAAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHBuZy0wLjE3Ljdcc3JjXHV0aWxzLnJzAABIRhAAVgAAAC8AAAASAAAAYXR0ZW1wdCB0byBkaXZpZGUgYnkgemVybwAAAEhGEABW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Y29kZSBzaXplAAAAWI8QAF8AAAAxAQAAHwAAAFiPEABfAAAATAIAACMAAAB1bmtub3duIGV4dGVudGlvbiBibG9jayBlbmNvdW50ZXJlZGV4cGVjdGVkIGJsb2NrIHRlcm1pbmF0b3Igbm90IGZvdW5kdW5rbm93biBibG9jayB0eXBlIGVuY291bnRlcmVkWI8QAF8AAAD6AQAALwAAAGZyYW1lIGRlc2NyaXB0b3IgaXMgb3V0LW9mLWJvdW5kc3Vuc3VwcG9ydGVkIEdJRiB2ZXJzaW9ubWFsZm9ybWVkIEdJRiBoZWFkZXJjb250cm9sIGV4dGVuc2lvbiBoYXMgd3JvbmcgbGVuZ3RoRGVjb2RpbmdGb3JtYXRFcnJvcnVuZGVybHlpbmcA6wAAAAQAAAAEAAAA7AAAAElvAADrAAAABAAAAAQAAADtAAAARm9ybWF0AADrAAAABAAAAAQAAADuAAAAY2Fubm90IGFjY2VzcyBhIFRocmVhZCBMb2NhbCBTdG9yYWdlIHZhbHVlIGR1cmluZyBvciBhZnRlciBkZXN0cnVjdGlvbgAA7wAAAAAAAAABAAAA8AAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvc3RkL3NyYy90aHJlYWQvbG9jYWwucnMAaJIQAE8AAACmAQAAGgAAAPEAAAAIAAAABAAAAPIAAABhc3NlcnRpb24gZmFpbGVkOiBwaXhlbC5sZW4oKSA9PSA0QzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcY29sb3JfcXVhbnQtMS4xLjBcc3JjXGxpYi5ycwAAAPqSEABbAAAAugAAAAkAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xnaWYtMC4xMi4wXHNyY1xjb21tb24ucnMAaJMQAFcAAAD1AAAAIgAAAGiTEABXAAAA9QAAACwAAABokxAAVwAAAPUAAAA2AAAAaJMQAFcAAAD1AAAAQAAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWUAaJMQAFcAAAD1AAAASwAAAPMAAAAIAAAABAAAAPQAAAD1AAAA9gAAAAwAAAAEAAAAMwAAAPYAAAAMAAAABAAAADQAAAAzAAAAUJQQAPcAAAD4AAAANwAAAPkAAAD6AAAAY2FwYWNpdHkgb3ZlcmZsb3cAAACMlBAAEQAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvYWxsb2Mvc3JjL3ZlYy9zcGVjX2Zyb21faXRlcl9uZXN0ZWQucnMAAKiUEABeAAAAOwAAABIAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL2l0ZXIucnMAABiVEABOAAAAVQcAABEAQYCrwgAL8jJhdHRlbXB0IHRvIGRpdmlkZSBieSB6ZXJvSW5kZXggb3V0IG9mIGJvdW5kc5mVEAATAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9zb3J0LnJzAAC0lRAATgAAAMsEAAAVAAAAtJUQAE4AAADZBAAAHgAAALSVEABOAAAA4gQAABgAAAC0lRAATgAAAOcEAAAcAAAAVG9vIG11Y2ggb3IgdG9vIGxpdHRsZSBwaXhlbCBkYXRhIGZvciB0aGUgZ2l2ZW4gd2lkdGggYW5kIGhlaWdodCB0byBjcmVhdGUgYSBHSUYgRnJhbWUAAESWEABWAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcZ2lmLTAuMTIuMFxzcmNcY29tbW9uLnJzAKSWEABXAAAA0AAAAAkAAABzcGVlZCBuZWVkcyB0byBiZSBpbiB0aGUgcmFuZ2UgWzEsIDMwXQAApJYQAFcAAADRAAAACQAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWUApJYQAFcAAAD1AAAASwAAAGRlc2NyaXB0aW9uKCkgaXMgZGVwcmVjYXRlZDsgdXNlIERpc3BsYXl0aGUgR0lGIGZv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bGlzdCB0b28gbG9uZ2ludmFsaWQgZmlsZW5hbWV0b28gbWFueSBsaW5rc2Nyb3NzLWRldmljZSBsaW5rIG9yIHJlbmFtZWRlYWRsb2NrZXhlY3V0YWJsZSBmaWxlIGJ1c3lyZXNvdXJjZSBidXN5ZmlsZSB0b28gbGFyZ2VmaWxlc3lzdGVtIHF1b3RhIGV4Y2VlZGVkc2VlayBvbiB1bnNlZWthYmxlIGZpbGVubyBzdG9yYWdlIHNwYWNld3JpdGUgemVyb3RpbWVkIG91dGludmFsaWQgZGF0YWludmFsaWQgaW5wdXQgcGFyYW1ldGVyc3RhbGUgbmV0d29yayBmaWxlIGhhbmRsZWZpbGVzeXN0ZW0gbG9vcCBvciBpbmRpcmVjdGlvbiBsaW1pdCAoZS5nLiBzeW1saW5rIGxvb3ApcmVhZC1vbmx5IGZpbGVzeXN0ZW0gb3Igc3RvcmFnZSBtZWRpdW1kaXJlY3Rvcnkgbm90IGVtcHR5aXMgYSBkaXJlY3Rvcnlub3QgYSBkaXJlY3RvcnlvcGVyYXRpb24gd291bGQgYmxvY2tlbnRpdHkgYWxyZWFkeSBleGlzdHNicm9rZW4gcGlwZW5ldHdvcmsgZG93bmFkZHJlc3Mgbm90IGF2YWlsYWJsZWFkZHJlc3MgaW4gdXNlbm90IGNvbm5lY3RlZGNvbm5lY3Rpb24gYWJvcnRlZG5ldHdvcmsgdW5yZWFjaGFibGVob3N0IHVucmVhY2hhYmxlY29ubmVjdGlvbiByZXNldGNvbm5lY3Rpb24gcmVmdXNlZHBlcm1pc3Npb24gZGVuaWVkZW50aXR5IG5vdCBmb3VuZEVycm9ya2luZAAAIgEAAAEAAAABAAAAJgEAAG1lc3NhZ2UAIgEAAAgAAAAEAAAAJwEAAEtpbmRPc2NvZGUAACIBAAAEAAAABAAAACgBAAApAQAADAAAAAQAAAAqAQAAIChvcyBlcnJvciAplKEQAAAAAAAgpRAACwAAACulEAABAAAAbWVtb3J5IGFsbG9jYXRpb24gb2YgIGJ5dGVzIGZhaWxlZAAARKUQABUAAABZpRAADQAAAGxpYnJhcnkvc3RkL3NyYy9hbGxvYy5yc3ilEAAYAAAAVQEAAAkAAABjYW5ub3QgbW9kaWZ5IHRoZSBwYW5pYyBob29rIGZyb20gYSBwYW5pY2tpbmcgdGhyZWFkoKUQADQAAABsaWJyYXJ5L3N0ZC9zcmMvcGFuaWNraW5nLnJz3KUQABwAAACGAAAACQAAANylEAAcAAAAPgIAAB4AAADcpRAAHAAAAD0CAAAfAAAAKQEAAAwAAAAEAAAAKwEAACIBAAAIAAAABAAAACwBAAAtAQAAEAAAAAQAAAAuAQAALwEAACIBAAAIAAAABAAAADABAAAxAQAAIgEAAAAAAAABAAAAMgEAAFVuc3VwcG9ydGVkACIBAAAEAAAABAAAADMBAABDdXN0b21lcnJvcgAiAQAABAAAAAQAAAA0AQAAVW5jYXRlZ29yaXplZE90aGVyT3V0T2ZNZW1vcnlVbmV4cGVjdGVkRW9mSW50ZXJydXB0ZWRBcmd1bWVudExpc3RUb29Mb25nSW52YWxpZEZpbGVuYW1lVG9vTWFueUxpbmtzQ3Jvc3Nlc0RldmljZXNEZWFkbG9ja0V4ZWN1dGFibGVGaWxlQnVzeVJlc291cmNlQnVzeUZpbGVUb29MYXJnZUZpbGVzeXN0ZW1RdW90YUV4Y2VlZGVkTm90U2Vla2FibGVTdG9yYWdlRnVsbFdyaXRlWmVyb1RpbWVkT3V0SW52YWxpZERhdGFJbnZhbGlkSW5wdXRTdGFsZU5ldHdvcmtGaWxlSGFuZGxlRmlsZXN5c3RlbUxvb3BSZWFkT25seUZpbGVzeXN0ZW1EaXJlY3RvcnlOb3RFbXB0eUlzQURpcmVjdG9yeU5vdEFEaXJlY3RvcnlXb3VsZEJsb2NrQWxyZWFkeUV4aXN0c0Jyb2tlblBpcGVOZXR3b3JrRG93bkFkZHJOb3RBdmFpbGFibGVBZGRySW5Vc2VOb3RDb25uZWN0ZWRDb25uZWN0aW9uQWJvcnRlZE5ldHdvcmtVbnJlYWNoYWJsZUhvc3RVbnJlYWNoYWJsZUNvbm5lY3Rpb25SZXNldENvbm5lY3Rpb25SZWZ1c2VkUGVybWlzc2lvbkRlbmllZE5vdEZvdW5kb3BlcmF0aW9uIHN1Y2Nlc3NmdWwADgAAABAAAAAWAAAAFQAAAAsAAAAWAAAADQAAAAsAAAATAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAA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',
          imports
        );
      }

      onmessage = (message) => {
        const request = message.data;
        let response;
        let promise;

        switch (request.type) {
          case WorkerMessageType.INIT:
            promise = initWasm();
            break;
          case WorkerMessageType.APPLY_COMMANDS:
            promise = doApplyCommands(request);
            break;
          default:
            promise = Promise.reject(new Error('Unknown request type'));
            break;
        }

        promise
          .then((data) => {
            response = {
              type: request.type,
              data,
            };

            postMessage(response);
          })
          .catch((error) => {
            response = {
              type: request.type,
              data: error,
            };

            postMessage(response);
          });
      };

      async function initWasm() {
        const instance = await gifWasm();
        await init(instance);
        initPanicHook();
      }

      async function doApplyCommands(message) {
        const { data, formatType, commands } = message.data;

        const result = applyCommands(data, formatType, commands);
        return await Promise.resolve(result);
      }
    })();
  },
  null
);
/* eslint-enable */

var WorkerMessageType;
(function (WorkerMessageType) {
  const INIT = 0;
  WorkerMessageType[(WorkerMessageType['INIT'] = INIT)] = 'INIT';
  const APPLY_COMMANDS = INIT + 1;
  WorkerMessageType[(WorkerMessageType['APPLY_COMMANDS'] = APPLY_COMMANDS)] =
    'APPLY_COMMANDS';
})(WorkerMessageType || (WorkerMessageType = {}));

class GifWorker {
  worker;

  onterminate;
  onerror;
  onmessage;

  constructor(worker) {
    this.worker = worker;
    worker.onerror = (error) => {
      this.onerror?.(error);
    };
    worker.onmessage = (message) => {
      this.onmessage?.(message);
    };
  }

  postMessage(message) {
    this.worker.postMessage(message);
  }

  terminate() {
    this.onterminate?.();
    this.worker.terminate();
  }
}

class GifProcessingService extends BaseService {
  isProcessing = false;
  worker;

  async start() {
    await this.getWorker();
  }

  async getWorker() {
    if (this.worker) return this.worker;

    const worker = new GifWorker(new WorkerFactory());
    const request = {
      type: WorkerMessageType.INIT,
    };

    await PromiseUtils.workerMessagePromise(worker, request);

    this.worker = worker;
    return worker;
  }

  stopWorker() {
    this.isProcessing = false;
    if (!this.worker) return;

    this.worker.terminate();
    this.worker = undefined;
  }

  modifyGif(url, formatType, options) {
    if (this.isProcessing) {
      return {
        result: Promise.reject(new Error('Already processing, please wait.')),
      };
    }
    this.isProcessing = true;

    return {
      cancel: () => {
        this.stopWorker();
      },
      result: this.modifyGifImpl(url, formatType, options).finally(() => {
        this.isProcessing = false;
      }),
    };
  }

  async modifyGifImpl(url, formatType, options) {
    Logger.info('Got GIF request', url, options);
    const commands = this.getCommands(options);
    Logger.info('Processed request commands', commands);

    const result = await this.processCommands(url, formatType, commands);
    Logger.info('Processed modified emote', { length: result.length });

    return result;
  }

  getCommands(options) {
    const commands = [];

    options.forEach((option) => {
      switch (option[0]) {
        case 'resize': {
          const command = {
            name: option[0],
            param: option[1],
          };

          commands.push(command);
          break;
        }
        case 'reverse': {
          commands.push({ name: option[0] });
          break;
        }
        case 'flip':
          commands.push({ name: option[0], param: '0' });
          break;
        case 'flap':
          commands.push({ name: 'flip', param: '1' });
          break;
        case 'speed': {
          const param = option[1]?.toString() ?? '';

          commands.push({
            name: option[0],
            param: Math.max(2, parseFloat(param)).toString(),
          });
          break;
        }
        case 'hyperspeed':
          commands.push({ name: 'hyperspeed' });
          break;
        case 'rotate':
          commands.push({ name: option[0], param: option[1] });
          break;
        case 'rain':
          commands.push({
            name: option[0],
            param: option[1] === 'glitter' ? '1' : '0',
          });
          break;
        case 'spin':
        case 'spinrev':
        case 'shake':
        case 'rainbow':
        case 'infinite':
        case 'slide':
        case 'sliderev':
        case 'wiggle': {
          let speed = '8';
          const param = option[1];

          if (param === 'fast') speed = '6';
          else if (param === 'faster') speed = '4';
          else if (param === 'hyper') speed = '2';

          commands.push({ name: option[0], param: speed });
          break;
        }
      }
    });

    return commands;
  }

  async processCommands(url, formatType, commands) {
    let data = await PromiseUtils.urlGetBuffer(url);
    const worker = await this.getWorker();

    const request = {
      type: WorkerMessageType.APPLY_COMMANDS,
      data: { data, formatType, commands },
    };

    const response = await PromiseUtils.workerMessagePromise(worker, request);
    data = buffer.Buffer.from(response);

    if (!(data instanceof buffer.Buffer)) throw Error('Did not process gif!');
    return data;
  }

  stop() {
    this.stopWorker();
  }
}

class ModulesService extends BaseService {
  channelStore;
  uploader;
  draft;
  draftStore;
  permissions;
  discordPermissions;
  dispatcher;
  componentDispatcher;
  pendingReplyDispatcher = {};
  emojiStore;
  emojiSearch;
  emojiDisabledReasons;
  stickerSendable = {};
  stickerType;
  stickerSendableType;
  stickerFormatType;
  stickerStore;
  userStore;
  messageStore;
  classes;
  cloudUploader;

  start() {
    this.channelStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('getChannel', 'hasChannel')
    );

    this.uploader = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('instantBatchUpload')
    );

    this.draft = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('changeDraft')
    );

    this.draftStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('getDraft', 'getRecentlyEditedDrafts')
    );

    this.permissions = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('getChannelPermissions')
    );

    this.discordPermissions = this.getModule(
      (module) => {
        return typeof module.CREATE_INSTANT_INVITE === 'bigint';
      },
      { searchExports: true }
    );

    this.dispatcher = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('dispatch', 'subscribe')
    );

    this.componentDispatcher = this.getModule(
      (module) => {
        if (module.dispatchToLastSubscribed !== undefined) {
          const componentDispatcher = module;
          return componentDispatcher.emitter.listeners('SHAKE_APP').length > 0;
        }

        return false;
      },
      { searchExports: true }
    );

    this.pendingReplyDispatcher.module = this.getModule((module) => {
      Object.entries(module).forEach(([key, value]) => {
        if (!(typeof value === 'function')) return;
        const valueString = value.toString();

        if (valueString.includes('DELETE_PENDING_REPLY')) {
          this.pendingReplyDispatcher.deletePendingReplyKey = key;
        } else if (valueString.includes('CREATE_PENDING_REPLY')) {
          this.pendingReplyDispatcher.createPendingReplyKey = key;
        } else if (valueString.includes('SET_PENDING_REPLY_SHOULD_MENTION')) {
          this.pendingReplyDispatcher.setPendingReplyShouldMentionKey = key;
        }
      });

      return this.pendingReplyDispatcher.deletePendingReplyKey !== undefined;
    });

    this.emojiStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('getEmojiUnavailableReason')
    );

    this.emojiSearch = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('getDisambiguatedEmojiContext')
    );

    this.emojiDisabledReasons = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('PREMIUM_LOCKED'),
      { searchExports: true }
    );

    this.stickerSendable.module = this.getModule((module) => {
      Object.entries(module).forEach(([key, value]) => {
        if (typeof value === 'object') {
          if (value.SENDABLE_WITH_PREMIUM === undefined) return;
          this.stickerSendable.stickerSendableType = value;
        }

        if (typeof value !== 'function') return;
        const valueString = value.toString();

        if (valueString.includes('canUseStickersEverywhere')) {
          this.stickerSendable.stickerSuggestionKey = key;
        } else if (valueString.includes('SENDABLE')) {
          this.stickerSendable.stickerSendableKey = key;
          this.stickerSendable.stickerSendable = module[key];
        }
      });

      return this.stickerSendable.stickerSendableKey !== undefined;
    });

    this.stickerType = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('STANDARD', 'GUILD'),
      { searchExports: true }
    );

    this.stickerFormatType = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('LOTTIE', 'GIF', 'APNG'),
      { searchExports: true }
    );

    this.stickerStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('getStickerById', 'getStickersByGuildId')
    );

    this.userStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('getCurrentUser')
    );

    this.messageStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('sendMessage')
    );

    this.cloudUploader = this.getModule((module) => {
      return Object.values(module).some((value) => {
        if (typeof value !== 'object' || value === null) return false;
        const curValue = value;

        return (
          curValue.NOT_STARTED !== undefined &&
          curValue.UPLOADING !== undefined &&
          module.n !== undefined
        );
      });
    });

    const TextArea = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('channelTextArea', 'textAreaHeight')
    );

    const Editor = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('editor', 'placeholder')
    );

    const Autocomplete = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps(
        'autocomplete',
        'autocompleteInner',
        'autocompleteRowVertical'
      )
    );

    const autocompleteAttached = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('autocomplete', 'autocompleteAttached')
    );

    const Wrapper = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('wrapper', 'base')
    );

    const Size = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('size12')
    );

    this.classes = {
      TextArea,
      Editor,

      Autocomplete: {
        ...Autocomplete,
        autocomplete: [
          autocompleteAttached?.autocomplete,
          autocompleteAttached?.autocompleteAttached,
          Autocomplete?.autocomplete,
        ].join(' '),
      },

      Wrapper,
      Size,
    };

    return Promise.resolve();
  }

  getModule(filter, searchOptions) {
    return BdApi.Webpack.getModule((...args) => {
      try {
        return filter(...args);
      } catch (ignored) {
        return false;
      }
    }, searchOptions);
  }

  stop() {
    // Do nothing
  }
}

class SendMessageService extends BaseService {
  emoteService;
  attachService;
  modulesService;
  settingsService;
  gifProcessingService;

  start(
    emoteService,
    attachService,
    modulesService,
    settingsService,
    gifProcessingService
  ) {
    this.emoteService = emoteService;
    this.attachService = attachService;
    this.modulesService = modulesService;
    this.settingsService = settingsService;
    this.gifProcessingService = gifProcessingService;

    return Promise.resolve();
  }

  async onSendMessage(args, original) {
    const callDefault = original;

    const channelId = args[0];
    const message = args[1];
    const attachments = args[3];

    if (channelId === undefined || !message) {
      callDefault(...args);
      return;
    }

    const stickerId = attachments?.stickerIds?.[0];
    if (stickerId !== undefined) {
      const sentSticker = await this.sendSticker(
        stickerId,
        channelId,
        message.content
      );
      if (sentSticker) return;
    }

    try {
      const discordEmotes = this.getTargetEmoteFromMessage(message);
      let content = message.content;

      const foundEmote = this.getTextPos(content, {
        ...this.emoteService.emoteNames,
        ...discordEmotes,
      });

      if (!foundEmote) {
        callDefault(...args);
        return;
      }

      if (!this.attachService.canAttach) {
        BdApi.UI.showToast('This channel does not allow sending images!', {
          type: 'error',
        });
        callDefault(...args);
        return;
      }

      content = (
        content.substring(0, foundEmote.pos) +
        content.substring(foundEmote.pos + foundEmote.nameAndCommand.length)
      ).trim();

      foundEmote.content = content;
      foundEmote.channel = channelId;

      try {
        this.attachService.pendingUpload = this.fetchBlobAndUpload(foundEmote);
        await this.attachService.pendingUpload;
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : error;

        BdApi.UI.showToast(errorMessage, { type: 'error' });
        if (content === '') return;

        message.content = content;
      } finally {
        this.attachService.pendingUpload = undefined;
      }

      callDefault(...args);
      return;
    } catch (error) {
      Logger.warn('Error in onSendMessage', error);
    }
  }

  async onSendSticker(args, original) {
    const callDefault = original;

    const channelId = args[0];
    const stickerIdList = args[1];
    const stickerId = stickerIdList?.[0];

    if (channelId === undefined || stickerId === undefined) {
      callDefault(...args);
      return;
    }

    const sentSticker = await this.sendSticker(stickerId, channelId);
    if (!sentSticker) callDefault(...args);
  }

  async sendSticker(stickerId, channelId, content) {
    const userId = this.attachService.userId;
    if (userId === undefined) return false;

    const sticker = this.modulesService.stickerStore.getStickerById(stickerId);
    const channel = this.modulesService.channelStore.getChannel(channelId);
    if (!channel) return false;

    const stickerSendable = this.modulesService.stickerSendable.stickerSendable;
    if (stickerSendable?.(sticker, userId, channel) === true) return false;

    const url = `https://media.discordapp.net/stickers/${stickerId}`;
    const formatType = this.modulesService.stickerFormatType;
    let format;

    switch (sticker.format_type) {
      case formatType.APNG:
        format = 'apng';
        break;
      case formatType.GIF:
        format = 'gif';
        break;
      default:
        format = 'png';
        break;
    }

    const emote = {
      url,
      name: sticker.name,
      nameAndCommand: sticker.name,
      emoteLength: sticker.name.length,
      pos: 0,
      spoiler: false,
      commands: [['resize', '160']],
      channel: channelId,
      formatType: format,
      content,
    };

    try {
      this.attachService.pendingUpload = this.fetchBlobAndUpload(emote);
      await this.attachService.pendingUpload;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : error;

      BdApi.UI.showToast(errorMessage, { type: 'error' });
    } finally {
      this.attachService.pendingUpload = undefined;
    }

    return true;
  }

  getTargetEmoteFromMessage(message) {
    const invalidEmojis = message.invalidEmojis ?? [];
    const validNonShortcutEmojis = message.validNonShortcutEmojis ?? [];

    let emoji;
    let validEmoji = false;

    if (invalidEmojis.length > 0) {
      const count = invalidEmojis.length;
      emoji = invalidEmojis[count - 1];
    } else if (validNonShortcutEmojis?.length > 0) {
      const count = validNonShortcutEmojis.length;
      emoji = validNonShortcutEmojis[count - 1];

      // Ignore built-in emotes
      if (emoji?.managed === true) return {};
      validEmoji =
        emoji?.available === true &&
        !this.attachService.externalEmotes.has(emoji.id);
    } else return {};

    if (!emoji) return {};

    const emojiName = emoji.originalName ?? emoji.name;
    const allNamesString = emoji.allNamesString.replace(emoji.name, emojiName);
    const emojiText = `<${emoji.animated ? 'a' : ''}${allNamesString}${
      emoji.id
    }>`;

    const result = {};
    const url = emoji.url.split('?')[0] ?? '';
    if (!url) return {};
    const extensionIndex = url.lastIndexOf('.');

    result[emojiText] = {
      name: emojiName,
      url:
        url.substring(extensionIndex) === '.webp'
          ? `${url.substring(0, extensionIndex)}.png`
          : url,
    };

    const foundEmote = this.getTextPos(message.content, result);
    if (!foundEmote) return {};
    // Only parse valid emojis if they contain commands
    if (validEmoji && foundEmote.commands.length === 0) return {};

    return result;
  }

  getTextPos(content, emoteCandidates) {
    const foundEmotes = [];

    Object.entries(emoteCandidates).forEach(([key, value]) => {
      const regex = new RegExp('(?<!\\/)' + key + '(?<=\\b|>)', 'g');
      const regexCommand = new RegExp(key + '(\\.\\S{4,}\\b)+');
      const matches = content.match(regex);
      const command = content.match(regexCommand);

      if (!matches || matches.length === 0) return;
      for (let i = 0; i < matches.length; i++) {
        const pos = this.getNthIndexOf(content, key, i);
        const url = typeof value === 'string' ? value : value.url;

        const emote = {
          name: typeof value === 'string' ? key : value.name,
          nameAndCommand: key,
          url,
          emoteLength: key.length,
          pos,
          spoiler: false,
          commands: [],
          formatType: url.endsWith('.gif') ? 'gif' : 'png',
        };

        if (command) {
          const commands = command[0]?.split('.') ?? [];
          emote.commands = commands
            .filter((command) => command !== key)
            .map((command) => {
              const split = command.split('-');

              return [split[0] ?? '', split[1] ?? ''];
            });

          emote.nameAndCommand = command[0] ?? '';
        }

        const beforeEmote = content.substring(0, pos);
        const afterEmote = content.substring(pos + emote.nameAndCommand.length);

        if (beforeEmote.includes('||') && afterEmote.includes('||')) {
          const spoilerStart = beforeEmote.substring(beforeEmote.indexOf('||'));
          emote.nameAndCommand = spoilerStart + emote.nameAndCommand;
          emote.pos -= spoilerStart.length;

          const spoilerEnd = afterEmote.substring(
            0,
            afterEmote.indexOf('||') + 2
          );
          emote.nameAndCommand = emote.nameAndCommand + spoilerEnd;
          emote.spoiler = true;
        }

        if (!beforeEmote.includes('`') || !afterEmote.includes('`')) {
          foundEmotes.push(emote);
        }
      }
    });

    return foundEmotes.pop();
  }

  getNthIndexOf(input, search, nth) {
    const firstIndex = input.indexOf(search);
    const startPos = firstIndex + search.length;

    if (nth === 0) {
      return firstIndex;
    } else {
      const inputAfterFirstOccurrence = input.substring(startPos);
      const nextOccurrence = this.getNthIndexOf(
        inputAfterFirstOccurrence,
        search,
        nth - 1
      );

      if (nextOccurrence === -1) {
        return -1;
      } else {
        return startPos + nextOccurrence;
      }
    }
  }

  async fetchBlobAndUpload(emote) {
    const { url, name, commands, formatType } = emote;

    if (
      formatType === 'apng' ||
      formatType === 'gif' ||
      this.findCommand(commands, this.getGifModifiers())
    ) {
      return this.getMetaAndModifyGif(emote);
    }

    const resultBlob = (await this.compress(url, commands)) ?? new Blob([]);
    if (resultBlob.size === 0)
      throw new Error('Emote URL did not contain data');

    this.uploadFile({
      fileData: resultBlob,
      fullName: name + '.png',
      emote,
    });
  }

  findCommand(commands, names) {
    let foundCommand;

    commands.forEach((command) => {
      names.forEach((name) => {
        if (command[0] === name) foundCommand = command;
      });
    });

    return foundCommand;
  }

  getGifModifiers() {
    const gifModifiers = [];

    this.emoteService.modifiers.forEach((modifier) => {
      if (modifier.type === 'gif') {
        gifModifiers.push(modifier.name);
      }
    });

    return gifModifiers;
  }

  async getMetaAndModifyGif(emote) {
    const image = await PromiseUtils.loadImagePromise(emote.url);

    const commands = emote.commands;
    this.addResizeCommand(commands, image);
    let closeNotice;

    // Wait a bit before showing to prevent flickering
    const timeout = setTimeout(() => {
      closeNotice = BdApi.UI.showNotice(`Processing gif ${emote.name}...`, {
        type: 'info',
        buttons: [
          {
            label: 'Cancel',
            onClick: () => {
              cancel?.();
              cancel = undefined;

              closeNotice?.();
              closeNotice = undefined;
            },
          },
        ],
      });
    }, 250);

    let { cancel, result } = this.gifProcessingService.modifyGif(
      emote.url,
      emote.formatType,
      commands
    );

    const buffer = await result.finally(() => {
      cancel = undefined;
      clearTimeout(timeout);

      closeNotice?.();
      closeNotice = undefined;
    });

    if (buffer.length === 0) {
      throw Error('Failed to process gif');
    }

    this.uploadFile({
      fileData: buffer,
      fullName: emote.name + '.gif',
      emote,
    });
  }

  addResizeCommand(commands, image) {
    const scaleFactorNum = this.getScaleFactor(commands, image);
    let scaleFactor = scaleFactorNum.toString();

    const wideCommand = this.findCommand(commands, ['wide']);
    if (wideCommand) {
      const wideness = this.getEmoteWideness(wideCommand);
      scaleFactor = `${scaleFactorNum * wideness}x${scaleFactorNum}}`;
    }

    commands.push(['resize', scaleFactor]);
  }

  getScaleFactor(commands, image) {
    const size = this.getEmoteSize(commands);
    let scaleFactor;

    if (this.settingsService.settings.resizeMethod === 'largest') {
      if (image.width > image.height) {
        scaleFactor = size / image.width;
      } else scaleFactor = size / image.height;
    } else {
      if (image.width < image.height) {
        scaleFactor = size / image.width;
      } else scaleFactor = size / image.height;
    }

    return scaleFactor;
  }

  getEmoteSize(commands) {
    let resizeCommand = [];
    let size;

    commands.forEach((command, index, object) => {
      if (command[0] === 'resize') {
        resizeCommand = command;
        object.splice(index, 1);
      }
    });

    const resizeCommandSize = resizeCommand[1] ?? '';
    if (resizeCommandSize !== '') {
      size = resizeCommandSize;
    } else {
      size = Math.round(this.settingsService.settings.emoteSize);
    }

    if (size === 'large' || size === 'big') {
      return 128;
    } else if (size === 'medium' || size === 'normal') {
      return 64;
    } else {
      const sizeNumber = typeof size === 'string' ? parseInt(size) : size;
      if (!isNaN(sizeNumber)) {
        return Math.min(Math.max(sizeNumber, 32), 160);
      }

      return 48;
    }
  }

  getEmoteWideness(wideCommand) {
    const param = wideCommand[1];
    const paramNum = parseInt(param ?? '');

    if (!isNaN(paramNum)) {
      return Math.max(Math.min(paramNum, 8), 2);
    } else if (param === 'extreme') {
      return 8;
    } else if (param === 'huge') {
      return 6;
    } else if (param === 'big') {
      return 4;
    } else {
      return 2;
    }
  }

  uploadFile(params) {
    const { fileData, fullName, emote } = params;
    const content = emote.content ?? '';
    const channelId = emote.channel ?? '';
    if (!channelId) {
      Logger.error('Channel ID not found for emote:', emote);
      return;
    }

    // eslint-disable-next-line new-cap
    const upload = new this.modulesService.cloudUploader.n(
      { file: new File([fileData], fullName), platform: 1 },
      channelId
    );
    upload.spoiler = emote.spoiler;

    const uploadOptions = {
      channelId,
      uploads: [upload],
      draftType: 0,
      parsedMessage: {
        content,
        invalidEmojis: [],
        tts: false,
        channel_id: channelId,
      },
    };

    const pendingReply = this.attachService.pendingReply;
    if (pendingReply) {
      uploadOptions.options = {
        allowedMentions: {
          replied_user: pendingReply.shouldMention,
        },
        messageReference: {
          channel_id: pendingReply.message.channel_id,
          guild_id: pendingReply.channel.guild_id,
          message_id: pendingReply.message.id,
        },
      };
    }

    this.modulesService.uploader.uploadFiles(uploadOptions);
  }

  async compress(url, commands) {
    const image = await PromiseUtils.loadImagePromise(url);
    const canvas = await this.applyScaling(image, commands);

    return await new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob ?? undefined);
        },
        'image/png',
        1
      );
    });
  }

  async applyScaling(image, commands) {
    const scaleFactor = this.getScaleFactor(commands, image);

    let canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;

    if (commands.length > 0) {
      canvas = this.applyCommands(image, canvas, commands);
    } else {
      canvas.getContext('2d')?.drawImage(image, 0, 0);
    }

    const scaledBitmap = await createImageBitmap(canvas, {
      resizeWidth: Math.ceil(canvas.width * scaleFactor),
      resizeHeight: Math.ceil(canvas.height * scaleFactor),
      resizeQuality: 'high',
    });

    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = scaledBitmap.width;
    resizedCanvas.height = scaledBitmap.height;

    const resizedContext = resizedCanvas.getContext('bitmaprenderer');
    if (!resizedContext) throw new Error('Bitmap context not found');
    resizedContext.transferFromImageBitmap(scaledBitmap);

    return resizedCanvas;
  }

  applyCommands(image, canvas, commands) {
    let scaleH = 1,
      scaleV = 1,
      posX = 0,
      posY = 0;

    if (this.findCommand(commands, ['flip'])) {
      scaleH = -1; // Set horizontal scale to -1 if flip horizontal
      posX = canvas.width * -1; // Set x position to -100% if flip horizontal
    }

    if (this.findCommand(commands, ['flap'])) {
      scaleV = -1; // Set vertical scale to -1 if flip vertical
      posY = canvas.height * -1; // Set y position to -100% if flip vertical
    }

    const ctx = canvas.getContext('2d');

    const wideCommand = this.findCommand(commands, ['wide']);
    if (wideCommand) {
      const wideness = this.getEmoteWideness(wideCommand);
      image.width = image.width * wideness;
      canvas.width = canvas.width * wideness;
    }

    const rotateCommand = this.findCommand(commands, ['rotate']);
    if (rotateCommand) {
      const angle = (parseInt(rotateCommand[1] ?? '0') * Math.PI) / 180,
        sin = Math.sin(angle),
        cos = Math.cos(angle);

      const newWidth =
        Math.abs(canvas.width * cos) + Math.abs(canvas.height * sin);
      const newHeight =
        Math.abs(canvas.width * sin) + Math.abs(canvas.height * cos);

      canvas.width = newWidth;
      canvas.height = newHeight;

      ctx?.translate(canvas.width / 2, canvas.height / 2);
      ctx?.rotate(angle);

      posX = -image.width / 2;
      posY = -image.height / 2;
    }

    ctx?.scale(scaleH, scaleV); // Set scale to flip the image
    ctx?.drawImage(image, posX, posY, image.width, image.height);

    return canvas;
  }

  stop() {
    // Do nothing
  }
}

class HtmlService extends BaseService {
  modulesService;

  start(modulesService) {
    this.modulesService = modulesService;
    return Promise.resolve();
  }

  addClasses(element, ...classes) {
    for (const curClass of classes) {
      if (!curClass) continue;
      const split = curClass.split(' ');

      for (const curClassItem of split) {
        element.classList.add(curClassItem);
      }
    }
  }

  getClassSelector(classes) {
    return classes
      .split(' ')
      .map((curClass) =>
        !curClass.startsWith('.') ? `.${curClass}` : curClass
      )
      .join(' ');
  }

  getTextAreaField(editor) {
    const textArea = this.modulesService.classes.TextArea.textArea;
    return editor?.closest(this.getClassSelector(textArea)) ?? undefined;
  }

  getTextAreaContainer(editor) {
    const channelTextArea =
      this.modulesService.classes.TextArea.channelTextArea;
    return editor?.closest(this.getClassSelector(channelTextArea)) ?? undefined;
  }

  getEditors() {
    const editor = this.modulesService.classes.Editor.editor;
    return document.querySelectorAll(this.getClassSelector(editor)) ?? [];
  }

  stop() {
    // Do nothing
  }
}

class PatchesService extends BaseService {
  sendMessageService;
  attachService;
  completionsService;
  emoteService;
  modulesService;

  start(
    sendMessageService,
    attachService,
    completionsService,
    emoteService,
    modulesService
  ) {
    this.sendMessageService = sendMessageService;
    this.attachService = attachService;
    this.completionsService = completionsService;
    this.emoteService = emoteService;
    this.modulesService = modulesService;

    this.messageStorePatch();
    this.changeDraftPatch();
    this.pendingReplyPatch();
    this.emojiSearchPatch();
    this.lockedEmojisPatch();
    this.stickerSendablePatch();

    return Promise.resolve();
  }

  messageStorePatch() {
    BdApi.Patcher.instead(
      this.plugin.meta.name,
      this.modulesService.messageStore,
      'sendMessage',
      (_, args, original) =>
        this.sendMessageService.onSendMessage(args, original)
    );

    BdApi.Patcher.instead(
      this.plugin.meta.name,
      this.modulesService.messageStore,
      'sendStickers',
      (_, args, original) =>
        this.sendMessageService.onSendSticker(args, original)
    );
  }

  changeDraftPatch() {
    BdApi.Patcher.before(
      this.plugin.meta.name,
      this.modulesService.draft,
      'changeDraft',
      (_, args) => this.onChangeDraft(args)
    );
  }

  onChangeDraft(args) {
    const channelId = args[0];
    if (channelId !== undefined) this.attachService.setCanAttach(channelId);
    if (!this.attachService.canAttach) return;

    const draft = args[1];
    if (draft === undefined) return;
    this.completionsService.draft = draft;

    try {
      const lastText = this.completionsService.cached?.draft;

      if (
        !this.emoteService.shouldCompleteEmote(draft) &&
        !this.emoteService.shouldCompleteCommand(draft)
      ) {
        this.completionsService.destroyCompletions();
        return;
      }

      if (lastText !== draft) {
        this.completionsService.renderCompletions();
      }
    } catch (err) {
      Logger.warn('Error in onChangeDraft', err);
    }
  }

  pendingReplyPatch() {
    const pendingReplyDispatcher = this.modulesService.pendingReplyDispatcher;

    const createPendingReply = pendingReplyDispatcher.createPendingReplyKey;
    if (createPendingReply === undefined) {
      Logger.warn('Create pending reply function name not found');
      return;
    }

    const deletePendingReply = pendingReplyDispatcher.deletePendingReplyKey;
    if (deletePendingReply === undefined) {
      Logger.warn('Delete pending reply function name not found');
      return;
    }

    const setPendingReplyShouldMention =
      pendingReplyDispatcher.setPendingReplyShouldMentionKey;
    if (setPendingReplyShouldMention === undefined) {
      Logger.warn('Set pending reply should mention function name not found');
      return;
    }

    BdApi.Patcher.before(
      this.plugin.meta.name,
      pendingReplyDispatcher.module,
      createPendingReply,
      (_, args) => {
        if (!args[0]) return;
        const reply = args[0];

        this.attachService.pendingReply = reply;
      }
    );

    BdApi.Patcher.instead(
      this.plugin.meta.name,
      pendingReplyDispatcher.module,
      deletePendingReply,
      (_, args, original) => this.onDeletePendingReply(args, original)
    );

    BdApi.Patcher.before(
      this.plugin.meta.name,
      pendingReplyDispatcher.module,
      setPendingReplyShouldMention,
      (_, args) => {
        if (typeof args[0] !== 'string' || typeof args[1] !== 'boolean') return;
        const channelId = args[0];
        const shouldMention = args[1];

        if (this.attachService.pendingReply?.channel.id !== channelId) return;
        this.attachService.pendingReply.shouldMention = shouldMention;
      }
    );
  }

  async onDeletePendingReply(args, original) {
    const callDefault = original;

    try {
      // Prevent Discord from deleting the pending reply until our emote has been uploaded
      if (this.attachService.pendingUpload)
        await this.attachService.pendingUpload;
      callDefault(...args);
    } catch (err) {
      Logger.warn('Error in onDeletePendingReply', err);
    } finally {
      this.attachService.pendingReply = undefined;
    }
  }

  emojiSearchPatch() {
    BdApi.Patcher.after(
      this.plugin.meta.name,
      this.modulesService.emojiSearch,
      'search',
      (_, _2, result) => this.onEmojiSearch(result)
    );
  }

  onEmojiSearch(result) {
    if (!this.attachService.canAttach) return;

    const searchResult = result;

    searchResult.unlocked.push(...searchResult.locked);
    searchResult.locked = [];
  }

  lockedEmojisPatch() {
    const emojiStore = this.modulesService.emojiStore;

    BdApi.Patcher.after(
      this.plugin.meta.name,
      emojiStore,
      'getEmojiUnavailableReason',
      (_, args, result) => this.onGetEmojiUnavailableReason(args, result)
    );

    BdApi.Patcher.after(
      this.plugin.meta.name,
      emojiStore,
      'isEmojiDisabled',
      (_, args) => this.onIsEmojiDisabled(args, emojiStore)
    );
  }

  onGetEmojiUnavailableReason(args, result) {
    if (!this.attachService.canAttach) return result;
    const EmojiDisabledReasons = this.modulesService.emojiDisabledReasons;
    const options = args[0];

    const isReactIntention = options?.intention === 0;
    if (isReactIntention) return result;

    if (result === EmojiDisabledReasons.DISALLOW_EXTERNAL) {
      const emojiId = options?.emoji?.id;
      if (emojiId === undefined) return result;

      this.attachService.externalEmotes.add(emojiId);
      result = null;
    } else if (
      result === EmojiDisabledReasons.PREMIUM_LOCKED ||
      result === EmojiDisabledReasons.GUILD_SUBSCRIPTION_UNAVAILABLE
    ) {
      result = null;
    }

    return result;
  }

  onIsEmojiDisabled(args, emojiStore) {
    const [emoji, channel, intention] = args;

    const reason = emojiStore.getEmojiUnavailableReason({
      emoji,
      channel,
      intention,
    });

    return reason !== null;
  }

  stickerSendablePatch() {
    const stickerSendable = this.modulesService.stickerSendable;
    const stickerType = this.modulesService.stickerType;

    const sendableKey = stickerSendable.stickerSendableKey;
    if (sendableKey === undefined) {
      Logger.warn('Sticker sendable function name not found');
      return;
    }

    BdApi.Patcher.after(
      this.plugin.meta.name,
      stickerSendable.module,
      sendableKey,
      (_, args) => {
        const sticker = args[0];
        if (!sticker) return;

        return sticker.type === stickerType.GUILD;
      }
    );

    const suggestionKey = stickerSendable.stickerSuggestionKey;
    if (suggestionKey === undefined) {
      Logger.warn('Sticker suggestion function name not found');
      return;
    }

    const sendableType = stickerSendable.stickerSendableType;
    if (!sendableType) {
      Logger.warn('Sticker sendable type not found');
      return;
    }

    BdApi.Patcher.after(
      this.plugin.meta.name,
      stickerSendable.module,
      suggestionKey,
      (_, args) => {
        const sticker = args[0];
        if (sticker?.type !== stickerType.GUILD) return;

        return sendableType.SENDABLE;
      }
    );
  }

  stop() {
    BdApi.Patcher.unpatchAll(this.plugin.meta.name);
  }
}

class EmoteReplacerPlugin {
  settingsService;
  emoteService;
  completionsService;
  attachService;
  listenersService;
  gifProcessingService;
  modulesService;
  sendMessageService;
  htmlService;
  patchesService;

  meta;

  constructor(meta) {
    this.meta = meta;
    Logger.setLogger(meta.name);
  }

  start() {
    this.doStart().catch((error) => {
      Logger.error(error);
    });
  }

  async doStart() {
    const zeresPluginLibrary = window.ZeresPluginLibrary;

    this.showChangelogIfNeeded(zeresPluginLibrary);
    await this.startServicesAndPatches();
  }

  showChangelogIfNeeded(zeresPluginLibrary) {
    const currentVersionInfo =
      BdApi.Data.load(this.meta.name, CURRENT_VERSION_INFO_KEY) ?? {};

    if (
      currentVersionInfo.hasShownChangelog !== true ||
      currentVersionInfo.version !== this.meta.version
    ) {
      zeresPluginLibrary.Modals.showChangelogModal(
        `${this.meta.name} Changelog`,
        this.meta.version,
        PLUGIN_CHANGELOG
      );

      const newVersionInfo = {
        version: this.meta.version,
        hasShownChangelog: true,
      };

      BdApi.Data.save(this.meta.name, CURRENT_VERSION_INFO_KEY, newVersionInfo);
    }
  }

  async startServicesAndPatches() {
    const zeresPluginLibrary = window.ZeresPluginLibrary;

    this.listenersService = new ListenersService(this, zeresPluginLibrary);
    await this.listenersService.start();

    this.settingsService = new SettingsService(this, zeresPluginLibrary);
    await this.settingsService.start(this.listenersService);

    this.modulesService = new ModulesService(this, zeresPluginLibrary);
    await this.modulesService.start();

    this.htmlService = new HtmlService(this, zeresPluginLibrary);
    await this.htmlService.start(this.modulesService);

    this.emoteService = new EmoteService(this, zeresPluginLibrary);
    await this.emoteService.start(
      this.listenersService,
      this.settingsService,
      this.htmlService
    );

    this.attachService = new AttachService(this, zeresPluginLibrary);
    await this.attachService.start(this.modulesService);

    this.completionsService = new CompletionsService(this, zeresPluginLibrary);
    await this.completionsService.start(
      this.emoteService,
      this.settingsService,
      this.modulesService,
      this.listenersService,
      this.htmlService,
      this.attachService
    );

    this.gifProcessingService = new GifProcessingService(
      this,
      zeresPluginLibrary
    );
    await this.gifProcessingService.start();

    this.sendMessageService = new SendMessageService(this, zeresPluginLibrary);
    await this.sendMessageService.start(
      this.emoteService,
      this.attachService,
      this.modulesService,
      this.settingsService,
      this.gifProcessingService
    );

    this.patchesService = new PatchesService(this, zeresPluginLibrary);
    await this.patchesService.start(
      this.sendMessageService,
      this.attachService,
      this.completionsService,
      this.emoteService,
      this.modulesService
    );
  }

  observer(e) {
    if (!e.addedNodes.length || !(e.addedNodes[0] instanceof Element)) return;
    const elem = e.addedNodes[0];

    const modulesService = this.modulesService;
    if (!modulesService) return;

    const textAreaSelector = this.htmlService?.getClassSelector(
      modulesService.classes.TextArea.textArea
    );

    if (
      textAreaSelector !== undefined &&
      elem.querySelector(textAreaSelector)
    ) {
      this.listenersService?.requestAddListeners(CompletionsService.TAG);
    }
  }

  onSwitch() {
    this.completionsService?.destroyCompletions();
  }

  getSettingsPanel() {
    return this.settingsService?.getSettingsElement() ?? new HTMLElement();
  }

  stop() {
    this.patchesService?.stop();
    this.patchesService = undefined;

    this.sendMessageService?.stop();
    this.sendMessageService = undefined;

    this.gifProcessingService?.stop();
    this.gifProcessingService = undefined;

    this.completionsService?.stop();
    this.completionsService = undefined;

    this.attachService?.stop();
    this.attachService = undefined;

    this.emoteService?.stop();
    this.emoteService = undefined;

    this.htmlService?.stop();
    this.htmlService = undefined;

    this.modulesService?.stop();
    this.modulesService = undefined;

    this.settingsService?.stop();
    this.settingsService = undefined;

    this.listenersService?.stop();
    this.listenersService = undefined;
  }
}

const bdWindow = window;

var index =
  bdWindow.ZeresPluginLibrary === undefined ? RawPlugin : EmoteReplacerPlugin;

module.exports = index;
