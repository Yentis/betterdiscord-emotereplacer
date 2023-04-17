/**
 * @name EmoteReplacer
 * @version 2.0.1
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
       * @param {string} extension
       * @param {any} commands
       * @returns {Uint8Array}
       */
      function applyCommands(data, extension, commands) {
        try {
          const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
          const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
          const len0 = WASM_VECTOR_LEN;
          const ptr1 = passStringToWasm0(
            extension,
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
          'AGFzbQEAAAABuAIqYAJ/fwF/YAJ/fwBgA39/fwF/YAF/AGABfwF/YAN/f38AYAR/f39/AGAGf39/f39/AGABfwF+YAV/f39/fwBgAn99AX1gBX9/f39/AX9gAAF/YAN/f30AYAAAYAJ9fQF9YAJ/fwF8YAF9AX1gBn9/f39/fwF/YAN/fX8AYAd/f39/f39/AX9gA399fQBgBH9/f38Bf2AAAXxgCH9/f39/f39/AGACf30AYAR/f35+AGAHf39/f39/fwBgCX9/f39/f35+fgBgAn9/AX5gA35/fwF/YAR/f319AGATf39/f39/f39/f39/f39/f39/fwF/YAt/f39/f39/f39/fwF/YAN/fn4AYAV/f31/fwBgBH99f38AYAV/f35/fwBgBH9+f38AYAV/f3x/fwBgBH98f38AYAF8AXwCgAkiA3diZxpfX3diaW5kZ2VuX29iamVjdF9kcm9wX3JlZgADA3diZxRfX3diaW5kZ2VuX2Vycm9yX25ldwAAA3diZxVfX3diaW5kZ2VuX3N0cmluZ19nZXQAAQN3YmcUX193YmluZGdlbl9pc19vYmplY3QABAN3YmcZX193YmluZGdlbl9qc3ZhbF9sb29zZV9lcQAAA3diZxZfX3diaW5kZ2VuX2Jvb2xlYW5fZ2V0AAQDd2JnFV9fd2JpbmRnZW5fbnVtYmVyX2dldAABA3diZx1fX3diZ19TdHJpbmdfODg4MTBkZmViNDAyMTkwMgABA3diZxpfX3diZ19nZXRfMjdmZTNkYWMxYzRkMDIyNAAAA3diZx1fX3diZ19sZW5ndGhfZTQ5OGZiYzI0ZjljMWQ0ZgAEA3diZxZfX3diaW5kZ2VuX2lzX2Z1bmN0aW9uAAQDd2JnG19fd2JnX25leHRfYjdkNTMwYzA0ZmQ4YjIxNwAEA3diZxtfX3diZ19uZXh0Xzg4NTYwZWMwNmEwOTRkZWEABAN3YmcbX193YmdfZG9uZV8xZWJlYzAzYmJkOTE5ODQzAAQDd2JnHF9fd2JnX3ZhbHVlXzZhYzhkYTVjYzViM2VmZGEABAN3YmcfX193YmdfaXRlcmF0b3JfNTVmMTE0NDQ2MjIxYWE1YQAMA3diZxpfX3diZ19nZXRfYmFmNDg1NWY5YTk4NjE4NgAAA3diZxtfX3diZ19jYWxsXzk1ZDFlYTQ4OGQwM2U0ZTgAAAN3YmchX193YmdfcGFyc2VGbG9hdF9jYjVmNDY4N2FlMGJlMzNlABADd2JnHl9fd2JnX2lzQXJyYXlfMzlkMjg5OTdiZjZiOTZiNAAEA3diZy1fX3diZ19pbnN0YW5jZW9mX0FycmF5QnVmZmVyX2E2OWYwMmVlNGM0ZjUwNjUABAN3YmceX193YmdfZW50cmllc180ZTEzMTViNzc0MjQ1OTUyAAQDd2JnHV9fd2JnX2J1ZmZlcl9jZjY1YzA3ZGUzNGI5YTA4AAQDd2JnGl9fd2JnX25ld181MzdiNzM0MWNlOTBiYjMxAAQDd2JnGl9fd2JnX3NldF8xNzQ5OWU4YWE0MDAzZWJkAAUDd2JnHV9fd2JnX2xlbmd0aF8yN2EyYWZlOGFiNDJiMDlmAAQDd2JnLF9fd2JnX2luc3RhbmNlb2ZfVWludDhBcnJheV8wMWNlYmU3OWNhNjA2Y2NhAAQDd2JnHV9fd2JnX3JhbmRvbV9hZmIzMjY1NTI3Y2Y2N2M4ABcDd2JnGl9fd2JnX25ld19hYmRhNzZlODgzYmE4YTVmAAwDd2JnHF9fd2JnX3N0YWNrXzY1ODI3OWZlNDQ1NDFjZjYAAQN3YmccX193YmdfZXJyb3JfZjg1MTY2N2FmNzFiY2ZjNgABA3diZxdfX3diaW5kZ2VuX2RlYnVnX3N0cmluZwABA3diZxBfX3diaW5kZ2VuX3Rocm93AAEDd2JnEV9fd2JpbmRnZW5fbWVtb3J5AAwDxgPEAwkYBwcHDQIGBAEHBQAHBgEFBgEBABkAEQMABQUJGgICBQUBARIFBwYTAwQCBQIBBgADBQEBAQEBAwsBARMBAgMCAQABARsAHAAABwAUBA0CAAsAAAAAAAAdHgUDBgAGAwMAHwIBAQAMAAEDAwEFAQYAAAEABwQFAAABBQEBAQEBAQUFAQEFBQAgAAkLBgsBIQYDBBQBAAcAAAAAAAEVAAEEAwEACQAiAgUFAQUADBUAAAEBBAEAAAMACQAAAAAAAQAAAAAAAAAAAAAAAAQDDQMAAAMBAQ4AAQEAAQEDAwAAAAAAAAEFAAICBgICAQcCAgEDDg4BAQAFCwAAAAAAAAEBAQADAAAEBQAAAAAABQUBBgUAAAABAQMFBgMCBQASAQAAAAAJCyMlJwEAAQMDAQYAAAQFAAACAQMAAAEB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QQNNDQQgASAMNgAAIAtBAWohCyABIA1qIQEgACANayIADQALCyAJIApqIQkgCEEBaiEIIAcgCmsiBw0ACwwDCwwECwwCCyAGIApBAnQiDjYCWCAKRQ0CIAdFDQAgAUEMaigCACEQIAEoAgSzIRMgASgCACIRsyEUIAYqAsQBIRUgBioCwAEhFiAGKgK8ASEXIAYqArgBIRggBioCtAEhGSAGKgKwASEaQQAhCANAIAlFDQEgByAOIAcgDkkbIgoEQCAWIAizIgKUIRsgGSAClCEcQQAhCyAJIQEgCiEAA0BBBCAAIABBBE8bIQ0gGCAcIBogC7MiEpSSkhDtAiECIBUgGyAXIBKUkpIQ7QIhEgJ/QQAgAkMAAAAAXQ0AGkEAIAIgFGANABpBACASQwAAAABdDQAaQQAgEiATYA0AGiACQwAAAABgIQwgEEF/An8gEkMAAAAAYCIPIBJDAACAT11xBEAgEqkMAQtBAAtBACAPGyASQ///f09eGyARbEF/An8gDCACQwAAgE9dcQRAIAKpDAELQQALQQAgDBsgAkP//39PXhtqQQJ0aigAAAshDCAGIA02AlggAEEDTQ0EIAEgDDYAACALQQFqIQsgASANaiEBIAAgDWsiAA0ACwsgCSAKaiEJIAhBAWohCCAHIAprIgcNAAsLIAZB0AJqJAAPCyAGQQA2AogCQQAgBkHYAGpBhJHAACAGQYACakGIkcAAENsBAAsgBkEANgKUAiAGQbihwAA2ApACIAZBATYCjAIgBkHgocAANgKIAiAGQQA2AoACQQEgBkHYAGpBuKHAACAGQYACakG4osAAENsBAAuAGwIZfwN8IwBBsARrIgMkACADQgA3A5gBIANCADcDkAEgA0IANwOIASADQgA3A4ABIANCADcDeCADQgA3A3AgA0IANwNoIANCADcDYCADQgA3A1ggA0IANwNQIANCADcDSCADQgA3A0AgA0IANwM4IANCADcDMCADQgA3AyggA0IANwMgIANCADcDGCADQgA3AxAgA0IANwMIIANCADcDACADQgA3A7gCIANCADcDsAIgA0IANwOoAiADQgA3A6ACIANCADcDmAIgA0IANwOQAiADQgA3A4gCIANCADcDgAIgA0IANwP4ASADQgA3A/ABIANCADcD6AEgA0IANwPgASADQgA3A9gBIANCADcD0AEg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IBdqIAogEmooAAA2AAAgCkEEaiEKIAZBAWohBiAVQQFrIRUgBUEBayIFDQALIA4gE2shDiASIBNqIRIgESATaiERIA0gFGohDSAMIBRrIQwgFCAXaiEXIgkgGkcNAAsMAQsgB0EANgIIIBhBBGogB0EIahDBAkECIQ8LIBggDzYCACAHQUBrJAAMBwsgAiAJbEECdCIAQXxGDQEgAEEEaiIKIBBLDQMLIAdBLGpBBzYCACAHQRRqQQI2AgAgB0EcakECNgIAIAcgCTYCNCAHIAs2AjAgB0GAiMAANgIQIAdBADYCCCAHQQc2AiQgByAZNgI8IAcgAzYCOCAHIAdBIGo2AhggByAHQThqNgIoIAcgB0EwajYCICAHQQhqQZCIwAAQoQIAC0F8QQBB7IjAABCXAwALIBZBBGohCgsgCiAQQeyIwAAQlgMAC0F8IBZBBGpB1IfAABCXAwALIBZBBGogG0HUh8AAEJYDAAsgBCgCQEEGRw0BIAAgBCkDKDcCACAAQRBqIBwoAgA2AgAgAEEIaiAEQTBqKQMANwIADAQLAkAgB0H/////A3EgB0cNACADrSIqIAdBAnStfiImQiCIpw0AAkACQCAmpyIKRQRAQQQhFQwBCyAKQf////8BSw0FIApBAnQiBkEASA0FIApBgICAgAJJQQJ0IQUgBgR/IAYgBRD+AgUgBQsiFUUNAQtBqI/AACoCACEiQZSPwAAoAgAhESAEQoCAgIDAADcDKAJAIANFDQAgC7MgA7OVIiRDAACAP5ciJSAilCEjIAutIihCAX0hKQNAIARBADYCMCAjICQgDbNDAAAAP5KUIh6SjSIdQwAAAN9gIQVC////////////AAJ+IB2LQwAAAF9dBEAgHa4MAQtCgICAgICAgICAfwtCgICAgICAgICAfyAFGyAdQ////15eG0IAIB0gHVsbIicgKCAnIChTGyErIB4gI5OOIh1DAAAA32AhBQJAQv///////////wACfiAdi0MAAABfXQRAIB2uDAELQoCAgICAgICAgH8LQoCAgICAgICAgH8gBRsgHUP///9eXhtCACAdIB1bGyImICkgJiApUxtCACAmQgBZGyImpyILICsgJkIBfCAnICZC/////w+DVRunIghPDQAgHkMAAAC/kiEfIBEoAhQhDEMAAAAAIR0gCyEFA0AgBUEBakEB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QRB0QR91IgJzIAJrQf//A3EiBiAQIANrIgIgAkEQdEEfdSICcyACa0H//wNxIhFLGyIDIBAgCWsiAiACQRB0QR91IgJzIAJrQf//A3EiAiARTRsgAyACIAZNG2o6AAACQCAFDQAgFEEBaiICIAItAAAgFUEBai0AACIJIBZBAWotAAAiAyAXQQFqLQAAIgIgAiAJaiADayIQIAJrIgIgAkEQdEEfdSICcyACa0H//wNxIgYgECADayICIAJBEHRBH3UiAnMgAmtB//8DcSIRSxsiAyAQIAlrIgIgAkEQdEEfdSICcyACa0H//wNxIgIgEU0bIAMgAiAGTRtqOgAAIBhBAkYNACAUQQJqIgIgAi0AACAVQQJqLQAAIgkgFkECai0AACIDIBdBAmotAAAiAiACIAlqIANrIhAgAmsiAiACQRB0QR91IgJzIAJrQf//A3EiBiAQIANrIgIgAkEQdEEfdSICcyACa0H//wNxIhFLGyIDIBAgCWsiAiACQRB0QR91IgJzIAJrQf//A3EiAiARTRsgAyACIAZNG2o6AAAgGEEDRg0AIBRBA2oiAiACLQAAIBVBA2otAAAiCSAWQQNqLQAAIgMgF0EDai0AACICIAIgCWogA2siECACayICIAJBEHRBH3UiAnMgAmtB//8DcSIGIBAgA2siAiACQRB0QR91IgJzIAJrQf//A3EiEUsbIgMgECAJayICIAJBEHRBH3UiAnMgAmtB//8DcSICIBFNGyADIAIgBk0bajoAACAYQQRGDQAgFEEEaiICIAItAAAgFUEEai0AACIJIBZBBGotAAAiAyAXQQRqLQAAIgIgAiAJaiADayIQIAJrIgIgAkEQdEEfdSICcyACa0H//wNxIgYgECADayICIAJBEHRBH3UiAnMgAmtB//8DcSIRSxsiAyAQIAlrIgIgAkEQdEEfdSICcyACa0H//wNxIgIgEU0bIAMgAiAGTRtqOgAAIBhBBUYNACAUQQVqIgIgAi0AACAVQQVqLQAAIgkgFkEFai0AACIDIBdBBWotAAAiAiACIAlqIANrIhAgAmsiAiACQRB0QR91IgJzIAJrQf//A3EiBiAQIANrIgIgAkEQdEEfdSICcyACa0H//wNxIhFLGyIDIBAgCWsiAiACQRB0QR91IgJzIAJrQf//A3EiAiARTRsgAyACIAZNG2o6AAAg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AwggAkEkakECNgIAIAJBLGpBATYCACACQby7wAA2AiAgAkEANgIYIAJB2gA2AhQgAiACQRBqNgIoIAIgAkEIajYCECABIAJBGGoQ6AEMEAsgAiAAKQMINwMIIAJBJGpBAjYCACACQSxqQQE2AgAgAkG8u8AANgIgIAJBADYCGCACQdsANgIUIAIgAkEQajYCKCACIAJBCGo2AhAgASACQRhqEOgBDA8LIAIgACsDCDkDCCACQSRqQQI2AgAgAkEsakEBNgIAIAJBoLvAADYCICACQQA2AhggAkHcADYCFCACIAJBEGo2AiggAiACQQhqNgIQIAEgAkEYahDoAQwOCyACIAAoAgQ2AgggAkEkakECNgIAIAJBLGpBATYCACACQYC7wAA2AiAgAkEANgIYIAJB3QA2AhQgAiACQRBqNgIoIAIgAkEIajYCECABIAJBGGoQ6AEMDQsgAiAAKQIENwMIIAJBJGpBATYCACACQSxqQQE2AgAgAkHsusAANgIgIAJBADYCGCACQd4ANgIUIAIgAkEQajYCKCACIAJBCGo2AhAgASACQRhqEOgBDAwLIAJBJGpBATYCACACQSxqQQA2AgAgAkHcusAANgIgIAJBjLnAADYCKCACQQA2AhggASACQRhqEOgBDAsLIAJBJGpBATYCACACQSxqQQA2AgAgAkHIusAANgIgIAJBjLnAADYCKCACQQA2AhggASACQRhqEOgBDAoLIAJBJGpBATYCACACQSxqQQA2AgAgAkG0usAANgIgIAJBjLnAADYCKCACQQA2AhggASACQRhqEOgBDAkLIAJBJGpBATYCACACQSxqQQA2AgAgAkGgusAANgIgIAJBjLnAADYCKCACQQA2AhggASACQRhqEOgBDAgLIAJBJGpBATYCACACQSxqQQA2AgAgAkGIusAANgIgIAJBjLnAADYCKCACQQA2AhggASACQRhqEOgBDAcLIAJBJGpBATYCACACQSxqQQA2AgAgAkH4ucAANgIgIAJBjLnAADYCKCACQQA2AhggASACQRhqEOgBDAYLIAJBJGpBATYCACACQSxqQQA2AgAgAkHsucAANgIgIAJBjLnAADYCKCACQQA2AhggASACQRhqEOgBDAULIAJBJGpBATYCACACQSxqQQA2AgAgAkHgucAANgIgIAJBjLnAADYCKCACQQA2Ahgg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ADYCjAEgAkEkRg0CIABBADYCkAEgAkElRg0CIABBADYClAEgAkEmRg0CIABBADYCmAEgAkEnRg0CIABBADYCnAEgAkEoRg0CQShBKEHYiMMAEM0BAAsgA0EoQdiIwwAQzQEAC0GCicMAQR1B2IjDABCHAgALIAAoAqABIAVqIQIgAUEfcSIHRQRAIAAgAjYCoAEgAA8LAkAgAkEBayIDQSdNBEAgAiEEIAAgA0ECdGooAgAiBkEAIAFrIgF2IgNFDQEgAkEnTQRAIAAgAkECdGogAzYCACACQQFqIQQMAgsgAkEoQdiIwwAQzQEACyADQShB2IjDABDNAQALAkAgAiAFQQFqIghLBEAgAUEfcSEBIAJBAnQgAGpBCGshAwNAIAJBAmtBKE8NAiADQQRqIAYgB3QgAygCACIGIAF2cjYCACADQQRrIQMgCCACQQFrIgJJDQALCyAAIAVBAnRqIgEgASgCACAHdDYCACAAIAQ2AqABIAAPC0F/QShB2IjDABDNAQALxQgBBX8CQAJAIAItAAAiBUUNACACLwECDQAgAkEEai8BAEUNAQsCQCABKAIAIgMEQCABQQAgAxsiBCgCACIBKAIAIAEoAggiA0YEQCABIANBARCjASABKAIIIQMLIAEgA0EBajYCCCABKAIEIANqQSE6AAAgBQRAIAJBBGovAQAhBSACLwECAn8gBCgCACIBKAIAIAEoAggiA0cEQCABDAELIAEgA0EBEKMBIAEoAgghAyAEKAIACyECIAEgA0EBajYCCCABKAIEIANqQf8BOgAAIAIoAggiAyACKAIARwR/IAIFIAIgA0EBEKMBIAIoAgghAyAEKAIACyEBIAIgA0EBajYCCCACKAIEIANqQQs6AAAgASgCACABKAIIIgJrQQpNBEAgASACQQsQowEgASgCCCECCyABIAJBC2o2AgggASgCBCACaiIBQc+gwAApAAA3AAAgAUEHakHWoMAAKAAANgAAAn8gBCgCACIBKAIAIAEoAggiA0cEQCABDAELIAEgA0EBEKMBIAEoAgghAyAEKAIACyECIAEgA0EBajYCCCABKAIEIANqQQM6AAAgAigCCCIBIAIoAgBGBEAgAiABQQEQowEgAigCCCEBCyACIAFBAWo2AgggAigCBCABakEBOgAABEAgBCgCACICKAIAIAIoAggiAWtBAU0EQCACIAFBAhCjASACKAIIIQELIAIgAUECajYCCCACKAIEIAFqQQA7AAAMAwsgBCgCACICKAIAIAIoAggiAWtBAU0EQCACIAFBAhCjASACKAIIIQELIAIgAUECajYCCCACKAIEIAFqIgEgBUGA/gNxQQh2OgABIAEgBToAAAwCCyACLQACIQYgAi8BBCEFIAItAAEhBwJ/IAQoAgAiASgCACABKAIIIgNHBEAgAQwBCyABIANBARCjASABKAIIIQMgBCgCAAshAiABIANBAWo2AgggASgCBCADakH5AToAACACKAIIIgMgAigCAEcEfyACBSACIANBARCjASACKAIIIQMgBCgCAAshASACIANBAWo2AgggAigCBCADakEEOgAAIAEoAggiAiABKAIARgRAIAEgAkEBEKMBIAEoAgghAgsgASACQQFqNgIIIAEoAgQgAmogBzoAACAFQYD+A3FBCHYhBwJ/IAQoAgAiASgCACABKAIIIgNrQQFLBEAgAQwBCyABIANBAhCjASABKAIIIQMgBCgCAAshAiABIANBAmo2AgggASgCBCADaiIBIAc6AAEgASAFOgAAIAIoAggiASACKAIARgRAIAIgAUEBEKMBIAIoAgghAQsgAiABQQFqNgIIIAIoAgQgAWogBjoAAAwBC0HMn8AAQStB3KDAABCHAgALIAQoAgAiAigCACACKAIIIgFGBEAgAiABQQEQowEgAigCCCEBCyACIAFBAWo2AgggAigCBCABakEAOgAACyAAQQU6AAAL3AcBC38jAEGAAWsiDCQAAkAgAEUgAkVyDQADQAJAAkACQCAAIAJqQRhPBEAgACACIAAgAkkiBBtBgQFJDQMgBA0BIAEgAmshBiACQXxxIQsgAkEDcSEJIAJBAWshCEEAIAJrIQoDQEEAIQQgCEEDTwRAA0AgBCAGaiIDLQAAIQcgAyABIARqIgUtAAA6AAAgBSAHOgAAIAVBAWoiBy0AACENIAcgA0EBaiIHLQAAOgAAIAcgDToAACADQQJqIgctAAAhDSAHIAVBAmoiBy0AADoAACAHIA06AAAgBUEDaiIFLQAAIQcgBSADQQNqIgMtAAA6AAAgAyAHOgAAIAsgBEEEaiIERw0ACwsgCQRAIAQgBmohAyABIARqIQUgCSEEA0AgAy0AACEHIAMgBS0AADoAACAFIAc6AAAg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AgAiBBDHAygCACEGIANBCGogBBClAyADIAMoAgggAygCDBCBAyADQRhqIAUoAgAgAEEIaiIEKAIAQX8CfyAGsyILIAsgAygCALMgAygCBLOUQwAAIEGVlCABQwAASEKUQwAAAD6UlSIMlY4iAUMAAIBPXSABQwAAAABgIgZxBEAgAakMAQtBAAtBACAGGyABQ///f09eGxBJIAQoAgAiBARAIARBJGwhBCAFKAIAQRxqIQUDQCAFQQRrKAIABEAgBSgCABA6CyAFQSRqIQUgBEEkayIEDQALCyAAKAIABEAgAEEEaigCABA6CyAAIAMpAxg3AgAgAEEIaiIFIANBIGooAgA2AgACfyALQwAAAABgIgQgC0MAAIBPXXEEQCALqQwBC0EACyEGIAUoAgAiBUUNACAAQQRqKAIAIQBBfyAGQQAgBBsgC0P//39PXhtBAnQiBkUNAUEyQTMgAhshCCAAIAVBJGxqIQlBACECA0ACfyAMIAKzlCALENIDEO0CIgFDAACAT10gAUMAAAAAYCIHcQRAIAGpDAELQQALIQogABDHAyEEIABBJGohACAGIARBEGooAgAiBSAFIAZwayIFTQRAQX8gCkEAIAcbIAFD//9/T14bQQJ0IQcgBEEMaigCACEEA0AgBCAGIAcgCBEFACAEIAZqIQQgBSAGayIFIAZPDQALCyACQQFqIQIgACAJRw0ACwsgA0EwaiQADwsgABDHAxogA0EANgIUIANBADYCLCADQeimwAA2AiggA0EBNgIkIANBkKfAADYCICADQQA2AhhBASADQRRqQeimwAAgA0EYakHop8AAENsBAAunBAECfyAAQfQCaigCAARAIABB8AJqKAIAEDoLIABBmAJqKAIABEAgAEGcAmooAgAQOgsgAEGwAmooAgAQOiAAQbQCaigCAARAIABBuAJqKAIAEDoLIABBwAJqKAIABEAgAEHEAmooAgAQOgsCQCAAQUBrKAIAQQJGDQACQAJAIAAoAhAOAwEAAQALIABBFGooAgBFDQAgAEEYaigCABA6CwJAAkAgAEEgaigCAA4DAQABAAsgAEEkaigCAEUNACAAQShqKAIAEDoLAkACQCAAQTBqKAIADgMBAAEACyAAQTRqKAIARQ0AIABBOGooAgAQOgsgAEHgAGooAgAiAgRAIABB3ABqKAIAIgEgAkEYbGohAgNAIAEoAgAEQCABQQRqKAIAEDoLIAFBDGooAgAEQCABQRBqKAIAEDoLIAFBGGoiASACRw0ACwsgACgCWARAIABB3ABqKAIAEDoLIABB7ABqKAIAIgEEQCABQRxsIQIgAEHoAGooAgBBFGohAQNAIAFBBGsoAgAEQCABKAIAEDoLIAFBEGsoAgAEQCABQQxrKAIAEDoLIAFBHGohASACQRxrIgINAAsLIAAoAmQEQCAAQegAaigCABA6CyAAQfAAaiIBELMBIAEoAgBFDQAgAEH0AGooAgAQOgsgACgCqAMEQCAAQawDaigCABA6CyAAKAK0AwRAIABBuANqKAIAEDoLIAAoAsADBEAgAEHEA2ooAgAQOgsLmhMCBn8BfiMAQUBqIgUkACAFQQA2AgggBUKAgICAEDcDACAFQRBqIgIgBUHgkcAAELoCIwBBMGsiAyQAAn8CQAJAAkACQAJAAkAgACgCAEEBaw4FAQIDBAUACyMAQTBrIgEkAAJ/AkAgAEEEaiIEKAIQRQRAIAQtAABBA0cNASABQRRqQQE2AgAgAUEcakEANgIAIAFBrMrAADYCECABQejEwAA2AhggAUEANgIIIAIgAUEIahDoAQwCCyABIARBEGo2AgQgAUEUakECNgIAIAFBHGpBAjYCACABQSxqQYQBNgIAIAFBiMrAADYCECABQQA2AgggAUGDATYCJCABIAQ2AiAgASABQSBqNgIYIAEgAUEEajYCKCACIAFBCGoQ6AEMAQsgAUEUakEBNgIAIAFBHGpBATYCACABQZjKwAA2AhAgAUEANgIIIAFBgwE2AiQgASAENgIgIAEgAUEgajYCGCACIAFBCGoQ6AELIAFBMGokAAwFCyAAQQRqIQEgAEEUaiIEKAIARQRAIANBJGpBATYCACADQSxqQQE2AgAgA0HoycAANgIgIANBADYCGCADQYMBNgIMIAMgATYCCCADIANBCGo2AiggAiADQRhqEOgBDAULIAMgBDYCBCADQSRqQQI2AgAgA0EsakECNgIAIANBFGpBhAE2AgAgA0HYycAANgIgIANBADYCGCADQYMBNgIMIAMgATYCCCADIANBCGo2AiggAyADQQRqNgIQIAIgA0EYahDoAQwECyMAQTBrIgEkAAJAAkACQAJAAkACQCAAQQRqIgYoAgBBAWsOAwABAgMLQQEhBCABQRxqQQE2AgAgAUEkakEANgIAIAFB7MjAADYCGCABQejEwAA2AiAgAUEANgIQIAIgAUEQahDoAUUNAwwECyABIAZBBGo2AgxBASEEIAFBHGpBATYCACABQSRqQQE2AgAgAUGgyMAANgIYIAFBADYCECABQYEBNgIsIAEgAUEoajYCICABIAFBDGo2AiggAiABQRBqEOgBRQ0CDAMLQQEhBCABQRxqQQE2AgAgAUEkakEANgIAIAFB/MfAADYCGCABQejEwAA2AiAgAUEANgIQIAIgAUEQahDoAUUNAQwCC0EBIQQgAUEcakEBNgIAIAFBJGpBADYCACABQazJwAA2AhggAUHoxMAANgIgIAFBADYCECACIAFBEGoQ6AENAQsgBigCEEUEQEEAIQQMAQsgASAGQRBqNgIMIAFBHGpBATYCACABQSRqQQE2AgAgAUG4ycAANgIYIAFBADYCECABQYQBNgIsIAEgAUEoajYCICABIAFBDGo2AiggAiABQRBqEOgBIQQLIAFBMGokACAEDAMLAkACQAJAQQIgACkDCCIHp0ECayAHQgFYG0EBaw4CAQIACyADQSRqQQE2AgAgA0EsakEANgIAIANBvMvAADYCICADQejEwAA2AiggA0EANgIYIAIgA0EYahDoAQwECyADQSRqQQE2AgAgA0EsakEANgIAIANBoMvAADYCICADQejEwAA2AiggA0EANgIYIAIgA0EYahDoAQwDCyADQSRqQQE2AgAgA0EsakEANgIAIANBhMvAADYCICADQejEwAA2AiggA0EANgIYIAIgA0EYahDoAQwCCyMAQTBrIgEkAAJ/AkACQAJAAkACQAJAQQEgAEEEaiIELQAAIgZBBGsgBkEDTRtB/wFxQQFrDgIBAgALIAEgBEEBajYCBCABQRRqQQM2AgAgAUEcakECNgIAIAFBLGpBhQE2AgAgAUG8x8AANgIQIAFBADYCCCABQYMBNgIkIAEgBEEQajYCICABIAFBIGo2AhggASABQQRqNgIoIAIgAUEIahDoAQwFCyAGQQJrDgICAwELIAEgBEEEajYCACAELQAQQQNGBEAgAUEUakEBNgIAIAFBHGpBATYCACABQeDFwAA2AhAgAUEANgIIIAFBgQE2AiQgASABQSBqNgIYIAEgATYCICACIAFBCGoQ6AEMBAsgASAEQRBqNgIE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IANBAjoAICAAIANBIGoQsQIgAEEOOgAZDAULIANBIGogASAFIAdqIAQgBWsgAhAiIAMoAiAhBCADLQA9IgdBDUYNAyADQRhqIAZBGGotAAAiBToAACADQRBqIAZBEGopAgAiCzcDACADQQhqIAZBCGopAgAiDDcDACADIAYpAgAiDTcDACADLwE+IQggA0E4aiAFOgAAIANBMGogCzcDACADQShqIAw3AwAgAyANNwMgIAEgASgC+AIgBGoiBSABKAL8AiIEIAQgBUsbIgU2AvgCAkBBBiAHQQJrIAdBAU0bQf8BcSIJBEAgCUEKRg0BIAAgAykDIDcCACAAIAg7ARogACAHOgAZIABBGGogA0E4ai0AADoAACAAQRBqIANBMGopAwA3AgAgAEEIaiADQShqKQMANwIADAYLIAEtAIgDRQ0BDAILCyABQQE6AIgDCyAAQQ06ABkMAgsgBSAEQaStwAAQlQMACyADQQhqIAZBCGopAgAiCzcDACADIAYpAgAiDDcDACAAQQxqIAs3AgAgACAMNwIEIABBDjoAGSAAIAQ2AgALIANBQGskAAv5BAEKfyMAQTBrIgMkACADQQM6ACggA0KAgICAgAQ3AyAgA0EANgIYIANBADYCECADIAE2AgwgAyAANgIIAn8CQAJAIAIoAgAiCkUEQCACQRRqKAIAIgBFDQEgAigCECEBIABBA3QhBSAAQQFrQf////8BcUEBaiEHIAIoAgghAANAIABBBGooAgAiBARAIAMoAgggACgCACAEIAMoAgwoAgwRAgANBAsgASgCACADQQhqIAFBBGooAgARAAANAyABQQhqIQEgAEEIaiEAIAVBCGsiBQ0ACwwBCyACKAIEIgBFDQAgAEEFdCELIABBAWtB////P3FBAWohByACKAIIIQADQCAAQQRqKAIAIgEEQCADKAIIIAAoAgAgASADKAIMKAIMEQIADQMLIAMgBSAKaiIEQRxqLQAAOgAoIAMgBEEUaikCADcDICAEQRBqKAIAIQYgAigCECEIQQAhCUEAIQECQAJAAkAgBEEMaigCAEEBaw4CAAIBCyAGQQN0IAhqIgxBBGooAgBBsAJHDQEgDCgCACgCACEGC0EBIQELIAMgBjYCFCADIAE2AhAgBEEIaigCACEBAkACQAJAIARBBGooAgBBAWsOAgACAQsgAUEDdCAI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BEEANgIEIARB7NbCADYCACAHIANrIgNBACADIAdNGyEHQQALIQEgBQRAIAVBDGwhAwNAAn8CQAJAAkAgAi8BAEEBaw4CAgEACyACQQRqKAIADAILIAJBCGooAgAMAQsgAkECai8BACIFQegHTwRAQQRBBSAFQZDOAEkbDAELQQEgBUEKSQ0AGkECQQMgBUHkAEkbCyEFIAJBDGohAiABIAVqIQEgA0EMayIDDQALCwJ/AkAgASAHSQRAIAcgAWsiASEDAkACQAJAIAZBA3EiAkEBaw4DAAEAAgtBACEDIAEhAgwBCyABQQF2IQIgAUEBakEBdiEDCyACQQFqIQIgAEEEaigCACEBIAAoAgAhBgNAIAJBAWsiAkUNAiAGIAggASgCEBEAAEUNAAsMAwsgACgCACAAQQRqKAIAIAQQTQwBCyAGIAEgBBBNDQFBACECA0BBACACIANGDQEaIAJBAWohAiAGIAggASgCEBEAAEUNAAsgAkEBayADSQshAiAAIAk6ACAgACAKNgIcDAELQQEhAgsgBEEQaiQAIAIL6wMBAn8gAEH0AmooAgAEQCAAQfACaigCABA6CyAAQZgCaigCAARAIABBnAJqKAIAEDoLIABBsAJqKAIAEDogAEG0AmooAgAEQCAAQbgCaigCABA6CyAAQcACaigCAARAIABBxAJqKAIAEDoLAkAgAEFAaygCAEECRg0AAkACQCAAKAIQDgMBAAEACyAAQRRqKAIARQ0AIABBGGooAgAQOgsCQAJAIABBIGooAgAOAwEAAQALIABBJGooAgBFDQAgAEEoaigCABA6CwJAAkAgAEEwaigCAA4DAQABAAsgAEE0aigCAEUNACAAQThqKAIAEDoLIABB4ABqKAIAIgIEQCAAQdwAaigCACIBIAJBGGxqIQIDQCABKAIABEAgAUEEaigCABA6CyABQQxqKAIABEAgAUEQaigCABA6CyABQRhqIgEgAkcNAAsLIAAoAlgEQCAAQdwAaigCABA6CyAAQewAaigCACIBBEAgAUEcbCECIABB6ABqKAIAQRRqIQEDQCABQQRrKAIABEAgASgCABA6CyABQRBrKAIABEAgAUEMaygCABA6CyABQRxqIQEgAkEcayICDQALCyAAKAJkBEAgAEHoAGooAgAQOgsgAEHwAGoiARCzASABKAIARQ0AIABB9ABqKAIAEDoLC5QEAQl/IwBBMGsiBCQAAn8gAkUEQEEAIQJBAAwBCwNAIARBCGogARA0AkACQCAEKAIIIgtBB0cEQCAJQQFqIQkgBCgCJCEKIAQoAiAhAyAEKAIcIQUgBCgCFCEIIAQoAhAhBiAEKAIMIQcCQAJAAkACQAJAAkAgCw4HAgMECAUBAAELIApFDQcgBCgCKBA6DAcLIAdB/wFxQQNHDQYgBigCACAGKAIEKAIAEQMAIAYoAgQiA0EEaigCAARAIANBCGooAgAaIAYoAgAQOgsgBhA6DAYLIAZFIAdB/wFxQQNrQX5JckUEQCAIEDoLIAVFDQUgBSADKAIAEQMAIANBBGooAgBFDQUgA0EIaigCABogBRA6DAULIAZFIAdB/wFxQQNrQX5JckUEQCAIEDoLIAVFDQQgBSADKAIAEQMAIANBBGooAgBFDQQgA0EIaigCABogBRA6DAQLIAZFIAdBAkdyRQRAIAgQOgsgBUUNAyAFIAMoAgARAwAgA0EEaigCAEUNAyADQQhqKAIAGiAFEDoMAwsgA0UgBUH/AXFBA2tBfklyRQRAIAoQOgsCQAJAQQEgB0EEayAHQf8BcSIDQQNNG0H/AXEOAgQBAAsgBkUNAwwCCyADQQNrQX5JDQIgBg0BDAILIAkhAkEBDAMLIAgQOgsgAiAJRw0AC0EACyEBIAAgAjYCBCAAIAE2AgAgBEEwaiQAC/8xAiR/An4jAEEgayIWJAACQAJAIAEtAKABRQRAIAFBKGohAiABQQxqISMDQCABKAIQIQcCQAJAAkACQCABKAIYIgMgASgCHCILTwRAICMoAgAiCyABKQMAIicgC60iJiAmICdWG6ciA0kNASABKAIgIQUgByABKAIIIANqIAEoAhQiFCALIANrIgMgAyAUSxsiCxDBAxogASALNgIcIAFBADYCGCABIAUgCyAFIAtLGzYCICABICcgC618NwMAQQAhAwsgAyALRgRAQQ5BARD9AiIBRQ0CIAFBBmpB8qvAACkAADcAACABQeyrwAApAAA3AABBDEEEEP0CIgNFDQMgA0EONgIIIAMgATYCBCADQQ42AgAgAEEANgIEIABBCzoAACAAQQxqQdijwAA2AgAgAEEIaiADNgIADAgLIBZBCGohFSADIAdqIRRBACEIQQAhEEEAIQlBACERQQAhFyMAQaABayIGJAACQAJAAkACQCALIANrIh4iDEUNACACLQA0IgVBDkYNACAeRSEEIAJB3gBqIRsgAkEYaiEfIAJBKGohCyACQRBqIRwgAkFAayESIAJBNWohISAGQcgAaiEiIAZBhQFqISQgAkHUAGohGSACQTBqIR0gAkEsaiEgIAJB0ABqISUgAkEkaiEaIAJBIGohGAJAAkADQAJAAkACQAJAAkACfwJAAkACfwJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQCAEQQFxRQRAIAJBDjoANCAULQAAIg/AIQMgAigCPCENIAIoAjghDiACLQA2IQogAi0ANSETQQEhB0EDIQQgBUH/AXFBAWsODQEkAhIDDAQJCAcGBT4jC0EAQQBBqJrCABDNAQALIANBCHQgE3IhDSAKQQFrDgYaGx8eHRwZCyAOQQFrDgYQERIUEysXCyATQSFrDhsLCQkJCQkJCQkJCQoJCQkJCQkJCQkJCQkJCQwNCyACIBM6AAwgAkEIaiIEQQA2AgAgAigCAAR/QQAFIAJBABClASAEKAIACyACQQRqIgUoAgBqIAM6AAAgBCAEKAIAQQFqIgg2AgAgE0H5AWsOBwYxMTExMDAFCyACIAM6ADUgAkEGOgA0QQAhBAw4CyAOBEAgEigCAEECRg0hIAIoAhAiA0UNIiAOIAwgDCAOSxshByACLwFiIQkgAi8BZCAcQQAgAxsiAygCACADKAIEKAIQEQQADSMgCWwhCSAaKAIAIgUNNgJAQYCAASAJIAlBgIABTxsiBUUEQEEBIQ8MAQsgBUEBEP4CIg9FDSULIAIoAhwEQCAYKAIAEDoLIAIgBTYCHCAaIAU2AgAgGCAPNgIADDYLIAMEQCACIA82AjggAkELOgA0QQAhBAw4CyASKAIAQQJGDTQgAigCECIDRQ0kIAIvAWQgAi8BYmwhBCAaKAIAIgcNMgJAQYCAASAEIARBgIABTxsiB0UEQEEBIQUMAQsgB0EBEP4CIgVFDSYLIAIoAhwEQCAYKAIAEDoLIAIgBzYCHCAaIAc2AgAgGCAFNgIADDILIBNBC0sNHSAGQUBrIQgjAEEwayIDJAAgAyATOgAPAkAgE0EMTQRAIANBMGokAAwBCyADQRxqQQE2AgAgA0EkakEBNgIAIANBnLnCADYCGCADQQA2AhAgA0HSATYCLCADIANBKGo2AiAgAyADQQ9qNgIoIANBEGpB/LnCABChAgALAkACQAJAAkBBgIABQQIQ/QIiCQRAQYDAAEECEP0CIgVFDQFBgCBBARD+AiIDRQ0CQdAAQQgQ/QIiBEUNAyAEQQE6AEkgBEEAOwBHIAQgEzoARiAEQQA7ATggBEEANgI0IAQgBTYCMCAEQoCAgICAgAQ3AyggBCAJNgIkIARCgICAgICABDcCHCAEQoAgNwIUIAQgAzYCECAEQQA6AAsgBEIANwMAIAQgE0EBaiIDOgAKIARBASATQQ9xdCIFOwFCIAQgBUEBajsBRCAEIAVBAmo7AUAgBEF/IANBD3F0QX9zOwEIIAhB4LHCADYCBCAIIAQ2AgAMBAtBgIABQQIQuwMAC0GAwABBAhC7AwALQYAgQQEQuwMAC0HQAEEIELsDAAsgBigCRCEJIAYoAkAhBQJAIBwoAgAiA0UNACADIAIoAhQoAgARAwAgAigCFCIDQQRqKAIARQ0AIANBCGooAgAaIBwoAgAQOgsgAiAPNgI4IAJBCzoANCACIAk2AhQgAiAFNgIQIAIoAkBBAkcEQEEHIQQgEiEJDDcLDD0LIA5FDSUgEigCAEECRg08IBkoAgAiD0UNJAJAAkAgDiAMIAwgDksbIgcgAigCUCACKAJYIghrSwRAICUgCCAHEKMBIBkoAgAhDyACKAJYIQgMAQsgB0UNAQsgB0EBawJAIAdBA3EiBEUEQCAUIQUMAQsgFCEFA0AgCCAPaiAFLQAAOgAAIAhBAWohCCAFQQFqIQUgBEEBayIEDQALC0EDSQ0AIAcgFGohBCAIIA9qIQNBACEPA0AgAyAPaiIKIAUgD2oiDS0AADoAACAKQQFqIA1BAWotAAA6AAAgCkECaiANQQJqLQAAOgAAIApBA2ogDUEDai0AADoAACAPQQRqIQ8gDUEEaiAERw0ACyAIIA9qIQgLIAJBCToANCACIAg2AlggAiAOIAdrNgI4QQAhBAw1CyAOBEAgDiAMIAwgDksbIgcgAigCACACQQhqIgMoAgAiBGtLBEAgAiAEIAcQowEgAygCACEECyACQQRqKAIAIARqIBQgBxDBAxogAiAOIAdrNgI4IAJBCDoANCADIAQgB2o2AgBBACEEDDULIANFDS4gAiAPNgI4IAJBCDoANCACQQA6AA0gAkEEaigCACEJIAJBCGooAgAhECACLQAMIRdBBSEEDDQLIBNBAUcNKwwqCyASKAIAQQJGBEAgAkEAOgBqIAJBATsBaCACQQA7AVwgAkEANgJAIBtCADcBACACQQA2AkggAkGEp8IANgJEIBlBADYCACAbQQhqQQA6AAALIAIoAgAgCEYEfyACIAgQpQEgBCgCAAUgCAsgBSgCAGogAzoAACAEIAQoAgBBAWo2AgAgA0EERgRAIAJCg4CAgDA3AjRBACEEDDMLIAZBMGpB1J3CAEEiEMoBIAYoAjQhESAGKAIwDCsLIBNFDScgBkEgakG3nMIAQSMQygEgBigCJCERIAYoAiAMKgsACyASKAIAQQJGBEAgAkEAOgBqIAJBATsBaCACQQA7AVwgAkEANgJAIBtCADcBACACQQA2AkggAkGEp8IANgJEIBlBADYCACAbQQhqQQA6AAALIAJBAzoANiACIAM6ADUgAkEBOgA0QQQhBEEsIRcMLwsgAiADOgA1IAJBBzoANEEEIQRBISEXDC4LIAJBDToANEEAIQdBBCEEQTshFwwtCyACLQBzDSMgBkEYakHanMIAQR4QygEgBigCHCERIAYoAhgMJQsgDkUNICAOIAwgDCAOSxsiByACKAIoIB0oAgAiBGtLBEAgCyAEIAcQowEgHSgCACEECyAgKAIAIARqIBQgBxDBAxogAiAOIAdrNgI4IAJBBDoANCAdIAQgB2o2AgBBACEEDCsLQQIhBCACQQI2AjggAkEDOgA0IAMhFwwqCyACIA02AjggAkEEOgA0QQAhBAwpCyACQQhqIgcoAgAiBSACKAIARgR/IAIgBRClASAHKAIABSAFCyACQQRqKAIAaiADOgAAIAcgBygCAEEBajYCACACKAJAIQUgA0EBcQ0CIAVBAkcNAwwvCyACQQhqIggoAgAiBSACKAIARgR/IAIgBRClASAIKAIABSAFCyACQQRqKAIAaiADOgAAIAggCCgCAEEBajYCACACKAJAQQJGIgUNLkEAIBIgBRsiBS0AJgRAIAVBJ2ogAzoAAAtBACEEIAJBADYCOCACQQg6ADQMJwsgEigCAEECRg0tIAIgA0EGdkEBcToAaiACLQBxRQ0aIAIvAW4hDQJAAkBBfyACLwFsIgogAi8BYiIESSIIIAQgCksbIgUEQCAFQf8BcUH/AUcNAQwCCyAIDQAgAi8BYCAKIARrQf//A3FLDQELQX8gAi8BZCIEIA1LIgggBCANSxsiBQRAIAVB/wFxQf8BRw0cDAELIAgNGyAbLwEAIA0gBGtB//8DcU0NGwsgBkEQakGIncIAQSEQygEgBigCFCERIAYoAhAMHwsgBUECRg0sIAJBATsBZgsgAkGCBDsBNEEBIQcgAiADQf8BcSIFQQF2QQFxOgBpQQAhBCACQQAgBUECdkEHcSADQRBxGzoAaAwkC0EAIQRBACEHIANBAEgEQCMAQSBrIgokAAJAQQMgA0EHcUEBanQiByALKAIAIgUgCygCCCIDa00NAAJAIAMgAyAHaiIISw0AIAhBf3NBH3YhAwJAIAUEQCAKQQE2AhggCiAFNgIUIAogC0EEaigCADYCEAwBCyAKQQA2AhgLIAogCCADIApBEGoQsgEgCigCBCEFIAooAgBFBEAgCyAINgIAIAtBBGogBTYCAAwCCyAKQQhqKAIAIgNBgYCAgHhGDQEgA0UNACAFIAMQuwMACxCVAgALIApBIGokAAsgAiAHNgI8QQEhByACQQE2AjggAkEDOgA0DCMLIAJBggI7ATQgAiANOwFsQQAhBAwiC0EAIQQgAkEANgI4IAJBAzoANCACIA07AW4MIQsgAkEIaiIEKAIAIgUgAigCAEYEfyACIAUQpQEgBCgCAAUgBQsgAkEEaiIFKAIAaiATOgAAIAQgBCgCAEEBaiIINgIAIAIoAgAgCEYEfyACIAgQpQEgBCgCAAUgCAsgBSgCAGogAzoAACAEIAQoAgBBAWo2AgAgAigCQEECRw0EDCcLIBIoAgBBAkYNJiACQQQ2AjggAkEDOgA0IAIgDTsBZEEAIQQMHwsgEigCAEECRg0lIAJBggw7ATQgAiANOwFiQQAhBAweCyASKAIAQQJGDSQgAkGCCjsBNCACIA07AV5BACEEDB0LIBIoAgBBAkYNIyACQYIIOwE0IAIgDTsBYEEAIQQMHAsgAkEFNgI4IAJBAzoANCACIA07AVxBACEEDBsLIAItADchBSAGIA47AIMBICQgDkEQdiIHOgAAIAYgBToAggEgBiAKOgCBASAGIBM6AIABIA1BBkkNAiAGLwGAASAGLQCCAUEQdHJBx5KZAkcEQEEUQQEQ/QIiA0UNDCADQRBqQdCdwgAoAAA2AAAgA0EIakHIncIAKQAANwAAIANBwJ3CACkAADcAAEEMQQQQ/QIiEEUNDSAQQRQ2AgggECADNgIEIBBBFDYCAEEKIQRBACEJQaCjwgAhESAIDBcLIA5B/wFxQThHDQ0CQAJAAkAgDkEIdkH/AXFBN2sOAwAQARALQQAhBSAHQf8BcUHhAEYNAQwPC0EBIQUgB0H/AXFB4QBHDQ4LQQAhBCACQQA6ADYgAiADOgA1IAJBAToANCACIAU6AHRBAQwWCyACIBM6ADYgAiADOgA1IAJBAToANEEAIQQMGQsgBkE4akHYm8IAQRkQygEgBigCPCERIAYoAjgMEQsgBkGAAWogDWogAzoAAEEAIQQgAkEAOgA0IAIgDUEBajYCPCAhIAYoAoABNgAAICFBBGogBkGEAWovAQA7AABBAQwTC0HQmsIAQStBjJvCABCHAgALQdCawgBBK0H8msIAEIcCAAtBACEQIAJBADYCOCACQQs6ADRBCCEEQZiXwgAhCQwUCyAFQQEQuwMAC0HQmsIAQStByJvCABCHAgALIAdBARC7AwALQdCawgBBK0GEnMIAEIcCAAsgAiADOgA1IAJBCjoANEEAIQQMDwtBFEEBELsDAAtBDEEEELsDAAsgBkGpncIAQRcQygEgBigCBCERIAYoAgAMBQsgA0EATgRAIAJBBjYCOCACQQM6ADRBACEEDAwLIAZBCGohBQJAQQMgA0EHcUEBanQiCkUEQEEBIQQMAQsgCkEATgRAIAogCkF/c0EfdiIDEP0CIgQNASAKIAMQuwMACxCVAgALIAUgBDYCBCAFIAo2AgAgEigCAEECRwRAIAYoAgwhCCAGKAIIIQUCQCAZKAIAIgNFDQAgAigCUEUNACADEDoLQQAhBCACQQA2AlggAiAFNgJQIAIgCjYCOCACQQk6ADQgGSAINgIADAwLDBILICAoAgAhEAJAAkACQCACLQAYQQNsIgcgHSgCACIRSQRAIBEgB0EDaiIFIAUgEUsbIgUgB08NASAHIAVBkJjCABCXAwALIB9BADoAAAwBCyAFIAdrIgVBAk0NASAfIAcgEGoiBS8AADsAACAfQQJqIAVBAmotAAA6AAALQSAhBwJAAkAgD0Ehaw4bAAEBAQEBAQEBAQEAAQEBAQEBAQEBAQEBAQEAAQsgAyEHCyACIAc6ADUgAkEFOgA0IAIoAighCSACQQA2AiggIEIBNwIAQQEhBEEBIQcMCwtBAyAFQficwgAQlgMAC0EgIQQCQAJAAkAgD0Ehaw4bAAEBAQEBAQEBAQEAAQEBAQEBAQEBAQEBAQECAQsgAyEECyACIAQ6ADUgAkEFOgA0QQAhBAwKCyACQYX2ADsBNEEAIQRBACEHDAkLIAIgDzYCOCACQQg6ADRBACEEDAgLIAZBKGpBlJzCAEEjEMoBIAYoAiwhESAGKAIoCyEQQQAhCQwFC0EGIQQgAkEGOwE0IAJBAToADSACQQRqKAIAIQkgAkEIaigCACEQIAItAAwhFwwFCyAGQdgAaiAcQQAgAxtBmJfCAEEAAn8gBEUEQCAGQdAAakIANwMAIAZCADcDSEEQIQcgIgwBCyAYKAIACyAHEOMCAkACQAJAAkACQAJAIAYtAGBBAWsOAwIBAAELIAZB1wE2AnwgBiAGQZgBajYCeCAGQQE2ApQBIAZBATYCjAEgBkHImsIANgKIASAGQQA2AoABIAYgBkH4AGo2ApABIAZB6ABqIAZBgAFqIgMQXyADIAYoAmwiAyAGKAJwEMsBIAYoAoQBIREgBigCgAEhECAGKAJoRQ0EIAMQOgwECyAGKAJcIgMgBCADIARJGyIDIBooAgAiBUsNAiADDQEgEhD0ASACQQw6ADQgAkECNgJAQQkhBEEAIQcMCAsgAi0AckUEQCASEPQBIAJBDDoANCACQQI2AkBBCSEEQQAMBAsgBkGAAWpBnJvCAEEZEMsBIAYoAoQBIREgBigCgAEhEAwCCyAYKAIAIQkgAkEANgI4IAJBCzoANEEIIQRBACEHIAMhEAwGCyADIAVBuJvCABCWAwALQQohBEEBIQkgCAshByAEQQpGDQIMAwtB0JrCAEErQYybwgAQhwIACyAGQdgAaiADIBQgBwJ/IAlFBEAgBkHQAGpCADcDACAGQgA3A0hBECEFICIMAQsgGCgCAAsgBRDjAiAGLQBgQQNGBEAgBkHXATYCfCAGIAZBmAFqNgJ4QQEhCSAGQQE2ApQBIAZBATYCjAEgBkHImsIANgKIASAGQQA2AoABIAYgBkH4AGo2ApABIAZB6ABqIAZBgAFqIgMQXyADIAYoAmwiAyAGKAJwEMsBIAYoAoQBIREgBigCgAEhECAGKAJoRQ0BIAMQOgwBCyAGKAJcIgMgCSADIAlJGyIQIBooAgAiA0sNAiACQQs6ADQgAiAOIAYoAlgiB2s2AjggGCgCACEJQQghBAwBCyAVIAk2AgggFUEKOgAEIBVBEGogETYCACAVQQxqIBA2AgAMBgsCQAJAIAQEQCAEQQNGDQEgByAMSw0FIBUgETYCECAVIBA2AgwgFSAJNgIIIBUgFzoABSAVIAQ6AAQgFSAeIAxrIAdqNgIADAgLIAcgDE0NASAHIAxBmJrCABCVAwALIAcgDEsNBCAMIAdrIQwMBQsgDCAHayIMRQ0EIAcgFGohFCAMRSEEIAchCCACLQA0IgVBDkcNAQwECwsgECADQbiawgAQlgMACyAHIAxB+JnCABCVAwALIAcgDEGImsIAEJUDAAsgFUEAOgAEIBUgHiAMazYCAAsgBkGgAWokAAwBC0HQmsIAQStB9JvCABCHAgALIBYtAAwiCEEKRwRAIBYoAhghByAWKAIUIQkgFigCECEXIBYvAQ4hBSAWLQANIQsgASABKAIYIBYoAghqIhQgASgCHCIDIAMgFEsbNgIYAkAgCA4FBQgICAAICyALQTtHDQcgAUEBOgCgAQwECyAWKQMQISYgAEEMaiAWKAIYNgIAIAAgJjcCBCAAQQs6AAAMBwsgAyALQaStwAAQlQMAC0EOQQEQuwMAC0EMQQQQuwMACyAXRSAIQQFHckUEQCAJEDoLIAEtAKABRQ0ACwsgAEEKOgAADAELIAAgBzYCDCAAIAk2AgggACAXNgIEIAAgBTsBAiAAIAs6AAEgACAIOgAACyAWQSBqJAALjgQCBX8BfiMAQfAEayICJAACQAJAIAFBQGsoAgBBAkcEQCACQRhqIAFBEGoQrQMgAkEIaiACNQIYIAI1Ahx+IAEtAIAEEPMCrUL/AYMQyAFCfyACKQMIIAIpAxBCAFIbIgdCgICAgAhUBEBBAiEDAkAgB6ciBEECSQ0AIARBfnEiBUECEP4CIgMNACAFQQIQuwMACyACQegAaiIGIAFBiAQQwQMaIAJBQGsgBiADIAUQUSACKAJAIgFBBkcNAiAAIARBAXYiATYCBCAAQQY2AgAgAEEMaiABNgIAIABBCGogAzYCAAwDCyACQgM3A0AgAkEgaiACQUBrEJYCIAJBhAFqIAJBOGopAwA3AgAgAkH8AGogAkEwaikDADcCACACQfQAaiACQShqKQMANwIAIAIgAikDIDcCbCAAQQM2AgAgACACKQJoNwIEIABBDGogAkHwAGopAgA3AgAgAEEUaiACQfgAaikCADcCACAAQRxqIAJBgAFqKQIANwIAIABBJGogAkGIAWooAgA2AgAgARBLDAILQfCbwABBK0HQnsAAEIcCAAsgACACKQJENwIEIABBJGogAkHkAGooAgA2AgAgAEEcaiACQdwAaikCADcCACAAQRRqIAJB1ABqKQIANwIAIABBDGogAkHMAGopAgA3AgAgACABNgIAIARBAkkNACADEDoLIAJB8ARqJAALjgQCBX8BfiMAQfAEayICJAACQAJAIAFBQGsoAgBBAkcEQCACQRhqIAFBEGoQrQMgAkEIaiACNQIYIAI1Ahx+IAEtAIAEEPMCrUL/AYMQyAFCfyACKQMIIAIpAxBCAFIbIgdCgICAgAhUBEBBBCEDAkAgB6ciBEEESQ0AIARBfHEiBUEEEP4CIgMNACAFQQQQuwMACyACQegAaiIGIAFBiAQQwQMaIAJBQGsgBiADIAUQUSACKAJAIgFBBkcNAiAAIARBAnYiATYCBCAAQQY2AgAgAEEMaiABNgIAIABBCGogAzYCAAwDCyACQgM3A0AgAkEgaiACQUBrEJYCIAJBhAFqIAJBOGopAwA3AgAgAkH8AGogAkEwaikDADcCACACQfQAaiACQShqKQMANwIAIAIgAikDIDcCbCAAQQM2AgAgACACKQJoNwIEIABBDGogAkHwAGopAgA3AgAgAEEUaiACQfgAaikCADcCACAAQRxqIAJBgAFqKQIANwIAIABBJGogAkGIAWooAgA2AgAgARBLDAILQfCbwABBK0HQnsAAEIcCAAsgACACKQJENwIEIABBJGogAkHkAGooAgA2AgAgAEEcaiACQdwAaikCADcCACAAQRRqIAJB1ABqKQIANwIAIABBDGogAkHMAGopAgA3AgAgACABNgIAIARBBEkNACADEDoLIAJB8ARqJAAL2AQBBH8gACABEM0DIQICQAJAAkAgABC4Aw0AIAAoAgAhAwJAIAAQkANFBEAgASADaiEBIAAgAxDOAyIAQYiYwwAoAgBHDQEgAigCBEEDcUEDRw0CQYCYwwAgATYCACAAIAEgAhC+Ag8LIAEgA2pBEGohAAwCCyADQYACTwRAIAAQggEMAQsgAEEMaigCACIEIABBCGooAgAiBUcEQCAFIAQ2AgwgBCAFNgIIDAELQfiXwwBB+JfDACgCAEF+IANBA3Z3cTYCAAsgAhCJAwRAIAAgASACEL4CDAILAkBBjJjDACgCACACRwRAIAJBiJjDACgCAEcNAUGImMMAIAA2AgBBgJjDAEGAmMMAKAIAIAFqIgE2AgAgACABEOwCDwtBjJjDACAANgIAQYSYwwBBhJjDACgCACABaiIBNgIAIAAgAUEBcjYCBCAAQYiYwwAoAgBHDQFBgJjDAEEANgIAQYiYwwBBADYCAA8LIAIQtwMiAyABaiEBAkAgA0GAAk8EQCACEIIBDAELIAJBDGooAgAiBCACQQhqKAIAIgJHBEAgAiAENgIMIAQgAjYCCAwBC0H4l8MAQfiXwwAoAgBBfiADQQN2d3E2AgALIAAgARDsAiAAQYiYwwAoAgBHDQFBgJjDACABNgIACw8LIAFBgAJPBEAgACABEIYBDwsgAUF4cUHwlcMAaiECAn9B+JfDACgCACIDQQEgAUEDdnQiAXEEQCACKAIIDAELQfiXwwAgASADcjYCACACCyEBIAIgADYCCCABIAA2AgwgACACNgIMIAAgATYCCAuHBAIEfwF+IwBB8ARrIgIkAAJAAkACQCABQUBrKAIAQQJHBEAgAkEYaiABQRBqEK0DIAJBCGogAjUCGCACNQIcfiABLQCABBDzAq1C/wGDEMgBQn8gAikDCCACKQMQQgBSGyIGQoCAgIAIVARAAkAgBqciA0UEQEEBIQQMAQsgA0EBEP4CIgRFDQMLIAJB6ABqIgUgAUGIBBDBAxogAkFAayAFIAQgAxBRIAIoAkAiAUEGRw0DIAAgAzYCBCAAQQY2AgAgAEEMaiADNgIAIABBCGogBDYCAAwECyACQgM3A0AgAkEgaiACQUBrEJYCIAJBhAFqIAJBOGopAwA3AgAgAkH8AGogAkEwaikDADcCACACQfQAaiACQShqKQMANwIAIAIgAikDIDcCbCAAQQM2AgAgACACKQJoNwIEIABBDGogAkHwAGopAgA3AgAgAEEUaiACQfgAaikCADcCACAAQRxqIAJBgAFqKQIANwIAIABBJGogAkGIAWooAgA2AgAgARBLDAMLQfCbwABBK0HQnsAAEIcCAAsgA0EBELsDAAsgACACKQJENwIEIABBJGogAkHkAGooAgA2AgAgAEEcaiACQdwAaikCADcCACAAQRRqIAJB1ABqKQIANwIAIABBDGogAkHMAGopAgA3AgAgACABNgIAIANFDQAgBBA6CyACQfAEaiQAC/gDAQJ/AkACQAJAAkACQAJAAkAgACgCAA4FAQIDBQQACyAALQAEQQNHDQQgAEEIaigCACIBKAIAIAEoAgQoAgARAwAgASgCBCICQQRqKAIABEAgAkEIaigCABogASgCABA6CyAAKAIIEDoPCwJAIAAtAARBAWtBAUsNACAAQQhqKAIARQ0AIABBDGooAgAQOgsgAEEUaigCACIBRQ0DIAEgAEEYaiIBKAIAKAIAEQMAIAEoAgAiAUEEaigCAEUNAwwECwJAIAAtAARBAWtBAUsNACAAQQhqKAIARQ0AIABBDGooAgAQOgsgAEEUaigCACIBRQ0CIAEgAEEYaiIBKAIAKAIAEQMAIAEoAgAiAUEEaigCAEUNAgwDCwJAIAAoAgRBAkcNACAAQQhqKAIARQ0AIABBDGooAgAQOgsgAEEUaigCACIBRQ0BIAEgAEEYaiIBKAIAKAIAEQMAIAEoAgAiAUEEaigCAEUNASABQQhqKAIAGiAAKAIUEDoMAQsCQCAAQRRqLQAAQQFrQQFLDQAgAEEYaigCAEUNACAAQRxqKAIAEDoLAkACQEEBIAAtAAQiAUEEayABQQNNG0H/AXEOAgIAAQsgAUEBa0ECTw0BCyAAQQhqKAIARQ0AIABBDGooAgAQOgsPCyABQQhqKAIAGiAAKAIUEDoL4AMBCX8gAEEoaigCACIGIAJB/wFxIghLBEAgAEEkaigCACAIQQJ0aigCACIGQQFrQQAgBhshAgJAIAYgACgCBCINSSIFIAJyRQ0AIARB/wFxIQQgA0H/AXEhCiABQf8BcSELIABBGGooAgAhDCAAQRxqKAIAIQFBgICAgAQhAANAAkAgBUUNAAJAIAEgBksEQCAMIAZBBHRqIgMoAgQgCGsiBSAFbCIFIABODQQgBSADKAIIIAtrIgUgBWxqIgUgAE4NASAFIAMoAgAgCmsiCSAJbGoiBSAATg0BIAUgAygCDCAEayIDIANsaiIDIAAgACADSiIDGyEAIAYgByADGyEHIAZBAWohBgwCCyAGIAFBwLHCABDNAQALIAZBAWohBgsCf0EAIAJFDQAaAkAgASACSwRAIAwgAkEEdGoiAygCBCAIayIFIAVsIgUgAE4NBCAFIAMoAgggC2siBSAFbGoiBSAATg0BIAUgAygCACAKayIJIAlsaiIFIABODQEgBSADKAIMIARrIgMgA2xqIgMgACAAIANKIgMbIQAgAiAHIAMbIQcgAkEBawwCCyACIAFB0LHCABDNAQALIAJBAWsLIgIgBiANSSIFcg0ACwsgBw8LIAggBkGwscIAEM0BAAv8CAMXfwN9An4jAEEwayIDJAAgACgCACERAkACQAJAIABBCGooAgAoAgBBfwJ/IAAoAgQiCCoCCCIZQwAAgE9dIBlDAAAAAGAiBXEEQCAZqQwBC0EAC0EAIAUbIBlD//9/T14bIAFqSQ0AIAggAEEQaigCACoCACIaQwAAAD6UIhkgAEEMaigCACoCACAaENIDIhtfBH8gGSEaA0AgBEEBaiEEIBkgGpIiGiAbXw0ACyAEQQdxBUEACyARakEHcSIENgIMIAggCCoCBCAEQQJ0QbCZwABqKgIAlDgCACAAQRRqKAIAEMcDIQQCfyAIKgIIIhlDAACAT10gGUMAAAAAYCIFcQRAIBmpDAELQQALIQkgAEEYaigCACgCACIKIAQoAgBLDQEgBDUCBCABrSIcQX8gCUEAIAUbIBlD//9/T14bIgWtfFQNAiADIAQ2AiggAyAFNgIkIAMgCjYCICADIAE2AhwgA0EANgIYIwBBQGoiAiQAAkACQCADQRhqIgEoAggiBEH/////A3EgBEcNACAEQQJ0rSABKAIMIgytfiIdQiCIpw0AAkACQAJAIB2nIgZFBEBBASENDAELIAZBAE4iBUUNAiAGIAUQ/gIiDUUNAQsgAyAGNgIIIAMgDDYCBCADIAQ2AgAgA0EQaiAGNgIAIANBDGogDTYCACAMRSAERXJFBEAgBEECdCETIAEoAgAhFCABKAIQIg5BDGohFSAOQRBqIRYgASgCBCIXIQ9BBCEJA0AgECAXaiESIBBBAWohECAEIQogFCEFIAkhAQJAAkACQAJAAkADQCAOKAIAIgcgBU0gDigCBCILIBJNckUEQCAFIAcgD2xqQQJ0IgtBBGohByALQXxGDQIgByAWKAIAIhhLDQMgAUUNBCABIAZLDQUgASANakEEayAVKAIAIAtqKAAANgAAIAVBAWohBSABQQRqIQEgCkEBayIKDQEMBgsLIAJBLGpBBzYCACACQRRqQQI2AgAgAkEcakECNgIAIAIgEjYCNCACIAU2AjAgAkGAiMAANgIQIAJBADYCCCACQQc2AiQgAiALNgI8IAIgBzYCOCACIAJBIGo2AhggAiACQThqNgIoIAIgAkEwajYCICACQQhqQfyIwAAQoQIAC0F8IAdB7IjAABCXAwALIAcgGEHsiMAAEJYDAAtBfCABQbiKwAAQlwMACyABIAZBuIrAABCWAwALIA9BAWohDyAJIBNqIQkgDCAQRw0ACwsgAkFAayQADAMLIAYgBRC7AwALEJUCAAtBjInAAEEzQcCJwAAQmQMACyAIKgIAIhlDAAAA32AhASAAQRxqKAIAIANC////////////AAJ+IBmLQwAAAF9dBEAgGa4MAQtCgICAgICAgICAfwtCgICAgICAgICAfyABGyAZQ////15eG0IAIBkgGVsbIBwQPyADKAIIRQ0AIANBDGooAgAQOgsgACARQQFqNgIAIANBMGokAA8LQfmEwABBwABBlIbAABCHAgALQaSGwABBwgBB6IbAABCHAgALhwQBCH8gASgCBCIFBEAgASgCACEEA0ACQCADQQFqIQICfyACIAMgBGotAAAiCMAiCUEATg0AGgJAAkACQAJAAkACQAJAIAhB1PfCAGotAABBAmsOAwABAggLQajvwgAgAiAEaiACIAVPGy0AAEHAAXFBgAFHDQcgA0ECagwGC0Go78IAIAIgBGogAiAFTxssAAAhByAIQeABayIGRQ0BIAZBDUYNAgwDC0Go78IAIAIgBGogAiAFTxssAAAhBgJAAkACQAJAIAhB8AFrDgUBAAAAAgALIAlBD2pB/wFxQQJLIAZBQE5yDQgMAgsgBkHwAGpB/wFxQTBPDQcMAQsgBkGPf0oNBgtBqO/CACAEIANBAmoiAmogAiAFTxstAABBwAFxQYABRw0FQajvwgAgBCADQQNqIgJqIAIgBU8bLQAAQcABcUGAAUcNBSADQQRqDAQLIAdBYHFBoH9HDQQMAgsgB0Ggf04NAwwBCyAJQR9qQf8BcUEMTwRAIAlBfnFBbkcgB0FATnINAwwBCyAHQb9/Sg0CC0Go78IAIAQgA0ECaiICaiACIAVPGy0AAEHAAXFBgAFHDQEgA0EDagsiAyICIAVJDQELCyAAIAM2AgQgACAENgIAIAEgBSACazYCBCABIAIgBGo2AgAgACACIANrNgIMIAAgAyAEajYCCA8LIABBADYCAAvdAwIEfwF9IwBBMGsiBCQAIABDAAAAQRA3AkAgAEEIaigCAEUNACAEQRBqIABBBGoiAygCABClAyAEQQhqIAQoAhAgBCgCFBCBAyAEQRhqIAMoAgAgAEEIaiIFKAIAQX8Cf0MAALRDIAQoAgizIAQoAgyzlEMAACBBlUMAALRDlCABQwAASEOUQwAAAD6UlSIHlY4iAUMAAIBPXSABQwAAAABgIgZxBEAgAakMAQtBAAtBACAGGyABQ///f09eGxBJIAUoAgAiBQRAIAVBJGwhBSADKAIAQRxqIQMDQCADQQRrKAIABEAgAygCABA6CyADQSRqIQMgBUEkayIFDQALCyAAKAIABEAgAEEEaigCABA6CyAAIAQpAxg3AgAgAEEIaiIDIARBIGoiBigCADYCACADKAIAIgNFDQAgB4wgByACGyEBIABBBGooAgAhBSADQSRsIQBBACEDA0AgASADs5RDAAC0QxDSAyEHIARBGGogBRDHAyAHQzX6jjyUECcgBRDHAyICKAIIBEAgAkEMaigCABA6CyAFQSRqIQUgAiAEKQMYNwIAIAJBEGogBEEoaigCADYCACACQQhqIAYpAwA3AgAgA0EBaiEDIABBJGsiAA0ACwsgBEEwaiQAC+0DAQZ/IwBBMGsiBSQAAkACQAJAAkACQCABQQxqKAIAIgMEQCABKAIIIQcgA0EBa0H/////AXEiA0EBaiIGQQdxIQQCfyADQQdJBEBBACEDIAcMAQsgB0E8aiECIAZB+P///wNxIQZBACEDA0AgAigCACACQQhrKAIAIAJBEGsoAgAgAkEYaygCACACQSBrKAIAIAJBKGsoAgAgAkEwaygCACACQThrKAIAIANqampqampqaiEDIAJBQGshAiAGQQhrIgYNAAsgAkE8awshAiAEBEAgAkEEaiECA0AgAigCACADaiEDIAJBCGohAiAEQQFrIgQNAAsLIAFBFGooAgANASADIQQMAwtBACEDIAFBFGooAgANAUEBIQIMBAsgA0EPSw0AIAcoAgRFDQILIAMgA2oiBCADSQ0BCyAERQ0AAkAgBEEATgRAIARBARD9AiICRQ0BIAQhAwwDCxCVAgALIARBARC7AwALQQEhAkEAIQMLIABBADYCCCAAIAI2AgQgACADNgIAIAUgADYCDCAFQSBqIAFBEGopAgA3AwAgBUEYaiABQQhqKQIANwMAIAUgASkCADcDECAFQQxqQezTwgAgBUEQahBPBEBBzNTCAEEzIAVBKGpBgNXCAEGo1cIAEMYBAAsgBUEwaiQAC8UFAgZ/AXwjAEHQAGsiAyQAAkAgACgCACIFQYEBEAQEQEEHIQZBACEADAELAkACQAJAIAUQBQ4CAgEACyADQRBqIAUQBiADKAIQBEBBAyEGIAMrAxghCUEAIQAMAwsgA0EIaiAFEAICfyADKAIIIgUEQCADKAIMIQQgAyAFNgIkIAMgBDYCKCADIAQ2AiBBASEAQQUhBkEADAELAn8CQAJAIAAoAgAQGkUEQCAAKAIAEBRFDQIgAyAAKAIAEBc2AiAgA0E4aiADQSBqEL4BIAMoAkAhBCADKAI8IQUgAygCOCEHIAMoAiAiBkGEAUkNASAGEAAMAQsgA0E4aiAAEL4BIAMoAkAhBCADKAI8IQUgAygCOCEHCyAFRQ0AQQYhBkEADAELIANBwQA2AjQgAyAANgIwIANBATYCTCADQQE2AkQgA0HQtsAANgJAIANBADYCOCADIANBMGo2AkggA0EgaiADQThqEF9BESEGIAMoAighBCADKAIkIQVBAQsiAEEBcwshCCAErb8hCQwCC0EBIQQLQQAhAAsgAyAJOQNAIAMgBTYCPCADIAQ6ADkgAyAGOgA4IwBBMGsiBCQAIAQgAjYCBCAEIAE2AgAgBEEUakHGADYCACAEQccANgIMIAQgA0E4ajYCCCAEIAQ2AhAgBEECNgIsIARBAjYCJCAEQci4wAA2AiAgBEEANgIYIAQgBEEIajYCKAJ/IwBBQGoiASQAIAFBADYCCCABQoCAgIAQNwMAIAFBEGoiAiABQfC2wAAQugIgBEEYaiACEOYBRQRAIAEoAgQgASgCCBABIAEoAgAEQCABKAIEEDoLIAFBQGskAAwBC0GIt8AAQTcgAUE4akHAt8AAQZy4wAAQxgEACyAEQTBqJAAgCEUgB0VyRQRAIAUQOgsCQCAARQ0AIAMoAiBFDQAgBRA6CyADQdAAaiQAC/8CAQJ/IABBFGooAgAEQCAAQRBqKAIAEDoLAkAgAEE4aigCACIBRQ0AIAEgAEE8aiIBKAIAKAIAEQMAIAEoAgAiAUEEaigCAEUNACABQQhqKAIAGiAAKAI4EDoLIABBxABqKAIABEAgAEHIAGooAgAQOgsgAEHQAGooAgAEQCAAQdQAaigCABA6CyAAKAIoBEAgAEEsaigCABA6CwJAIABB6ABqKAIAIgFBAkYNAAJAIABB/ABqKAIAIgJFDQAgAEH4AGooAgBFDQAgAhA6IAAoAmghAQsgAUUNACAAQewAaigCAEUNACAAQfAAaigCABA6CwJAIABBsAFqKAIAIgFFDQAgACgCrAFFDQAgARA6CwJAIABB2AFqKAIAIgFFDQAgAEHUAWooAgBFDQAgARA6CwJAIAAoAsQBRQ0AIABByAFqKAIARQ0AIABBzAFqKAIAEDoLIAAoArgBBEAgAEG8AWooAgAQOgsgAEGIAmooAgAEQCAAQYwCaigCABA6CwuTAwELfyMAQTBrIgMkACADQoGAgICgATcDICADIAI2AhwgA0EANgIYIAMgAjYCFCADIAE2AhAgAyACNgIMIANBADYCCCAAKAIEIQggACgCACEJIAAoAgghCgJ/A0ACQCAGRQRAAkAgAiAESQ0AA0AgASAEaiEGAn8gAiAEayIFQQhPBEAgA0EKIAYgBRB+IAMoAgQhACADKAIADAELQQAhAEEAIAVFDQAaA0BBASAAIAZqLQAAQQpGDQEaIAUgAEEBaiIARw0ACyAFIQBBAAtBAUcEQCACIQQMAgsgACAEaiIAQQFqIQQCQCAAIAJPDQAgACABai0AAEEKRw0AQQAhBiAEIQUgBCEADAQLIAIgBE8NAAsLQQEhBiACIgAgByIFRw0BC0EADAILAkAgCi0AAARAIAlBiPLCAEEEIAgoAgwRAgANAQsgASAHaiELIAAgB2shDCAKIAAgB0cEfyALIAxqQQFrLQAAQQpGBSANCzoAACAFIQcgCSALIAwgCCgCDBECAEUNAQsLQQELIANBMGokAAvOAwECfyMAQeAAayICJAACQAJAAkACQAJAAkACQEEBIAEtAAAiA0EfayADQR5NG0H/AXFBAWsOAwECAwALIABBBTYCACAAIAEpAgQ3AgQMAwsgAEEAOwEEQRRBBBD9AiIDRQ0DIABBADYCACADIAEpAgA3AgAgAEEYakGAwcAANgIAIABBFGogAzYCACADQRBqIAFBEGooAgA2AgAgA0EIaiABQQhqKQIANwIADAILIAJBGGogAUEQaigCADYCACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBADYCKCACQoCAgIAQNwMgIAJBMGoiASACQSBqQazDwAAQugIgAkEIaiABEHINAyAAQQhqIAIpAyA3AgAgAEEQaiACQShqKAIANgIAIABBFGpBADYCACAAQoKAgIAgNwMAIAItAAhBH0cNASACLQAMQQNHDQEgAkEQaigCACIAKAIAIAAoAgQoAgARAwAgACgCBCIBQQRqKAIABEAgAUEIaigCABogACgCABA6CyACKAIQEDoMAQsgAEEDNgIAIABCAzcDCAsgAkHgAGokAA8LQRRBBBC7AwALQcTDwABBNyACQdgAakH8w8AAQdjEwAAQxgEAC8AEAQN/IwBBMGsiAiQAAn8CQAJAAkACQCAAKAIEIgMOAwACAwELIwBBEGsiACQAIABBnL3AADYCCCAAQQ42AgQgAEGOvcAANgIAIwBBEGsiASQAIAFBCGogAEEIaigCADYCACABIAApAgA3AwAjAEEQayIAJAAgACABKQIANwMIIABBCGpBtL3AAEEAIAEoAghBARCsAQALIAJBJGpBATYCACACQSxqQQA2AgAgAkHwu8AANgIgIAJBjLnAADYCKCACQQA2AhhBASABIAJBGGoQ6AENAhogA0EDdCEDIAAoAgAhAAJAA0AgAiAANgIUIAQEQCACQQE2AiQgAkH8u8AANgIgIAJBADYCLCACQYy5wAA2AiggAkEANgIYIAEgAkEYahDoAQ0CCyACQQI2AiQgAkGEvMAANgIgIAJBATYCLCACQQA2AhggAkHfADYCBCACIAI2AiggAiACQRRqNgIAIAEgAkEYahDoAQ0BIABBCGohACAEQQFrIQQgA0EIayIDDQALQQAMAwtBAQwCCyACQSRqQQI2AgAgAkEsakEBNgIAIAJBhLzAADYCICACQQA2AhggAkHgADYCBCACIAAoAgA2AgAgAiACNgIoIAEgAkEYahDoAQwBCyACQQxqQeAANgIAIAJBJGpBAzYCACACQSxqQQI2AgAgAkGcvMAANgIgIAJBADYCGCACQeAANgIEIAIgACgCACIANgIAIAIgAEEIajYCCCACIAI2AiggASACQRhqEOgBCyACQTBqJAAL1QMC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BCADQRBqELIBIAMoAgQhAiADKAIARQRAIAAgATYCACAAQQRqIAI2AgAMAgsgA0EIaigCACIAQYGAgIB4Rg0BIABFDQAgAiAAELsDAAsQlQIACyADQSBqJAALzwEBAn8jAEEgayIDJAACQAJAIAEgASACaiIBSw0AQQggACgCACICQQF0IgQgASABIARJGyIBIAFBCE0bIgFBf3NBH3YhBAJAIAIEQCADQQE2AhggAyACNgIUIAMgAEEEaigCADYCEAwBCyADQQA2AhgLIAMgASAEIANBEGoQrgEgAygCBCECIAMoAgBFBEAgACABNgIAIABBBGogAjYCAAwCCyADQQhqKAIAIgBBgYCAgHhGDQEgAEUNACACIAAQuwMACxCVAgALIANBIGokAAvNAQEDfyMAQSBrIgIkAAJAAkAgAUEBaiIBRQ0AQQggACgCACIDQQF0IgQgASABIARJGyIBIAFBCE0bIgFBf3NBH3YhBAJAIAMEQCACQQE2AhggAiADNgIUIAIgAEEEaigCADYCEAwBCyACQQA2AhgLIAIgASAEIAJBEGoQsgEgAigCBCEDIAIoAgBFBEAgACABNgIAIABBBGogAzYCAAwCCyACQQhqKAIAIgBBgYCAgHhGDQEgAEUNACADIAAQuwMACxCVAgALIAJBIGokAAvNAQEDfyMAQSBrIgIkAAJAAkAgAUEBaiIBRQ0AQQggACgCACIDQQF0IgQgASABIARJGyIBIAFBCE0bIgFBf3NBH3YhBAJAIAMEQCACQQE2AhggAiADNgIUIAIgAEEEaigCADYCEAwBCyACQQA2AhgLIAIgASAEIAJBEGoQrgEgAigCBCEDIAIoAgBFBEAgACABNgIAIABBBGogAzYCAAwCCyACQQhqKAIAIgBBgYCAgHhGDQEgAEUNACADIAAQuwMACxCVAgALIAJBIGokAAvMAQECfyMAQSBrIgMkAAJAAkAgASABIAJqIgFLDQBBCCAAKAIAIgJBAXQiBCABIAEgBEkbIgEgAUEITRsiAUF/c0EfdiEEAkAgAgRAIANBATYCGCADIAI2AhQgAyAAQQRqKAIANgIQDAELIANBADYCGAsgAyABIAQgA0EQahCyASADKAIEIQIgAygCAEUEQCAAIAE2AgAgACACNgIEDAILIANBCGooAgAiAEGBgICAeEYNASAARQ0AIAIgABC7AwALEJUCAAsgA0EgaiQAC8wBAQJ/IwBBIGsiAyQAAkACQCABIAEgAmoiAUsNAEEIIAAoAgAiAkEBdCIEIAEgASAESRsiASABQQhNGyIBQX9zQR92IQQCQCACBEAgA0EBNgIYIAMgAjYCFCADIABBBGooAgA2AhAMAQsgA0EANgIYCyADIAEgBCADQRBqEK4BIAMoAgQhAiADKAIARQRAIAAgATYCACAAIAI2AgQMAgsgA0EIaigCACIAQYGAgIB4Rg0BIABFDQAgAiAAELsDAAsQlQIACyADQSBqJAAL0gEBAX8jAEEwayICJAACfyAAKAIAKAIAIgAoAgBFBEAgAiAAKAIENgIAIAIgACgCCDYCBCACQSRqQQI2AgAgAkEsakECNgIAIAJBFGpBODYCACACQaT0wAA2AiAgAkEANgIYIAJBODYCDCACIAJBCGo2AiggAiACQQRqNgIQIAIgAjYCCCABIAJBGGoQ6AEMAQsgAkEkakEBNgIAIAJBLGpBADYCACACQfzzwAA2AiAgAkHk8cAANgIoIAJBADYCGCABIAJBGGoQ6AELIAJBMGokAAvYAQEBfyMAQRBrIhMkACAAKAIAIAEgAiAAKAIEKAIMEQIAIQEgE0EAOgANIBMgAToADCATIAA2AgggE0EIaiADIAQgBSAGEHMgByAIIAkgChBzIAsgDCANIA4QcyAPIBAgESASEHMhAQJ/IBMtAAwiACATLQANRQ0AGiAAQf8BcSECQQEgAg0AGiABKAIAIgAtABhBBHFFBEAgACgCAEGX8sIAQQIgACgCBCgCDBECAAwBCyAAKAIAQZbywgBBASAAKAIEKAIMEQIACyATQRBqJABB/wFxQQBHC+cBAQF/IwBBEGsiAiQAIAIgADYCACACIABBBGo2AgQgASgCAEH5icMAQQkgASgCBCgCDBECACEAIAJBADoADSACIAA6AAwgAiABNgIIIAJBCGpBgorDAEELIAJB5InDABBzQY2KwwBBCSACQQRqQZiKwwAQcyEAAn8gAi0ADCIBIAItAA1FDQAaIAFB/wFxIQFBASABDQAaIAAoAgAiAC0AGEEEcUUEQCAAKAIAQZfywgBBAiAAKAIEKAIMEQIADAELIAAoAgBBlvLCAEEBIAAoAgQoAgwRAgALIAJBEGokAEH/AXFBAEcLiAIBAn8jAEEgayIFJABBwJTDAEHAlMMAKAIAIgZBAWo2AgACQAJAIAZBAEgNAEGkmMMAQaSYwwAoAgBBAWoiBjYCACAGQQJLDQAgBSAEOgAYIAUgAzYCFCAFIAI2AhAgBUGwx8IANgIMIAVB1L3CADYCCEGwlMMAKAIAIgJBAEgNAEGwlMMAIAJBAWoiAjYCAEGwlMMAQbiUwwAoAgAEfyAFIAAgASgCEBEBACAFIAUpAwA3AwhBuJTDACgCACAFQQhqQbyUwwAoAgAoAhQRAQBBsJTDACgCAAUgAgtBAWs2AgAgBkEBSw0AIAQNAQsACyMAQRBrIgIkACACIAE2AgwgAiAANgIIAAvUAQEBfyMAQRBrIgUkACAFIAAoAgAgASACIAAoAgQoAgwRAgA6AAggBSAANgIEIAUgAkU6AAkgBUEANgIAIAUgA0GI6sAAEIUBIARB+OnAABCFASEAAn8gBS0ACCIBIAAoAgAiAkUNABpBASABDQAaIAUoAgQhAAJAIAJBAUcNACAFLQAJRQ0AIAAtABhBBHENAEEBIAAoAgBBnPLCAEEBIAAoAgQoAgwRAgANARoLIAAoAgBBnO/CAEEBIAAoAgQoAgwRAgALIAVBEGokAEH/AXFBAEcLugEAAkAgAgRAAkACQAJ/AkACQCABQQBOBEAgAygCCA0BIAENAkEBIQIMBAsMBgsgAygCBCICRQRAIAFFBEBBASECDAQLIAFBARD9AgwCCyADKAIAIAJBASABEPECDAELIAFBARD9AgsiAkUNAQsgACACNgIEIABBCGogATYCACAAQQA2AgAPCyAAIAE2AgQgAEEIakEBNgIAIABBATYCAA8LIAAgATYCBAsgAEEIakEANgIAIABBATYCAAvPAQEBfyMAQRBrIgUkACAFIAAoAgAgASACIAAoAgQoAgwRAgA6AAggBSAANgIEIAUgAkU6AAkgBUEANgIAIAUgAyAEEIUBIQECfyAFLQAIIgAgASgCACICRQ0AGiAAQf8BcSEBQQEgAQ0AGiAFKAIEIQECQCACQQFHDQAgBS0ACUUNACABLQAYQQRxDQBBASABKAIAQZzywgBBASABKAIEKAIMEQIADQEaCyABKAIAQZzvwgBBASABKAIEKAIMEQIACyAFQRBqJABB/wFxQQBHC7oBAgF+A38CQCABKAIYIgVFDQACQCABKQMAIgJQBEAgASgCECEEIAEoAgghAwNAIARBIGshBCADKQMAIANBCGohA0J/hUKAgYKEiJCgwIB/gyICUA0ACyABIAQ2AhAgASADNgIIIAEgAkIBfSACgzcDAAwBCyABIAJCAX0gAoM3AwAgASgCECIERQ0BCyABIAVBAWs2AhhBASEDIAAgBCACeqdBAXZBPHFrQQRrKAAANgABCyAAIAM6AAALxAEBAX8jAEEQayILJAAgACgCACABIAIgACgCBCgCDBECACEBIAtBADoADSALIAE6AAwgCyAANgIIIAtBCGogAyAEIAUgBhBzIAcgCCAJIAoQcyEBAn8gCy0ADCIAIAstAA1FDQAaIABB/wFxIQJBASACDQAaIAEoAgAiAC0AGEEEcUUEQCAAKAIAQZfywgBBAiAAKAIEKAIMEQIADAELIAAoAgBBlvLCAEEBIAAoAgQoAgwRAgALIAtBEGokAEH/AXFBAEcLrQEBAX8CQCACBEACfwJAAkACQCABQQBOBEAgAygCCEUNAiADKAIEIgQNASABDQMgAgwECyAAQQhqQQA2AgAMBQsgAygCACAEIAIgARDxAgwCCyABDQAgAgwBCyABIAIQ/QILIgMEQCAAIAM2AgQgAEEIaiABNgIAIABBADYCAA8LIAAgATYCBCAAQQhqIAI2AgAMAQsgACABNgIEIABBCGpBADYCAAsgAEEBNgIAC4gBAQN/IAAoAggiAQRAIAAoAgQhAiABQThsIQNBACEBA0AgASACaiIAQRBqKAIABEAgAEEUaigCABA6CyAAQRxqKAIABEAgAEEgaigCABA6CyAAQShqKAIABEAgAEEsaigCABA6CyAAQQRqKAIABEAgAEEIaigCABA6CyADIAFBOGoiAUcNAAsLC6sBAQF/IwBB4ABrIgEkACABQRhqIABBEGopAgA3AwAgAUEQaiAAQQhqKQIANwMAIAEgACkCADcDCCABQQA2AiggAUKAgICAEDcDICABQTBqIgAgAUEgakGspcAAELoCIAFBCGogABDmAUUEQCABKAIkIAEoAigQASABKAIgBEAgASgCJBA6CyABQeAAaiQADwtBxKXAAEE3IAFB2ABqQfylwABB2KbAABDGAQALugEBAX8jAEEQayIHJAAgACgCACABIAIgACgCBCgCDBECACEBIAdBADoADSAHIAE6AAwgByAANgIIIAdBCGog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ayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB7NPCACACQQhqEE8gAkEgaiQAC1MBAn8jAEEgayICJAAgASgCBCEDIAEoAgAgAkEYaiAAQRBqKQIANwMAIAJBEGogAEEIaikCADcDACACIAApAgA3AwggAyACQQhqEE8gAkEgaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBqPTCACACQQhqEE8gAkEgaiQAC1MBAn8jAEEgayICJAAgACgCBCEDIAAoAgAgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAyACQQhqEE8gAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBnJPAACACQQhqEE8gAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB2LbAACACQQhqEE8gAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBoNTAACACQQhqEE8gAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBiL3CACACQQhqEE8gAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBqPTCACACQQhqEE8gAkEgaiQAC00AAn9BACAAQQNJDQAaQQEgAEEETQ0AGkECIABBCUkNABpBAyAAQRFJDQAaQQQgAEEhSQ0AGkEFIABBwQBJDQAaQQZBByAAQYEBSRsLCzsAIAAoAiAEQCAAQSRqKAIAEDoLIABBLGooAgAEQCAAQTBqKAIAEDoLIABBFGoo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AUEIakGEtsAAEKECAAsLIANBEGokAAtKAQF/IwBBIGsiACQAIABBFGpBATYCACAAQRxqQQA2AgAgAEG01MIANgIQIABBhNTCADYCGCAAQQA2AgggAEEIakG81MIAEKECAAs8ACAAIAEpAwA3AwAgAEEYaiABQRhqKQMANwMAIABBEGogAUEQaikDADcDACAAQQhqIAFBCGopAwA3AwALRgECfyABKAIEIQIgASgCACEDQQhBBBD9AiIBRQRAQQhBBBC7AwALIAEgAjYCBCABIAM2AgAgAEH4xsIANgIEIAAgATYCAAuZdwMWfiJ/AXwgASgCGEEBcSEYIAArAwAhOgJAAkACQCABKAIQQQFGBEACfyABISQgAUEUaigCACEnIwBB8AhrIh8kACA6vSEDAkAgOiA6YgRAQQIhAQwBCyADQv////////8HgyIGQoCAgICAgIAIhCADQgGGQv7///////8PgyADQjSIp0H/D3EiABsiBEIBgyEFQQMhAQJAAkACQEEBQQJBBCADQoCAgICAgID4/wCDIgdQIhkbIAdCgICAgICAgPj/AFEbQQNBBCAZGyAGUBtBAmsOAwABAgMLQQQhAQwCCyAAQbMIayEcIAVQIQFCASECDAELQoCAgICAgIAgIARCAYYgBEKAgICAgICACFEiGRshBEICQgEgGRshAiAFUCEBQct3Qcx3IBkbIABqIRwLIB8gHDsB6AggHyACNwPgCCAfQgE3A9gIIB8gBDcD0AggHyABOgDqCAJ/QezWwgAgAUECRg0AGiAYRQRAIANCP4inISxB2+7CAEHs1sIAIANCAFMbDAELQQEhLEHb7sIAQdzuwgAgA0IAUxsLITJBASEAAkACQAJ/AkACQAJAAkBBAyABQQJrIAFBAU0bQf8BcUEBaw4DAgEAAwtBdEEFIBzBIgBBAEgbIABsIgBBv/0ASw0EIB9BkAhqISAgH0EQaiEiIABBBHZBFWoiGiEcQYCAfkEAICdrICdBgIACTxshGwJAAkACQAJAAkACQAJAIB9B0AhqIgApAwAiAlBFBEAgAkL//////////x9WDQEgHEUNA0GgfyAALwEYIgBBIGsgACACQoCAgIAQVCIAGyIBQRBrIAEgAkIghiACIAAbIgJCgICAgICAwABUIgAbIgFBCGsgASACQhCGIAIgABsiAkKAgICAgICA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D3EiBkEKSRsgBmo6AAAgAkIQWgRAIAVBAmsiBUEwQdcAIANB/wFxIgNBoAFJGyADQQR2ajoAACAAQQJrIQAgAkKAAlQgAkIIiCECRQ0BDAILCyAAQQFrIQALIABBgQFJDQAgAEGAAUHM8sIAEJUDAAsgAUEBQdzywgBBAiAAIARqQYABIABrEEYgBEGAAWokAAsyACAAKAIAIQAgARCMA0UEQCABEI0DRQRAIAAgARCYAw8LIAAgARC9AQ8LIAAgARC8AQu3AQEDfyAAKAIAIQAgARCMA0UEQCABEI0DRQRAIAAgARCbAw8LIAAgARC7AQ8LIwBBgAFrIgMkACAALQAAIQADQCACIANqQf8AakEwQdcAIABBD3EiBEEKSRsgBGo6AAAgAkEBayECIAAiBEEEdiEAIARBD0sNAAsgAkGAAWoiAEGBAU8EQCAAQYABQczywgAQlQMACyABQQFB3PLCAEECIAIgA2pBgAFqQQAgAmsQRiADQYABaiQAC70CAQN/IAAoAgAhACABEIwDRQRAIAEQjQNFBEAgADMBAEEBIAEQew8LIwBBgAFrIgMkACAALwEAIQADQCACIANqQf8AakEwQTcgAEEPcSIEQQpJGyAEajoAACACQQFrIQIgACIEQQR2IQAgBEEPSw0ACyACQYABaiIAQYEBTwRAIABBgAFBzPLCABCVAwALIAFBAUHc8sIAQQIgAiADakGAAWpBACACaxBGIANBgAFqJAAPCyMAQYABayIDJAAgAC8BACEAA0AgAiADakH/AGpBMEHXACAAQQ9xIgRBCkkbIARqOgAAIAJBAWshAiAAIgRBBHYhACAEQQ9LDQALIAJBgAFqIgBBgQFPBEAgAEGAAUHM8sIAEJUDAAsgAUEBQdzywgBBAiACIANqQYABakEAIAJrEEYgA0GAAWokAAssAQF/IwBBEGsiACQAIABBCGoiAiABQf+9wgBBCxC7AiACENUBIABBEGokAAsuACAAQQQ6AAQgAEEENgIAIABBBmogAjoAACAAQQVqIAE6AAAgAEEUakEAOwEACysAIAEgAk8EQCABIAJrIgEgACABaiACED0PC0Gcr8AAQSFBwK/AABCHAgALLAAgACABKQIANwIAIABBEGogAUEQaigCADYCACAAQQhqIAFBCGopAgA3AgALMQAgACABKAIAIAIgAyABKAIEKAIMEQIAOgAIIAAgATYCBCAAIANFOgAJIABBADYCAAspACABIAJPBEAgAiAAIAJqIAEgAmsQPQ8LQfqrwABBI0GMr8AAEIcCAAsuACABIAAoAgAtAABBBHNBB3FBAnQiAEGY+sAAaigCACAAQfj5wABqKAIAEPcCCyoAIAAoAgBFBEAgACgCBCABIABBCGooAgAoAhARAAAPCyAAQQRqIAEQawssAAJAIAEQjANFBEAgARCNAw0BIAAgARC/Ag8LIAAgARC8AQ8LIAAgARC9AQsnACAAIAAoAgRBAXEgAXJBAnI2AgQgACABaiIAIAAoAgRBAXI2AgQLLQEBfyAAQaCrwgBB5KrCACABLQAAQQRGIgIbNgIEIAAgAUEBaiABIAIbNgIACzoBAn9BjJTDAC0AACEBQYyUwwBBADoAAEGQlMMAKAIAIQJBkJTDAEEANgIAIAAgAjYCBCAAIAE2AgALMQAgAEEDOgAgIABCgICAgIAENwIYIABBADYCECAAQQA2AgggACACNgIEIAAgATYCAAstACABKAIAIAIgAyABKAIEKAIMEQIAIQIgAEEAOgAFIAAgAjoABCAAIAE2AgALIAEBfwJAIABBBGooAgAiAUUNACAAKAIARQ0AIAEQOgsLIwACQCABQfz///8HTQRAIAAgAUEEIAIQ8QIiAA0BCwALIAALIwAgAiACKAIEQX5xNgIEIAAgAUEBcjYCBCAAIAFqIAE2AgALHgAgACgCACIArUIAIACsfSAAQQBOIgAbIAAgARB7CyUAIABFBEBB2LjAAEEyELYDAAsgACACIAMgBCAFIAEoAhARCwALIwAgAEEANgIQIAAgASkCADcCACAAQQhqIAFBCGopAgA3AgALKAAgASAAKAIALQAAQQJ0IgBB5NPAAGooAgAgAEGo08AAaigCABD3AgsoACABIAAoAgAtAABBAnQiAEHMg8EAaigCACAAQayDwQBqKAIAEPcCCygAIAEgACgCAC0AAEECdCIAQcTRwgBqKAIAIABBoNDCAGooAgAQ9wILHwECfiAAKQMAIgIgAkI/hyIDhSADfSACQgBZIAEQewsjACAARQRAQdi4wABBMhC2AwALIAAgAiADIAQgASgCEBEGAAsjACAARQRAQdi4wABBMhC2AwALIAAgAiADIAQgASgCEBEWAAsjACAARQRAQdi4wABB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AkE/Sw0ACwsCQCACRQ0AIAJBAWsCQCACQQNxIgRFBEAgASEADAELIAEhAANAIAAtAAAgA3NB/wFxQQJ0QZiXwQBqKAIAIANBCHZzIQMgAEEBaiEAIARBAWsiBA0ACwtBA0kNACABIAJqIQEDQCAALQAAIANzQf8BcUECdEGYl8EAaigCACADQQh2cyICIABBAWotAABzQf8BcUECdEGYl8EAaigCACACQQh2cyICIABBAmotAABzQf8BcUECdEGYl8EAaigCACACQQh2cyICIABBA2otAABzQf8BcUECdEGYl8EAaigCACACQQh2cyEDIABBBGoiACABRw0ACwsgBSADQX9zNgIACyMAIAFBzKvCAEHfq8IAIAAoAgAtAAAiABtBE0ENIAAbEPcCCyIAIAAtAABFBEAgAUHg9cIAQQUQQA8LIAFB3PXCAEEEEEALHwAgAEUEQEHYuMAAQTIQtgMACyAAIAIgASgCEBEAAAsdACABKAIARQRAAAsgAEHIvcAANgIEIAAgATYCAAsiACAAQQA2AhggAEEANgIQIABCgICAgAI3AwggAEIBNwMACxsAIAAoAgAiAEEEaigCACAAQQhqKAIAIAEQQQscACAAKAIAIgBBBGooAgAgAEEIaigCACABELwDCxwAIAAgASkCADcCACAAQQhqIAFBCGooAgA2AgALHQAgASgCAEUEQAALIABBrIzBADYCBCAAIAE2AgALIQAgACABQQRqNgIAIABBsJjCAEHsmMIAIAEoAgAbNgIECx0AIAEoAgBFBEAACyAAQYigwgA2AgQgACABNgIACxwAIAAoAgAiACgCACABIABBBGooAgAoAgwRAAALHAAgACgCACIAKAIAIAEgAEEEaigCACgCEBEAAAscACAAIAEoAgAgAiADIAQgBSABKAIEKAIMEQcACxkBAX8gACgCECIBBH8gAQUgAEEUaigCAAsLFAAgASABIAAgACABXRsgACAAXBsLFAAgACAAIAEgACABXRsgASABXBsLEQAgAMBBAnRB+PjAAGooAgALGAAgACgCACIAKAIAIABBBGooAgAgARBBCxcAIABBBGooAgAgAEEIaigCACABELwDCxYAIABBBGooAgAgAEEIaigCACABEEELEgBBGSAAQQF2a0EAIABBH0cbCxYAIAAgAUEBcjYCBCAAIAFqIAE2AgAL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SRsiAiACQQhNGyICQX9zQR92IQYCQCAFBEAgBEEBNgIYIAQgBTYCFCAEIABBBGooAgA2AhAMAQsgBEEANgIYCyAEIAIgBiAEQRBqEK4BIAQoAgQhBSAEKAIARQRAIAAgAjYCACAAIAU2AgQMAgsgBEEIaigCACICQYGAgIB4Rg0BIAJFDQAgBSACELsDAAsQlQIACyAEQSBqJAAgACgCCCECCyAAIAJBAWo2AgggACgCBCACaiABOgAADAILIAFBgIAETwRAIAMgAUE/cUGAAXI6AA8gAyABQQZ2QT9xQYABcjoADiADIAFBDHZBP3FBgAFyOgANIAMgAUESdkEHcUHwAXI6AAxBBAwBCyADIAFBP3FBgAFyOgAOIAMgAUEMdkHgAXI6AAwgAyABQQZ2QT9xQYABcjoADUEDCyEBIAEgACgCACAAKAIIIgJrSwRAIAAgAiABEKgBIAAoAgghAgsgACgCBCACaiADQQxqIAEQwQMaIAAgASACajYCCAsgA0EQaiQAQQALDgAgACgCABoDQAwACwALdwEBfyMAQTBrIgMkACADIAE2AgQgAyAANgIAIANBFGpBAjYCACADQRxqQQI2AgAgA0EsakE4NgIAIANB8PbCADYCECADQQA2AgggA0E4NgIkIAMgA0EgajYCGCADIANBBGo2AiggAyADNgIgIANBCGogAhChAgALdwEBfyMAQTBrIgMkACADIAE2AgQgAyAANgIAIANBFGpBAjYCACADQRxqQQI2AgAgA0EsakE4NgIAIANBkPfCADYCECADQQA2AgggA0E4NgIkIAMgA0EgajYCGCADIANBBGo2AiggAyADNgIgIANBCGogAhChAgALdwEBfyMAQTBrIgMkACADIAE2AgQgAyAANgIAIANBFGpBAjYCACADQRxqQQI2AgAgA0EsakE4NgIAIANBxPfCADYCECADQQA2AgggA0E4NgIkIAMgA0EgajYCGCADIANBBGo2AiggAyADNgIgIANBCGogAhChAgALDQAgADUCAEEBIAEQewttAQF/IwBBEGsiAyQAIAMgATYCDCADIAA2AggjAEEgayIAJAAgAEEMakEBNgIAIABBFGpBATYCACAAQbjwwgA2AgggAEEANgIAIABBswI2AhwgACADQQhqNgIYIAAgAEEYajYCECAAIAIQoQIACw0AIAAoAgAg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AgAgAEE8akGjATYCACAAQTRqQaQBNgIAIABB/OXAADYCECAAQQA2AgggAEGkATYCLCAAIABBKGo2AhggACAAQSRqNgI4IAAgAEEgajYCMCAAIABBBGo2AiggASAAQQhqEOgBDB4LIABBNGpBATYCACAAQTxqQQA2AgAgAEG85cAANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDB0LIABBNGpBATYCACAAQTxqQQA2AgAgAEGc5cAANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDBwLIABBNGpBATYCACAAQTxqQQA2AgAgAEHs5MAANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDBsLIABBNGpBATYCACAAQTxqQQA2AgAgAEG85MAANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDBoLIABBNGpBATYCACAAQTxqQQA2AgAgAEGg5MAANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDBkLIABBNGpBATYCACAAQTxqQQA2AgAgAEHw48AANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDBgLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBwOPAADYCMCAAQQA2AiggAEGjATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDoAQwXCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQYzjwAA2AjAgAEEANgIoIABBowE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6AEMFgsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEHc4sAANgIwIABBADYCKCAAQaMBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOgBDBULIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBrOLAADYCMCAAQQA2AiggAEGjATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDoAQwUCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQfDhwAA2AjAgAEEANgIoIABBowE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6AEMEwsgACACQQRqNgIgIAAgAkEIajYCJCAAQTRqQQM2AgAgAEE8akECNgIAIABBFGpBpQE2AgAgAEG44cAANgIwIABBADYCKCAAQaUBNgIMIAAgAEEIajYCOCAAIABBIGo2AhAgACAAQSRqNgIIIAEgAEEoahDoAQwSCyAAIAJBBGo2AiAgACACQQhqNgIkIABBNGpBAzYCACAAQTxqQQI2AgAgAEEUakGmATYCACAAQfTgwAA2AjAgAEEANgIoIABBpgE2AgwgACAAQQhqNgI4IAAgAEEkajYCECAAIABBIGo2AgggASAAQShqEOgBDBELIABBNGpBATYCACAAQTxqQQA2AgAgAEHE4MAANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDBALIAAgAkECajYCICAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBAjYCACAAQRRqQacBNgIAIABBkODAADYCMCAAQQA2AiggAEGoATYCDCAAIABBCGo2AjggACAAQSRqNgIQIAAgAEEgajYCCCABIABBKGoQ6AEMDwsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEHU38AANgIwIABBADYCKCAAQagBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOgBDA4LIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBnN/AADYCMCAAQQA2AiggAEGpATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDoAQwNCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQfDewAA2AjAgAEEANgIoIABBqQE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6AEMDAsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEHM3sAANgIwIABBADYCKCAAQakBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOgBDAsLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBqN7AADYCMCAAQQA2AiggAEGpATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDoAQwKCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQYTewAA2AjAgAEEANgIoIABBqQE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6AEMCQsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEHQ3cAANgIwIABBADYCKCAAQakBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOgBDAgLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBoN3AADYCMCAAQQA2AiggAEGpATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDoAQwHCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQfTcwAA2AjAgAEEANgIoIABBqQE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6AEMBgsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEHM3MAANgIwIABBADYCKCAAQakBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOgBDAULIABBNGpBATYCACAAQTxqQQA2AgAgAEGo3MAANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDAQLIABBNGpBATYCACAAQTxqQQA2AgAgAEGM2sAANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDAMLIAAgAkEEajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABByNnAADYCMCAAQQA2AiggAEGqATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDoAQwCCwJAAkACQAJAAkACQAJAAkAgAi0AAUEBaw4HAQIDBAUGBwALIABBNGpBATYCACAAQTxqQQA2AgAgAEG82cAANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDAgLIABBNGpBATYCACAAQTxqQQA2AgAgAEGQ2cAANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDAcLIABBNGpBATYCACAAQTxqQQA2AgAgAEHg2MAANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDAYLIABBNGpBATYCACAAQTxqQQA2AgAgAEG42MAANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDAULIABBNGpBATYCACAAQTxqQQA2AgAgAEGQ2MAANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDAQLIABBNGpBATYCACAAQTxqQQA2AgAgAEHU18AANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDAMLIABBNGpBATYCACAAQTxqQQA2AgAgAEGY18AANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDAILIABBNGpBATYCACAAQTxqQQA2AgAgAEHI1sAANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDAELIAAgAkEBaiICNgIkIABBNGpBATYCACAAQTxqQQA2AgAgAEGs2sAANgIwIABBwNXAADYCOCAAQQA2AihBASABIABBKGoQ6AENABoCQAJAAkACQCACLQAAIgIOAwECAwALAkACQAJAAkAgAkH8AWsOAwECAwALIABBNGpBAjYCACAAQTxqQQE2AgAgAEHE2sAANgIwIABBADYCKCAAQasBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOgBDAYLIABBNGpBATYCACAAQTxqQQA2AgAgAEGE3MAANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDAULIABBNGpBATYCACAAQTxqQQA2AgAgAEHk28AANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDAQLIABBNGpBATYCACAAQTxqQQA2AgAgAEHA28AANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDAMLIABBNGpBATYCACAAQTxqQQA2AgAgAEGg28AANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDAILIABBNGpBATYCACAAQTxqQQA2AgAgAEGA28AANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBDAELIABBNGpBATYCACAAQTxqQQA2AgAgAEHk2sAANgIwIABBwNXAADYCOCAAQQA2AiggASAAQShqEOgBCyAAQUBrJAALDAAgACABKQJANwMAC9ABAQF/IAAoAgAhAiMAQRBrIgAkACAAIAFBuPrAAEEJELsCIAAgAigAACIBNgIIIABBwfrAAEEEIABBCGpByPrAABBzIAAgAUF/c0EFdkEBcToADEHY+sAAQQggAEEMakHg+sAAEHMg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ciB3aXRoIGEgZGl2aXNvciBvZiB6ZXJvYXNzZXJ0aW9uIGZhaWxlZDogeCBhcyB1NjQgKyB3aWR0aCBhcyB1NjQgPD0gc2VsZi53aWR0aCgpIGFzIHU2NEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xpbWFnZS5ycwC5AhAAWgAAAL0DAAAJAAAAYXNzZXJ0aW9uIGZhaWxlZDogeSBhcyB1NjQgKyBoZWlnaHQgYXMgdTY0IDw9IHNlbGYuaGVpZ2h0KCkgYXMgdTY0AAC5AhAAWgAAAL4DAAAJAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcaW1hZ2UtMC4yNC42XC4vc3JjXGJ1ZmZlci5ycwB4AxAAWwAAALcDAABGAAAASW1hZ2UgaW5kZXggIG91dCBvZiBib3VuZHMgAOQDEAAMAAAA8AMQAA8AAAB4AxAAWwAAALIDAAAVAAAAeAMQAFsAAAB8AwAADgAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWUAeAMQAFsAAAB7AwAAQwAAAHgDEABbAAAABgMAAD4AAAB4AxAAWwAAAAEDAAAVAAAAQnVmZmVyIGxlbmd0aCBpbiBgSW1hZ2VCdWZmZXI6Om5ld2Agb3ZlcmZsb3dzIHVzaXplAHgDEABbAAAA3wQAAA4AAABhIHNlcXVlbmNlQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcaW1hZ2UtMC4yNC42XC4vc3JjXGJ1ZmZlci5ycwAAANoEEABbAAAAtwMAAEYAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xpbWFnZS0wLjI0LjZcLi9zcmNcYnVmZmVyLnJzAEgFEABbAAAAtwMAAEYAAABJbWFnZSBpbmRleCAgb3V0IG9mIGJvdW5kcyAAtAUQAAwAAADABRAADwAAAEgFEABbAAAABgMAAD4AAABIBRAAWwAAAAEDAAAVAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZUM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xpbWFnZW9wc1xzYW1wbGUucnMAKwYQAGQAAAApAQAAQwAAACsGEABkAAAAKAEAAEMAAAArBhAAZAAAACcBAABDAAAAKwYQAGQAAAAmAQAAQwAAAGNhbGxlZCBgUmVzdWx0Ojp1bndyYXAoKWAgb24gYW4gYEVycmAgdmFsdWUACAAAACgAAAAIAAAACQAAACsGEABkAAAA/gIAACQAAAAKAAAAAAAAAAEAAAALAAAADAAAAA0AAAAKAAAAAAAAAAEAAAAOAAAADwAAABAAAAAKAAAAAAAAAAEAAAARAAAAEgAAABMAAAAKAAAAAAAAAAEAAAAUAAAAFQAAABYAAAAKAAAAAAAAAAEAAAAXAAAAGAAAABkAAAB8BxAAZAcQAEwHEAA0BxAAHAcQAAAAAAAAAIA/AAAAQAAAQEAAAEBAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZUM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xjb2xvci5ycwAAAOcHEABaAAAAFQMAADAAAADnBxAAWgAAABQDAAAqAAAA5wcQAFoAAAATAwAAKgAAAOcHEABaAAAAEgMAACoAAAAEAAAA5wcQAFoAAABmAQAAAQAAAGB1bndyYXBfdGhyb3dgIGZhaWxlZAAAABoAAAAAAAAAAQAAABsAAAAaAAAAAAAAAAEAAAAcAAAAGgAAAAAAAAABAAAAHQAAAB4AAAAMAAAABAAAAB8AAAAgAAAAIQAAAGEgRGlzcGxheSBpbXBsZW1lbnRhdGlvbiByZXR1cm5lZCBhbiBlcnJvciB1bmV4cGVjdGVkbHkAGgAAAAAAAAABAAAAIgAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvYWxsb2Mvc3JjL3N0cmluZy5ycwBACRAASwAAAOkJAAAOAAAAGgAAAAQAAAAEAAAAIwAAACQAAAAlAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9jb3JlL3NyYy9zdHIvcGF0dGVybi5yc2Fzc2VydGlvbiBmYWlsZWQ6IHN0ZXAgIT0gMC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvY29yZS9zcmMvaXRlci9hZGFwdGVycy9zdGVwX2J5LnJzAB4KEABZAAAAFQAAAAkAAAAaAAAABAAAAAQAAAAmAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcYnl0ZW9yZGVyLTEuNC4zXHNyY1xsaWIucnMAAACYChAAWQAAALUHAAAcAAAAtAkQAE8AAAC4AQAAJgAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xjb2RlY3NccG5nLnJzABQLEABfAAAA+wAAAAkAAAAUCxAAXwAAAAEBAAATAEGgl8AAC40CYXR0ZW1wdCB0byBkaXZpZGUgYnkgemVyb2ludGVybmFsIGVycm9yOiBlbnRlcmVkIHVucmVhY2hhYmxlIGNvZGUAAAAUCxAAXwAAAAkBAAASAAAATWFwQWNjZXNzOjpuZXh0X3ZhbHVlIGNhbGxlZCBiZWZvcmUgbmV4dF9rZXlDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xzZXJkZS0xLjAuMTU5XHNyY1xkZVx2YWx1ZS5ycyAMEABcAAAAyAQAABsAAABhIENvbW1hbmRuYW1lcGFyYW0AAJUMEAAEAAAAmQwQAAUAQbaZwAAL2xSAvwAAAMAAAIC/AAAAAAAAgD8AAABAAACAP2V4cGVjdGVkIGludGVybGFjZSBpbmZvcm1hdGlvbgAA0AwQAB4AAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xwbmctMC4xNy43XHNyY1xkZWNvZGVyXG1vZC5yc/gMEABcAAAACwIAACwAAAD4DBAAXAAAABMCAAAeAAAATmV4dCBmcmFtZSBjYWxsZWQgd2hlbiBhbHJlYWR5IGF0IGltYWdlIGVuZAB0DRAAKwAAAPgMEABcAAAA2AEAACEAAABOZXh0IGZyYW1lIGNhbiBuZXZlciBiZSBpbml0aWFsALgNEAAfAAAA+AwQAFwAAADXAQAAJAAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWUA+AwQAFwAAACPAgAAMgAAAPgMEABcAAAAegEAADoAAAD4DBAAXAAAAPwCAAAgAAAA+AwQAFwAAAD9AgAAOAAAAPgMEABcAAAACAMAACwAAAD4DBAAXAAAAAgDAABHAAAA+AwQAFwAAAAPAwAAEQAAAPgMEABcAAAAEwMAABwAAABBZGFtNyBpbnRlcmxhY2VkIHJvd3MgYXJlIHNob3J0ZXIgdGhhbiB0aGUgYnVmZmVyLgAA+AwQAFwAAABPAgAAEgAAAPgMEABcAAAAVwIAADsAAAD4DBAAXAAAAFkCAAAzAAAA+AwQAFwAAABdAgAAPgAAAPgMEABcAAAAXQIAACAAAAD4DBAAXAAAAGsCAAAkAAAA+AwQAFwAAABrAgAAEQAAAPgMEABcAAAATgIAABIAAAD4DBAAXAAAAMcBAAAdAAAAaW50ZXJuYWwgZXJyb3I6IGVudGVyZWQgdW5yZWFjaGFibGUgY29kZTogAABgDxAAKgAAAPgMEABcAAAAEQEAABgAAABmYWlsZWQgdG8gd3JpdGUgd2hvbGUgYnVmZmVypA8QABwAAAAXAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZUM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGdpZi0wLjEyLjBcc3JjXGVuY29kZXIucnNORVRTQ0FQRTIuMAAA9w8QAFgAAAAVAQAAJgAAAPcPEABYAAAAAwEAABsAAAD3DxAAWAAAAP0AAAAmAAAA9w8QAFgAAADlAAAAJgAAAEdJRjg5YQAA9w8QAFgAAADEAAAAJgAAAAIAAAAAAAAAY2h1bmtzIGNhbm5vdCBoYXZlIGEgc2l6ZSBvZiB6ZXJvAAAAvBAQACEAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL21vZC5ycwAAAOgQEABNAAAAcQMAAAkAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xpbWFnZXByb2MtMC4yMy4wXHNyY1xnZW9tZXRyaWNfdHJhbnNmb3JtYXRpb25zLnJzSBEQAHAAAACJAgAADQAAACkAAAAMAAAABAAAACoAAAApAAAADAAAAAQAAAArAAAAKgAAAMgREAAsAAAALQAAAC4AAAAvAAAAMAAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xidWZmZXIucnMABBIQAFsAAAC3AwAARgAAAEltYWdlIGluZGV4ICBvdXQgb2YgYm91bmRzIABwEhAADAAAAHwSEAAPAAAABBIQAFsAAACyAwAAFQAAADQAAAAMAAAABAAAADUAAAA2AAAAIQAAAGEgRGlzcGxheSBpbXBsZW1lbnRhdGlvbiByZXR1cm5lZCBhbiBlcnJvciB1bmV4cGVjdGVkbHkANwAAAAAAAAABAAAAIgAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvYWxsb2Mvc3JjL3N0cmluZy5ycwAMExAASwAAAOkJAAAOAAAAAAAAAGNodW5rcyBjYW5ub3QgaGF2ZSBhIHNpemUgb2YgemVybwAAAGwTEAAhAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9tb2QucnMAAACYExAATQAAAMADAAAJAAAAbWlzc2luZyBmaWVsZCBgYPgTEAAPAAAABxQQAAEAAAB1bmtub3duIGZpZWxkIGBgLCBleHBlY3RlZCAAGBQQAA8AAAAnFBAADAAAAGAsIHRoZXJlIGFyZSBubyBmaWVsZHMAABgUEAAPAAAARBQQABYAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xnaWYtMC4xMi4wXHNyY1xyZWFkZXJcbW9kLnJzAGwUEABbAAAAeAEAACMAAABsFBAAWwAAAHoBAAAYAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZQBsFBAAWwAAAIIBAAArAAAAbBQQAFsAAACDAQAAIAAAAG5vIGNvbG9yIHRhYmxlIGF2YWlsYWJsZSBmb3IgY3VycmVudCBmcmFtZQAAbBQQAFsAAAA/AQAAKwAAAGltYWdlIHRydW5jYXRlZABsFBAAWwAAAEQBAAAcAAAAaW50ZXJuYWwgZXJyb3I6IGVudGVyZWQgdW5yZWFjaGFibGUgY29kZWwUEABbAAAA7wAAABUAAABmaWxlIGRvZXMgbm90IGNvbnRhaW4gYW55IGltYWdlIGRhdGF1bmV4cGVjdGVkIEVPRmFzc2VydGlvbiBmYWlsZWQ6IG1pZCA8PSBzZWxmLmxlbigpSW1hZ2UgZGltZW5zaW9ucyAoLCApIGFyZSB0b28gbGFyZ2UdFhAAEgAAAC8WEAACAAAAMRYQAA8AAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L3N0ZC9zcmMvaW8vY3Vyc29yLnJzWBYQAEwAAADrAAAACgAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvY29yZS9zcmMvb3BzL2FyaXRoLnJzAAAAtBYQAE0AAADoAQAAAQBBoK7AAAvlBWF0dGVtcHQgdG8gZGl2aWRlIGJ5IHplcm8AAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL21vZC5ycwAAADwXEABNAAAADQwAAAkAAABhc3NlcnRpb24gZmFpbGVkOiBrIDw9IHNlbGYubGVuKCkAAAA8FxAATQAAADgMAAAJAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZUM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xjb2RlY3NcZ2lmLnJzAAD7FxAAXwAAACsCAAA1AAAA+xcQAF8AAAAiAgAAKAAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xidWZmZXIucnMAfBgQAFsAAAC3AwAARgAAAEltYWdlIGluZGV4ICBvdXQgb2YgYm91bmRzIADoGBAADAAAAPQYEAAPAAAAfBgQAFsAAACyAwAAFQAAAEVycgA5AAAABAAAAAQAAAA6AAAAT2sAADkAAAAEAAAABAAAADsAAAA8AAAAGAEAAAgAAAA9AAAAPgAAAD8AAABAAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9hbGxvYy9zcmMvc2xpY2UucnMAAGgZEABKAAAAkgAAABEAAABnaWZwbmdVbnN1cHBvcnRlZCBleHRlbnNpb246IAAAAMoZEAAXAAAAc3JjXHV0aWxzLnJz7BkQAAwAAAAvAAAAEgBBkLTAAAvxDmF0dGVtcHQgdG8gZGl2aWRlIGJ5IHplcm8AAADsGRAADAAAADUAAAAgAAAAAAAAAGF0dGVtcHQgdG8gY2FsY3VsYXRlIHRoZSByZW1haW5kZXIgd2l0aCBhIGRpdmlzb3Igb2YgemVybwAAAOwZEAAMAAAASAAAABgAAADsGRAADAAAAEsAAAAYAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcY29uc29sZV9lcnJvcl9wYW5pY19ob29rLTAuMS43XHNyY1xsaWIucnOcGhAAaAAAAJUAAAAOAAAAc3BlZWRoeXBlcnNwZWVkcmV2ZXJzZXJhaW5ib3dyb3RhdGVzcGlucmV2c2xpZGV3aWdnbGVzaGFrZQAAUBsQAAAAAABCAAAABAAAAAQAAABDAAAARAAAAEUAAABIAAAADAAAAAQAAABJAAAASgAAAEsAAABhIERpc3BsYXkgaW1wbGVtZW50YXRpb24gcmV0dXJuZWQgYW4gZXJyb3IgdW5leHBlY3RlZGx5AEwAAAAAAAAAAQAAACIAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2FsbG9jL3NyYy9zdHJpbmcucnMA0BsQAEsAAADpCQAADgAAAGludmFsaWQgdHlwZTogLCBleHBlY3RlZCAAAAAsHBAADgAAADocEAALAAAAY2xvc3VyZSBpbnZva2VkIHJlY3Vyc2l2ZWx5IG9yIGFmdGVyIGJlaW5nIGRyb3BwZWQAAHN0cnVjdCB2YXJpYW50AACMHBAADgAAAHR1cGxlIHZhcmlhbnQAAACkHBAADQAAAG5ld3R5cGUgdmFyaWFudAC8HBAADwAAAHVuaXQgdmFyaWFudNQcEAAMAAAAZW51begcEAAEAAAAbWFwAPQcEAADAAAAc2VxdWVuY2UAHRAACAAAAG5ld3R5cGUgc3RydWN0AAAQHRAADgAAAE9wdGlvbiB2YWx1ZSgdEAAMAAAAdW5pdCB2YWx1ZQAAPB0QAAoAAABieXRlIGFycmF5AABQHRAACgAAAHN0cmluZyAAZB0QAAcAAABjaGFyYWN0ZXIgYGB0HRAACwAAAH8dEAABAAAAZmxvYXRpbmcgcG9pbnQgYJAdEAAQAAAAfx0QAAEAAABpbnRlZ2VyIGAAAACwHRAACQAAAH8dEAABAAAAYm9vbGVhbiBgAAAAzB0QAAkAAAB/HRAAAQAAAG9uZSBvZiAA6B0QAAcAAAAsIAAA+B0QAAIAAAB/HRAAAQAAAH8dEAABAAAAYCBvciBgAAB/HRAAAQAAABQeEAAGAAAAfx0QAAEAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xzZXJkZS0xLjAuMTU5XHNyY1xkZVxtb2QucnNl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bGUgZGF0YSBpbiB0RVh0IGNodW5rLgCYLBAAIwAAAC4AAADAKhAAAAAAAMQsEAABAAAASURBVCBvciBmREFUIGNodW5rIGlzIGhhcyBub3QgZW5vdWdoIGRhdGEgZm9yIGltYWdlLtgsEAA0AAAAQ29ycnVwdCBkZWZsYXRlIHN0cmVhbS4gFC0QABgAAABFcnJvciBudW1iZXIgAAAANC0QAA0AAADELBAAAQAAAEhhcyBtb3JlIG91dHB1dC5ULRAAEAAAAE5lZWRzIG1vcmUgaW5wdXQuAAAAbC0QABEAAABVbmV4cGVjdGVkIGRvbmUgc3RhdHVzLgCILRAAFwAAAEFkbGVyMzIgY2hlY2tzdW0gZmFpbGVkLqgtEAAYAAAASW52YWxpZCBpbnB1dCBwYXJhbWV0ZXJzLgAAAMgtEAAZAAAAVW5leHBlY3RlZCBlbmQgb2YgZGF0YS4A7C0QABcAAABTdWIgZnJhbWUgaXMgb3V0LW9mLWJvdW5kcy4ADC4QABsAAABVbmtub3duIGludGVybGFjZSBtZXRob2QgAAAAMC4QABkAAADELBAAAQAAAFVua25vd24gZmlsdGVyIG1ldGhvZCAAAFwuEAAWAAAAxCwQAAEAAABVbmtub3duIGNvbXByZXNzaW9uIG1ldGhvZCAAhC4QABsAAADELBAAAQAAAEludmFsaWQgc1JHQiByZW5kZXJpbmcgaW50ZW50IAAAsC4QAB4AAADELBAAAQAAAEludmFsaWQgcGh5c2ljYWwgcGl4ZWwgc2l6ZSB1bml0IAAAAOAuEAAhAAAAxCwQAAEAAABJbnZhbGlkIGJsZW5kIG9wIAAAABQvEAARAAAAxCwQAAEAAABJbnZhbGlkIGRpc3Bvc2Ugb3AgADgvEAATAAAAxCwQAAEAAABJbnZhbGlkIGNvbG9yIHR5cGUgAFwvEAATAAAAxCwQAAEAAABJbnZhbGlkIGRpc3Bvc2Ugb3BlcmF0aW9uIAAAgC8QABoAAADELBAAAQAAAFRyYW5zcGFyZW5jeSBjaHVuayBmb3VuZCBmb3IgY29sb3IgdHlwZSCsLxAAKAAAAMQsEAABAAAASW52YWxpZCBjb2xvci9kZXB0aCBjb21iaW5hdGlvbiBpbiBoZWFkZXI6IC/kLxAAKwAAAA8wEAABAAAATWlzc2luZyBw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bkZpbHRlck1ldGhvZFVua25vd25Db21wcmVzc2lvbk1ldGhvZEludmFsaWRTcmdiUmVuZGVyaW5nSW50ZW50SW52YWxpZFVuaXRJbnZhbGlkQmxlbmRPcEludmFsaWREaXNwb3NlT3BJbnZhbGlkQ29sb3JUeXBlSW52YWxpZEJpdERlcHRoQ29sb3JXaXRoQmFkVHJuc0ludmFsaWRDb2xvckJpdERlcHRoY29sb3JfdHlwZWJpdF9kZXB0aFBhbGV0dGVSZXF1aXJlZFNob3J0UGFsZXR0ZWV4cGVjdGVkbGVuQXBuZ09yZGVycHJlc2VudER1cGxpY2F0ZUNodW5ra2luZE91dHNpZGVQbHRlSWRhdEFmdGVyUGx0ZUFmdGVySWRhdENodW5rQmVmb3JlSWhkck1pc3NpbmdJbWFnZURhdGFNaXNzaW5nRmN0bE1pc3NpbmdJaGRyVW5leHBlY3RlZEVuZE9mQ2h1bmtVbmV4cGVjdGVkRW9mSW52YWxpZFNpZ25hdHVyZUNyY01pc21hdGNocmVjb3ZlcmNyY192YWxjcmNfc3VtY2h1bmsAaW50ZXJuYWwgZXJyb3I6IGVudGVyZWQgdW5yZWFjaGFibGUgY29kZTogAADkOBAAKgAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHBuZy0wLjE3Ljdcc3JjXGNvbW1vbi5ycwBhdHRlbXB0IHRvIGRpdmlkZSBieSB6ZXJvAAAAGDkQAFcAAABAAAAAHQAAAE5vdCBhIHBvc3NpYmxlIGJ5dGUgcm91bmRlZCBwaXhlbCB3aWR0aACcORAAJwAAABg5EABXAAAAXgIAABIAAABFbmQgb2YgaW1hZ2UgaGFzIGJlZW4gcmVhY2hlZAAAANw5EAAdAAAAd3JvbmcgZGF0YSBzaXplLCBleHBlY3RlZCAgZ290IAAEOhAAGgAAAB46EAAFAAAAUmdiYUdyYXlzY2FsZUFscGhhSW5kZXhlZFJnYkdyYXlzY2FsZVNpeHRlZW5FaWdodEZvdXJUd29PbmVQaXhlbERpbWVuc2lvbnN4cHB1AADGAAAABAAAAAQAAAC4AAAAeXBwdXVuaXTGAAAABAAAAAQAAADHAAAATWV0ZXJVbnNwZWNpZmllZFByZXZpb3VzQmFja2dyb3VuZE5vbmVPdmVyU291cmNlc2VxdWVuY2VfbnVtYmVyd2lkdGhoZWlnaHR4X29mZnNldHlfb2Zmc2V0ZGVsYXlfbnVtZGVsYXlfZGVuZGlzcG9zZV9vcGJsZW5kX29wAADcOhAADwAAAOs6EAAFAAAA8DoQAAYAAAD2OhAACAAAAP46EAAIAAAABjsQAAkAAAAPOxAACQAAABg7EAAKAAAAIjsQAAgAAADGAAAABAAAAAQAAADIAAAAxgAAAAQAAAAEAAAAyQAAAMYAAAAEAAAABAAAAMoAAABGcmFtZUNvbnRyb2xBbmltYXRpb25Db250cm9sbnVtX2ZyYW1lc251bV9wbGF5c1BhcmFtZXRlckVycm9yaW5uZXIAAMYAAAAEAAAABAAAAMsAAABQb2xsZWRBZnRlckVuZE9mSW1hZ2VJbWFnZUJ1ZmZlclNpemVleHBlY3RlZMYAAAAEAAAABAAAALkAAABhY3R1YWwAAAAAAAABAAAAAAAAAAEAAAAAAAAAAwAAAAAAAAABAAAAAAAAAAIAAAAAAAAAAQAAAAAAAAAEAAAAAAAAAAEAAAABAAAAAwAAAAEAAAACAAAAAQAAAAQAAAAAAAAAAgAAAAAAAAABAAAAAAAAAAQAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAwAAAAAAAAABAAAAAAAAAAIAAAABAAAABAAAAAEAAAABAAAAAQAAAAMAAAABAAAADgAAAAkAAAAEAAAACQAAAAkAAAAJAAAAAwAAAAcAAAA4OhAAUDoQADQ6EABQOhAAUDoQAFA6EABNOhAARjoQAENodW5rVHlwZXR5cGUAAADNAAAABAAAAAEAAADOAAAAY3JpdGljYWzNAAAAAQAAAAEAAADPAAAAcHJpdmF0ZXJlc2VydmVkc2FmZWNvcHkAOD0QAAAAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xwbmctMC4xNy43XHNyY1xkZWNvZGVyXHpsaWIucnMAAACQPRAAXQAAAEgAAAASAAAAkD0QAF0AAACAAAAAFQAAAJA9EABdAAAAjAAAABYAAABObyBtb3JlIGZvcndhcmQgcHJvZ3Jlc3MgbWFkZSBpbiBzdHJlYW0gZGVjb2RpbmcuAAAAkD0QAF0AAACeAAAAFQAAAGFzc2VydGlvbiBmYWlsZWQ6IHN0ZXAgIT0gMC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvY29yZS9zcmMvaXRlci9hZGFwdGVycy9zdGVwX2J5LnJzfz4QAFkAAAAVAAAACQAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHBuZy0wLjE3Ljdcc3JjXGZpbHRlci5yc0ZpbHRlcmluZyBmYWlsZWQ6IGJ5dGVzIHBlciBwaXhlbCBpcyBncmVhdGVyIHRoYW4gbGVuZ3RoIG9mIHJvdwAA6D4QAFcAAACyAAAAHgAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWUA6D4QAFcAAAC4AAAAMAAAAOg+EABXAAAAdwAAAB4AAADoPhAAVwAAAGMAAAA2AAAARmlsdGVyaW5nIGZhaWxlZDogbm90IGVub3VnaCBkYXRhIGluIHByZXZpb3VzIHJvdwAAAOg+EABXAAAAmAAAAA0AAADoPhAAVwAAAJkAAAANAAAA6D4QAFcAAACaAAAADQAAAOg+EABXAAAAmwAAAA0AAADoPhAAVwAAAJwAAAANAAAA6D4QAFcAAACdAAAADQAAAHVucmVhY2hhYmxlANAAAAAIAAAABAAAANEAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xwbmctMC4xNy43XHNyY1x0ZXh0X21ldGFkYXRhLnJzAACcQBAAXgAAALkAAAAmAAAASW52YWxpZEtleXdvcmRTaXplVW5yZXByZXNlbnRhYmxlTWlzc2luZ0NvbXByZXNzaW9uRmxhZ0ludmFsaWRDb21wcmVzc2lvbkZsYWdJbnZhbGlkQ29tcHJlc3Npb25NZXRob2RPdXRPZkRlY29tcHJlc3Npb25TcGFjZUluZmxhdGlvbkVycm9yTWlzc2luZ051bGxTZXBhcmF0b3IAAA8AAAASAAAAFAAAAA4AAAAX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AAAA4wAAAElvAADiAAAABAAAAAQAAADkAAAARm9ybWF0AADiAAAABAAAAAQAAADlAAAAY2Fubm90IGFjY2VzcyBhIFRocmVhZCBMb2NhbCBTdG9yYWdlIHZhbHVlIGR1cmluZyBvciBhZnRlciBkZXN0cnVjdGlvbgAA5gAAAAAAAAABAAAA5wAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvc3RkL3NyYy90aHJlYWQvbG9jYWwucnMAqI8QAE8AAACmAQAAGgAAAOgAAAAIAAAABAAAAOkAAABhc3NlcnRpb24gZmFpbGVkOiBwaXhlbC5sZW4oKSA9PSA0QzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcY29sb3JfcXVhbnQtMS4xLjBcc3JjXGxpYi5ycwAAADqQEABbAAAAugAAAAkAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xnaWYtMC4xMi4wXHNyY1xjb21tb24ucnMAqJAQAFcAAAD1AAAAIgAAAKiQEABXAAAA9QAAACwAAACokBAAVwAAAPUAAAA2AAAAqJAQAFcAAAD1AAAAQAAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWUAqJAQAFcAAAD1AAAASwAAAOoAAAAIAAAABAAAAOsAAADsAAAA7QAAAAwAAAAEAAAAKgAAAO0AAAAMAAAABAAAACsAAAAqAAAAkJEQAO4AAADvAAAALgAAAPAAAADxAAAAY2FwYWNpdHkgb3ZlcmZsb3cAAADMkRAAEQAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvYWxsb2Mvc3JjL3ZlYy9zcGVjX2Zyb21faXRlcl9uZXN0ZWQucnMAAOiREABeAAAAOwAAABIAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL2l0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AAydEAAiAAAApJwQAFUAAABoAAAABQAAAKScEABVAAAAaQAAAAUAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1x3ZWV6bC0wLjEuN1xzcmNcZW5jb2RlLnJzWJ0QAFgAAAD/AQAAFQAAAAsBAAAMAAAABAAAAAwBAAANAQAADgEAAGEgRGlzcGxheSBpbXBsZW1lbnRhdGlvbiByZXR1cm5lZCBhbiBlcnJvciB1bmV4cGVjdGVkbHkADwEAAAAAAAABAAAAIgAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvYWxsb2Mvc3JjL3N0cmluZy5ycwAgnhAASwAAAOkJAAAOAAAACgpTdGFjazoKCgAAEAEAAAQAAAAEAAAAEQEAABIBAAATAQAASnNWYWx1ZSgpAAAAoJ4QAAgAAAConhAAAQAAABkBAAAEAAAABAAAABoBAAAbAQAAHAEAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWVBY2Nlc3NFcnJvcgAA1J4QAAAAAAB1bmNhdGVnb3JpemVkIGVycm9yb3RoZXIgZXJyb3JvdXQgb2YgbWVtb3J5dW5leHBlY3RlZCBlbmQgb2YgZmlsZXVuc3VwcG9ydGVkb3BlcmF0aW9uIGludGVycnVwdGVkYXJndW1lbnQgbGlzdCB0b28gbG9uZ2ludmFsaWQgZmlsZW5hbWV0b28gbWFueSBsaW5rc2Nyb3NzLWRldmljZSBsaW5rIG9yIHJlbmFtZWRlYWRsb2NrZXhlY3V0YWJsZSBmaWxlIGJ1c3lyZXNvdXJjZSBidXN5ZmlsZSB0b28gbGFyZ2VmaWxlc3lzdGVtIHF1b3RhIGV4Y2VlZGVkc2VlayBvbiB1bnNlZWthYmxlIGZpbGVubyBzdG9yYWdlIHNwYWNld3JpdGUgemVyb3RpbWVkIG91dGludmFsaWQgZGF0YWludmFsaWQgaW5wdXQgcGFyYW1ldGVyc3RhbGUgbmV0d29yayBmaWxlIGhhbmRsZWZpbGVzeXN0ZW0gbG9vcCBvciBpbmRpcmVjdGlvbiBsaW1pdCAoZS5nLiBzeW1saW5rIGxvb3ApcmVhZC1vbmx5IGZpbGVzeXN0ZW0gb3Igc3RvcmFnZSBtZWRpdW1kaXJlY3Rvcnkgbm90IGVtcHR5aXMgYSBkaXJlY3Rvcnlub3QgYSBkaXJlY3RvcnlvcGVyYXRpb24gd291bGQgYmxvY2tlbnRpdHkgYWxyZWFkeSBleGlzdHNicm9rZW4gcGlwZW5ldHdvcmsgZG93bmFkZHJlc3Mgbm90IGF2YWlsYWJsZWFkZHJlc3MgaW4gdXNlbm90IGNvbm5lY3RlZGNvbm5lY3Rpb24gYWJvcnRlZG5ldHdvcmsgdW5yZWFjaGFibGVob3N0IHVucmVhY2hhYmxlY29ubmVjdGlvbiByZXNldGNvbm5lY3Rpb24gcmVmdXNlZHBlcm1pc3Npb24gZGVuaWVkZW50aXR5IG5vdCBmb3VuZEVycm9ya2luZAAAGQEAAAEAAAABAAAAHQEAAG1lc3NhZ2UAGQEAAAgAAAAEAAAAHgEAAEtpbmRPc2NvZGUAABkBAAAEAAAABAAAAB8BAAAgAQAADAAAAAQAAAAhAQAAIChvcyBlcnJvciAp1J4QAAAAAABgohAACwAAAGuiEAABAAAAbWVtb3J5IGFsbG9jYXRpb24gb2YgIGJ5dGVzIGZhaWxlZAAAhKIQABUAAACZohAADQAAAGxpYnJhcnkvc3RkL3NyYy9hbGxvYy5yc7iiEAAYAAAAVQEAAAkAAABjYW5ub3QgbW9kaWZ5IHRoZSBwYW5pYyBob29rIGZyb20gYSBwYW5pY2tpbmcgdGhyZWFk4KIQADQAAABsaWJyYXJ5L3N0ZC9zcmMvcGFuaWNraW5nLnJzHKMQABwAAACGAAAACQAAAByjEAAcAAAAPgIAAB4AAAAcoxAAHAAAAD0CAAAfAAAAIAEAAAwAAAAEAAAAIgEAABkBAAAIAAAABAAAACMBAAAkAQAAEAAAAAQAAAAlAQAAJgEAABkBAAAIAAAABAAAACcBAAAoAQAAGQEAAAAAAAABAAAAKQEAAFVuc3VwcG9ydGVkABkBAAAEAAAABAAAACoBAABDdXN0b21lcnJvcgAZAQAABAAAAAQAAAArAQAAVW5jYXRlZ29yaXplZE90aGVyT3V0T2ZNZW1vcnlVbmV4cGVjdGVkRW9mSW50ZXJydXB0ZWRBcmd1bWVudExpc3RUb29Mb25nSW52YWxpZEZpbGVuYW1lVG9vTWFueUxpbmtzQ3Jvc3Nlc0RldmljZXNEZWFkbG9ja0V4ZWN1dGFibGVGaWxlQnVzeVJlc291cmNlQnVzeUZpbGVUb29MYXJnZUZpbGVzeXN0ZW1RdW90YUV4Y2VlZGVkTm90U2Vla2FibGVTdG9yYWdlRnVsbFdyaXRlWmVyb1RpbWVkT3V0SW52YWxpZERhdGFJbnZhbGlkSW5wdXRTdGFsZU5ldHdvcmtGaWxlSGFuZGxlRmlsZXN5c3RlbUxvb3BSZWFkT25seUZpbGVzeXN0ZW1EaXJlY3RvcnlOb3RFbXB0eUlzQURpcmVjdG9yeU5vdEFEaXJlY3RvcnlXb3VsZEJsb2NrQWxyZWFkeUV4aXN0c0Jyb2tlblBpcGVOZXR3b3JrRG93bkFkZHJOb3RBdmFpbGFibGVBZGRySW5Vc2VOb3RDb25uZWN0ZWRDb25uZWN0aW9uQWJvcnRlZE5ldHdvcmtVbnJlYWNoYWJsZUhvc3RVbnJlYWNoYWJsZUNvbm5lY3Rpb25SZXNldENvbm5lY3Rpb25SZWZ1c2VkUGVybWlzc2lvbkRlbmllZE5vdEZvdW5kb3BlcmF0aW9uIHN1Y2Nlc3NmdWwADgAAABAAAAAWAAAAFQAAAAsAAAAWAAAADQAAAAsAAAATAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEQAAABIAAAAQAAAAEAAAABMAAAASAAAADQAAAA4AAAAVAAAADAAAAAsAAAAVAAAAFQAAAA8AAAAOAAAAEwAAACYAAAA4AAAAGQAAABcAAAAMAAAACQAAAAoAAAAQAAAAFwAAABkAAAAOAAAADQAAABQAAAAIAAAAGwAAAJufEACLnxAAdZ8QAGCfEABVnxAAP58QADKfEAAnnxAAFJ8QAPGhEADxoRAA8aEQAPGhEADxoRAA8aEQAPGhEADxoRAA8aEQAPGhEADxoRAA8aEQAPGhEADxoRAA8aEQAPGhEADxoRAA8aEQAPGhEADxoRAA8aEQAPGhEADxoRAA8aEQAOChEADOoRAAvqEQAK6hEACboRAAiaEQAHyhEABuoRAAWaEQAE2hEABCoRAALaEQABihEAAJoRAA+6AQAOigEADCoBAAiqAQAHGgEABaoBAATqAQAEWgEAA7oBAAK6AQABSgEAD7nxAA7Z8QAOCfEADMnxAAxJ8QAKmfEAAIAAAAEAAAABEAAAAPAAAADwAAABIAAAARAAAADAAAAAkAAAAQAAAACwAAAAoAAAANAAAACgAAAA0AAAAMAAAAEQAAABIAAAAOAAAAFgAAAAwAAAALAAAACAAAAAkAAAALAAAACwAAABcAAAAMAAAADAAAABIAAAAIAAAADgAAAAwAAAAPAAAAEwAAAAsAAAALAAAADQAAAAsAAAAFAAAADQAAAAOmEADzpRAA4qUQANOlEADEpRAAsqUQAKGlEACVpRAAjKUQAHylEABxpRAAZ6UQAFqlEABQpRAAQ6UQADelEAAmpRAAFKUQAAalEADwpBAA5KQQANmkEADRpBAAyKQQAL2kEACypBAAm6QQAI+kEACDpBAAcaQQAGmkEABbpBAAT6QQAECkEAAtpBAAIqQQAMCjEAAVpBAACqQQAAWkEAD4oxAASGFzaCB0YWJsZSBjYXBhY2l0eSBvdmVyZmxvd2ipEAAcAAAAL2NhcmdvL3JlZ2lzdHJ5L3NyYy9naXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjMvaGFzaGJyb3duLTAuMTIuMy9zcmMvcmF3L21vZC5ycwCMqRAATwAAAFoAAAAoAAAALAEAAAQAAAAEAAAALQEAAC4BAAAvAQAAbGlicmFyeS9hbGxvYy9zcmMvcmF3X3ZlYy5yc2NhcGFjaXR5IG92ZXJmbG93AAAAIKoQABEAAAAEqhAAHAAAAAYCAAAFAAAAYSBmb3JtYXR0aW5nIHRyYWl0IGltcGxlbWVudGF0aW9uIHJldHVybmVkIGFuIGVycm9yACwBAAAAAAAAAQAAACIAAABsaWJyYXJ5L2FsbG9jL3NyYy9mbXQucnOQqhAAGAAAAGQCAAAgAAAAKSBzaG91bGQgYmUgPCBsZW4gKGlzIClsaWJyYXJ5L2FsbG9jL3NyYy92ZWMvbW9kLnJzaW5zZXJ0aW9uIGluZGV4IChpcyApIHNob3VsZCBiZSA8PSBsZW4gKGlzIAAA66oQABQAAAD/qhAAFwAAAM6qEAABAAAAz6oQABwAAACrBQAADQAAAHJlbW92YWwgaW5kZXggKGlzIAAAQKsQABIAAAC4qhAAFgAAAM6qEAABAAAAYXNzZXJ0aW9uIGZhaWxlZDogZWRlbHRhID49IDBsaWJyYXJ5L2NvcmUvc3JjL251bS9kaXlfZmxvYXQucnMAAImrEAAhAAAATAAAAAkAAACJqxAAIQAAAE4AAAAJAAAAAQAAAAoAAABkAAAA6AMAABAnAACghgEAQEIPAICWmAAA4fUFAMqaOwIAAAAUAAAAyAAAANAHAAAgTgAAQA0DAICEHgAALTEBAMLrCwCUNXcAAMFv8oYjAAAAAACB76yFW0FtLe4EAEG82MIACxMBH2q/ZO04bu2Xp9r0+T/pA08YAEHg2MIACyYBPpUuCZnfA/04FQ8v5HQj7PXP0wjcBMTasM28GX8zpgMmH+lOAgBBqNnCAAukCgF8Lphbh9O+cp/Z2IcvFRLGUN5rcG5Kzw/YldVucbImsGbGrSQ2FR1a00I8DlT/Y8BzVcwX7/ll8ii8VffH3IDc7W70zu/cX/dTBQBsaWJyYXJ5L2NvcmUvc3JjL251bS9mbHQyZGVjL3N0cmF0ZWd5L2RyYWdvbi5yc2Fzc2VydGlvbiBmYWlsZWQ6IGQubWFudCA+IDAA9KwQAC8AAAB1AAAABQAAAGFzc2VydGlvbiBmYWlsZWQ6IGQubWludXMgPiAwAAAA9KwQAC8AAAB2AAAABQAAAGFzc2VydGlvbiBmYWlsZWQ6IGQucGx1cyA+IDD0rBAALwAAAHcAAAAFAAAAYXNzZXJ0aW9uIGZhaWxlZDogZC5tYW50LmNoZWNrZWRfYWRkKGQucGx1cykuaXNfc29tZSgpAAD0rBAALwAAAHgAAAAFAAAAYXNzZXJ0aW9uIGZhaWxlZDogZC5tYW50LmNoZWNrZWRfc3ViKGQubWludXMpLmlzX3NvbWUoKQD0rBAALwAAAHkAAAAFAAAAYXNzZXJ0aW9uIGZhaWxlZDogYnVmLmxlbigpID49IE1BWF9TSUdfRElHSVRTAAAA9KwQAC8AAAB6AAAABQAAAPSsEAAvAAAAwQAAAAkAAAD0rBAALwAAAPkAAABUAAAA9KwQAC8AAAD6AAAADQAAAPSsEAAvAAAAAQEAADMAAAD0rBAALwAAAAoBAAAFAAAA9KwQAC8AAAALAQAABQAAAPSsEAAvAAAADAEAAAUAAAD0rBAALwAAAA0BAAAFAAAA9KwQAC8AAAAOAQAABQAAAPSsEAAvAAAASwEAAB8AAAD0rBAALwAAAGUBAAANAAAA9KwQAC8AAABxAQAAJAAAAPSsEAAvAAAAdgEAAFQAAAD0rBAALwAAAIMBAAAzAAAAAAAAAN9FGj0DzxrmwfvM/gAAAADKxprHF/5wq9z71P4AAAAAT9y8vvyxd//2+9z+AAAAAAzWa0HvkVa+Efzk/gAAAAA8/H+QrR/QjSz87P4AAAAAg5pVMShcUdNG/PT+AAAAALXJpq2PrHGdYfz8/gAAAADLi+4jdyKc6nv8BP8AAAAAbVN4QJFJzK6W/Az/AAAAAFfOtl15EjyCsfwU/wAAAAA3VvtNNpQQwsv8HP8AAAAAT5hIOG/qlpDm/CT/AAAAAMc6giXLhXTXAP0s/wAAAAD0l7+Xzc+GoBv9NP8AAAAA5awqF5gKNO81/Tz/AAAAAI6yNSr7ZziyUP1E/wAAAAA7P8bS39TIhGv9TP8AAAAAus3TGidE3cWF/VT/AAAAAJbJJbvOn2uToP1c/wAAAACEpWJ9JGys27r9ZP8AAAAA9tpfDVhmq6PV/Wz/AAAAACbxw96T+OLz7/10/wAAAAC4gP+qqK21tQr+fP8AAAAAi0p8bAVfYocl/oT/AAAAAFMwwTRg/7zJP/6M/wAAAABVJrqRjIVOllr+lP8AAAAAvX4pcCR3+d90/pz/AAAAAI+45bifvd+mj/6k/wAAAACUfXSIz1+p+Kn+rP8AAAAAz5uoj5NwRLnE/rT/AAAAAGsVD7/48AiK3/68/wAAAAC2MTFlVSWwzfn+xP8AAAAArH970MbiP5kU/8z/AAAAAAY7KyrEEFzkLv/U/wAAAADTknNpmSQkqkn/3P8AAAAADsoAg/K1h/1j/+T/AAAAAOsaEZJkCOW8fv/s/wAAAADMiFBvCcy8jJn/9P8AAAAALGUZ4lgXt9Gz//z/AEHW48IACwVAnM7/BABB5OPCAAvwFBCl1Ojo/wwAAAAAAAAAYqzF63itAwAUAAAAAACECZT4eDk/gR4AHAAAAAAAsxUHyXvOl8A4ACQAAAAAAHBc6nvOMn6PUwAsAAAAAABogOmrpDjS1W0ANAAAAAAARSKaFyYnT5+IADwAAAAAACf7xNQxomPtogBEAAAAAACorciMOGXesL0ATAAAAAAA22WrGo4Ix4PYAFQAAAAAAJodcUL5HV3E8gBcAAAAAABY5xumLGlNkg0BZAAAAAAA6o1wGmTuAdonAWwAAAAAAEp375qZo22iQgF0AAAAAACFa320e3gJ8lwBfAAAAAAAdxjdeaHkVLR3AYQAAAAAAMLFm1uShluGkgGMAAAAAAA9XZbIxVM1yKwBlAAAAAAAs6CX+ly0KpXHAZwAAAAAAONfoJm9n0be4QGkAAAAAAAljDnbNMKbpfwBrAAAAAAAXJ+Yo3KaxvYWArQAAAAAAM6+6VRTv9y3MQK8AAAAAADiQSLyF/P8iEwCxAAAAAAApXhc05vOIMxmAswAAAAAAN9TIXvzWhaYgQLUAAAAAAA6MB+X3LWg4psC3AAAAAAAlrPjXFPR2ai2AuQAAAAAADxEp6TZfJv70ALsAAAAAAAQRKSnTEx2u+sC9AAAAAAAGpxAtu+Oq4sGA/wAAAAAACyEV6YQ7x/QIAMEAQAAAAApMZHp5aQQmzsDDAEAAAAAnQycofubEOdVAxQBAAAAACn0O2LZICiscAMcAQAAAACFz6d6XktEgIsDJAEAAAAALd2sA0DkIb+lAywBAAAAAI//RF4vnGeOwAM0AQAAAABBuIycnRcz1NoDPAEAAAAAqRvjtJLbGZ71A0QBAAAAANl337puv5brDwRMAQAAAABsaWJyYXJ5L2NvcmUvc3JjL251bS9mbHQyZGVjL3N0cmF0ZWd5L2dyaXN1LnJzAABwtBAALgAAAH0AAAAVAAAAcLQQAC4AAACpAAAABQAAAHC0EAAuAAAAqgAAAAUAAABwtBAALgAAAKsAAAAFAAAAcLQQAC4AAACsAAAABQAAAHC0EAAuAAAArQAAAAUAAABwtBAALgAAAK4AAAAFAAAAYXNzZXJ0aW9uIGZhaWxlZDogZC5tYW50ICsgZC5wbHVzIDwgKDEgPDwgNjEpAAAAcLQQAC4AAACvAAAABQAAAHC0EAAuAAAACgEAABEAAABhdHRlbXB0IHRvIGRpdmlkZSBieSB6ZXJvAAAAcLQQAC4AAAANAQAACQAAAHC0EAAuAAAAFgEAAEIAAABwtBAALgAAAEABAAAJAAAAcLQQAC4AAABHAQAAQgAAAGFzc2VydGlvbiBmYWlsZWQ6ICFidWYuaXNfZW1wdHkoKWNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWVwtBAALgAAANwBAAAFAAAAYXNzZXJ0aW9uIGZhaWxlZDogZC5tYW50IDwgKDEgPDwgNjEpcLQQAC4AAADdAQAABQAAAHC0EAAuAAAA3gEAAAUAAABwtBAALgAAACMCAAARAAAAcLQQAC4AAAAmAgAACQAAAHC0EAAuAAAAXAIAAAkAAABwtBAALgAAALwCAABHAAAAcLQQAC4AAADTAgAASwAAAHC0EAAuAAAA3wIAAEcAAABsaWJyYXJ5L2NvcmUvc3JjL251bS9mbHQyZGVjL21vZC5ycwC8thAAIwAAALwAAAAFAAAAYXNzZXJ0aW9uIGZhaWxlZDogYnVmWzBdID4gYlwnMFwnAAAAvLYQACMAAAC9AAAABQAAAGFzc2VydGlvbiBmYWlsZWQ6IHBhcnRzLmxlbigpID49IDQAALy2EAAjAAAAvgAAAAUAAAAwLi4tKzBpbmZOYU5hc3NlcnRpb24gZmFpbGVkOiBidWYubGVuKCkgPj0gbWF4bGVuAAAAvLYQACMAAAB/AgAADQAAACkuLgCdtxAAAgAAAABpbmRleCBvdXQgb2YgYm91bmRzOiB0aGUgbGVuIGlzICBidXQgdGhlIGluZGV4IGlzIACptxAAIAAAAMm3EAASAAAAOgAAAGyrEAAAAAAA7LcQAAEAAADstxAAAQAAAHBhbmlja2VkIGF0ICcnLCAUuBAAAQAAABW4EAADAAAAOQEAAAAAAAABAAAAOgEAAGyrEAAAAAAAOQEAAAQAAAAEAAAAOwEAAG1hdGNoZXMhPT09YXNzZXJ0aW9uIGZhaWxlZDogYChsZWZ0ICByaWdodClgCiAgbGVmdDogYGAsCiByaWdodDogYGA6IAAAAFu4EAAZAAAAdLgQABIAAACGuBAADAAAAJK4EAADAAAAYAAAAFu4EAAZAAAAdLgQABIAAACGuBAADAAAALi4EAABAAAAOiAAAGyrEAAAAAAA3LgQAAIAAAA5AQAADAAAAAQAAAA8AQAAPQEAAD4BAAAgICAgIHsKLAosICB7IH0gfSgKKCwAAAA5AQAABAAAAAQAAAA/AQAAbGlicmFyeS9jb3JlL3NyYy9mbXQvbnVtLnJzADC5EAAbAAAAZQAAABQAAAAweDAwMDEwMjAzMDQwNTA2MDcwODA5MTAxMTEyMTMxNDE1MTYxNzE4MTkyMDIxMjIyMzI0MjUyNjI3MjgyOTMwMzEzMjMzMzQzNTM2MzczODM5NDA0MTQyNDM0NDQ1NDY0NzQ4NDk1MDUxNTI1MzU0NTU1NjU3NTg1OTYwNjE2MjYzNjQ2NTY2Njc2ODY5NzA3MTcyNzM3NDc1NzY3Nzc4Nzk4MDgxODI4Mzg0ODU4Njg3ODg4OTkwOTE5MjkzOTQ5NTk2OTc5ODk5AAA5AQAABAAAAAQAAABAAQAAQQEAAEIBAABsaWJyYXJ5L2NvcmUvc3JjL2ZtdC9tb2QucnMAQLoQABsAAABHBgAAHgAAADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDBAuhAAGwAAAEEGAAAtAAAAQLoQABsAAAAzCAAACQAAADkBAAAIAAAABAAAADQBAAB0cnVlZmFsc2UAAABAuhAAGwAAAH8JAAAeAAAAQLoQABsAAACGCQAAFgAAACgpbGlicmFyeS9jb3JlL3NyYy9zbGljZS9tZW1jaHIucnMAAAq7EAAgAAAAaAAAACcAAAByYW5nZSBzdGFydCBpbmRleCAgb3V0IG9mIHJhbmdlIGZvciBzbGljZSBvZiBsZW5ndGggPLsQABIAAABOuxAAIgAAAHJhbmdlIGVuZCBpbmRleCCAuxAAEAAAAE67EAAiAAAAc2xpY2UgaW5kZXggc3RhcnRzIGF0ICBidXQgZW5kcyBhdCAAoLsQABYAAAC2uxAADQAAAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAEGW+cIACzMCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDBAQEBAQAQdT5wgALUWxpYnJhcnkvY29yZS9zcmMvc3RyL2xvc3N5LnJzAAAA1LwQAB0AAABbAAAAJgAAANS8EAAdAAAAYgAAAB4AAABceAAAFL0QAAIAAAAAAAAAAgBBsPrCAAvYGQIAAAAIAAAAIAAAAAMAAABbLi4uXWJ5dGUgaW5kZXggIGlzIG91dCBvZiBib3VuZHMgb2YgYAAARb0QAAsAAABQvRAAFgAAALi4EAABAAAAYmVnaW4gPD0gZW5kICggPD0gKSB3aGVuIHNsaWNpbmcgYAAAgL0QAA4AAACOvRAABAAAAJK9EAAQAAAAuLgQAAEAAAAgaXMgbm90IGEgY2hhciBib3VuZGFyeTsgaXQgaXMgaW5zaWRlICAoYnl0ZXMgKSBvZiBgRb0QAAsAAADEvRAAJgAAAOq9EAAIAAAA8r0QAAYAAAC4uBAAAQAAAGxpYnJhcnkvY29yZS9zcmMvc3RyL21vZC5ycwAgvhAAGwAAAAcBAAAdAAAAbGlicmFyeS9jb3JlL3NyYy91bmljb2RlL3ByaW50YWJsZS5ycwAAAEy+EAAlAAAACgAAABwAAABMvhAAJQAAABoAAAA2AAAAAAEDBQUGBgIHBggHCREKHAsZDBoNEA4MDwQQAxISEwkWARcEGAEZAxoHGwEcAh8WIAMrAy0LLgEwAzECMgGnAqkCqgSrCPoC+wX9Av4D/wmteHmLjaIwV1iLjJAc3Q4PS0z7/C4vP1xdX+KEjY6RkqmxurvFxsnK3uTl/wAEERIpMTQ3Ojs9SUpdhI6SqbG0urvGys7P5OUABA0OERIpMTQ6O0VGSUpeZGWEkZudyc7PDREpOjtFSVdbXF5fZGWNkam0urvFyd/k5fANEUVJZGWAhLK8vr/V1/Dxg4WLpKa+v8XHz9rbSJi9zcbOz0lOT1dZXl+Jjo+xtre/wcbH1xEWF1tc9vf+/4Btcd7fDh9ubxwdX31+rq9/u7wWFx4fRkdOT1haXF5+f7XF1NXc8PH1cnOPdHWWJi4vp6+3v8fP19+aQJeYMI8f0tTO/05PWlsHCA8QJy/u725vNz0/QkWQkVNndcjJ0NHY2ef+/wAgXyKC3wSCRAgbBAYRgawOgKsFHwmBGwMZCAEELwQ0BAcDAQcGBxEKUA8SB1UHAwQcCgkDCAMHAwIDAwMMBAUDCwYBDhUFTgcbB1cHAgYXDFAEQwMtAwEEEQYPDDoEHSVfIG0EaiWAyAWCsAMaBoL9A1kHFgkYCRQMFAxqBgoGGgZZBysFRgosBAwEAQMxCywEGgYLA4CsBgoGLzFNA4CkCDwDDwM8BzgIKwWC/xEYCC8RLQMhDyEPgIwEgpcZCxWIlAUvBTsHAg4YCYC+InQMgNYaDAWA/wWA3wzynQM3CYFcFIC4CIDLBQoYOwMKBjgIRggMBnQLHgNaBFkJgIMYHAoWCUwEgIoGq6QMFwQxoQSB2iYHDAUFgKYQgfUHASAqBkwEgI0EgL4DGwMPDQAGAQEDAQQCBQcHAggICQIKBQsCDgQQARECEgUTERQBFQIXAhkNHAUdCB8BJAFqBGsCrwOxArwCzwLRAtQM1QnWAtcC2gHgBeEC5wToAu4g8AT4AvoD+wEMJzs+Tk+Pnp6fe4uTlqKyuoaxBgcJNj0+VvPQ0QQUGDY3Vld/qq6vvTXgEoeJjp4EDQ4REikxNDpFRklKTk9kZVy2txscBwgKCxQXNjk6qKnY2Qk3kJGoBwo7PmZpj5IRb1+/7u9aYvT8/1NUmpsuLycoVZ2goaOkp6iturzEBgsMFR06P0VRpqfMzaAHGRoiJT4/5+zv/8XGBCAjJSYoMzg6SEpMUFNVVlhaXF5gY2Vma3N4fX+KpKqvsMDQrq9ub76TXiJ7BQMELQNmAwEvLoCCHQMxDxwEJAkeBSsFRAQOKoCqBiQEJAQoCDQLTkOBNwkWCggYO0U5A2MICTAWBSEDGwUBQDgESwUvBAoHCQdAICcEDAk2AzoFGgcEDAdQSTczDTMHLggKgSZSSysIKhYaJhwUFwlOBCQJRA0ZBwoGSAgnCXULQj4qBjsFCgZRBgEFEAMFgItiHkgICoCmXiJFCwoGDRM6Bgo2LAQXgLk8ZFMMSAkKRkUbSAhTDUkHCoD2RgodA0dJNwMOCAoGOQcKgTYZBzsDHFYBDzINg5tmdQuAxIpMYw2EMBAWj6qCR6G5gjkHKgRcBiYKRgooBROCsFtlSwQ5BxFABQsCDpf4CITWKgmi54EzDwEdBg4ECIGMiQRrBQ0DCQcQkmBHCXQ8gPYKcwhwFUZ6FAwUDFcJGYCHgUcDhUIPFYRQHwYGgNUrBT4hAXAtAxoEAoFAHxE6BQGB0CqC5oD3KUwECgQCgxFETD2AwjwGAQRVBRs0AoEOLARkDFYKgK44HQ0sBAkHAg4GgJqD2AQRAw0DdwRfBgwEAQ8MBDgICgYoCCJOgVQMHQMJBzYIDgQJBwkHgMslCoQGbGlicmFyeS9jb3JlL3NyYy91bmljb2RlL3VuaWNvZGVfZGF0YS5yc2xpYnJhcnkvY29yZS9zcmMvbnVtL2JpZ251bS5ycwAAOMQQAB4AAACsAQAAAQAAAGFzc2VydGlvbiBmYWlsZWQ6IG5vYm9ycm93YXNzZXJ0aW9uIGZhaWxlZDogZGlnaXRzIDwgNDBhc3NlcnRpb24gZmFpbGVkOiBvdGhlciA+IDBUcnlGcm9tSW50RXJyb3IAAAA5AQAABAAAAAQAAABDAQAAU29tZU5vbmU5AQAABAAAAAQAAABEAQAARXJyb3JVdGY4RXJyb3J2YWxpZF91cF90b2Vycm9yX2xlbgAAOQEAAAQAAAAEAAAARQEAABDEEAAoAAAAUAAAACgAAAAQxBAAKAAAAFwAAAAWAAAAAAMAAIMEIACRBWAAXROgABIXIB8MIGAf7yygKyowICxvpuAsAqhgLR77YC4A/iA2nv9gNv0B4TYBCiE3JA3hN6sOYTkvGKE5MBxhSPMeoUxANGFQ8GqhUU9vIVKdvKFSAM9hU2XRoVMA2iFUAODhVa7iYVfs5CFZ0OihWSAA7lnwAX9aAHAABwAtAQEBAgECAQFICzAVEAFlBwIGAgIBBCMBHhtbCzoJCQEYBAEJAQMBBSsDPAgqGAEgNwEBAQQIBAEDBwoCHQE6AQEBAgQIAQkBCgIaAQICOQEEAgQCAgMDAR4CAwELAjkBBAUBAgQBFAIWBgEBOgEBAgEECAEHAwoCHgE7AQEBDAEJASgBAwE3AQEDBQMBBAcCCwIdAToBAgECAQMBBQIHAgsCHAI5AgEBAgQIAQkBCgIdAUgBBAECAwEBCAFRAQIHDAhiAQIJCwdJAhsBAQEBATcOAQUBAgULASQJAWYEAQYBAgICGQIEAxAEDQECAgYBDwEAAwADHQIeAh4CQAIBBwgBAgsJAS0DAQF1AiIBdgMEAgkBBgPbAgIBOgEBBwEBAQECCAYKAgEwHzEEMAcBAQUBKAkMAiAEAgIBAzgBAQIDAQEDOggCApgDAQ0BBwQBBgEDAsZAAAHDIQADjQFgIAAGaQIABAEKIAJQAgABAwEEARkCBQGXAhoSDQEmCBkLLgMwAQIEAgInAUMGAgICAgwBCAEvATMBAQMCAgUCAQEqAggB7gECAQQBAAEAEBAQAAIAAeIBlQUAAwECBQQoAwQBpQIABAACUANGCzEEewE2DykBAgIKAzEEAgIHAT0DJAUBCD4BDAI0CQoEAgFfAwIBAQIGAQIBnQEDCBUCOQIBAQEBFgEOBwMFwwgCAwEBFwFRAQIGAQECAQECAQLrAQIEBgIBAhsCVQgCAQECagEBAQIGAQFlAwIEAQUACQEC9QEKAgEBBAGQBAICBAEgCigGAgQIAQkGAgMuDQECAAcBBgEBUhYCBwECAQJ6BgMBAQIBBwEBSAIDAQEBAAILAjQFBQEBAQABBg8ABTsHAAE/BFEBAAIALgIXAAEBAwQFCAgCBx4ElAMANwQyCAEOARYFAQ8ABwERAgcBAgEFZAGgBwABPQQABAAHbQcAYIDwAAAAAAA/AAAAvwMAAAAEAAAABAAAAAYAAACD+aIARE5uAPwpFQDRVycA3TT1AGLbwAA8mZUAQZBDAGNR/gC73qsAt2HFADpuJADSTUIASQbgAAnqLgAcktEA6x3+ACmxHADoPqcA9TWCAES7LgCc6YQAtCZwAEF+XwDWkTkAU4M5AJz0OQCLX4QAKPm9APgfOwDe/5cAD5gFABEv7wAKWosAbR9tAM9+NgAJyycARk+3AJ5mPwAt6l8Auid1AOXrxwA9e/EA9zkHAJJSigD7a+oAH7FfAAhdjQAwA1YAe/xGAPCrawAgvM8ANvSaAOOpHQBeYZEACBvmAIWZZQCgFF8AjUBoAIDY/wAnc00ABgYxAMpWFQDJqHMAe+JgAGuMwAAAAAAAAAAAQPsh+T8AAAAALUR0PgAAAICYRvg8AAAAYFHMeDsAAACAgxvwOQAAAEAgJXo4AAAAgCKC4zYAAAAAHfNpNQB7CXByb2R1Y2VycwIIbGFuZ3VhZ2UBBFJ1c3QADHByb2Nlc3NlZC1ieQMFcnVzdGMdMS42OC4yICg5ZWIzYWZlOWUgMjAyMy0wMy0yNykGd2FscnVzBjAuMTkuMAx3YXNtLWJpbmRnZW4SMC4yLjg0IChjZWE4Y2MzZDIp',
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
        const { data, extension, commands } = message.data;

        const result = applyCommands(data, extension, commands);
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

  modifyGif(url, options) {
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
      result: this.modifyGifImpl(url, options).finally(() => {
        this.isProcessing = false;
      }),
    };
  }

  async modifyGifImpl(url, options) {
    Logger.info('Got GIF request', url, options);
    const commands = this.getCommands(options);
    Logger.info('Processed request commands', commands);

    const result = await this.processCommands(url, commands);
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

  async processCommands(url, commands) {
    let data = await PromiseUtils.urlGetBuffer(url);
    const extension = url.substring(url.lastIndexOf('.')).replace('.', '');
    const worker = await this.getWorker();

    const request = {
      type: WorkerMessageType.APPLY_COMMANDS,
      data: { data, extension, commands },
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

    this.discordPermissions = BdApi.Webpack.getModule(
      (module) => {
        return typeof module.CREATE_INSTANT_INVITE === 'bigint';
      },
      { searchExports: true }
    );

    this.dispatcher = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('dispatch', 'subscribe')
    );

    this.componentDispatcher = BdApi.Webpack.getModule(
      (module) => {
        if (module.dispatchToLastSubscribed !== undefined) {
          const componentDispatcher = module;
          return componentDispatcher.emitter.listeners('SHAKE_APP').length > 0;
        }

        return false;
      },
      { searchExports: true }
    );

    this.pendingReplyDispatcher.module = BdApi.Webpack.getModule((module) => {
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

    this.userStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('getCurrentUser')
    );

    this.messageStore = BdApi.Webpack.getModule(
      BdApi.Webpack.Filters.byProps('sendMessage')
    );

    this.cloudUploader = BdApi.Webpack.getModule((module) => {
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

    BdApi.Patcher.instead(
      this.plugin.meta.name,
      modulesService.messageStore,
      'sendMessage',
      (_, args, original) => this.onSendMessage(args, original)
    );

    return Promise.resolve();
  }

  async onSendMessage(args, original) {
    const callDefault = original;

    const channelId = args[0];
    const message = args[1];
    if (channelId === undefined || !message) {
      callDefault(...args);
      return;
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
        const emote = {
          name: typeof value === 'string' ? key : value.name,
          nameAndCommand: key,
          url: typeof value === 'string' ? value : value.url,
          emoteLength: key.length,
          pos,
          spoiler: false,
          commands: [],
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
    const url = emote.url,
      name = emote.name,
      commands = emote.commands;

    if (
      url.endsWith('.gif') ||
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
        return Math.min(Math.max(sizeNumber, 32), 128);
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
  attachService;
  completionsService;
  emoteService;
  modulesService;

  start(attachService, completionsService, emoteService, modulesService) {
    this.attachService = attachService;
    this.completionsService = completionsService;
    this.emoteService = emoteService;
    this.modulesService = modulesService;

    this.changeDraftPatch();
    this.pendingReplyPatch();
    this.emojiSearchPatch();
    this.lockedEmojisPatch();

    return Promise.resolve();
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
