/**
 * @name EmoteReplacer
 * @version 1.13.1
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
    title: '1.13.1',
    type: 'fixed',
    items: [
      'Fix emote upload not working',
      'Fix emotes with reply always pinging even when turned off',
      'Fix emotes not working in threads when using split view',
    ],
  },
  {
    title: '1.13.0',
    type: 'added',
    items: [
      "It's now possible to add custom emotes directly from your PC instead of entering a URL",
      "Allow uploading images to channels that don't allow external emotes",
      'Emotes are now shown as disabled in the reactions menu, as they cannot be used for reacting',
    ],
  },
  {
    title: '1.13.0',
    type: 'fixed',
    items: [
      'Custom emote menu no longer shows broken emotes from the standard set',
      'Custom emotes starting with numbers or containing spaces can now be removed',
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

      let WASM_VECTOR_LEN = 0;

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

      const cachedTextDecoder = new TextDecoder('utf-8', {
        ignoreBOM: true,
        fatal: true,
      });

      cachedTextDecoder.decode();

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
        imports.wbg.__wbindgen_number_get = function (arg0, arg1) {
          const obj = getObject(arg1);
          const ret = typeof obj === 'number' ? obj : undefined;
          getFloat64Memory0()[arg0 / 8 + 1] = isLikeNone(ret) ? 0 : ret;
          getInt32Memory0()[arg0 / 4 + 0] = !isLikeNone(ret);
        };
        imports.wbg.__wbindgen_string_new = function (arg0, arg1) {
          const ret = getStringFromWasm0(arg0, arg1);
          return addHeapObject(ret);
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
          'AGFzbQEAAAABqwIoYAJ/fwF/YAJ/fwBgA39/fwF/YAF/AGABfwF/YAN/f38AYAZ/f39/f38AYAR/f39/AGABfwF+YAV/f39/fwBgAn99AX1gBX9/f39/AX9gAAF/YAN/f30AYAAAYAJ9fQF9YAF9AX1gBn9/f39/fwF/YAN/fX8AYAd/f39/f39/AX9gA399fQBgBH9/f38Bf2AAAXxgCH9/f39/f39/AGACf30AYAR/f35+AGAHf39/f39/fwBgCX9/f39/f35+fgBgAn9/AX5gA35/fwF/YBN/f39/f39/f39/f39/f39/f39/AX9gC39/f39/f39/f39/AX9gA39+fgBgBX9/fX9/AGAEf31/fwBgBX9/fn9/AGAEf35/fwBgBX9/fH9/AGAEf3x/fwBgAXwBfAL0CCIDd2JnGl9fd2JpbmRnZW5fb2JqZWN0X2Ryb3BfcmVmAAMDd2JnFV9fd2JpbmRnZW5fc3RyaW5nX2dldAABA3diZxVfX3diaW5kZ2VuX251bWJlcl9nZXQAAQN3YmcVX193YmluZGdlbl9zdHJpbmdfbmV3AAADd2JnFF9fd2JpbmRnZW5fZXJyb3JfbmV3AAADd2JnFF9fd2JpbmRnZW5faXNfb2JqZWN0AAQDd2JnGV9fd2JpbmRnZW5fanN2YWxfbG9vc2VfZXEAAAN3YmcWX193YmluZGdlbl9ib29sZWFuX2dldAAEA3diZx1fX3diZ19TdHJpbmdfODg4MTBkZmViNDAyMTkwMgABA3diZxpfX3diZ19nZXRfMjdmZTNkYWMxYzRkMDIyNAAAA3diZx1fX3diZ19sZW5ndGhfZTQ5OGZiYzI0ZjljMWQ0ZgAEA3diZxZfX3diaW5kZ2VuX2lzX2Z1bmN0aW9uAAQDd2JnG19fd2JnX25leHRfYjdkNTMwYzA0ZmQ4YjIxNwAEA3diZxtfX3diZ19uZXh0Xzg4NTYwZWMwNmEwOTRkZWEABAN3YmcbX193YmdfZG9uZV8xZWJlYzAzYmJkOTE5ODQzAAQDd2JnHF9fd2JnX3ZhbHVlXzZhYzhkYTVjYzViM2VmZGEABAN3YmcfX193YmdfaXRlcmF0b3JfNTVmMTE0NDQ2MjIxYWE1YQAMA3diZxpfX3diZ19nZXRfYmFmNDg1NWY5YTk4NjE4NgAAA3diZxtfX3diZ19j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aiQAAkACQCARKAL0BkECRgRAIAsgEUG4BWooAgA2AgAgESARKQOwBTcDsAcgEUG4A2ogEUGwB2oQ0gEMAQsgEUG4A2ogEUGwBWpB+AEQwgMaIBEoAvwEIgZBAkYNACARQfABaiIFIBFBuANqQcQBEMIDGiANQZACaiARQagFaikDADcDACANQYgCaiARQaAFaikDADcDACANQYACaiARQZgFaikDADcDACANQfgBaiARQZAFaikDADcDACANQfABaiARQYgFaikDADcDACANIBEpA4AFNwPoASARQShqIAVBxAEQwgMaIBFBCGoiBRDbAiANIAVB5AEQwgMgBjYC5AEMAQsgEUGQAmogEUHYA2opAwAiQTcDACARQYgCaiARQdADaikDACJANwMAIBFBgAJqIBFByANqKQMAIj83AwAgEUH4AWogEUHAA2opAwAiPjcDACARIBEpA7gDIj03A/ABIA1BKGogQTcDACANQSBqIEA3AwAgDUEYaiA/NwMAIA1BEGogPjcDACANID03AwggDUICNwMACyARQcAHaiQAIAopA4AJQgJRBEAgCkGAAWogCkGoCWopAwA3AwAgCkH4AGogCkGgCWopAwA3AwAgCkHwAGogCkGYCWopAwA3AwAgCkHoAGogCkGQCWopAwA3AwAgCiAKKQOICTcDYCAKQcAANgKkDSAKIApB4ABqIgU2AqANIApBATYCnA0gCkEBNgKUDSAKQbCywAA2ApANIApBADYCiA0gCiAKQaANajYCmA0gCkHoBGogCkGIDWoQXSAFEFkMBgsgCkHgBGogCkGACWpBmAIQwgMaIAopA+AEIj5CAlENBSAKQbANaiIZIApB/ARqKQIANwMAIApBuA1qIiMgCkGEBWopAgA3AwAgCkHADWoiHiAKQYwFaigCADYCACAKQfAIaiIXIApBoAVqKQMANwMAIAogCikC9AQ3A6gNIAogCikDmAU3A+gIIAooAvAEIRUgCigC7AQhHCAKKALoBCEoIAooApAFITQgCigClAUhNSAKQdgAaiI2IApB4AVqKQMANwMAIAogCikD2AU3A1AgCigC1AUhNyAKKALQBSEfIAooAswFIRMgCigCyAUhICAKKALEBSE4IAooAsAFIRAgCigCvAUhLyAKKAK4BSExIAopA7AFIT0gCigCrAUhOSAKKAKoBSEnIAooAugFITMgCigC7AUhIiAKKALwBSEkIAooAvQFIQ4gCigC+AUhOiAKKAL8BSElIApBwAJqIhEgCkGoBmooAgA2AgAgCkG4AmoiFiAKQaAGaikDADcDACAKQbACaiINIApBmAZqKQMANwMAIApBqAJqIg8gCkGQBmopAwA3AwAgCkGgAmoiDCAKQYgGaikDADcDACAKIAopA4AGNwOYAiAKKALYBiErIAooAtQGITsgCigC0AYhCSAKKALMBiE8IAooAsgGIS0gCigCxAYhLiAKKALABiELIAooArwGIR0gCigCuAYhGiAKKAK0BiEIIAooArAGISwgCigCrAYhGCAKQcgAaiIHIApB9AZqKAIANgIAIApBQGsiBiAKQewGaikCADcDACAKQThqIgUgCkHkBmopAgA3AwAgCiAKKQLcBjcDMAJAIEtDAACAP1sEQCAKKAIgRQ0BCyAKQZwJaiAZKQMANwIAIApBpAlqICMpAwA3AgAgCkGsCWogHigCADYCACAKQcAJaiAXKQMANwMAIAogFTYCkAkgCiAcNgKMCSAKICg2AogJIAogPjcDgAkgCiAKKQOoDTcClAkgCiA1NgK0CSAKIDQ2ArAJIAogCikD6Ag3A7gJIApBgApqIDYpAwA3AwAgCiA3NgL0CSAKIB82AvAJIAogEzYC7AkgCiAgNgLoCSAKIDg2AuQJIAogEDYC4AkgCiAvNgLcCSAKIDE2AtgJIAogPTcD0AkgCiA5NgLMCSAKICc2AsgJIAogMzYCiAogCiAiNgKMCiAKICQ2ApAKIAogDjYClAogCiA6NgKYCiAKICU2ApwKIAogCikDUDcD+AkgCkHICmogESgCADYCACAKQcAKaiAWKQMANwMAIApBuApqIA0pAwA3AwAgCkGwCmogDykDADcDACAKQagKaiAMKQMANwMAIAogKzYC+AogCiA7NgL0CiAKIAk2AvAKIAogPDYC7AogCiAtNgLoCiAKIC42AuQKIAogCzYC4AogCiAdNgLcCiAKIBo2AtgKIAogCDYC1AogCiAsNgLQCiAKIBg2AswKIAogCikDmAI3A6AKIApBlAtqIAcoAgA2AgAgCkGMC2ogBikDADcCACAKQYQLaiAFKQMANwIAIAogCikDMDcC/AogCkEIaiELIwBBoARrIgwkACAMQYgCaiAKQYAJakGYAhDCAxoC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IBE6AIAECyAMQcAVaiQADAELAAsgCigC0AtBAkYEQCAKQcgNaiAKQaAJaikDADcDACAKQcANaiAKQZgJaikDADcDACAKQbgNaiAKQZAJaikDADcDACAKQbANaiAKQYgJaikDADcDACAKIAopA4AJNwOoDSAKQcAANgKMDSAKIApBqA1qIgU2AogNIApBATYCRCAKQQE2AjwgCkGwssAANgI4IApBADYCMCAKIApBiA1qNgJAIApB4ARqIApBMGoQXSAFEFkMAwsgCkHgBGogCkGACWpBiAQQwgMaIAooArAHIgtBAkYNAiAKKQPgBCE9IAooAugEIQcgCkGYAmoiBiAKQewEaiIIQcQCEMIDGiAKQeAAaiIFIApBtAdqQbQBEMIDGiAKIAc2AogJIAogPTcDgAkgCkGMCWogBkHEAhDCAxogCiALNgLQCyAKQdQLaiAFQbQBEMIDGiAKQeAEaiEPIwBBwAhrIg0kACANQQhqIApBgAlqQYgEEMIDGgJAAkACQAJAAkACQAJAAkACQAJAAkACQCANQcgAaigCAEECRwRAIA0gDUEYahCuAyANKAIEIQkgDSgCACEMAkACQAJAAkACQAJAAkACQAJAAkACQCANLQCIBCIHQQFrDgkIBwYFBAMCAQAJCyANQbgEaiIFIA1BCGpBiAQQwgMaIA1BkARqIAUQViANKAKQBCIRQQZGBEAgDUGYBGooAgAhBiANKAKUBCERAkAgDEH/////A3EgDEcNACAMQQJ0rSAJrX4iPUIgiKcNACANQZwEaigCACILID2nTw0LCyARRQ0VIAYQOwwVCyAPIA0pA6AENwMQIA9BGGogDUGoBGopAwA3AwAgD0EgaiANQbAEaikDADcDACANKQKUBCE9IA8gDSgCnAQ2AgwgDyA9NwIEDBYLIA1BuARqIgUgDUEIakGIBBDCAxogDUGQBGogBRBWIA0oApAEIhFBBkYNEiAPIA0pA6AENwMQIA9BGGogDUGoBGopAwA3AwAgD0EgaiANQbAEaikDADcDACANKQKUBCE9IA8gDSgCnAQ2AgwgDyA9NwIEDBULIA1BuARqIgUgDUEIakGIBBDCAxogDUGQBGogBRBVIA0oApAEIhFBBkYNECAPIA0pA6AENwMQIA9BGGogDUGoBGopAwA3AwAgD0EgaiANQbAEaikDADcDACANKQKUBCE9IA8gDSgCnAQ2AgwgDyA9NwIEDBQLIA1BuARqIgUgDUEIakGIBBDCAxogDUGQBGogBRBVIA0oApAEIhFBBkYNDiAPIA0pA6AENwMQIA9BGGogDUGoBGopAwA3AwAgD0EgaiANQbAEaikDADcDACANKQKUBCE9IA8gDSgCnAQ2AgwgDyA9NwIEDBMLIA1BuARqIgUgDUEIakGIBBDCAxogDUGQBGogBRBVIA0oApAEIhFBBkYNDCAPIA0pA6AENwMQIA9BGGogDUGoBGopAwA3AwAgD0EgaiANQbAEaikDADcDACANKQKUBCE9IA8gDSgCnAQ2AgwgDyA9NwIEDBILIA1BuARqIgUgDUEIakGIBBDCAxogDUGQBGogBRBVIA0oApAEIhFBBkYNCiAPIA0pA6AENwMQIA9BGGogDUGoBGopAwA3AwAgD0EgaiANQbAEaikDADcDACANKQKUBCE9IA8gDSgCnAQ2AgwgDyA9NwIEDBELIA1BuARqIgUgDUEIakGIBBDCAxogDUGQBGogBRBYIA0oApAEIhFBBkYNCCAPIA0pA6AENwMQIA9BGGogDUGoBGopAwA3AwAgD0EgaiANQbAEaikDADcDACANKQKUBCE9IA8gDSgCnAQ2AgwgDyA9NwIEDBALIA1BuARqIgUgDUEIakGIBBDCAxogDUGQBGogBRBYIA0oApAEIhFBBkYNBiAPIA0pA6AENwMQIA9BGGogDUGoBGopAwA3AwAgD0EgaiANQbAEaikDADcDACANKQKUBCE9IA8gDSgCnAQ2AgwgDyA9NwIEDA8LIA1BuARqIgUgDUEIakGIBBDCAxogDUGQBGogBRBYIA0oApAEIhFBBkYNBCAPIA0pA6AENwMQIA9BGGogDUGoBGopAwA3AwAgD0EgaiANQbAEaikDADcDACANKQKUBCE9IA8gDSgCnAQ2AgwgDyA9NwIEDA4LIA1BuARqIgUgDUEIakGIBBDCAxogDUGQBGogBRBYIA0oApAEIhFBBkYNAiAPIA0pA6AENwMQIA9BGGogDUGoBGopAwA3AwAgD0EgaiANQbAEaikDADcDACANKQKUBCE9IA8gDSgCnAQ2AgwgDyA9NwIEDA0LIAZFDQoMCwtBhJzAAEErQeSewAAQhgIACyANQZgEaigCACEGIA0oApQEIRECQCAMrSAJrX4iPUIgiFAEQCANQZwEaigCACILID2nTw0BCyARRQ0JIAYQOwwJCyAGRQ0IDAkLIA1BmARqKAIAIQYgDSgClAQhEQJAAkAgDCAMaiIFIAxJDQAgBa0gCa1+Ij1CIIinDQAgDUGcBGooAgAiCyA9p08NAQsgEUUNCCAGEDsMCAsgBkUNBwwICyANQZgEaigCACEGIA0oApQEIRECQAJAIAytQgN+Ij1CIIinDQAgPaetIAmtfiI9QiCIpw0AIA1BnARqKAIAIgsgPadPDQELIBFFDQcgBhA7DAcLIAZFDQYMBwsgDUGYBGooAgAhBiANKAKUBCERAkACQCAMQf////8DcSAMRw0AIAxBAnStIAmtfiI9QiCIpw0AIA1BnARqKAIAIgsgPadPDQELIBFFDQYgBhA7DAYLIAZFDQUMBgsgDUGYBGooAgAhBiANKAKUBCERAkAgDK0gCa1+Ij1CIIhQBEAgDUGcBGooAgAiCyA9p08NAQsgEUUNBSAGEDsMBQsgBkUNBAwFCyANQZgEaigCACEGIA0oApQEIRECQAJAIAwgDGoiBSAMSQ0AIAWtIAmtfiI9QiCIpw0AIA1BnARqKAIAIgsgPadPDQELIBFFDQQgBhA7DAQLIAZFDQMMBAsgDUGYBGooAgAhBiANKAKUBCERAkACQCAMrUIDfiI9QiCIpw0AID2nrSAJrX4iPUIgiKcNACANQZwEaigCACILID2nTw0BCyARRQ0DIAYQOwwDCyAGRQ0CDAMLIA1BmARqKAIAIQYgDSgClAQhEQJAAkAgDEH/////A3EgDEcNACAMQQJ0rSAJrX4iPUIgiKcNACANQZwEaigCACILID2nTw0BCyARRQ0CIAYQOwwCCyAGRQ0BDAILIA1BmARqKAIAIQYgDSgClAQhEQJAAkAgDK1CA34iPUIgiKcNACA9p60gCa1+Ij1CIIinDQAgDUGcBGooAgAiCyA9p08NAQsgEUUNASAGEDsMAQsgBg0BCyANQQA2ArgEIA9BBGogDUG4BGoQwgJBAiERDAELIA8gBzYCBCAPQRhqIAs2AgAgD0EUaiAGNgIAIA9BEGogETYCACAPQQxqIAk2AgAgD0EIaiAMNgIAQQYhEQsgDyARNgIAIA1BwAhqJAACQCAKKALgBEEGRwRAIApBoAlqIApBgAVqKQMANwMAIApBmAlqIApB+ARqKQMANwMAIApBkAlqIApB8ARqKQMANwMAIApBiAlqIApB6ARqKQMANwMAIAogCikD4AQ3A4AJIApBwAA2AlQgCiAKQYAJaiIFNgJQIApBATYCvA0gCkEBNgK0DSAKQfyywAA2ArANIApBADYCqA0gCiAKQdAAajYCuA0gCkEwakEEciAKQagNahBdIAUQWQwBCyAKQUBrIApB9ARqKQIANwMAIApBOGogCCkCADcDACAKIAopAuQEIj03AzAgPaciBUEKRw0CCyAKQTxqKAIAIQYgCkE4aigCACEJIAooAjQhCwwFCyAKQaAJaiAKQYAFaikDADcDACAKQZgJaiAKQfgEaikDADcDACAKQZAJaiAKQfAEaikDADcDACAKQYgJaiAKQegEaikDADcDACAKIAopA+AENwOACSAKQcAANgKkDSAKIApBgAlqIgU2AqANIApBATYCdCAKQQE2AmwgCkHUssAANgJoIApBADYCYCAKIApBoA1qNgJwIApBiA1qQQRyIApB4ABqEF0gBRBZIApBkA1qKAIAIQkgCkGUDWooAgAhBiAKKAKMDSELDAQLIAogCigCPDYClA0gCiAKKQI0NwKMDSAKIAopA0A3A5gNIAogBTYCiA0gCkHoCGohESMAQSBrIg8kAAJAIApBiA1qIgUoAgBBA0cEQCAPQRhqIAVBEGopAgA3AwAgD0EQaiAFQQhqKQIANwMAIA8gBSkCADcDCAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgD0EIaiIWKAIAQQFrDgkBAgMEBQYHCAkACyAWQQRqIgsoAgAiDEH/////A3EgDEcNFiALKAIEIgitIj4gDEECdK1+Ij1CIIinDRYCQCA9pyIHRQRAQQEhCQwBCyAHQQBOIg1FDRggByANEP8CIglFDQoLIBEgCDYCBCARIAw2AgAgEUEQaiAHNgIAIBFBDGogCTYCACARQQhqIAc2AgAgDK0gPn4iPUIgiKcNCgJAID2nIgYgC0EQaigCACIFTQRAIAdFDQFBACAIIAxsQQJ0ayENIAtBDGooAgAhCANAIAZFDQIgCUEDakH/AToAACAJQQJqIAgtAAAiBToAACAJQQFqIAU6AAAgCSAFOgAAIAlBBGohCSAGQQFrIQYgCEEBaiEIIA1BBGoiDQ0ACwwBCyAGIAVBiL7AABCXAwALDAwLIBZBBGoiCygCACIJQf////8DcSAJRw0VIAsoAgQiBa0iPiAJQQJ0rX4iPUIgiKcNFUEBIQcgPaciCARAIAhBAE4iBkUNFyAIIAYQ/wIiB0UNFQsgESAFNgIEIBEgCTYCACARQRBqIAg2AgAgEUEMaiAHNgIAIBFBCGogCDYCACAJQQF0rSA+fiI9QiCIpw0JID2nIg0gC0EQaigCACIGSw0KAkAgCEUNAEEAIAUgCWwiBUECdGshDUEAIAVBAXRrIQggC0EMaigCACEJA0AgCEUNASAHQQJqIAktAAAiBToAACAHQQFqIAU6AAAgByAFOgAAIAdBA2ogCUEBai0AADoAACAHQQRqIQcgCUECaiEJIAhBAmohCCANQQRqIg0NAAsLDAsLIBZBBGoiCygCACIJQf////8DcSAJRw0UIAsoAgQiBa0iPiAJQQJ0rX4iPUIgiKcNFAJAID2nIghFBEBBASEHDAELIAhBAE4iBkUNFiAIIAYQ/wIiB0UNFAsgESAFNgIEIBEgCTYCACARQRBqIAg2AgAgEUEMaiAHNgIAIBFBCGogCDYCACAJQQNsrSA+fiI9QiCIpw0IID2nIg0gC0EQaigCACIGSw0JAkAgCEUNACANIA1BA3BrIQ1BACAFIAlsQQJ0ayEGIAtBDGooAgAhCANAIA1BAk0NASAHIAgtAAA6AAAgB0EDakH/AToAACAHQQFqIAhBAWovAAA7AAAgB0EEaiEHIAhBA2ohCCANQQNrIQ0gBkEEaiIGDQALCwwKCyAWQQRqIgsoAgAiCEH/////A3EgCEcNEyAIQQJ0rSALKAIEIgWtfiI9QiCIpw0TAkACQAJAID2nIg1FBEBBASEHDAELIA1BAE4iBkUNFyANIAYQ/wIiB0UNAQsgESAFNgIEIBEgCDYCACARQRBqIA02AgAgEUEMaiAHNgIAIBFBCGogDTYCACANIAtBEGooAgAiBksNCgJAIA1FDQAgC0EMaigCACEIIA1BBGsiBUEEcUUEQCAHIAgoAAA2AAAgCEEEaiEIIAUhDSAHQQRqIQcLIAVFDQADQCAHIAgoAAA2AAAgB0EEaiAIQQRqKAAANgAAIAdBCGohByAIQQhqIQggDUEIayINDQALCwwBCyANIAYQvAMACwwJCyAWQQRqIgsoAgAiCUH/////A3EgCUcNEiALKAIEIgWtIj4gCUECdK1+Ij1CIIinDRICQCA9pyIIRQRAQQEhBwwBCyAIQQBOIgZFDRQgCCAGEP8CIgdFDRILIBEgBTYCBCARIAk2AgAgEUEQaiAINgIAIBFBDGogBzYCACARQQhqIAg2AgAgCa0gPn4iPUIgiKcNBiA9pyINIAtBEGooAgAiBksNBwJAIAhFDQAgDUEBaiEIQQAgBSAJbEECdGshDSALQQxqKAIAIQkDQCAIQQFrIghFDQEgB0EDakH/AToAACAHQQJqIAkvAQBBgAFqQYECbiIFOgAAIAdBAWogBToAACAHIAU6AAAgB0EEaiEHIAlBAmohCSANQQRqIg0NAAsLDAgLIBZBBGoiCygCACIJQf////8DcSAJRw0RIAsoAgQiBa0iPiAJQQJ0rX4iPUIgiKcNEUEBIQcgPaciCARAIAhBAE4iBkUNEyAIIAYQ/wIiB0UNEQsgESAFNgIEIBEgCTYCACARQRBqIAg2AgAgEUEMaiAHNgIAIBFBCGogCDYCACAJQQF0rSA+fiI9QiCIpw0FID2nIg0gC0EQaigCACIGSw0GAkAgCEUNAEF+IA1rIQhBACAFIAlsQQJ0ayENIAtBDGooAgAhCQNAIAhBAmoiCEUNASAHQQJqIAkvAQBBgAFqQYECbiIFOgAAIAdBAWogBToAACAHIAU6AAAgB0EDaiAJQQJqLwEAQYABakGBAm46AAAgB0EEaiEHIAlBBGohCSANQQRqIg0NAAsLDAcLIBZBBGoiCygCACIMQf////8DcSAMRw0QIAsoAgQiBq0iPiAMQQJ0rX4iPUIgiKcNEAJAID2nIgdFBEBBASEJDAELIAdBAE4iDUUNEiAHIA0Q/wIiCUUNBAsgESAGNgIEIBEgDDYCACARQRBqIAc2AgAgEUEMaiAJNgIAIBFBCGogBzYCACAMQQNsrSA+fiI9QiCIpw0EAkAgPaciCCALQRBqKAIAIgVNBEAgB0UNAUEAIAYgDGxBAnRrIQ0gCCAIQQNwa0EDaiEGIAtBDGooAgAhCANAIAZBA2siBkECTQ0CIAlBA2pB/wE6AAAgCSAILwEAQYABakGBAm46AAAgCUEBaiAIQQJqLwEAQYABakGBAm46AAAgCUECaiAIQQRqLwEAQYABakGBAm46AAAgCUEEaiEJIAhBBmohCCANQQRqIg0NAAsMAQsgCCAFQYi+wAAQlwMACwwGCyAWQQRqIgsoAgAiCUH/////A3EgCUcNDyAJQQJ0rSALKAIEIgatfiI9QiCIpw0PAkAgPaciB0UEQEEBIQgMAQsgB0EATiINRQ0RIAcgDRD/AiIIRQ0DCyARIAY2AgQgESAJNgIAIBFBEGogBzYCACARQQxqIAg2AgAgEUEIaiAHNgIAAkAgC0EQaigCACIFIAdPBEAgBwRAQQAgBiAJbEECdGshBiALQQxqKAIAIQ0DQCAIIA0vAQBBgAFqQYECbjoAACAIQQFqIA1BAmovAQBBgAFqQYECbjoAACAIQQJqIA1BBGovAQBBgAFqQYECbjoAACAIQQNqIA1BBmovAQBBgAFqQYECbjoAACAIQQRqIQggDUEIaiENIAZBBGoiBg0ACwsMAQsgByAFQYi+wAAQlwMACwwFCyAWQQRqIgkoAgAiCEH/////A3EgCEcNDiAJKAIEIgetIj4gCEECdK1+Ij1CIIinDQ4CQAJAAkACQAJAID2nIgxFBEBBASEGDAELIAxBAE4iBUUNFCAMIAUQ/wIiBkUNAQsgESAHNgIEIBEgCDYCACARQRBqIAw2AgAgEUEMaiAGNgIAIBFBCGogDDYCACAIQQNsrSA+fiI9QiCIpw0BID2nIgsgCUEQaigCACIFSw0CAkAgDEUNAEEAIAcgCGxBAnRrIQggCyALQQNwa0EDaiENIAlBDGooAgAhBwNAIA1BA2siDUECTQ0BAkAgByoCAEMAAAAAl0MAAIA/lkMAAH9DlBDuAiJCQwAAgL9eRSBCQwAAgENdRXJFBEACQCAGAn8gQkMAAIBPXSBCQwAAAABgcQRAIEKpDAELQQALOgAAIAcqAgRDAAAAAJdDAACAP5ZDAAB/Q5QQ7gIiQkMAAIC/XkUgQkMAAIBDXUVyDQAgBgJ/IEJDAACAT10gQkMAAAAAYHEEQCBCqQwBC0EACzoAASAHKgIIQwAAAACXQwAAgD+WQwAAf0OUEO4CIkJDAACAv15FIEJDAACAQ11Fcg0AIAZB/wE6AAMgQkMAAIBPXSBCQwAAAABgcQRAIAYgQqk6AAIMAwsgBkEAOgACDAILC0GY0MAAQStBoNHAABCGAgALIAdBDGohByAGQQRqIQYgCEEEaiIIDQALCwwDCyAMIAUQvAMAC0GYvsAAQStBxL7AABCGAgALIAsgBUGIvsAAEJcDAAsMBAsgFkEEaiILKAIAIghB/////wNxIAhHDQ0gCEECdK0gCygCBCIHrX4iPUIgiKcNDQJAAkACQAJAID2nIglFBEBBASEGDAELIAlBAE4iBUUNEiAJIAUQ/wIiBkUNAQsgESAHNgIEIBEgCDYCACARQRBqIAk2AgAgEUEMaiAGNgIAIBFBCGogCTYCACAJIAtBEGooAgAiBUsNASAJBEBBACAHIAhsQQJ0ayEIIAtBDGooAgAhBwNAAkAgByoCAEMAAAAAl0MAAIA/lkMAAH9DlBDuAiJCQwAAgL9eRSBCQwAAgENdRXJFBEACQCAGAn8gQkMAAIBPXSBCQwAAAABgcQRAIEKpDAELQQALOgAAIAcqAgRDAAAAAJdDAACAP5ZDAAB/Q5QQ7gIiQkMAAIC/XkUgQkMAAIBDXUVyDQAgBgJ/IEJDAACAT10gQkMAAAAAYHEEQCBCqQwBC0EACzoAASAHKgIIQwAAAACXQwAAgD+WQwAAf0OUEO4CIkJDAACAv15FIEJDAACAQ11Fcg0AIAYCfyBCQwAAgE9dIEJDAAAAAGBxBEAgQqkMAQtBAAs6AAIgByoCDEMAAAAAl0MAAIA/lkMAAH9DlBDuAiJCQwAAgL9eRSBCQwAAgENdRXINACBCQwAAgE9dIEJDAAAAAGBxBEAgBiBCqToAAwwDCyAGQQA6AAMMAgsLQZjQwABBK0Gg0cAAEIYCAAsgB0EQaiEHIAZBBGohBiAIQQRqIggNAAsLDAILIAkgBRC8AwALIAkgBUGIvsAAEJcDAAsMAwsgByANELwDAAtBmL7AAEErQcS+wAAQhgIACyANIAZBiL7AABCXAwALAkACQAJAAkAgFigCAEEEaw4FAQEBAQACCyAWQQxqKAIARQ0CIBZBEGooAgAQOwwCCyAWQQxqKAIARQ0BIBZBEGooAgAQOwwBCyAWQQxqKAIARQ0AIBZBEGooAgAQOwsMAQsgESAFKQIENwIAIBFBEGogBUEUaigCADYCACARQQhqIAVBDGopAgA3AgALIA9BIGokACAKQYAJaiEHAkACQAJAIBEoAgAiBUH/////A3EgBUcNACARNQIEIAVBAnStfiI9QiCIpw0AID2nIgYgEUEQaigCACIFSw0BIAdCgICAgMAANwIMIAcgBjYCBCAHIBFBDGooAgAiBTYCACAHIAUgBmo2AggMAgtB1InAAEErQYCKwAAQhgIACyAGIAVBxInAABCXAwALAkACQAJAIAooAoQJIg0gCigCkAkiBkkNACAKKAKACSEFIAZBBEYEQANAIAVFDQIgDUEEayENIAVBA2otAABFBEAgBUEANgAACyAFQQRqIQUgDUEETw0ADAILAAsgBQ0BCyAKQfAEaiAKQfgIaigCADYCACAKQegEaiAKQfAIaikDADcDACAKIAopA+gINwPgBCAKQRBqQRRBARCCAyAKQYAJaiAKQeAEakEAQQAgCigCECAKKAIUEJACQSRBBBD+AiIFRQ0BIAUgCikDgAk3AgAgBUEgaiAKQaAJaigCADYCACAFQRhqIApBmAlqKQMANwIAIAVBEGogCkGQCWopAwA3AgAgBUEIaiAKQYgJaikDADcCAEEBIRFBASENDAMLIAogBjYC4AQgCkEANgKICUEAIApB4ARqQfiXwAAgCkGACWpB/JfAABDaAQALQSRBBBC8AwALIAooAugEIQYgCigC5AQhCSAKKALgBCELDAILIAogDTYC8AggCiAFNgLsCCAKIBE2AugIIApBADYCkA0gCkKAgICAEDcDiA0gCkEBOwG4AiAKQQo2ArQCIApBAjoArAIgCiAKQYgNajYCsAIgS0MAAIA/XQRAIAUgDSBLEIIBCyAKKAIcITYgCigCICI0BEAgNiA0QQR0aiEVIDYhEQNAIBEiBUEQaiERIAVBCGooAgAhCAJAAkACQAJAAkACQAJAAkACQCAFQQxqKAIAIgdBBUciBkUEQCAIQaS1wABBBRDBAw0BIAooAuwIIAooAvAIIAUqAgAQbwwJCwJAAkACQAJAAkAgB0EEaw4HAQ0GAgQNAA0LIAhBqbXAAEEKEMEDDQwgCigC8AgiBUEFTwRAIApBADYCgAkgCkGACWohDEEAIQVBACEJAkACQCAKQegIaiIIKAIIIgtFDQAgCCgCBCENIAwoAgAhBgNAIAUgBmoiB0EBcQRAQQEhCSAMIAdBAWo2AgAgBUEBaiEFIA1BGGooAgBFDQIgDUEcaigCABA7DAILIA0QiwEgDCAHQQFqNgIAIA1BJGohDSALIAVBAWoiBUcNAAsMAQsgBSALRg0AIAsgBWshGCAIKAIEIAVBJGxqIQUgDCgCACENA0ACQCANQQFxBEAgDCANQQFqIg02AgAgCUEBaiEJIAVBGGooAgBFDQEgBUEcaigCABA7DAELIAUQiwEgDCANQQFqIg02AgAgBSAJQVxsaiIGIAUpAgA3AgAgBkEIaiAFQQhqKQIANwIAIAZBEGogBUEQaikCADcCACAGQRhqIAVBGGopAgA3AgAgBkEgaiAFQSBqKAIANgIACyAFQSRqIQUgGEEBayIYDQALCyAIIAsgCWs2AggMDQsgCigC7AggBUMAAABAEG8MDAsgCCgAAEHm2KWDB0cEQCAIKAAAQfLCpfMGRw0CIAUqAgAhQiMAQeAAayIdJAAgCkHoCGoiGEMAAABBEDgCQCAYQQhqIhMoAgBFDQAgGEEEaiIjKAIAIgUQyAMoAgAhCCAFEMgDKAIEIQcgHUEQaiAFEKYDIB1BCGogHSgCECAdKAIUEIIDIB0oAgghBiAdKAIMIQUgHSBCQwAAAABcOgAnIB0gBrMgBbOUQwAAIEGVOAJAIB0gBzYCWCAdIAg2AlAgHSAHIAhqQQVuNgI8IB1BADYCOCAdIB1BJ2o2AjQgHSAdQUBrNgIwIB0gHUHYAGo2AiwgHSAdQdAAajYCKCAdQRhqIR5BACEHIwBBMGsiGSQAIB1BKGoiDCgCFCIIIAwoAhAiBWsiF0EAIAggF08bIQlBBCEGAkACQCAFIAhPIghFBEAgCUHj8bgcSw0ZIAlBJGwiC0EASA0ZIAlB5PG4HElBAnQhBSALBH8gCyAFEP4CBSAFCyIGRQ0BCyAeIAY2AgQgHiAJNgIAIAhFBEAgDCgCDCEWIAwoAgghDSAMKAIEIQ8gDCgCACEMA0AgDCgCACEcIA8oAgAhKCANKgIAIUIgFi0AACEFEBsQGxAbIVcgGUEIaiIaAn8gBUUEQEEAIQ5B+AAhEEH/AQwBCwJ/EBtEAAAAAAAAcECiRAAAAAAAAAAAoJwiU0QAAAAAAADwQWMgU0QAAAAAAAAAAGYiC3EEQCBTqwwBC0EACxAbRAAAAAAAAHBAokQAAAAAAAAAAKCcIlhEAAAAAAAAAABmIQVBACALGyEJIFNEAADg////70FkIQsCfyBYRAAAAAAAAPBBYyBYRAAAAAAAAAAAZnEEQCBYqwwBC0EAC0EAIAUbIQgQG0QAAAAAAABwQKJEAAAAAAAAAACgnCJTRAAAAAAAAAAAZiEFQX8gCSALGyEOQX8gCCBYRAAA4P///+9BZBshEEF/An8gU0QAAAAAAADwQWMgU0QAAAAAAAAAAGZxBEAgU6sMAQtBAAtBACAFGyBTRAAA4P///+9BZBsLOgAiIBogEDoAISAaIA46ACAgGiBCOAIIIBogKDYCBCAaIBw2AgAgGkF/An8gVyBXoEQAAAAAAADwP6CcIlNEAAAAAAAA8EFjIFNEAAAAAAAAAABmIgVxBEAgU6sMAQtBAAtBACAFGyBTRAAA4P///+9BZBs2AhwgV0QAAAAAAAAUQKJEAAAAAAAA8D+gnCJTRAAAAAAAAAAAZiEFIBpBfwJ/IFNEAAAAAAAA8EFjIFNEAAAAAAAAAABmcQRAIFOrDAELQQALQQAgBRsgU0QAAOD////vQWQbNgIYIFcgQrsiU6IgU6CcIlNEAAAAAAAAAABmIQUgGkF/An8gU0QAAAAAAADwQWMgU0QAAAAAAAAAAGZxBEAgU6sMAQtBAAtBACAFGyBTRAAA4P///+9BZBs2AhQgKLiiRAAAAAAAAAAAoJwiU0QAAAAAAAAAAGYhBSAaQX8CfyBTRAAAAAAAAPBBYyBTRAAAAAAAAAAAZnEEQCBTqwwBC0EAC0EAIAUbIFNEAADg////70FkGzYCECAcuKJEAAAAAAAAAACgnCJTRAAAAAAAAAAAZiEFIBpBfwJ/IFNEAAAAAAAA8EFjIFNEAAAAAAAAAABmcQRAIFOrDAELQQALQQAgBRsgU0QAAOD////vQWQbNgIMIAZBIGogGUEoaigCADYCACAGQRhqIBlBIGopAwA3AgAgBkEQaiAZQRhqKQMANwIAIAZBCGogGUEQaikDADcCACAGIBkpAwg3AgAgBkEkaiEGIBcgB0EBaiIHRw0ACwsgHiAHNgIIIBlBMGokAAwBCyALIAUQvAMACwJAAn8gEygCACIGQQxPBEAgIygCACIFIAZBJGxqDAELIB1BKGogIygCACAGQQwQSiAYQQhqKAIAIgUEQCAFQSRsIQsgIygCAEEcaiEFA0AgBUEEaygCAARAIAUoAgAQOwsgBUEkaiEFIAtBJGsiCw0ACwsgGCgCAARAIBhBBGooAgAQOwsgGCAdKQMoNwIAIBhBCGoiBSAdQTBqKAIANgIAIAUoAgAiBkUNASAYQQRqKAIAIgUgBkEkbGoLIQ4gHSgCICIGBEAgHSgCHCIHIAZBJGxqIQwDQCAFQSRqIAUQyAMiBUEQaigCACEWIAVBDGooAgAhCSAFKAIEIQ0gBSgCACETIAchBQNAAkAgBSgCGCIIRQ0AIAUoAhwiGUUNAEEAIRgDQAJAIBlFDQBBACELAkACQANAAkACQCALIAUoAgxqIhAgBSgCAE8NACAFKAIQIBhqIg8gBSgCBE8NACANIA9NIBAgE09yDQEgECAPIBNsakECdCIPQQRqIRAgD0F8Rg0DIBAgFksNBCAJIA9qIAUvASAgBS0AIkEQdHJBgICAeHI2AAALIAtBAWoiCyAZRw0BDAQLCyAdQcwAakEHNgIAIB1BNGpBAjYCACAdQTxqQQI2AgAgHSAPNgJUIB0gEDYCUCAdQaSVwAA2AjAgHUEANgIoIB1BBzYCRCAdIA02AlwgHSATNgJYIB0gHUFAazYCOCAdIB1B2ABqNgJIIB0gHUHQAGo2AkAgHUEoakG0lcAAEKICAAtBfCAQQfiUwAAQmAMACyAQIBZB+JTAABCXAwALIBhBAWoiGCAIRg0BIAUoAhwhGQwACwALIAUgBSgCECAFKAIUaiIINgIQIAUoAgQgCEkEQCAFQQA2AhAgBSoCCCFCEBsiUyBToEQAAAAAAADwP6CcIlREAAAAAAAAAABmIQggBUF/An8gVEQAAAAAAADwQWMgVEQAAAAAAAAAAGZxBEAgVKsMAQtBAAtBACAIGyBURAAA4P///+9BZBs2AhwgU0QAAAAAAAAUQKJEAAAAAAAA8D+gnCJURAAAAAAAAAAAZiEIIAVBfwJ/IFREAAAAAAAA8EFjIFREAAAAAAAAAABmcQRAIFSrDAELQQALQQAgCBsgVEQAAOD////vQWQbNgIYIFMgQrsiU6IgU6CcIlNEAAAAAAAAAABmIQggBUF/An8gU0QAAAAAAADwQWMgU0QAAAAAAAAAAGZxBEAgU6sMAQtBAAtBACAIGyBTRAAA4P///+9BZBs2AhQLIAVBJGoiBSAMRw0ACyIFIA5HDQALDAELA0AgBRDIAxogBUEkaiIFIA5HDQALCyAdKAIYRQ0AIB0oAhwQOwsgHUHgAGokAAwMCyAKKALsCCENIAUqAgAhQgJAIAooAvAIIgVFDQAgQkMAAAAAXARAIAVBJGwhBQNAIA0QyAMhBkEAIQtBACEZIwBBQGoiDiQAAkACQAJAAkACQAJAAkACQAJAAkAgBigCACIIRQ0AIAYoAgQiI0ECSQ0AIAZBDGooAgAiECAIICNBAWtsQQJ0Ig9qIQwgI0EBdiEcQQAgCEECdCIeayEoQXwhCSAPQXxzIQcgBkEQaigCACEXA0AgIyALQX9zaiIGICNPDQIgCyAjRg0DQQAhGCAIIQYDQCAHIBhGDQUgDyAYaiIWQQRqIBdLDQYgGCAZaiEWIAkgGEYNCCAWQQRqIBdLDQkgDCAYaiIWKAAAIRMgFiAQIBhqIhYoAAA2AAAgFiATNgAAIBhBBGohGCAGQQFrIgYNAAsgDyAeayEPIAcgHmohByAMIChqIQwgGSAeaiEZIAkgHmshCSAQIB5qIRAgC0EBaiILIBxHDQALCyAOQUBrJAAMCAsgDkEsakEHNgIAIA5BFGpBAjYCACAOQRxqQQI2AgAgDiAGNgI0DAYLIAYgCGxBAnQiAEF8Rg0AIABBBGoiGCAXSw0CIA5BLGpBBzYCACAOQRRqQQI2AgAgDkEcakECNgIAIA4gIzYCNAwFC0F8QQBBkIrAABCYAwALIBZBBGohGAsgGCAXQZCKwAAQlwMAC0F8IBZBBGpBkIrAABCYAwALIBZBBGogF0GQisAAEJcDAAsgDkEANgIwIA5BpInAADYCECAOQQA2AgggDkEHNgIkIA4gIzYCPCAOIAg2AjgMGQsgDUEkaiENIAVBJGsiBQ0ACwwBCyAFQSRsIQUDQCANEMgDIQZBACEQQQAhGCMAQUBqIg4kAAJAAkACQAJAAkACQAJAAkACQCAGKAIAIh5BAkkNACAGKAIEIhxFDQAgHkECdCIMIAZBDGooAgAiCWpBBGshC0EAIB5BAXZrISggBkEQaigCACEXA0AgDCEHIAshCEEEIQ8gCSEGQQAhGQNAIB4gGSAeaiIWQQFrTQ0DIAcgEGoiE0UNBCATIBdLDQUgFkUNBiAPIBBqIhZFDQcgFiAXSw0IIAggEGoiFigAACETIBYgBiAQaiIWKAAANgAAIBYgEzYAACAHQQRrIQcgCEEEayEIIA9BBGohDyAGQQRqIQYgKCAZQQFrIhlHDQALIAwgEGohECAYQQFqIhggHEcNAAsLIA5BQGskAAwHCyAOQSxqQQc2AgAgDkEUakECNgIAIA5BHGpBAjYCACAOIBg2AjQgDiAWQQFrNgIwDAULQXwgE0GQisAAEJgDAAsgEyAXQZCKwAAQlwMACyAOQSxqQQc2AgAgDkEUakECNgIAIA5BHGpBAjYCACAOIBg2AjQgDiAeNgIwDAILQXwgFkGQisAAEJgDAAsgFiAXQZCKwAAQlwMACyAOQaSJwAA2AhAgDkEANgIIIA5BBzYCJCAOIBw2AjwgDiAeNgI4DBgLIA1BJGohDSAFQSRrIgUNAAsLDAsLIAhBs7XAAEEHEMEDRQ0JIAhBurXAAEEHEMEDDQQgBSoCACFCIwBB4ABrIg4kACAKQegIaiIIQwAAAEEQOAJAAkACQAJAIAhBCGooAgBFDQAgDkEQaiAIQQRqIgcoAgAQpgMgDkEIaiAOKAIQIA4oAhQQggMgDkHIAGogBygCACAIQQhqIgYoAgBBfwJ/QwAAtEMgDigCCLMgDigCDLOUQwAAIEGVQwAAtEOUIEJDAADwQpRDAAAAPpSVIlGVjiJCQwAAgE9dIEJDAAAAAGAiBXEEQCBCqQwBC0EAC0EAIAUbIEJD//9/T14bEEogBigCACIFBEAgBUEkbCEGIAcoAgBBHGohCQNAIAlBBGsoAgAEQCAJKAIAEDsLIAlBJGohCSAGQSRrIgYNAAsLIAgoAgAEQCAIQQRqKAIAEDsLIAggDikDSDcCACAIQQhqIgUgDkHQAGoiFigCADYCACAFKAIAIgVFDQAgCEEEaigCACIGIAVBJGxqIQ9BACELA0AgBhDIAyIHKAIAIgVB/////wNxIAVHDQMgBzUCBCAFQQJ0rX4iPUIgiKcNAyA9pyIJIAdBEGooAgAiBUsNAiAGQSRqIQYgCQRAIFEgC7OUQwAAtEMQ0wMiQkMAADRDIEKTIEJDAAA0Q10bIVIgB0EMaigCACENA0AgCUEEayEJIA0tAAMEQCAOQTBqIQUgDS0AAbMhRCANLQACsyFFQwAAAAAhQgJAIA0tAACzIkNDAAAAAF1FBEBDAAB/QyFCIENDAAB/Q15FDQELIEIhQwtDAAAAACFCAkAgREMAAAAAXUUEQEMAAH9DIUIgREMAAH9DXkUNAQsgQiFEC0MAAAAAIUICQCBFQwAAAABdRQRAQwAAf0MhQiBFQwAAf0NeRQ0BCyBCIUULIAUgRTgCECAFIEQ4AgwgBSBDOAIIIAVBADYCAAJAAkACQCAFKgIIQwAA8EFfRQ0AIA5BMGoqAgxDAADwQV9FDQAgDkEwaioCEEMAAPBBXw0BCwJAAkAgDkEwaioCCEMAAFxDYEUNACAOQTBqKgIMQwAAXENgRQ0AIA5BMGoqAhBDAABcQ2ANAQtDAAAAACFHQwAAAAAhQ0MAAAAAIUJDAAAAACFJQwAAAAAhRSMAQSBrIgckACAHIA5BMGoiBSoCEDgCGCAHIAUpAgg3AxAgB0EQaiIFKgIIIUogBSoCBCFGIAUqAgBDAAB/Q5UiTUP//39/EOcCIEZDAAB/Q5UiThDnAiBKQwAAf0OVIk8Q5wIiUCBNQ///f/8Q5gIgThDmAiBPEOYCIkySIkRDAAAAP5QhSCBMIFBcBEAgTCBQkyJHQwAAAEAgTJMgUJMgRCBIQwAAAD9eG5VDAADIQpQhSQJ9AkAgTCBNXARAIEwgTlsNASBNIE6TIEeVIURDAACAQAwCC0MAAMBAQwAAAAAgRiBKXRshRCBOIE+TIEeVDAELIE8gTZMgR5UhREMAAABACyBEkkMAAHBClCFHCyAOQRhqIQUgByBJOAIEIAcgRzgCACAHIEhDAADIQpQ4AggCQCAHKgIAIkRDAAAAAF1FBEBDAAC0QyFDIERDAAC0Q15FDQELIEMhRAsCQCAHKgIEIkNDAAAAAF1FBEBDAADIQiFCIENDAADIQl5FDQELIEIhQwsCQCAHKgIIIkJDAAAAAF1FBEBDAADIQiFFIEJDAADIQl5FDQELIEUhQgsgBSBCOAIQIAUgQzgCDCAFQQA2AgAgBUMAAAAAIEQgREMAALTDkotDAAAANF0bOAIIIAdBIGokAAwCCyAOQRhqQwAANENDAACgQhC+AQwBCyAOQRhqQwAAtEJDAACgQRC+AQsgDkHIAGogDkEYaiIFIFIQ7wEgDkEoaiIMIA5B2ABqIggoAgA2AgAgDkEgaiIHIBYpAwA3AwAgDiAOKQNINwMYIAUqAghDAAC0Q14EQANAIA5ByABqIA5BGGoiBUMAALTDEO8BIAwgCCgCADYCACAHIBYpAwA3AwAgDiAOKQNINwMYIAUqAghDAAC0Q14NAAsLIA5ByABqIQdDAAAAACFEQwAAAAAhRUMAAAAAIUgjAEEgayIIJAAgCCAOQRhqIgUqAhA4AhggCCAFKQIINwMQIAhBEGoiBSoCCEMAAMhClSFKIAgCfQJ9AkAgBSoCBEMAAMhClSJCQwAAAABcBEAgBSoCAEMAALRDlSFDIEpDAAAAP10NASBCIEqSIEIgSpSTDAILIEpDAAB/Q5QiRyFJIEcMAgsgSiBCQwAAgD+SlAshRiBDQ6uqqj6SIkdDAAAAAF0iBSBHQwAAgD9ecgRAA0AgR0MAAIA/QwAAgL8gBRuSIkdDAAAAAF0iBSBHQwAAgD9ecg0ACwsCQCBDQwAAAABdIgVFBEAgQyJCQwAAgD9eRQ0BCyBDIUIDQCBCQwAAgD9DAACAvyAFG5IiQkMAAAAAXSIFIEJDAACAP15yDQALCyBDQ6uqqr6SIklDAAAAAF0iBSBJQwAAgD9ecgRAA0AgSUMAAIA/QwAAgL8gBRuSIklDAAAAAF0iBSBJQwAAgD9ecg0ACwsgSiBKkiBGkyFDAn0gR0MAAMBAlEMAAIA/XUUEQCBGIEcgR5JDAACAP10NARogQyBHQwAAQECUQwAAAEBdRQ0BGiBDIEYgQ5NDq6oqPyBHk5RDAADAQJSSDAELIEMgRiBDk0MAAMBAlCBHlJILAn0gQkMAAMBAlEMAAIA/XUUEQCBGIEIgQpJDAACAP10NARogQyBCQwAAQECUQwAAAEBdRQ0BGiBDIEYgQ5NDq6oqPyBCk5RDAADAQJSSDAELIEMgRiBDk0MAAMBAlCBClJILIUICQCBJQwAAwECUQwAAgD9dRQRAIEkgSZJDAACAP10NASBJQwAAQECUQwAAAEBdRQRAIEMhRgwCCyBDIEYgQ5NDq6oqPyBJk5RDAADAQJSSIUYMAQsgQyBGIEOTQwAAwECUIEmUkiFGC0MAAH9DlCFHIEJDAAB/Q5QhSSBGQwAAf0OUCzgCCCAIIEk4AgQgCCBHOAIAAkAgCCoCACJCQwAAAABdRQRAQwAAf0MhRCBCQwAAf0NeRQ0BCyBEIUILAkAgCCoCBCJEQwAAAABdRQRAQwAAf0MhRSBEQwAAf0NeRQ0BCyBFIUQLAkAgCCoCCCJFQwAAAABdRQRAQwAAf0MhSCBFQwAAf0NeRQ0BCyBIIUULIAcgRTgCECAHIEQ4AgwgByBCOAIIIAdBADYCACAIQSBqJAAgDkEwaiIFIAcqAhA4AgggBSAHKQIINwIAIA4qAjgQ7gIiREMAAAAAYCEFIA4qAjAgDioCNCANQf8BAn8gREMAAIBPXSBEQwAAAABgcQRAIESpDAELQQALQQAgBRsgREMAAH9DXhs6AAIQ7gIiQkMAAAAAYCEFIA1B/wECfyBCQwAAgE9dIEJDAAAAAGBxBEAgQqkMAQtBAAtBACAFGyBCQwAAf0NeGzoAARDuAiJCQwAAAABgIQUgDUH/AQJ/IEJDAACAT10gQkMAAAAAYHEEQCBCqQwBC0EAC0EAIAUbIEJDAAB/Q14bOgAACyANQQRqIQ0gCQ0ACwsgC0EBaiELIAYgD0cNAAsLIA5B4ABqJAAMAgsgCSAFQcSJwAAQlwMAC0HUicAAQStBgIrAABCGAgALDAoLIAgoAABB8+Cl8wZHDQkgCkHoCGogBSoCAEEAEFwMCQsgCCkAAELp3JnL5q2auuUAUQ0EIAgpAABC89ilo9bM3LL2AFINAyAKQegIaiAFKgIAQQEQSwwICyAIQc61wABBBRDBAw0CIApB6AhqIAUqAgBBABBLDAcLIAhBwbXAAEEGEMEDRQ0EIAhB07XAACAHEMEDDQEgBSoCACFCIwBBkAFrIhAkACAKQegIaiIMQwAAwEAQOAJAAkACQAJAAkAgDEEIaigCAEUNACAMQQRqIgsoAgAiBRDIAygCACAFEMgDKAIEIQcgEEEQaiAFEKYDIBBBCGogECgCECAQKAIUEIIDIBBB8ABqIAsoAgAgDEEIaiIGKAIAQX8Cf0MAAABCIBAoAgizIBAoAgyzlEMAACBBlUMAAABClCBCQwAAgEKUQwAAAD6UlZUiRY4iQkMAAIBPXSBCQwAAAABgIgVxBEAgQqkMAQtBAAtBACAFGyBCQ///f09eGxBKIAYoAgAhBiALKAIAIQWzIkNDAADIQpUiQiBCkkMAAIA/EOYCIUIgB7MiREMAAEBClY5DAACAPxDmAiFIIAYEQCAGQSRsIQkgBUEcaiEFA0AgBUEEaygCAARAIAUoAgAQOwsgBUEkaiEFIAlBJGsiCQ0ACwsgDCgCAARAIAxBBGooAgAQOwsgDCAQKQNwNwIAIAxBCGoiBSAQQfgAaigCADYCACAFKAIAIgtFDQAgDEEEaigCACEZIENDAAAAAGAhBgJ/IERDAAAAAGAiBSBEQwAAgE9dcQRAIESpDAELQQALQQAgBRshCCBEQ///f09eIQdBfwJ/IAYgQ0MAAIBPXXEEQCBDqQwBC0EAC0EAIAYbIEND//9/T14bIg1B/////wNxIA1GAn8gSEMAAIBPXSBIQwAAAABgcQRAIEipDAELQQALIQVBfyAIIAcbIQ5FDQMgDUECdK0gDq1+Ij1CIIhQRQ0DID2nIRZBfyAFQQAgSEMAAAAAYBsgSEP//39PXhsiBkUNAiAZIAtBJGxqIQwgFkF/c0EfdiEPIAZBAWshCSAWQQBOIQtBACEYA0AgEEEANgIkIBAgSDgCICAQIEI4AhwgEEEANgIYIBAgRTgCNCAQIBizOAIwIBAgDjYCLCAQIA02AihBASEFIBYEQCALRQ0WIBYgDxD/AiIFRQ0DCyAQIBY2AkggECAFNgJEIBAgFjYCQCAQIA42AjwgECANNgI4IBAgGTYCZCAQQQA2AlAgECAQQThqNgJsIBAgEEEoajYCaCAQIBBBNGo2AmAgECAQQTBqNgJcIBAgEEEsajYCWCAQIBBBGGo2AlQCQCAORQ0AIBBB0ABqQQAQNSAQQYgBaiAQQegAaikDADcDACAQQYABaiAQQeAAaikDADcDACAQQfgAaiAQQdgAaikDADcDACAQIBApA1A3A3AgBiAOTw0AIAYhBQNAIBBB8ABqIAUQNSAFQQFqIgggCWoiByAISQ0BIAUgBmohBSAHIA5JDQALCyAQQYABaiIHIBBByABqKAIANgIAIBBB+ABqIgUgEEFAaykDADcDACAQIBApAzg3A3AgGRDIAyIIKAIIBEAgCEEMaigCABA7CyAYQQFqIRggCCAQKQNwNwIAIAhBEGogBygCADYCACAIQQhqIAUpAwA3AgAgGUEkaiIFIRkgBSAMRw0ACwsgEEGQAWokAAwDCyAWIA8QvAMACyAQQQA2AiQgECBIOAIgIBAgQjgCHCAQQQA2AhggECBFOAI0IBBBADYCMCAQIA42AiwgECANNgIoIBZBAEgNEUHMjMAAQRtBwI3AABCGAgALIBBBADYCJCAQIEg4AiAgECBCOAIcIBBBADYCGCAQIEU4AjQgEEEANgIwIBAgDjYCLCAQIA02AigMDQsMBgsgCEHHtcAAIAcQwQNFDQILIAYNBCAIQdm1wABBBRDBAw0EIAUqAgAhQiMAQUBqIhckACAKQegIaiILQwAAoEAQOAJAAkACQCALQQhqKAIARQ0AIAtBBGoiCCgCACIFEMgDKAIAISggBRDIAygCBCEOIBdBCGogBRCmAyAXIBcoAgggFygCDBCCAwJ/QwAAgEAgFygCALMgFygCBLOUQwAAIEGVQwAAgECUQwAAoEGVlY5DAACAQBDmAiJFQwAAgE9dIEVDAAAAAGAiB3EEQCBFqQwBC0EACyEGIBdBKGogCCgCACALQQhqIgUoAgBBfyAGQQAgBxsgRUP//39PXhsiExBKAn5DAAAgQSBCk0MAAAA/lCJCICizQwAAQEKVlI0iRYtDAAAAX10EQCBFrgwBC0KAgICAgICAgIB/CyE/An4gQiAOs0MAAEBClZSNIkKLQwAAAF9dBEAgQq4MAQtCgICAgICAgICAfwshPiAFKAIAIgUEQCAFQSRsIQ0gCCgCAEEcaiEHA0AgB0EEaygCAARAIAcoAgAQOwsgB0EkaiEHIA1BJGsiDQ0ACwsgCygCAARAIAtBBGooAgAQOwsgCyAXKQMoNwIAIAtBCGoiBSAXQTBqKAIANgIAIAUoAgAiBUUNACATRQ0BIChB/////wNxIChHDQ0gKEECdK0gDq1+Ij1CIIinDQ0gC0EEaigCACENQgBC////////////ACA/QoCAgICAgICAgH8gRUMAAADfYBsgRUP///9eXhtCACBFIEVbGyJBfSFAQgBC////////////ACA+QoCAgICAgICAgH8gQkMAAADfYBsgQkP///9eXhtCACBCIEJbGyI/fSE+IBNBfHEhDCATQQJ2IhZBA2whCSAWQQF0IQsgPaciHEF/c0EfdiEPIAVBJGwhB0EAIRggHEEATiEIA0AgGCATcCEGQQEhBQJAAkACQCAcBEAgCEUNFSAcIA8Q/wIiBUUNAQsgFyAcNgIgIBcgBTYCHCAXIBw2AhggFyAONgIUIBcgKDYCEAJAAkACQCAGIBZPBEAgBiALSQ0BIAYgCUkNAiAGIAxJDQMgHEUNBiAFEDsMBgsgF0EQaiANEMgDIEAgPhBADAQLIBdBEGogDRDIAyBAID8QQAwDCyAXQRBqIA0QyAMgQSA/EEAMAgsgF0EQaiANEMgDIEEgPhBADAELIBwgDxC8AwALIBdBOGoiBiAXQSBqKAIANgIAIBdBMGoiBSAXQRhqKQMANwMAIBcgFykDEDcDKCANEMgDIhAoAggEQCAQQQxqKAIAEDsLIBAgFykDKDcCACAQQRBqIAYoAgA2AgAgEEEIaiAFKQMANwIACyANQSRqIQ0gGEEBaiEYIAdBJGsiBw0ACwsgF0FAayQADAELQZCMwABBOUH8i8AAEIYCAAsMBAsgBSoCACFCIwBB0ABrIg4kACAKQegIaiIJQwAAAEEQOAJAIAlBCGooAgBFDQAgDkEIaiAJQQRqIggoAgAQpgMgDiAOKAIIIA4oAgwQggMgDkE4aiAIKAIAIAlBCGoiBigCAEF/An9DAACAPyAOKAIAsyAOKAIEs5RDAAAgQZUgQkMAAMhClEMAAAA+lJUiRpWOIkJDAACAT10gQkMAAAAAYCIFcQRAIEKpDAELQQALQQAgBRsgQkP//39PXhsQSiAGKAIAIgUEQCAFQSRsIQcgCCgCAEEcaiEFA0AgBUEEaygCAARAIAUoAgAQOwsgBUEkaiEFIAdBJGsiBw0ACwsgCSgCAARAIAlBBGooAgAQOwsgCSAOKQM4NwIAIAlBCGoiByAOQUBrIhYoAgA2AgAgDkEANgIYIA5CgICAgMAANwMQIA5BEGpBBRCaASAOKAIUIgYgDigCGCIFQQJ0aiIIIEZDAACAQJI4AgAgCEEEaiBGQwAAQECSOAIAIAhBCGogRkMAAABAkjgCACAIQQxqIEZDAACAP5I4AgAgCEEQaiBGQwAAAACSOAIAIA4gBUEFaiILNgIYIAcoAgAiBQRAIAlBBGooAgAiGSAFQSRsaiEPA0AgGRDIAygCALMiSEMAAAAAYCEFQX8CfyBIQwAAgE9dIEhDAAAAAGBxBEAgSKkMAQtBAAtBACAFGyBIQ///f09eGyIIQf////8DcSAIRwJ/IBkQyAMoAgSzIkNDAACAT10gQ0MAAAAAYHEEQCBDqQwBC0EACyEFDQwgCEECdK1BfyAFQQAgQ0MAAAAAYBsgQ0P//39PXhsiBa1+Ij1CIIinDQwCQAJAAkACQCA9pyIHRQRAQQEhDQwBCyAHQQBIDRMgB0EBEP8CIg1FDQELIA4gBzYCMCAOIA02AiwgDiAHNgIoIA4gBTYCJCAOIAg2AiAgCwRAIAtBAnQhByAGIQUDQCAFKgIAIkIgQ5QQ7gIiREMAAAAAYCEIQX8CfyBEQwAAgE9dIERDAAAAAGBxBEAgRKkMAQtBAAtBACAIGyBEQ///f09eGyEMIEIgSJQQ7gIiRUMAAAAAYCEJAn8gRUMAAIBPXSBFQwAAAABgcQRAIEWpDAELQQALIQggDkE4aiAZEMgDQX8gCEEAIAkbIEVD//9/T14bIAwQKSBEIEOTQwAAAD+UEO4CIkJDAAAA32AhCEIAQv///////////wACfiBCi0MAAABfXQRAIEKuDAELQoCAgICAgICAgH8LQoCAgICAgICAgH8gCBsgQkP///9eXhtCACBCIEJbG30hPSBFIEiTQwAAAD+UEO4CIkJDAAAA32AhCCAOQSBqIA5BOGpCAEL///////////8AAn4gQotDAAAAX10EQCBCrgwBC0KAgICAgICAgIB/C0KAgICAgICAgIB/IAgbIEJD////Xl4bQgAgQiBCWxt9ID0QQCAOKAJABEAgDigCRBA7CyAFQQRqIQUgB0EEayIHDQALCyAOQcgAaiIFIA5BMGooAgA2AgAgFiAOQShqKQMANwMAIA4gDikDIDcDOCAZEMgDIgcoAggEQCAHQQxqKAIAEDsLIBlBJGohGSAHIA4pAzg3AgAgB0EQaiAFKAIANgIAIAdBCGogFikDADcCACALRQRAIAuzIUIMAgsgC7MiQiAGKgIAXw0BIA4oAhQiBiEFIAtBB3EiBwRAA0AgBSBGIAUqAgCSOAIAIAVBBGohBSAHQQFrIgcNAAsLIAtBAWtB/////wNxQQdJDQIgBiALQQJ0aiEIA0AgBSBGIAUqAgCSOAIAIAVBBGoiByBGIAcqAgCSOAIAIAVBCGoiByBGIAcqAgCSOAIAIAVBDGoiByBGIAcqAgCSOAIAIAVBEGoiByBGIAcqAgCSOAIAIAVBFGoiByBGIAcqAgCSOAIAIAVBGGoiByBGIAcqAgCSOAIAIAVBHGoiByBGIAcqAgCSOAIAIAVBIGoiBSAIRw0ACwwCCyAHQQEQvAMAC0EAIQ0gDkEANgIYIA4CfyALIA4oAhBLBEAgDkEQaiALEJoBIA4oAhghDSAOKAIUIQYLIA0gC0UNABpBACEFIAtBAUcEQCALQX5xIQggBiANQQJ0aiEHA0AgByBGIEIgBbOTQwAAgL+SkjgCACAHQQRqIEYgQiAFQQFqs5NDAACAv5KSOAIAIAdBCGohByAFQQJqIgUgCEcNAAsgBSANaiENCyANIAtBAXFFDQAaIAYgDUECdGogRiBCIAWzk0MAAIC/kpI4AgAgDUEBagsiCzYCGAsgDyAZRw0ACwsgDigCEEUNACAOKAIUEDsLIA5B0ABqJAAMAwsgCkHoCGogBSoCAEEBEFwMAgsgCigC7AghDSAKKALwCCEGIAUqAgAhQiMAQSBrIgckACAGBEAgBkEkbCEJIEJDNfqOPJQhQgNAIAdBCGogDRDIAyBCECcgDRDIAyIFKAIIBEAgBUEMaigCABA7CyANQSRqIQ0gBSAHKQMINwIAIAVBEGogB0EYaigCADYCACAFQQhqIAdBEGopAwA3AgAgCUEkayIJDQALCyAHQSBqJAAMAQsgCigC8AgiBUECSQ0AIAVBAXYhCyAKKALsCCEMIAVBJGxBJGshBkEAIQkDQCAJIAxqIg1BCGoiBSkCACE9IAUgBiAMaiIPQQhqIgUpAgA3AgAgBSA9NwIAIA9BFGooAgAhCCAPQRBqIgUoAgAhByAFIA1BEGoiBSkCADcCACANKQIAIT0gDSAPKQIANwIAIA8gPTcCACAFIAc2AgAgDUEUaiAINgIAIA1BGGoiBSgCACEHIAUgD0EYaiIFKAIANgIAIAUgBzYCACAPQRxqIgUoAgAhByAFIA1BHGoiBSgCADYCACAFIAc2AgAgDUEgaiIFKAIAIQcgBSAPQSBqIgUoAgA2AgAgBSAHNgIAIAZBJGshBiAJQSRqIQkgC0EBayILDQALCyARIBVHDQALCyBLQwAAgD9eBEAgCigC7AggCigC8AggSxCCAQsgCigC8AghBiAKKALoCCE4IAogCigC7AgiFjYCtA0gCiAWNgKsDSAKIDg2AqgNIAogFiAGQSRsIhFqIjk2ArANIBYhBSAGBEAgFiENAkADQCAKIA0iKEEkaiINNgKsDSAoKAIcIgZFDQEgKCgCICEFIApBmAlqIjogKEEYaigCADYCACAKQZAJaiI7IChBEGopAgA3AwAgCkGICWoiPCAoQQhqKQIANwMAIAogBTYCoAkgCiAGNgKcCSAKICgpAgA3A4AJIApB4ARqISojAEGAAmsiEiQAIBJB+AFqIgggCkGACWoiC0EgaigCADYCACASQfABaiIHIAtBGGopAgA3AwAgEkHoAWoiBiALQRBqKQIANwMAIBJB4AFqIgUgC0EIaikCADcDACASIAspAgA3A9gBIApBmAJqIilBHGooAgAhGSASQRBqIBJB2AFqEKYDIBJBCGogEigCECASKAIUEIIDAkACQAJAAkAgEigCDCItBEAgEigCCCEuIBJBmAFqIAgoAgA2AgAgEkGQAWogBykDADcDACASQYgBaiAGKQMANwMAIBJBgAFqIAUpAwA3AwAgEiASKQPYATcDeCASQcABaiIGIBJB+ABqIgUpAhA3AgAgBkEQaiAFQSBqKAIANgIAIAZBCGogBUEYaikCADcCACASQagBaiIHIBIoAsABIgYgEigCxAEiBXJB//8DTQR/IAcgBjsBAiAHQQRqIAU7AQBBAQVBAAs7AQAgEi8BqAEEQCASQfgAaiEmIBIvAaoBITUgEi8BrAEhNyASQcwBaigCACEvIBJB0AFqKAIAIRBBACEyQQAhMSMAQdABayIUJAAgFCA1IDdsQQJ0IgU2AgggFCAQNgKAAQJAAn8CQCAFIBBGBEACQCAZQQFrQR5JBEAgEEF8cSIzRQ0FIDNBBGsiBkECdkEBaiIFQQFxIQcgBg0BIC8MBAsjAEEQayIAJAAgAEHEqMIANgIIIABBJjYCBCAAQZyowgA2AgAjAEEQayIBJAAgAUEIaiAAQQhqKAIANgIAIAEgACkCADcDACMAQRBrIgAkACAAIAEpAgA3AwggAEEIakHMosIAQQAgASgCCEEBEKsBAAsgL0EHaiEhIAVB/v///wdxIQYDQAJAICFBBGsiBS0AAARAIAVB/wE6AAAMAQsgIUEHay0AACAhQQZrLQAAQQh0ciAhQQVrLQAAQRB0ciEyQQEhMQsCQCAhLQAABEAgIUH/AToAAAwBCyAhQQNrLQAAICFBAmstAABBCHRyICFBAWstAABBEHRyITJBASExCyAhQQhqISEgBkECayIGDQALDAELIBRBADYCPCAUQdSmwgA2AjggFEEBNgI0IBRBrKfCADYCMCAUQQA2AigjAEEgayIBJAAgASAUQYABajYCBCABIBRBCGo2AgAgAUEYaiAUQShqIgBBEGopAgA3AwAgAUEQaiAAQQhqKQIANwMAIAEgACkCADcDCEEAIAFBhK3CACABQQRqQYStwgAgAUEIakGMqMIAEGYACyAhQQdrCyEFIAdFDQAgBS0AAwRAIAVB/wE6AAMMAQsgBS8AACAFLQACQRB0ciEyQQEhMQsCQBDOASIFBEACQCAFIAUpAwAiPUIBfDcDACAUQSRqQZCswgA2AgBBACEhIBRBIGoiHEEANgIAIBRCADcDGCAUIAUpAwg3AxAgFCA9NwMIIBBBA3EhJwJAAkAgMwRAA0AgISAvaigAACEFQQAhCSMAQRBrIiIkACAiIAU2AgggFEEIaiIFICJBCGoQeSFAIAVBHGooAgAiE0EEayEOIEBCGYhC/wCDQoGChIiQoMCAAX4hPiAFQRBqIgcoAgAhFSBApyEPICItAAghDCAiLQAJIQsgIi0ACiEIICItAAshBgJ/A0ACQCATIA8gFXEiD2opAAAiPyA+hSI9Qn+FID1CgYKEiJCgwIABfYNCgIGChIiQoMCAf4MiPVANAANAAkACQCAMIA4gPXqnQQN2IA9qIBVxQQJ0ayIXLQAARw0AIAsgFy0AAUcNACAIIBctAAJHDQAgBiAXLQADRg0BCyA9QgF9ID2DIj1QRQ0BDAILC0EBDAILID8gP0IBhoNCgIGChIiQoMCAf4NQBEAgDyAJQQhqIglqIQ8MAQsLICIoAgghEyAHQQxqKAIAIgkgBygCACIMIECnIiNxIg9qKQAAQoCBgoSIkKDAgH+DIj1QBEBBCCEGA0AgBiAPaiEIIAZBCGohBiAJIAggDHEiD2opAABCgIGChIiQoMCAf4MiPVANAAsLAkAgCSA9eqdBA3YgD2ogDHEiBmosAAAiCEEATgR/IAkgCSkDAEKAgYKEiJCgwIB/g3qnQQN2IgZqLQAABSAIC0EBcSIORQ0AIAcoAgQNACAFIQZBACELIwBBMGsiJCQAAkAgB0EIaigCACIeQQFqIghFBEAQ9gEgJCgCDBoMAQsCQAJAAkACQCAHKAIAIiAgIEEBaiIMQQN2QQdsICBBCEkbIh1BAXYgCEkEQCAIIB1BAWoiBSAFIAhJGyIFQQhJDQEgBSAFQf////8BcUYEQEF/IAVBA3RBB25BAWtndkEBaiEFDAULEPYBICQoAixBgYCAgHhHDQUgJCgCKCEFDAQLIAdBDGooAgAhH0EAIQUDQAJAAn8gC0EBcQRAIAVBB2oiCyAFSSALIAxPcg0CIAVBCGoMAQsgBSAMSSIIRQ0BIAUhCyAFIAhqCyEFIAsgH2oiCCAIKQMAIj1Cf4VCB4hCgYKEiJCgwIABgyA9Qv/+/fv379+//wCEfDcDAEEBIQsMAQsLIAxBCE8EQCAMIB9qIB8pAAA3AAAMAgsgH0EIaiAfIAwQwwMgIEF/Rw0BQQAhHQwCC0EEQQggBUEESRshBQwCCyAfQQRrIQ9BACEFA0ACQCAfIAUiCGoiFy0AAEGAAUcNACAPIAhBAnRrIQwgHyAIQX9zQQJ0aiEaAkADQCAgIAYgDBB5pyIVcSIJIQsgCSAfaikAAEKAgYKEiJCgwIB/gyI9UARAQQghBQNAIAUgC2ohCyAFQQhqIQUgHyALICBxIgtqKQAAQoCBgoSIkKDAgH+DIj1QDQALCyAfID16p0EDdiALaiAgcSIFaiwAAEEATgRAIB8pAwBCgIGChIiQoMCAf4N6p0EDdiEFCyAFIAlrIAggCWtzICBxQQhPBEAgHyAFQX9zQQJ0aiEYIAUgH2oiCy0AACALIBVBGXYiCzoAACAFQQhrICBxIB9qQQhqIAs6AABB/wFGDQIgGigAACEFIBogGCgAADYAACAYIAU2AAAMAQsLIBcgFUEZdiIFOgAAIAhBCGsgIHEgH2pBCGogBToAAAwBCyAXQf8BOgAAIAhBCGsgIHEgH2pBCGpB/wE6AAAgGCAaKAAANgAACyAIQQFqIQUgCCAgRw0ACwsgByAdIB5rNgIEDAELAkACQAJAAkAgBUH/////A3EgBUcNACAFQQJ0IgtBB2oiCCALSQ0AIAhBeHEiCyAFQQhqIghqIgkgC0kNACAJQQBIDQFBCCEYAkAgCUUNACAJQQgQ/gIiGA0AIAkQzwIgJCgCJBoMBQsgCyAYakH/ASAIEMADIRogBUEBayIXIAVBA3ZBB2wgF0EISRsgHmshDyAMRQRAIAcgDzYCBCAHIBc2AgAgBygCDCEYIAcgGjYCDAwECyAHQQxqKAIAIhhBBGshDEEAIRUDQCAVIBhqLAAAQQBOBEAgGiAXIAYgDCAVQQJ0axB5pyIJcSILaikAAEKAgYKEiJCgwIB/gyI9UARAQQghBQNAIAUgC2ohCCAFQQhqIQUgGiAIIBdxIgtqKQAAQoCBgoSIkKDAgH+DIj1QDQALCyAaID16p0EDdiALaiAXcSIFaiwAAEEATgRAIBopAwBCgIGChIiQoMCAf4N6p0EDdiEFCyAFIBpqIAlBGXYiCDoAACAFQQhrIBdxIBpqQQhqIAg6AAAgGiAFQX9zQQJ0aiAYIBVBf3NBAnRqKAAANgIACyAVICBGIBVBAWohFUUNAAsMAgsQ9gEgJCgCFBoMAwsQ9gEgJCgCHBoMAgsgByAPNgIEIAcgFzYCACAHQQxqIBo2AgAgIA0ADAELICAgIEECdEELakF4cSIFakF3Rg0AIBggBWsQOwsgJEEwaiQAIAdBDGooAgAiCSAHKAIAIgwgI3EiCGopAABCgIGChIiQoMCAf4MiPVAEQEEIIQYDQCAGIAhqIQUgBkEIaiEGIAkgBSAMcSIIaikAAEKAgYKEiJCgwIB/gyI9UA0ACwsgCSA9eqdBA3YgCGogDHEiBmosAABBAEgNACAJKQMAQoCBgoSIkKDAgH+DeqdBA3YhBgsgBiAJaiAjQRl2IgU6AAAgBkEIayAMcSAJakEIaiAFOgAAIAcgBygCBCAOazYCBCAHIAcoAghBAWo2AgggCSAGQQJ0a0EEayATNgAAQQALICJBEGokAEUEQCAUKAIgQYACSw0DCyAzICFBBGoiIUcNAAsLIBRBQGsiDCAcKQMAIj43AwAgFEE4aiIJIBRBGGopAwAiPTcDACAUQTBqIgsgFEEQaikDADcDACAUIBQpAwg3AyggFEHIAWogPjcDACAUID03A8ABIBRBgAFqIRNBACEGQQAhCCAUQcABaiIFKAIAIg5BAWohDyAFKAIIIQcgBSgCDCIQKQMAIT0gDgR/IBAgD0ECdEEHakF4cSIFayEIIAUgDmpBCWohBkEIBUEACyEFIBMgCDYCICATIAc2AhggEyAQNgIQIBNBKGogBTYCACATQSRqIAY2AgAgEyAPIBBqNgIMIBMgEEEIajYCCCATID1Cf4VCgIGChIiQoMCAf4M3AwAgFEHQAGogFEGoAWopAwA3AwAgFEHIAGogFEGgAWopAwA3AwAgDCAUQZgBaikDADcDACAJIBRBkAFqKQMANwMAIAsgFEGIAWopAwA3AwAgFCAUKQOAATcDKCAUQfAAaiEOIwBBgAFrIhMkACATQTBqIgUgFEEoaiIbQShqKQMANwMAIBNBKGogG0EgaikDADcDACATQSBqIBtBGGopAwA3AwAgE0EYaiAbQRBqKQMANwMAIBNBEGogG0EIaikDADcDACATIBspAwA3AwggE0HIAGogE0EIahCvAQJAAkACQCATLQBIRQRAIA5BADYCCCAOQoCAgIAQNwIAIAUoAgBFDQEgE0EsaigCAEUNASATKAIoEDsMAQtBBCATKAIgQQFqIgVBfyAFGyIFIAVBBE0bIgtB/////wFLDRcgC0ECdCIIQQBIDRcgC0GAgICAAkkhBiATKABJIQcgCAR/IAggBhD+AgUgBgsiBUUNASAFIAc2AAAgE0EBNgJAIBMgBTYCPCATIAs2AjggE0HwAGoiCyATQTBqKQMANwMAIBNB6ABqIBNBKGopAwA3AwAgE0HgAGogE0EgaikDADcDACATQdgAaiATQRhqKQMANwMAIBNB0ABqIBNBEGopAwA3AwAgEyATKQMINwNIIBNB+ABqIBNByABqEK8BIBMtAHgEQEEEISFBASEHA0AgEygAeSEIIBMoAjggB0YEQCATQThqIQ8gEygCYEEBaiIFQX8gBRshBSMAQSBrIhAkACAHIAUgB2oiBksNGkEEIA8oAgAiDEEBdCIFIAYgBSAGSxsiBSAFQQRNGyIJQYCAgIACSSEGIAlBAnQhBQJAIAwEQCAQQQE2AhggECAMQQJ0NgIUIBAgD0EEaigCADYCEAwBCyAQQQA2AhgLIBAgBSAGIBBBEGoQsQEgECgCBCEGAkAgECgCAEUEQCAPIAk2AgAgD0EEaiAGNgIADAELIBBBCGooAgAiBUGBgICAeEYNACAFRQ0bDB0LIBBBIGokACATKAI8IQULIAUgIWogCDYAACATIAdBAWoiBzYCQCAhQQRqISEgE0H4AGogE0HIAGoQrwEgEy0AeA0ACwsCQCALKAIARQ0AIBNB7ABqKAIARQ0AIBMoAmgQOwsgDiATKQM4NwIAIA5BCGogE0FAaygCADYCAAsgE0GAAWokAAwBCyAIIAYQvAMACyAUKAJ0ISEgFCgCeCEcQQAhBkEAIQ4jAEEgayIlJAACQCAcQRVPBEAgIUEEayEdICFBCGshGiAhQQxrISIgHEEBdEH8////B3FBARD+AiETQYABQQQQ/gIhFSAcIQhBECEkA0AgCCEMQQAhCEEBIQkCQCAMQQFrIhBFDQACQAJAAkACQCAhIBBBAnRqIgktAAAiBSAhIAxBAmsiC0ECdGoiCC0AACIGRgRAIAktAAEiByAILQABIgVHDQEgCS0AAiIHIAgtAAIiBUcEQCAFIAdNDQMMBAsgCS0AAyAILQADSQ0DDAILIAUgBkkNAgwBCyAFIAdLDQELQQIhCSALRQRAQQAhCAwDCyAiIAxBAnRqIQUCQANAAkACQAJAIAZB/wFxIgcgBS0AACIGRgRAIAVBBWotAAAiCCAFQQFqLQAAIgdHDQEgBUEGai0AACIIIAVBAmotAAAiB0YNAiAHIAhLDQUMAwsgBiAHTQ0CDAQLIAcgCEsNAwwBCyAFQQdqLQAAIAVBA2otAABJDQILIAVBBGshBSAMIAlBAWoiCUcNAAtBACEIIAwhCQwDCyAMIAlrIQcMAQtBACEHAkAgC0UNACAiIAxBAnRqIQUDQAJAAkACQAJAIAZB/wFxIgggBS0AACIGRgRAIAVBBWotAAAiCSAFQQFqLQAAIghHDQEgBUEGai0AACIJIAVBAmotAAAiCEYNAiAIIAlLDQQMAwsgBiAITQ0CDAMLIAggCUsNAgwBCyAFQQdqLQAAIAVBA2otAABJDQELIAshBwwCCyAFQQRrIQUgC0EBayILDQALCwJAAkAgByAMTQRAIAwgHEsNASAMIAdrIglBAkkNAyAMQQJ0IRcgISAHQQJ0aiEIQQAhCyAJQQF2Ih5BAUYNAiAeQf7///8HcSEPIBcgGmohBiAIIQUDQCAFKQAAIT0gBSAGKQAAQiCJNwAAIAYgPUIgiTcAACAGQQhrIQYgBUEIaiEFIA8gC0ECaiILRw0ACwwCCyAHIAxBlKbCABCYAwALIAwgHEGUpsIAEJcDAAsgCUECcUUNACAIIAtBAnRqIgUoAAAhBiAFIBcgIWogHkECdGsgHiALQX9zakECdGoiBSgAADYAACAFIAY2AAALIAdFBEAgByEIDAELIAlBCUsEQCAHIQgMAQsCQCAMIBxNBEAgISAHQQJ0aiEPA0AgDCAHQQFrIghJDQICQCAMIAhrIglBAU0NAAJAAkAgISAIQQJ0aiILLQAEIgYgCy0AACIFRgRAIAtBBWotAAAiBiALLQABIgVHDQEgC0EGai0AACIGIAstAAIiBUcEQCAFIAZLDQMMBAsgC0EHai0AACALLQADTw0DDAILIAUgBksNAQwCCyAFIAZNDQELIAsoAAAhICALIAsoAAQ2AAACQCAJQQNJBEAgC0EEaiEGDAELICBBGHYhGCAgQRB2IRkgIEEIdiEjIBAhCyAPIQYDQAJAAkACQCAGIgVBBGoiBi0AACIeICBB/wFxIhdGBEAgBUEFai0AACIeICNB/wFxIhdHDQEgBUEGai0AACIeIBlB/wFxIhdGDQIgFyAeSw0DIAUgIDYAAAwGCyAXIB5LDQIgBSAgNgAADAULIBcgHksNASAFICA2AAAMBAsgBUEHai0AACAYSQ0AIAUgIDYAAAwDCyAFIAYoAAA2AAAgByALQQFrIgtHDQALCyAGICA2AAALIAhFDQMgD0EEayEPIAghByAJQQpJDQALDAILIAwgB0EBayIISQ0AIAwgHEGkpsIAEJcDAAsgCCAMQaSmwgAQmAMACyAOICRGBEAgDkEEdEEEEP4CIBUgDkEDdBDCAyAVEDsgDkEBdCEkIRULIBUgDkEDdGoiBSAINgIEIAUgCTYCACAOQQFqIg8hDgJAIA9BAkkNAANAAkACQAJAAkAgFSAPIg5BAWsiD0EDdGoiCSgCBEUNACAOQQN0IBVqIgZBEGsoAgAiCyAJKAIAIgVNDQAgDkEDSQRAQQIhDgwGCyAVIA5BA2siMEEDdGooAgAiByAFIAtqTQ0BIA5BBEkEQEEDIQ4MBgsgBkEgaygCACAHIAtqSw0FDAELIA5BA0kNASAVIA5BA2siMEEDdGooAgAhByAJKAIAIQULIAUgB0sNAQsgDkECayEwCwJAAkACQAJAIDBBAWoiBSAOSQRAIBUgMEEDdGoiHygCBCAfKAIAIhhqIgkgFSAFQQN0aiIgKAIEIixPBEAgCSAcTQRAIB9BBGohGSAhICxBAnRqIgsgICgCACIrQQJ0IgdqIQYgCUECdCEQIAkgLGsiCSArayIMICtPDQMgEyAGIAxBAnQiBRDCAyIjIAVqIQcgK0EATCAMQQBMcg0EIBAgHWohCQNAAkACQAJAIAdBBGsiBS0AACIeIAZBBGsiEC0AACIXRgRAIAdBA2stAAAiHiAGQQNrLQAAIhdHDQEgB0ECay0AACIeIAZBAmstAAAiF0cEQCAFIQwgFyAeSw0DDAQLIAUhDCAHQQFrLQAAIAZBAWstAABPDQMMAgsgBSEMIBcgHksNAQwCCyAFIQwgFyAeTQ0BCyAHIQUgECIGIQwLIAkgDCgAADYAACAGIAtLBEAgCUEEayEJIAUhByAFICNLDQELCyAGIQsgBSEHDAULIAkgHEHEpsIAEJcDAAsgLCAJQcSmwgAQmAMACyAlQRRqQQE2AgAgJUEcakEANgIAICVBvKXCADYCECAlQcSlwgA2AhggJUEANgIIICVBCGpBtKbCABCiAgALIAcgEyALIAcQwgMiBWohByArQQBMIAkgK0xyDQEgECAhaiEQA0ACfwJAAkACQCAGLQAAIgwgBS0AACIJRgRAIAYtAAEiDCAFLQABIglHDQEgBi0AAiIMIAUtAAIiCUcEQCAJIAxNDQQMAwsgBi0AAyAFLQADSQ0CDAMLIAkgDE0NAgwBCyAJIAxNDQELIAUhCSAGIgVBBGoMAQsgBUEEaiEJIAYLIQYgCyAFKAAANgAAIAtBBGohCyAHIAlNDQMgCSEFIAYgEEkNAAsMAgsgBiELCyATIQkLIAsgCSAHIAlrEMIDGiAZICw2AgAgHyAYICtqNgIAICAgIEEIaiAOIDBrQQN0QRBrEMMDQQEhDiAPQQFLDQALCyAIDQALIBUQOyATEDsMAQsgHEECSQ0AIBxBAWshCCAhIBxBAnRqIQ4DQAJAAkACQCAhIAhBAWsiCEECdGoiCy0ABCIHIAstAAAiBUYEQCALQQVqLQAAIgcgCy0AASIFRw0BIAtBBmotAAAiByALLQACIgVHBEAgBSAHSw0DDAQLIAtBB2otAAAgCy0AA08NAwwCCyAFIAdLDQEMAgsgBSAHTQ0BCyALKAAAIRMgCyALKAAENgAAIBwgCGtBA0kEQCALQQRqIBM2AAAMAQsgE0EYdiEPIBNBEHYhDCATQQh2IQkgBiEFAkADQAJAAkACQAJAIAUgDmoiEC0AACILIBNB/wFxIgdGBEAgEEEBai0AACILIAlB/wFxIgdHDQEgEEECai0AACILIAxB/wFxIgdGDQIgByALTQ0EDAMLIAcgC0sNAgwDCyAHIAtNDQIMAQsgEEEDai0AACAPTw0BCyAQQQRrIBAoAAA2AAAgBUEEaiIFDQEMAgsLIBBBBGsgEzYAAAwBCyAFIA5qQQRrIBM2AAALIAZBBGshBiAIDQALCyAlQSBqJAAgFCAhNgJMIBQgISAcQQJ0aiIcNgJIIBRBADYCOCAUQQA2AiggFEGwAWohGSMAQSBrIhokAAJAAkAgGygCCCIXIBsoAgQiCGsiDEEAIBsoAgAiCxsiBSAbKAIYIhggGygCFCIPayITQQAgGygCECIQG2oiByAFSQ0AIAcgByAbKAIgIhUgGygCJCIGa0ECdkEDbEEAIAYbaiIeSw0AIBsoAhwhDiAbKAIMIQdBASEJAkAgHgRAIB5BAE4iBUUNGCAeIAUQ/gIiCUUNAQsgGSAJNgIEIBkgHjYCAEEAIQUCQCALQQFHDQAgGiAHNgIQIBogFzYCDCAIIBdGDQAgDEEDcSELIBcgCEF/c2pBA08EQCAMQXxxIQwgGkEIaiAIaiEHA0AgGiAFIAhqIiNBAWo2AgggBSAJaiIeIAUgB2oiF0EIai0AADoAACAaICNBAmo2AgggHkEBaiAXQQlqLQAAOgAAIBogI0EDajYCCCAeQQJqIBdBCmotAAA6AAAgGiAjQQRqNgIIIB5BA2ogF0ELai0AADoAACAMIAVBBGoiBUcNAAsgBSAIaiEICyALRQ0AIAhBCGohCANAIBogCEEHazYCCCAFIAlqIBpBCGogCGotAAA6AAAgCEEBaiEIIAVBAWohBSALQQFrIgsNAAsLIAZFIAYgFUZyRQRAA0AgBSAJaiIHIAYvAAA7AAAgB0ECaiAGQQJqLQAAOgAAIAVBA2ohBSAGQQRqIgYgFUcNAAsLAkAgEEEBRw0AIBogDjYCECAaIBg2AgwgDyAYRg0AIBggD0F/c2ogE0EDcSIIBEAgD0EIaiEGA0AgGiAGQQdrNgIIIAUgCWogGkEIaiAGai0AADoAACAGQQFqIQYgBUEBaiEFIAhBAWsiCA0ACyAGQQhrIQ8LQQNJDQAgBSAJaiELIBggD2shCCAaQQhqIA9qIQdBACEGA0AgGiAGIA9qIg5BAWo2AgggBiALaiIMIAYgB2oiCUEIai0AADoAACAaIA5BAmo2AgggDEEBaiAJQQlqLQAAOgAAIBogDkEDajYCCCAMQQJqIAlBCmotAAA6AAAgGiAOQQRqNgIIIAxBA2ogCUELai0AADoAACAIIAZBBGoiBkcNAAsgBSAGaiEFCyAZIAU2AgggGkEgaiQADAILIB4gBRC8AwALIBpBFGpBATYCACAaQRxqQQA2AgAgGkGwo8IANgIQIBpBuKPCADYCGCAaQQA2AgggGkEIakGYpMIAEKICAAsgFCgCcCEFEM4BIgZFDQIgBiAGKQMAIj1CAXw3AwAgFEGcAWpBkKzCADYCACAUQZgBakEANgIAIBRCADcDkAEgFCAGKQMINwOIASAUID03A4ABIBRBxgBqQQA6AAAgFEGA/gM7AUQgFEEANgJAIBRCADcDOCAUICE2AjQgFCAcNgIwIBQgITYCLCAUIAU2AigjAEEQayIgJAAgFEGAAWoiJEEQaiELIBRBKGoiIigCACAiKAIIIhggIigCBCIFa0ECdiIIQQAgIi0AHSIdICItABwiB2tB/wFxQQFqQQAgByAdTRsgIi0AHiIPGyIGIAYgCEsbIgZBAWpBAXYgBiAkQRhqKAIAGyIGICRBFGooAgBLBEAgCyAGICQQLQsgIigCDCEeAkAgBSAYRg0AICRBHGohFwNAIA8NASAHQf8BcSIGIB1LDQEgBUEEaiAgIAUoAAA2AgAgBiAdTyEPIAcgBiAdSWogJCAgEHkhQCAXKAIAIhxBBWshEyBAQhmIQv8Ag0KBgoSIkKDAgAF+IT4gQKchBSAkKAIQIRlBACEVICAtAAMhECAgLQACIQ4gIC0AASEMICAtAAAhCQJAA0ACQCAcIAUgGXEiBWopAAAiPyA+hSI9Qn+FID1CgYKEiJCgwIABfYNCgIGChIiQoMCAf4MiPVANAANAAkACQCAJIBMgPXqnQQN2IAVqIBlxQXtsaiIaLQAARw0AIAwgGi0AAUcNACAOIBotAAJHDQAgECAaLQADRg0BCyA9QgF9ID2DIj1QRQ0BDAILCyAaIAc6AAQMAgsgPyA/QgGGg0KAgYKEiJCgwIB/g1AEQCAFIBVBCGoiFWohBQwBCwsgICAHOgAMICAgICgCADYCCCALQQxqKAIAIhAgCygCACIVIECnIg5xIh9qKQAAQoCBgoSIkKDAgH+DIj1QBEBBCCEHA0AgByAfaiEFIAdBCGohByAQIAUgFXEiH2opAABCgIGChIiQoMCAf4MiPVANAAsLICBBCGohDAJAIBAgPXqnQQN2IB9qIBVxIgdqLAAAIgVBAE4EfyAQIBApAwBCgIGChIiQoMCAf4N6p0EDdiIHai0AAAUgBQtBAXEiCUUNACALKAIEDQAgC0EBICQQLSALQQxqKAIAIhAgCygCACIVIA5xIh9qKQAAQoCBgoSIkKDAgH+DIj1QBEBBCCEHA0AgByAfaiEFIAdBCGohByAQIAUgFXEiH2opAABCgIGChIiQoMCAf4MiPVANAAsLIBAgPXqnQQN2IB9qIBVxIgdqLAAAQQBIDQAgECkDAEKAgYKEiJCgwIB/g3qnQQN2IQcLIAcgEGogDkEZdiIFOgAAIAdBCGsgFXEgEGpBCGogBToAACALIAsoAgQgCWs2AgQgCyALKAIIQQFqNgIIIBAgB0F7bGpBBWsiBUEEaiAMQQRqLQAAOgAAIAUgDCgAADYAAAshByIFIBhHDQALCwRAIB4QOwsgIEEQaiQAIBQgJDYCvAEgFEEENgI4IBQgJzYCNCAUIC82AiggFCAzNgIsIBQgLyAzajYCMCAUIBRBvAFqNgI8IBRBwAFqIQ8jAEEwayIaJAACQAJAICIoAhAiCQRAICIoAhQhBiAiKQIIIT0gIigCACEFICIoAgQiCyAJbiEMQQEhCCAJIAtNBEAgDEEATiIHRQ0YIAwgBxD+AiIIRQ0CCyAPQQA2AgggDyAINgIEIA8gDDYCACAaIAY2AhwgGiAJNgIYIBogPTcDECAaIAs2AgwgGiAFNgIIIBogCDYCKCAaIA9BCGo2AiQgGkEANgIgIwBBEGsiGCQAIBpBIGoiBSgCBCEXIAUoAgAhCAJAAkACQCAaQQhqIgYoAgQiCyAGKAIQIhlPBEACQAJAAkAgGQ4CAAECC0EAQQBB0KHCABDMAQALQQFBAUHgocIAEMwBAAsgGUEDSQ0CIBlBA0YNASAFKAIIIRUgBigCFCEcIAYoAgAhDANAIBwoAgAhBSAYIAwoAAA2AggCQAJAIAVBGGooAgBFDQAgCyAZayELIAwgGWohDCAFIBhBCGoQeSE9IAVBHGooAgAiE0EFayEQID1CGYhC/wCDQoGChIiQoMCAAX4hQCAFQRBqKAIAIR4gPachCUEAIQ4gGC0ACyEPIBgtAAohByAYLQAJIQYgGC0ACCEFA0AgEyAJIB5xIglqKQAAIkEgQIUiPUJ/hSA9QoGChIiQoMCAAX2DQoCBgoSIkKDAgH+DIj1QRQRAID1CAX0gPYMhPgNAID0hPyA+IT0CQCAFIBAgP3qnQQN2IAlqIB5xQXtsaiIjLQAARw0AIAYgIy0AAUcNACAHICMtAAJHDQAgDyAjLQADRg0FCyA9QgF9ID2DIT4gPVBFDQALCyBBIEFCAYaDQoCBgoSIkKDAgH+DQgBSDQEgCSAOQQhqIg5qIQkMAAsAC0GQosIAQStBvKLCABCGAgALIAggFWogIy0ABDoAACAIQQFqIQggCyAZTw0ACwsgFyAINgIAIBhBEGokAAwCC0EDQQNBgKLCABDMAQALQQJBAkHwocIAEMwBAAsgGkEwaiQADAILQZClwgBBGUH4pMIAEIYCAAsgDCAHELwDAAsgMQRAIBQoArwBIQUgFEEAOgArIBQgMjoAKCAUIDJBEHY6ACogFCAyQQh2OgApAkACQCAFQRhqKAIARQ0AIAUgFEEoahB5IT0gBUEcaigCACIOQQVrIQkgPUIZiEL/AINCgYKEiJCgwIABfiFAIAVBEGooAgAhDyA9pyEhIBQtACghCyAULQApIQggFC0AKiEHIBQtACshBkEAITIDQCAOIA8gIXEiDGopAAAiQSBAhSI9Qn+FID1CgYKEiJCgwIABfYNCgIGChIiQoMCAf4MiPVBFBEAgPUIBfSA9gyE+A0AgPSE/ID4hPQJAIAsgCUEAID96p0EDdiAMaiAPcWsiBUEFbGoiEC0AAEcNACAIIBAtAAFHDQAgByAQLQACRw0AIAYgEC0AA0YNBQsgPUIBfSA9gyE+ID1QRQ0ACwsgQSBBQgGGg0KAgYKEiJCgwIB/g1BFDQEgDCAyQQhqIjJqISEMAAsAC0HUqMIAQStBgKnCABCGAgALIA4gBUEFbGpBAWstAAAhIQsgJkEBOgAoICZBADYCHCAmQQA7ACkgJiA3OwEkICYgNTsBIiAmQQA7ASAgJiAUKQOwATcCECAmQQE2AgAgJiAUKQLAATcCBCAmQSdqICE6AAAgJiAxOgAmICZBGGogFEG4AWooAgA2AgAgJkEMaiAUQcgBaigCADYCACAUKAKQASIGRQ0BIAYgBkEFbEEMakF4cSIFakF3Rg0BIBQoApwBIAVrEDsMAQsgFEEoaiEbAkACQAJAAkBBgMAAQQgQ/gIiDARAQYAgQQQQ/gIiCUUNA0GACEEEEP8CIghFDQFBgBBBCBD+AiIGRQ0CQYAQQQgQ/gIiBUUEQEGAEEEIELwDAAsgG0GAAjYCOCAbQYACNgIsIBtBgAI2AhQgG0GAAjYCCCAbQYACNgIEIBsgGTYCACAbQUBrIgtBADYCACAbQTxqIAU2AgAgG0E0aiIHQQA2AgAgG0EwaiAGNgIAIBtBKGpBgAI2AgAgG0EkaiAINgIAIBtBHGoiBkKAgICAgCA3AgAgG0EYaiAJNgIAIBtBEGoiBUEANgIAIBtBDGogDDYCAEEAIQhEAAAAAAAAAAAhVUEAISVBACEfQQAhGEEAITAgC0EANgIAIAdBADYCACAGQQA2AgAgBUEANgIAIBsoAgQiDgRAIBtBOGohCSAbQSxqIQsgG0EUaiEHIBtBCGohE0QAAAAAAADwPyAOuKMhUwNAIFVEAAAAAAAAcECiIBsoAgS4oyFUIBsoAhAiBSAbKAIIRgRAIwBBIGsiHCQAIAVBAWoiBkUNG0EEIBMoAgAiD0EBdCIFIAYgBSAGSxsiBSAFQQRNGyIMQQV0IQYgDEGAgIAgSUEDdCEFAkAgDwRAIBxBCDYCGCAcIA9BBXQ2AhQgHCATQQRqKAIANgIQDAELIBxBADYCGAsgHCAGIAUgHEEQahCxASAcKAIEIQYCQCAcKAIARQRAIBMgDDYCACATQQRqIAY2AgAMAQsgHEEIaigCACIFQYGAgIB4Rg0AIAVFDRwMHgsgHEEgaiQAIBsoAhAhBQsgGygCDCAFQQV0aiIFIFVEAAAAAAAAMECiRAAAAAAA4G9AIAhBEEkbOQMYIAUgVDkDECAFIFQ5AwggBSBUOQMAIBsgGygCEEEBajYCECAbKAIcIgUgGygCFEYEQCAHIAUQnQEgGygCHCEFCyAbKAIYIAVBBHRqIgVCgICAgPAfNwIIIAVCADcCACAbIBsoAhxBAWo2AhwgGygCQCIFIBsoAjhGBEAgCSAFEJ4BIBsoAkAhBQsgCEEBaiEIIBsoAjwgBUEDdGogUzkDACAbIBsoAkBBAWo2AkAgGygCNCIFIBsoAixGBEAgCyAFEJ4BIBsoAjQhBQsgVUQAAAAAAADwP6AhVSAbKAIwIAVBA3RqQgA3AwAgGyAbKAI0QQFqIhg2AjQgCCAORw0ACyAbKAIEIR8LIB9BCG0hByAbKAIAIgtBAWtBA20hBgJAAkACQAJAAn8CQCALBEBBASEXQeQAIB9BAXYgH0HKAUkbIgUgEEECdiIaIAtuIghNBEAgCCAFbiEXCwJ/QZyvwgAgGkHzA3ANABpBoK/CACAaQesDcA0AGkGkr8IAQaivwgAgGkHeA3AbCyEFAkACQCALIBpNBEAgGygCQCEZIB9FDQYgBkEeaiEeIAdBBnQiI0EGdUEAICNBgAFOGyErIBtBPGooAgAhDCAbQQxqKAIAIQ8gG0EwaigCACEHIBsoAhAhHUEBIAggCEEBTRshFSAFKAIAIBpqIRxBgAghDgNAAkAgECAlQQJ0IgZPBEAgECAGayIFQQNNDQsgBiAvaiIFLQADuCFZIAUtAAK4IVogBS0AAbghVyAFLQAAuCFYQQAhCET////////vfyFVQX8hBiAHIQkgDyEFIAwhC0T////////vfyFUQX8hIANAAkACQCAIIBhHBEAgCCAdRg0BIAVBEGorAwAgWqGZIAUrAwAgWKGZoCJWIFVjIFYgVCAJKwMAIlOgY3JFDQIgViAFQQhqKwMAIFehmaAgBUEYaisDACBZoZmgIlYgVSBVIFZkIhMbIVUgCCAgIBMbISAgViBToSJTIFRjRQ0CIFMhVCAIIQYMAgsgGCAYQaCuwgAQzAEACyAdIB1BsK7CABDMAQALIAggGUcEQCALIAsrAwAiUyBTRAAAAAAAAFC/oqAiUzkDACAJIAkrAwAgU6A5AwAgCUEIaiEJIAVBIGohBSALQQhqIQsgHyAIQQFqIghGDQMMAQsLIBkgGUHArsIAEMwBAAsgBiAQQayvwgAQlgMACyAZICBNDQggDCAgQQN0IghqIgUgBSsDAEQAAAAAAABQP6A5AwAgGCAgTQRAICAgGEHgrsIAEMwBAAsgByAIaiIFIAUrAwBEAAAAAAAA8L+gOQMAAkAgBiAdSQRAIA8gBkEFdGoiBSAFKwMQIlMgDrdEAAAAAAAAUD+iIlYgUyBaoaKhOQMQIAUgBSsDCCJTIFYgUyBXoaKhOQMIIAUgBSsDACJTIFYgUyBYoaKhOQMAIAUgBSsDGCJTIFYgUyBZoaKhOQMYICtBAEwNASAGQQFqIgkgBiAraiIFIB8gBSAfSBsiE0giCEUgBkEBayIFIAYgK2siBkEAIAZBAEobIgZMcQ0BIAUgBkohICArtyJTIFOiIVRBACELA0AgViBUIAu3IlMgU6KhoiBUoyFVAkAgCEEBcUUNACAJIB1JBEAgDyAJQQV0aiIIIAgrAxAiUyBVIFMgWqGioTkDECAIIAgrAwgiUyBVIFMgV6GioTkDCCAIIAgrAwAiUyBVIFMgWKGioTkDACAIIAgrAxgiUyBVIFMgWaGioTkDGCAJQQFqIQkMAQsgCSAdQYCuwgAQzAEACwJAICBBAXFFDQAgBSAdSQRAIA8gBUEFdGoiCCAIKwMQIlMgVSBTIFqhoqE5AxAgCCAIKwMIIlMgVSBTIFehoqE5AwggCCAIKwMAIlMgVSBTIFihoqE5AwAgCCAIKwMYIlMgVSBTIFmhoqE5AxggBUEBayEFDAELIAUgHUGQrsIAEMwBAAsgC0EBaiELIAkgE0giCCAFIAZKIiByDQALDAELIAYgHUHwrcIAEMwBAAsgHCAlaiElA0AgJSAaayIlIBpPDQALIDBBAWoiMCAXcEUEQCAeRQ0EIB5Bf0YgDkGAgICAeEZxDQMgI0FibSAjaiIjQQZ1QQAgI0GAAU4bISsgDiAOIB5tayEOCyAVIDBHDQALIBsoAgQhHwsCQAJAAkAgHwRAIBtBDGooAgBBEGohCCAbQRhqKAIAIQUgGygCHCELIBsoAhAhB0EAIQkDQCAHIAlGDQQgCSALRg0DIAgrAwAQ7wIiU0QAAAAAAADgwWYhBiAFQQhqQf8BQf////8HAn8gU5lEAAAAAAAA4EFjBEAgU6oMAQtBgICAgHgLQYCAgIB4IAYbIFNEAADA////30FkG0EAIFMgU2EbIgYgBkH/AU4bIgZBACAGQQBKGzYCACAIQQhrKwMAEO8CIlNEAAAAAAAA4MFmIQYgBUEEakH/AUH/////BwJ/IFOZRAAAAAAAAOBBYwRAIFOqDAELQYCAgIB4C0GAgICAeCAGGyBTRAAAwP///99BZBtBACBTIFNhGyIGIAZB/wFOGyIGQQAgBkEAShs2AgAgCEEQaysDABDvAiJTRAAAAAAAAODBZiEGIAlBAWohCSAFQf8BQf////8HAn8gU5lEAAAAAAAA4EFjBEAgU6oMAQtBgICAgHgLQYCAgIB4IAYbIFNEAADA////30FkG0EAIFMgU2EbIgYgBkH/AU4bIgZBACAGQQBKGzYCACAIQQhqKwMAEO8CIlNEAAAAAAAA4MFmIQYgBUEMakH/AUH/////BwJ/IFOZRAAAAAAAAOBBYwRAIFOqDAELQYCAgIB4C0GAgICAeCAGGyBTRAAAwP///99BZBtBACBTIFNhGyIGIAZB/wFOGyIGQQAgBkEAShs2AgAgBUEQaiEFIAhBIGohCCAJIB9HDQALIBsoAgQiLA0BCyAbQShqKAIAISVBACEQQQAhD0F/DAcLICxBA2ohIiAsQQJrITAgG0EkaigCACIdQQRqIRogG0EYaigCACIkQTRqIRggJEEUaiEOIBtBKGooAgAhJUEAIQ8gGygCHCIfIStBACEQQQAhBgNAAkACQAJAAkAgHyAGIgdHBEAgK0EBayErICQgB0EEdGoiICkCCCE9ICAoAgAhGSAgKAIEIiMhCAJAIAciC0EBaiIGICxPDQAgKyAwTQ0CIAYhBSAsIAdBf3NqQQNxBEAgIkEDcSEVQQAhBSAOIQkDQCAFQQFqIgUgB2oiHCALIAkoAgAiEyAISSIMGyELIBMgCCAMGyEIIAlBEGohCSAFIBVHDQALIBxBAWohBQsgMEEDSQ0AIBggBUEEdGohCQNAIAkoAgAiHiAJQRBrKAIAIhcgCUEgaygCACITIAlBMGsoAgAiDCAIIAggDEsiFRsiCCAIIBNLIhwbIgggCCAXSyITGyIIIAggHksiDBshCCAFQQNqIAVBAmogBUEBaiAFIAsgFRsgHBsgExsgDBshCyAJQUBrIQkgBUEEaiIFICxHDQALCyALIB9PDQIgByALRw0DDAQLIB8gH0GQsMIAEMwBAAsgHyAfQaCwwgAQzAEACyALIB9BsLDCABDMAQALICAgJCALQQR0aiIFKQIINwIIICAgBSkCADcCACAFID03AgggBSAjNgIEIAUgGTYCAAsgCCAPRwRAAkACQCAPICVJBEAgHSAPQQJ0IgtqIAcgEGpBAXY2AgAgD0EBaiIFIAhJDQEMAgsgDyAlQcCwwgAQzAEACyALIBpqIQkDQCAFICVHBEAgCSAHNgIAIAlBBGohCSAFQQFqIgUgCEcNAQwCCwsgJSAlQdCwwgAQzAEACyAHIRAgCCEPCyAiQQNqISIgDkEQaiEOIDBBAWshMCAGICxHDQALDAULIAsgC0GAsMIAEMwBAAsgByAHQfCvwgAQzAEAC0HQr8IAQR9BvK/CABCGAgALQYCvwgBBGUG8r8IAEIYCAAtBgK/CAEEZQfCuwgAQhgIACyAsQQFrCyEGAkAgDyAlSQRAIBtBJGooAgAgD0ECdGoiBSAGIBBqQQF2NgIAIA9B/gFNBEAgD0EBaiEIIAVBBGohBQNAIAggJUYNAyAFIAY2AgAgBUEEaiEFIAhBAWoiCEGAAkcNAAsLDAULIA8gJUHgsMIAEMwBAAsgCCAlQfCwwgAQzAEAC0F/ISAgECIFQQRJDQELICAgGUHQrsIAEMwBAAtBBCAFQayvwgAQlwMACwwEC0GAwABBCBC8AwALQYAIQQQQvAMAC0GAEEEIELwDAAtBgCBBBBC8AwALIBRBBDYCkAEgFCAnNgKMASAUIC82AoABIBQgMzYChAEgFCAvIDNqNgKIASAUIBs2ApQBIBRBwAFqIQ4CQAJAAkAgFEGAAWoiECgCECIJBEAgECgCBCIGIAluIQwgBiAJSQRAIA5BATYCBCAOIAw2AgAgDkEIakEANgIADAQLIAxBAE4iBUUNFyAQKAIUIQggECgCACEHIAwgBRD+AiILRQ0BQQAhDyAOQQA2AgggDiALNgIEIA4gDDYCACAJQQRHDQIgDkEIagNAIAsgD2ogCCAHQQJqLQAAIAdBAWotAAAgBy0AACAHQQNqLQAAEFo6AAAgB0EEaiEHIA9BAWohDyAGQQRrIgZBBE8NAAsgDzYCAAwDC0GQpcIAQRlB+KTCABCGAgALIAwgBRC8AwALQeifwgBBIkHooMIAEIYCAAsCQAJAIBsoAgRBA2wiBkUEQEEBIQgMAQsgBkEATiIFRQ0VIAYgBRD+AiIIRQ0XC0EAIQcgEEEANgIIIBAgCDYCBCAQIAY2AgAgG0EcaigCACIGBEAgG0EYaigCACIFIAZBBHRqIQgDQCAFKAIAIQYgECgCACAHRgR/IBAgBxCkASAQKAIIBSAHCyAQKAIEaiAGOgAAIBAgECgCCEEBaiIHNgIIIAVBBGooAgAhBiAQKAIAIAdGBH8gECAHEKQBIBAoAggFIAcLIBAoAgRqIAY6AAAgECAQKAIIQQFqIgc2AgggBUEIaigCACEGIBAoAgAgB0YEfyAQIAcQpAEgECgCCAUgBwsgECgCBGogBjoAACAQIBAoAghBAWoiBzYCCCAFQRBqIgUgCEcNAAsLDAALIDEEQCAUQShqIDJBEHYgMkEIdiAyQQAQWiEhCyAmQQE6ACggJkEANgIcICZBADsAKSAmIDc7ASQgJiA1OwEiICZBADsBICAmIBQpA4ABNwIQICZBATYCACAmIBQpAsABNwIEICZBJ2ogIToAACAmIDE6ACYgJkEYaiAUQYgBaigCADYCACAmQQxqIBRByAFqKAIANgIAIBQoAjAEQCAUQTRqKAIAEDsLIBQoAjwEQCAUQUBrKAIAEDsLIBQoAkgEQCAUQcwAaigCABA7CyAUKAJUBEAgFEHYAGooAgAQOwsgFCgCYARAIBRB5ABqKAIAEDsLIBQoAhgiBkUNACAGIAZBAnRBC2pBeHEiBWpBd0YNACAUKAIkIAVrEDsLIBRB0AFqJAAMAgsLQaCewgBBxgAgFEEoakHonsIAQcifwgAQxQEACyASQZQBaiITQX8gLiAtbiIFQQpuIAVBgIAoTxs7AQAgEkHgAGoiBiASQYwBaiIOKQIANwMAIBJB8ABqIg8gEkGcAWoiDCkCADcDACASQegAaiIFIBMpAgA3AwAgEiASKQKEATcDWCASKAJ4IRAgEigCfCEJIBIvAYABIQsgEi8BggEhCCASKALIAQRAIC8QOwsgEkEgaiIHIAYpAwA3AwAgEkEoaiIGIAUpAwA3AwAgEkEwaiIFIA8pAwA3AwAgEiASKQNYNwMYIBIgCDsBggEgEiALOwGAASASIAk2AnwgEiAQNgJ4IA4gBykDADcCACATIAYpAwA3AgAgDCAFKQMANwIAIBIgEikDGDcChAECQCApLQAUQQJHDQAgKSgCGCEVIClBADYCGCAVRQ0DIBJB2ABqIRMgEi8BmgEhCSASLwGcASELIwBBIGsiHCQAQQEhBwJAAkACQCAJIAtsIg4EQCAOQQBOIgVFDRQgDiAFEP4CIgdFDQELIBxBDGpBADYCACAcQQhqIAc2AgAgHCALOwESIBwgCTsBECAcIBU2AgAgHEEBOgAUIBwgDjYCBEEAEO0BIQhBABDtASEGIBUoAgAgFSgCCCIPa0EFTQRAIBUgD0EGEKIBIBUoAgghDwsgFSgCBCAPaiIFQbChwAAoAAA2AAAgBUEEakG0ocAALwAAOwAAIBUgD0EGaiIPNgIIIBUoAgAgD2tBAU0EQCAVIA9BAhCiASAVKAIIIQ8LIBUoAgQgD2oiBSAJQYD+A3FBCHY6AAEgBSAJOgAAIBUgD0ECaiIMNgIIIBUoAgAgDGtBAU0EQCAVIAxBAhCiASAVKAIIIQwLIBUoAgQgDGoiBSALQYD+A3FBCHY6AAEgBSALOgAAIBUgDEECaiIMNgIIIAwgFSgCAEYEQCAVIAxBARCiASAVKAIIIQwLIBUoAgQgDGogBkEEdCAIckGAf3I6AAAgFSAMQQFqIgw2AgggDCAVKAIARgRAIBUgDEEBEKIBIBUoAgghDAsgFSgCBCAMakEAOgAAIBUgDEEBaiIMNgIIIAwgFSgCAEYEQCAVIAxBARCiASAVKAIIIQwLIBUgDEEBajYCCCAVKAIEIAxqQQA6AAAgHEEYaiAcQYytwABBABCQASAcLQAYIgVBBUcNASATIBwpAwA3AgAgE0EQaiAcQRBqKQMANwIAIBNBCGogHEEIaikDADcCAAwCCyAOIAUQvAMACyATIBwoABk2AAEgE0EEaiAcKAAcNgAAIBNBAjoAFCATIAU6AAAgFSgCCCIMIBUoAgBGBEAgFSAMQQEQogEgFSgCCCEMCyAVIAxBAWo2AgggFSgCBCAMakE7OgAAIA5FDQAgBxA7CyAcQSBqJAACQAJAAkACQAJAIBItAGxBAkcEQCASQewBaiASQegAaikDADcCACASQeQBaiASQeAAaikDADcCACASIBIpA1g3AtwBDAELIBIgEikDWDcDsAEgEkHYAWogEkGwAWoQ4AEgEigC2AEiBUEGRw0BCyASQcgBaiIGIBJB5AFqKQIANwMAIBJB0AFqIgUgEkHsAWopAgA3AwAgEiASKQLcATcDwAEgKS8BIEECRw0BIBJB6AFqIAUpAwA3AwAgEkHgAWogBikDADcDACASIBIpA8ABNwPYAQwCCyAqIBIpAvQBNwIcIBJByABqIBJB7AFqKQIAIj83AwAgEkFAayASQeQBaikCACI+NwMAICpBJGogEkH8AWooAgA2AgAgEiASKQLcASI9NwM4ICpBFGogPzcCACAqQQxqID43AgAgKiA9NwIEICogBTYCAAwHCyASIClBIGooAQA2AgAgEiASKAIANgFaIBJBAToAWCASQThqIBJBwAFqIBJB2ABqED0gEi0AOEEFRwRAIBIgEikDODcDWCASQdgBaiASQdgAahDgASASKALYASIFQQZHDQILICktABQgEkHoAWogEkHQAWopAwA3AwAgEkHgAWogEkHIAWopAwA3AwAgEiASKQPAATcD2AFBAkYNACApKAIAIgYEQCAGKAIIIgUgBigCAEYEfyAGIAVBARCiASAGKAIIBSAFCyAGKAIEakE7OgAAIAYgBigCCEEBajYCCAsgKSgCBEUNACApQQhqKAIAEDsLICkgEikD2AE3AgAgKUEQaiASQegBaikDADcCACApQQhqIBJB4AFqKQMANwIAICktABRBAkcNAUGgrsAAQStBrK/AABCGAgALICogEikC3AE3AgQgKkEkaiASQfwBaigCADYCACAqQRxqIBJB9AFqKQIANwIAICpBFGogEkHsAWopAgA3AgAgKkEMaiASQeQBaikCADcCACAqIAU2AgAgEigCwAEiBgRAIAYoAggiBSAGKAIARgR/IAYgBUEBEKIBIAYoAggFIAULIAYoAgRqQTs6AAAgBiAGKAIIQQFqNgIICyASKALEAUUNBCASQcgBaigCABA7DAQLIBJBAjoAoAEgEkHYAGohIyMAQSBrIickACASQfgAaiIJLQAoIQcgCS0AKSEGIAktACYhCCAJQSdqLQAAIQUgJ0EQaiILIAkvARw7AQQgC0EAOgAAIAsgBUEAIAgbOgACIAtBAkEAIAYbIAhyIAdBAnRyOgABICdBGGogKSALED0C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DQAgAUEMaigCACEQIAEoAgSzIRMgASgCACIRsyEUIAYqAsQBIRUgBioCwAEhFiAGKgK8ASEXIAYqArgBIRggBioCtAEhGSAGKgKwASEaQQAhCANAIAlFDQEgByAOIAcgDkkbIgoEQCAWIAizIgKUIRsgGSAClCEcQQAhCyAJIQEgCiEAA0BBBCAAIABBBE8bIQ0gGCAcIBogC7MiEpSSkhDuAiECIBUgGyAXIBKUkpIQ7gIhEgJ/QQAgAkMAAAAAXQ0AGkEAIAIgFGANABpBACASQwAAAABdDQAaQQAgEiATYA0AGiACQwAAAABgIQwgEEF/An8gEkMAAAAAYCIPIBJDAACAT11xBEAgEqkMAQtBAAtBACAPGyASQ///f09eGyARbEF/An8gDCACQwAAgE9dcQRAIAKpDAELQQALQQAgDBsgAkP//39PXhtqQQJ0aigAAAshDCAGIA02AlggAEEDTQ0EIAEgDDYAACALQQFqIQsgASANaiEBIAAgDWsiAA0ACwsgCSAKaiEJIAhBAWohCCAHIAprIgcNAAsLIAZB0AJqJAAPCyAGQQA2AogCQQAgBkHYAGpB+JfAACAGQYACakH8l8AAENoBAAsgBkEANgKUAiAGQcyhwAA2ApACIAZBATYCjAIgBkH0ocAANgKIAiAGQQA2AoACQQEgBkHYAGpBzKHAACAGQYACakHMosAAENoBAAuAGwIZfwN8IwBBsARrIgMkACADQgA3A5gBIANCADcDkAEgA0IANwOIASADQgA3A4ABIANCADcDeCADQgA3A3AgA0IANwNoIANCADcDYCADQgA3A1ggA0IANwNQIANCADcDSCADQgA3A0AgA0IANwM4IANCADcDMCADQgA3AyggA0IANwMgIANCADcDGCADQgA3AxAgA0IANwMIIANCADcDACADQgA3A7gCIANCADcDsAIgA0IANwOoAiADQgA3A6ACIANCADcDmAIgA0IANwOQAiADQgA3A4gCIANCADcDgAIgA0IANwP4ASADQgA3A/ABIANCADcD6AEgA0IANwPgASADQgA3A9gBIANCADcD0AEgA0IANwPIASADQgA3A8ABIANCADcDuAEgA0IANwOwASADQgA3A6gBIANCADcDoAEgA0IANwPYAyADQgA3A9ADIANCADcDyAMgA0IANwPAAyADQgA3A7gDIANC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GkcNAAsMAQsgB0EANgIIIBhBBGogB0EIahDCAkECIQ8LIBggDzYCACAHQUBrJAAMBwsgAiAJbEECdCIAQXxGDQEgAEEEaiIKIBBLDQMLIAdBLGpBBzYCACAHQRRqQQI2AgAgB0EcakECNgIAIAcgCTYCNCAHIAs2AjAgB0GkicAANgIQIAdBADYCCCAHQQc2AiQgByAZNgI8IAcgAzYCOCAHIAdBIGo2AhggByAHQThqNgIoIAcgB0EwajYCICAHQQhqQbSJwAAQogIAC0F8QQBBkIrAABCYAwALIBZBBGohCgsgCiAQQZCKwAAQlwMAC0F8IBZBBGpB+IjAABCYAwALIBZBBGogG0H4iMAAEJcDAAsgBCgCQEEGRw0BIAAgBCkDKDcCACAAQRBqIBwoAgA2AgAgAEEIaiAEQTBqKQMANwIADAQLAkAgB0H/////A3EgB0cNACADrSIqIAdBAnStfiImQiCIpw0AAkACQCAmpyIKRQRAQQQhFQwBCyAKQf////8BSw0FIApBAnQiBkEASA0FIApBgICAgAJJQQJ0IQUgBgR/IAYgBRD/AgUgBQsiFUUNAQtBiJTAACoCACEiQfSTwAAoAgAhESAEQoCAgIDAADcDKAJAIANFDQAgC7MgA7OVIiRDAACAP5ciJSAilCEjIAutIihCAX0hKQNAIARBADYCMCAjICQgDbNDAAAAP5KUIh6SjSIdQwAAAN9gIQVC////////////AAJ+IB2LQwAAAF9dBEAgHa4MAQtCgICAgICAgICAfwtCgICAgICAgICAfyAFGyAdQ////15eG0IAIB0gHVsbIicgKCAnIChTGyErIB4gI5OOIh1DAAAA32AhBQJAQv///////////wACfiAdi0MAAABfXQRAIB2uDAELQoCAgICAgICAgH8LQoCAgICAgICAgH8gBRsgHUP///9eXhtCACAdIB1bGyImICkgJiApUxtCACAmQgBZGyImpyILICsgJkIBfCAnICZC/////w+DVRunIghPDQAgHkMAAAC/kiEfIBEoAhQhDEMAAAAAIR0gCyEFA0AgBUEBakEBIAWzIB+TICWVIAwRCgAhHiAEKAIwIgUgBCgCKEYEQCAEQShqIAUQnAEgBCgCMCEFCyAEKAIsIAVBAnRqIB44AgAgBCAEKAIwIg9BAWoiCTYCMCAdIB6SIR0i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A0HoAGooAgA2AgAjAEEQayICJAAgAUHQA2ooAgAhBSABKALMAyEEIAJBCGogARCKASACLQAJIQYgAi0ACCEHIAIgARCKASACLQAAIAItAAEgBBDIASEIIABBBGoiASAHOgANIAEgBTYCBCABIAQ2AgAgASAGOgAMIAEgCEEBazYCCCACQRBqJAAgAEEjOgAADAYLIABBIjoAAAwFCyADKAJQBEAgAygCVBA7CyADQQA2AlggA0KAgICAEDcDUCADQeAAaiABIANB0ABqEE4gAy0AeSICQQ5HDQALCyADQUBrIAZBCGooAgAiATYCACADIAYpAgAiCjcDOCADKQNgIQsgAEEQaiABNgIAIAAgCjcCCCAAIAs3AgALIAMoAlBFDQEgAygCVBA7DAELIANBATYCOCADQdAAaiADQThqEN4CIANB6wBqIANB2ABqKAIANgAAIAMgAykDUDcAYyAAQSE6AAAgACADKQBgNwABIABBCGogA0HnAGopAAA3AAALIANBkAFqJAAPC0GEnMAAQStB5J7AABCGAgALswwBCX8CfwJAAkACQAJAAkACQAJAAkACQAJAAkACQCABQSBqKAIAIgogAkH//wNxIgdLBEAgAUEcaigCACAHQQF0ai8BACIFQQx2IggOAgECBAsgByAKQbi3wgAQzAEACyABQRRqKAIAIgcgBUH/H3EiBEsNASAEIAdByLfCABDMAQALIAFBCGooAgAiBCAFQf8fcSICTQ0FQRAgAUEEaigCACACQTJsaiIGLQAwIgIgAkEQTxshAiAGQQJrIQQgBkEgaiEGIANB/wFxIQsDQCACRQ0CIAJBAWshAiAEQQJqIQQgBi0AACAGQQFqIQYgC0cNAAsgBC8BACECQQAMCgtBACABQRBqKAIAIARBCXRqIANB/wFxQQF0ai8BACICQYAgSQ0JGiABQRhqIQsMAQsgAUEYaiELAkACQCAIDgIBAwALIAFBCGoiBCgCACIGIQIgASgCACAGRgRAIwBBIGsiAiQAAkACQCAGQQFqIgVFDQBBBCABKAIAIghBAXQiCSAFIAUgCUkbIgUgBUEETRsiBUEybCEJIAVBqbi9FElBAXQhDAJAIAgEQCACQQI2AhggAiAIQTJsNgIUIAIgAUEEaigCADYCEAwBCyACQQA2AhgLIAIgCSAMIAJBEGoQsQEgAigCBCEIIAIoAgBFBEAgASAFNgIAIAFBBGogCDYCAAwCCyACQQhqKAIAIgVBgYCAgHhGDQEgBUUNACAIIAUQvAMACxCWAgALIAJBIGokACAEKAIAIQILIAFBBGoiBSgCACACQTJsaiICQgA3AQAgAkEwakEAOgAAIAJBKGpCADcBACACQSBqQgA3AQAgAkEYakIANwEAIAJBEGpCADcBACACQQhqQgA3AQAgBCAEKAIAIgJBAWoiBDYCACAEDQNB3LbCAEErQbi4wgAQhgIACyAFQf8fcSEEIAFBFGooAgAhBwsgBCAHTw0DIAFBEGooAgAgBEEJdGogA0H/AXFBAXRqIAo7AQAMBgsgAUEIaigCACICIAVB/x9xIgRNBEAgBCACQfi3wgAQzAEACyABQQRqKAIAIgggBEEybGoiAi0AMCIGQRBJDQQgAUEUaigCACIFIQYgASgCDCAFRgRAIAFBDGogBRCgASABKAIUIQYLIAFBEGoiAygCACAGQQl0akH/AUGABBDAAxogASABKAIUIgZBAWoiCTYCFCAJRQ0DIAMoAgAgBkEJdGoiAyAIIARBMmxqIgQtACBBAXRqIAIvAQA7AQAgAyAEQSFqLQAAQQF0aiACLwECOwEAIAMgBEEiai0AAEEBdGogAi8BBDsBACADIARBI2otAABBAXRqIAIvAQY7AQAgAyAEQSRqLQAAQQF0aiACLwEIOwEAIAMgBEElai0AAEEBdGogAi8BCjsBACADIARBJmotAABBAXRqIAIvAQw7AQAgAyAEQSdqLQAAQQF0aiACLwEOOwEAIAMgBEEoai0AAEEBdGogAi8BEDsBACADIARBKWotAABBAXRqIAIvARI7AQAgAyAEQSpqLQAAQQF0aiACLwEUOwEAIAMgBEErai0AAEEBdGogAi8BFjsBACADIARBLGotAABBAXRqIAIvARg7AQAgAyAEQS1qLQAAQQF0aiACLwEaOwEAIAMgBEEuai0AAEEBdGogAi8BHDsBACADIARBL2otAABBAXRqIAIvAR47AQAgByABQSBqKAIAIgJJBEAgAUEcaigCACAHQQF0aiAFOwEADAYLIAcgAkGIuMIAEMwBAAsgBSgCACACQTJsaiICQQE6ADAgAiADOgAgIAIgCjsBACAHIAFBIGooAgAiAkkEQCABQRxqKAIAIAdBAXRqIAZBgCByOwEADAULIAcgAkGouMIAEMwBAAsgAiAEQdi3wgAQzAEACyAEIAdB6LfCABDMAQALQdy2wgBBK0GYuMIAEIYCAAsgAiAGakEgaiADOgAAIAIgBkEBdGogCjsBACACQTBqIgIgAi0AAEEBajoAAAsgAUEgaiICKAIAIgQgASgCGEYEQCALIAQQoQEgAigCACEECyABQRxqKAIAIARBAXRqQYDAADsBACACIAIoAgBBAWo2AgAgCiECQQELIQEgACACOwECIAAgATsBAAvYIgIXfwF+IwBBsAFrIgIkACACIAE2AgwjAEEQayIGJAAgAUHAAWooAgAEQCABQQA2AsABCyACQegAaiEIIAYgARBUAkACQAJAAkACQAJAAkACQAJAIAYtAAAiBUELRwRAA0AgBigCCCEMIAYoAgQhBAJAAkACQAJAIAVBD3FBAWsOCgIDAwMDAwEDAwADCyAIQgI3AgAMBgsgBEEnai0AACENIAQtACohDyAELwEkIQ4gBC8BIiERIAQvASAhEiAELwEeIRMgBC0AKSEUIAQtACYhFSAELQAoIRYgBC8BHCEXIARBFGooAgAiCQRAAkAgBEEYaigCACIDRQRAQQEhCgwBCyADQQBOIgdFDQkgAyAHEP4CIgpFDQoLIAogCSADEMIDGgsCQCAEKAIARQRAIARBCGooAgAhCSAEKAIEIQcMAQsgBEEIaigCACEQQQEhGEEBIQkgBEEMaigCACIHBEAgB0EATiILRQ0JIAcgCxD+AiIJRQ0LCyAJIBAgBxDCAxoLIAFBxAFqIQsCQCABQdgBaigCACIQRQ0AIAFB1AFqKAIARQ0AIBAQOwsCQCALKAIARQ0AIAFByAFqKAIARQ0AIAFBzAFqKAIAEDsLIAEgGDYCxAEgAUHuAWogDzoAACABQe0BaiAUOgAAIAFB7AFqIBY6AAAgAUHrAWogDToAACABQeoBaiAVOgAAIAFB6AFqIA47AQAgAUHmAWogETsBACABQeQBaiASOwEAIAFB4gFqIBM7AQAgAUHgAWogFzsBACABQdwBaiADNgIAIAFB2AFqIAo2AgAgAUHUAWogAzYCACABQdABaiAHNgIAIAFBzAFqIAk2AgAgAUHIAWogBzYCACAEQRRqKAIAIAFBsAFqKAIAckUNBCAERSAFQQFHckUEQCAMEDsLIAhBAjYCACAIIAs2AgQMBgsgBEUNACAMEDsLIAYgARBUIAYtAAAiBUELRw0ACwsgBikCBCEZIAggBkEMaigCADYCCCAIIBk3AgAMAgtBKkEBEP4CIgNFDQUgA0EoakGIqsAALwAAOwAAIANBIGpBgKrAACkAADcAACADQRhqQfipwAApAAA3AAAgA0EQakHwqcAAKQAANwAAIANBCGpB6KnAACkAADcAACADQeCpwAApAAA3AABBDEEEEP4CIgdFDQcgB0EqNgIIIAcgAzYCBCAHQSo2AgAgCEGEpMAANgIIIAggBzYCBCAIQQA2AgALIARFIAVBAUdyDQAgDBA7CyAGQRBqJAAMBAsQlgIACyADIAcQvAMACyAHIAsQvAMAC0EqQQEQvAMACwJAAkACQCACKAJoQQJGBEACQAJAIAIoAmwiBQRAIAJBEGohAyAFLQAoIQcgBS8BJCEIIAUvASIhCSAFLwEeIQwgBS8BICEKAkACQAJ/IAUvARwiBUUEQEEBIQRBAAwBC0EBIQYgBUEKbCIFIAVodiIEQQFHBEADQAJAIAQgBk0EQCAGIARrIgYgBmh2IQYMAQsgBCAGayIEIARodiEECyAEIAZHDQALIAZFDQILIAZBAUYhBCAFIAZuCyEFIAMgBzoAGCADIAg2AhQgAyAJNgIQIAMgDDYCDCADIAo2AgggAyAENgIEIAMgBTYCAAwBC0HgwsAAQRlByMLAABCGAgALAkAgAUHoAWovAQAgAUHmAWovAQAiAyADQQJ0IAFB8gFqLQAAG2wiCEUEQEEBIQUMAQsgCEEATiIDRQ0FIAggAxD/AiIFRQ0GCyACQegAaiEHIwBBMGsiBiQAIAFB5gFqLwEAIgMgA0ECdCABQfIBai0AABshCiABQegBai8BACEDAkACQAJAAkACQAJAAkACQAJAAkAgAUHuAWotAABFBEAgAyAKbCIDIAhLDQMgBkEgaiABIAUgAxAwIAYoAiAiA0ECRw0BIAYtACRFDQIMCQsgBkIANwIUIAYgAzYCEANAIAZBCGohD0EAIQNBACENIwBBEGsiBCQAAkACQAJAIAZBEGoiDCgCACILRQ0AIAwoAggiCUEETw0AIAwoAgQhDSAEQoSAgIAgNwIIIARCiICAgIABNwIAAkAgDSAEIAlBAnRqKAIAaiIDIAtJDQAgBEIBNwIIIARChICAgCA3AgAgCUEERg0CIAQgCUECdGooAgAhAyAMIAlBAWoiDjYCCCADIAtJDQAgBEIBNwIIIARChICAgCA3AgAgDkEERg0CIAQgDkECdGooAgAhAyAMIAlBAmoiDjYCCCADIAtJDQAgBEIBNwIIIARChICAgCA3AgAgDkEERg0CIAQgDkECdGooAgAhAyAMIAlBA2oiDjYCCCADIAtJDQAgBEIBNwIIIARChICAgCA3AgAgDkEERg0CIAQgDkECdGooAgAhAyAMIAlBBGoiDjYCCCADIAtJDQAgBEIBNwIIIARChICAgCA3AgAgCUUNAiAEIA5BAnRqKAIAIQMgDCAJQQVqNgIICyAMIAM2AgRBASEDCyAPIA02AgQgDyADNgIAIARBEGokAAwBC0EEQQRB9KzCABDMAQALIAYoAghFDQkgBigCDCAKbCIDIAhLDQQgCiAIIANrIgRLDQUgBkEgaiABIAMgBWogChAwIAYtACQhAyAGKAIgIgRBAkcNBiADDQALQQ9BARD+AiIERQ0GIARBB2pBo6rAACkAADcAACAEQZyqwAApAAA3AABBDEEEEP4CIgNFDREgA0EPNgIIIAMgBDYCBCADQQ82AgAgB0GEpMAANgIIIAcgAzYCBCAHQQA2AgAMCQsgByAGKAAlNgAFIAdBCGogBkEoaigAADYAACAHIAYtACQ6AAQgByADNgIADAgLQQ9BARD+AiIERQ0FIARBB2pBo6rAACkAADcAACAEQZyqwAApAAA3AABBDEEEEP4CIgNFDQ8gA0EPNgIIIAMgBDYCBCADQQ82AgAgB0GEpMAANgIIIAcgAzYCBCAHQQA2AgAMBwsgAyAIQayqwAAQlwMACyADIAhBjKrAABCWAwALIAogBEGMqsAAEJcDAAsgByAGKAAlNgAFIAdBCGogBkEoaigAADYAACAHIAM6AAQgByAENgIADAMLQQ9BARC8AwALQQ9BARC8AwALIAdBAjYCAAsgBkEwaiQAIAIoAmhBAkcNAgJAIAIoAiAiA0H/////A3EgA0cNACADQQJ0rSACKAIkIgStfiIZQiCIpw0AIBmnIAhNDQILIAgEQCAFEDsLIAJByABqIgMiAUEAOgAAIAFBAjoAASACQfQAakE5NgIAIAIgAkEkajYCcCACQTk2AmwgAiACQSBqNgJoIAJBAjYClAEgAkEDNgKMASACQeyrwAA2AogBIAJBADYCgAEgAiACQegAajYCkAEgAkHYAGogAkGAAWoQXSACQawBaiACQeAAaigCADYCACACQQY6AKABIAIgAikDWDcCpAEgAEEEaiIBIAMpAgA3AhAgASACQaABaiIFKQIANwIAIAFBGGogA0EIaikCADcCACABQQhqIAVBCGopAgA3AgAgAEEENgIADAYLIABBBzYCAAwFCyACIAg2AkAgAiAFNgI8IAIgCDYCOCACIAQ2AjQgAiADNgIwIAIoAhwgAigCGHIgASgC+AEiCCADR3JFIAQgASgC/AEiBEZxRQRAIAIgAkEwajYCiAEgAiACQQxqNgKEASACIAJBEGo2AoABIAJB6ABqIQMgAkGAAWohCSMAQUBqIgEkAAJAAkACQAJAAkACQAJAAkACQCAIQf////8DcSAIRw0AIAhBAnStIAStfiIZQiCIpw0AAkAgGaciBUUEQCADIAQ2AgQgAyAINgIAIANBEGogBTYCACADQQxqQQE2AgAgA0EIaiAFNgIADAELIAVBAE4iB0UNAiAFIAcQ/wIiBkUNAyADIAQ2AgQgAyAINgIAIANBEGogBTYCACADQQxqIAY2AgAgA0EIaiAFNgIAQQAgBCAIbEECdGshAyAJKAIEIQ8gCSgCACEMIAhFIQdBASEEQQAhBQNAIA8oAgAiCkGEAmooAgAhCyAKKAKAAiINIAVNIAcgC09yDQUgByANbCAFakECdCINQQRqIQsgDUF8Rg0GIAsgCkGQAmooAgAiDksNByAKQYwCaigCACANaiELIAYCfwJAIAUgDCgCCGsiCiAJKAIIIgUoAgAiDUkEQCAHIAwoAgxrIg4gBSgCBEkNAQsgCygAAAwBCyANIA5sIApqQQJ0Ig1BBGohCiANQXxGDQkgCiAFQRBqKAIAIg5LDQogASAFQQxqKAIAIA1qKAAANgIIIAwtABggCyABQQhqEKoCIAEoAggLNgAAIAcgBCAIT2ohByAEQQAgBCAISRsiBUEBaiEEIAZBBGohBiADQQRqIgMNAAsLIAFBQGskAAwIC0GwisAAQTNB5IrAABCaAwALEJYCAAsgBSAHELwDAAsgAUEsakEHNgIAIAFBFGpBAjYCACABQRxqQQI2AgAgASAHNgI0IAEgBTYCMCABQaSJwAA2AhAgAUEANgIIIAFBBzYCJCABIAs2AjwgASANNgI4IAEgAUEgajYCGCABIAFBOGo2AiggASABQTBqNgIgIAFBCGpBtInAABCiAgALQXwgC0H4iMAAEJgDAAsgCyAOQfiIwAAQlwMAC0F8IApBkIrAABCYAwALIAogDkGQisAAEJcDAAsgAkGQAWogAkH4AGooAgA2AgAgAkGIAWogAkHwAGopAwA3AwAgAiACKQNoNwOAASAAQQRqIAlBAEEAIAIoAhAgAigCFBCQAiAAQQY2AgAgAigCOEUNBSACKAI8EDsMBQsgAkGAAWohAwJAAkACQCACQTBqIgUoAgAiBEH/////A3EgBEcNACAFNQIEIARBAnStfiIZQiCIpw0AIBmnIgYgBUEQaigCACIHSw0BIAMgBDYCCCADQgA3AgAgA0EYakKAgICAwAA3AgAgA0EQaiAGNgIAIAMgBUEMaigCACIFNgIMIANBFGogBSAGajYCAAwCC0HUicAAQStBgIrAABCGAgALIAYgB0HEicAAEJcDAAsCQAJAAkACQAJAIAIoApABIgMgAigCnAEiBUkNACACKAKMASEGIAVBBEYEQCACLQAoIQwgAigCgAEiBEEAIAQgAigCiAEiB0kbIQUgAigChAEgBCAHT2ohBCABQYwCaiEKIAFBkAJqIQsDQCAGRQ0CIAEoAoACIgggBU0gASgChAIiCSAETXINBCAEIAhsIAVqQQJ0IglBBGohCCAJQXxGDQUgCCALKAIAIg1LDQYgDCAKKAIAIAlqIAYQqgIgBUEBaiIIQQAgByAISxshBSAEIAcgCE1qIQQgBkEEaiEGIANBBGsiA0EETw0ACwwBCyAGDQELIAJBkAFqIAJBQGsoAgA2AgAgAkGIAWogAkE4aikDADcDACACIAIpAzA3A4ABIABBBGogAkGAAWpBAEEAIAIoAhAgAigCFBCQAiAAQQY2AgAMCAsgAiAFNgKgASACQQA2AogBQQAgAkGgAWpB+JfAACACQYABakH8l8AAENoBAAsgAkGsAWpBBzYCACACQYwBakECNgIAIAJBlAFqQQI2AgAgAiAENgJcIAIgBTYCWCACQdSwwAA2AogBIAJBADYCgAEgAkEHNgKkASACIAk2AkwgAiAINgJIIAIgAkGgAWo2ApABIAIgAkHIAGo2AqgBIAIgAkHYAGo2AqABIAJBgAFqQeSwwAAQogIAC0F8IAhBqLDAABCYAwALIAggDUGosMAAEJcDAAsgAkGIAWogAkHwAGooAgA2AgAgAiACKQNoNwOAASAAIAJBgAFqENIBIAhFDQMgBRA7DAMLIAJBiAFqIAJB8ABqKAIANgIAIAIgAikDaDcDgAEgACACQYABahDSAQwCCxCWAgALIAggAxC8AwALIAJBsAFqJAAPC0EMQQQQvAMAC8QLAxZ/A30CfiMAQdAAayICJAAgACgCACEQAkACQAJAAkACQAJAIABBCGooAgAoAgBBfwJ/IAAoAgQiCioCCCIYQwAAgE9dIBhDAAAAAGAiA3EEQCAYqQwBC0EAC0EAIAMbIBhD//9/T14bIAFqSQ0AIAogAEEQaigCACoCACIZQwAAAD6UIhggAEEMaigCACoCACAZENMDIhpfBH8gGCEZA0AgBEEBaiEEIBggGZIiGSAaXw0ACyAEQQdxBUEACyAQakEHcSIDNgIMIAogCioCBCADQQJ0QYiPwABqKgIAlDgCACAAQRRqKAIAEMgDIQYCfyAKKgIIIhhDAACAT10gGEMAAAAAYCIDcQRAIBipDAELQQALIQUgAEEYaigCACgCACIHIAYoAgBLDQUgBjUCBEF/IAVBACADGyAYQ///f09eGyILrSIbIAGtIhx8VA0EIAdB/////wNxIAdHDQMgB0ECdK0gG34iG0IgiKcNAwJAIBunIghFBEBBASEMDAELIAhBAE4iA0UNAyAIIAMQ/wIiDEUNAgsgAkEQaiAINgIAIAJBDGogDDYCACACIAg2AgggAiALNgIEIAIgBzYCAAJAIAdFIAtFcg0AIAdBAnQhESAGQQxqIRQgBkEQaiEVQXwhDiABIQ9BASEEQQAhAwNAIAMhBSAEIQMgASAFaiESIA5BAnYhFiATIQVBACEEAkACQAJAAkADQCAGKAIAIgkgBE0gBigCBCINIBJNckUEQCAEIAkgD2xqQQJ0Ig1BBGohCSANQXxGDQIgFSgCACIXIAlJBEAgCSAXQZCKwAAQlwMACyAEIBZGDQMgBUEEaiIJIAhLDQQgBSAMaiAUKAIAIA1qKAAANgAAIAkhBSAEQQFqIgQgB0cNAQwFCwsgAkE8akEHNgIAIAJBJGpBAjYCACACQSxqQQI2AgAgAiASNgJEIAIgBDYCQCACQaSJwAA2AiAgAkEANgIYIAJBBzYCNCACIA02AkwgAiAJNgJIIAIgAkEwajYCKCACIAJByABqNgI4IAIgAkFAazYCMCACQRhqQaCKwAAQogIAC0F8IAlBkIrAABCYAwALQXwgBUEEakG8jsAAEJgDAAsgBUEEaiAIQbyOwAAQlwMACyADIAtGDQEgDiARayEOIBEgE2ohEyAPQQFqIQ8gA0EBaiEEIAMgC0kNAAsjAEFAaiIAJAACQAJAAkAgBigCACIFRSABIANqIgEgBigCBCIET3JFBEAgASAFbEECdCIFQQRqIQEgBUF8Rg0BIAEgBkEQaigCACIESw0CIAZBDGooAgAgBWooAAAaIABBQGskAAwDCyAAQSxqQQc2AgAgAEEUakECNgIAIABBHGpBAjYCACAAIAE2AjQgAEEANgIwIABBpInAADYCECAAQQA2AgggAEEHNgIkIAAgBDYCPCAAIAU2AjggACAAQSBqNgIYIAAgAEE4ajYCKCAAIABBMGo2AiAgAEEIakGgisAAEKICAAtBfCABQZCKwAAQmAMACyABIARBkIrAABCXAwALIAJBJGpBAjYCACACQSxqQQI2AgAgAkE8akEHNgIAIAIgAzYCRCACQQA2AkAgAkHojsAANgIgIAJBADYCGCACQQc2AjQgAiALNgJMIAIgBzYCSCACIAJBMGo2AiggAiACQcgAajYCOCACIAJBQGs2AjAgAkEYakH4jsAAEKICAAsgCioCACIYQwAAAN9gIQEgAEEcaigCACACQv///////////wACfiAYi0MAAABfXQRAIBiuDAELQoCAgICAgICAgH8LQoCAgICAgICAgH8gARsgGEP///9eXhtCACAYIBhbGyAcEEAgCEUNACAMEDsLIAAgEEEBajYCACACQdAAaiQADwsgCCADELwDAAsQlgIAC0GwisAAQTNB5IrAABCaAwALQciHwABBwgBBjIjAABCGAgALQZyGwABBwABBuIfAABCGAgAL9joDHH8PfAJ+IwBB0ABrIg4kACABLQD4AyECAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgAUHYA2ooAgBFBEAgASgC3AMiBCABQeADaigCAE8NAiABIARBAWo2AtwDIAFB1ANqKAIAIQ8MAQsgAUHcA2oiCC0AFCEEIA5BMGohBgJAAkACQAJAIAgoAgAiGSAIKAIETw0AIAgoAggiC0UNACAILQAUIRMMAQsgCC0AFCIF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AyIEIAQgBWogCyAFayIEEMMDIAYgBDYCAAsgAUEANgKcAwwBCyAFIAtB1IHAABCXAwALIA5BMGogASADEE4CQAJAAkAgDi0ASSIEQQ5HBEAgBEEPcUEKaw4EAQICAwILIA5BIGogDkFAaygCACIBNgIAIA5BGGogDkE4aikDACItNwMAIA4gDikDMCIuNwMQIABBFGogATYCACAAQQxqIC03AgAgACAuNwIEIABBATYCAAwICyABQQE6APQDCyAGKAIAIgsgASgCnAMiBWsgD0kNAQwFCwsgAUG8A2ooAgBFDQIgDkEDOgAwIABBBGogDkEwahCyAiAAQQE2AgAMBAsgAEEANgIAIABBDGpBAjoAAAwDC0GEnMAAQStB5J7AABCGAgALIABBADYCACAAQQxqQQI6AAAMAQsgBSALSw0BIAUgC0YNAkEFIAFBuANqKAIAIAVqIhotAAAiBCAEQQVPG0H/AXEiA0EFRgRAIAEgASgCnAMgD2o2ApwDIA4gGi0AADoAMSAOQRg6ADAgAEEEaiAOQTBqELICIABBATYCAAwBCyAPRQ0DIA8gAUGwA2ooAgAiBEsNBCAPIAsgBWsiBEsNBSAOQQhqIRsgAUGsA2ooAgBBAWohDSAPQQFrIQQgGkEBaiEHIAJB/wFxIRICQAJAAkACQAJAAkACQAJAAkACQAJAAkACQCADQf8BcUEBaw4EAAECAwwLIAQgEk0NCwNAIAQgCk0NCSAHIBJqIhEgByAKai0AACARLQAAajoAACAKQQFqIQogBCASQQFqIhJHDQALDAsLQQANCSAERQ0KIARBA3EhESAEQQFrQQNPBEAgBEF8cSEDA0AgByAKaiIFIAogDWoiBi0AACAFLQAAajoAACAFQQFqIgIgBkEBai0AACACLQAAajoAACAFQQJqIgIgBkECai0AACACLQAAajoAACAFQQNqIgIgBkEDai0AACACLQAAajoAACADIApBBGoiCkcNAAsLIBFFDQogByAKaiESIAogDWohCgNAIBIgCi0AACASLQAAajoAACASQQFqIRIgCkEBaiEKIBFBAWsiEQ0ACwwKC0EADQggBCASSQ0BIAQNAwwHC0EADQcgBCASTw0BC0GP/sAAIRBBPyERDAcLIARFDQEgByANLQAAIActAABqOgAAAkAgAkH/AXFBAUYNACAEQQFGDQIgByANLQABIActAAFqOgABIAJB/wFxQQJGDQAgBEECRg0CIAcgDS0AAiAHLQACajoAAiACQf8BcUEDRg0AIARBA0YNAiAHIA0tAAMgBy0AA2o6AAMgAkH/AXFBBEYNACAEQQRGDQIgByANLQAEIActAARqOgAEIAJB/wFxQQVGDQAgBEEFRg0CIAcgDS0ABSAHLQAFajoABSACQf8BcUEGRg0AIARBBkYNAiAHIA0tAAYgBy0ABmo6AAYgAkH/AXFBB0YNACAEQQdGDQIgByANLQAHIActAAdqOgAHCyAEIAQgEnBrIgMgEkkNAiADIBJrIhwgEkkNBiAHIBJqIQggDSASaiELIAJB/wFxIhhBAUYhBQNAIAggCmoiFCAULQAAIAcgCmoiFS0AACIJIAogDWoiFi0AACIDIAogC2oiFy0AACICIAIgCWogA2siECACayICIAJBEHRBH3UiAnMgAmtB//8DcSIGIBAgA2siAiACQRB0QR91IgJzIAJrQf//A3EiEUsbIgMgECAJayICIAJBEHRBH3UiAnMgAmtB//8DcSICIBFNGyADIAIgBk0bajoAAAJAIAUNACAUQQFqIgIgAi0AACAVQQFqLQAAIgkgFkEBai0AACIDIBdBAWotAAAiAiACIAlqIANrIhAgAmsiAiACQRB0QR91IgJzIAJrQf//A3EiBiAQIANrIgIgAkEQdEEfdSICcyACa0H//wNxIhFLGyIDIBAgCWsiAiACQRB0QR91IgJzIAJrQf//A3EiAiARTRsgAyACIAZNG2o6AAAgGEECRg0AIBRBAmoiAiACLQAAIBVBAmotAAAiCSAWQQJqLQAAIgMgF0ECai0AACICIAIgCWogA2siECACayICIAJBEHRBH3UiAnMgAmtB//8DcSIGIBAgA2siAiACQRB0QR91IgJzIAJrQf//A3EiEUsbIgMgECAJayICIAJBEHRBH3UiAnMgAmtB//8DcSICIBFNGyADIAIgBk0bajoAACAYQQNGDQAgFEEDaiICIAItAAAgFUEDai0AACIJIBZBA2otAAAiAyAXQQNqLQAAIgIgAiAJaiADayIQIAJrIgIgAkEQdEEfdSICcyACa0H//wNxIgYgECADayICIAJBEHRBH3UiAnMgAmtB//8DcSIRSxsiAyAQIAlrIgIgAkEQdEEfdSICcyACa0H//wNxIgIgEU0bIAMgAiAGTRtqOgAAIBhBBEYNACAUQQRqIgIgAi0AACAVQQRqLQAAIgkgFkEEai0AACIDIBdBBGotAAAiAiACIAlqIANrIhAgAmsiAiACQRB0QR91IgJzIAJrQf//A3EiBiAQIANrIgIgAkEQdEEfdSICcyACa0H//wNxIhFLGyIDIBAgCWsiAiACQRB0QR91IgJzIAJrQf//A3EiAiARTRsgAyACIAZNG2o6AAAgGEEFRg0AIBRBBWoiAiACLQAAIBVBBWotAAAiCSAWQQVqLQAAIgMgF0EFai0AACICIAIgCWogA2siECACayICIAJBEHRBH3UiAnMgAmtB//8DcSIGIBAgA2siAiACQRB0QR91IgJzIAJrQf//A3EiEUsbIgMgECAJayICIAJBEHRBH3UiAnMgAmtB//8DcSICIBFNGyADIAIgBk0bajoAACAYQQZGDQAgFEEGaiICIAItAAAgFUEGai0AACIJIBZBBmotAAAiAyAXQQZqLQAAIgIgAiAJaiADayIQIAJrIgIgAkEQdEEfdSICcyACa0H//wNxIgYgECADayICIAJBEHRBH3UiAnMgAmtB//8DcSIRSxsiAyAQIAlrIgIgAkEQdEEfdSICcyACa0H//wNxIgIgEU0bIAMgAiAGTRtqOgAAIBhBB0YNACAUQQdqIgIgAi0AACAVQQdqLQAAIgkgFkEHai0AACIDIBdBB2otAAAiAiACIAlqIANrIhAgAmsiAiACQRB0QR91IgJzIAJrQf//A3EiBiAQIANrIgIgAkEQdEEfdSICcyACa0H//wNxIhFLGyIDIBAgCWsiAiACQRB0QR91IgJzIAJrQf//A3EiAiARTRsgAyACIAZNG2o6AAALIAogEmohCkEAIRAgEiAcIBJrIhxNDQALDAYLIAcgBy0AACANLQAAQQF2ajoAAAJAIAJB/wFxQQFGDQAgBEEBRg0EIAcgBy0AASANLQABQQF2ajoAASACQf8BcUECRg0AIARBAkYNBCAHIActAAIgDS0AAkEBdmo6AAIgAkH/AXFBA0YNACAEQQNGDQQgByAHLQADIA0tAANBAXZqOgADIAJB/wFxQQRGDQAgBEEERg0EIAcgBy0ABCANLQAEQQF2ajoABCACQf8BcUEFRg0AIARBBUYNBCAHIActAAUgDS0ABUEBdmo6AAUgAkH/AXFBBkYNACAEQQZGDQQgByAHLQAGIA0tAAZBAXZqOgAGIAJB/wFxQQdGDQAgBEEHRg0EIAcgBy0AByANLQAHQQF2ajoABwsCQAJAAkACQAJAAkACQCACQQ9xQQJrDgcCAwQABQAGAQsACwJAIAQEQCAEQQFrIghFDQEgBy0AACEJIAhBAXEEQCAHIActAAEgDS0AASAJQf8BcWpBAXZqIgk6AAEgDUEBaiENIAdBAWohByAEQQJrIQgLIARBAkYNASAHQQJqIQogDUECaiEHA0AgCkEBayICIAItAAAgB0EBay0AACAJQf8BcWpBAXZqIgI6AAAgCiAKLQAAIActAAAgAkH/AXFqQQF2aiIJOgAAIApBAmohCiAHQQJqIQcgCEECayIIDQALDAELQeD+wABBK0HAgMEAEIYCAAsMCgsCQCAEQX5xIgIEQCACQQJHBEAgB0EDaiEKQQIgAmshCSANQQNqIQggBy0AACENA0AgCkEBayICIAItAAAgCEEBay0AACANQf8BcWpBAXZqIg06AAAgCiAKLQAAIAgtAAAgCkECay0AAGpBAXZqOgAAIApBAmohCiAIQQJqIQggCUECaiIJDQALCwwBC0Hg/sAAQStBsIDBABCGAgALDAkLAkAgBCAEQQNwayICQQNPBEAgAkEDayIJQQNPBEAgBy0AACELA0AgByAKaiIGQQNqIgIgAi0AACAKIA1qIgNBA2otAAAgC0H/AXFqQQF2aiILOgAAIAZBBGoiAiACLQAAIANBBGotAAAgBkEBai0AAGpBAXZqOgAAIAZBBWoiAiACLQAAIANBBWotAAAgBkECai0AAGpBAXZqOgAAIApBA2ohCiAJQQNrIglBAksNAAsLDAELQeD+wABBK0GggMEAEIYCAAsMCAsCQCAEQXxxIgIEQCACQQRrIgMEQCAHLQAAIQtBACEIA0AgByAIaiIFQQRqIgIgAi0AACAIIA1qIgZBBGotAAAgC0H/AXFqQQF2aiILOgAAIAVBBWoiAiACLQAAIAZBBWotAAAgBUEBai0AAGpBAXZqOgAAIAVBBmoiAiACLQAAIAZBBmotAAAgBUECai0AAGpBAXZqOgAAIAVBB2oiAiACLQAAIAZBB2otAAAgBUEDai0AAGpBAXZqOgAAIAMgCEEEaiIIRw0ACwsMAQtB4P7AAEErQZCAwQAQhgIACwwHCwJAIAQgBEEGcGsiAkEGTwRAIAJBBmsiC0EGTwRAIActAAAhEgNAIAcgCWoiBkEGaiICIAItAAAgCSANaiIDQQZqLQAAIBJB/wFxakEBdmoiEjoAACAGQQdqIgIgAi0AACADQQdqLQAAIAZBAWotAABqQQF2ajoAACAGQQhqIgIgAi0AACADQQhqLQAAIAZBAmotAABqQQF2ajoAACAGQQlqIgIgAi0AACADQQlqLQAAIAZBA2otAABqQQF2ajoAACAGQQpqIgIgAi0AACADQQpqLQAAIAZBBGotAABqQQF2ajoAACAGQQtqIgIgAi0AACADQQtqLQAAIAZBBWotAABqQQF2ajoAACAJQQZqIQkgC0EGayILQQVLDQALCwwBC0Hg/sAAQStBgIDBABCGAgALDAYLAkAgBEF4cSICBEAgAkEIayIDBEAgBy0AACELA0AgByAJaiIFQQhqIgIgAi0AACAJIA1qIgZBCGotAAAgC0H/AXFqQQF2aiILOgAAIAVBCWoiAiACLQAAIAZBCWotAAAgBUEBai0AAGpBAXZqOgAAIAVBCmoiAiACLQAAIAZBCmotAAAgBUECai0AAGpBAXZqOgAAIAVBC2oiAiACLQAAIAZBC2otAAAgBUEDai0AAGpBAXZqOgAAIAVBDGoiAiACLQAAIAZBDGotAAAgBUEEai0AAGpBAXZqOgAAIAVBDWoiAiACLQAAIAZBDWotAAAgBUEFai0AAGpBAXZqOgAAIAVBDmoiAiACLQAAIAZBDmotAAAgBUEGai0AAGpBAXZqOgAAIAVBD2oiAiACLQAAIAZBD2otAAAgBUEHai0AAGpBAXZqOgAAIAMgCUEIaiIJRw0ACwsMAQtB4P7AAEErQfD/wAAQhgIACwwFCyAEIARB0P7AABDMAQALQeD+wABBK0GM/8AAEIYCAAsgCiAEQaz/wAAQzAEACyAEIARBnP/AABDMAQALQbz/wAAhEEExIRELIBsgETYCBCAbIBA2AgAgDigCCCICBEAgDigCDCEBIA4gAjYCNCAOQR06ADAgDiABNgI4IABBBGogDkEwahCyAiAAQQE2AgAMAQsgDyABQbADaiIDKAIAIgJLDQYgAUGsA2oiAigCACAaIA8QwgMaIAEgASgCnAMgD2o2ApwDIA8gAygCACIBSw0HIABBADYCACAAQRRqIBk2AgAgAEEQaiATNgIAIABBDWogDDoAACAAQQxqIB06AAAgAEEIaiAENgIAIAAgAigCAEEBajYCBAsgDkHQAGokAA8LIAUgC0HQnMAAEJYDAAtBAEEAQeCcwAAQzAEAC0EBQQBB8JzAABCYAwALIA8gBEHwnMAAEJcDAAsgDyAEQYCdwAAQlwMACyAPIAJBkJ3AABCXAwALIA8gAUGgncAAEJcDAAuOCgEBfyMAQTBrIgIkAAJ/AkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIAAtAABBAWsOEQECAwQFBgcICQoLDA0ODxARAAsgAiAALQABOgAIIAJBJGpBAjYCACACQSxqQQE2AgAgAkGou8AANgIgIAJBADYCGCACQdkANgIUIAIgAkEQajYCKCACIAJBCGo2AhAgASACQRhqEOcBDBELIAIgACkDCDcDCCACQSRqQQI2AgAgAkEsakEBNgIAIAJBjLvAADYCICACQQA2AhggAkHaADYCFCACIAJBEGo2AiggAiACQQhqNgIQIAEgAkEYahDnAQwQCyACIAApAwg3AwggAkEkakECNgIAIAJBLGpBATYCACACQYy7wAA2AiAgAkEANgIYIAJB2wA2AhQgAiACQRBqNgIoIAIgAkEIajYCECABIAJBGGoQ5wEMDwsgAiAAKwMIOQMIIAJBJGpBAjYCACACQSxqQQE2AgAgAkHwusAANgIgIAJBADYCGCACQdwANgIUIAIgAkEQajYCKCACIAJBCGo2AhAgASACQRhqEOcBDA4LIAIgACgCBDYCCCACQSRqQQI2AgAgAkEsakEBNgIAIAJB0LrAADYCICACQQA2AhggAkHdADYCFCACIAJBEGo2AiggAiACQQhqNgIQIAEgAkEYahDnAQwNCyACIAApAgQ3AwggAkEkakEBNgIAIAJBLGpBATYCACACQby6wAA2AiAgAkEANgIYIAJB3gA2AhQgAiACQRBqNgIoIAIgAkEIajYCECABIAJBGGoQ5wEMDAsgAkEkakEBNgIAIAJBLGpBADYCACACQay6wAA2AiAgAkHcuMAANgIoIAJBADYCGCABIAJBGGoQ5wEMCwsgAkEkakEBNgIAIAJBLGpBADYCACACQZi6wAA2AiAgAkHcuMAANgIoIAJBADYCGCABIAJBGGoQ5wEMCgsgAkEkakEBNgIAIAJBLGpBADYCACACQYS6wAA2AiAgAkHcuMAANgIoIAJBADYCGCABIAJBGGoQ5wEMCQsgAkEkakEBNgIAIAJBLGpBADYCACACQfC5wAA2AiAgAkHcuMAANgIoIAJBADYCGCABIAJBGGoQ5wEMCAsgAkEkakEBNgIAIAJBLGpBADYCACACQdi5wAA2AiAgAkHcuMAANgIoIAJBADYCGCABIAJBGGoQ5wEMBwsgAkEkakEBNgIAIAJBLGpBADYCACACQci5wAA2AiAgAkHcuMAANgIoIAJBADYCGCABIAJBGGoQ5wEMBgsgAkEkakEBNgIAIAJBLGpBADYCACACQby5wAA2AiAgAkHcuMAANgIoIAJBADYCGCABIAJBGGoQ5wEMBQsgAkEkakEBNgIAIAJBLGpBADYCACACQbC5wAA2AiAgAkHcuMAANgIoIAJBADYCGCABIAJBGGoQ5wEMBAsgAkEkakEBNgIAIAJBLGpBADYCACACQZy5wAA2AiAgAkHcuMAANgIoIAJBADYCGCABIAJBGGoQ5wEMAwsgAkEkakEBNgIAIAJBLGpBADYCACACQYS5wAA2AiAgAkHcuMAANgIoIAJBADYCGCABIAJBGGoQ5wEMAgsgAkEkakEBNgIAIAJBLGpBADYCACACQey4wAA2AiAgAkHcuMAANgIoIAJBADYCGCABIAJBGGoQ5wEMAQsgASAAKAIEIABBCGooAgAQ+AILIAJBMGokAAuWCQMVfwN9AX4jAEEgayIFJAACQCAAQQhqKAIAIgRFDQAgBUEIaiAAQQRqKAIAIgsQpgMgBSAFKAIIIAUoAgwQggMgBSgCALMgBSgCBLOUQwAAIEGVIhcgAV8NAAJ/AkACQAJAAkACQAJAIARB4/G4HEsNACAEQSRsIgdBAEgNACAEQeTxuBxJQQJ0IQIgBwR/IAcgAhD+AgUgAgsiDEUNAyAFIAw2AhQgBSAENgIQIAsgBEEkbCIGaiERIAQhByALIQIDQCAGIApHBEAgB0UNAyACQRxqKAIAIQggAigCDCENIAIoAgghDiACKAIEIQ8gAigCACEQAkAgAkEgaigCACIJRQRAQQEhAwwBCyAJQQBIDQMgCUEBEP4CIgNFDQULIAMgCCAJEMIDIQggAikCECEaIAogDGoiA0EEaiAPNgIAIANBCGogDjYCACADQQxqIA02AgAgA0EgaiAJNgIAIANBHGogCDYCACADQRhqIAk2AgAgA0EQaiAaNwIAIAMgEDYCACAKQSRqIQogAkEkaiECIAdBAWsiBw0BCwsgBSAENgIYIAEgF11FIBdDAAAAQF9yDQUgBLMhGUEkIQJBfyENQQEhCQNAIAQgDWpBJGwhDiACIQcgCSEKIAshAwNAIANBHGooAgAhDyADQQxqKAIAIRAgA0EIaigCACESIANBBGooAgAhEyADKAIAIRQCQAJAAkACQCADQSBqKAIAIghFBEBBASEGDAELIAhBAEgNBiAIQQEQ/gIiBkUNAQsgBiAPIAgQwgMhDyADQRRqKAIAIRUgA0EQaigCACEWIAQgBSgCEEYNAQwCCyAIQQEQvAMACyAFQRBqIARBARCbASAFKAIUIQwLIAcgDGohBgJAIAQgCk0EQCAEIApGDQEjAEEwayIAJAAgACAENgIEIAAgCjYCACAAQRRqQQM2AgAgAEEcakECNgIAIABBLGpBOTYCACAAQejVwgA2AhAgAEEANgIIIABBOTYCJCAAIABBIGo2AhggACAAQQRqNgIoIAAgADYCICAAQQhqQYDWwgAQogIACyAGQSRqIAYgDhDDAwsgBiAUNgIAIAZBIGogCDYCACAGQRxqIA82AgAgBkEYaiAINgIAIAZBFGogFTYCACAGQRBqIBY2AgAgBkEMaiAQNgIAIAZBCGogEjYCACAGQQRqIBM2AgAgBSAEQQFqIgQ2AhggB0HIAGohByAKQQJqIQogDkEkayEOIANBJGoiAyARRw0ACyAXIASzIBmVlSIYIAFeRQ0FIAJBJGohAiANQQFrIQ0gCUEBaiEJIBhDAAAAQF9FDQALDAQLEJYCAAsgBCAEQdyxwAAQzAEACyAJQQEQvAMACyAHIAIQvAMACyAAQQRqKAIAIQsgBSgCFCEMIABBCGooAgAMAQsgFyEYIAQLIQIgDCAEIBgQbyACBEAgAkEkbCEDIAtBHGohAgNAIAJBBGsoAgAEQCACKAIAEDsLIAJBJGohAiADQSRrIgMNAAsLIAAoAgAEQCALEDsLIAAgBSkDEDcCACAAQQhqIAVBGGooAgA2AgALIAVBIGokAAvwBwEIfwJAAkAgAEEDakF8cSICIABrIgUgAUsgBUEES3INACABIAVrIgdBBEkNACAHQQNxIQhBACEBAkAgACACRg0AIAVBA3EhAwJAIAIgAEF/c2pBA0kEQCAAIQIMAQsgBUF8cSEGIAAhAgNAIAEgAiwAAEG/f0pqIAIsAAFBv39KaiACLAACQb9/SmogAiwAA0G/f0pqIQEgAkEEaiECIAZBBGsiBg0ACwsgA0UNAANAIAEgAiwAAEG/f0pqIQEgAkEBaiECIANBAWsiAw0ACwsgACAFaiEAAkAgCEUNACAAIAdBfHFqIgIsAABBv39KIQQgCEEBRg0AIAQgAiwAAUG/f0pqIQQgCEECRg0AIAQgAiwAAkG/f0pqIQQLIAdBAnYhBSABIARqIQMDQCAAIQEgBUUNAkHAASAFIAVBwAFPGyIEQQNxIQYgBEECdCEIAkAgBEH8AXEiB0UEQEEAIQIMAQsgASAHQQJ0aiEJQQAhAgNAIABFDQEgAiAAKAIAIgJBf3NBB3YgAkEGdnJBgYKECHFqIABBBGooAgAiAkF/c0EHdiACQQZ2ckGBgoQIcWogAEEIaigCACICQX9zQQd2IAJBBnZyQYGChAhxaiAAQQxqKAIAIgJBf3NBB3YgAkEGdnJBgYKECHFqIQIgAEEQaiIAIAlHDQALCyAFIARrIQUgASAIaiEAIAJBCHZB/4H8B3EgAkH/gfwHcWpBgYAEbEEQdiADaiEDIAZFDQALAkAgAUUEQEEAIQIMAQsgASAHQQJ0aiEAIAZBAWtB/////wNxIgJBAWoiBEEDcSEBAkAgAkEDSQRAQQAhAgwBCyAEQfz///8HcSEGQQAhAgNAIAIgACgCACICQX9zQQd2IAJBBnZyQYGChAhxaiAAQQRqKAIAIgJBf3NBB3YgAkEGdnJBgYKECHFqIABBCGooAgAiAkF/c0EHdiACQQZ2ckGBgoQIcWogAEEMaigCACICQX9zQQd2IAJBBnZyQYGChAhxaiECIABBEGohACAGQQRrIgYNAAsLIAFFDQADQCACIAAoAgAiAkF/c0EHdiACQQZ2ckGBgoQIcWohAiAAQQRqIQAgAUEBayIBDQALCyACQQh2Qf+B/AdxIAJB/4H8B3FqQYGABGxBEHYgA2oPCyABRQRAQQAPCyABQQNxIQICQCABQQFrQQNJBEAMAQsgAUF8cSEBA0AgAyAALAAAQb9/SmogACwAAUG/f0pqIAAsAAJBv39KaiAALAADQb9/SmohAyAAQQRqIQAgAUEEayIBDQALCyACRQ0AA0AgAyAALAAAQb9/SmohAyAAQQFqIQAgAkEBayICDQALCyADC/8KAgN8A38jAEEQayIFJAAgALshAQJAAkACQAJAIAC8IgZB/////wdxIgRB25+k+gNPBEAgBEHSp+2DBEkNASAEQdbjiIcESQ0CIARB////+wdNDQMgACAAkyEADAQLIARBgICAzANPBEAgASABoiICIAGiIgMgAiACoqIgAkSnRjuMh83GPqJEdOfK4vkAKr+goiADIAJEsvtuiRARgT+iRHesy1RVVcW/oKIgAaCgtiEADAQLIAUgAEMAAIADlCAAQwAAgHuSIARBgICABEkbOAIIIAUqAggaDAMLIARB5JfbgARPBEBEGC1EVPshCcBEGC1EVPshCUAgBkEAThsgAaAiAiACoiIBIAKaoiIDIAEgAaKiIAFEp0Y7jIfNxj6iRHTnyuL5ACq/oKIgAyABRLL7bokQEYE/okR3rMtUVVXFv6CiIAKhoLYhAAwDCyAGQQBOBEAgAUQYLURU+yH5v6AiASABoiIBRIFeDP3//9+/okQAAAAAAADwP6AgASABoiICREI6BeFTVaU/oqAgASACoiABRGlQ7uBCk/k+okQnHg/oh8BWv6CioLYhAAwDCyABRBgtRFT7Ifk/oCIBIAGiIgFEgV4M/f//37+iRAAAAAAAAPA/oCABIAGiIgJEQjoF4VNVpT+ioCABIAKiIAFEaVDu4EKT+T6iRCceD+iHwFa/oKKgtowhAAwCCyAEQeDbv4UETwRARBgtRFT7IRnARBgtRFT7IRlAIAZBAE4bIAGgIgIgAiACoiIBoiIDIAEgAaKiIAFEp0Y7jIfNxj6iRHTnyuL5ACq/oKIgAiADIAFEsvtuiRARgT+iRHesy1RVVcW/oKKgoLYhAAwCCyAGQQBOBEAgAUTSITN/fNkSwKAiASABoiIBRIFeDP3//9+/okQAAAAAAADwP6AgASABoiICREI6BeFTVaU/oqAgASACoiABRGlQ7uBCk/k+okQnHg/oh8BWv6CioLaMIQAMAgsgAUTSITN/fNkSQKAiASABoiIBRIFeDP3//9+/okQAAAAAAADwP6AgASABoiICREI6BeFTVaU/oqAgASACoiABRGlQ7uBCk/k+okQnHg/oh8BWv6CioLYhAAwBCyAFQgA3AwgCfCAEQdqfpO4ETQRAIAFEg8jJbTBf5D+iRAAAAAAAADhDoEQAAAAAAAA4w6AiAkQAAAAAAADgwWYhBkH/////BwJ/IAKZRAAAAAAAAOBBYwRAIAKqDAELQYCAgIB4C0GAgICAeCAGGyACRAAAwP///99BZBtBACACIAJhGyEEIAEgAkQAAABQ+yH5v6KgIAJEY2IaYbQQUb6ioAwBCyAFIAQgBEEXdkGWAWsiBEEXdGu+uzkDACAFIAVBCGogBBAoIQQgBkEATgRAIAUrAwgMAQtBACAEayEEIAUrAwiaCyEBAkACQAJAAkAgBEEDcQ4DAQIDAAsgASABoiIBRIFeDP3//9+/okQAAAAAAADwP6AgASABoiICREI6BeFTVaU/oqAgASACoiABRGlQ7uBCk/k+okQnHg/oh8BWv6CioLaMIQAMAwsgASABIAGiIgKiIgMgAiACoqIgAkSnRjuMh83GPqJEdOfK4vkAKr+goiABIAMgAkSy+26JEBGBP6JEd6zLVFVVxb+goqCgtiEADAILIAEgAaIiAUSBXgz9///fv6JEAAAAAAAA8D+gIAEgAaIiAkRCOgXhU1WlP6KgIAEgAqIgAURpUO7gQpP5PqJEJx4P6IfAVr+goqC2IQAMAQsgASABoiICIAGaoiIDIAIgAqKiIAJEp0Y7jIfNxj6iRHTnyuL5ACq/oKIgAyACRLL7bokQEYE/okR3rMtUVVXFv6CiIAGhoLYhAAsgBUEQaiQAIAALlgcBBX8gABDRAyIAIAAQuAMiAhDOAyEBAkACQAJAIAAQuQMNACAAKAIAIQMCQCAAEJEDRQRAIAIgA2ohAiAAIAMQzwMiAEHYl8MAKAIARw0BIAEoAgRBA3FBA0cNAkHQl8MAIAI2AgAgACACIAEQvwIPCyACIANqQRBqIQAMAgsgA0GAAk8EQCAAEIABDAELIABBDGooAgAiBCAAQQhqKAIAIgVHBEAgBSAENgIMIAQgBTYCCAwBC0HIl8MAQciXwwAoAgBBfiADQQN2d3E2AgALAkAgARCKAwRAIAAgAiABEL8CDAELAkACQAJAQdyXwwAoAgAgAUcEQCABQdiXwwAoAgBHDQFB2JfDACAANgIAQdCXwwBB0JfDACgCACACaiIBNgIAIAAgARDtAg8LQdyXwwAgADYCAEHUl8MAQdSXwwAoAgAgAmoiATYCACAAIAFBAXI2AgQgAEHYl8MAKAIARg0BDAILIAEQuAMiAyACaiECAkAgA0GAAk8EQCABEIABDAELIAFBDGooAgAiBCABQQhqKAIAIgFHBEAgASAENgIMIAQgATYCCAwBC0HIl8MAQciXwwAoAgBBfiADQQN2d3E2AgALIAAgAhDtAiAAQdiXwwAoAgBHDQJB0JfDACACNgIADAMLQdCXwwBBADYCAEHYl8MAQQA2AgALQeiXwwAoAgAgAU8NAUEIQQgQ8QIhAEEUQQgQ8QIhAUEQQQgQ8QIhA0EAQRBBCBDxAkECdGsiAkGAgHwgAyAAIAFqamtBd3FBA2siACAAIAJLG0UNAUHcl8MAKAIARQ0BQQhBCBDxAiEAQRRBCBDxAiEBQRBBCBDxAiECQQACQEHUl8MAKAIAIgQgAiABIABBCGtqaiICTQ0AQdyXwwAoAgAhAUGwlcMAIQACQANAIAEgACgCAE8EQCAAEJMDIAFLDQILIAAoAggiAA0AC0EAIQALIAAQugMNACAAQQxqKAIAGgwAC0EAEIgBa0cNAUHUl8MAKAIAQeiXwwAoAgBNDQFB6JfDAEF/NgIADwsgAkGAAkkNASAAIAIQhAFB8JfDAEHwl8MAKAIAQQFrIgA2AgAgAA0AEIgBGg8LDwsgAkF4cUHAlcMAaiEBAn9ByJfDACgCACIDQQEgAkEDdnQiAnEEQCABKAIIDAELQciXwwAgAiADcjYCACABCyEDIAEgADYCCCADIAA2AgwgACABNgIMIAAgAzYCCAueCAEHfwJAIAFB/wlNBEAgAUEFdiEFAkACQAJAIAAoAqABIgQEQCAEQQJ0IABqQQRrIQIgBCAFakECdCAAakEEayEGIARBAWsiA0EnSyEEA0AgBA0EIAMgBWoiB0EoTw0CIAYgAigCADYCACAGQQRrIQYgAkEEayECIANBAWsiA0F/Rw0ACwsgAUEgSQ0EIABBADYCACABQcAATw0BDAQLIAdBKEGoiMMAEMwBAAsgAEEANgIEQQEgBSAFQQFNGyICQQJGDQIgAEEANgIIIAJBA0YNAiAAQQA2AgwgAkEERg0CIABBADYCECACQQVGDQIgAEEANgIUIAJBBkYNAiAAQQA2AhggAkEHRg0CIABBADYCHCACQQhGDQIgAEEANgIgIAJBCUYNAiAAQQA2AiQgAkEKRg0CIABBADYCKCACQQtGDQIgAEEANgIsIAJBDEYNAiAAQQA2AjAgAkENRg0CIABBADYCNCACQQ5GDQIgAEEANgI4IAJBD0YNAiAAQQA2AjwgAkEQRg0CIABBADYCQCACQRFGDQIgAEEANgJEIAJBEkYNAiAAQQA2AkggAkETRg0CIABBADYCTCACQRRGDQIgAEEANgJQIAJBFUYNAiAAQQA2AlQgAkEWRg0CIABBADYCWCACQRdGDQIgAEEANgJcIAJBGEYNAiAAQQA2AmAgAkEZRg0CIABBADYCZCACQRpGDQIgAEEANgJoIAJBG0YNAiAAQQA2AmwgAkEcRg0CIABBADYCcCACQR1GDQIgAEEANgJ0IAJBHkYNAiAAQQA2AnggAkEfRg0CIABBADYCfCACQSBGDQIgAEEANgKAASACQSFGDQIgAEEANgKEASACQSJGDQIgAEEANgKIASACQSNGDQIgAEEANgKMASACQSRGDQIgAEEANgKQASACQSVGDQIgAEEANgKUASACQSZGDQIgAEEANgKYASACQSdGDQIgAEEANgKcASACQShGDQJBKEEoQaiIwwAQzAEACyADQShBqIjDABDMAQALQdKIwwBBHUGoiMMAEIYCAAsgACgCoAEgBWohAiABQR9xIgdFBEAgACACNgKgASAADwsCQCACQQFrIgNBJ00EQCACIQQgACADQQJ0aigCACIGQQAgAWsiAXYiA0UNASACQSdNBEAgACACQQJ0aiADNgIAIAJBAWohBAwCCyACQShBqIjDABDMAQALIANBKEGoiMMAEMwBAAsCQCACIAVBAWoiCEsEQCABQR9xIQEgAkECdCAAakEIayEDA0AgAkECa0EoTw0CIANBBGogBiAHdCADKAIAIgYgAXZyNgIAIANBBGshAyAIIAJBAWsiAkkNAAsLIAAgBUECdGoiASABKAIAIAd0NgIAIAAgBDYCoAEgAA8LQX9BKEGoiMMAEMwBAAvFCAEFfwJAAkAgAi0AACIFRQ0AIAIvAQINACACQQRqLwEARQ0BCwJAIAEoAgAiAwRAIAFBACADGyIEKAIAIgEoAgAgASgCCCIDRgRAIAEgA0EBEKIBIAEoAgghAwsgASADQQFqNgIIIAEoAgQgA2pBIToAACAFBEAgAkEEai8BACEFIAIvAQICfyAEKAIAIgEoAgAgASgCCCIDRwRAIAEMAQsgASADQQEQogEgASgCCCEDIAQoAgALIQIgASADQQFqNgIIIAEoAgQgA2pB/wE6AAAgAigCCCIDIAIoAgBHBH8gAgUgAiADQQEQogEgAigCCCEDIAQoAgALIQEgAiADQQFqNgIIIAIoAgQgA2pBCzoAACABKAIAIAEoAggiAmtBCk0EQCABIAJBCxCiASABKAIIIQILIAEgAkELajYCCCABKAIEIAJqIgFB46DAACkAADcAACABQQdqQeqgwAAoAAA2AAACfyAEKAIAIgEoAgAgASgCCCIDRwRAIAEMAQsgASADQQEQogEgASgCCCEDIAQoAgALIQIgASADQQFqNgIIIAEoAgQgA2pBAzoAACACKAIIIgEgAigCAEYEQCACIAFBARCiASACKAIIIQELIAIgAUEBajYCCCACKAIEIAFqQQE6AAAEQCAEKAIAIgIoAgAgAigCCCIBa0EBTQRAIAIgAUECEKIBIAIoAgghAQsgAiABQQJqNgIIIAIoAgQgAWpBADsAAAwDCyAEKAIAIgIoAgAgAigCCCIBa0EBTQRAIAIgAUECEKIBIAIoAgghAQsgAiABQQJqNgIIIAIoAgQgAWoiASAFQYD+A3FBCHY6AAEgASAFOgAADAILIAItAAIhBiACLwEEIQUgAi0AASEHAn8gBCgCACIBKAIAIAEoAggiA0cEQCABDAELIAEgA0EBEKIBIAEoAgghAyAEKAIACyECIAEgA0EBajYCCCABKAIEIANqQfkBOgAAIAIoAggiAyACKAIARwR/IAIFIAIgA0EBEKIBIAIoAgghAyAEKAIACyEBIAIgA0EBajYCCCACKAIEIANqQQQ6AAAgASgCCCICIAEoAgBGBEAgASACQQEQogEgASgCCCECCyABIAJBAWo2AgggASgCBCACaiAHOgAAIAVBgP4DcUEIdiEHAn8gBCgCACIBKAIAIAEoAggiA2tBAUsEQCABDAELIAEgA0ECEKIBIAEoAgghAyAEKAIACyECIAEgA0ECajYCCCABKAIEIANqIgEgBzoAASABIAU6AAAgAigCCCIBIAIoAgBGBEAgAiABQQEQogEgAigCCCEBCyACIAFBAWo2AgggAigCBCABaiAGOgAADAELQeCfwABBK0HwoMAAEIYCAAsgBCgCACICKAIAIAIoAggiAUYEQCACIAFBARCiASACKAIIIQELIAIgAUEB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QAJAIAQoAggiAUEHRg0AIARBCGpBBHIhBQJAAkACQANAAkAgBCgCLCEIIAQoAighByABQQZHDQAgBw0CIARBCGogAyAGEQEAIAQoAggiAUEHRw0BDAULCwJAAkACQAJAAkAgAigCAA4HAQIDBwQABwALIAItAARBA0cNBiACQQhqKAIAIgMoAgAgAygCBCgCABEDACADKAIEIgZBBGooAgAEQCAGQQhqKAIAGiADKAIAEDsLIAIoAggQOwwGCwJAIAItAARBAWtBAUsNACACQQhqKAIARQ0AIAJBDGooAgAQOwsgAkEUaigCACIDRQ0FIAMgAkEYaiIDKAIAKAIAEQMAIAMoAgAiA0EEaigCAEUNBSADQQhqKAIAGiACKAIUEDsMBQsCQCACLQAEQQFrQQFLDQAgAkEIaigCAEUNACACQQxqKAIAEDsLIAJBFGooAgAiA0UNBCADIAJBGGoiAygCACgCABEDACADKAIAIgNBBGooAgBFDQQgA0EIaigCABogAigCFBA7DAQLAkAgAigCBEECRw0AIAJBCGooAgBFDQAgAkEMaigCABA7CyACQRRqKAIAIgNFDQMgAyACQRhqIgMoAgAoAgARAwAgAygCACIDQQRqKAIARQ0DIANBCGooAgAaIAIoAhQQOwwDCwJAIAJBFGotAABBAWtBAUsNACACQRhqKAIARQ0AIAJBHGooAgAQOwsCQEEBIAItAAQiA0EEayADQQNNG0H/AXEOAgMAAgsgA0EBa0ECSQ0BDAILIAAgBSkCADcCACAAQRhqIAVBGGooAgA2AgAgAEEQaiAFQRBqKQIANwIAIABBCGogBUEIaikCADcCACAAIAg2AiAgACAHNgIcDAMLIAJBCGooAgBFDQAgAkEMaigCABA7CyACIAE2AgAgAiAINgIkIAIgBzYCICACIAUpAgA3AgQgAkEMaiAFQQhqKQIANwIAIAJBFGogBUEQaikCADcCACACQRxqIAVBGGooAgA2AgALIABBADYCHAsgBEEwaiQAC/QFAQd/An8gAQRAQStBgIDEACAAKAIYIglBAXEiARshCiABIAVqDAELIAAoAhghCUEtIQogBUEBagshCAJAIAlBBHFFBEBBACECDAELAkAgA0EQTwRAIAIgAxA5IQYMAQsgA0UEQAwBCyADQQNxIQsCQCADQQFrQQNJBEAgAiEB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iANFDQEMAgsLIAFBAToAiAMLIABBDToAGQwCCyAFIARB2ILAABCWAwALIANBCGogBkEIaikCACILNwMAIAMgBikCACIMNwMAIABBDGogCzcCACAAIAw3AgQgAEEOOgAZIAAgBDYCAAsgA0FAayQAC/kEAQp/IwBBMGsiAyQAIANBAzoAKCADQoCAgICABDcDICADQQA2AhggA0EANgIQIAMgATYCDCADIAA2AggCfwJAAkAgAigCACIKRQRAIAJBFGooAgAiAEUNASACKAIQIQEgAEEDdCEFIABBAWtB/////wFxQQFqIQcgAigCCCEAA0AgAEEEaigCACIEBEAgAygCCCAAKAIAIAQgAygCDCgCDBECAA0ECyABKAIAIANBCGogAUEEaigCABEAAA0DIAFBCGohASAAQQhqIQAgBUEIayIFDQALDAELIAIoAgQiAEUNACAAQQV0IQsgAEEBa0H///8/cUEBaiEHIAIoAgghAANAIABBBGooAgAiAQRAIAMoAgggACgCACABIAMoAgwoAgwRAgANAwsgAyAFIApqIgRBHGotAAA6ACggAyAEQRRqKQIANwMgIARBEGooAgAhBiACKAIQIQhBACEJQQAhAQJAAkACQCAEQQxqKAIAQQFrDgIAAgELIAZBA3QgCGoiDEEEaigCAEGwAkcNASAMKAIAKAIAIQYLQQEhAQsgAyAGNgIUIAMgATYCECAEQQhqKAIAIQECQAJAAkAgBEEEaigCAEEBaw4CAAIBCyABQQN0IAhqIgZBBGooAgBBsAJHDQEgBigCACgCACEBC0EBIQkLIAMgATYCHCADIAk2AhggCCAEKAIAQQN0aiIBKAIAIANBCGogASgCBBEAAA0CIABBCGohACALIAVBIGoiBUcNAAsLIAJBDGooAgAgB0sEQCADKAIIIAIoAgggB0EDdGoiACgCACAAKAIEIAMoAgwoAgwRAgANAQtBAAwBC0EBCyADQTBqJAALgRwCFX8DfiMAQfAAayIIJAAgCEIANwNAIAggA60iGTcDSAJAAkACQCABQUBrKAIAQQJHBEAgCEEQaiABQRBqEK4DIAggCDUCECAINQIUfiABLQCABBD0Aq1C/wGDEMcBIAhCADcDWCAIQn8gCCkDACAIKQMIQgBSGyIaNwNgIBkgGlINASAIQUBrIQkjAEHAAWsiBCQAIARB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ACAAQSRqIAJBiAFqKAIANgIAIAEQTAwDC0GEnMAAQStB5J7AABCGAgALIANBARC8AwALIAAgAikCRDcCBCAAQSRqIAJB5ABqKAIANgIAIABBHGogAkHcAGopAgA3AgAgAEEUaiACQdQAaikCADcCACAAQQxqIAJBzABqKQIANwIAIAAgATYCACADRQ0AIAQQOwsgAkHwBGokAAv4AwECfwJAAkACQAJAAkACQAJAIAAoAgAOBQECAwUEAAsgAC0ABEEDRw0EIABBCGooAgAiASgCACABKAIEKAIAEQMAIAEoAgQiAkEEaigCAARAIAJBCGooAgAaIAEoAgAQOwsgACgCCBA7DwsCQCAALQAEQQFrQQFLDQAgAEEIaigCAEUNACAAQQxqKAIAEDsLIABBFGooAgAiAUUNAyABIABBGGoiASgCACgCABEDACABKAIAIgFBBGooAgBFDQMMBAsCQCAALQAEQQFrQQFLDQAgAEEIaigCAEUNACAAQQxqKAIAEDsLIABBFGooAgAiAUUNAiABIABBGGoiASgCACgCABEDACABKAIAIgFBBGooAgBFDQIMAwsCQCAAKAIEQQJHDQAgAEEIaigCAEUNACAAQQxqKAIAEDsLIABBFGooAgAiAUUNASABIABBGGoiASgCACgCABEDACABKAIAIgFBBGooAgBFDQEgAUEIaigCABogACgCFBA7DAELAkAgAEEUai0AAEEBa0EBSw0AIABBGGooAgBFDQAgAEEcaigCABA7CwJAAkBBASAALQAEIgFBBGsgAUEDTRtB/wFxDgICAAELIAFBAWtBAk8NAQsgAEEIaigCAEUNACAAQQxqKAIAEDsLDwsgAUEIaigCABogACgCFBA7C+ADAQl/IABBKGooAgAiBiACQf8BcSIISwRAIABBJGooAgAgCEECdGooAgAiBkEBa0EAIAYbIQICQCAGIAAoAgQiDUkiBSACckUNACAEQf8BcSEEIANB/wFxIQogAUH/AXEhCyAAQRhqKAIAIQwgAEEcaigCACEBQYCAgIAEIQADQAJAIAVFDQACQCABIAZLBEAgDCAGQQR0aiIDKAIEIAhrIgUgBWwiBSAATg0EIAUgAygCCCALayIFIAVsaiIFIABODQEgBSADKAIAIAprIgkgCWxqIgUgAE4NASAFIAMoAgwgBGsiAyADbGoiAyAAIAAgA0oiAxshACAGIAcgAxshByAGQQFqIQYMAgsgBiABQZCxwgAQzAEACyAGQQFqIQYLAn9BACACRQ0AGgJAIAEgAksEQCAMIAJBBHRqIgMoAgQgCGsiBSAFbCIFIABODQQgBSADKAIIIAtrIgUgBWxqIgUgAE4NASAFIAMoAgAgCmsiCSAJbGoiBSAATg0BIAUgAygCDCAEayIDIANsaiIDIAAgACADSiIDGyEAIAIgByADGyEHIAJBAWsMAgsgAiABQaCxwgAQzAEACyACQQFrCyICIAYgDUkiBXINAAsLIAcPCyAIIAZBgLHCABDMAQALhwQBCH8gASgCBCIFBEAgASgCACEEA0ACQCADQQFqIQICfyACIAMgBGotAAAiCMAiCUEATg0AGgJAAkACQAJAAkACQAJAIAhBpPfCAGotAABBAmsOAwABAggLQfjuwgAgAiAEaiACIAVPGy0AAEHAAXFBgAFHDQcgA0ECagwGC0H47sIAIAIgBGogAiAFTxssAAAhByAIQeABayIGRQ0BIAZBDUYNAgwDC0H47sIAIAIgBGogAiAFTxssAAAhBgJAAkACQAJAIAhB8AFrDgUBAAAAAgALIAlBD2pB/wFxQQJLIAZBQE5yDQgMAgsgBkHwAGpB/wFxQTBPDQcMAQsgBkGPf0oNBgtB+O7CACAEIANBAmoiAmogAiAFTxstAABBwAFxQYABRw0FQfjuwgAgBCADQQNqIgJqIAIgBU8bLQAAQcABcUGAAUcNBSADQQRqDAQLIAdBYHFBoH9HDQQMAgsgB0Ggf04NAwwBCyAJQR9qQf8BcUEMTwRAIAlBfnFBbkcgB0FATnINAwwBCyAHQb9/Sg0CC0H47sIAIAQgA0ECaiICaiACIAVPGy0AAEHAAXFBgAFHDQEgA0EDagsiAyICIAVJDQELCyAAIAM2AgQgACAENgIAIAEgBSACazYCBCABIAIgBGo2AgAgACACIANrNgIMIAAgAyAEajYCCA8LIABBADYCAAvdAwIEfwF9IwBBMGsiBCQAIABDAAAAQRA4AkAgAEEIaigCAEUNACAEQRBqIABBBGoiAygCABCmAyAEQQhqIAQoAhAgBCgCFBCCAyAEQRhqIAMoAgAgAEEIaiIFKAIAQX8Cf0MAALRDIAQoAgizIAQoAgyzlEMAACBBlUMAALRDlCABQwAASEOUQwAAAD6UlSIHlY4iAUMAAIBPXSABQwAAAABgIgZxBEAgAakMAQtBAAtBACAGGyABQ///f09eGxBKIAUoAgAiBQRAIAVBJGwhBSADKAIAQRxqIQMDQCADQQRrKAIABEAgAygCABA7CyADQSRqIQMgBUEkayIFDQALCyAAKAIABEAgAEEEaigCABA7CyAAIAQpAxg3AgAgAEEIaiIDIARBIGoiBigCADYCACADKAIAIgNFDQAgB4wgByACGyEBIABBBGooAgAhBSADQSRsIQBBACEDA0AgASADs5RDAAC0QxDTAyEHIARBGGogBRDIAyAHQzX6jjyUECcgBRDIAyICKAIIBEAgAkEMaigCABA7CyAFQSRqIQUgAiAEKQMYNwIAIAJBEGogBEEoaigCADYCACACQQhqIAYpAwA3AgAgA0EBaiEDIABBJGsiAA0ACwsgBEEwaiQAC+0DAQZ/IwBBMGsiBSQAAkACQAJAAkACQCABQQxqKAIAIgMEQCABKAIIIQcgA0EBa0H/////AXEiA0EBaiIGQQdxIQQCfyADQQdJBEBBACEDIAcMAQsgB0E8aiECIAZB+P///wNxIQZBACEDA0AgAigCACACQQhrKAIAIAJBEGsoAgAgAkEYaygCACACQSBrKAIAIAJBKGsoAgAgAkEwaygCACACQThrKAIAIANqampqampqaiEDIAJBQGshAiAGQQhrIgYNAAsgAkE8awshAiAEBEAgAkEEaiECA0AgAigCACADaiEDIAJBCGohAiAEQQFrIgQNAAsLIAFBFGooAgANASADIQQMAwtBACEDIAFBFGooAgANAUEBIQIMBAsgA0EPSw0AIAcoAgRFDQILIAMgA2oiBCADSQ0BCyAERQ0AAkAgBEEATgRAIARBARD+AiICRQ0BIAQhAwwDCxCWAgALIARBARC8AwALQQEhAkEAIQMLIABBADYCCCAAIAI2AgQgACADNgIAIAUgADYCDCAFQSBqIAFBEGopAgA3AwAgBUEYaiABQQhqKQIANwMAIAUgASkCADcDECAFQQxqQbzTwgAgBUEQahBPBEBBnNTCAEEzIAVBKGpB0NTCAEH41MIAEMUBAAsgBUEwaiQAC8UFAgZ/AXwjAEHQAGsiAyQAAkAgACgCACIFQYEBEAYEQEEHIQZBACEADAELAkACQAJAIAUQBw4CAgEACyADQRBqIAUQAiADKAIQBEBBAyEGIAMrAxghCUEAIQAMAwsgA0EIaiAFEAECfyADKAIIIgUEQCADKAIMIQQgAyAFNgIkIAMgBDYCKCADIAQ2AiBBASEAQQUhBkEADAELAn8CQAJAIAAoAgAQGkUEQCAAKAIAEBRFDQIgAyAAKAIAEBc2AiAgA0E4aiADQSBqEL0BIAMoAkAhBCADKAI8IQUgAygCOCEHIAMoAiAiBkGEAUkNASAGEAAMAQsgA0E4aiAAEL0BIAMoAkAhBCADKAI8IQUgAygCOCEHCyAFRQ0AQQYhBkEADAELIANBwQA2AjQgAyAANgIwIANBATYCTCADQQE2AkQgA0GgtsAANgJAIANBADYCOCADIANBMGo2AkggA0EgaiADQThqEF1BESEGIAMoAighBCADKAIkIQVBAQsiAEEBcwshCCAErb8hCQwCC0EBIQQLQQAhAAsgAyAJOQNAIAMgBTYCPCADIAQ6ADkgAyAGOgA4IwBBMGsiBCQAIAQgAjYCBCAEIAE2AgAgBEEUakHGADYCACAEQccANgIMIAQgA0E4ajYCCCAEIAQ2AhAgBEECNgIsIARBAjYCJCAEQZi4wAA2AiAgBEEANgIYIAQgBEEIajYCKAJ/IwBBQGoiASQAIAFBADYCCCABQoCAgIAQNwMAIAFBEGoiAiABQcC2wAAQuwIgBEEYaiACEOUBRQRAIAEoAgQgASgCCBAEIAEoAgAEQCABKAIEEDsLIAFBQGskAAwBC0HYtsAAQTcgAUE4akGQt8AAQey3wAAQxQEACyAEQTBqJAAgCEUgB0VyRQRAIAUQOwsCQCAARQ0AIAMoAiBFDQAgBRA7CyADQdAAaiQAC6MOAgN/AX4jAEEwayIDJAACfwJAAkACQAJAAkACQCAAKAIAQQFrDgUBAgMEBQALIwBBMGsiAiQAAn8CQCAAQQRqIgAoAhBFBEAgAC0AAEEDRw0BIAJBFGpBATYCACACQRxqQQA2AgAgAkH8ycAANgIQIAJBuMTAADYCGCACQQA2AgggASACQQhqEOcBDAILIAIgAEEQajYCBCACQRRqQQI2AgAgAkEcakECNgIAIAJBLGpBhAE2AgAgAkHYycAANgIQIAJBADYCCCACQYMBNgIkIAIgADYCICACIAJBIGo2AhggAiACQQRqNgIoIAEgAkEIahDnAQwBCyACQRRqQQE2AgAgAkEcakEBNgIAIAJB6MnAADYCECACQQA2AgggAkGDATYCJCACIAA2AiAgAiACQSBqNgIYIAEgAkEIahDnAQsgAkEwaiQADAULIABBBGohAiAAQRRqIgAoAgBFBEAgA0EkakEBNgIAIANBLGpBATYCACADQbjJwAA2AiAgA0EANgIYIANBgwE2AgwgAyACNgIIIAMgA0EIajYCKCABIANBGGoQ5wEMBQsgAyAANgIEIANBJGpBAjYCACADQSxqQQI2AgAgA0EUakGEATYCACADQajJwAA2AiAgA0EANgIYIANBgwE2AgwgAyACNgIIIAMgA0EIajYCKCADIANBBGo2AhAgASADQRhqEOcBDAQLIwBBMGsiAiQAAkACQAJAAkACQAJAIABBBGoiBCgCAEEBaw4DAAECAwtBASEAIAJBHGpBATYCACACQSRqQQA2AgAgAkG8yMAANgIYIAJBuMTAADYCICACQQA2AhAgASACQRBqEOcBRQ0DDAQLIAIgBEEEajYCDEEBIQAgAkEcakEBNgIAIAJBJGpBATYCACACQfDHwAA2AhggAkEANgIQIAJBgQE2AiwgAiACQShqNgIgIAIgAkEMajYCKCABIAJBEGoQ5wFFDQIMAwtBASEAIAJBHGpBATYCACACQSRqQQA2AgAgAkHMx8AANgIYIAJBuMTAADYCICACQQA2AhAgASACQRBqEOcBRQ0BDAILQQEhACACQRxqQQE2AgAgAkEkakEANgIAIAJB/MjAADYCGCACQbjEwAA2AiAgAkEANgIQIAEgAkEQahDnAQ0BCyAEKAIQRQRAQQAhAAwBCyACIARBEGo2AgwgAkEcakEBNgIAIAJBJGpBATYCACACQYjJwAA2AhggAkEANgIQIAJBhAE2AiwgAiACQShqNgIgIAIgAkEMajYCKCABIAJBEGoQ5wEhAAsgAkEwaiQAIAAMAwsCQAJAAkBBAiAAKQMIIgWnQQJrIAVCAVgbQQFrDgIBAgALIANBJGpBATYCACADQSxqQQA2AgAgA0GMy8AANgIgIANBuMTAADYCKCADQQA2AhggASADQRhqEOcBDAQLIANBJGpBATYCACADQSxqQQA2AgAgA0HwysAANgIgIANBuMTAADYCKCADQQA2AhggASADQRhqEOcBDAMLIANBJGpBATYCACADQSxqQQA2AgAgA0HUysAANgIgIANBuMTAADYCKCADQQA2AhggASADQRhqEOcBDAILIwBBMGsiAiQAAn8CQAJAAkACQAJAAkBBASAAQQRqIgAtAAAiBEEEayAEQQNNG0H/AXFBAWsOAgECAAsgAiAAQQFqNgIEIAJBFGpBAzYCACACQRxqQQI2AgAgAkEsakGFATYCACACQYzHwAA2AhAgAkEANgIIIAJBgwE2AiQgAiAAQRBqNgIgIAIgAkEgajYCGCACIAJBBGo2AiggASACQQhqEOcBDAULIARBAmsOAgIDAQsgAiAAQQRqNgIAIAAtABBBA0YEQCACQRRqQQE2AgAgAkEcakEBNgIAIAJBsMXAADYCECACQQA2AgggAkGBATYCJCACIAJBIGo2AhggAiACNgIgIAEgAkEIahDnAQwECyACIABBEGo2AgQgAkEUakECNgIAIAJBHGpBAjYCACACQSxqQYEBNgIAIAJB8MTAADYCECACQQA2AgggAkGGATYCJCACIAJBIGo2AhggAiACNgIoIAIgAkEEajYCICABIAJBCGoQ5wEMAwsgAiAANgIEIAJBFGpBAjYCACACQRxqQQE2AgAgAkHcxcAANgIQIAJBADYCCCACQYYBNgIkIAIgAkEgajYCGCACIAJBBGo2AiAgASACQQhqEOcBDAILIAIgADYCBCACQRRqQQI2AgAgAkEcakEBNgIAIAJB2MbAADYCECACQQA2AgggAkGGATYCJCACIAJBIGo2AhggAiACQQRqNgIgIAEgAkEIahDnAQwBCyACQRRqQQE2AgAgAkEcakEANgIAIAJBlMbAADYCECACQbjEwAA2AhggAkEANgIIIAEgAkEIahDnAQsgAkEwaiQADAELIABBBGogARBqCyADQTBqJAAL/wIBAn8gAEEUaigCAARAIABBEGooAgAQOwsCQCAAQThqKAIAIgFFDQAgASAAQTxqIgEoAgAoAgARAwAgASgCACIBQQRqKAIARQ0AIAFBCGooAgAaIAAoAjgQOwsgAEHEAGooAgAEQCAAQcgAaigCABA7CyAAQdAAaigCAARAIABB1ABqKAIAEDsLIAAoAigEQCAAQSxqKAIAEDsLAkAgAEHoAGooAgAiAUECRg0AAkAgAEH8AGooAgAiAkUNACAAQfgAaigCAEUNACACEDsgACgCaCEBCyABRQ0AIABB7ABqKAIARQ0AIABB8ABqKAIAEDsLAkAgAEGwAWooAgAiAUUNACAAKAKsAUUNACABEDsLAkAgAEHYAWooAgAiAUUNACAAQdQBaigCAEUNACABEDsLAkAgACgCxAFFDQAgAEHIAWooAgBFDQAgAEHMAWooAgAQOwsgACgCuAEEQCAAQbwBaigCABA7CyAAQYgCaigCAARAIABBjAJqKAIAEDsLC7cFAQt/IwBBMGsiBSQAIAVCgYCAgKABNwMgIAUgAjYCHCAFQQA2AhggBSACNgIUIAUgATYCECAFIAI2AgwgBUEANgIIIAAoAgQhCiAAKAIAIQsgACgCCCEMAn8DQAJAIARFBEACQCACIAhJDQADQCABIAhqIQYCfyACIAhrIgNBCE8EQCADIQACQAJAAkACQAJAAkAgBkEDakF8cSIDIAZGDQAgAyAGayIDIAAgACADSxsiBEUNAEEAIQNBASEHA0AgAyAGai0AAEEKRg0GIAQgA0EBaiIDRw0ACyAEIABBCGsiA0sNAgwBCyAAQQhrIQNBACEECwNAAkAgBCAGaiIHKAIAQYqUqNAAcyINQX9zIA1BgYKECGtxQYCBgoR4cQ0AIAdBBGooAgBBipSo0ABzIgdBf3MgB0GBgoQIa3FBgIGChHhxDQAgBEEIaiIEIANNDQELCyAAIARJDQELQQAhByAAIARGDQEDQCAEIAZqLQAAQQpGBEAgBCEDQQEhBwwECyAEQQFqIgQgAEcNAAsMAQsgBCAAQfz1wgAQlgMACyAAIQMLIAUgAzYCBCAFIAc2AgAgBSgCBCEAIAUoAgAMAQtBACEAQQAgA0UNABoDQEEBIAAgBmotAABBCkYNARogAyAAQQFqIgBHDQALIAMhAEEAC0EBRwRAIAIhCAwCCyAAIAhqIgBBAWohCAJAIAAgAk8NACAAIAFqLQAAQQpHDQBBACEEIAgiAyEADAQLIAIgCE8NAAsLQQEhBCACIgAgCSIDRw0BC0EADAILAkAgDC0AAARAIAtB2PHCAEEEIAooAgwRAgANAQsgASAJaiEGIAAgCWshByAMIAAgCUcEfyAGIAdqQQFrLQAAQQpGBUEACzoAACADIQkgCyAGIAcgCigCDBECAEUNAQsLQQELIAVBMGokAAvOAwECfyMAQeAAayICJAACQAJAAkACQAJAAkACQEEBIAEtAAAiA0EfayADQR5NG0H/AXFBAWsOAwECAwALIABBBTYCACAAIAEpAgQ3AgQMAwsgAEEAOwEEQRRBBBD+AiIDRQ0DIABBADYCACADIAEpAgA3AgAgAEEYakHUwMAANgIAIABBFGogAzYCACADQRBqIAFBEGooAgA2AgAgA0EIaiABQQhqKQIANwIADAILIAJBGGogAUEQaigCADYCACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBADYCKCACQoCAgIAQNwMgIAJBMGoiASACQSBqQfzCwAAQuwIgAkEIaiABEHENAyAAQQhqIAIpAyA3AgAgAEEQaiACQShqKAIANgIAIABBFGpBADYCACAAQoKAgIAgNwMAIAItAAhBH0cNASACLQAMQQNHDQEgAkEQaigCACIAKAIAIAAoAgQoAgARAwAgACgCBCIBQQRqKAIABEAgAUEIaigCABogACgCABA7CyACKAIQEDsMAQsgAEEDNgIAIABCAzcDCAsgAkHgAGokAA8LQRRBBBC8AwALQZTDwABBNyACQdgAakHMw8AAQajEwAAQxQEAC8AEAQN/IwBBMGsiAiQAAn8CQAJAAkACQCAAKAIEIgMOAwACAwELIwBBEGsiACQAIABB7LzAADYCCCAAQQ42AgQgAEHevMAANgIAIwBBEGsiASQAIAFBCGogAEEIaigCADYCACABIAApAgA3AwAjAEEQayIAJAAgACABKQIANwMIIABBCGpBiL3AAEEAIAEoAghBARCrAQALIAJBJGpBATYCACACQSxqQQA2AgAgAkHAu8AANgIgIAJB3LjAADYCKCACQQA2AhhBASABIAJBGGoQ5wENAhogA0EDdCEDIAAoAgAhAAJAA0AgAiAANgIUIAQEQCACQQE2AiQgAkHMu8AANgIgIAJBADYCLCACQdy4wAA2AiggAkEANgIYIAEgAkEYahDnAQ0CCyACQQI2AiQgAkHUu8AANgIgIAJBATYCLCACQQA2AhggAkHfADYCBCACIAI2AiggAiACQRRqNgIAIAEgAkEYahDnAQ0BIABBCGohACAEQQFrIQQgA0EIayIDDQALQQAMAwtBAQwCCyACQSRqQQI2AgAgAkEsakEBNgIAIAJB1LvAADYCICACQQA2AhggAkHgADYCBCACIAAoAgA2AgAgAiACNgIoIAEgAkEYahDnAQwBCyAC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ADYCHCABQdTqwABBECACQRxqQeTqwAAQrgEMBQsgAiAANgIcIAFBterAAEEMIAJBHGpBxOrAABCuAQwECyABQazqwABBCRD4AgwDCyABQZzqwABBEBD4AgwCCyACIAA2AhwgAUH46cAAQQwgAkEcakHI6cAAEK4BDAELIAFBlOrAAEEIEPgCCyACQSBqJAALvwMBAX8jAEFAaiICJAACQAJAAkACQAJAAkAgAC0AAEEBaw4DAQIDAAsgAiAAKAIENgIEQRRBARD+AiIARQ0EIABBEGpB68vCACgAADYAACAAQQhqQePLwgApAAA3AAAgAEHby8IAKQAANwAAIAJBFDYCECACIAA2AgwgAkEUNgIIIAJBNGpBAzYCACACQTxqQQI2AgAgAkEkakGVAjYCACACQbzEwgA2AjAgAkEANgIoIAJBlgI2AhwgAiACQRhqNgI4IAIgAkEEajYCICACIAJBCGo2AhggASACQShqEOcBIQAgAigCCEUNAyACKAIMEDsMAwsgAC0AASEAIAJBNGpBATYCACACQTxqQQE2AgAgAkHcvcIANgIwIAJBADYCKCACQZcCNgIMIAIgAEEgc0E/cUECdCIAQfDLwgBqKAIANgIcIAIgAEHwzcIAaigCADYCGCACIAJBCGo2AjggAiACQRhqNgIIIAEgAkEoahDnASEADAILIAAoAgQiACgCACAAKAIEIAEQvQMhAAwBCyAAKAIEIgAoAgAgASAAQQRqKAIAKAIQEQAAIQALIAJBQGskACAADwtBFEEBELwDAAuSAwECfwJAAkACQCACBEAgAS0AAEExSQ0BAkAgA8EiB0EASgRAIAUgATYCBEECIQYgBUECOwEAIANB//8DcSIDIAJPDQEgBUECOwEYIAVBAjsBDCAFIAM2AgggBUEgaiACIANrIgI2AgAgBUEcaiABIANqNgIAIAVBFGpBATYCACAFQRBqQaruwgA2AgBBAyEGIAIgBE8NBSAEIAJrIQQMBAsgBUECOwEYIAVBADsBDCAFQQI2AgggBUGo7sIANgIEIAVBAjsBACAFQSBqIAI2AgAgBUEcaiABNgIAIAVBEGpBACAHayIBNgIAQQMhBiACIARPDQQgASAEIAJrIgJPDQQgAiAHaiEEDAMLIAVBADsBDCAFIAI2AgggBUEQaiADIAJrNgIAIARFDQMgBUECOwEYIAVBIGpBATYCACAFQRxqQaruwgA2AgAMAgtBjOvCAEEhQbDtwgAQhgIAC0HA7cIAQSFB5O3CABCGAgALIAVBADsBJCAFQShqIAQ2AgBBBCEGCyAAIAY2AgQgACAFNgIAC8wDAQZ/QQEhAgJAIAEoAgAiBkEnIAEoAgQoAhAiBxEAAA0AQYKAxAAhAkEwIQECQAJ/AkACQAJAAkACQAJAAkAgACgCACIADigIAQEBAQEBAQECBAEBAwEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEFAAsgAEHcAEYNBAsgABBuRQ0EIABBAXJnQQJ2QQdzDAULQfQAIQEMBQtB8gAhAQwEC0HuACEBDAMLIAAhAQwCC0GBgMQAIQIgABCWAQRAIAAhAQwCCyAAQQFyZ0ECdkEHcwshASAAIQILQQUhAwNAIAMhBSACIQRBgYDEACECQdwAIQACQAJAAkACQAJAAkBBAyAEQYCAxABrIARB///DAE0bQQFrDgMBBQACC0EAIQNB/QAhACAEIQICQAJAAkAgBUH/AXFBAWsOBQcFAAECBAtBAiEDQfsAIQAMBQtBAyEDQfUAIQAMBAtBBCEDQdwAIQAMAwtBgIDEACECIAEiAEGAgMQARw0DCyAGQScgBxEAACECDAQLIAVBASABGyEDQTBB1wAgBCABQQJ0dkEPcSIAQQpJGyAAaiEAIAFBAWtBACABGyEBCwsgBiAAIAcRAABFDQALQQEPCyACC9gCAQd/QQEhCQJAAkAgAkUNACABIAJBAXRqIQogAEGA/gNxQQh2IQsgAEH/AXEhDQNAIAFBAmohDCAHIAEtAAEiAmohCCALIAEtAAAiAUcEQCABIAtLDQIgCCEHIAwiASAKRg0CDAELAkACQCAHIAhNBEAgBCAISQ0BIAMgB2ohAQNAIAJFDQMgAkEBayECIAEtAAAgAUEBaiEBIA1HDQALQQAhCQwFCyAHIAhBxPzCABCYAwALIAggBEHE/MIAEJcDAAsgCCEHIAwiASAKRw0ACwsgBkUNACAFIAZqIQMgAEH//wNxIQEDQAJAIAVBAWohACAFLQAAIgLAIgRBAE4EfyAABSAAIANGDQEgBS0AASAEQf8AcUEIdHIhAiAFQQJqCyEFIAEgAmsiAUEASA0CIAlBAXMhCSADIAVHDQEMAgsLQa3rwgBBK0HU/MIAEIYCAAsgCUEBcQvrAgEFfyAAQQt0IQRBISEDQSEhAgJAA0ACQAJAQX8gA0EBdiABaiIDQQJ0QZiKwwBqKAIAQQt0IgUgBEcgBCAFSxsiBUEBRgRAIAMhAgwBCyAFQf8BcUH/AUcNASADQQFqIQELIAIgAWshAyABIAJJDQEMAgsLIANBAWohAQsCfwJAAn8CQCABQSBNBEAgAUECdCIDQZiKwwBqKAIAQRV2IQIgAUEgRw0BQdcFIQNBHwwCCyABQSFB+InDABDMAQALIANBnIrDAGooAgBBFXYhAyABRQ0BIAFBAWsLQQJ0QZiKwwBqKAIAQf///wBxDAELQQALIQECQCADIAJBf3NqRQ0AIAAgAWshBUHXBSACIAJB1wVNGyEEIANBAWshAEEAIQEDQAJAIAIgBEcEQCABIAJBnIvDAGotAABqIgEgBU0NAQwDCyAEQdcFQYiKwwAQzAEACyAAIAJBAWoiAkcNAAsgACECCyACQQFxC88CAgZ/AX4jAEHQAGsiAyQAIAEEQCABQSRsIABqIQRBfwJ/IAJDAAAAAGAiASACQwAAgE9dcQRAIAKpDAELQQALQQAgARsgAkP//39PXhtBCmwhBQNAIAAoAgghBiAAKAIMIQcgABDIAyIBKQIAIQkgAUIANwIAIANByABqIAFBEGoiCCgCADYCACADQUBrIAFBCGoiASkCADcDACAIQQA2AgAgAUKAgICAEDcCACADIAk3AzggA0EIaiAFQQEQggMgA0EQaiADQThqIAYgByADKAIIIAMoAgwQkAIgAEEYaiIBKAIABEAgAEEcaigCABA7CyAAIAMpAxA3AgAgAEEgaiADQTBqKAIANgIAIAEgA0EoaikDADcCACAAQRBqIANBIGopAwA3AgAgAEEIaiADQRhqKQMANwIAIABBJGoiACAERw0ACwsgA0HQAGokAAvoAgEGfyAAQQA2AggCQAJAAkAgAUEUaigCACIFIAJB//8DcSIDSwRAIAAoAgQiBiABQRBqKAIAIANBAXRqLwEAIgVJDQEgAUEIaigCACIGIANNDQIgBUUNAyABQQRqKAIAIQYgACgCACIIIAVqIQEgBUEBcQR/IAYgAkH//wNxIgNBAnRqIgcvAQAhBCABQQFrIgEgBy0AAjoAACADIAQgAyAESRsFIAILIQMgBUEBRwRAIAFBAmshAQNAIAYgA0H//wNxQQJ0aiIDLwEAIQQgAUEBaiADLQACOgAAIAYgAkH//wNxIgMgBCADIARJG0ECdGoiBy8BACEEIAEgBy0AAjoAACADIAQgAyAESRshAyABIAhGIAFBAmshAUUNAAsLIAAgBTYCDCAILQAADwsgAyAFQbC0wgAQzAEACyAFIAZBwLTCABCXAwALIANBAWogBkGAtcIAEJcDAAtBAEEAQZC1wgAQzAEAC4cDAQJ/IwBBMGsiAiQAAn8CQAJAAkACQEEBIAAtAAAiA0EfayADQR5NG0H/AXFBAWsOAwECAwALIAIgAEEEajYCDCACQSRqQQE2AgAgAkEsakEBNgIAIAJB6NXAADYCICACQQA2AhggAkGsATYCFCACIAJBEGo2AiggAiACQQxqNgIQIAEgAkEYahDnAQwDCyACIAA2AgwgAkEkakEBNgIAIAJBLGpBATYCACACQejVwAA2AiAgAkEANgIYIAJBrQE2AhQgAiACQRBqNgIoIAIgAkEMajYCECABIAJBGGoQ5wEMAgsgAiAAQQRqNgIIIAJBJGpBATYCACACQSxqQQE2AgAgAkHo1cAANgIgIAJBADYCGCACQa4BNgIUIAIgAkEQajYCKCACIAJBDGo2AhAgAiACQQhqNgIMIAEgAkEYahDnAQwBCyACQSRqQQE2AgAgAkEsakEANgIAIAJB4NXAADYCICACQZDVwAA2AiggAkEANgIYIAEgAkEYahDnAQsgAkEwaiQAC4UDAgV/An4jAEFAaiIFJABBASEHAkAgAC0ABA0AIAAtAAUhCSAAKAIAIgYoAhgiCEEEcUUEQCAGKAIAQeHxwgBB4/HCACAJG0ECQQMgCRsgBigCBCgCDBECAA0BIAYoAgAgASACIAYoAgQoAgwRAgANASAGKAIAQazxwgBBAiAGKAIEKAIMEQIADQEgAyAGIAQoAgwRAAAhBwwBCyAJRQRAIAYoAgBB3PHCAEEDIAYoAgQoAgwRAgANASAGKAIYIQgLIAVBAToAFyAFQcDxwgA2AhwgBSAGKQIANwMIIAUgBUEXajYCECAGKQIIIQogBikCECELIAUgBi0AIDoAOCAFIAYoAhw2AjQgBSAINgIwIAUgCzcDKCAFIAo3AyAgBSAFQQhqIgg2AhggCCABIAIQYQ0AIAVBCGpBrPHCAEECEGENACADIAVBGGogBCgCDBEAAA0AIAUoAhhB3/HCAEECIAUoAhwoAgwRAgAhBwsgAEEBOgAFIAAgBzoABCAFQUBrJAAgAAvXAgECfyMAQRBrIgIkACAAKAIAIQACQAJ/AkAgAUGAAU8EQCACQQA2AgwgAUGAEE8NASACIAFBP3FBgAFyOgANIAIgAUEGdkHAAXI6AAxBAgwCCyAAKAIIIgMgACgCAEYEfyAAIAMQpAEgACgCCAUgAwsgACgCBGogAToAACAAIAAoAghBAWo2AggMAgsgAUGAgARPBEAgAiABQT9xQYABcjoADyACIAFBBnZBP3FBgAFyOgAOIAIgAUEMdkE/cUGAAXI6AA0gAiABQRJ2QQdxQfABcjoADEEEDAELIAIgAUE/cUGAAXI6AA4gAiABQQx2QeABcjoADCACIAFBBnZBP3FBgAFyOgANQQMLIQEgASAAKAIAIAAoAggiA2tLBEAgACADIAEQogEgACgCCCEDCyAAKAIEIANqIAJBDGogARDCAxogACABIANqNgIICyACQRBqJABBAAvXAgECfyMAQRBrIgIkACAAKAIAIQACQAJ/AkAgAUGAAU8EQCACQQA2AgwgAUGAEE8NASACIAFBP3FBgAFyOgANIAIgAUEGdkHAAXI6AAxBAgwCCyAAKAIIIgMgACgCAEYEfyAAIAMQpQEgACgCCAUgAwsgACgCBGogAToAACAAIAAoAghBAWo2AggMAgsgAUGAgARPBEAgAiABQT9xQYABcjoADyACIAFBBnZBP3FBgAFyOgAOIAIgAUEMdkE/cUGAAXI6AA0gAiABQRJ2QQdxQfABcjoADEEEDAELIAIgAUE/cUGAAXI6AA4gAiABQQx2QeABcjoADCACIAFBBnZBP3FBgAFyOgANQQMLIQEgASAAKAIAIAAoAggiA2tLBEAgACADIAEQowEgACgCCCEDCyAAKAIEIANqIAJBDGogARDCAxogACABIANqNgIICyACQRBqJABBAAuUBAEFfyMAQRBrIgMkACAAKAIAIQACQAJ/AkAgAUGAAU8EQCADQQA2AgwgAUGAEE8NASADIAFBP3FBgAFyOgANIAMgAUEGdkHAAXI6AAxBAgwCCyAAKAIIIgIgACgCAEYEQCMAQSBrIgQkAAJAAkAgAkEBaiICRQ0AQQggACgCACIFQQF0IgYgAiACIAZJGyICIAJBCE0bIgJBf3NBH3YhBgJAIAUEQCAEQQE2AhggBCAFNgIUIAQgAEEEaigCADYCEAwBCyAEQQA2AhgLIAQgAiAGIARBEGoQsQEgBCgCBCEFIAQoAgBFBEAgACACNgIAIAAgBTYCBAwCCyAEQQhqKAIAIgJBgYCAgHhGDQEgAkUNACAFIAIQvAMACxCWAgALIARBIGokACAAKAIIIQILIAAgAkEBajYCCCAAKAIEIAJqIAE6AAAMAgsgAUGAgARPBEAgAyABQT9xQYABcjoADyADIAFBBnZBP3FBgAFyOgAOIAMgAUEMdkE/cUGAAXI6AA0gAyABQRJ2QQdxQfABcjoADEEEDAELIAMgAUE/cUGAAXI6AA4gAyABQQx2QeABcjoADCADIAFBBnZBP3FBgAFyOgANQQMLIQEgASAAKAIAIAAoAggiAmtLBEAgACACIAEQpgEgACgCCCECCyAAKAIEIAJqIANBDGogARDCAxogACABIAJqNgIICyADQRBqJABBAAvQAgECfyMAQRBrIgIkAAJAAn8CQCABQYABTwRAIAJBADYCDCABQYAQTw0BIAIgAUE/cUGAAXI6AA0gAiABQQZ2QcABcjoADEECDAILIAAoAggiAyAAKAIARgR/IAAgAxCkASAAKAIIBSADCyAAKAIEaiABOgAAIAAgACgCCEEBajYCCAwCCyABQYCABE8EQCACIAFBP3FBgAFyOgAPIAIgAUEGdkE/cUGAAXI6AA4gAiABQQx2QT9xQYABcjoADSACIAFBEnZBB3FB8AFyOgAMQQQMAQsgAiABQT9xQYABcjoADiACIAFBDHZB4AFyOgAMIAIgAUEGdkE/cUGAAXI6AA1BAwshASABIAAoAgAgACgCCCIDa0sEQCAAIAMgARCiASAAKAIIIQMLIAAoAgQgA2ogAkEMaiABEMIDGiAAIAEgA2o2AggLIAJBEGokAEEAC9ACAQJ/IwBBEGsiAiQAAkACfwJAIAFBgAFPBEAgAkEANgIMIAFBgBBPDQEgAiABQT9xQYABcjoADSACIAFBBnZBwAFyOgAMQQIMAgsgACgCCCIDIAAoAgBGBH8gACADEKUBIAAoAggFIAMLIAAoAgRqIAE6AAAgACAAKAIIQQFqNgIIDAILIAFBgIAETwRAIAIgAUE/cUGAAXI6AA8gAiABQQZ2QT9xQYABcjoADiACIAFBDHZBP3FBgAFyOgANIAIgAUESdkEHcUHwAXI6AAxBBAwBCyACIAFBP3FBgAFyOgAOIAIgAUEMdkHgAXI6AAwgAiABQQZ2QT9xQYABcjoADUEDCyEBIAEgACgCACAAKAIIIgNrSwRAIAAgAyABEKMBIAAoAgghAwsgACgCBCADaiACQQxqIAEQwgMaIAAgASADajYCCAsgAkEQaiQAQQAL7wIBAX8jAEEwayICJAACfwJAAkACQAJAIAAtAABBAWsOAwECAwALIAIgAEEBajYCDCACQSRqQQE2AgAgAkEsakEBNgIAIAJBzMvAADYCICACQQA2AhggAkGAATYCFCACIAJBEGo2AiggAiACQQxqNgIQIAEgAkEYahDnAQwDCyACIABBBGo2AgwgAkEkakECNgIAIAJBLGpBATYCACACQbzLwAA2AiAgAkEANgIYIAJBgQE2AhQgAiACQRBqNgIoIAIgAkEMajYCECABIAJBGGoQ5wEMAgsgAiAAQQRqNgIMIAJBJGpBAjYCACACQSxqQQE2AgAgAkGsy8AANgIgIAJBADYCGCACQYIBNgIUIAIgAkEQajYCKCACIAJBDGo2AhAgASACQRhqEOcBDAELIAJBJGpBATYCACACQSxqQQA2AgAgAkGgy8AANgIgIAJBuMTAADYCKCACQQA2AhggASACQRhqEOcBCyACQTBqJAALvAIBBn4gAEEIaikDACICIAE1AABCgICAgICAgIAEhCIDhULzytHLp4zZsvQAhSIEQhCJIAQgACkDACIFQuHklfPW7Nm87ACFfCIEhSIGIAJC7d6R85bM3LfkAIUiAiAFQvXKzYPXrNu38wCFfCIFQiCJfCIHIAOFIAQgAkINiSAFhSICfCIDIAJCEYmFIgJ8IgQgAkINiYUiAiAGQhWJIAeFIgUgA0IgiUL/AYV8IgN8IgYgAkIRiYUiAkINiSACIAVCEIkgA4UiAyAEQiCJfCIEfCIChSIFQhGJIAUgA0IViSAEhSIDIAZCIIl8IgR8IgWFIgZCDYkgBiADQhCJIASFIgMgAkIgiXwiAnyFIgQgA0IViSAChSICIAVCIIl8IgN8IgUgAkIQiSADhUIViYUgBEIRiYUgBUIgiYULwAICBX8BfiMAQTBrIgUkAEEnIQMCQCAAQpDOAFQEQCAAIQgMAQsDQCAFQQlqIANqIgRBBGsgACAAQpDOAIAiCEKQzgB+faciBkH//wNxQeQAbiIHQQF0Qa7ywgBqLwAAOwAAIARBAmsgBiAHQeQAbGtB//8DcUEBdEGu8sIAai8AADsAACADQQRrIQMgAEL/wdcvViAIIQANAAsLIAinIgRB4wBLBEAgA0ECayIDIAVBCWpqIAinIgQgBEH//wNxQeQAbiIEQeQAbGtB//8DcUEBdEGu8sIAai8AADsAAAsCQCAEQQpPBEAgA0ECayIDIAVBCWpqIARBAXRBrvLCAGovAAA7AAAMAQsgA0EBayIDIAVBCWpqIARBMGo6AAALIAIgAUG81sIAQQAgBUEJaiADakEnIANrEEcgBUEwaiQAC8ECAgt/AX4CQAJAAkACQCACIAAoAgAgACgCCCIEa0sEQCAAIAQgAhCbASAAKAIIIQQMAQsgAkUNAQsgASACQSRsaiEIIAAoAgQgBEEkbGohCQNAIAEgBmoiAigCACEKIAJBHGooAgAhByACQQxqKAIAIQsgAkEIaigCACEMIAJBBGooAgAhDUEBIQMgAkEgaigCACIFBEAgBUEASA0DIAVBARD+AiIDRQ0ECyADIAcgBRDCAyEHIAJBEGopAgAhDiAGIAlqIgNBBGogDTYCACADQQhqIAw2AgAgA0EMaiALNgIAIANBIGogBTYCACADQRxqIAc2AgAgA0EYaiAFNgIAIANBEGogDjcCACADIAo2AgAgBkEkaiEGIARBAWohBCACQSRqIAhHDQALCyAAIAQ2AggPCxCWAgALIAVBARC8AwALxQIBCX8gAEEAOgA5IAAgAC8BNiIIOwE0IABBGGpBADYCACAAQTBqIgQoAgAiA0EBIAAtADgiBXQiBkECaiIBTwRAIAQgATYCACABIQMLIABBJGooAgAEQCAAQQE2AiQLAkAgASADTQRAIABBLGooAgAiBCECQQIgBXRBAmoiCUEBdkEBakEHcSIHBEADQCACQYDAADsBACACQQJqIQIgB0EBayIHDQALCyAJQQ5PBEAgBCABQQF0aiEBA0AgAkKAwICAgoCIgCA3AQAgAkEIakKAwICAgoCIgCA3AQAgAkEQaiICIAFHDQALCyADIAZNDQEgACAFQQFqIgE6AAggACABOgAJIAQgBkEBdGpBADsBACAAIAitQv//A4MgBUF/c0E/ca2GNwMADwsgASADQZi3wgAQlwMACyAGIANBqLfCABDMAQALwQIBA38jAEGAAWsiBCQAAkACQAJAAkAgASgCGCICQRBxRQRAIAJBIHENASAANQIAQQEgARB6IQAMBAsgACgCACEAQQAhAgNAIAIgBGpB/wBqQTBB1wAgAEEPcSIDQQpJGyADajoAACACQQFrIQIgAEEPSyAAQQR2IQANAAsgAkGAAWoiAEGBAU8NASABQQFBrPLCAEECIAIgBGpBgAFqQQAgAmsQRyEADAMLIAAoAgAhAEEAIQIDQCACIARqQf8AakEwQTcgAEEPcSIDQQpJGyADajoAACACQQFrIQIgAEEPSyAAQQR2IQANAAsgAkGAAWoiAEGBAU8NASABQQFBrPLCAEECIAIgBGpBgAFqQQAgAmsQRyEADAILIABBgAFBnPLCABCWAwALIABBgAFBnPLCABCWAwALIARBgAFqJAAgAAvAAgEKfyABKAIEIQcgASgCACELIAMoAgghDCADKAIEIQQCQAJAA0AgAiEGIAcgC00NASABIAdBAWsiBzYCBCAMKAIALQAAIgpFDQJBACEDIARBADYCHCAEQgA3AhQgBCAHNgIQIARBAToADCAEQoCAgICAATcCACAEIApBAWsiDTYCCAJAIAZFBEBBACEFDAELQQAhAkEAIQUDQAJAAkAgBUUEQCAEQQA6AAwgAkEHTA0BQQEhBQwECyACIA1qIgUgAk4hCCAEIAIgCmoiAkEIIAggBUEISHEiCBs2AgBBASEFIAgNAQwDCyAEIAJBAWoiAjYCAAtBASEFIAYgA0EBaiIDRw0AC0EAIQUgBiEDCyAGIANrIQIgBQ0AC0EBIQkLIAAgBjYCBCAAIAk2AgAPC0G0/MAAQRtBqP3AABCGAgALuwIBCX8gAEEAOgA5IAAgAC8BNiIIOwE0IABBGGpBADYCACAAQTBqIgQoAgAiA0EBIAAtADgiBnQiBUECaiIBTwRAIAQgATYCACABIQMLIABBJGooAgAEQCAAQQE2AiQLAkAgASADTQRAIABBLGooAgAiBCECQQIgBnRBAmoiCUEBdkEBakEHcSIHBEADQCACQYDAADsBACACQQJqIQIgB0EBayIHDQALCyAJQQ5PBEAgBCABQQF0aiEBA0AgAkKAwICAgoCIgCA3AQAgAkEIakKAwICAgoCIgCA3AQAgAkEQaiICIAFHDQALCyADIAVNDQEgACAIrUL//wODNwMAIAAgBkEBaiIBOgAIIAAgAToACSAEIAVBAXRqQQA7AQAPCyABIANBmLfCABCXAwALIAUgA0Got8IAEMwBAAu8AgEFfyAAKAIYIQMCQAJAIAAgACgCDEYEQCAAQRRBECAAQRRqIgEoAgAiBBtqKAIAIgINAUEAIQEMAgsgACgCCCICIAAoAgwiATYCDCABIAI2AggMAQsgASAAQRBqIAQbIQQDQCAEIQUgAiIBQRRqIgIgAUEQaiACKAIAIgIbIQQgAUEUQRAgAhtqKAIAIgINAAsgBUEANgIACwJAIANFDQACQCAAIAAoAhxBAnRBsJTDAGoiAigCAEcEQCADQRBBFCADKAIQIABGG2ogATYCACABRQ0CDAELIAIgATYCACABDQBBzJfDAEHMl8MAKAIAQX4gACgCHHdxNgIADwsgASADNgIYIAAoAhAiAgRAIAEgAjYCECACIAE2AhgLIABBFGooAgAiAEUNACABQRRqIAA2AgAgACABNgIYCwu+BAEFfyMAQfAAayICJAAgACgCACEAIAJBxABqQeT2wAA2AgAgAkE8akHU9sAANgIAIAJBNGpBxPbAADYCACACQSxqQcT2wAA2AgAgAkEkakHU9MAANgIAIAJBHGpB1PTAADYCACACQRRqQdT0wAA2AgAgAkEMakHU9MAANgIAIAIgADYCTCACIABBBGo2AlAgAiAAQQhqNgJUIAIgAEEMajYCWCACIABBEGo2AlwgAiAAQRRqNgJgIAIgAEEWajYCZCACIABBGGo2AmggAkHU9MAANgIEIAIgAEEZajYCbCACIAJB7ABqNgJAIAIgAkHoAGo2AjggAiACQeQAajYCMCACIAJB4ABqNgIoIAIgAkHcAGo2AiAgAiACQdgAajYCGCACIAJB1ABqNgIQIAIgAkHQAGo2AgggAiACQcwAajYCACACIQBBCSEFQfz1wAAhBCMAQSBrIgMkACADQQk2AgAgA0EJNgIEIAEoAgBB9PbAAEEMIAEoAgQoAgwRAgAhBiADQQA6AA0gAyAGOgAMIAMgATYCCAJ/A0AgA0EIaiAEKAIAIARBBGooAgAgAEGc9cIAEHIhASAAQQhqIQAgBEEIaiEEIAVBAWsiBQ0ACyADLQAMIgAgAy0ADUUNABpBASAADQAaIAEoAgAiAC0AGEEEcUUEQCAAKAIAQefxwgBBAiAAKAIEKAIMEQIADAELIAAoAgBB5vHCAEEBIAAoAgQoAgwRAgALIANBIGokAEH/AXFBAEcgAkHwAGokAAuUAgIEfwF9IwBBIGsiBCQAIAEEQAJ/IAAQyAMoAgCzIAKUEO4CIgdDAACAT10gB0MAAAAAYCIDcQRAIAepDAELQQALQQAgAxshAyAAEMgDKAIEsyAClBDuAiICQwAAAABgIQVBfyADIAdD//9/T14bIQZBfwJ/IAJDAACAT10gAkMAAAAAYHEEQCACqQwBC0EAC0EAIAUbIAJD//9/T14bIQUgAUEkbCEDA0AgBEEIaiAAEMgDIAYgBRApIAAQyAMiASgCCARAIAFBDGooAgAQOwsgAEEkaiEAIAEgBCkDCDcCACABQRBqIARBGGooAgA2AgAgAUEIaiAEQRBqKQMANwIAIANBJGsiAw0ACwsgBEEgaiQAC9ECAgR/An4jAEFAaiIDJAAgAAJ/IAAtAAgEQCAAKAIAIQVBAQwBCyAAKAIAIQUgAEEEaigCACIEKAIYIgZBBHFFBEBBASAEKAIAQeHxwgBB6/HCACAFG0ECQQEgBRsgBCgCBCgCDBECAA0BGiABIAQgAigCDBEAAAwBCyAFRQRAIAQoAgBB6fHCAEECIAQoAgQoAgwRAgAEQEEAIQVBAQwCCyAEKAIYIQYLIANBAToAFyADQcDxwgA2AhwgAyAEKQIANwMIIAMgA0EXajYCECAEKQIIIQcgBCkCECEIIAMgBC0AIDoAOCADIAQoAhw2AjQgAyAGNgIwIAMgCDcDKCADIAc3AyAgAyADQQhqNgIYQQEgASADQRhqIAIoAgwRAAANABogAygCGEHf8cIAQQIgAygCHCgCDBECAAs6AAggACAFQQFqNgIAIANBQGskACAAC6MCAQR/IABCADcCECAAAn9BACABQYACSQ0AGkEfIAFB////B0sNABogAUEGIAFBCHZnIgJrdkEBcSACQQF0a0E+agsiAzYCHCADQQJ0QbCUwwBqIQICQAJAAkACQEHMl8MAKAIAIgRBASADdCIFcQRAIAIoAgAhAiADEOwCIQMgAhC4AyABRw0BIAIhAwwCC0HMl8MAIAQgBXI2AgAgAiAANgIADAMLIAEgA3QhBANAIAIgBEEddkEEcWpBEGoiBSgCACIDRQ0CIARBAXQhBCADIgIQuAMgAUcNAAsLIAMoAggiASAANgIMIAMgADYCCCAAIAM2AgwgACABNgIIIABBADYCGA8LIAUgADYCAAsgACACNgIYIAAgADYCCCAAIAA2AgwLvQIBBX8jAEEQayIDJAAQECEFIAEoAgAiAiAFEBEhASADQQhqELoCIAMoAgwgASADKAIIIgQbIQECQAJAAkACQCAERQRAIAEQC0EBRg0BIABBAjoABCABQYQBSQ0CIAEQAAwCCyAAQQM6AAQgACABNgIADAELIAEgAhASIQIgAxC6AiADKAIEIAIgAygCACIEGyECAkACQAJAAkAgBEUEQCACEAVBAUcNAyACEAwiBBALIQYgBEGEAUkNASAEEAAgBkEBRg0CDAMLIABBAzoABCAAIAI2AgAMAwsgBkEBRw0BCyAAQQA6AAQgACACNgIAIAFBhAFPBEAgARAACyAFQYMBSw0DDAQLIABBAjoABCACQYQBSQ0AIAIQAAsgAUGEAUkNACABEAALIAVBgwFNDQELIAUQAAsgA0EQaiQAC6UCAQV/IwBBMGsiAiQAIAACfwJAIAFBEGooAgAEQCACQRhqIAFBCGoQkwIgAigCGA0BCyAAQQhqQQA2AgBBAAwBCyACQRBqIAIoAhwQ+AEgAigCFCEFIAIoAhAhAyABIAEoAhRBAWo2AhQgAUEEaiEEAkAgASgCAEUNACAEKAIAIgZBhAFJDQAgBhAACyABQQE2AgAgBCAFNgIAIAIgAyIBNgIkIAJBCGogARABAkAgAigCCCIEBEAgAigCDCEDDAELIAJBJGogAkEoakGUi8AAEF4hA0EAIQQgAigCJCEBCyABQYQBTwRAIAEQAAsgBARAIAAgAzYCBCAAQQxqIAM2AgAgAEEIaiAENgIAQQAMAQsgACADNgIEQQELNgIAIAJBMGokAAuVAgEBfyMAQRBrIgIkACAAKAIAIQACfwJAIAEoAghBAUcEQCABKAIQQQFHDQELIAJBADYCDCABIAJBDGoCfyAAQYABTwRAIABBgBBPBEAgAEGAgARPBEAgAiAAQT9xQYABcjoADyACIABBEnZB8AFyOgAMIAIgAEEGdkE/cUGAAXI6AA4gAiAAQQx2QT9xQYABcjoADUEEDAMLIAIgAEE/cUGAAXI6AA4gAiAAQQx2QeABcjoADCACIABBBnZBP3FBgAFyOgANQQMMAgsgAiAAQT9xQYABcjoADSACIABBBnZBwAFyOgAMQQIMAQsgAiAAOgAMQQELEEEMAQsgASgCACAAIAEoAgQoAhARAAALIAJBEGokAAtgAQx/QbiVwwAoAgAiAgRAQbCVwwAhBgNAIAIiASgCCCECIAEoAgQhAyABKAIAIQQgAUEMaigCABogASEGIAVBAWohBSACDQALC0Hwl8MAQf8fIAUgBUH/H00bNgIAIAgLygIBBX8jAEEwayICJAADQEGCgMQAIQZBMCEDAkACQAJAAkACQAJAAkACQAJAIAAgBWotAAAiBA4oCAYGBgYGBgYGAAIGBgEGBgYGBgYGBgYGBgYGBgYGBgYGBgQGBgYGAwULQfQAIQMMBwtB8gAhAwwGC0HuACEDDAULQSchAwwEC0EiIQMMAwsgBEHcAEYNAQsgBBBuBH8gBEEBcmdBAnZBB3MFQYGAxAAhBiAEEJYBBEAgBCEDDAMLIARBAXJnQQJ2QQdzCyEDIAQhBgwBC0HcACEDCyACQQU2AiggAiAGNgIkIAIgAzYCICACQcwBNgIcIAJBATYCDCACQdj6wAA2AgggAkEBNgIUIAJBADYCACACIAJBIGo2AhggAiACQRhqNgIQIAEgAhDnASIERQRAIAVBA0cgBUEBaiEFDQELCyACQTBqJAAgBAufAgEDfwJAIAFBQGsoAgBBAkcEQAJ/AkAgASgCoAMiAgRAIAJBAXFFIAFB+AFqLQAAIgNBEEdyDQEgAkEQcSECQQgMAgsgAUH4AWotAAAhAiABLQD5ASEBDAMLQQggAyADQQdNGyADIAJBEHEiAhsLAkAgAkUEQCABLQD5ASEBDAELIAEtAPkBIgJBHXRBHXVBAEgEQCACIQEMAQsgASgCECEDAkACQAJAAkAgAkEBaw4DAgEDAAtBBCEBIANBAkYNAQwDC0EGIQEgA0ECRw0CCyACIQEMAQtBAkEGIANBAkYbIQELENUCQf8BcSICDQFBhJzAAEErQbCcwAAQhgIAC0GEnMAAQStB5J7AABCGAgALIAAgAjoAASAAIAE6AAAL/AECBX8BfiMAQdAAayIBJAAgACgCCCEDIAAoAgwhBCAAEMgDIgIpAgAhBiACQgA3AgAgAUHIAGogAkEQaiIFKAIANgIAIAFBQGsgAkEIaiICKQIANwMAIAVBADYCACACQoCAgIAQNwIAIAEgBjcDOCABQQhqQRRBARCCAyABQRBqIAFBOGogAyAEIAEoAgggASgCDBCQAiAAQRhqIgIoAgAEQCAAQRxqKAIAEDsLIAAgASkDEDcCACAAQSBqIAFBMGooAgA2AgAgAiABQShqKQMANwIAIABBEGogAUEgaikDADcCACAAQQhqIAFBGGopAwA3AgAgAUHQAGokAAvEAgEEfyMAQeDRAGsiAiQAAkACQEHo1QBBBBD+AiIBBEAgAUIANwKIUiABQZDSAGpBADYCACACEI8DIAJBoBtqEI8DIAJBwDZqEI8DIAFBgNIAakIANwIAIAFB+NEAakIANwIAIAFB8NEAakIANwIAIAFB6NEAakIANwIAIAFCADcC4FEgAUEANgKUUiABQZzSAGpBAEHKAxDAAxogASACQeDRABDCAyIBQQA2AphSQYCAAkEBEP4CIgNFDQFBgIAEQQEQ/wIiBEUNAiAAQQA6ACQgACABNgIIIABBgIACNgIMIABCADcCACAAQSBqQYCABDYCACAAQRxqIAQ2AgAgAEEUakKAgICAgIDAADcCACAAQRBqIAM2AgAgAkHg0QBqJAAPC0Ho1QBBBBC8AwALQYCAAkEBELwDAAtBgIAEQQEQvAMAC4ICAQh/IAEoAgQiA0EIaiICKAIAIgQhBSADKAIAIARrQf8fTQRAIAMgBEGAIBCiASACKAIAIQULAkAgBSAEQYAgaiIGTwRAIAYhAgwBCyAGIAUiAmsiByADKAIAIAJrSwRAIAMgBSAHEKIBIANBCGooAgAhAgsgAygCBCIJIAJqIQgCQCAHQQJPBEAgCEEAIAdBAWsiBRDAAxogCSACIAVqIgJqIQgMAQsgBSAGRg0BCyAIQQA6AAAgAkEBaiECCyADQQhqIAI2AgAgAiAESQRAIAQgAkG8tsIAEJYDAAsgACABKAIANgIIIAAgAiAEazYCBCAAIANBBGooAgAgBGo2AgALgwIBBn8jAEEQayIEJAACQAJAIAFBQGsoAgBBAkcEQCABKAKgAyEDQRBBCCABQfgBai0AACIHQRBGGyEGIAEoAhAhBQJAAkACQAJAIAEtAPkBIggOBQAFAQIDBQsgA0EQcUUNBCAFQQJHQQJ0IANBAnZxIQEMBQsgA0EQcUUNA0EGIQEgBUECRw0EDAMLIANBEHEiAUUNAkECQQYgBUECRhtBAiABGyEBDAMLQQQhASADQRBxRQ0BDAILQYScwABBK0HknsAAEIYCAAsgCCEBIAchBgsgBEEIaiABIAYgAhCLAiAEKAIMIQEgACAEKAIINgIAIAAgAUEBazYCBCAEQRBqJAALiwICA38BfiMAQTBrIgIkACABKAIERQRAIAEoAgwhAyACQRBqIgRBADYCACACQoCAgIAQNwMIIAIgAkEIajYCFCACQShqIANBEGopAgA3AwAgAkEgaiADQQhqKQIANwMAIAIgAykCADcDGCACQRRqQYy9wgAgAkEYahBPGiABQQhqIAQoAgA2AgAgASACKQMINwIACyABKQIAIQUgAUKAgICAEDcCACACQSBqIgMgAUEIaiIBKAIANgIAIAFBADYCACACIAU3AxhBDEEEEP4CIgFFBEBBDEEEELwDAAsgASACKQMYNwIAIAFBCGogAygCADYCACAAQbjGwgA2AgQgACABNgIAIAJBMGokAAuCAgEEfwJAIAEoAgAiBQRAIANBA24iBhDtASEHIAZBA2wiBCADSw0BIAQgAUEAIAUbIgUoAgAiAygCACADKAIIIgFrSwRAIAMgASAEEKIBIAMoAgghAQsgAygCBCABaiACIAQQwgMaIAMgASAEajYCCCAGQQIgB3QiAUcEQCABIAZrIQMDQCAFKAIAIgEoAgAgASgCCCICa0ECTQRAIAEgAkEDEKIBIAEoAgghAgsgASgCBCACaiIEQQA7AAAgBEECakEAOgAAIAEgAkEDajYCCCADQQFrIgMNAAsLIABBBToAAA8LQeCfwABBK0GQocAAEIYCAAsgBCADQYChwAAQlwMAC+UBAQF/IwBBEGsiAiQAIAAoAgAgAkEANgIMIAJBDGoCfyABQYABTwRAIAFBgBBPBEAgAUGAgARPBEAgAiABQT9xQYABcjoADyACIAFBBnZBP3FBgAFyOgAOIAIgAUEMdkE/cUGAAXI6AA0gAiABQRJ2QQdxQfABcjoADEEEDAMLIAIgAUE/cUGAAXI6AA4gAiABQQx2QeABcjoADCACIAFBBnZBP3FBgAFyOgANQQMMAgsgAiABQT9xQYABcjoADSACIAFBBnZBwAFyOgAMQQIMAQsgAiABOgAMQQELEGEgAkEQaiQAC44CAQJ/IwBBIGsiAiQAAn8gACgCACIDLQAARQRAIAEoAgBBsInDAEEEIAEoAgQoAgwRAgAMAQtBASEAIAIgA0EBajYCDCACIAEoAgBBrInDAEEEIAEoAgQoAgwRAgA6ABggAiABNgIUIAJBADoAGSACQQA2AhAgAkEQaiACQQxqQfDxwgAQgwEhAyACLQAYIQECQCADKAIAIgNFBEAgASEADAELIAENACACKAIUIQECQCADQQFHDQAgAi0AGUUNACABLQAYQQRxDQAgASgCAEHs8cIAQQEgASgCBCgCDBECAA0BCyABKAIAQezuwgBBASABKAIEKAIMEQIAIQALIABB/wFxQQBHCyACQSBqJAAL8AECAn8CfiMAQdAAayICJAACQAJAAkADQCABKAJAQQJHDQIgAkEANgJIIAJCgICAgBA3A0AgAkEgaiABIAJBQGsQTiACLQA5IgNBDkYNASACKAJABEAgAigCRBA7CyADQQ1HDQALIAJBAjoAICAAIAJBIGoQsgIMAgsgAkEQaiACQTBqKAIAIgE2AgAgAkEIaiACQShqKQMAIgQ3AwAgAiACKQMgIgU3AwAgAEEQaiABNgIAIABBCGogBDcCACAAIAU3AgAgAigCQEUNASACKAJEEDsMAQsgAEEjOgAAIAAgAUEQajYCBAsgAkHQAGokAAviAQEBfyMAQRBrIgIkACACQQA2AgwgACACQQxqAn8gAUGAAU8EQCABQYAQTwRAIAFBgIAETwRAIAIgAUE/cUGAAXI6AA8gAiABQQZ2QT9xQYABcjoADiACIAFBDHZBP3FBgAFyOgANIAIgAUESdkEHcUHwAXI6AAxBBAwDCyACIAFBP3FBgAFyOgAOIAIgAUEMdkHgAXI6AAwgAiABQQZ2QT9xQYABcjoADUEDDAILIAIgAUE/cUGAAXI6AA0gAiABQQZ2QcABcjoADEECDAELIAIgAToADEEBCxBhIAJBEGokAAv6AQEBfyACIANrIAVxIQMCQAJAAkACQAJAAkAgBEEDRgRAIAEgA00NASABIAJNDQIgACACaiAAIANqLQAAOgAAIANBAWogBXEiBCABTw0DIAJBAWoiBiABTw0EIAAgBmogACAEai0AADoAACADQQJqIAVxIgMgAU8NBSACQQJqIgIgAU8NBiAAIAJqIAAgA2otAAA6AAAPCyAAIAEgAyACIAQgBRBJDwsgAyABQdCQwQAQzAEACyACIAFB4JDBABDMAQALIAQgAUHwkMEAEMwB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IAEgASAESRsiASABQQhNGyIBQX9zQR92IQQCQCACBEAgA0EBNgIYIAMgAjYCFCADIABBBGooAgA2AhAMAQsgA0EANgIYCyADIAEgBCADQRBqELEBIAMoAgQhAiADKAIARQRAIAAgATYCACAAQQRqIAI2AgAMAgsgA0EIaigCACIAQYGAgIB4Rg0BIABFDQAgAiAAELwDAAsQlgIACyADQSBqJAALzwEBAn8jAEEgayIDJAACQAJAIAEgASACaiIBSw0AQQggACgCACICQQF0IgQgASABIARJGyIBIAFBCE0bIgFBf3NBH3YhBAJAIAIEQCADQQE2AhggAyACNgIUIAMgAEEEaigCADYCEAwBCyADQQA2AhgLIAMgASAEIANBEGoQrQEgAygCBCECIAMoAgBFBEAgACABNgIAIABBBGogAjYCAAwCCyADQQhqKAIAIgBBgYCAgHhGDQEgAEUNACACIAAQvAMACxCWAgALIANBIGokAAvNAQEDfyMAQSBrIgIkAAJAAkAgAUEBaiIBRQ0AQQggACgCACIDQQF0IgQgASABIARJGyIBIAFBCE0bIgFBf3NBH3YhBAJAIAMEQCACQQE2AhggAiADNgIUIAIgAEEEaigCADYCEAwBCyACQQA2AhgLIAIgASAEIAJBEGoQsQEgAigCBCEDIAIoAgBFBEAgACABNgIAIABBBGogAzYCAAwCCyACQQhqKAIAIgBBgYCAgHhGDQEgAEUNACADIAAQvAMACxCWAgALIAJBIGokAAvNAQEDfyMAQSBrIgIkAAJAAkAgAUEBaiIBRQ0AQQggACgCACIDQQF0IgQgASABIARJGyIBIAFBCE0bIgFBf3NBH3YhBAJAIAMEQCACQQE2AhggAiADNgIUIAIgAEEEaigCADYCEAwBCyACQQA2AhgLIAIgASAEIAJBEGoQrQEgAigCBCEDIAIoAgBFBEAgACABNgIAIABBBGogAzYCAAwCCyACQQhqKAIAIgBBgYCAgHhGDQEgAEUNACADIAAQvAMACxCWAgALIAJBIGokAAvMAQECfyMAQSBrIgMkAAJAAkAgASABIAJqIgFLDQBBCCAAKAIAIgJBAXQiBCABIAEgBEkbIgEgAUEITRsiAUF/c0EfdiEEAkAgAgRAIANBATYCGCADIAI2AhQgAyAAQQRqKAIANgIQDAELIANBADYC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CyABKAIAQezuwgBBASABKAIEKAIMEQIACyAFQRBqJABB/wFxQQBHC7oBAgF+A38CQCABKAIYIgVFDQACQCABKQMAIgJQBEAgASgCECEEIAEoAgghAwNAIARBIGshBCADKQMAIANBCGohA0J/hUKAgYKEiJCgwIB/gyICUA0ACyABIAQ2AhAgASADNgIIIAEgAkIBfSACgzcDAAwBCyABIAJCAX0gAoM3AwAgASgCECIERQ0BCyABIAVBAWs2AhhBASEDIAAgBCACeqdBAXZBPHFrQQRrKAAANgABCyAAIAM6AAALxAEBAX8jAEEQayILJAAgACgCACABIAIgACgCBCgCDBECACEBIAtBADoADSALIAE6AAwgCyAANgIIIAtBCGogAyAEIAUgBhByIAcgCCAJIAoQciEBAn8gCy0ADCIAIAstAA1FDQAaIABB/wFxIQJBASACDQAaIAEoAgAiAC0AGEEEcUUEQCAAKAIAQefxwgBBAiAAKAIEKAIMEQIADAELIAAoAgBB5vHCAEEBIAAoAgQoAgwRAgALIAtBEGokAEH/AXFBAEcLrQEBAX8CQCACBEACfwJAAkACQCABQQBOBEAgAygCCEUNAiADKAIEIgQNASABDQMgAgwECyAAQQhqQQA2AgAMBQsgAygCACAEIAIgARDyAgwCCyABDQAgAgwBCyABIAIQ/gILIgMEQCAAIAM2AgQgAEEIaiABNgIAIABBADYCAA8LIAAgATYCBCAAQQhqIAI2AgAMAQsgACABNgIEIABBCGpBADYCAAsgAEEBNgIAC4gBAQN/IAAoAggiAQRAIAAoAgQhAiABQThsIQNBACEBA0AgASACaiIAQRBqKAIABEAgAEEUaigCABA7CyAAQRxqKAIABEAgAEEgaigCABA7CyAAQShqKAIABEAgAEEsaigCABA7CyAAQQRqKAIABEAgAEEIaigCABA7CyADIAFBOGoiAUcNAAsLC6sBAQF/IwBB4ABrIgEkACABQRhqIABBEGopAgA3AwAgAUEQaiAAQQhqKQIANwMAIAEgACkCADcDCCABQQA2AiggAUKAgICAEDcDICABQTBqIgAgAUEgakHApcAAELsCIAFBCGogABDlAUUEQCABKAIkIAEoAigQBCABKAIgBEAgASgCJBA7CyABQeAAaiQADwtB2KXAAEE3IAFB2ABqQZCm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NgIADwtBDEEEELwDAAtyACMAQTBrIgEkAEHYk8MALQAABEAgAUEUakECNgIAIAFBHGpBATYCACABQfjEwgA2AhAgAUEANgIIIAFBOTYCJCABIAA2AiwgASABQSBqNgIYIAEgAUEsajYCICABQQhqQaDFwgAQogIACyABQTBqJAALdgEBfyAALQAEIQEgAC0ABQRAIAFB/wFxIQEgAAJ/QQEgAQ0AGiAAKAIAIgEtABhBBHFFBEAgASgCAEHn8cIAQQIgASgCBCgCDBECAAwBCyABKAIAQebxwgBBASABKAIEKAIMEQIACyIBOgAECyABQf8BcUEARwttAQN/IAFBBGooAgAhBAJAAkACQCABQQhqKAIAIgFFBEBBASECDAELIAFBAE4iA0UNASABIAMQ/gIiAkUNAgsgACACNgIEIAAgATYCACACIAQgARDCAxogACABNgIIDwsQlgIACyABIAMQvAMAC2oBAX8jAEEwayICJAAgAiABNgIMIAIgADYCCCACQRxqQQI2AgAgAkEkakEBNgIAIAJBjKfAADYCGCACQQA2AhAgAkElNgIsIAIgAkEoajYCICACIAJBCGo2AiggAkEQahCzASACQTBqJAALdQEBfyMAQRBrIgIkAAJ/IAAoAgAiACgCAEUEQCACIABBBGo2AgggAiAAQQhqNgIMIAFB3ffAAEEPQez3wABBCCACQQhqQfT3wABBhPjAAEEGIAJBDGpB9PfAABCwAQwBCyABQcj3wABBFRD4AgsgAkEQaiQACz4AIAAoAhAEQCAAQRRqKAIAEDsLIABBHGooAgAEQCAAQSBqKAIAEDsLIABBKGooAgAEQCAAQSxqKAIAEDsLC1gBAn8jAEEgayICJAAgASgCBCEDIAEoAgAgAkEYaiAAKAIAIgBBEGopAgA3AwAgAkEQaiAAQQhqKQIANwMAIAIgACkCADcDCCADIAJBCGoQTyACQSBqJAALYgEBfyMAQSBrIgUkACAFIAI2AgQgBSABNgIAIAVBGGogA0EQaikCADcDACAFQRBqIANBCGopAgA3AwAgBSADKQIANwMIIAAgBUH0hMAAIAVBBGpB9ITAACAFQQhqIAQQZgALXQECfyMAQSBrIgIkACACQQhqIgMgAUHMjMAAQQAQswIgAiAANgIYIAIgAEEEajYCHCADIAJBGGpB0I3AABCDARogAyACQRxqQdCNwAAQgwEaIAMQwQEgAkEgaiQAC2cBAX8jAEEQayICJAACfyAAKAIAIgApAwBQBEAgAiAAQQhqNgIIIAFBhKjAAEECIAJBCGpBiKjAABCuAQwBCyACIABBCGo2AgwgAUHwp8AAQQMgAkEMakH0p8AAEK4BCyACQRBqJAALlAIBAn8jAEEQayICJAAgAiAAKAIAIgA2AgQgAiAAQQRqNgIIIAIgAEEIajYCDCMAQRBrIgAkACABKAIAQb/0wABBDyABKAIEKAIMEQIAIQMgAEEAOgANIAAgAzoADCAAIAE2AgggAEEIakHO9MAAQQQgAkEEakHU9MAAEHJB5PTAAEEEIAJBCGpB1PTAABByQej0wABBBCACQQxqQez0wAAQciEBAn8gAC0ADCIDIAAtAA1FDQAaQQEgAw0AGiABKAIAIgEtABhBBHFFBEAgASgCAEHn8cIAQQIgASgCBCgCDBECAAwBCyABKAIAQebxwgBBASABKAIEKAIMEQIACyAAQRBqJABB/wFxQQBHIAJBEGokAAtZAQF/IwBBIGsiAiQAIAIgACgCADYCBCACQRhqIAFBEGopAgA3AwAgAkEQaiABQQhqKQIANwMAIAIgASkCADcDCCACQQRqQbSLwAAgAkEIahBPIAJBIGokAAtZAQF/IwBBIGsiAiQAIAIgACgCADYCBCACQRhqIAFBEGopAgA3AwAgAkEQaiABQQhqKQIANwMAIAIgASkCADcDCCACQQRqQai2wAAgAkEIahBPIAJBIGokAAtqAQF+IAEpAgAhAgJAIAEtAABBBEYEQCAAQYAEOwEEQQhBBBD+AiIBRQ0BIAEgAjcCACAAQRhqQczBwAA2AgAgAEEUaiABNgIAIABBATYCAA8LIAAgAjcCBCAAQQU2AgAPC0EIQQQQvAMAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB8NPAACACQQhqEE8gAkEgaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB2LzCACACQQhqEE8gAkEgaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBjL3CACACQQhqEE8gAkEgaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBvNPCACACQQhqEE8gAkEgaiQAC1MBAn8jAEEgayICJAAgASgCBCEDIAEoAgAgAkEYaiAAQRBqKQIANwMAIAJBEGogAEEIaikCADcDACACIAApAgA3AwggAyACQQhqEE8gAkEgaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB+PPCACACQQhqEE8gAkEgaiQAC1MBAn8jAEEgayICJAAgACgCBCEDIAAoAgAgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAyACQQhqEE8gAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBtIvAACACQQhqEE8gAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBqLbAACACQQhqEE8gAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB8NPAACACQQhqEE8gAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB2LzCACACQQhqEE8gAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB+PPCACACQQhqEE8gAkEgaiQAC00AAn9BACAAQQNJDQAaQQEgAEEETQ0AGkECIABBCUkNABpBAyAAQRFJDQAaQQQgAEEh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IGokAAwCCyAAQRRqQQE2AgAgAEEcakEANgIAIABB5MXCADYCECAAQaS9wgA2AhggAEEANgIIIABBCGpBiMbCABCiAgALAAsgAUEDOgAMIAFBCGoiACgCACAALQAEOgAACyABQSBqJAAMBAsgAUEUakEBNgIAIAFBHGpBADYCACABQdSDwAA2AhAMAgtB3IPAAEErQdSEwAAQhgIACyABQRRqQQE2AgAgAUEcakEANgIAIAFBoIPAADYCEAsgAUGog8AANgIYIAFBADYCCCABQQhqQZS1wAAQogIACwsgA0EQaiQAC0oBAX8jAEEgayIAJAAgAEEUakEBNgIAIABBHGpBADYCACAAQYTUwgA2AhAgAEHU08IANgIYIABBADYCCCAAQQhqQYzUwgAQogIACzwAIAAgASkDADcDACAAQRhqIAFBGGopAwA3AwAgAEEQaiABQRBqKQMANwMAIABBCGogAUEIaikDADcDAAtGAQJ/IAEoAgQhAiABKAIAIQNBCEEEEP4CIgFFBEBBCEEEELwDAAsgASACNgIEIAEgAzYCACAAQcjGwgA2AgQgACABNgIAC5l3AxZ+In8BfCABKAIYQQFxIRggACsDACE6AkACQAJAIAEoAhBBAUYEQAJ/IAEhJCABQRRqKAIAIScjAEHwCGsiHyQAIDq9IQMCQCA6IDpiBEBBAiEBDAELIANC/////////weDIgZCgICAgICAgAiEIANCAYZC/v///////w+DIANCNIinQf8PcSIAGyIEQgGDIQVBAyEBAkACQAJAQQFBAkEEIANCgICAgICAgPj/AIMiB1AiGRsgB0KAgICAgICA+P8AURtBA0EEIBkbIAZQG0ECaw4DAAECAwtBBCEBDAILIABBswhrIRwgBVAhAUIBIQIMAQtCgICAgICAgCAgBEIBhiAEQoCAgICAgIAIUSIZGyEEQgJCASAZGyECIAVQIQFBy3dBzHcgGRsgAGohHAsgHyAcOwHoCCAfIAI3A+AIIB9CATcD2AggHyAENwPQCCAfIAE6AOoIAn9BvNbCACABQQJGDQAaIBhFBEAgA0I/iKchLEGr7sIAQbzWwgAgA0IAUxsMAQtBASEsQavuwgBBrO7CACADQgBTGwshMkEBIQACQAJAAn8CQAJAAkACQEEDIAFBAmsgAUEBTRtB/wFxQQFrDgMCAQADC0F0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tO7CAEElQdzuwgAQhgIACyAAQShBqIjDABCXAwALDwsgAUEAIQEjAEGAAWsiICQAIDq9IQICQCA6IDpiBEBBAiEADAELIAJC/////////weDIgZCgICAgICAgAiEIAJCAYZC/v///////w+DIAJCNIinQf8PcSIZGyIDQgGDIQVBAyEAAkACQAJAQQFBAkEEIAJCgICAgICAgPj/AIMiB1AiHBsgB0KAgICAgICA+P8AURtBA0EEIBwbIAZQG0ECaw4DAAECAwtBBCEADAILIBlBswhrIQEgBVAhAEIBIQQMAQtCgICAgICAgCAgA0IBhiADQoCAgICAgIAIUSIBGyEDQgJCASABGyEEIAVQIQBBy3dBzHcgARsgGWohAQsgICABOwF4ICAgBDcDcCAgQgE3A2ggICADNwNgICAgADoAegJ/IABBAkYEQEG81sIAIS1BAAwBCyAYRQRAQavuwgBBvNbCACACQgBTGyEtIAJCP4inDAELQavuwgBBrO7CACACQgBTGyEtQQELITJBASEBAn8CQAJAAkACQEEDIABBAmsgAEEBTRtB/wFxQQFrDgMCAQADCyAgQSBqIRkgIEEPaiEaIwBBMGsiGCQAAkACQAJAAkACQAJAAkAgIEHgAGoiACkDACICUEUEQCAAKQMIIgRQRQRAIAApAxAiA1BFBEAgAiACIAN8IgNYBEAgAiAEWgRAAkACQCADQv//////////H1gEQCAYIAAvARgiADsBCCAYIAIgBH0iBDcDACAAIABBIGsgACADQoCAgIAQVCIBGyIcQRBrIBwgA0IghiADIAEbIgNCgICAgICAwABUIgEbIhxBCGsgHCADQhCGIAMgARsiA0KAgICAgICAgAFUIgEbIhxBBGsgHCADQgiGIAMgARsiA0KAgICAgICAgBBUIgEbIhxBAmsgHCADQgSGIAMgARsiA0KAgICAgICAgMAAVCIBGyADQgKGIAMgARsiBUI/h6dBf3NqIgFrwSIcQQBIDQIgGEJ/IBytIgaIIgMgBIM3AxAgAyAEVA0NIBggADsBCCAYIAI3AwAgGCACIAODNwMQIAIgA1YNDUGgfyABa8FB0ABsQbCnBWpBzhBtIgBB0QBPDQEgAEEEdCIAQbDewgBqKQMAIgdC/////w+DIgMgAiAGQj+DIgKGIghCIIgiDn4iCUIgiCIUIAdC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AmogHUECdGogADYCACAdQQFqIR0LIAEgHTYC8AMgGSAsIBkgLEsbIhhBKE0NAAsLDAILIB1BKEGoiMMAEMwBAAsgHEEoQaiIwwAQzAEACyAYQShBqIjDABCXAwALIABBKEGoiMMAEJcDAAtBuIjDAEEaQaiIwwAQhgIACyAZQShBqIjDABCXAwALICBB2ABqICBBKGooAgA2AgAgICAgKQMgNwNQCyAgICAoAlAgICgCVCAgLwFYQQAgIEEgahBrICAoAgQhASAgKAIADAMLICBBAjsBICAgQQE2AiggIEGt7sIANgIkICBBIGoMAgsgIEEDNgIoICBBru7CADYCJCAgQQI7ASAgIEEgagwBCyAgQQM2AiggIEGx7sIANgIkICBBAjsBICAgQSBqCyEAICBB3ABqIAE2AgAgICAANgJYICAgMjYCVCAgIC02AlAgIEHQAGoQUSAgQYABaiQADwsgGEEoQaiIwwAQlwMACyAYQShBqIjDABDMAQALIBxBKEGoiMMAEJcDAAs6AQF/IwBBEGsiAyQAIANBCGogASACEFMCQCADKAIIRQRAIAAgARA0DAELIABBBzYCAAsgA0EQaiQACzkAAkACfyACQYCAxABHBEBBASAAIAIgASgCEBEAAA0BGgsgAw0BQQALDwsgACADIAQgASgCDBECAAs7AQF/IwBBEGsiAiQAIAIgACgCADYCDCABQcK/wABBDEHOv8AAQQ8gAkEMakHgv8AAELQBIAJBEGokAAs7AQF/IwBBEGsiAiQAIAIgACgCADYCDCABQejOwABBCkGUzcAAQQQgAkEMakH0zsAAELQBIAJBEGokAAs7AQF/IwBBEGsiAiQAIAIgACgCADYCDCABQcTswABBC0HP7MAAQQUgAkEMakHU7MAAELQBIAJBEGokAAs7AQF/IwBBEGsiAiQAIAIgACgCADYCDCABQaP3wABBDkGx98AAQQUgAkEMakG498AAELQBIAJBEGokAAs7AQF/IwBBEGsiAiQAIAIgACgCADYCDCABQcadwgBBE0HZncIAQQogAkEMakHkncIAELQBIAJBEGokAAs7AQF/IwBBEGsiAiQAIAIgACgCADYCDCABQbyrwgBBE0HPq8IAQQQgAkEMakHUq8IAELQBIAJBEGokAAvkAgECfyMAQSBrIgIkACACQQE6ABggAiABNgIUIAIgADYCECACQfjvwgA2AgwgAkG81sIANgIIIwBBEGsiASQAAkAgAkEIaiIAKAIMIgIEQCAAKAIIIgNFDQEgASACNgIIIAEgADYCBCABIAM2AgAjAEEQayIAJAAgAEEIaiABQQhqKAIANgIAIAAgASkCADcDACMAQRBrIgEkACAAKAIAIgJBFGooAgAhAwJAAn8CQAJAIAJBDGooAgAOAgABAwsgAw0CQQAhAkGkvcIADAELIAMNASACKAIIIgMoAgQhAiADKAIACyEDIAEgAjYCBCABIAM2AgAgAUHsxsIAIAAoAgQiASgCCCAAKAIIIAEtABAQqwEACyABQQA2AgQgASACNgIMIAFB2MbCACAAKAIEIgEoAgggACgCCCABLQAQEKsBAAtBpL3CAEErQajGwgAQhgIAC0GkvcIAQStBmMbCABCGAgALNgEBfyMAQRBrIgIkACACQQhqIAEQuQIgAigCDCEBIAAgAigCCDYCACAAIAE2AgQgAkEQaiQACzYBAX8jAEEQayICJAAgAkEIaiABEOACIAIoAgwhASAAIAIoAgg2AgAgACABNgIEIAJBEGokAAtJAQJ/QZ71wAAhAkEEIQMCQAJAAkAgACgCAC0AAEEBaw4CAAECCyABQZT1wABBChD4Ag8LQYz1wAAhAkEIIQMLIAEgAiADEPgCCzQBAX8gACgCACAAKAIEKAIAEQMAIAAoAgQiAUEEaigCAARAIAFBCGooAgAaIAAoAgAQOwsLOAEBfyMAQRBrIgIkACACIAA2AgwgAUHGncIAQRNB2Z3CAEEKIAJBDGpB5J3CABC0ASACQRBqJAALOAEBfyMAQRBrIgIkACACIAA2AgwgAUG8q8IAQRNBz6vCAEEEIAJBDGpB1KvCABC0ASACQRBqJAALMwACQCAAQfz///8HSw0AIABFBEBBBA8LIAAgAEH9////B0lBAnQQ/gIiAEUNACAADwsACzwBAX8gAi0AA0UEQCACIAEoAAA2AAALAkACQAJAIABB/wFxQQJrDgIBAgALIAIoAAAhAwsgASADNgAACwvIAwIBfgR/IAAoAgAhACABEI0DRQRAIAEQjgNFBEAgACABEJ0DDwsjAEGAAWsiBCQAIAApAwAhAkGAASEAIARBgAFqIQUCQAJAA0AgAEUEQEEAIQAMAwsgBUEBa0EwQTcgAqciA0EPcSIGQQpJGyAGajoAACACQhBaBEAgBUECayIFQTBBNyADQf8BcSIDQaABSRsgA0EEdmo6AAAgAEECayEAIAJCgAJUIAJCCIghAkUNAQwCCwsgAEEBayEACyAAQYEBSQ0AIABBgAFBnPLCABCWAwALIAFBAUGs8sIAQQIgACAEakGAASAAaxBHIARBgAFqJAAPCyMAQYABayIEJAAgACkDACECQYABIQAgBEGAAWohBQJAAkADQCAARQRAQQAhAAwDCyAFQQFrQTBB1wAgAqciA0EPcSIGQQpJGyAGajoAACACQhBaBEAgBUECayIFQTBB1wAgA0H/AXEiA0GgAUkbIANBBHZqOgAAIABBAmshACACQoACVCACQgiIIQJFDQEMAgsLIABBAWshAAsgAEGBAUkNACAAQYABQZzywgAQlgMACyABQQFBrPLCAEECIAAgBGpBgAEgAGsQRyAEQYABaiQACzIAIAAoAgAhACABEI0DRQRAIAEQjgNFBEAgACABEJkDDwsgACABELwBDwsgACABELsBC7cBAQN/IAAoAgAhACABEI0DRQRAIAEQjgNFBEAgACABEJwDDwsgACABELoBDwsjAEGAAWsiAyQAIAAtAAAhAANAIAIgA2pB/wBqQTBB1wAgAEEPcSIEQQpJGyAEajoAACACQQFrIQIgACIEQQR2IQAgBEEPSw0ACyACQYABaiIAQYEBTwRAIABBgAFBnPLCABCWAwALIAFBAUGs8sIAQQIgAiADakGAAWpBACACaxBHIANBgAFqJAALvQIBA38gACgCACEAIAEQjQNFBEAgARCOA0UEQCAAMwEAQQEgARB6DwsjAEGAAWsiAyQAIAAvAQAhAANAIAIgA2pB/wBqQTBBNyAAQQ9xIgRBCkkbIARqOgAAIAJBAWshAiAAIgRBBHYhACAEQQ9LDQALIAJBgAFqIgBBgQFPBEAgAEGAAUGc8sIAEJYDAAsgAUEBQazywgBBAiACIANqQYABakEAIAJrEEcgA0GAAWokAA8LIwBBgAFrIgMkACAALwEAIQADQCACIANqQf8AakEwQdcAIABBD3EiBEEKSRsgBGo6AAAgAkEBayECIAAiBEEEdiEAIARBD0sNAAsgAkGAAWoiAEGBAU8EQCAAQYABQZzywgAQlgMACyABQQFBrPLCAEECIAIgA2pBgAFqQQAgAmsQRyADQYABaiQACywBAX8jAEEQayIAJAAgAEEIaiICIAFBz73CAEELELwCIAIQ1AEgAEEQaiQACy4AIABBBDoABCAAQQQ2AgAgAEEGaiACOgAAIABBBWogAToAACAAQRRqQQA7AQALKwAgASACTwRAIAEgAmsiASAAIAFqIAIQPg8LQeytwABBIUGQrsAAEIYCAAssACAAIAEpAgA3AgAgAEEQaiABQRBqKAIANgIAIABBCGogAUEIaikCADcCAAsxACAAIAEoAgAgAiADIAEoAgQoAgwRAgA6AAggACABNgIEIAAgA0U6AAkgAEEANgIACykAIAEgAk8EQCACIAAgAmogASACaxA+DwtBpqvAAEEjQdytwAAQhgIACy4AIAEgACgCAC0AAEEEc0EHcUECdCIAQej5wABqKAIAIABByPnAAGooAgAQ+AILKgAgACgCAEUEQCAAKAIEIAEgAEEIaigCACgCEBEAAA8LIABBBGogARBqCywAAkAgARCNA0UEQCABEI4DDQEgACABEMACDwsgACABELsBDwsgACABELwBCycAIAAgACgCBEEBcSABckECcjYCBCAAIAFqIgAgACgCBEEBcjYCBAstAQF/IABB8KrCAEG0qsIAIAEtAABBBEYiAhs2AgQgACABQQFqIAEgAhs2AgALOgECf0Hck8MALQAAIQFB3JPDAEEAOgAAQeCTwwAoAgAhAkHgk8MAQQA2AgAgACACNgIEIAAgATYCAAsxACAAQQM6ACAgAEKAgICAgAQ3AhggAEEANgIQIABBADYCCCAAIAI2AgQgACABNgIACy0AIAEoAgAgAiADIAEoAgQoAgwRAgAhAiAAQQA6AAUgACACOgAEIAAgATYCAAsgAQF/AkAgAEEEaigCACIBRQ0AIAAoAgBFDQAgARA7CwsjAAJAIAFB/P///wdNBEAgACABQQQgAhDyAiIADQELAAsgAAsjACACIAIoAgRBfnE2AgQgACABQQFyNgIEIAAgAWogATYCAAseACAAKAIAIgCtQgAgAKx9IABBAE4iABsgACABEHoLJQAgAEUEQEGouMAAQTIQtwMACyAAIAIgAyAEIAUgASgCEBELAAsjACAAQQA2AhAgACABKQIANwIAIABBCGogAUEIaikCADcCAAsoACABIAAoAgAtAABBAnQiAEG008AAaigCACAAQfjSwABq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DAELIAFB2M/AAEEHEPgCCyAAQRBqJAALCwAgACgCACABEHgLjgQBAX8gACgCACECIwBBEGsiACQAAn8CQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIAItAABBAWsOGQECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkACyABQafSwABBAhD4AgwZCyABQaXSwABBAhD4AgwYCyABQaLSwABBAxD4AgwXCyABQZ7SwABBBBD4AgwWCyABQZnSwABBBRD4AgwVCyABQZfSwABBAhD4AgwUCyABQZTSwABBAxD4AgwTCyABQZDSwABBBBD4AgwSCyABQYvSwABBBRD4AgwRCyABQYnSwABBAhD4AgwQCyABQYbSwABBAxD4AgwPCyABQYLSwABBBBD4AgwOCyABQf3RwABBBRD4AgwNCyABQdvRwABBAhD4AgwMCyABQdjRwABBAxD4AgwLCyABQdTRwABBBBD4AgwKCyABQc/RwABBBRD4AgwJCyABQczRwABBAxD4AgwICyABQcjRwABBBBD4AgwHCyABQcPRwABBBRD4AgwGCyABQb3RwABBBhD4AgwFCyABQfnRwABBBBD4AgwECyABQfTRwABBBRD4AgwDCyABQbfRwABBBhD4AgwCCyABQbDRwABBBxD4AgwBCyAAIAJBAWo2AgwgAUHd0cAAQQcgAEEMakHk0cAAEK4BCyAAQRBqJAAL8QkBAX8gACgCACECIwBBEGsiACQAAn8CQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQCACLQAAQQFrDh4BAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4ACyAAIAJBBGo2AgAgACACQQhqNgIEIAAgAkEMajYCCCAAIAJBEGo2AgwgAUGO8cAAQQtBmfHAAEEHIABB6OnAAEGg8cAAQQcgAEEEakHY6cAAQafxwABBByAAQQhqQdjpwABBrvHAAEEFIABBDGpByOnAABCpAQweCyABQf7wwABBEBD4AgwdCyABQfHwwABBDRD4AgwcCyABQd3wwABBFBD4AgwbCyABQdLwwABBCxD4AgwaCyABQcfwwABBCxD4AgwZCyABQbfwwABBEBD4AgwY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ACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ5wEMFQsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEH84cAANgIwIABBADYCKCAAQaMBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOcBDBQLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBwOHAADYCMCAAQQA2AiggAEGjATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDnAQwTCyAAIAJBBGo2AiAgACACQQhqNgIkIABBNGpBAzYCACAAQTxqQQI2AgAgAEEUakGlATYCACAAQYjhwAA2AjAgAEEANgIoIABBpQE2AgwgACAAQQhqNgI4IAAgAEEgajYCECAAIABBJGo2AgggASAAQShqEOcBDBILIAAgAkEEajYCICAAIAJBCGo2AiQgAEE0akEDNgIAIABBPGpBAjYCACAAQRRqQaYBNgIAIABBxODAADYCMCAAQQA2AiggAEGmATYCDCAAIABBCGo2AjggACAAQSRqNgIQIAAgAEEgajYCCCABIABBKGoQ5wEMEQsgAEE0akEBNgIAIABBPGpBADYCACAAQZTgwAA2AjAgAEGQ1cAANgI4IABBADYCKCABIABBKGoQ5wEMEAsgACACQQJqNgIgIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akECNgIAIABBFGpBpwE2AgAgAEHg38AANgIwIABBADYCKCAAQagBNgIMIAAgAEEIajYCOCAAIABBJGo2AhAgACAAQSBqNgIIIAEgAEEoahDnAQwPCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQaTfwAA2AjAgAEEANgIoIABBqAE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ5wEMDgsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEHs3sAANgIwIABBADYCKCAAQakBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOcBDA0LIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBwN7AADYCMCAAQQA2AiggAEGpATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDnAQwMCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQZzewAA2AjAgAEEANgIoIABBqQE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ5wEMCwsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEH43cAANgIwIABBADYCKCAAQakBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOcBDAoLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABB1N3AADYCMCAAQQA2AiggAEGpATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDnAQwJCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQaDdwAA2AjAgAEEANgIoIABBqQE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ5wEMCAsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEHw3MAANgIwIABBADYCKCAAQakBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOcBDAcLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBxNzAADYCMCAAQQA2AiggAEGpATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDnAQwGCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQZzcwAA2AjAgAEEANgIoIABBqQE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ5wEMBQsgAEE0akEBNgIAIABBPGpBADYCACAAQfjbwAA2AjAgAEGQ1cAANgI4IABBADYCKCABIABBKGoQ5wEMBAsgAEE0akEBNgIAIABBPGpBADYCACAAQdzZwAA2AjAgAEGQ1cAANgI4IABBADYCKCABIABBKGoQ5wEMAwsgACACQQRqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEGY2cAANgIwIABBADYCKCAAQaoBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOcBDAILAkACQAJAAkACQAJAAkACQCACLQABQQFrDgcBAgMEBQYHAAsgAEE0akEBNgIAIABBPGpBADYCACAAQYzZwAA2AjAgAEGQ1cAANgI4IABBADYCKCABIABB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cmZvcm1lZCByZWN1cnNpdmVseWgBEAA4AAAAT25jZSBpbnN0YW5jZSBoYXMgcHJldmlvdXNseSBiZWVuIHBvaXNvbmVkAACoARAAKgAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWUvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L3N0ZC9zcmMvc3luYy9vbmNlLnJzAAcCEABMAAAAjwAAADIAAAABAAAABAAAAAQAAAAFAAAAAQAAAAQAAAAEAAAABgAAAE1hcEFjY2Vzczo6bmV4dF92YWx1ZSBjYWxsZWQgYmVmb3JlIG5leHRfa2V5QzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcc2VyZGUtMS4wLjE1OVxzcmNcZGVcdmFsdWUucnOwAhAAXAAAAMgEAAAbAAAAYXNzZXJ0aW9uIGZhaWxlZDogeCBhcyB1NjQgKyB3aWR0aCBhcyB1NjQgPD0gc2VsZi53aWR0aCgpIGFzIHU2NEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xpbWFnZS5ycwAAXAMQAFoAAAC9AwAACQAAAGFzc2VydGlvbiBmYWlsZWQ6IHkgYXMgdTY0ICsgaGVpZ2h0IGFzIHU2NCA8PSBzZWxmLmhlaWdodCgpIGFzIHU2NAAAXAMQAFoAAAC+AwAACQAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xidWZmZXIucnMAHAQQAFsAAAC3AwAARgAAAEltYWdlIGluZGV4ICBvdXQgb2YgYm91bmRzIACIBBAADAAAAJQEEAAPAAAAHAQQAFsAAACyAwAAFQAAABwEEABbAAAAfAMAAA4AAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlABwEEABbAAAAewMAAEMAAAAc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IAAAdA8QACoAAAAMDRAAXAAAABEBAAAYAAAAZmFpbGVkIHRvIHdyaXRlIHdob2xlIGJ1ZmZlcrgPEAAcAAAAFwAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWVDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xnaWYtMC4xMi4wXHNyY1xlbmNvZGVyLnJzTkVUU0NBUEUyLjAAAAsQEABYAAAAFQEAACYAAAALEBAAWAAAAAMBAAAbAAAACxAQAFgAAAD9AAAAJgAAAAsQEABYAAAA5QAAACYAAABHSUY4OWEAAAsQEABYAAAAxAAAACYAAAACAAAAAAAAAGNodW5rcyBjYW5ub3QgaGF2ZSBhIHNpemUgb2YgemVybwAAANAQEAAhAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9tb2QucnMAAAD8EBAATQAAAHEDAAAJAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcaW1hZ2Vwcm9jLTAuMjMuMFxzcmNcZ2VvbWV0cmljX3RyYW5zZm9ybWF0aW9ucy5yc1wREABwAAAAiQIAAA0AAABgdW53cmFwX3Rocm93YCBmYWlsZWQAAAAoAAAADAAAAAQAAAApAAAAKAAAAAwAAAAEAAAAKgAAACkAAAD0ERAAKwAAACwAAAAtAAAALgAAAC8AAAAAAAAAY2h1bmtzIGNhbm5vdCBoYXZlIGEgc2l6ZSBvZiB6ZXJvAAAANBIQACEAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL21vZC5ycwAAAGASEABNAAAAwAMAAAkAAAAxAAAADAAAAAQAAAAyAAAAMwAAADQAAABhIERpc3BsYXkgaW1wbGVtZW50YXRpb24gcmV0dXJuZWQgYW4gZXJyb3IgdW5leHBlY3RlZGx5ADUAAAAAAAAAAQAAADYAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2FsbG9jL3NyYy9zdHJpbmcucnMAIBMQAEsAAADpCQAADgAAAG1pc3NpbmcgZmllbGQgYGB8ExAADwAAAIsTEAABAAAAdW5rbm93biBmaWVsZCBgYCwgZXhwZWN0ZWQgAJwTEAAPAAAAqxMQAAwAAABgLCB0aGVyZSBhcmUgbm8gZmllbGRzAACcExAADwAAAMgTEAAWAAAARXJyADUAAAAEAAAABAAAADcAAABPawAANQAAAAQAAAAEAAAAOAAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGdpZi0wLjEyLjBcc3JjXHJlYWRlclxtb2QucnMAGBQQAFsAAAB4AQAAIwAAABgUEABbAAAAegEAABgAAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlABgUEABbAAAAggEAACsAAAAYFBAAWwAAAIMBAAAgAAAAbm8gY29sb3IgdGFibGUgYXZhaWxhYmxlIGZvciBjdXJyZW50IGZyYW1lAAAYFBAAWwAAAD8BAAArAAAAaW1hZ2UgdHJ1bmNhdGVkABgUEABbAAAARAEAABwAAABpbnRlcm5hbCBlcnJvcjogZW50ZXJlZCB1bnJlYWNoYWJsZSBjb2RlGBQQAFsAAADvAAAAFQAAAGZpbGUgZG9lcyBub3QgY29udGFpbiBhbnkgaW1hZ2UgZGF0YXVuZXhwZWN0ZWQgRU9GYXNzZXJ0aW9uIGZhaWxlZDogbWlkIDw9IHNlbGYubGVuKClJbWFnZSBkaW1lbnNpb25zICgsICkgYXJlIHRvbyBsYXJnZckVEAASAAAA2xUQAAIAAADdFRAADwAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvY29yZS9zcmMvb3BzL2FyaXRoLnJzAAAABBYQAE0AAADoAQAAAQBB8KzAAAvlFWF0dGVtcHQgdG8gZGl2aWRlIGJ5IHplcm8AAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL21vZC5ycwAAAIwWEABNAAAADQwAAAkAAABhc3NlcnRpb24gZmFpbGVkOiBrIDw9IHNlbGYubGVuKCkAAACMFhAATQAAADgMAAAJAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZUM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xjb2RlY3NcZ2lmLnJzAABLFxAAXwAAACsCAAA1AAAASxcQAF8AAAAiAgAAKAAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xidWZmZXIucnMAzBcQAFsAAAC3AwAARgAAAEltYWdlIGluZGV4ICBvdXQgb2YgYm91bmRzIAA4GBAADAAAAEQYEAAPAAAAzBcQAFsAAACyAwAAFQAAADoAAAAYAQAACAAAADsAAAA8AAAAPQAAAD4AAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2FsbG9jL3NyYy9zbGljZS5ycwAAkBgQAEoAAACSAAAAEQAAAGdpZnBuZ1Vuc3VwcG9ydGVkIGV4dGVuc2lvbjogAAAA8hgQABcAAABGYWlsZWQgdG8gY3JlYXRlIHJlYWRlcjogAAAAFBkQABkAAABGYWlsZWQgdG8gY29sbGVjdCBmcmFtZXM6IAAAOBkQABoAAABGYWlsZWQgdG8gY3JlYXRlIGR5bmFtaWMgaW1hZ2U6IFwZEAAgAAAAc3JjXHV0aWxzLnJzhBkQAAwAAAAyAAAAEgAAAGF0dGVtcHQgdG8gZGl2aWRlIGJ5IHplcm8AAACEGRAADAAAADgAAAAgAAAAAAAAAGF0dGVtcHQgdG8gY2FsY3VsYXRlIHRoZSByZW1haW5kZXIgd2l0aCBhIGRpdmlzb3Igb2YgemVybwAAAIQZEAAMAAAASwAAABgAAACEGRAADAAAAE4AAAAYAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcY29uc29sZV9lcnJvcl9wYW5pY19ob29rLTAuMS43XHNyY1xsaWIucnMsGhAAaAAAAJUAAAAOAAAAc3BlZWRoeXBlcnNwZWVkcmV2ZXJzZXJhaW5ib3dyb3RhdGVzcGlucmV2c2xpZGV3aWdnbGVzaGFrZUZhaWxlZCB0byBwYXJzZSBjb21tYW5kczog3hoQABoAAABGYWlsZWQgdG8gd3JpdGUgZnJhbWU6IAAAGxAAFwAAACAbEAAAAAAAQgAAAAQAAAAEAAAAQwAAAEQAAABFAAAASAAAAAwAAAAEAAAASQAAAEoAAABLAAAAYSBEaXNwbGF5IGltcGxlbWVudGF0aW9uIHJldHVybmVkIGFuIGVycm9yIHVuZXhwZWN0ZWRseQBMAAAAAAAAAAEAAAA2AAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9hbGxvYy9zcmMvc3RyaW5nLnJzAKAbEABLAAAA6QkAAA4AAABpbnZhbGlkIHR5cGU6ICwgZXhwZWN0ZWQgAAAA/BsQAA4AAAAKHBAACwAAAGNsb3N1cmUgaW52b2tlZCByZWN1cnNpdmVseSBvciBhZnRlciBiZWluZyBkcm9wcGVkAABzdHJ1Y3QgdmFyaWFudAAAXBwQAA4AAAB0dXBsZSB2YXJpYW50AAAAdBwQAA0AAABuZXd0eXBlIHZhcmlhbnQAjBwQAA8AAAB1bml0IHZhcmlhbnSkHBAADAAAAGVudW24HBAABAAAAG1hcADEHBAAAwAAAHNlcXVlbmNl0BwQAAgAAABuZXd0eXBlIHN0cnVjdAAA4BwQAA4AAABPcHRpb24gdmFsdWX4HBAADAAAAHVuaXQgdmFsdWUAAAwdEAAKAAAAYnl0ZSBhcnJheQAAIB0QAAoAAABzdHJpbmcgADQdEAAHAAAAY2hhcmFjdGVyIGBgRB0QAAsAAABPHRAAAQAAAGZsb2F0aW5nIHBvaW50IGBgHRAAEAAAAE8dEAABAAAAaW50ZWdlciBgAAAAgB0QAAkAAABPHRAAAQAAAGJvb2xlYW4gYAAAAJwdEAAJAAAATx0Q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ZS4gVHJ5IHdpdGggYSBsYXJnZXIgbGltaXQurCsQADQAAABJbnZhbGlkIGNvbXByZXNzZWQgdGV4dCBkYXRhLgAAAOgrEAAdAAAATm8gbnVsbCBzZXBhcmF0b3IgaW4gdEVYdCBjaHVuay4QLBAAIAAAAEtleXdvcmQgZW1wdHkgb3IgbG9uZ2VyIHRoYW4gNzkgYnl0ZXMuAAA4LBAAJgAAAFVucmVwcmVzZW50YWJsZSBkYXRhIGluIHRFWHQgY2h1bmsuAGgsEAAjAAAALgAAAJAqEAAAAAAAlCwQAAEAAABJREFUIG9yIGZEQVQgY2h1bmsgaXMgaGFzIG5vdCBlbm91Z2ggZGF0YSBmb3IgaW1hZ2UuqCwQADQAAABDb3JydXB0IGRlZmxhdGUgc3RyZWFtLiDkLBAAGAAAAEVycm9yIG51bWJlciAAAAAELRAADQAAAJQsEAABAAAASGFzIG1vcmUgb3V0cHV0LiQtEAAQAAAATmVlZHMgbW9yZSBpbnB1dC4AAAA8LRAAEQAAAFVuZXhwZWN0ZWQgZG9uZSBzdGF0dXMuAFgtEAAXAAAAQWRsZXIzMiBjaGVja3N1bSBmYWlsZWQueC0QABgAAABJbnZhbGlkIGlucHV0IHBhcmFtZXRlcnMuAAAAmC0QABkAAABVbmV4cGVjdGVkIGVuZCBvZiBkYXRhLgC8LRAAFwAAAFN1YiBmcmFtZSBpcyBvdXQtb2YtYm91bmRzLgDcLRAAGwAAAFVua25vd24gaW50ZXJsYWNlIG1ldGhvZCAAAAAALhAAGQAAAJQsEAABAAAAVW5rbm93biBmaWx0ZXIgbWV0aG9kIAAALC4QABYAAACULBAAAQAAAFVua25vd24gY29tcHJlc3Npb24gbWV0aG9kIABULhAAGwAAAJQsEAABAAAASW52YWxpZCBzUkdCIHJlbmRlcmluZyBpbnRlbnQgAACALhAAHgAAAJQsEAABAAAASW52YWxpZCBwaHlzaWNhbCBwaXhlbCBzaXplIHVuaXQgAAAAsC4QACEAAACULBAAAQAAAEludmFsaWQgYmxlbmQgb3AgAAAA5C4QABEAAACULBAAAQAAAEludmFsaWQgZGlzcG9zZSBvcCAACC8QABMAAACULBAAAQAAAEludmFsaWQgY29sb3IgdHlwZSAALC8QABMAAACULBAAAQAAAEludmFsaWQgZGlzcG9zZSBvcGVyYXRpb24gAABQLxAAGgAAAJQsEAABAAAAVHJhbnNwYXJlbmN5IGNodW5rIGZvdW5kIGZvciBjb2xvciB0eXBlIHwvEAAoAAAAlCwQAAEAAABJbnZhbGlkIGNvbG9yL2RlcHRoIGNvbWJpbmF0aW9uIGluIGhlYWRlcjogL7QvEAArAAAA3y8QAAEAAABNaXNzaW5nIHBhbGV0dGUgb2YgaW5kZXhlZCBpbWFnZS4AAADwLxAAIQAAAE5vdCBlbm91Z2ggcGFsZXR0ZSBlbnRyaWVzLCBleHBlY3QgIGdvdCAcMBAAIwAAAD8wEAAFAAAAlCwQAAEAAABTZXF1ZW5jZSBpcyBub3QgaW4gb3JkZXIsIGV4cGVjdGVkICMgZ290ICMAAFwwEAAkAAAAgDAQAAYAAACULBAAAQAAAENodW5rICBtdXN0IGFwcGVhciBhdCBtb3N0IG9uY2UuoDAQAAYAAACmMBAAGgAAACBtdXN0IGFwcGVhciBiZXR3ZWVuIFBMVEUgYW5kIElEQVQgY2h1bmtzLgAAoDAQAAYAAADQMBAAKgAAACBpcyBpbnZhbGlkIGFmdGVyIFBMVEUgY2h1bmsuAAAAoDAQAAYAAAAMMRAAHQAAACBpcyBpbnZhbGlkIGFmdGVyIElEQVQgY2h1bmsuAAAAoDAQAAYAAAA8MRAAHQAAACBjaHVuayBhcHBlYXJlZCBiZWZvcmUgSUhEUiBjaHVuawAAAJAqEAAAAAAAbDEQACEAAABJREFUIG9yIGZEQVQgY2h1bmsgaXMgbWlzc2luZy4AAKAxEAAeAAAAZmNUTCBjaHVuayBtaXNzaW5nIGJlZm9yZSBmZEFUIGNodW5rLgAAAMgxEAAlAAAASUhEUiBjaHVuayBtaXNzaW5nAAD4MRAAEgAAAFVuZXhwZWN0ZWQgZW5kIG9mIGRhdGEgd2l0aGluIGEgY2h1bmsuAAAUMhAAJgAAAFVuZXhwZWN0ZWQgZW5kIG9mIGRhdGEgYmVmb3JlIGltYWdlIGVuZC5EMhAAKAAAAEludmFsaWQgUE5HIHNpZ25hdHVyZS4AAHQyEAAWAAAAQ1JDIGVycm9yOiBleHBlY3RlZCAweCBoYXZlIDB4IHdoaWxlIGRlY29kaW5nICBjaHVuay4AAACUMhAAFgAAAKoyEAAIAAAAsjIQABAAAADCMhAABwAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHBuZy0wLjE3Ljdcc3JjXGRlY29kZXJcc3RyZWFtLnJzAOwyEABfAAAA5wEAABwAAADsMhAAXwAAAOUBAAA5AAAA7DIQAF8AAACpAgAAIwAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWUA7DIQAF8AAAAlAwAAHAAAAOwyEABfAAAAJAMAABwAAADsMhAAXwAAADQDAAAgAAAA7DIQAF8AAAA6AwAAJwAAAOwyEABfAAAARwMAACcAAADsMhAAXwAAAIQDAAAnAAAA7DIQAF8AAAChAwAAJwAAAOwyEABfAAAA0wMAACcAAADsMhAAXwAAAOwDAAAnAAAA7DIQAF8AAAAsBAAAGAAAAOwyEABfAAAABQQAACcAAADsMhAAXwAAAJkEAAAOAAAA7DIQAF8AAACrBAAAHAAAAOwyEABfAAAAxgQAACMAAADsMhAAXwAAAMgEAAAlAAAA7DIQAF8AAADPBAAADgAAAOwyEABfAAAA0QQAABsAAADsMhAAXwAAANMEAAAcAAAAtwAAAAQAAAAEAAAAowAAALcAAAAEAAAABAAAALgAAAC3AAAABAAAAAQAAAC5AAAAUGFydGlhbENodW5rtwAAAAQAAAAEAAAAugAAAEltYWdlRW5kSW1hZ2VEYXRhRmx1c2hlZEltYWdlRGF0YUZyYW1lQ29udHJvbAAAALcAAAAEAAAABAAAALsAAABBbmltYXRpb25Db250cm9stwAAAAQAAAAEAAAAvAAAAFBpeGVsRGltZW5zaW9ucwC3AAAABAAAAAQAAAC9AAAAQ2h1bmtDb21wbGV0ZUNodW5rQmVnaW5IZWFkZXIAAAC3AAAABAAAAAQAAACnAAAAtwAAAAQAAAAEAAAAqAAAALcAAAAEAAAABAAAAL4AAABOb3RoaW5nTGltaXRzRXhjZWVkZWRQYXJhbWV0ZXIAALcAAAAEAAAABAAAAL8AAABGb3JtYXQAALcAAAAEAAAABAAAAMAAAABJb0Vycm9yALcAAAAEAAAABAAAAMEAAABGb3JtYXRFcnJvcmlubmVytwAAAAQAAAAEAAAAwgAAAEJhZFRleHRFbmNvZGluZwC3AAAABAAAAAQAAADDAAAAQmFkRmlsdGVyAAAAtwAAAAQAAAAEAAAAxAAAAE5vTW9yZUltYWdlRGF0YUNvcnJ1cHRGbGF0ZVN0cmVhbWVycrcAAAAEAAAABAAAAKsAAABCYWRTdWJGcmFtZUJvdW5kc1Vua25vd25JbnRlcmxhY2VNZXRob2RVbmtub3duRmlsdGVyTWV0aG9kVW5rbm93bkNvbXByZXNzaW9uTWV0aG9kSW52YWxpZFNyZ2JSZW5kZXJpbmdJbnRlbnRJbnZhbGlkVW5pdEludmFsaWRCbGVuZE9wSW52YWxpZERpc3Bvc2VPcEludmFsaWRDb2xvclR5cGVJbnZhbGlkQml0RGVwdGhDb2xvcldpdGhCYWRUcm5zSW52YWxpZENvbG9yQml0RGVwdGhjb2xvcl90eXBlYml0X2RlcHRoUGFsZXR0ZVJlcXVpcmVkU2hvcnRQYWxldHRlZXhwZWN0ZWRsZW5BcG5nT3JkZXJwcmVzZW50RHVwbGljYXRlQ2h1bmtraW5kT3V0c2lkZVBsdGVJZGF0QWZ0ZXJQbHRlQWZ0ZXJJZGF0Q2h1bmtCZWZvcmVJaGRyTWlzc2luZ0ltYWdlRGF0YU1pc3NpbmdGY3RsTWlzc2luZ0loZHJVbmV4cGVjdGVkRW5kT2ZDaHVua1VuZXhwZWN0ZWRFb2ZJbnZhbGlkU2lnbmF0dXJlQ3JjTWlzbWF0Y2hyZWNvdmVyY3JjX3ZhbGNyY19zdW1jaHVuawBpbnRlcm5hbCBlcnJvcjogZW50ZXJlZCB1bnJlYWNoYWJsZSBjb2RlOiAAALQ4EAAqAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNccG5nLTAuMTcuN1xzcmNcY29tbW9uLnJzAGF0dGVtcHQgdG8gZGl2aWRlIGJ5IHplcm8AAADoOBAAVwAAAEAAAAAdAAAATm90IGEgcG9zc2libGUgYnl0ZSByb3VuZGVkIHBpeGVsIHdpZHRoAGw5EAAnAAAA6DgQAFcAAABeAgAAEgAAAEVuZCBvZiBpbWFnZSBoYXMgYmVlbiByZWFjaGVkAAAArDkQAB0AAAB3cm9uZyBkYXRhIHNpemUsIGV4cGVjdGVkICBnb3QgANQ5EAAaAAAA7jkQAAUAAABSZ2JhR3JheXNjYWxlQWxwaGFJbmRleGVkUmdiR3JheXNjYWxlU2l4dGVlbkVpZ2h0Rm91clR3b09uZVBpeGVsRGltZW5zaW9uc3hwcHUAAMYAAAAEAAAABAAAALgAAAB5cHB1dW5pdMYAAAAEAAAABAAAAMcAAABNZXRlclVuc3BlY2lmaWVkUHJldmlvdXNCYWNrZ3JvdW5kTm9uZU92ZXJTb3VyY2VzZXF1ZW5jZV9udW1iZXJ3aWR0aGhlaWdodHhfb2Zmc2V0eV9vZmZzZXRkZWxheV9udW1kZWxheV9kZW5kaXNwb3NlX29wYmxlbmRfb3AAAKw6EAAPAAAAuzoQAAUAAADAOhAABgAAAMY6EAAIAAAAzjoQAAgAAADWOhAACQAAAN86EAAJAAAA6DoQAAoAAADyOhAACAAAAMYAAAAEAAAABAAAAMgAAADGAAAABAAAAAQAAADJAAAAxgAAAAQAAAAEAAAAygAAAEZyYW1lQ29udHJvbEFuaW1hdGlvbkNvbnRyb2xudW1fZnJhbWVzbnVtX3BsYXlzUGFyYW1ldGVyRXJyb3Jpbm5lcgAAxgAAAAQAAAAEAAAAywAAAFBvbGxlZEFmdGVyRW5kT2ZJbWFnZUltYWdlQnVmZmVyU2l6ZWV4cGVjdGVkxgAAAAQAAAAEAAAAuQAAAGFjdHVhbAAAAAAAAAEAAAAAAAAAAQAAAAAAAAADAAAAAAAAAAEAAAAAAAAAAgAAAAAAAAABAAAAAAAAAAQAAAAAAAAAAQAAAAEAAAADAAAAAQAAAAIAAAABAAAABAAAAAAAAAACAAAAAAAAAAEAAAAAAAAABAAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAADAAAAAAAAAAEAAAAAAAAAAgAAAAEAAAAEAAAAAQAAAAEAAAABAAAAAwAAAAEAAAAOAAAACQAAAAQAAAAJAAAACQAAAAkAAAADAAAABwAAAAg6EAAgOhAABDoQACA6EAAgOhAAIDoQAB06EAAWOhAAQ2h1bmtUeXBldHlwZQAAAM0AAAAEAAAAAQAAAM4AAABjcml0aWNhbM0AAAABAAAAAQAAAM8AAABwcml2YXRlcmVzZXJ2ZWRzYWZlY29weQAIPRAAAAAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHBuZy0wLjE3Ljdcc3JjXGRlY29kZXJcemxpYi5ycwAAAGA9EABdAAAASAAAABIAAABgPRAAXQAAAIAAAAAVAAAAYD0QAF0AAACMAAAAFgAAAE5vIG1vcmUgZm9yd2FyZCBwcm9ncmVzcyBtYWRlIGluIHN0cmVhbSBkZWNvZGluZy4AAABgPRAAXQAAAJ4AAAAVAAAAYXNzZXJ0aW9uIGZhaWxlZDogc3RlcCAhPSAwL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9jb3JlL3NyYy9pdGVyL2FkYXB0ZXJzL3N0ZXBfYnkucnNPPhAAWQAAABUAAAAJAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNccG5nLTAuMTcuN1xzcmNcZmlsdGVyLnJzRmlsdGVyaW5nIGZhaWxlZDogYnl0ZXMgcGVyIHBpeGVsIGlzIGdyZWF0ZXIgdGhhbiBsZW5ndGggb2Ygcm93AAC4PhAAVwAAALIAAAAeAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZQC4PhAAVwAAALgAAAAwAAAAuD4QAFcAAAB3AAAAHgAAALg+EABXAAAAYwAAADYAAABGaWx0ZXJpbmcgZmFpbGVkOiBub3QgZW5vdWdoIGRhdGEgaW4gcHJldmlvdXMgcm93AAAAuD4QAFcAAACYAAAADQAAALg+EABXAAAAmQAAAA0AAAC4PhAAVwAAAJoAAAANAAAAuD4QAFcAAACbAAAADQAAALg+EABXAAAAnAAAAA0AAAC4PhAAVwAAAJ0AAAANAAAAdW5yZWFjaGFibGUA0AAAAAgAAAAEAAAA0QAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHBuZy0wLjE3Ljdcc3JjXHRleHRfbWV0YWRhdGEucnMAAGxAEABeAAAAuQAAACYAAABJbnZhbGlkS2V5d29yZFNpemVVbnJlcHJlc2VudGFibGVNaXNzaW5nQ29tcHJlc3Npb25GbGFnSW52YWxpZENvbXByZXNzaW9uRmxhZ0ludmFsaWRDb21wcmVzc2lvbk1ldGhvZE91dE9mRGVjb21wcmVzc2lvblNwYWNlSW5mbGF0aW9uRXJyb3JNaXNzaW5nTnVsbFNlcGFyYXRvcgAADwAAABIAAAAUAAAADgAAABcAAAAYAAAAFgAAABYAAADuQBAA3EAQAGZBEABYQRAAQUEQAClBEAATQRAA/UAQAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHBuZy0wLjE3Ljdcc3JjXHV0aWxzLnJzAEGghMEAC40HYXR0ZW1wdCB0byBkaXZpZGUgYnkgemVybwAAALxBEABWAAAAJAAAABYAAAC8QRAAVgAAACUAAAAaAAAA/0M6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHBuZy0wLjE3Ljdcc3JjXGRlY29kZXJcbW9kLnJzAAAAXUIQAFwAAACaAwAACQAAAF1CEABcAAAAoAMAABkAAAACAAAAAQAAAAQAAAABAAAAAQAAAAEAAAADAAAAAQAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvYWxsb2Mvc3JjL3ZlYy9tb2QucnP8QhAATAAAANQHAAAkAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNccG5nLTAuMTcuN1xzcmNcdXRpbHMucnMAAFhDEABWAAAALwAAABIAAABhdHRlbXB0IHRvIGRpdmlkZSBieSB6ZXJvAAAAWEMQAFYAAAA2AAAADQAAAFhDEABWAAAANwAAAA0AAABYQxAAVgAAADkAAAANAAAAWEMQAFYAAAA8AAAAIAAAAFhDEABWAAAAPAAAAA0AAABYQxAAVgAAAEgAAAASAAAAWEMQAFYAAABNAAAADQAAAFhDEABWAAAATgAAAA0AAABYQxAAVgAAAE8A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ZW5jb3VudGVyZWRojBAAXwAAAPoBAAAvAAAAZnJhbWUgZGVzY3JpcHRvciBpcyBvdXQtb2YtYm91bmRzdW5zdXBwb3J0ZWQgR0lGIHZlcnNpb25tYWxmb3JtZWQgR0lGIGhlYWRlcmNvbnRyb2wgZXh0ZW5zaW9uIGhhcyB3cm9uZyBsZW5ndGhEZWNvZGluZ0Zvcm1hdEVycm9ydW5kZXJseWluZwDiAAAABAAAAAQAAADjAAAASW8AAOIAAAAEAAAABAAAAOQAAABGb3JtYXQAAOIAAAAEAAAABAAAAOUAAABjYW5ub3QgYWNjZXNzIGEgVGhyZWFkIExvY2FsIFN0b3JhZ2UgdmFsdWUgZHVyaW5nIG9yIGFmdGVyIGRlc3RydWN0aW9uAADmAAAAAAAAAAEAAADnAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9zdGQvc3JjL3RocmVhZC9sb2NhbC5ycwB4jxAATwAAAKYBAAAaAAAA6AAAAAgAAAAEAAAA6QAAAGFzc2VydGlvbiBmYWlsZWQ6IHBpeGVsLmxlbigpID09IDRDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xjb2xvcl9xdWFudC0xLjEuMFxzcmNcbGliLnJzAAAACpAQAFsAAAC6AAAACQAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGdpZi0wLjEyLjBcc3JjXGNvbW1vbi5ycwB4kBAAVwAAAPUAAAAiAAAAeJAQAFcAAAD1AAAALAAAAHiQEABXAAAA9QAAADYAAAB4kBAAVwAAAPUAAABAAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZQB4kBAAVwAAAPUAAABLAAAA6gAAAAgAAAAEAAAA6wAAAOwAAADtAAAADAAAAAQAAAApAAAA7QAAAAwAAAAEAAAAKgAAACkAAABgkRAA7gAAAO8AAAAtAAAA8AAAAPEAAABjYXBhY2l0eSBvdmVyZmxvdwAAAJyREAARAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9hbGxvYy9zcmMvdmVjL3NwZWNfZnJvbV9pdGVyX25lc3RlZC5ycwAAuJEQAF4AAAA7AAAAEgAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvY29yZS9zcmMvc2xpY2UvaXRlci5ycwAAKJIQAE4AAABVBwAAEQBBkKXCAAvyMmF0dGVtcHQgdG8gZGl2aWRlIGJ5IHplcm9JbmRleCBvdXQgb2YgYm91bmRzqZIQABMAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL3NvcnQucnMAAMSSEABOAAAAywQAABUAAADEkhAATgAAANkEAAAeAAAAxJIQAE4AAADiBAAAGAAAAMSSEABOAAAA5wQAABwAAABUb28gbXVjaCBvciB0b28gbGl0dGxlIHBpeGVsIGRhdGEgZm9yIHRoZSBnaXZlbiB3aWR0aCBhbmQgaGVpZ2h0IHRvIGNyZWF0ZSBhIEdJRiBGcmFtZQAAVJMQAFYAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xnaWYtMC4xMi4wXHNyY1xjb21tb24ucnMAtJMQAFcAAADQAAAACQAAAHNwZWVkIG5lZWRzIHRvIGJlIGluIHRoZSByYW5nZSBbMSwgMzBdAAC0kxAAVwAAANEAAAAJAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZQC0kxAAVwAAAPUAAABLAAAAZGVzY3JpcHRpb24oKSBpcyBkZXByZWNhdGVkOyB1c2UgRGlzcGxheXRoZSBHSUYgZm9ybWF0IHJlcXVpcmVzIGEgY29sb3IgcGFsZXR0ZSBidXQgbm9uZSB3YXMgZ2l2ZW4AALiUEAA6AAAAdGhlIGltYWdlIGhhcyB0b28gbWFueSBjb2xvcnMAAAD8lBAAHQAAAPIAAAAIAAAABAAAALAAAADyAAAACAAAAAQAAACxAAAAsAAA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IGNvZGUgc2l6ZSAxMiByZXF1aXJlZCwgZ290IABInBAAIwAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHdlZXpsLTAuMS43XHNyY1xsaWIucnMAAAB0nBAAVQAAAF8AAAAFAAAATWluaW11bSBjb2RlIHNpemUgMiByZXF1aXJlZCwgZ290IAAA3JwQACIAAAB0nBAAVQAAAGgAAAAFAAAAdJwQAFUAAABpAAAABQAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHdlZXpsLTAuMS43XHNyY1xlbmNvZGUucnMonRAAWAAAAP8BAAAVAAAACwEAAAwAAAAEAAAADAEAAA0BAAAOAQAAYSBEaXNwbGF5IGltcGxlbWVudGF0aW9uIHJldHVybmVkIGFuIGVycm9yIHVuZXhwZWN0ZWRseQAPAQAAAAAAAAEAAAA2AAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9hbGxvYy9zcmMvc3RyaW5nLnJzAPCdEABLAAAA6QkAAA4AAAAKClN0YWNrOgoKAAAQAQAABAAAAAQAAAARAQAAEgEAABMBAABKc1ZhbHVlKCkAAABwnhAACAAAAHieEAABAAAAGQEAAAQAAAAEAAAAGgEAABsBAAAcAQAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZUFjY2Vzc0Vycm9yAACknhAAAAAAAHVuY2F0ZWdvcml6ZWQgZXJyb3JvdGhlciBlcnJvcm91dCBvZiBtZW1vcnl1bmV4cGVjdGVkIGVuZCBvZiBmaWxldW5zdXBwb3J0ZWRvcGVyYXRpb24gaW50ZXJydXB0ZWRhcmd1bWVudCBsaXN0IHRvbyBsb25naW52YWxpZCBmaWxlbmFtZXRvbyBtYW55IGxpbmtzY3Jvc3MtZGV2aWNlIGxpbmsgb3IgcmVuYW1lZGVhZGxvY2tleGVjdXRhYmxlIGZpbGUgYnVzeXJlc291cmNlIGJ1c3lmaWxlIHRvbyBsYXJnZWZpbGVzeXN0ZW0gcXVvdGEgZXhjZWVkZWRzZWVrIG9uIHVuc2Vla2FibGUgZmlsZW5vIHN0b3JhZ2Ugc3BhY2V3cml0ZSB6ZXJvdGltZWQgb3V0aW52YWxpZCBkYXRhaW52YWxpZCBpbnB1dCBwYXJhbWV0ZXJzdGFsZSBuZXR3b3JrIGZpbGUgaGFuZGxlZmlsZXN5c3RlbSBsb29wIG9yIGluZGlyZWN0aW9uIGxpbWl0IChlLmcuIHN5bWxpbmsgbG9vcClyZWFkLW9ubHkgZmlsZXN5c3RlbSBvciBzdG9yYWdlIG1lZGl1bWRpcmVjdG9yeSBub3QgZW1wdHlpcyBhIGRpcmVjdG9yeW5vdCBhIGRpcmVjdG9yeW9wZXJhdGlvbiB3b3VsZCBibG9ja2VudGl0eSBhbHJlYWR5IGV4aXN0c2Jyb2tlbiBwaXBlbmV0d29yayBkb3duYWRkcmVzcyBub3QgYXZhaWxhYmxlYWRkcmVzcyBpbiB1c2Vub3QgY29ubmVjdGVkY29ubmVjdGlvbiBhYm9ydGVkbmV0d29yayB1bnJlYWNoYWJsZWhvc3QgdW5yZWFjaGFibGVjb25uZWN0aW9uIHJlc2V0Y29ubmVjdGlvbiByZWZ1c2VkcGVybWlzc2lvbiBkZW5pZWRlbnRpdHkgbm90IGZvdW5kRXJyb3JraW5kAAAZAQAAAQAAAAEAAAAdAQAAbWVzc2FnZQAZAQAACAAAAAQAAAAeAQAAS2luZE9zY29kZQAAGQEAAAQAAAAEAAAAHwEAACABAAAMAAAABAAAACEBAAAgKG9zIGVycm9yICmknhAAAAAAADCiEAALAAAAO6IQAAEAAABtZW1vcnkgYWxsb2NhdGlvbiBvZiAgYnl0ZXMgZmFpbGVkAABUohAAFQAAAGmiEAANAAAAbGlicmFyeS9zdGQvc3JjL2FsbG9jLnJziKIQABgAAABVAQAACQAAAGNhbm5vdCBtb2RpZnkgdGhlIHBhbmljIGhvb2sgZnJvbSBhIHBhbmlja2luZyB0aHJlYWSwohAANAAAAGxpYnJhcnkvc3RkL3NyYy9wYW5pY2tpbmcucnPsohAAHAAAAIYAAAAJAAAA7KIQABwAAAA+AgAAHgAAAOyiEAAcAAAAPQIAAB8AAAAgAQAADAAAAAQAAAAiAQAAGQEAAAgAAAAEAAAAIwEAACQBAAAQAAAABAAAACUBAAAmAQAAGQEAAAgAAAAEAAAAJwEAACgBAAAZAQAAAAAAAAEAAAApAQAAVW5zdXBwb3J0ZWQAGQEAAAQAAAAEAAAAKgEAAEN1c3RvbWVycm9yABkBAAAEAAAABAAAACsBAABVbmNhdGVnb3JpemVkT3RoZXJPdXRPZk1lbW9yeVVuZXhwZWN0ZWRFb2ZJbnRlcnJ1cHRlZEFyZ3VtZW50TGlzdFRvb0xvbmdJbnZhbGlkRmlsZW5hbWVUb29NYW55TGlua3NDcm9zc2VzRGV2aWNlc0RlYWRsb2NrRXhlY3V0YWJsZUZpbGVCdXN5UmVzb3VyY2VCdXN5RmlsZVRvb0xhcmdlRmlsZXN5c3RlbVF1b3RhRXhjZWVkZWROb3RTZWVrYWJsZVN0b3JhZ2VGdWxsV3JpdGVaZXJvVGltZWRPdXRJbnZhbGlkRGF0YUludmFsaWRJbnB1dFN0YWxlTmV0d29ya0ZpbGVIYW5kbGVGaWxlc3lzdGVtTG9vcFJlYWRPbmx5RmlsZXN5c3RlbURpcmVjdG9yeU5vdEVtcHR5SXNBRGlyZWN0b3J5Tm90QURpcmVjdG9yeVdvdWxkQmxvY2tBbHJlYWR5RXhpc3RzQnJva2VuUGlwZU5ldHdvcmtEb3duQWRkck5vdEF2YWlsYWJsZUFkZHJJblVzZU5vdENvbm5lY3RlZENvbm5lY3Rpb25BYm9ydGVkTmV0d29ya1VucmVhY2hhYmxlSG9zdFVucmVhY2hhYmxlQ29ubmVjdGlvblJlc2V0Q29ubmVjdGlvblJlZnVzZWRQZXJtaXNzaW9uRGVuaWVkTm90Rm91bmRvcGVyYXRpb24gc3VjY2Vzc2Z1bAAOAAAAEAAAABYAAAAVAAAACwAAABYAAAANAAAACwAAABMAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAARAAAAEgAAABAAAAAQAAAAEwAAABIAAAANAAAADgAAABUAAAAMAAAACwAAABUAAAAVAAAADwAAAA4AAAATAAAAJgAAADgAAAAZAAAAFwAAAAwAAAAJAAAACgAAABAAAAAXAAAAGQAA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',
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

        commands.forEach((command) => {
          const value = (command.param ?? 0).toString();
          command.param = parseFloat(value);
        });

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
          commands.push({ name: option[0], param: 0 });
          break;
        case 'flap':
          commands.push({ name: 'flip', param: 1 });
          break;
        case 'speed': {
          const param = option[1]?.toString() ?? '';

          commands.push({
            name: option[0],
            param: Math.max(2, parseFloat(param)),
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
            param: option[1] === 'glitter' ? 1 : 0,
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
          let speed = 8;
          const param = option[1];

          if (param === 'fast') speed = 6;
          else if (param === 'faster') speed = 4;
          else if (param === 'hyper') speed = 2;

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
