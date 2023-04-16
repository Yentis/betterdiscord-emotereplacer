/**
 * @name EmoteReplacer
 * @version 2.0.0
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

    this.curChannelId = channelId;
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
        imports.wbg.__wbindgen_string_new = function (arg0, arg1) {
          const ret = getStringFromWasm0(arg0, arg1);
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
        imports.wbg.__wbindgen_error_new = function (arg0, arg1) {
          const ret = new Error(getStringFromWasm0(arg0, arg1));
          return addHeapObject(ret);
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
          'AGFzbQEAAAABuAIqYAJ/fwF/YAJ/fwBgA39/fwF/YAF/AGABfwF/YAN/f38AYAR/f39/AGAGf39/f39/AGABfwF+YAV/f39/fwBgAn99AX1gBX9/f39/AX9gAAF/YAN/f30AYAAAYAJ9fQF9YAJ/fwF8YAF9AX1gBn9/f39/fwF/YAN/fX8AYAd/f39/f39/AX9gA399fQBgBH9/f38Bf2AAAXxgCH9/f39/f39/AGACf30AYAR/f35+AGAHf39/f39/fwBgCX9/f39/f35+fgBgAn9/AX5gA35/fwF/YAR/f319AGATf39/f39/f39/f39/f39/f39/fwF/YAt/f39/f39/f39/fwF/YAN/fn4AYAV/f31/fwBgBH99f38AYAV/f35/fwBgBH9+f38AYAV/f3x/fwBgBH98f38AYAF8AXwCnAkjA3diZxpfX3diaW5kZ2VuX29iamVjdF9kcm9wX3JlZgADA3diZxVfX3diaW5kZ2VuX3N0cmluZ19uZXcAAAN3YmcVX193YmluZGdlbl9zdHJpbmdfZ2V0AAEDd2JnFF9fd2JpbmRnZW5fZXJyb3JfbmV3AAADd2JnFF9fd2JpbmRnZW5faXNfb2JqZWN0AAQDd2JnGV9fd2JpbmRnZW5fanN2YWxfbG9vc2VfZXEAAAN3YmcWX193YmluZGdlbl9ib29sZWFuX2dldAAEA3diZxVfX3diaW5kZ2VuX251bWJlcl9nZXQAAQN3YmcdX193YmdfU3RyaW5nXzg4ODEwZGZlYjQwMjE5MDIAAQN3YmcaX193YmdfZ2V0XzI3ZmUzZGFjMWM0ZDAyMjQAAAN3YmcdX193YmdfbGVuZ3RoX2U0OThmYmMyNGY5YzFkNGYABAN3YmcWX193YmluZGdlbl9pc19mdW5jdGlvbgAEA3diZxtfX3diZ19uZXh0X2I3ZDUzMGMwNGZkOGIyMTcABAN3YmcbX193YmdfbmV4dF84ODU2MGVjMDZhMDk0ZGVhAAQDd2JnG19fd2JnX2RvbmVfMWViZWMwM2JiZDkxOTg0MwAEA3diZxxfX3diZ192YWx1ZV82YWM4ZGE1Y2M1YjNlZmRhAAQDd2JnH19fd2JnX2l0ZXJhdG9yXzU1ZjExNDQ0NjIyMWFhNWEADAN3YmcaX193YmdfZ2V0X2JhZjQ4NTVmOWE5ODYxODYAAAN3YmcbX193YmdfY2FsbF85NWQxZWE0ODhkMDNlNGU4AAADd2JnIV9fd2JnX3BhcnNlRmxvYXRfY2I1ZjQ2ODdhZTBiZTMzZQAQA3diZx5fX3diZ19pc0FycmF5XzM5ZDI4OTk3YmY2Yjk2YjQABAN3YmctX193YmdfaW5zdGFuY2VvZl9BcnJheUJ1ZmZlcl9hNjlmMDJlZTRjNGY1MDY1AAQDd2JnHl9fd2JnX2VudHJpZXNfNGUxMzE1Yjc3NDI0NTk1MgAEA3diZx1fX3diZ19idWZmZXJfY2Y2NWMwN2RlMzRiOWEwOAAEA3diZxpfX3diZ19uZXdfNTM3YjczNDFjZTkwYmIzMQAEA3diZxpfX3diZ19zZXRfMTc0OTllOGFhNDAwM2ViZAAFA3diZx1fX3diZ19sZW5ndGhfMjdhMmFmZThhYjQyYjA5ZgAEA3diZyxfX3diZ19pbnN0YW5jZW9mX1VpbnQ4QXJyYXlfMDFjZWJlNzljYTYwNmNjYQAEA3diZx1fX3diZ19yYW5kb21fYWZiMzI2NTUyN2NmNjdjOAAXA3diZxpfX3diZ19uZXdfYWJkYTc2ZTg4M2JhOGE1ZgAMA3diZxxfX3diZ19zdGFja182NTgyNzlmZTQ0NTQxY2Y2AAEDd2JnHF9fd2JnX2Vycm9yX2Y4NTE2NjdhZjcxYmNmYzYAAQN3YmcXX193YmluZGdlbl9kZWJ1Z19zdHJpbmcAAQN3YmcQX193YmluZGdlbl90aHJvdwABA3diZxFfX3diaW5kZ2VuX21lbW9yeQAMA8cDxQMJGAcHBw0CBgQBBwUABwYBBQYBAQAZABEDAAUFCRoCAgUFAQESBQcGEwMCBQIBBgADAQEBAQEDCwEBEwECAAMCAQABARsAHAAABwAUBA0CAAsAAAAAAAAdHgUDBgAGAwMAHwIBAQAMAAEDAwEFAQYAAAEABwQFBQUAAAEFAQEBAQEBBQUBAQUFACAACQsGCwEhBgMEFAEABwAAAAAAARUAAQQDAQAJACICBQUBBQAMFQAAAQEEAQAAAwAJAAAAAAABAAAAAAAAAAAAAAAABAMNAwAAAwEBDgABAQABAQMDAAAAAAAAAQUAAgIABgICAQcCAgEDDg4BAQALAAAAAAAAAQEBAAMAAAQFAAAAAAAFBQEGBQAAAAEBAwUGAwIFABIB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//9/T14bIBFsQX8CfyAMIAJDAACAT11xBEAgAqkMAQtBAAtBACAMGyACQ///f09eG2pBAnRqKAAACyEMIAYgDTYCWCAAQQNNDQQgASAMNgAAIAtBAWohCyABIA1qIQEgACANayIADQALCyAJIApqIQkgCEEBaiEIIAcgCmsiBw0ACwsgBkHQAmokAA8LIAZBADYCiAJBACAGQdgAakGEksAAIAZBgAJqQYiSwAAQ3QEACyAGQQA2ApQCIAZB4KHAADYCkAIgBkEBNgKMAiAGQYiiwAA2AogCIAZBADYCgAJBASAGQdgAakHgocAAIAZBgAJqQeCiwAAQ3QEAC4AbAhl/A3wjAEGwBGsiAyQAIANCADcDmAEgA0IANwOQASADQgA3A4gBIANCADcDgAEgA0IANwN4IANCADcDcCADQgA3A2ggA0IANwNgIANCADcDWCADQgA3A1AgA0IANwNIIANCADcDQCADQgA3AzggA0IANwMwIANCADcDKCADQgA3AyAgA0IANwMYIANCADcDECADQgA3AwggA0IANwMAIANCADcDuAIgA0IANwOwAiADQgA3A6gCIANCADcDoAIgA0IANwOYAiADQgA3A5ACIANCADcDiAIgA0IANwOAAiADQgA3A/gBIANCADcD8AEgA0IANwPoASADQgA3A+ABIANCADcD2AEgA0IANwPQASADQgA3A8gBIANCADcDwAEgA0IANwO4ASADQgA3A7ABIANCADcDqAEgA0IANwOgASADQgA3A9gDIANCADcD0AMgA0IANwPIAyADQgA3A8ADIANCADcDuAMgA0IANwOwAyADQgA3A6gDIANCADcDoAMgA0IANwOYAyADQgA3A5ADIANCADcDiAMgA0IANwOAAyADQgA3A/gCIANCADcD8AIgA0IANwPoAiADQgA3A+ACIANCADcD2AIgA0IANwPQAiADQgA3A8gCIANCADcDwAIgA0HgA2pBAEHQABDBAxpBjJHDACgCACIKIQcgAkEDa0EYbSIFQQAgBUEAShsiDiEGIA5BaGwhDyAOQQJ0QZyRwwBqIQUDQCAEIAdPIAQgBCAHSWogAyAEQQN0aiAGQQBIBHxEAAAAAAAAAAAFIAUoAgC3CzkDACAFQQRqIQUgBkEBaiEGIgQgB0tyRQ0AC0EAIQYDQEEAIQQgA0HAAmogBkEDdGog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DQEgACAEKQMoNwIAIABBEGogHCgCADYCACAAQQhqIARBMGopAwA3AgAMBAsCQCAHQf////8DcSAHRw0AIAOtIiogB0ECdK1+IiZCIIinDQACQAJAICanIgpFBEBBBCEVDAELIApB/////wFLDQUgCkECdCIGQQBIDQUgCkGAgICAAklBAnQhBSAGBH8gBiAFEIADBSAFCyIVRQ0BC0GokMAAKgIAISJBlJDAACgCACERIARCgICAgMAANwMoAkAgA0UNACALsyADs5UiJEMAAIA/lyIlICKUISMgC60iKEIBfSEpA0AgBEEANgIwICMgJCANs0MAAAA/kpQiHpKNIh1DAAAA32AhBUL///////////8AAn4gHYtDAAAAX10EQCAdrgwBC0KAgICAgICAgIB/C0KAgICAgICAgIB/IAUbIB1D////Xl4bQgAgHSAdWxsiJyAoICcgKFMbISsgHiAjk44iHUMAAADfYCEFAkBC////////////AAJ+IB2LQwAAAF9dBEAgHa4MAQtCgICAgICAgICAfwtCgICAgICAgICAfyAFGyAdQ////15eG0IAIB0gHVsbIiYgKSAmIClTG0IAICZCAFkbIianIgsgKyAmQgF8ICcgJkL/////D4NVG6ciCE8NACAeQwAAAL+SIR8gESgCFCEMQwAAAAAhHSALIQUDQCAFQQFqQQEgBbMgH5MgJZUgDBEKACEeIAQoAjAiBSAEKAIoRgRAIARBKGogBRCfASAEKAIwIQULIAQoAiwgBUECdGogHjgCACAEIAQoAjAiD0EBaiIJNgIwIB0gHpIhHSIFIAhHDQALIAlFDQAgBCgCLCIGIQUgCUEDcSIIBEADQCAFIAUqAgAgHZU4AgAgBUEEaiEFIAhBAWsiCA0ACwsgD0H/////A3FBA0kNACAGIAlBAnRqIQYDQCAFIAUqAgAgHZU4AgAgBUEEaiIIIAgqAgAgHZU4AgAgBUEIaiIIIAgqAgAgHZU4AgAgBUEMaiIIIAgqAgAgHZU4AgAgBUEQaiIFIAZHDQALCwJAIAdFDQBBASALayEXIAcgDWwhFiAHIA5sQQRrQQJ2IRhBACEJAkADQAJAIAQoAjAiBUUEQEMAAAAAIR5DAAAAACEfQwAAAAAhHUMAAAAAISAMAQsgASgCBCEIAkACQAJAIAkgASgCACIPSQRAIAQo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AEEjOgAADAYLIABBIjoAAAwFCyADKAJQBEAgAygCVBA7CyADQQA2AlggA0KAgICAEDcDUCADQeAAaiABIANB0ABqEE4gAy0AeSICQQ5HDQALCyADQUBrIAZBCGooAgAiATYCACADIAYpAgAiCjcDOCADKQNgIQsgAEEQaiABNgIAIAAgCjcCCCAAIAs3AgALIAMoAlBFDQEgAygCVBA7DAELIANBATYCOCADQdAAaiADQThqEN8CIANB6wBqIANB2ABqKAIANgAAIAMgAykDUDcAYyAAQSE6AAAgACADKQBgNwABIABBCGogA0HnAGopAAA3AAALIANBkAFqJAAPC0GYnMAAQStB+J7AABCJAgALswwBCX8CfwJAAkACQAJAAkACQAJAAkACQAJAAkACQCABQSBqKAIAIgogAkH//wNxIgdLBEAgAUEcaigCACAHQQF0ai8BACIFQQx2IggOAgECBAsgByAKQci3wgAQzwEACyABQRRqKAIAIgcgBUH/H3EiBEsNASAEIAdB2LfCABDPAQALIAFBCGooAgAiBCAFQf8fcSICTQ0FQRAgAUEEaigCACACQTJsaiIGLQAwIgIgAkEQTxshAiAGQQJrIQQgBkEgaiEGIANB/wFxIQsDQCACRQ0CIAJBAWshAiAEQQJqIQQgBi0AACAGQQFqIQYgC0cNAAsgBC8BACECQQAMCgtBACABQRBqKAIAIARBCXRqIANB/wFxQQF0ai8BACICQYAgSQ0JGiABQRhqIQsMAQsgAUEYaiELAkACQCAIDgIBAwALIAFBCGoiBCgCACIGIQIgASgCACAGRgRAIwBBIGsiAiQAAkACQCAGQQFqIgVFDQBBBCABKAIAIghBAXQiCSAFIAUgCUkbIgUgBUEETRsiBUEybCEJIAVBqbi9FElBAXQhDAJAIAgEQCACQQI2AhggAiAIQTJsNgIUIAIgAUEEaigCADYCEAwBCyACQQA2AhgLIAIgCSAMIAJBEGoQtAEgAigCBCEIIAIoAgBFBEAgASAFNgIAIAFBBGogCDYCAAwCCyACQQhqKAIAIgVBgYCAgHhGDQEgBUUNACAIIAUQvQMACxCYAgALIAJBIGokACAEKAIAIQILIAFBBGoiBSgCACACQTJsaiICQgA3AQAgAkEwakEAOgAAIAJBKGpCADcBACACQSBqQgA3AQAgAkEYakIANwEAIAJBEGpCADcBACACQQhqQgA3AQAgBCAEKAIAIgJBAWoiBDYCACAEDQNB7LbCAEErQci4wgAQiQIACyAFQf8fcSEEIAFBFGooAgAhBwsgBCAHTw0DIAFBEGooAgAgBEEJdGogA0H/AXFBAXRqIAo7AQAMBgsgAUEIaigCACICIAVB/x9xIgRNBEAgBCACQYi4wgAQzwEACyABQQRqKAIAIgggBEEybGoiAi0AMCIGQRBJDQQgAUEUaigCACIFIQYgASgCDCAFRgRAIAFBDGogBRCjASABKAIUIQYLIAFBEGoiAygCACAGQQl0akH/AUGABBDBAxogASABKAIUIgZBAWoiCTYCFCAJRQ0DIAMoAgAgBkEJdGoiAyAIIARBMmxqIgQtACBBAXRqIAIvAQA7AQAgAyAEQSFqLQAAQQF0aiACLwECOwEAIAMgBEEiai0AAEEBdGogAi8BBDsBACADIARBI2otAABBAXRqIAIvAQY7AQAgAyAEQSRqLQAAQQF0aiACLwEIOwEAIAMgBEElai0AAEEBdGogAi8BCjsBACADIARBJmotAABBAXRqIAIvAQw7AQAgAyAEQSdqLQAAQQF0aiACLwEOOwEAIAMgBEEoai0AAEEBdGogAi8BEDsBACADIARBKWotAABBAXRqIAIvARI7AQAgAyAEQSpqLQAAQQF0aiACLwEUOwEAIAMgBEErai0AAEEBdGogAi8BFjsBACADIARBLGotAABBAXRqIAIvARg7AQAgAyAEQS1qLQAAQQF0aiACLwEaOwEAIAMgBEEuai0AAEEBdGogAi8BHDsBACADIARBL2otAABBAXRqIAIvAR47AQAgByABQSBqKAIAIgJJBEAgAUEcaigCACAHQQF0aiAFOwEADAYLIAcgAkGYuMIAEM8BAAsgBSgCACACQTJsaiICQQE6ADAgAiADOgAgIAIgCjsBACAHIAFBIGooAgAiAkkEQCABQRxqKAIAIAdBAXRqIAZBgCByOwEADAULIAcgAkG4uMIAEM8BAAsgAiAEQei3wgAQzwEACyAEIAdB+LfCABDPAQALQey2wgBBK0GouMIAEIkCAAsgAiAGakEgaiADOgAAIAIgBkEBdGogCjsBACACQTBqIgIgAi0AAEEBajoAAAsgAUEgaiICKAIAIgQgASgCGEYEQCALIAQQpAEgAigC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CCADIAtJDQAgBEIBNwIIIARChICAgCA3AgAgDkEERg0CIAQgDkECdGooAgAhAyAMIAlBBGoiDjYCCCADIAtJDQAgBEIBNwIIIARChICAgCA3AgAgCUUNAiAEIA5BAnRqKAIAIQMgDCAJQQVqNgIICyAMIAM2AgRBASEDCyAPIA02AgQgDyADNgIAIARBEGokAAwBC0EEQQRBhK3CABDPAQALIAYoAghFDQkgBigCDCAKbCIDIAhLDQQgCiAIIANrIgRLDQUgBkEgaiABIAMgBWogChAxIAYtACQhAyAGKAIgIgRBAkcNBiADDQALQQ9BARD/AiIERQ0GIARBB2pBt6rAACkAADcAACAEQbCqwAApAAA3AABBDEEEEP8CIgNFDREgA0EPNgIIIAMgBDYCBCADQQ82AgAgB0GYpMAANgIIIAcgAzYCBCAHQQA2AgAMCQsgByAGKAAlNgAFIAdBCGogBkEoaigAADYAACAHIAYtACQ6AAQgByADNgIADAgLQQ9BARD/AiIERQ0FIARBB2pBt6rAACkAADcAACAEQbCqwAApAAA3AABBDEEEEP8CIgNFDQ8gA0EPNgIIIAMgBDYCBCADQQ82AgAgB0GYpMAANgIIIAcgAzYCBCAHQQA2AgAMBwsgAyAIQcCqwAAQmAMACyADIAhBoKrAABCXAwALIAogBEGgqsAAEJgDAAsgByAGKAAlNgAFIAdBCGogBkEoaigAADYAACAHIAM6AAQgByAENgIADAMLQQ9BARC9AwALQQ9BARC9AwALIAdBAjYCAAsgBkEwaiQAIAIoAmhBAkcNAgJAIAIoAiAiA0H/////A3EgA0cNACADQQJ0rSACKAIkIgStfiIZQiCIpw0AIBmnIAhNDQILIAgEQCAFEDsLIAJByABqIgMiAUEAOgAAIAFBAjoAASACQfQAakE4NgIAIAIgAkEkajYCcCACQTg2AmwgAiACQSBqNgJoIAJBAjYClAEgAkEDNgKMASACQeCrwAA2AogBIAJBADYCgAEgAiACQegAajYCkAEgAkHYAGogAkGAAWoQXiACQawBaiACQeAAaigCADYCACACQQY6AKABIAIgAikDWDcCpAEgAEEEaiIBIAMpAgA3AhAgASACQaABaiIFKQIANwIAIAFBGGogA0EIaikCADcCACABQQhqIAVBCGopAgA3AgAgAEEE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CWsiAiACQRB0QR91IgJzIAJrQf//A3EiAiARTRsgAyACIAZNG2o6AAAgGEEDRg0AIBRBA2oiAiACLQAAIBVBA2otAAAiCSAWQQNqLQAAIgMgF0EDai0AACICIAIgCWogA2siECACayICIAJBEHRBH3UiAnMgAmtB//8DcSIGIBAgA2siAiACQRB0QR91IgJzIAJrQf//A3EiEUsbIgMgECAJayICIAJBEHRBH3UiAnMgAmtB//8DcSICIBFNGyADIAIgBk0bajoAACAYQQRGDQAgFEEEaiICIAItAAAgFUEEai0AACIJIBZBBGotAAAiAyAXQQRqLQAAIgIgAiAJaiADayIQIAJrIgIgAkEQdEEfdSICcyACa0H//wNxIgYgECADayICIAJBEHRBH3UiAnMgAmtB//8DcSIRSxsiAyAQIAlrIgIgAkEQdEEfdSICcyACa0H//wNxIgIgEU0bIAMgAiAGTRtqOgAAIBhBBUYNACAUQQVqIgIgAi0AACAVQQVqLQAAIgkgFkEFai0AACIDIBdBBWotAAAiAiACIAlqIANrIhAgAmsiAiACQRB0QR91IgJzIAJrQf//A3EiBiAQIANrIgIgAkEQdEEfdSICcyACa0H//wNxIhFLGyIDIBAgCWsiAiACQRB0QR91IgJzIAJrQf//A3EiAiARTRsgAyACIAZNG2o6AAAgGEEGRg0AIBRBBmoiAiACLQAAIBVBBmotAAAiCSAWQQZqLQAAIgMgF0EGai0AACICIAIgCWogA2siECACayICIAJBEHRBH3UiAnMgAmtB//8DcSIGIBAgA2siAiACQRB0QR91IgJzIAJrQf//A3EiEUsbIgMgECAJayICIAJBEHRBH3UiAnMgAmtB//8DcSICIBFNGyADIAIgBk0bajoAACAYQQdGDQAgFEEHaiICIAItAAAgFUEHai0AACIJIBZBB2otAAAiAyAXQQdqLQAAIgIgAiAJaiADayIQIAJrIgIgAkEQdEEfdSICcyACa0H//wNxIgYgECADayICIAJBEHRBH3UiAnMgAmtB//8DcSIRSxsiAyAQIAlrIgIgAkEQdEEfdSICcyACa0H//wNxIgIgEU0bIAMgAiAGTRtqOgAACyAKIBJqIQpBACEQIBIgHCASayIcTQ0ACwwGCyAHIActAAAgDS0AAEEBdmo6AAACQCACQf8B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AkHYusAANgIgIAJBADYCGCACQd0ANgIUIAIgAkEQajYCKCACIAJBCGo2AhAgASACQRhqEOoBDAwLIAJBJGpBATYCACACQSxqQQA2AgAgAkHIusAANgIgIAJB+LjAADYCKCACQQA2AhggASACQRhqEOoBDAsLIAJBJGpBATYCACACQSxqQQA2AgAgAkG0usAANgIgIAJB+LjAADYCKCACQQA2AhggASACQRhqEOoBDAoLIAJBJGpBATYCACACQSxqQQA2AgAgAkGgusAANgIgIAJB+LjAADYCKCACQQA2AhggASACQRhqEOoBDAkLIAJBJGpBATYCACACQSxqQQA2AgAgAkGMusAANgIgIAJB+LjAADYCKCACQQA2AhggASACQRhqEOoBDAgLIAJBJGpBATYCACACQSxqQQA2AgAgAkH0ucAANgIgIAJB+LjAADYCKCACQQA2AhggASACQRhqEOoBDAcLIAJBJGpBATYCACACQSxqQQA2AgAgAkHkucAANgIgIAJB+LjAADYCKCACQQA2AhggASACQRhqEOoBDAYLIAJBJGpBATYCACACQSxqQQA2AgAgAkHYucAANgIgIAJB+LjAADYCKCACQQA2AhggASACQRhqEOoBDAULIAJBJGpBATYCACACQSxqQQA2AgAgAkHMucAANgIgIAJB+LjAADYCKCACQQA2AhggASACQRhqEOoBDAQLIAJBJGpBATYCACACQSxqQQA2AgAgAkG4ucAANgIgIAJB+LjAADYCKCACQQA2AhggASACQRhqEOoBDAMLIAJBJGpBATYCACACQSxqQQA2AgAgAkGgucAANgIgIAJB+LjAADYCKCACQQA2AhggASACQRhqEOoBDAILIAJBJGpBATYCACACQSxqQQA2AgAgAkGIucAANgIgIAJB+LjAADYCKCACQQA2AhggASACQRhqEOoBDAELIAEgACgCBCAAQQhqKAIAEPkCCyACQTBqJAALlgkDFX8DfQF+IwBBIGsiBSQAAkAgAEEIaigCACIERQ0AIAVBCGogAEEEaigCACILEKcDIAUgBSgCCCAFKAIMEIMDIAUoAgCzIAUoAgSzlEMAACBBlSIXIAFfDQACfwJAAkACQAJAAkACQCAEQePxuBxLDQAgBEEkbCIHQQBIDQAgBEHk8bgcSUECdCECIAcEfyAHIAIQ/wIFIAIL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C0F/QShBuIjDABDPAQALxQgBBX8CQAJAIAItAAAiBUUNACACLwECDQAgAkEEai8BAEUNAQsCQCABKAIAIgMEQCABQQAgAxsiBCgCACIBKAIAIAEoAggiA0YEQCABIANBARClASABKAIIIQMLIAEgA0EBajYCCCABKAIEIANqQSE6AAAgBQRAIAJBBGovAQAhBSACLwECAn8gBCgCACIBKAIAIAEoAggiA0cEQCABDAELIAEgA0EBEKUBIAEoAgghAyAEKAIACyECIAEgA0EBajYCCCABKAIEIANqQf8BOgAAIAIoAggiAyACKAIARwR/IAIFIAIgA0EBEKUBIAIoAgghAyAEKAIACyEBIAIgA0EBajYCCCACKAIEIANqQQs6AAAgASgCACABKAIIIgJrQQpNBEAgASACQQsQpQEgASgCCCECCyABIAJBC2o2AgggASgCBCACaiIBQfegwAApAAA3AAAgAUEHakH+oMAAKAAANgAAAn8gBCgCACIBKAIAIAEoAggiA0cEQCABDAELIAEgA0EBEKUBIAEoAgghAyAEKAIACyECIAEgA0EBajYCCCABKAIEIANqQQM6AAAgAigCCCIBIAIoAgBGBEAgAiABQQEQpQEgAigCCCEBCyACIAFBAWo2AgggAigCBCABakEBOgAABEAgBCgCACICKAIAIAIoAggiAWtBAU0EQCACIAFBAhClASACKAIIIQELIAIgAUECajYCCCACKAIEIAFqQQA7AAAMAwsgBCgCACICKAIAIAIoAggiAWtBAU0EQCACIAFBAhClASACKAIIIQELIAIgAUECajYCCCACKAIEIAFqIgEgBUGA/gNxQQh2OgABIAEgBToAAAwCCyACLQACIQYgAi8BBCEFIAItAAEhBwJ/IAQoAgAiASgCACABKAIIIgNHBEAgAQwBCyABIANBARClASABKAIIIQMgBCgCAAshAiABIANBAWo2AgggASgCBCADakH5AToAACACKAIIIgMgAigCAEcEfyACBSACIANBARClASACKAIIIQMgBCgCAAshASACIANBAWo2AgggAigCBCADakEEOgAAIAEoAggiAiABKAIARgRAIAEgAkEBEKUBIAEoAgghAgsgASACQQFqNgIIIAEoAgQgAmogBzoAACAFQYD+A3FBCHYhBwJ/IAQoAgAiASgCACABKAIIIgNr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lCALENQDEO8CIgFDAACAT10gAUMAAAAAYCIHcQRAIAGpDAELQQALIQogABDJAyEEIABBJGohACAGIARBEGooAgAiBSAFIAZwayIFTQRAQX8gCkEAIAcbIAFD//9/T14bQQJ0IQcgBEEMaigCACEEA0AgBCAGIAcgCBEFACAEIAZqIQQgBSAGayIFIAZPDQALCyACQQFqIQIgACAJRw0ACwsgA0EwaiQADwsgABDJAxogA0EANgIUIANBADYCLCADQcSkwAA2AiggA0EBNgIkIANB7KTAADYCICADQQA2AhhBASADQRRqQcSkwAAgA0EYakHEpcAAEN0BAAunBAECfyAAQfQCaigCAARAIABB8AJqKAIAEDsLIABBmAJqKAIABEAgAEGcAmooAgAQOwsgAEGwAmooAgAQOyAAQbQCaigCAARAIABBuAJqKAIAEDsLIABBwAJqKAIABEAgAEHEAmooAgAQOwsCQCAAQUBrKAIAQQJGDQACQAJAIAAoAhAOAwEAAQALIABBFGooAgBFDQAgAEEYaigCABA7CwJAAkAgAEEgaigCAA4DAQABAAsgAEEkaigCAEUNACAAQShqKAIAEDsLAkACQCAAQTBqKAIADgMBAAEACyAAQTRqKAIARQ0AIABBOGooAgAQOwsgAEHgAGooAgAiAgRAIABB3ABqKAIAIgEgAkEYbGohAgNAIAEoAgAEQCABQQRqKAIAEDsLIAFBDGooAgAEQCABQRBqKAIAEDsLIAFBGGoiASACRw0ACwsgACgCWARAIABB3ABqKAIAEDsLIABB7ABqKAIAIgEEQCABQRxsIQIgAEHoAGooAgBBFGohAQNAIAFBBGsoAgAEQCABKAIAEDsLIAFBEGsoAgAEQCABQQxrKAIAEDsLIAFBHGohASACQRxrIgINAAsLIAAoAmQEQCAAQegAaigCABA7CyAAQfAAaiIBELUBIAEoAgBFDQAgAEH0AGooAgAQOwsgACgCqAMEQCAAQawDaigCABA7CyAAKAK0AwRAIABBuANqKAIAEDsLIAAoAsADBEAgAEHEA2ooAgAQOwsL/AQBCH8jAEEQayIHJAACfyACKAIEIgQEQEEBIAAgAigCACAEIAEoAgwRAgANARoLQQAgAkEMaigCACIDRQ0AGiACKAIIIgQgA0EMbGohCCAHQQxqIQkDQAJAAkACQAJA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GkECQQMgBUHkAEkbCyEFIAJBDGohAiABIAVqIQEgA0EMayIDDQALCwJ/AkAgASAHSQRAIAcgAWsiASEDAkACQAJAIAZBA3EiAkEBaw4DAAEAAgtBACEDIAEhAgwBCyABQQF2IQIgAUEBakEBdiEDCyACQQFqIQIgAEEEaigCACEBIAAoAgAhBgNAIAJBAWsiAkUNAiAGIAggASgCEBEAAEUNAAsMAwsgACgCACAAQQRqKAIAIAQQTQwBCyAGIAEgBBBNDQFBACECA0BBACACIANGDQEaIAJBAWohAiAGIAggASgCEBEAAEUNAAsgAkEBayADSQshAiAAIAk6ACAgACAKNgIcDAELQQEhAgsgBEEQaiQAIAIL6wMBAn8gAEH0AmooAgAEQCAAQfACaigCABA7CyAAQZgCaigCAARAIABBnAJqKAIAEDsLIABBsAJqKAIAEDsgAEG0AmooAgAEQCAAQbgCaigCABA7CyAAQcACaigCAARAIABBxAJqKAIAEDsLAkAgAEFAaygCAEECRg0AAkACQCAAKAIQDgMBAAEACyAAQRRqKAIARQ0AIABBGGooAgAQOwsCQAJAIABBIGooAgAOAwEAAQALIABBJGooAgBFDQAgAEEoaigCABA7CwJAAkAgAEEwaigCAA4DAQABAAsgAEE0aigCAEUNACAAQThqKAIAEDsLIABB4ABqKAIAIgIEQCAAQdwAaigCACIBIAJBGGxqIQIDQCABKAIABEAgAUEEaigCABA7CyABQQxqKAIABEAgAUEQaigCABA7CyABQRhqIgEgAkcNAAsLIAAoAlgEQCAAQdwAaigCABA7CyAAQewAaigCACIBBEAgAUEcbCECIABB6ABqKAIAQRRqIQEDQCABQQRrKAIABEAgASgCABA7CyABQRBrKAIABEAgAUEMaygCABA7CyABQRxqIQEgAkEcayICDQALCyAAKAJkBEAgAEHoAGooAgAQOwsgAEHwAGoiARC1ASABKAIARQ0AIABB9ABqKAIAEDsLC/8xAiR/An4jAEEgayIWJAACQAJAIAEtAKABRQRAIAFBKGohAiABQQxqISMDQCABKAIQIQcCQAJAAkACQCABKAIYIgMgASgCHCILTwRAICMoAgAiCyABKQMAIicgC60iJiAmICdWG6ciA0kNASABKAIgIQUgByABKAIIIANqIAEo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AgBBAkcEQCACQRhqIAFBEGoQrwMgAkEIaiACNQIYIAI1Ahx+IAEtAIAEEPUCrUL/AYMQygFCfyACKQMIIAIpAxBCAFIbIgdCgICAgAhUBEBBAiEDAkAgB6ciBEECSQ0AIARBfnEiBUECEIADIgMNACAFQQIQvQMACyACQegAaiIGIAFBiAQQwwMaIAJBQGsgBiADIAUQUSACKAJAIgFBBkcNAiAAIARBAXYiATYCBCAAQQY2AgAgAEEMaiABNgIAIABBCGogAzYCAAwDCyACQgM3A0AgAkEgaiACQUBrEJkCIAJBhAFqIAJBOGopAwA3AgAgAkH8AGogAkEwaikDADcCACACQfQAaiACQShqKQMANwIAIAIgAikDIDcCbCAAQQM2AgAgACACKQJoNwIEIABBDGogAkHwAGopAgA3AgAgAEEUaiACQfgAaikCADcCACAAQRxqIAJBgAFqKQIANwIAIABBJGogAkGIAWooAgA2AgAgARBMDAILQZicwABBK0H4nsAAEIkCAAsgACACKQJENwIEIABBJGogAkHkAGooAgA2AgAgAEEcaiACQdwAaikCADcCACAAQRRqIAJB1ABqKQIANwIAIABBDGogAkHMAGopAgA3AgAgACABNgIAIARBAkkNACADEDsLIAJB8ARqJAALjgQCBX8BfiMAQfAEayICJAACQAJAIAFBQGsoAgBBAkcEQCACQRhqIAFBEGoQrwMgAkEIaiACNQIYIAI1Ahx+IAEtAIAEEPUCrUL/AYMQygFCfyACKQMIIAIpAxBCAFIbIgdCgICAgAhUBEBBBCEDAkAgB6ciBEEESQ0AIARBfHEiBUEEEIADIgMNACAFQQQQvQMACyACQegAaiIGIAFBiAQQwwMaIAJBQGsgBiADIAUQUSACKAJAIgFBBkcNAiAAIARBAnYiATYCBCAAQQY2AgAgAEEMaiABNgIAIABBCGogAzYCAAwDCyACQgM3A0AgAkEgaiACQUBrEJkCIAJBhAFqIAJBOGopAwA3AgAgAkH8AGogAkEwaikDADcCACACQfQAaiACQShqKQMANwIAIAIgAikDIDcCbCAAQQM2AgAgACACKQJoNwIEIABBDGogAkHwAGopAgA3AgAgAEEUaiACQfgAaikCADcCACAAQRxqIAJBgAFqKQIANwIAIABBJGogAkGIAWooAgA2AgAg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gAMiDUUNAQsgAyAGNgIIIAMgDDYCBCADIAQ2AgAgA0EQaiAGNgIAIANBDGogDTYCACAMRSAERXJFBEAgBEECdCETIAEoAgAhFCABKAIQIg5BDGohFSAOQRBqIRYgASgCBCIXIQ9BBCEJA0AgECAXaiESIBBBAWohECAEIQogFCEFIAkhAQJAAkACQAJAAkADQCAOKAIAIgcgBU0gDigCBCILIBJNckUEQCAFIAcgD2xqQQJ0IgtBBGohByALQXxGDQIgByAWKAIAIhhLDQMgAUUNBCABIAZLDQUgASANakEEayAVKAIAIAtqKAAANgAAIAVBAWohBSABQQRqIQEgCkEBayIKDQEMBgsLIAJBLGpBBzYCACACQRRqQQI2AgAgAkEcakECNgIAIAIgEjYCNCACIAU2AjAgAkHgiMAANgIQIAJBADYCCCACQQc2AiQgAiALNgI8IAIgBzYCOCACIAJBIGo2AhggAiACQThqNgIoIAIgAkEwajYCICACQQhqQdyJwAAQowIAC0F8IAdBzInAABCZAwALIAcgGEHMicAAEJgDAAtBfCABQbCLwAAQmQMACyABIAZBsIvAABCYAwALIA9BAWohDyAJIBNqIQkgDCAQRw0ACwsgAkFAayQADAMLIAYgBRC9AwALEJgCAAtB7InAAEEzQaCKwAAQmwMACyAIKgIAIhlDAAAA32AhASAAQRxqKAIAIANC////////////AAJ+IBmLQwAAAF9dBEAgGa4MAQtCgICAgICAgICAfwtCgICAgICAgICAfyABGyAZQ////15eG0IAIBkgGVsbIBwQQCADKAIIRQ0AIANBDGooAgAQOwsgACARQQFqNgIAIANBMGokAA8LQdmFwABBwABB9IbAABCJAgALQYSHwABBwgBByIfAABCJAgALhwQBCH8gASgCBCIFBEAgASgCACEEA0ACQCADQQFqIQICfyACIAMgBGotAAAiCMAiCUEATg0AGgJAAkACQAJAAkACQAJAIAhBtPfCAGotAABBAmsOAwABAggLQYjvwgAgAiAEaiACIAVPGy0AAEHAAXFBgAFHDQcgA0ECagwGC0GI78IAIAIgBGogAiAFTxssAAAhByAIQeABayIGRQ0BIAZBDUYNAgwDC0GI78IAIAIgBGogAiAFTxssAAAhBgJAAkACQAJAIAhB8AFrDgUBAAAA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wAA2AiAgBEEANgIYIAQgBEEIajYCKAJ/IwBBQGoiASQAIAFBADYCCCABQoCAgIAQNwMAIAFBEGoiAiABQdy2wAAQvAIgBEEYaiACEOgBRQRAIAEoAgQgASgCCBADIAEoAgAEQCABKAIEEDsLIAFBQGskAAwBC0H0tsAAQTcgAUE4akGst8AAQYi4wAAQyAEACyAEQTBqJAAgCEUgB0VyRQRAIAUQOwsCQCAARQ0AIAMoAiBFDQAgBRA7CyADQdAAaiQAC6MOAgN/AX4jAEEwayIDJAACfwJAAkACQAJAAkACQCAAKAIAQQFrDgUBAgMEBQALIwBBMGsiAiQAAn8CQCAAQQRqIgAoAhBFBEAgAC0AAEEDRw0BIAJBFGpBATYCACACQRxqQQA2AgAgAkGMysAANgIQIAJByMTAADYCGCACQQA2AgggASACQQhqEOoBDAILIAIgAEEQajYCBCACQRRqQQI2AgAgAkEcakECNgIAIAJBLGpBgwE2AgAgAkHoycAANgIQIAJBADYCCCACQYIBNgIkIAIgADYCICACIAJBIGo2AhggAiACQQRqNgIoIAEgAkEIahDqAQwBCyACQRRqQQE2AgAgAkEcakEBNgIAIAJB+MnAADYCECACQQA2AgggAkGCATYCJCACIAA2AiAgAiACQSBqNgIYIAEgAkEIahDqAQsgAkEwaiQADAULIABBBGohAiAAQRRqIgAoAgBFBEAgA0EkakEBNgIAIANBLGpBATYCACADQcjJwAA2AiAgA0EANgIYIANBggE2AgwgAyACNgIIIAMgA0EIajYCKCABIANBGGoQ6gEMBQsgAyAANgIEIANBJGpBAjYCACADQSxqQQI2AgAgA0EUakGDATYCACADQbjJwAA2AiAgA0EANgIYIANBggE2AgwgAyACNgIIIAMgA0EIajYCKCADIANBBGo2AhAgASADQRhqEOoBDAQLIwBBMGsiAiQAAkACQAJAAkACQAJAIABBBGoiBCgCAEEBaw4DAAECAwtBASEAIAJBHGpBATYCACACQSRqQQA2AgAgAkHMyMAANgIYIAJByMTAADYCICACQQA2AhAgASACQRBqEOoBRQ0DDAQLIAIgBEEEajYCDEEBIQAgAkEcakEBNgIAIAJBJGpBATYCACACQYDIwAA2AhggAkEANgIQIAJBgAE2AiwgAiACQShqNgIgIAIgAkEMajYCKCABIAJBEGoQ6gFFDQIMAwtBASEAIAJBHGpBATYCACACQSRqQQA2AgAgAkHcx8AANgIYIAJByMTAADYCICACQQA2AhAgASACQRBqEOoBRQ0BDAILQQEhACACQRxqQQE2AgAgAkEkakEANgIAIAJBjMnAADYCGCACQcjEwAA2AiAgAkEANgIQIAEgAkEQahDqAQ0BCyAEKAIQRQRAQQAhAAwBCyACIARBEGo2AgwgAkEcakEBNgIAIAJBJGpBATYCACACQZjJwAA2AhggAkEANgIQIAJBgwE2AiwgAiACQShqNgIgIAIgAkEMajYCKCABIAJBEGoQ6gEhAAsgAkEwaiQAIAAMAwsCQAJAAkBBAiAAKQMIIgWnQQJrIAVCAVgbQQFrDgIBAgALIANBJGpBATYCACADQSxqQQA2AgAgA0Gcy8AANgIgIANByMTAADYCKCADQQA2AhggASADQRhqEOoBDAQLIANBJGpBATYCACADQSxqQQA2AgAgA0GAy8AANgIgIANByMTAADYCKCADQQA2AhggASADQRhqEOoBDAMLIANBJGpBATYCACADQSxqQQA2AgAgA0HkysAANgIgIANByMTAADYCKCADQQA2AhggASADQRhqEOoBDAILIwBBMGsiAiQAAn8CQAJAAkACQAJAAkBBASAAQQRqIgAtAAAiBEEEayAEQQNNG0H/AXFBAWsOAgECAAsgAiAAQQFqNgIEIAJBFGpBAzYCACACQRxqQQI2AgAgAkEsakGEATYCACACQZzHwAA2AhAgAkEANgIIIAJBggE2AiQgAiAAQRBqNgIgIAIgAkEgajYCGCACIAJBBGo2AiggASACQQhqEOoBDAULIARBAmsOAgIDAQsgAiAAQQRqNgIAIAAtABBBA0YEQCACQRRqQQE2AgAgAkEcakEBNgIAIAJBwMXAADYCECACQQA2AgggAkGAATYCJCACIAJBIGo2AhggAiACNgIgIAEgAkEIahDqAQwECyACIABBEGo2AgQgAkEUakECNgIAIAJBHGpBAjYCACACQSxqQYABNgIAIAJBgMXAADYCECACQQA2AgggAkGFATYCJCACIAJBIGo2AhggAiACNgIoIAIgAkEEajYCICABIAJBCGoQ6gEMAwsgAiAANgIEIAJBFGpBAjYCACACQRxqQQE2AgAgAkHsxcAANgIQIAJBADYCCCACQYUBNgIkIAIgAkEgajYCGCACIAJBBGo2AiAgASACQQhqEOoBDAILIAIgADYCBCACQRRqQQI2AgAgAkEcakEBNgIAIAJB6MbAADYCECACQQA2AgggAkGFATYCJCACIAJBIGo2AhggAiACQQRqNgIgIAEgAkEIahDqAQwBCyACQRRqQQE2AgAgAkEcakEANgIAIAJBpMbAADYCECACQcjEwAA2AhggAkEANgIIIAEgAkEIahDqAQsgAkEwaiQADAELIABBBGogARBrCyADQTBqJAAL/wIBAn8gAEEUaigCAARAIABBEGooAgAQOwsCQCAAQThqKAIAIgFFDQAgASAAQTxqIgEoAgAoAgARAwAgASgCACIBQQRqKAIARQ0AIAFBCGooAgAaIAAoAjgQOwsgAEHEAGooAgAEQCAAQcgAaigCABA7CyAAQdAAaigCAARAIABB1ABqKAIAEDsLIAAoAigEQCAAQSxqKAIAEDsLAkAgAEHoAGooAgAiAUECRg0AAkAgAEH8AGooAgAiAkUNACAAQfgAaigCAEUNACACEDsgACgCaCEBCyABRQ0AIABB7ABqKAIARQ0AIABB8ABqKAIAEDsLAkAgAEGwAWooAgAiAUUNACAAKAKsAUUNACABEDsLAkAgAEHYAWooAgAiAUUNACAAQdQBaigCAEUNACABEDsLAkAgACgCxAFFDQAgAEHIAWooAgBFDQAgAEHMAWooAgAQOwsgACgCuAEEQCAAQbwBaigCABA7CyAAQYgCaigCAARAIABBjAJqKAIAEDsLC5MDAQt/IwBBMGsiAyQAIANCgYCAgKABNwMgIAMgAjYCHCADQQA2AhggAyACNgIUIAMgATYCECADIAI2AgwgA0EANgIIIAAoAgQhCCAAKAIAIQkgACgCCCEKAn8DQAJAIAZFBEACQCACIARJDQADQCABIARqIQYCfyACIARrIgVBCE8EQCADQQogBiAFEH4gAygCBCEAIAMoAgAMAQtBACEAQQAgBUUNABoDQEEBIAAgBmotAABBCkYNARogBSAAQQFqIgBHDQALIAUhAEEAC0EBRwRAIAIhBAwCCyAAIARqIgBBAWohBAJAIAAgAk8NACAAIAFqLQAAQQpHDQBBACEGIAQhBSAEIQAMBAsgAiAETw0ACwtBASEGIAIiACAHIgVH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ADoADSALIAE6AAwgCyAANgIIIAtBCGogAyAEIAUgBhBzIAcgCCAJIAoQcyEBAn8gCy0ADCIAIAstAA1FDQAaIABB/wFxIQJBASACDQAaIAEoAgAiAC0AGEEEcUUEQCAAKAIAQffxwgBBAiAAKAIEKAIMEQIADAELIAAoAgBB9vHCAEEBIAAoAgQoAgwRAgALIAtBEGokAEH/AXFBAEcLrQEBAX8CQCACBEACfwJAAkACQCABQQBOBEAgAygCCEUNAiADKAIEIgQNASABDQMgAgwECyAAQQhqQQA2AgAMBQsgAygCACAEIAIgARDzAgwCCyABDQAgAgwBCyABIAIQ/wILIgMEQCAAIAM2AgQgAEEIaiABNgIAIABBADYCAA8LIAAgATYCBCAAQQhqIAI2AgAMAQsgACABNgIEIABBCGpBADYCAAsgAEEBNgIAC4gBAQN/IAAoAggiAQRAIAAoAgQhAiABQThsIQNBACEBA0AgASACaiIAQRBqKAIABEAgAEEUaigCABA7CyAAQRxqKAIABEAgAEEgaigCABA7CyAAQShqKAIABEAgAEEsaigCABA7CyAAQQRqKAIABEAgAEEIaigCABA7CyADIAFBOGoiAUcNAAsLC6sBAQF/IwBB4ABrIgEkACABQRhqIABBEGopAgA3AwAgAUEQaiAAQQhqKQIANwMAIAEgACkCADcDCCABQQA2AiggAUKAgICAEDcDICABQTBqIgAgAUEgakHUpcAAELwCIAFBCGogABDoAUUEQCABKAIkIAEoAigQAyABKAIgBEAgASgCJBA7CyABQeAAaiQADwtB7KXAAEE3IAFB2ABqQaSmwABBgKfAABDIAQALugEBAX8jAEEQayIHJAAgACgCACABIAIgACgCBCgCDBECACEBIAdBADoADSAHIAE6AAwgByAANgIIIAdBCGogAyAEIAUgBhBzIQECfyAHLQAMIgAgBy0ADUUNABogAEH/AXEhAkEBIAINABogASgCACIALQAYQQRxRQRAIAAoAgBB9/HCAEECIAAoAgQoAgwRAgAMAQsgACgCAEH28cIAQQEgACgCBCgCDBECAAsgB0EQaiQAQf8BcUEARwupAQEDfyMAQTBrIgIkACABKAIERQRAIAEoAgwhAyACQRBqIgRBADYCACACQoCAgIAQNwMIIAIgAkEIajYCFCACQShq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GGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBiPTCACACQQhqEE8gAkEgaiQAC1MBAn8jAEEgayICJAAgACgCBCEDIAAoAgAgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAyACQQhqEE8gAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBvIrAACACQQhqEE8gAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBxLbAACACQQhqEE8gAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBgNTAACACQQhqEE8gAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB6LzCACACQQhqEE8gAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBiPTCACACQQhqEE8gAkEgaiQAC00AAn9BACAAQQNJDQAaQQEgAEEETQ0AGkECIABBCUkNABpBAyAAQRFJDQAaQQQgAEEhSQ0AGkEFIABBwQBJDQAaQQZBByAAQYEBSRsLCzsAIAAoAiAEQCAAQSRqKAIAEDsLIABBLGooAgAEQCAAQTBqKAIAEDsLIABBFGooAgAEQCAAKAIQEDsLC2sBAX0CQCABKgIIIAKSIgJDAAAAAF1FBEBDAAC0QyEDIAJDAAC0Q15FDQELIAMhAgsgACABKQIMNwIMIAAgASoCBDgCBCAAIAEoAgA2AgAgAEMAAAAAIAIgAkMAALTDkotDAAAANF0bOAIIC1oBAn8CQCAALQAAQR9HDQAgAC0ABEEDRw0AIABBCGooAgAiASgCACABKAIEKAIAEQMAIAEoAgQiAkEEaigCAARAIAJBCGoo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AiQAIAJBDGpBATYCACACQRRqQQE2AgAgAkG0n8AANgIIIAJBADYCACACQSQ2AhwgAiAANgIYIAIgAkEYajYCECACIAEQowIAC1IBAX8jAEEgayIDJAAgA0EMakEBNgIAIANBFGpBADYCACADQczWwgA2AhAgA0EANgIAIAMgATYCHCADIAA2AhggAyADQRhqNgIIIAMgAhCjAgALUAEBfyMAQRBrIgIkAAJ/IAAoAgAiACgCAEUEQCABQdTUwABBBBD5AgwBCyACIAA2AgwgAUHA1MAAQQQgAkEMakHo1MAAELEBCyACQRBqJAALSAEBfyACIAAoAgAiACgCACAAKAIIIgNrSwRAIAAgAyACEKUBIAAoAgghAwsgACgCBCADaiABIAIQwwMaIAAgAiADajYCCEEAC0gBAX8gAiAAKAIAIgAoAgAgACgCCCIDa0sEQCAAIAMgAhCmASAAKAIIIQMLIAAoAgQgA2ogASACEMMDGiAAIAIgA2o2AghBAAs8AQJ/IwBBEGsiAiQAIAJBCGogACgCABAIIAIoAggiACACKAIMIgMgARC+AyADBEAgABA7CyACQRBqJAALPwEBfiAAIAHAQQN0QaD4wABqKQMAIAOtIAKtQv8Bg35+IgRC8f////8AVDYCACAAIARCB3xCA4inQQFqNgIEC0gBAX8gAiAAKAIAIgAoAgAgACgCCCIDa0sEQCAAIAMgAhCpASAAKAIIIQMLIAAoAgQgA2ogASACEMMDGiAAIAIgA2o2AghBAAtIAQF/IAIgACgCACIAKAIAIAAoAggiA2tLBEAgACADIAIQqgEgACgCCCEDCyAAKAIEIANqIAEgAhDDAxogACACIANqNgIIQQALRQEBfSAAAn8gASoCABDvAiICQwAAgE9dIAJDAAAAAGBxBEAgAqkMAQtBAAs6AAEgACACQwAAgENdIAJDAACAv15xOgAAC0gAIAAgAzYCDCAAIAI2AgggACAFNgIEIAAgBDYCACAAIAEpAgA3AhAgAEEgaiABQRBqKAIANgIAIABBGGogAUEIaikCADcCAAtDAQF/IAIgACgCACAAKAIIIgNrSwRAIAAgAyACEKUBIAAoAgghAwsgACgCBCADaiABIAIQwwMaIAAgAiADajYCCEEAC0MBAX8gAiAAKAIAIAAoAggiA2tLBEAgACADIAIQpgEgACgC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LUEADAELIBhFBEBBu+7CAEHM1sIAIAJCAFMbIS0gAkI/iKcMAQtBu+7CAEG87sIAIAJCAFMbIS1BAQshMkEBIQECfwJAAkACQAJAQQMgAEECayAAQQFNG0H/AXFBAWsOAwIBAAMLICBBIGohGSAgQQ9qIRojAEEwayIYJAACQAJAAkACQAJAAkACQCAgQeAAaiIAKQMAIgJQRQRAIAApAwgiBFBFBEAgACkDECIDUEUEQCACIAIgA3wiA1gEQCACIARaBEACQAJAIANC//////////8fWARAIBggAC8BGCIAOwEIIBggAiAEfSIENwMAIAAgAEEgayAAIANCgICAgBBUIgEbIhxBEGsgHCADQiCGIAMgARsiA0KAgICAgIDAAFQiARsiHEEIayAcIANCEIYgAyABGyIDQoCAgICAgICAAVQiARsiHEEEayAcIANCCIYgAyABGyIDQoCAgICAgICAEFQiARsiHEECayAcIANCBIYgAyABGyIDQoCAgICAgICAwABUIgEbIANCAoYgAyABGyIFQj+Hp0F/c2oiAWvBIhxBAEgNAiAYQn8gHK0iBogiAyAEgzcDECADIARUDQ0gGCAAOwEIIBggAjcDACAYIAIgA4M3AxAgAiADVg0NQaB/IAFrwUHQAGxBsKcFakHOEG0iAEHRAE8NASAAQQR0IgBBwN7CAGopAwAiB0L/////D4MiAyACIAZCP4MiAoYiCEIgiCIOfiIJQiCIIhQgB0IgiCIGIA5+fCAGIAhC/////w+DIgd+IghCIIgiFXwgCUL/////D4MgAyAHfkIgiHwgCEL/////D4N8QoCAgIAIfEIgiCEQQgFBACABIABByN7CAGovAQBqa0E/ca0iCYYiB0IBfSEMIAMgBCAChiICQiCIIgR+IghC/////w+DIAMgAkL/////D4MiAn5CIIh8IAIgBn4iAkL/////D4N8QoCAgIAIfEIgiCENIAQgBn4hBCACQiCIIQIgCEIgiCEIIABByt7CAGovAQAhAAJ/AkACQCAGIAUgBUJ/hUI/iIYiBUIgiCIRfiIWIAMgEX4iCkIgiCISfCAGIAVC/////w+DIgV+Ig9CIIgiE3wgCkL/////D4MgAyAFfkIgiHwgD0L/////D4N8QoCAgIAIfEIgiCIPfEIBfCIKIAmIpyIBQZDOAE8EQCABQcCEPUkN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QdAAahBSICBBgAFqJAAPCyAYQShBuIjDABCYAwALIBhBKEG4iMMAEM8BAAsgHEEoQbiIwwAQmAMACzkAAkACfyACQYCAxABHBEBBASAAIAIgASgCEBEAAA0BGgsgAw0BQQALDwsgACADIAQgASgCDBECAAs7AQF/IwBBEGsiAiQAIAIgACgCADYCDCABQdq/wABBDEHmv8AAQQ8gAkEMakH4v8AAELcBIAJBEGokAAs7AQF/IwBBEGsiAiQAIAIgACgCADYCDCABQfjOwABBCkGkzcAAQQQgAkEMakGEz8AAELcBIAJBEGokAAs7AQF/IwBBEGsiAiQAIAIgACgCADYCDCABQdTswABBC0Hf7MAAQQUgAkEMakHk7MAAELcBIAJBEGokAAs7AQF/IwBBEGsiAiQAIAIgACgCADYCDCABQbP3wABBDkHB98AAQQUgAkEMakHI98AAELcBIAJBEGokAAs7AQF/IwBBEGsiAiQAIAIgACgCADYCDCABQdadwgBBE0HpncIAQQogAkEMakH0ncIAELcBIAJBEGokAAs7AQF/IwBBEGsiAiQAIAIgACgCADYCDCABQcyrwgBBE0Hfq8IAQQQgAkEMakHkq8IAELcBIAJBEGokAAvkAgECfyMAQSBrIgIkACACQQE6ABggAiABNgIUIAIgADYCECACQYjwwgA2AgwgAkHM1sIANgIIIwBBEGsiASQAAkAgAkEIaiIAKAIMIgIEQCAAKAIIIgNFDQEgASACNgIIIAEgADYCBCABIAM2AgAjAEEQayIAJAAgAEEIaiABQQhqKAIANgIAIAAgASkCADcDACMAQRBrIgEkACAAKAIAIgJBFGooAgAhAwJAAn8CQAJAIAJBDGooAgAOAgABAwsgAw0CQQAhAkG0vcIADAELIAMNASACKAIIIgMoAgQhAiADKAIACyEDIAEgAjYCBCABIAM2AgAgAUH8xsIAIAAoAgQiASgCCCAAKAIIIAEtABAQrgEACyABQQA2AgQgASACNgIMIAFB6MbCACAAKAIEIgEoAgggACgCCCABLQAQEK4BAAtBtL3CAEErQbjGwgAQiQIAC0G0vcIAQStBqMbCABCJAgALNgEBfyMAQRBrIgIkACACQQhqIAEQugIgAigCDCEBIAAgAigCCDYCACAAIAE2AgQgAkEQaiQACzYBAX8jAEEQayICJAAgAkEIaiABEOECIAIoAgwhASAAIAIoAgg2AgAgACABNgIEIAJBEGokAAtJAQJ/Qa71wAAhAkEEIQMCQAJAAkAgACgCAC0AAEEBaw4CAAECCyABQaT1wABBChD5Ag8LQZz1wAAhAkEIIQMLIAEgAiADEPkCCzQBAX8gACgCACAAKAIEKAIAEQMAIAAoAgQiAUEEaigCAARAIAFBCGooAgAaIAAoAgAQOwsLOAEBfyMAQRBrIgIkACACIAA2AgwgAUHWncIAQRNB6Z3CAEEKIAJBDGpB9J3CABC3ASACQRBqJAALOAEBfyMAQRBrIgIkACACIAA2AgwgAUHMq8IAQRNB36vCAEEEIAJBDGpB5KvCABC3ASACQRBqJAALMwACQCAAQfz///8HSw0AIABFBEBBBA8LIAAgAEH9////B0lBAnQQ/wIiAEUNACAADwsACzwBAX8gAi0AA0UEQCACIAEoAAA2AAALAkACQAJAIABB/wFxQQJrDgIBAgALIAIoAAAhAwsgASADNgAACwvIAwIBfgR/IAAoAgAhACABEI4DRQRAIAEQjwNFBEAgACABEJ4DDwsjAEGAAWsiBCQAIAApAwAhAkGAASEAIARBgAFqIQUCQAJAA0AgAEUEQEEAIQAMAwsgBUEBa0EwQTcgAqciA0EPcSIGQQpJGyAGajoAACACQhBaBEAgBUECayIFQTBBNyADQf8BcSIDQaABSRsgA0EEdmo6AAAgAEECayEAIAJCgAJUIAJCCIghAkUNAQwCCwsgAEEBayEACyAAQYEBSQ0AIABBgAFBrPLCABCXAwALIAFBAUG88sIAQQIgACAEakGAASAAaxBHIARBgAFqJAAPCyMAQYABayIEJAAgACkDACECQYABIQAgBEGAAWohBQJAAkADQCAARQRAQQAhAAwDCyAFQQFrQTBB1wAgAqciA0EPcSIGQQpJGyAGajoAACACQhBaBEAgBUECayIFQTBB1wAgA0H/AXEiA0GgAUkbIANBBHZqOgAAIABBAmshACACQoACVCACQgiIIQJFDQEMAgsLIABBAWshAAsgAEGBAUkNACAAQYABQazywgAQlwMACyABQQFBvPLCAEECIAAgBGpBgAEgAGsQRyAEQYABaiQACzIAIAAoAgAhACABEI4DRQRAIAEQjwNFBEAgACABEJoDDwsgACABEL8BDwsgACABEL4BC7cBAQN/IAAoAgAhACABEI4DRQRAIAEQjwNFBEAgACABEJ0DDwsgACABEL0BDwsjAEGAAWsiAyQAIAAtAAAhAANAIAIgA2pB/wBqQTBB1wAgAEEPcSIEQQpJGyAEajoAACACQQFrIQIgACIEQQR2IQAgBEEPSw0ACyACQYABaiIAQYEBTwRAIABBgAFBrPLCABCXAwALIAFBAUG88sIAQQIgAiADakGAAWpBACACaxBHIANBgAFqJAALvQIBA38gACgCACEAIAEQjgNFBEAgARCPA0UEQCAAMwEAQQEgARB7DwsjAEGAAWsiAyQAIAAvAQAhAANAIAIgA2pB/wBqQTBBNyAAQQ9xIgRBCkkbIARqOgAAIAJBAWshAiAAIgRBBHYhACAEQQ9LDQALIAJBgAFqIgBBgQFPBEAgAEGAAUGs8sIAEJcDAAsgAUEBQbzywgBBAiACIANqQYABakEAIAJrEEcgA0GAAWokAA8LIwBBgAFrIgMkACAALwEAIQADQCACIANqQf8AakEwQdcAIABBD3EiBEEKSRsgBGo6AAAgAkEBayECIAAiBEEEdiEAIARBD0sNAAsgAkGAAWoiAEGBAU8EQCAAQYABQazywgAQlwMACyABQQFBvPLCAEECIAIgA2pBgAFqQQAgAmsQRyADQYABaiQACywBAX8jAEEQayIAJAAgAEEIaiICIAFB373CAEELEL0CIAIQ1wEgAEEQaiQACy4AIABBBDoABCAAQQQ2AgAgAEEGaiACOgAAIABBBWogAToAACAAQRRqQQA7AQALKwAgASACTwRAIAEgAmsiASAAIAFqIAIQPg8LQeCywABBIUGEs8AAEIkCAAssACAAIAEpAgA3AgAgAEEQaiABQRBqKAIANgIAIABBCGogAUEIaikCADcCAAsxACAAIAEoAgAgAiADIAEoAgQoAgwRAgA6AAggACABNgIEIAAgA0U6AAkgAEEANgIACykAIAEgAk8EQCACIAAgAmogASACaxA+DwtB4LHAAEEjQdCywAAQiQIACy4AIAEgACgCAC0AAEEEc0EHcUECdCIAQfj5wABqKAIAIABB2PnAAGooAgAQ+QILKgAgACgCAEUEQCAAKAIEIAEgAEEIaigCACgCEBEAAA8LIABBBGogARBrCywAAkAgARCOA0UEQCABEI8DDQEgACABEMECDwsgACABEL4BDwsgACABEL8BCycAIAAgACgCBEEBcSABckECcjYCBCAAIAFqIgAgACgCBEEBcjYCBAstAQF/IABBgKvCAEHEqsIAIAEtAABBBEYiAhs2AgQgACABQQFqIAEgAhs2AgALOgECf0Hsk8MALQAAIQFB7JPDAEEAOgAAQfCTwwAoAgAhAkHwk8MAQQA2AgAgACACNgIEIAAgATYCAAsxACAAQQM6ACAgAEKAgICAgAQ3AhggAEEANgIQIABBADYCCCAAIAI2AgQgACABNgIACy0AIAEoAgAgAiADIAEoAgQoAgwRAgAhAiAAQQA6AAUgACACOgAEIAAgATYCAAsgAQF/AkAgAEEEaigCACIBRQ0AIAAoAgBFDQAgARA7CwsjAAJAIAFB/P///wdNBEAgACABQQQgAhDzAiIADQELAAsgAAsjACACIAIoAgRBfnE2AgQgACABQQFyNgIEIAAgAWogATYCAAseACAAKAIAIgCtQgAgAKx9IABBAE4iABsgACABEHsLJQAgAEUEQEHEuMAAQTIQuAMACyAAIAIgAyAEIAUgASgCEBELAAsjACAAQQA2AhAgACABKQIANwIAIABBCGogAUEIaikCADcCAAsoACABIAAoAgAtAABBAnQiAEHE08AAaigCACAAQYjTwABqKAIAEPkCCygAIAEgACgCAC0AAEECdCIAQayDwQBqKAIAIABBjIPBAGooAgAQ+QILKAAgASAAKAIALQAAQQJ0IgBBpNHCAGooAgAgAEGA0MIAaigCABD5AgsfAQJ+IAApAwAiAiACQj+HIgOFIAN9IAJCAFkgARB7CyMAIABFBEBBxLjAAEEyELgDAAsgACACIAMgBCABKAIQEQYACyMAIABFBEBBxLjAAEEyELgDAAsgACACIAMgBCABKAIQERYACyMAIABFBEBBxLjAAEEyELgDAAsgACACIAMgBCABKAIQESQACyMAIABFBEBBxLjAAEEyELgDAAsgACACIAMgBCABKAIQESYACyMAIABFBEBBxLjAAEEyELgDAAsgACACIAMgBCABKAIQESgACyEAIABBsNXAADYCBCAAIAFBBGpBACABLQAAQR9GGzYCAAslACABIAAtAABBAnQiAEGk0cIAaigCACAAQYDQwgBqKAIAEPkCCx4AIAAgAUEDcjYCBCAAIAFqIgAgACgC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QfiWwQBqKAIAIAJBCHZzIgIgAEEDai0AAHNB/wFxQQJ0QfiWwQBqKAIAIAJBCHZzIQMgAEEEaiIAIAFHDQALCyAFIANBf3M2AgALIwAgAUGsq8IAQb+rwgAgACgCAC0AACIAG0ETQQ0gABsQ+QILIgAgAC0AAEUEQCABQcD1wgBBBRBBDwsgAUG89cIAQQQQQQsfACAARQRAQcS4wABBMhC4AwALIAAgAiABKAIQEQAACx0AIAEoAgBFBEAACyAAQbS9wAA2AgQgACABNgIACyIAIABBADYCGCAAQQA2AhAgAEKAgICAAjcDCCAAQgE3AwALGwAgACgCACIAQQRqKAIAIABBCGooAgAgARBCCxwAIAAoAgAiAEEEaigCACAAQQhqKAIAIAEQvgMLHAAgACABKQIANwIAIABBCGogAUEIaigCADYCAAsdACABKAIARQRAAAsgAEGMjMEANgIEIAAgATYCAAshACAAIAFBBGo2AgAgAEGQmMIAQcyYwgAgASgCABs2AgQLHQAgASgCAEUEQAALIABB6J/CADYCBCAAIAE2AgALHAAgACgCACIAKAIAIAEgAEEEaigCACgCDBEAAAscACAAKAIAIgAoAgAgASAAQQRqKAIAKAIQEQAACxwAIAAgASgCACACIAMgBCAFIAEoAgQoAgwRBwALGQEBfyAAKAIQIgEEfyABBSAAQRRqKAIACwsUACABIAEgACAAIAFdGyAAIABcGwsUACAAIAAgASAAIAFdGyABIAFcGwsRACAAwEECdEHY+MAAaigCAAsYACAAKAIAIgAoAgAgAEEEaigCACABEEILFwAgAEEEaigCACAAQQhqKAIAIAEQvgMLFgAgAEEEaigCACAAQQhqKAIAIAEQQgsSAEEZIABBAXZrQQAgAEEfRxsLFgAgACABQQFyNgIEIAAgAWogATYCAAsYACAAvEGAgICAeHFB////9wNyviAAko8LIQAgAL1CgICAgICAgICAf4NC/////////+8/hL8gAKCdCxMBAX8gAC0AOSAAQQE6ADlBAXELEAAgACABakEBa0EAIAFrcQuQBgEGfwJ/IAAhBQJAAkACQCACQQlPBEAgAyACEGgiBw0BQQAMBAtBCEEIEPICIQBBFEEIEPICIQFBEEEIEPICIQJBAEEQQQgQ8gJBAnRrIgRBgIB8IAIgACABampr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AUGAgARPBEAgAyABQT9xQYABcjoADyADIAFBBnZBP3FBgAFyOgAOIAMgAUEMdkE/cUGAAXI6AA0gAyABQRJ2QQdxQfABcjoADEEEDAELIAMgAUE/cUGAAXI6AA4gAyABQQx2QeABcjoADCADIAFBBnZBP3FBgAFyOgANQQMLIQEgASAAKAIAIAAoAggiAmtLBEAgACACIAEQqgEgACgCCCECCyAAKAIEIAJqIANBDGogARDDAxogACABIAJqNgIICyADQRBqJABBAAsOACAAKAIAGgNADAALAAt3AQF/IwBBMGsiAyQAIAMgATYCBCADIAA2AgAgA0EUakECNgIAIANBHGpBAjYCACADQSxqQTg2AgAgA0HQ9sIANgIQIANBADYCCCADQTg2AiQgAyADQSBqNgIYIAMgA0EEajYCKCADIAM2AiAgA0EIaiACEKMCAAt3AQF/IwBBMGsiAyQAIAMgATYCBCADIAA2AgAgA0EUakECNgIAIANBHGpBAjYCACADQSxqQTg2AgAgA0Hw9sIANgIQIANBADYCCCADQTg2AiQgAyADQSBqNgIYIAMgA0EEajYCKCADIAM2AiAgA0EIaiACEKMCAAt3AQF/IwBBMGsiAyQAIAMgATYCBCADIAA2AgAgA0EUakECNgIAIANBHGpBAjYCACADQSxqQTg2AgAgA0Gk98IANgIQIANBADYCCCADQTg2AiQgAyADQSBqNgIYIAMgA0EEajYCKCADIAM2AiAgA0EIaiACEKMCAAsNACAANQIAQQEgARB7C20BAX8jAEEQayIDJAAgAyABNgIMIAMgADYCCCMAQSBrIgAkACAAQQxqQQE2AgAgAEEUakEBNgIAIABBmPDCADYCCCAAQQA2AgAgAEGyAjYCHCAAIANBCGo2AhggACAAQRhqNgIQIAAgAhCjAgALDQAgACgCACABIAIQYgsNACAAMQAAQQEgARB7Cw0AIAApAwBBASABEHsLywIBA38gACgCAC0AACECIwBBgAFrIgQkAAJAAkACQAJAIAEoAhgiAEEQcUUEQCAAQSBxDQEgAq1C/wGDQQEgARB7IQIMBAtBACEAA0AgACAEakH/AGpBMEHXACACQQ9xIgNBCkkbIANqOgAAIABBAWshACACQf8BcSIDQQR2IQIgA0EPSw0ACyAAQYABaiICQYEBTw0BIAFBAUG8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BEECdHZBD3EiAkEKSRsgAmohCyAEQQFrQQAgBBshBAsgDSALIBERAABFDQALDAULIAcgCmsgCWohByAJIBNHDQEMAgsLIAYgBSACIAdB1PnCABD9AgALIAJFBEBBACECDAELIAIgBU8EQCACIAVGDQEMBwsgAiAGaiwAAEG/f0wNBgsgDSACIAZqIAUgAmsgDigCDBECAA0AIA9FDQEDQCADIBAtAAA6AB8gA0G1AjYCJCADIANBH2o2AiAgA0EBNgI8IANBATYCNCADQfj5wgA2AjAgA0EBNgIsIANBgPrCADYCKCADIANBIGo2AjggDSAOIANBKGoQTw0BIBBBAWohECAPQQFrIg8NAAsMAQtBAQwDCyADQQhqIAMQXCADKAIIIgYNAAsLIA1BIiAREQAACyADQUBrJAAMAQsgBiAFIAIgBUHk+cIAEP0CAAsgCEEgaiQACwwAIAAoAgAgARDOAwuqAQEBfyAAKAIAIQIjAEEQayIAJAACfwJAAkACQAJAIAItAABBAWsOAwECAwALIAAgAkEBajYCBCABQZDQwABBBSAAQQRqQZjQwAAQsQEMAwsgACACQQRqNgIIIAFBjNDAAEEEIABBCGpByM3AABCxAQwCCyAAIAJBBGo2AgwgAUHvz8AAQQ0gAEEMakH8z8AAELEBDAELIAFB6M/AAEEHEPkCCyAAQRBqJAALCwAgACgCACABEHkLjgQBAX8gACgCACECIwBBEGsiACQAAn8CQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIAItAABBAWsOGQECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkACyABQbfSwABBAhD5AgwZCyABQbXSwABBAhD5AgwYCyABQbLSwABBAxD5AgwXCyABQa7SwABBBBD5AgwWCyABQanSwABBBRD5AgwVCyABQafSwABBAhD5AgwUCyABQaTSwABBAxD5AgwTCyABQaDSwABBBBD5AgwSCyABQZvSwABBBRD5AgwRCyABQZnSwABBAhD5AgwQCyABQZbSwABBAxD5AgwPCyABQZLSwABBBBD5AgwOCyABQY3SwABBBRD5AgwNCyABQevRwABBAhD5AgwMCyABQejRwABBAxD5AgwLCyABQeTRwABBBBD5AgwKCyABQd/RwABB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AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMHAsgAEE0akEBNgIAIABBPGpBADYCACAAQczkwAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMGwsgAEE0akEBNgIAIABBPGpBADYCACAAQZzkwAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMGgsgAEE0akEBNgIAIABBPGpBADYCACAAQYDkwAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMGQsgAEE0akEBNgIAIABBPGpBADYCACAAQdDjwAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMGAsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEGg48AANgIwIABBADYCKCAAQaIBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOoBDBcLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABB7OLAADYCMCAAQQA2AiggAEGiATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDqAQwWCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQbziwAA2AjAgAEEANgIoIABBogE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6gEMFQsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEGM4sAANgIwIABBADYCKCAAQaIBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOoBDBQLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABB0OHAADYCMCAAQQA2AiggAEGiATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDqAQwTCyAAIAJBBGo2AiAgACACQQhqNgIkIABBNGpBAzYCACAAQTxqQQI2AgAgAEEUakGkATYCACAAQZjhwAA2AjAgAEEANgIoIABBpAE2AgwgACAAQQhqNgI4IAAgAEEgajYCECAAIABBJGo2AgggASAAQShqEOoBDBILIAAgAkEEajYCICAAIAJBCGo2AiQgAEE0akEDNgIAIABBPGpBAjYCACAAQRRqQaUBNgIAIABB1ODAADYCMCAAQQA2AiggAEGlATYCDCAAIABBCGo2AjggACAAQSRqNgIQIAAgAEEgajYCCCABIABBKGoQ6gEMEQsgAEE0akEBNgIAIABBPGpBADYCACAAQaTgwAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMEAsgACACQQJqNgIgIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akECNgIAIABBFGpBpgE2AgAgAEHw38AANgIwIABBADYCKCAAQacBNgIMIAAgAEEIajYCOCAAIABBJGo2AhAgACAAQSBqNgIIIAEgAEEoahDqAQwPCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQbTfwAA2AjAgAEEANgIoIABBpwE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6gEMDgsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEH83sAANgIwIABBADYCKCAAQagBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOoBDA0LIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABB0N7AADYCMCAAQQA2AiggAEGoATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDqAQwMCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQazewAA2AjAgAEEANgIoIABBqAE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6gEMCwsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEGI3sAANgIwIABBADYCKCAAQagBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOoBDAoLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABB5N3AADYCMCAAQQA2AiggAEGoATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDqAQwJCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQbDdwAA2AjAgAEEANgIoIABBqAE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6gEMCAsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEGA3cAANgIwIABBADYCKCAAQagBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOoBDAcLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABB1NzAADYCMCAAQQA2AiggAEGoATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDqAQwGCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQazcwAA2AjAgAEEANgIoIABBqAE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6gEMBQsgAEE0akEBNgIAIABBPGpBADYCACAAQYjcwAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMBAsgAEE0akEBNgIAIABBPGpBADYCACAAQezZwAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMAwsgACACQQRqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEGo2cAANgIwIABBADYCKCAAQakBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOoBDAILAkACQAJAAkACQAJAAkACQCACLQABQQFrDgcBAgMEBQYHAAsgAEE0akEBNgIAIABBPGpBADYCACAAQZzZwAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMCAsgAEE0akEBNgIAIABBPGpBADYCACAAQfDYwAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMBwsgAEE0akEBNgIAIABBPGpBADYCACAAQcDYwAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMBgsgAEE0akEBNgIAIABBPGpBADYCACAAQZjYwAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMBQsgAEE0akEBNgIAIABBPGpBADYCACAAQfDXwAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMBAsgAEE0akEBNgIAIABBPGpBADYCACAAQbTXwAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMAwsgAEE0akEBNgIAIABBPGpBADYCACAAQfjWwAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMAgsgAEE0akEBNgIAIABBPGpBADYCACAAQajWwAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMAQsgACACQQFqIgI2AiQgAEE0akEBNgIAIABBPGpBADYCACAAQYzawAA2AjAgAEGg1cAANgI4IABBADYCKEEBIAEgAEEoahDqAQ0AGgJAAkACQAJAIAItAAAiAg4DAQIDAAsCQAJAAkACQCACQfwBaw4DAQIDAAsgAEE0akECNgIAIABBPGpBATYCACAAQaTawAA2AjAgAEEANgIoIABBqgE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6gEMBgsgAEE0akEBNgIAIABBPGpBADYCACAAQeTbwAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMBQsgAEE0akEBNgIAIABBPGpBADYCACAAQcTbwAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMBAsgAEE0akEBNgIAIABBPGpBADYCACAAQaDbwAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMAwsgAEE0akEBNgIAIABBPGpBADYCACAAQYDbwAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMAgsgAEE0akEBNgIAIABBPGpBADYCACAAQeDawAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gEMAQsgAEE0akEBNgIAIABBPGpBADYCACAAQcTawAA2AjAgAEGg1cAANgI4IABBADYCKCABIABBKGoQ6gELIABBQGskAAsMACAAIAEpAkA3AwAL0AEBAX8gACgCACECIwBBEGsiACQAIAAgAUGY+sAAQQkQvQIgACACKAAAIgE2AgggAEGh+sAAQQQgAEEIakGo+sAAEHMgACABQX9zQQV2QQFxOgAMQbj6wABBCCAAQQxqQcD6wAAQcyAAIAFBDXZBAXE6AA1B0PrAAEEHIABBDWpBwPrAABBzIAAgAUEVdkEBcToADkHX+sAAQQggAEEOakHA+sAAEHMgACABQR12QQFxOgAPQd/6wABBCCAAQQ9qQcD6wAAQcxDXASAAQRBqJAALNAAgASAAKAIALQAAQRh0QYCAgCBqQRh1QQJ0IgBB3JbBAGooAgAgAEHAlsEAaigCABD5AgsLACAAKAIAIAEQawsMACAAKAIAIAEQ2QILDAAgACgCACABEJoDCwwAIAAoAgAgARCdAwsMACAAKAIAIAEQvgELDgAgAUGwtcIAQQsQ+QILCQAgACABECEACwoAIAAoAgRBeHELCgAgACgCBEEBcQsKACAAKAIMQQFxCwoAIAAoAgxBAXYLGgAgACABQYyUwwAoAgAiAEGXAiAAGxEBAAALCgAgAiAAIAEQQQsLACAAKAIAIAEQfwsNACABQej1wgBBAhBBC68BAQN/IAEhBQJAIAJBD00EQCAAIQEMAQsgAEEAIABrQQNxIgNqIQQgAwRAIAAhAQNAIAEgBToAACABQQFqIgEgBEkNAAsLIAQgAiADayICQXxxIgNqIQEgA0EASgRAIAVB/wFxQYGChAhsIQMDQCAEIAM2AgAgBEEEaiIEIAFJDQALCyACQQNxIQILIAIEQCABIAJqIQIDQCABIAU6AAAgAUEBaiIBIAJJDQALCyAAC0MBA38CQCACRQ0AA0AgAC0AACIEIAEtAAAiBUYEQCAAQQFqIQAgAUEBaiEBIAJBAWsiAg0BDAILCyAEIAVrIQMLIAMLswIBB38CQCACIgRBD00EQCAAIQIMAQsgAEEAIABrQQNxIgNqIQUgAwRAIAAhAiABIQYDQCACIAYtAAA6AAAgBkEBaiEGIAJBAWoiAiAFSQ0ACwsgBSAEIANrIghBfHEiB2ohAgJAIAEgA2oiA0EDcSIEBEAgB0EATA0BIANBfHEiBkEEaiEBQQAgBEEDdCIJa0EYcSEEIAYoAgAhBgNAIAUgBiAJdiABKAIAIgYgBHRyNgIAIAFBBGohASAFQQRqIgUgAkkNAAsMAQsgB0EATA0AIAMhAQNAIAUgASgCADYCACABQQRqIQEgBUEEaiIFIAJJDQALCyAIQQNxIQQgAyAHaiEBCyAEBEAgAiAEaiEDA0AgAiABLQAAOgAAIAFBAWohASACQQFqIgIgA0kNAAsLIAALlAUBB38CQAJAAn8CQCACIgMgACABa0sEQCABIANqIQUgACADaiECIANBD0sNASAADAILIANBD00EQCAAIQIMAwsgAEEAIABrQQNxIgVqIQQgBQRAIAAhAiABIQADQCACIAAtAAA6AAAgAEEBaiEAIAJBAWoiAiAESQ0ACwsgBCADIAVrIgNBfHEiBmohAgJAIAEgBWoiBUEDcSIABEAgBkEATA0BIAVBfHEiB0EEaiEBQQAgAEEDdCIIa0EYcSEJIAcoAgAhAANAIAQgACAIdiABKAIAIgAgCXRyNgIAIAFBBGohASAEQQRqIgQgAkkNAAsMAQsgBkEATA0AIAUhAQNAIAQgASgCADYCACABQQRqIQEgBEEEaiIEIAJJDQALCyADQQNxIQMgBSAGaiEBDAILIAJBfHEhAEEAIAJBA3EiBmshByAGBEAgASADakEBayEEA0AgAkEBayICIAQtAAA6AAAgBEEBayEEIAAgAkkNAAsLIAAgAyAGayIGQXxxIgNrIQJBACADayEDAkAgBSAHaiIFQQNxIgQEQCADQQBODQEgBUF8cSIHQQRrIQFBACAEQQN0IghrQRhxIQkgBygCACEEA0AgAEEEayIAIAQgCXQgASgCACIEIAh2cjYCACABQQRrIQEgACACSw0ACwwBCyADQQBODQAgASAGakEEayEBA0AgAEEEayIAIAEoAgA2AgAgAUEEayEBIAAgAksNAAsLIAZBA3EiAEUNAiADIAVqIQUgAiAAawshACAFQQFrIQEDQCACQQFrIgIgAS0AADoAACABQQFrIQEgACACSQ0ACwwBCyADRQ0AIAIgA2ohAANAIAIgAS0AADoAACABQQFqIQEgAkEBaiICIABJDQALCwsJACAAQQA2AgALDgAgAUGYvcAAQQgQ+QILCQAgAEIANwIACwgAIAAgARATCwcAIABBEGoLCQAgACABENkCCwkAIABBADoARwsJACAAQQA6ADkLCwBBhJjDACgCAEULxQMBAn8CfyMAQTBrIgIkAAJAAkACQAJAAkACQCAALQAAQQFrDgMBAgMACyACIAAoAgQ2AgwgAkEQaiIAIAFBmMTCAEECEL0CIABBmsTCAEEEIAJBDGpBoMTCABBzIAJBKDoAH0Hmw8IAQQQgAkEfakHsw8IAEHNBFEEBEP8CIgBFDQQgAEEQakH7y8IAKAAANgAAIABBCGpB88vCACkAADcAACAAQevLwgApAAA3AAAgAkEUNgIoIAIgADYCJCACQRQ2AiBB/MPCAEEHIAJBIGpBsMTCABBzENcBIQAgAigCIEUNAyACKAIkEDsMAwsgAiAALQABOgAQIAJBIGoiACABQZTEwgBBBBC0AiAAIAJBEGpB7MPCABCFARDEASEADAILIAAoAgQhACACQSBqIgMgAUHhw8IAQQUQvQIgA0Hmw8IA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QuaJ1LG6gdzqOQsNAELMo/uNlLG+1aR/Cw0AQrKvpp2d6dHb3QALDABC/fnP6MWPjMd9CwwAQrmH04mTn+XyAAsNAEKp3f7VwObf0cwACwMAAQsDAAELC/mSAxEAQYCAwAALlQVUcmllZCB0byBzaHJpbmsgdG8gYSBsYXJnZXIgY2FwYWNpdHkAABAAJAAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvYWxsb2Mvc3JjL3Jhd192ZWMucnMsABAATAAAAKoBAAAJAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9hbGxvYy9zcmMvdmVjL21vZC5yc4gAEABMAAAA1AcAACQAAAByZXNpemUAAAEAAAAAAAAAAQAAAAIAAAADAAAABAAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvc3RkL3NyYy9pby9jdXJzb3IucnMEARAATAAAAOsAAAAKAAAAb25lLXRpbWUgaW5pdGlhbGl6YXRpb24gbWF5IG5vdCBiZSBwZXJmb3JtZWQgcmVjdXJzaXZlbHlgARAAOAAAAE9uY2UgaW5zdGFuY2UgaGFzIHByZXZpb3VzbHkgYmVlbiBwb2lzb25lZAAAoAEQACoAAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9zdGQvc3JjL3N5bmMvb25jZS5ycwD/ARAATAAAAI8AAAAyAAAAAQAAAAQAAAAEAAAABQAAAAEAAAAEAAAABAAAAAYAAABzcmNcc2hha2UucnN8AhAADAAAABwAAAAVAEGghcAAC7UUYXR0ZW1wdCB0byBjYWxjdWxhdGUgdGhlIHJlbWFpbmRlciB3aXRoIGEgZGl2aXNvciBvZiB6ZXJvYXNzZXJ0aW9uIGZhaWxlZDogeCBhcyB1NjQgKyB3aWR0aCBhcyB1NjQgPD0gc2VsZi53aWR0aCgpIGFzIHU2NEM6XFVzZXJz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AAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcaW1hZ2UtMC4yNC42XC4vc3JjXGJ1ZmZlci5ycwAsChAAWwAAALcDAABGAAAASW1hZ2UgaW5kZXggIG91dCBvZiBib3VuZHMgAJgKEAAMAAAApAoQAA8AAAAsChAAWwAAALIDAAAVAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcYnl0ZW9yZGVyLTEuNC4zXHNyY1xsaWIucnMAAADUChAAWQAAALUHAAAcAAAASAkQAE8AAAC4AQAAJgAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xjb2RlY3NccG5nLnJzAFALEABfAAAA+wAAAAkAAABQCxAAXwAAAAEBAAATAAAAYXR0ZW1wdCB0byBkaXZpZGUgYnkgemVyb2ludGVybmFsIGVycm9yOiBlbnRlcmVkIHVucmVhY2hhYmxlIGNvZGUAAABQCxAAXwAAAAkBAAASAAAATWFwQWNjZXNzOjpuZXh0X3ZhbHVlIGNhbGxlZCBiZWZvcmUgbmV4dF9rZXlDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xzZXJkZS0xLjAuMTU5XHNyY1xkZVx2YWx1ZS5yc1AMEABcAAAAyAQAABsAAABuYW1lcGFyYW0AAAC8DBAABAAAAMAMEAAFAEHemcAAC/cSgL8AAADAAACAvwAAAAAAAIA/AAAAQAAAgD9leHBlY3RlZCBpbnRlcmxhY2UgaW5mb3JtYXRpb24AAPgMEAAeAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNccG5nLTAuMTcuN1xzcmNcZGVjb2Rlclxtb2QucnMgDRAAXAAAAAsCAAAsAAAAIA0QAFwAAAATAgAAHgAAAE5leHQgZnJhbWUgY2FsbGVkIHdoZW4gYWxyZWFkeSBhdCBpbWFnZSBlbmQAnA0QACsAAAAgDRAAXAAAANgBAAAhAAAATmV4dCBmcmFtZSBjYW4gbmV2ZXIgYmUgaW5pdGlhbADgDRAAHwAAACANEABcAAAA1wEAACQAAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlACANEABcAAAAjwIAADIAAAAgDRAAXAAAAHoBAAA6AAAAIA0QAFwAAAD8AgAAIAAAACANEABcAAAA/QIAADgAAAAgDRAAXAAAAAgDAAAsAAAAIA0QAFwAAAAIAwAARwAAACANEABcAAAADwMAABEAAAAgDRAAXAAAABMDAAAcAAAAQWRhbTcgaW50ZXJsYWNlZCByb3dzIGFyZSBzaG9ydGVyIHRoYW4gdGhlIGJ1ZmZlci4AACANEABcAAAATwIAABIAAAAgDRAAXAAAAFcCAAA7AAAAIA0QAFwAAABZAgAAMwAAACANEABcAAAAXQIAAD4AAAAgDRAAXAAAAF0CAAAgAAAAIA0QAFwAAABrAgAAJAAAACANEABcAAAAawIAABEAAAAgDRAAXAAAAE4CAAASAAAAIA0QAFwAAADHAQAAHQAAAGludGVybmFsIGVycm9yOiBlbnRlcmVkIHVucmVhY2hhYmxlIGNvZGU6IAAAiA8QACoAAAAgDRAAXAAAABEBAAAYAAAAZmFpbGVkIHRvIHdyaXRlIHdob2xlIGJ1ZmZlcswPEAAcAAAAFwAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWVDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xnaWYtMC4xMi4wXHNyY1xlbmNvZGVyLnJzTkVUU0NBUEUyLjAAAB8QEABYAAAAFQEAACYAAAAfEBAAWAAAAAMBAAAbAAAAHxAQAFgAAAD9AAAAJgAAAB8QEABYAAAA5QAAACYAAABHSUY4OWEAAB8QEABYAAAAxAAAACYAAAACAAAAAAAAAGNodW5rcyBjYW5ub3QgaGF2ZSBhIHNpemUgb2YgemVybwAAAOQQEAAhAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9tb2QucnMAAAAQERAATQAAAHEDAAAJAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcaW1hZ2Vwcm9jLTAuMjMuMFxzcmNcZ2VvbWV0cmljX3RyYW5zZm9ybWF0aW9ucy5yc3AREABwAAAAiQIAAA0AAABgdW53cmFwX3Rocm93YCBmYWlsZWQAAAAnAAAADAAAAAQAAAAoAAAAJwAAAAwAAAAEAAAAKQAAACgAAAAIEhAAKgAAACsAAAAsAAAALQAAAC4AAAAAAAAAY2h1bmtzIGNhbm5vdCBoYXZlIGEgc2l6ZSBvZiB6ZXJvAAAASBIQACEAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL21vZC5ycwAAAHQSEABNAAAAwAMAAAkAAAAwAAAADAAAAAQAAAAxAAAAMgAAADMAAABhIERpc3BsYXkgaW1wbGVtZW50YXRpb24gcmV0dXJuZWQgYW4gZXJyb3IgdW5leHBlY3RlZGx5ADQAAAAAAAAAAQAAADUAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2FsbG9jL3NyYy9zdHJpbmcucnMANBMQAEsAAADpCQAADgAAAG1pc3NpbmcgZmllbGQgYGCQExAADwAAAJ8TEAABAAAAdW5rbm93biBmaWVsZCBgYCwgZXhwZWN0ZWQgALATEAAPAAAAvxMQAAwAAABgLCB0aGVyZSBhcmUgbm8gZmllbGRzAACwExAADwAAANwTEAAWAAAARXJyADQAAAAEAAAABAAAADYAAABPawAANAAAAAQAAAAEAAAANwAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGdpZi0wLjEyLjBcc3JjXHJlYWRlclxtb2QucnMALBQQAFsAAAB4AQAAIwAAACwUEABbAAAAegEAABgAAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlACwUEABbAAAAggEAACsAAAAsFBAAWwAAAIMBAAAgAAAAbm8gY29sb3IgdGFibGUgYXZhaWxhYmxlIGZvciBjdXJyZW50IGZyYW1lAAAsFBAAWwAAAD8BAAArAAAAaW1hZ2UgdHJ1bmNhdGVkACwUEABbAAAARAEAABwAAABpbnRlcm5hbCBlcnJvcjogZW50ZXJlZCB1bnJlYWNoYWJsZSBjb2RlLBQQAFsAAADvAAAAFQAAAGZpbGUgZG9lcyBub3QgY29udGFpbiBhbnkgaW1hZ2UgZGF0YXVuZXhwZWN0ZWQgRU9GSW1hZ2UgZGltZW5zaW9ucyAoLCApIGFyZSB0b28gbGFyZ2UAAAC6FRAAEgAAAMwVEAACAAAAzhUQAA8AAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2NvcmUvc3JjL29wcy9hcml0aC5ycwAAAPgVEABNAAAA6AEAAAEAQeCswAALwQhhdHRlbXB0IHRvIGRpdmlkZSBieSB6ZXJvAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZUM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xjb2RlY3NcZ2lmLnJzAACnFhAAXwAAACsCAAA1AAAApxYQAF8AAAAiAgAAKAAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xidWZmZXIucnMAKBcQAFsAAAC3AwAARgAAAEltYWdlIGluZGV4ICBvdXQgb2YgYm91bmRzIACUFxAADAAAAKAXEAAPAAAAKBcQAFsAAACyAwAAFQAAADsAAAAYAQAACAAAADwAAAA9AAAAPgAAAD8AAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xjb25zb2xlX2Vycm9yX3BhbmljX2hvb2stMC4xLjdcc3JjXGxpYi5yc+wXEABoAAAAlQAAAA4AAABzcGVlZGh5cGVyc3BlZWRyZXZlcnNlcmFpbmJvd3JvdGF0ZXNwaW5yZXZzbGlkZXdpZ2dsZXNoYWtlRmFpbGVkIHRvIHBhcnNlIGNvbW1hbmRzOiCeGBAAGgAAAEZhaWxlZCB0byB3cml0ZSBmcmFtZTogAMAYEAAXAAAAYXNzZXJ0aW9uIGZhaWxlZDogbWlkIDw9IHNlbGYubGVuKCkvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL21vZC5ycwMZEABNAAAADQwAAAkAAABhc3NlcnRpb24gZmFpbGVkOiBrIDw9IHNlbGYubGVuKCkAAAADGRAATQAAADgMAAAJAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9hbGxvYy9zcmMvc2xpY2UucnMAAJQZEABKAAAAkgAAABEAAABnaWZwbmdVbnN1cHBvcnRlZCBleHRlbnNpb246IAAAAPYZEAAXAAAARmFpbGVkIHRvIGNyZWF0ZSByZWFkZXI6IAAAABgaEAAZAAAARmFpbGVkIHRvIGNvbGxlY3QgZnJhbWVzOiAAADwaEAAaAAAARmFpbGVkIHRvIGNyZWF0ZSBkeW5hbWljIGltYWdlOiBgGhAAIAAAAHNyY1x1dGlscy5yc4gaEAAMAAAAMgAAABIAQbC1wAAL8k5hdHRlbXB0IHRvIGRpdmlkZSBieSB6ZXJvAAAAiBoQAAwAAAA4AAAAIAAAAAAAAABhdHRlbXB0IHRvIGNhbGN1bGF0ZSB0aGUgcmVtYWluZGVyIHdpdGggYSBkaXZpc29yIG9mIHplcm8AAACIGhAADAAAAEsAAAAYAAAAiBoQAAwAAABOAAAAGAAAADwbEAAAAAAAQQAAAAQAAAAEAAAAQgAAAEMAAABEAAAARwAAAAwAAAAEAAAASAAAAEkAAABKAAAAYSBEaXNwbGF5IGltcGxlbWVudGF0aW9uIHJldHVybmVkIGFuIGVycm9yIHVuZXhwZWN0ZWRseQBLAAAAAAAAAAEAAAA1AAAAL3J1c3RjLzll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aW5nigAAAAQAAAAEAAAAjwAAAERlY29kaW5nigAAAAQAAAAEAAAAkAAAAFVuc3VwcG9ydGVkRXJyb3Jmb3JtYXQAAIoAAAAEAAAABAAAAJEAAABraW5kigAAAAQAAAAEAAAAkgAAAEdlbmVyaWNGZWF0dXJlAACKAAAABAAAAAQAAACTAAAARm9ybWF0Q29sb3IAigAAAAQAAAAEAAAAhAAAAEVuY29kaW5nRXJyb3J1bmRlcmx5aW5nAIoAAAAEAAAABAAAAJQAAABQYXJhbWV0ZXJFcnJvcgAAigAAAAQAAAAEAAAAlQAAAE5vTW9yZURhdGFHZW5lcmljRmFpbGVkQWxyZWFkeURpbWVuc2lvbk1pc21hdGNoRGVjb2RpbmdFcnJvckxpbWl0RXJyb3IAAIoAAAAEAAAABAAAAJYAAABsaW1pdHMAAIoAAAAEAAAABAAAAJcAAABzdXBwb3J0ZWQAAACKAAAABAAAAAQAAACYAAAASW5zdWZmaWNpZW50TWVtb3J5RGltZW5zaW9uRXJyb3JVbmtub3duUGF0aEV4dGVuc2lvbooAAAAEAAAABAAAAIEAAABOYW1lRXhhY3QAAACKAAAABAAAAAQAAAB/AAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZUM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xjb2xvci5ycwAAAFMoEABaAAAAhwEAAB4AAABSZ2JhMzJGUmdiMzJGUmdiYTE2UmdiMTZMYTE2TDE2UmdiYThSZ2I4TGE4TDhVbmtub3dumQAAAAQAAAAEAAAAmgAAAEJncmE4QmdyOFJnYmE0UmdiNExhNEw0UmdiYTJSZ2IyTGEyTDJSZ2JhMVJnYjFMYTFMMUE4AQIDBAIEBggMEAECAwQBAgMEAwRRb2lBdmlmRmFyYmZlbGRPcGVuRXhySGRySWNvQm1wRGRzVGdhVGlmZlBubVdlYlBHaWZKcGVnUG5nAAMAAAAEAAAAAwAAAAQAAAADAAAABAAAAAMAAAADAAAAAwAAAAMAAAADAAAABwAAAAgAAAAEAAAAAwAAAIQpEACAKRAAfSkQAHkpEAB2KRAAcikQAG8pEABsKRAAaSkQAGYpEABjKRAAXCkQAFQpEABQKRAATSkQAJsAAAAEAAAABAAAAJwAAACdAAAAngAAAGRlc2NyaXB0aW9uKCkgaXMgZGVwcmVjYXRlZDsgdXNlIERpc3BsYXlTb21lmwAAAAQAAAAEAAAAnwAAAE5vbmWbAAAABAAAAAQAAACgAAAAmwAAAAQAAAAEAAAAoQAAAGZhaWxlZCB0byBmaWxsIHdob2xlIGJ1ZmZlcgB4KhAAGwAAACUAAACuAAAACAAAAAQAAACvAAAArgAAAAgAAAAEAAAAsAAAAK8AAACgKhAAsQAAALIAAACzAAAAtAAAALUAAABsaW1pdHMgYXJlIGV4Y2VlZGVkANwqEAATAAAAoCoQAAAAAABObyBjb21wcmVzc2lvbiBmbGFnIGluIHRoZSBpVFh0IGNodW5rLgAAACsQACYAAABVc2luZyBhIGZsYWcgdGhhdCBpcyBub3QgMCBvciAyNTUgYXMgYSBjb21wcmVzc2lvbiBmbGFnIGZvciBpVFh0IGNodW5rLgAwKxAARwAAAFVzaW5nIGFuIHVucmVjb2duaXplZCBieXRlIGFzIGNvbXByZXNzaW9uIG1ldGhvZC4AAACAKxAAMQAAAE91dCBvZiBkZWNvbXByZXNzaW9uIHNwYWNlLiBUcnkgd2l0aCBhIGxhcmdlciBsaW1pdC68KxAANAAAAEludmFsaWQgY29tcHJlc3NlZCB0ZXh0IGRhdGEuAAAA+CsQAB0AAABObyBudWxsIHNlcGFyYXRvciBpbiB0RVh0IGNodW5rLiAsEAAgAAAAS2V5d29yZCBlbXB0eSBvciBsb25nZXIgdGhhbiA3OSBieXRlcy4AAEgsEAAmAAAAVW5yZXByZXNlbnRhYmxlIGRhdGEgaW4gdEVYdCBjaHVuay4AeCwQACMAAAAuAAAAoCoQAAAAAACkLBAAAQAAAElEQVQgb3IgZkRBVCBjaHVuayBpcyBoYXMgbm90IGVub3VnaCBkYXRhIGZvciBpbWFnZS64LBAANAAAAENvcnJ1cHQgZGVmbGF0ZSBzdHJlYW0uIPQsEAAYAAAARXJyb3IgbnVtYmVyIAAAABQtEAANAAAApCwQAAEAAABIYXMgbW9yZSBvdXRwdXQuNC0QABAAAABOZWVkcyBtb3JlIGlucHV0LgAAAEwtEAARAAAAVW5leHBlY3RlZCBkb25lIHN0YXR1cy4AaC0QABcAAABBZGxlcjMyIGNoZWNrc3VtIGZhaWxlZC6ILRAAGAAAAEludmFsaWQgaW5wdXQgcGFyYW1ldGVycy4AAACoLRAAGQAAAFVuZXhwZWN0ZWQgZW5kIG9mIGRhdGEuAMwtEAAXAAAAU3ViIGZyYW1lIGlzIG91dC1vZi1ib3VuZHMuAOwtEAAbAAAAVW5rbm93biBpbnRlcmxhY2UgbWV0aG9kIAAAABAuEAAZAAAApCwQAAEAAABVbmtub3duIGZpbHRlciBtZXRob2QgAAA8LhAAFgAAAKQsEAABAAAAVW5rbm93biBjb21wcmVzc2lvbiBtZXRob2QgAGQuEAAbAAAApCwQAAEAAABJbnZhbGlkIHNSR0IgcmVuZGVyaW5nIGludGVudCAAAJAuEAAeAAAApCwQAAEAAABJbnZhbGlkIHBoeXNpY2FsIHBpeGVsIHNpemUgdW5pdCAAAADALhAAIQAAAKQsEAABAAAASW52YWxpZCBibGVuZCBvcCAAAAD0LhAAEQAAAKQsEAABAAAASW52YWxpZCBkaXNwb3NlIG9wIAAYLxAAEwAAAKQsEAABAAAASW52YWxpZCBjb2xvciB0eXBlIAA8LxAAEwAAAKQsEAABAAAASW52YWxpZCBkaXNwb3NlIG9wZXJhdGlvbiAAAGAvEAAaAAAApCwQAAEAAABUcmFuc3BhcmVuY3kgY2h1bmsgZm91bmQgZm9yIGNvbG9yIHR5cGUgjC8QACgAAACkLBAAAQAAAEludmFsaWQgY29sb3IvZGVwdGggY29tYmluYXRpb24gaW4gaGVhZGVyOiAvxC8QACsAAADvLxAAAQAAAE1pc3NpbmcgcGFsZXR0ZSBvZiBpbmRleGVkIGltYWdlLgAAAAAwEAAhAAAATm90IGVub3VnaCBwYWxldHRlIGVudHJpZXMsIGV4cGVjdCAgZ290ICwwEAAjAAAATzAQAAUAAACkLBAAAQAAAFNlcXVlbmNlIGlzIG5vdCBpbiBvcmRlciwgZXhwZWN0ZWQgIyBnb3QgIwAAbDAQACQAAACQMBAABgAAAKQsEAABAAAAQ2h1bmsgIG11c3QgYXBwZWFyIGF0IG1vc3Qgb25jZS6wMBAABgAAALYwEAAaAAAAIG11c3QgYXBwZWFyIGJldHdlZW4gUExURSBhbmQgSURBVCBjaHVua3MuAACwMBAABgAAAOAwEAAqAAAAIGlzIGludmFsaWQgYWZ0ZXIgUExURSBjaHVuay4AAACwMBAABgAAABwxEAAdAAAAIGlzIGludmFsaWQgYWZ0ZXIgSURBVCBjaHVuay4AAACwMBAABgAAAEwxEAAdAAAAIGNodW5rIGFwcGVhcmVkIGJlZm9yZSBJSERSIGNodW5rAAAAoCoQAAAAAAB8MRAAIQAAAElEQVQgb3IgZkRBVCBjaHVuayBpcyBtaXNzaW5nLgAAsDEQAB4AAABmY1RMIGNodW5rIG1pc3NpbmcgYmVmb3JlIGZkQVQgY2h1bmsuAAAA2DEQACUAAABJSERSIGNodW5rIG1pc3NpbmcAAAgyEAASAAAAVW5leHBlY3RlZCBlbmQgb2YgZGF0YSB3aXRoaW4gYSBjaHVuay4AACQyEAAmAAAAVW5leHBlY3RlZCBlbmQgb2YgZGF0YSBiZWZvcmUgaW1hZ2UgZW5kLlQyEAAoAAAASW52YWxpZCBQTkcgc2lnbmF0dXJlLgAAhDIQABYAAABDUkMgZXJyb3I6IGV4cGVjdGVkIDB4IGhhdmUgMHggd2hpbGUgZGVjb2RpbmcgIGNodW5rLgAAAKQyEAAWAAAAujIQAAgAAADCMhAAEAAAANIyEAAHAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNccG5nLTAuMTcuN1xzcmNcZGVjb2RlclxzdHJlYW0ucnMA/DIQAF8AAADnAQAAHAAAAPwyEABfAAAA5QEAADkAAAD8MhAAXwAAAKkCAAAjAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZQD8MhAAXwAAACUDAAAcAAAA/DIQAF8AAAAkAwAAHAAAAPwyEABfAAAANAMAACAAAAD8MhAAXwAAADoDAAAnAAAA/DIQAF8AAABHAwAAJwAAAPwyEABfAAAAhAMAACcAAAD8MhAAXwAAAKEDAAAnAAAA/DIQAF8AAADTAwAAJwAAAPwyEABfAAAA7AMAACcAAAD8MhAAXwAAACwEAAAYAAAA/DIQAF8AAAAFBAAAJwAAAPwyEABfAAAAmQQAAA4AAAD8MhAAXwAAAKsEAAAcAAAA/DIQAF8AAADGBAAAIwAAAPwyEABfAAAAyAQAACUAAAD8MhAAXwAAAM8EAAAOAAAA/DIQAF8AAADRBAAAGwAAAPwyEABfAAAA0wQAABwAAAC2AAAABAAAAAQAAACiAAAAtgAAAAQAAAAEAAAAtwAAALYAAAAEAAAABAAAALgAAABQYXJ0aWFsQ2h1bmu2AAAABAAAAAQAAAC5AAAASW1hZ2VFbmRJbWFnZURhdGFGbHVzaGVkSW1hZ2VEYXRhRnJhbWVDb250cm9sAAAAtgAAAAQAAAAEAAAAugAAAEFuaW1hdGlvbkNvbnRyb2y2AAAABAAAAAQAAAC7AAAAUGl4ZWxEaW1lbnNpb25zALYAAAAEAAAABAAAALwAAABDaHVua0NvbXBsZXRlQ2h1bmtCZWdpbkhlYWRlcgAAALYAAAAEAAAABAAAAKYAAAC2AAAABAAAAAQAAACnAAAAtgAAAAQAAAAEAAAAvQAAAE5vdGhpbmdMaW1pdHNFeGNlZWRlZFBhcmFtZXRlcgAAtgAAAAQAAAAEAAAAvgAAAEZvcm1hdAAAtgAAAAQAAAAEAAAAvwAAAElvRXJyb3IAtgAAAAQAAAAEAAAAwAAAAEZvcm1hdEVycm9yaW5uZXK2AAAABAAAAAQAAADBAAAAQmFkVGV4dEVuY29kaW5nALYAAAAEAAAABAAAAMIAAABCYWRGaWx0ZXIAAAC2AAAABAAAAAQAAADDAAAATm9Nb3JlSW1hZ2VEYXRhQ29ycnVwdEZsYXRlU3RyZWFtZXJytgAAAAQAAAAEAAAAqgAAAEJhZFN1YkZyYW1lQm91bmRzVW5rbm93bkludGVybGFjZU1ldGhvZFVua25vd25GaWx0ZXJNZXRob2RVbmtub3duQ29tcHJlc3Npb25NZXRob2RJbnZhbGlkU3JnYlJlbmRlcmluZ0ludGVudEludmFsaWRVbml0SW52YWxpZEJsZW5kT3BJbnZhbGlkRGlzcG9zZU9wSW52YWxpZENvbG9yVHlwZUludmFsaWRCaXREZXB0aENvbG9yV2l0aEJhZFRybnNJbnZhbGlkQ29sb3JCaXREZXB0aGNvbG9yX3R5cGViaXRfZGVwdGhQYWxldHRlUmVxdWlyZWRTaG9ydFBhbGV0dGVleHBlY3RlZGxlbkFwbmdPcmRlcnByZXNlbnREdXBsaWNhdGVDaHVua2tpbmRPdXRzaWRlUGx0ZUlkYXRBZnRlclBsdGVBZnRlcklkYXRDaHVua0JlZm9yZUloZHJNaXNzaW5nSW1hZ2VEYXRhTWlzc2luZ0ZjdGxNaXNzaW5nSWhkclVuZXhwZWN0ZWRFbmRPZkNodW5rVW5leHBlY3RlZEVvZkludmFsaWRTaWduYXR1cmVDcmNNaXNtYXRjaHJlY292ZXJjcmNfdmFsY3JjX3N1bWNodW5rAGludGVybmFsIGVycm9yOiBlbnRlcmVkIHVucmVhY2hhYmxlIGNvZGU6IAAAxDgQACoAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xwbmctMC4xNy43XHNyY1xjb21tb24ucnMAYXR0ZW1wdCB0byBkaXZpZGUgYnkgemVybwAAAPg4EABXAAAAQAAAAB0AAABOb3QgYSBwb3NzaWJsZSBieXRlIHJvdW5kZWQgcGl4ZWwgd2lkdGgAfDkQACcAAAD4OBAAVwAAAF4CAAASAAAARW5kIG9mIGltYWdlIGhhcyBiZWVuIHJlYWNoZWQAAAC8ORAAHQAAAHdyb25nIGRhdGEgc2l6ZSwgZXhwZWN0ZWQgIGdvdCAA5DkQABoAAAD+ORAABQAAAFJnYmFHcmF5c2NhbGVBbHBoYUluZGV4ZWRSZ2JHcmF5c2NhbGVTaXh0ZWVuRWlnaHRGb3VyVHdvT25lUGl4ZWxEaW1lbnNpb25zeHBwdQAAxQAAAAQAAAAEAAAAtwAAAHlwcHV1bml0xQAAAAQAAAAEAAAAxgAAAE1ldGVyVW5zcGVjaWZpZWRQcmV2aW91c0JhY2tncm91bmROb25lT3ZlclNvdXJjZXNlcXVlbmNlX251bWJlcndpZHRoaGVpZ2h0eF9vZmZzZXR5X29mZnNldGRlbGF5X251bWRlbGF5X2RlbmRpc3Bvc2Vfb3BibGVuZF9vcAAAvDoQAA8AAADLOhAABQAAANA6EAAGAAAA1joQAAgAAADeOhAACAAAAOY6EAAJAAAA7zoQAAkAAAD4OhAACgAAAAI7EAAIAAAAxQAAAAQAAAAEAAAAxwAAAMUAAAAEAAAABAAAAMgAAADFAAAABAAAAAQAAADJAAAARnJhbWVDb250cm9sQW5pbWF0aW9uQ29udHJvbG51bV9mcmFtZXNudW1fcGxheXNQYXJhbWV0ZXJFcnJvcmlubmVyAADFAAAABAAAAAQAAADKAAAAUG9sbGVkQWZ0ZXJFbmRPZkltYWdlSW1hZ2VCdWZmZXJTaXplZXhwZWN0ZWTFAAAABAAAAAQAAAC4AAAAYWN0dWFsAAAAAAAAAQAAAAAAAAABAAAAAAAAAAMAAAAAAAAAAQAAAAAAAAACAAAAAAAAAAEAAAAAAAAABAAAAAAAAAABAAAAAQAAAAMAAAABAAAAAgAAAAEAAAAEAAAAAAAAAAIAAAAAAAAAAQAAAAAAAAAEAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAMAAAAAAAAAAQAAAAAAAAACAAAAAQAAAAQAAAABAAAAAQAAAAEAAAADAAAAAQAAAA4AAAAJAAAABAAAAAkAAAAJAAAACQAAAAMAAAAHAAAAGDoQADA6EAAUOhAAMDoQADA6EAAwOhAALToQACY6EABDaHVua1R5cGV0eXBlAAAAzAAAAAQAAAABAAAAzQAAAGNyaXRpY2FszAAAAAEAAAABAAAAzgAAAHByaXZhdGVyZXNlcnZlZHNhZmVjb3B5ABg9EAAAAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNccG5nLTAuMTcuN1xzcmNcZGVjb2Rlclx6bGliLnJzAAAAcD0QAF0AAABIAAAAEgAAAHA9EABdAAAAgAAAABUAAABwPRAAXQAAAIwAAAAWAAAATm8gbW9yZSBmb3J3YXJkIHByb2dyZXNzIG1hZGUgaW4gc3RyZWFtIGRlY29kaW5nLgAAAHA9EABdAAAAngAAABUAAABhc3NlcnRpb24gZmFpbGVkOiBzdGVwICE9IDAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2NvcmUvc3JjL2l0ZXIvYWRhcHRlcnMvc3RlcF9ieS5yc18+EABZAAAAFQAAAAkAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xwbmctMC4xNy43XHNyY1xmaWx0ZXIucnNGaWx0ZXJpbmcgZmFpbGVkOiBieXRlcyBwZXIgcGl4ZWwgaXMgZ3JlYXRlciB0aGFuIGxlbmd0aCBvZiByb3cAAMg+EABXAAAAsgAAAB4AAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlAMg+EABXAAAAuAAAADAAAADIPhAAVwAAAHcAAAAeAAAAyD4QAFcAAABjAAAANgAAAEZpbHRlcmluZyBmYWlsZWQ6IG5vdCBlbm91Z2ggZGF0YSBpbiBwcmV2aW91cyByb3cAAADIPhAAVwAAAJgAAAANAAAAyD4QAFcAAACZAAAADQAAAMg+EABXAAAAmgAAAA0AAADIPhAAVwAAAJsAAAANAAAAyD4QAFcAAACcAAAADQAAAMg+EABXAAAAnQAAAA0AAAB1bnJlYWNoYWJsZQDPAAAACAAAAAQAAADQAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNccG5nLTAuMTcuN1xzcmNcdGV4dF9tZXRhZGF0YS5ycwAAfEAQAF4AAAC5AAAAJgAAAEludmFsaWRLZXl3b3JkU2l6ZVVucmVwcmVzZW50YWJsZU1pc3NpbmdDb21wcmVzc2lvbkZsYWdJbnZhbGlkQ29tcHJlc3Npb25GbGFnSW52YWxpZENvbXByZXNzaW9uTWV0aG9kT3V0T2ZEZWNvbXByZXNzaW9uU3BhY2VJbmZsYXRpb25FcnJvck1pc3NpbmdOdWxsU2VwYXJhdG9yAAAPAAAAEgAAABQAAAAOAAAAFwAAABgAAAAWAAAAFgAAAP5AEADsQBAAdkEQAGhBEABRQRAAOUEQACNBEAANQRAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNccG5nLTAuMTcuN1xzcmNcdXRpbHMucnMAQbCEwQALjQdhdHRlbXB0IHRvIGRpdmlkZSBieSB6ZXJvAAAAzEEQAFYAAAAkAAAAFgAAAMxBEABWAAAAJQAAABoAAAD/QzpcVXNlcnNc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AAAACAAAAAQAAADcAAAA2wAAADyMEADdAAAA3gAAAN8AAADdAAAA4AAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGdpZi0wLjEyLjBcc3JjXHJlYWRlclxkZWNvZGVyLnJzAHiMEABfAAAAEQEAABwAAAB4jBAAXwAAAA0BAAAcAAAAeIwQAF8AAAAKAQAAHAAAAHiMEABfAAAAaQEAABEAAAB4jBAAXwAAAHwCAAAiAAAAeIsQAAAAAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlAHiMEABfAAAAYAIAADwAAAB4jBAAXwAAADcBAAAfAAAATm8gZW5kIGNvZGUgaW4gbHp3IHN0cmVhbQAAAHiMEABfAAAAqQIAACIAAAB4jBAAXwAAAIUCAAA8AAAAaW52YWxpZCBtaW5pbWFsIGNvZGUgc2l6ZQAAAHiMEABfAAAAMQEAAB8AAAB4jBAAXwAAAEwCAAAjAAAAdW5rbm93biBleHRlbnRpb24gYmxvY2sgZW5jb3VudGVyZWRleHBlY3RlZCBibG9jayB0ZXJtaW5hdG9yIG5vdCBmb3VuZHVua25vd24gYmxvY2sgdHlwZSBlbmNvdW50ZXJlZHiMEABfAAAA+gEAAC8AAABmcmFtZSBkZXNjcmlwdG9yIGlzIG91dC1vZi1ib3VuZHN1bnN1cHBvcnRlZCBHSUYgdmVyc2lvbm1hbGZvcm1lZCBHSUYgaGVhZGVyY29udHJvbCBleHRlbnNpb24gaGFzIHdyb25nIGxlbmd0aERlY29kaW5nRm9ybWF0RXJyb3J1bmRlcmx5aW5nAOEAAAAEAAAABAAAAOIAAABJbwAA4QAAAAQAAAAEAAAA4wAAAEZvcm1hdAAA4QAAAAQAAAAEAAAA5AAAAGNhbm5vdCBhY2Nlc3MgYSBUaHJlYWQgTG9jYWwgU3RvcmFnZSB2YWx1ZSBkdXJpbmcgb3IgYWZ0ZXIgZGVzdHJ1Y3Rpb24AAOUAAAAAAAAAAQAAAOYAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L3N0ZC9zcmMvdGhyZWFkL2xvY2FsLnJzAIiPEABPAAAApgEAABoAAADnAAAACAAAAAQAAADoAAAAYXNzZXJ0aW9uIGZhaWxlZDogcGl4ZWwubGVuKCkgPT0gNEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGNvbG9yX3F1YW50LTEuMS4wXHNyY1xsaWIucnMAAAAakBAAWwAAALoAAAAJAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcZ2lmLTAuMTIuMFxzcmNcY29tbW9uLnJzAIiQEABXAAAA9QAAACIAAACIkBAAVwAAAPUAAAAsAAAAiJAQAFcAAAD1AAAANgAAAIiQEABXAAAA9QAAAEAAAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlAIiQEABXAAAA9QAAAEsAAADpAAAACAAAAAQAAADqAAAA6wAAAOwAAAAMAAAABAAAACgAAADsAAAADAAAAAQAAAApAAAAKAAAAHCREADtAAAA7gAAACwAAADvAAAA8AAAAGNhcGFjaXR5IG92ZXJmbG93AAAArJEQABEAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2FsbG9jL3NyYy92ZWMvc3BlY19mcm9tX2l0ZXJfbmVzdGVkLnJzAADIkRAAXgAAADsAAAASAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9pdGVyLnJzAAA4khAATgAAAFUHAAARAEGgpcIAC/IyYXR0ZW1wdCB0byBkaXZpZGUgYnkgemVyb0luZGV4IG91dCBvZiBib3VuZHO5khAAEwAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvY29yZS9zcmMvc2xpY2Uvc29ydC5ycwAA1JIQAE4AAADLBAAAFQAAANSSEABOAAAA2QQAAB4AAADUkhAATgAAAOIEAAAYAAAA1JIQ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dW5leHBlY3RlZGx5AA4BAAAAAAAAAQAAADUAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2FsbG9jL3NyYy9zdHJpbmcucnMAAJ4QAEsAAADpCQAADgAAAAoKU3RhY2s6CgoAAA8BAAAEAAAABAAAABABAAARAQAAEgEAAEpzVmFsdWUoKQAAAICeEAAIAAAAiJ4QAAEAAAAYAQAABAAAAAQAAAAZAQAAGgEAABsBAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlQWNjZXNzRXJyb3IAALSeEAAAAAAAdW5jYXRlZ29yaXplZCBlcnJvcm90aGVyIGVycm9yb3V0IG9mIG1lbW9yeXVuZXhwZWN0ZWQgZW5kIG9mIGZpbGV1bnN1cHBvcnRlZG9wZXJhdGlvbiBpbnRlcnJ1cHRlZGFyZ3VtZW50IGxpc3QgdG9vIGxvbmdpbnZhbGlkIGZpbGVuYW1ldG9vIG1hbnkgbGlua3Njcm9zcy1kZXZpY2UgbGluayBvciByZW5hbWVkZWFkbG9ja2V4ZWN1dGFibGUgZmlsZSBidXN5cmVzb3VyY2UgYnVzeWZpbGUgdG9vIGxhcmdlZmlsZXN5c3RlbSBxdW90YSBleGNlZWRlZHNlZWsgb24gdW5zZWVrYWJsZSBmaWxlbm8gc3RvcmFnZSBzcGFjZXdyaXRlIHplcm90aW1lZCBvdXRpbnZhbGlkIGRhdGFpbnZhbGlkIGlucHV0IHBhcmFtZXRlcnN0YWxlIG5ldHdvcmsgZmlsZSBoYW5kbGVmaWxlc3lzdGVtIGxvb3Agb3IgaW5kaXJlY3Rpb24gbGltaXQgKGUuZy4gc3ltbGluayBsb29wKXJlYWQtb25seSBmaWxlc3lzdGVtIG9yIHN0b3JhZ2UgbWVkaXVtZGlyZWN0b3J5IG5vdCBlbXB0eWlzIGEgZGlyZWN0b3J5bm90IGEgZGlyZWN0b3J5b3BlcmF0aW9uIHdvdWxkIGJsb2NrZW50aXR5IGFscmVhZHkgZXhpc3RzYnJva2VuIHBpcGVuZXR3b3JrIGRvd25hZGRyZXNzIG5vdCBhdmFpbGFibGVhZGRyZXNzIGluIHVzZW5vdCBjb25uZWN0ZWRjb25uZWN0aW9uIGFib3J0ZWRuZXR3b3JrIHVucmVhY2hhYmxlaG9zdCB1bnJlYWNoYWJsZWNvbm5lY3Rpb24gcmVzZXRjb25uZWN0aW9uIHJlZnVzZWRwZXJtaXNzaW9uIGRlbmllZGVudGl0eSBub3QgZm91bmRFcnJvcmtpbmQAABgBAAABAAAAAQAAABwBAABtZXNzYWdlABgBAAAIAAAABAAAAB0BAABLaW5kT3Njb2RlAAAYAQAABAAAAAQAAAAeAQAAHwEAAAwAAAAEAAAAIAEAACAob3MgZXJyb3IgKbSeEAAAAAAAQKIQAAsAAABLohAAAQAAAG1lbW9yeSBhbGxvY2F0aW9uIG9mICBieXRlcyBmYWlsZWQAAGSiEAAVAAAAeaIQAA0AAABsaWJyYXJ5L3N0ZC9zcmMvYWxsb2MucnOYohAAGAAAAFUBAAAJAAAAY2Fubm90IG1vZGlmeSB0aGUgcGFuaWMgaG9vayBmcm9tIGEgcGFuaWNraW5nIHRocmVhZMCiEAA0AAAAbGlicmFyeS9zdGQvc3JjL3Bhbmlja2luZy5yc/yiEAAcAAAAhgAAAAkAAAD8ohAAHAAAAD4CAAAeAAAA/KIQABwAAAA9AgAAHwAAAB8BAAAMAAAABAAAACEBAAAYAQAACAAAAAQAAAAiAQAAIwEAABAAAAAEAAAAJAEAACUBAAAYAQAACAAAAAQAAAAmAQAAJwEAABgBAAAAAAAAAQAAACgBAABVbnN1cHBvcnRlZAAYAQAABAAAAAQAAAApAQAAQ3VzdG9tZXJyb3IAGAEAAAQAAAAEAAAAKgEAAFVuY2F0ZWdvcml6ZWRPdGhlck91dE9mTWVtb3J5VW5leHBlY3RlZEVvZkludGVycnVwdGVkQXJndW1lbnRMaXN0VG9vTG9uZ0ludmFsaWRGaWxlbmFtZVRvb01hbnlMaW5rc0Nyb3NzZXNEZXZpY2VzRGVhZGxvY2tFeGVjdXRhYmxlRmlsZUJ1c3lSZXNvdXJjZUJ1c3lGaWxlVG9vTGFyZ2VGaWxlc3lzdGVtUXVvdGFFeGNlZWRlZE5vdFNlZWthYmxlU3RvcmFnZUZ1bGxXcml0ZVplcm9UaW1lZE91dEludmFsaWREYXRhSW52YWxpZElucHV0U3RhbGVOZXR3b3JrRmlsZUhhbmRsZUZpbGVz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',
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

      function doApplyCommands(message) {
        const { data, extension, commands } = message.data;

        const result = applyCommands(data, extension, commands);
        return Promise.resolve(result);
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
