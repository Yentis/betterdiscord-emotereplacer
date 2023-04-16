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
  modifiers = [];

  start(listenersService, settingsService, htmlService) {
    this.listenersService = listenersService;
    this.settingsService = settingsService;
    this.htmlService = htmlService;
    this.initEmotes();

    return Promise.resolve();
  }

  initEmotes() {
    Promise.all([this.getEmoteNames(), this.getModifiers()])
      .then(([emoteNames, modifiers]) => {
        this.setEmoteNames(emoteNames);
        this.modifiers = modifiers;

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

  async getModifiers() {
    const data = await PromiseUtils.urlGetBuffer(
      'https://raw.githubusercontent.com/Yentis/betterdiscord-emotereplacer/master/modifiers.json'
    );
    return JSON.parse(data.toString());
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
          'AGFzbQEAAAABtQIpYAJ/fwF/YAJ/fwBgA39/fwF/YAF/AGABfwF/YAN/f38AYAZ/f39/f38AYAR/f39/AGABfwF+YAV/f39/fwBgAn99AX1gBX9/f39/AX9gAAF/YAN/f30AYAAAYAJ9fQF9YAF9AX1gBn9/f39/fwF/YAN/fX8AYAd/f39/f39/AX9gA399fQBgBH9/f38Bf2AAAXxgCH9/f39/f39/AGACf30AYAR/f35+AGAHf39/f39/fwBgCX9/f39/f35+fgBgB39/f39/fn4AYAJ/fwF+YAN+f38Bf2ATf39/f39/f39/f39/f39/f39/fwF/YAt/f39/f39/f39/fwF/YAN/fn4AYAV/f31/fwBgBH99f38AYAV/f35/fwBgBH9+f38AYAV/f3x/fwBgBH98f38AYAF8AXwC9AgiA3diZxpfX3diaW5kZ2VuX29iamVjdF9kcm9wX3JlZgADA3diZxVfX3diaW5kZ2VuX3N0cmluZ19nZXQAAQN3YmcVX193YmluZGdlbl9udW1iZXJfZ2V0AAEDd2JnFV9fd2JpbmRnZW5fc3RyaW5nX25ldwAAA3diZxRfX3diaW5kZ2VuX2Vycm9yX25ldwAAA3diZxRfX3diaW5kZ2VuX2lzX29iamVjdAAEA3diZxlfX3diaW5kZ2VuX2pzdmFsX2xvb3NlX2VxAAADd2JnFl9fd2JpbmRnZW5fYm9vbGVhbl9nZXQABAN3YmcdX193YmdfU3RyaW5nXzg4ODEwZGZlYjQwMjE5MDIAAQN3YmcaX193YmdfZ2V0XzI3ZmUzZGFjMWM0ZDAyMjQAAAN3YmcdX193YmdfbGVuZ3RoX2U0OThmYmMyNGY5YzFkNGYABAN3YmcWX193YmluZGdlbl9pc19mdW5jdGlvbgAEA3diZxtfX3diZ19uZXh0X2I3ZDUzMGMwNGZkOGIyMTcABAN3YmcbX193YmdfbmV4dF84ODU2MGVjMDZhMDk0ZGVhAAQDd2JnG19fd2JnX2RvbmVfMWViZWMwM2JiZDkxOTg0MwAEA3diZxxfX3diZ192YWx1ZV82YWM4ZGE1Y2M1YjNlZmRhAAQDd2JnH19fd2JnX2l0ZXJhdG9yXzU1ZjExNDQ0NjIyMWFhNWEADAN3YmcaX193YmdfZ2V0X2JhZjQ4NTVmOWE5ODYxODYAAAN3YmcbX193YmdfY2FsbF85NWQxZWE0ODhkMDNlNGU4AAADd2JnHl9fd2JnX2lzQXJyYXlfMzlkMjg5OTdiZjZiOTZiNAAEA3diZy1fX3diZ19pbnN0YW5jZW9mX0FycmF5QnVmZmVyX2E2OWYwMmVlNGM0ZjUwNjUABAN3YmceX193YmdfZW50cmllc180ZTEzMTViNzc0MjQ1OTUyAAQDd2JnHV9fd2JnX2J1ZmZlcl9jZjY1YzA3ZGUzNGI5YTA4AAQDd2JnGl9fd2JnX25ld181MzdiNzM0MWNlOTBiYjMxAAQDd2JnGl9fd2JnX3NldF8xNzQ5OWU4YWE0MDAzZWJkAAUDd2JnHV9fd2JnX2xlbmd0aF8yN2EyYWZlOGFiNDJiMDlmAAQDd2JnLF9fd2JnX2luc3RhbmNlb2ZfVWludDhBcnJheV8wMWNlYmU3OWNhNjA2Y2NhAAQDd2JnHV9fd2JnX3JhbmRvbV9hZmIzMjY1NTI3Y2Y2N2M4ABYDd2JnGl9fd2JnX25ld19hYmRhNzZlODgzYmE4YTVmAAwDd2JnHF9fd2JnX3N0YWNrXzY1ODI3OWZlNDQ1NDFjZjYAAQN3YmccX193YmdfZXJyb3JfZjg1MTY2N2FmNzFiY2ZjNgABA3diZxdfX3diaW5kZ2VuX2RlYnVnX3N0cmluZwABA3diZxBfX3diaW5kZ2VuX3Rocm93AAEDd2JnEV9fd2JpbmRnZW5fbWVtb3J5AAwDxwPFAwkXBgYNAgcEBgEGBQAGBwEFBwEBABgAEAMABQUJGQICBQUBAREFBgcSAwIFAgcAAQMFAQEBAQEDAQsBEgECAAMCAQABARoAGwAABgATBA0CAAscAAAAAAAAHR4FAwAHAwMAAgEBAQAMAAEDAwEFAQcAAAEABgQFAAABBQEBAQEBAQUFAQEFBQAfAAkLBwsBIAcDBBMBAAYAAAAAAAEUAAEEAwEACQAhAgUFAQUADBQAAAEBBAEAAAMACQAAAAAAAQAAAAAAAAAAAAAAAAQDDQMAAAMBAQ4AAQEAAQEDAwAAAAAAAAEFAAICAAcCAgEGAgIBAw4OAQEABQsAAAAAAAABAQEAAwAABAUAAAAAAAUFAQcFAAAAAQEDBQcDAgUAEQEAAAAACQsiJCYBAAEDAwEHAAAEBQAAAgEDAAABAQEBAAAGBA8PBAAAAAQB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ACABLwFAIg8gAS8BCCIGIAEtAEhrQf//A3FHDQIgAS0ACiITQQxJDQEMAgsgDyATQdCzwgAQzQEACyABIBNBAWo6AAogASAGQQF0QQFyOwEICyABIA9BAWo7AUAgByETIAwhDwtBACENIAghDCAORQ0ACwwBC0EBIBQgDUEBcRshFAtBASEGIAlFDQAgCiABKAIUIgJLDQIgASgCECAJIAoQwgMaIAEgCjYCGCABIAo2AhwLIBRBACAUQQFHGwshDiABIAw7ATogASAGOwE4IAFBPmogEzoAACABQTxqIA87AQAgACAFIBBrNgIEIAAgAyASazYCACAAIA4gFCADIBJLGzoACAwBCyAKIAJBoLLCABCXAwALIAtB0ABqJAALryECHX8DfiMAQdAAayILJAACQAJ/An8CQAJAAkACQAJAAkACQAJ/AkACQAJAAkACQCABLQBHRQRAIAEpAzghIyABQQA7ATggI0L//wODUEUNAiABLQALIgggAS0ACiIJSQ0BIAMhEiAIIQwMBQsgAEECOgAIIABCADcCAAwPCyALQgA3AxgCfyADQcAAIAhrIgdB+AFxQQN2IgxJBEAgA0EJTw0DIAtBGGogAiADEMIDGiADQQN0IQdBkLDCAAwBCyAHQf8BcUHIAE8NAyALQRhqIAJBACADIAxPGyAMEMIDGiAHQfgBcSEHIAMgDGshEiACIAxqCyECIAEgByAIaiIMOgALIAEgASkDACALKQMYIAithoQ3AwAMAwsgI0IQiKchDCAjQjCIpyETIAMhEiAjQiCIpwwDCyADQQhB4LLCABCXAwALIAxBCEHQssIAEJcDAAsgCSAMQf8BcUsEQEEBIRQMCAsgASAMIAlrOgALIAEgASkDACIjIAmtiDcDAEEDIRQgAS8BCCAjp3EiDCABLwFATw0HIAwgAS8BQkYNASABLwFEIAxB//8DcUYNAiABQSBqIQggAUEoaiIJKAIABEAgAUEQaiAIIAwQcRogCSgCACIJIAxB//8DcSIITQ0EIAFBJGooAgAgCEECdGoiCC0AAiETIAgvAQAMAQsgAS0ASUUNByABEJQCIAFBEGogCCAMEHEaIAFBKGooAgAiCSAMQf//A3EiCE0NBCABQSRqKAIAIAhBAnRqIggtAAIhEyAILwEACyEPIAFBHGooAgAiCCABQRhqKAIAIglJDQQg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NwNwIANCADcDaCADQgA3A2AgA0IANwNYIANCADcDUCADQgA3A0ggA0IANwNAIANCADcDOCADQgA3AzAgA0IANwMoIANCADcDICADQgA3AxggA0IANwMQIANCADcDCCADQgA3AwAgA0IANwO4AiADQgA3A7ACIANCADcDqAIgA0IANwOgAiADQgA3A5gCIANCADcDkAIgA0IANwOIAiADQgA3A4ACIANCADcD+AEgA0IANwPwASADQgA3A+gBIANCADcD4AEgA0IANwPYASADQgA3A9ABIANCADcDyAEgA0IANwPAASADQgA3A7gBIANCADcDsAEgA0IANwOoASADQgA3A6ABIANCADcD2AMgA0IANwPQAyADQgA3A8gDIANCADcDwAMgA0IANwO4AyADQgA3A7ADIANCADcDqAMgA0IANwOgAyADQgA3A5gDIANCADcDkAMgA0IANwOIAyADQgA3A4ADIANCADcD+AIgA0IANwPwAiADQgA3A+gCIANCADcD4AIgA0IANwPYAiADQgA3A9ACIANCADcDyAIgA0IANwPAAiADQeADakEAQdAAEMADGkHcj8MAKAIAIgohByACQQNrQRhtIgVBACAFQQBKGyIOIQYgDkFobCEPIA5BAnRB7I/DAGohBQNAIAQgB08gBCAEIAdJaiADIARBA3RqIAZBAEgEfEQAAAAAAAAAAAUgBSgCALcLOQMAIAVBBGohBSAGQQFqIQYiBCAHS3JFDQALQQAhBgNAQQAhBCADQcACaiAGQQN0aiAcIAAgBEEDdGorAwAgAyAGIARrQQN0aisDAKKgOQMAIAYgCkkEQCAGIAYgCklqIgYgCk0NAQsLRAAAAAAAAPB/RAAAAAAAAOB/IAIgD2oiAkGXCGsiBUH/B0siEBtEAAAAAAAAAABEAAAAAAAAYAMgAkEYayIJQblwSSIRG0QAAAAAAADwPyAJQYJ4SCISGyAJQf8HSiITG0H9FyAJIAlB/RdOG0H+D2sgBSAQGyIVQfBoIAkgCUHwaEwbQZIPaiACQbEHaiARGyIWIAkgEhsgExtB/wdqrUI0hr+iIR4gCkECdCADakHcA2ohD0EPIAJrQR9xIRdBECACa0EfcSEUIAJBGWshGCAKIQUCQANAIANBwAJqIAVBA3RqKwMAIRwCQCAFRQ0AIANB4ANqIQggBSEEA0AgHEQA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ACAUQfABaiIIIApBGGopAgA3AwAgFEHoAWoiByAKQRBqKQIANwMAIBRB4AFqIgYgCkEIaikCADcDACAUIAopAgA3A9gBIBNBOGoiMkEcaigCACEaIBRBEGogFEHYAWoQpgMgFEEIaiAUKAIQIBQoAhQQggMCQAJAAkACQCAUKAIMIjAEQCAUKAIIITQgFEGYAWogCygCADYCACAUQZABaiAIKQMANwMAIBRBiAFqIAcpAwA3AwAgFEGAAWogBikDADcDACAUIBQpA9gBNwN4IBRBwAFqIgcgFEH4AGoiBikCEDcCACAHQRBqIAZBIGooAgA2AgAgB0EIaiAGQRhqKQIANwIAIBRBqAFqIgggFCgCwAEiByAUKALEASIGckH//wNNBH8gCCAHOwECIAhBBGogBjsBAEEBBUEACzsBACAULwGoAQRAIBRB+ABqISwgFC8BqgEhNyAULwGsASE4IBRBzAFqKAIAIRIgFEHQAWooAgAhCkEAISRBACEpIwBB0AFrIhYkACAWIDcgOGxBAnQiBjYCCCAWIAo2AoABAkACfwJAIAYgCkYEQAJAIBpBAWtBHkkEQCAKQXxxIitFDQUgK0EEayIHQQJ2QQFqIgZBAXEhCCAHDQEgEgwECyMAQRBrIgAkACAAQaSnwgA2AgggAEEmNgIEIABB/KbCADYCACMAQRBrIgEkACABQQhqIABBCGooAgA2AgAgASAAKQIANwMAIwBBEGsiACQAIAAgASkCADcDCCAAQQhqQayhwgBBACABKAIIQQEQrAEACyASQQdqIRggBkH+////B3EhBwNAAkAgGEEEayIGLQAABEAgBkH/AToAAAwBCyAYQQdrLQAAIBhBBmstAABBCHRyIBhBBWstAABBEHRyISRBASEpCwJAIBgtAAAEQCAYQf8BOgAADAELIBhBA2stAAAgGEECay0AAEEIdHIgGEEBay0AAEEQdHIhJEEBISkLIBhBCGohGCAHQQJrIgcNAAsMAQsgFkEANgI8IBZBtKXCADYCOCAWQQE2AjQgFkGMpsIANgIwIBZBADYCKCMAQSBrIgEkACABIBZBgAFqNgIEIAEgFkEIajYCACABQRhqIBZBKGoiAEEQaikCADcDACABQRBqIABBCGopAgA3AwAgASAAKQIANwMIQQAgAUHkq8IAIAFBBGpB5KvCACABQQhqQeym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aiADQYgBaigCADYCACAEQSBqIANBgAFqKQMANwIAIARBGGogA0H4AGopAwA3AgAgBEEQaiADQfAAaikDADcCACAEQQhqIANB6ABqKQMANwIAIAQgAykDYDcCACABKAKkAyECIAMgASABKALMAxCPAQJAIAMoAgBBAUcNACACIAMoAgQiBkkNAAJAIAYgAUHAA2oiBSgCCCIETQRAIAUgBjYCCAwBCyAGIAQiAmsiByAFKAIAIAJrSwRAIAUgBCAHEKMBIAUoAgghAgsgBSgCBCIJIAJqIQgCQAJAIAdBAk8EQCAIQQAgB0EBayIEEMADGiAJIAIgBGoiAmohCAwBCyAEIAZGDQELIAhBADoAACACQQFqIQILIAUgAjYCCAsgA0HgAGohBAJAAkACQAJAIAFB1ANqKAIAIgJFBEAgBEEBNgIEDAELIAJBAE4iBUUNASACIAUQ/wIiBkUNAiAEIAY2AgQLIAQgAjYCACAEIAI2AggMAgsQlgIACyACIAUQvAMACyABKAKoAwRAIAFBrANqKAIAEDoLIAFBqANqIgIgAykDYDcCACACQQhqIANB6ABqKAIANgIAIwBBEGsiAiQAIAFB0ANqKAIAIQUgASgCzAMhBCACQQhqIAEQiwEgAi0ACSEGIAItAAghByACIAEQiwEgAi0AACACLQABIAQQyQEhCCAAQQRqIgEgBzoADSABIAU2AgQgASAENgIAIAEgBjoADCABIAhBAWs2AgggAkEQaiQAIABBIzoAAAwGCyAAQSI6AAAMBQsgAygCUARAIAMoAlQQOgsgA0EANgJYIANCgICAgBA3A1AgA0HgAGogASADQdAAahBNIAMtAHkiAkEORw0ACwsgA0FAayAGQQhqKAIAIgE2AgAgAyAGKQIAIgo3AzggAykDYCELIABBEGogATYCACAAIAo3AgggACALNwIACyADKAJQRQ0BIAMoAlQQOgwBCyADQQE2AjggA0HQAGogA0E4ahDeAiADQesAaiADQdgAaigCADYAACADIAMpA1A3AGMgAEEhOgAAIAAgAykAYDcAASAAQQhqIANB5wBqKQAANwAACyADQZABaiQADwtBtJjAAEErQZSbwAAQhwIAC7MMAQl/An8CQAJAAkACQAJAAkACQAJAAkACQAJAAkAgAUEgaigCACIKIAJB//8DcSIHSwRAIAFBHGoo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ai0AAGpBAXZqOgAAIAZBCWoiAiACLQAAIANBCWotAAAgBkEDai0AAGpBAXZqOgAAIAZBCmoiAiACLQAAIANBCmotAAAgBkEEai0AAGpBAXZqOgAAIAZBC2oiAiACLQAAIANBC2otAAAgBkEFai0AAGpBAXZqOgAAIAlBBmohCSALQQZrIgtBBUsNAAsLDAELQcD9wABBK0Hg/sAAEIcCAAsMBgsCQCAEQXhxIgIEQCACQQhrIgMEQCAHLQAAIQsDQCAHIAlqIgVBCGoiAiACLQAAIAkgDWoiBkEIai0AACALQf8BcWpBAXZqIgs6AAAgBUEJaiICIAItAAAgBkEJai0AACAFQQFqLQAAakEBdmo6AAAgBUEKaiICIAItAAAgBkEKai0AACAFQQJqLQAAakEBdmo6AAAgBUELaiICIAItAAAgBkELai0AACAFQQNqLQAAakEBdmo6AAAgBUEMaiICIAItAAAgBkEMai0AACAFQQRqLQAAakEBdmo6AAAgBUENaiICIAItAAAgBkENai0AACAFQQVqLQAAakEBdmo6AAAgBUEOaiICIAItAAAgBkEOai0AACAFQQZqLQAAakEBdmo6AAAgBUEPaiICIAItAAAgBkEPai0AACAFQQdqLQAAakEBdmo6AAAgAyAJQQhqIglHDQALCwwBC0HA/cAAQStB0P7AABCHAgALDAULIAQgBEGw/cAAEM0BAAtBwP3AAEErQez9wAAQhwIACyAKIARBjP7AABDNAQALIAQgBEH8/cAAEM0BAAtBnP7AACEQQTEhEQsgGyARNgIEIBsgEDYCACAOKAIIIgIEQCAOKAIMIQEgDiACNgI0IA5BHToAMCAOIAE2AjggAEEEaiAOQTBqELICIABBATYCAAwBCyAPIAFBsANqIgMoAgAiAksNBiABQawDaiICKAIAIBogDxDCAxogASABKAKcAyAPajYCnAMgDyADKAIAIgFLDQcgAEEANgIAIABBFGogGTYCACAAQRBqIBM2AgAgAEENaiAMOgAAIABBDGogHToAACAAQQhqIAQ2AgAgACACKAIAQQFqNgIECyAOQdAAaiQADwsgBSALQYCZwAAQlgMAC0EAQQBBkJnAABDNAQALQQFBAEGgmcAAEJgDAAsgDyAEQaCZwAAQlwMACyAPIARBsJnAABCXAwALIA8gAkHAmcAAEJcDAAsgDyABQdCZwAAQlwMAC44KAQF/IwBBMGsiAiQAAn8CQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgAC0AAEEBaw4RAQIDBAUGBwgJCgsMDQ4PEBEACyACIAAtAAE6AAggAkEkakECNgIAIAJBLGpBATYCACACQYS6wAA2AiAgAkEANgIYIAJB2gA2AhQgAiACQRBqNgIoIAIgAkEIajYCECABIAJBGGoQ6AEMEQsgAiAAKQMINwMIIAJBJGpBAjYCACACQSxqQQE2AgAgAkHoucAANgIgIAJBADYCGCACQdsANgIUIAIgAkEQajYCKCACIAJBCGo2AhAgASACQRhqEOgBDBALIAIgACkDCDcDCCACQSRqQQI2AgAgAkEsakEBNgIAIAJB6LnAADYCICACQQA2AhggAkHcADYCFCACIAJBEGo2AiggAiACQQhqNgIQIAEgAkEYahDoAQwPCyACIAArAwg5AwggAkEkakECNgIAIAJBLGpBATYCACACQcy5wAA2AiAgAkEANgIYIAJB3QA2AhQgAiACQRBqNgIoIAIgAkEIajYCECABIAJBGGoQ6AEMDgsgAiAAKAIENgIIIAJBJGpBAjYCACACQSxqQQE2AgAgAkGsucAANgIgIAJBADYCGCACQd4ANgIUIAIgAkEQajYCKCACIAJBCGo2AhAgASACQRhqEOgBDA0LIAIgACkCBDcDCCACQSRqQQE2AgAgAkEsakEBNgIAIAJBmLnAADYCICACQQA2AhggAkHfADYCFCACIAJBEGo2AiggAiACQQhqNgIQIAEgAkEYahDoAQwMCyACQSRqQQE2AgAgAkEsakEANgIAIAJBiLnAADYCICACQbi3wAA2AiggAkEANgIYIAEgAkEYahDoAQwLCyACQSRqQQE2AgAgAkEsakEANgIAIAJB9LjAADYCICACQbi3wAA2AiggAkEANgIYIAEgAkEYahDoAQwKCyACQSRqQQE2AgAgAkEsakEANgIAIAJB4LjAADYCICACQbi3wAA2AiggAkEANgIYIAEgAkEYahDoAQwJCyACQSRqQQE2AgAgAkEsakEANgIAIAJBzLjAADYCICACQbi3wAA2AiggAkEANgIYIAEgAkEYahDoAQwICyACQSRqQQE2AgAgAkEsakEANgIAIAJBtLjAADYCICACQbi3wAA2AiggAkEANgIYIAEgAkEYahDoAQwHCyACQSRqQQE2AgAgAkEsakEANgIAIAJBpLjAADYCICACQbi3wAA2AiggAkEANgIYIAEgAkEYahDoAQwGCyACQSRqQQE2AgAgAkEsakEANgIAIAJBmLjAADYCICACQbi3wAA2AiggAkEANgIYIAEgAkEYahDoAQwFCyACQSRqQQE2AgAgAkEsakEANgIAIAJBjLjAADYCICACQbi3wAA2AiggAkEANgIYIAEgAkEYahDoAQwECyACQSRqQQE2AgAgAkEsakEANgIAIAJB+LfAADYCICACQbi3wAA2AiggAkEANgIYIAEgAkEYahDoAQwDCyACQSRqQQE2AgAgAkEsakEANgIAIAJB4LfAADYCICACQbi3wAA2AiggAkEANgIYIAEgAkEYahDoAQwCCyACQSRqQQE2AgAgAkEsakEANgIAIAJByLfAADYCICACQbi3wAA2AiggAkEANgIYIAEgAkEYahDoAQwBCyABIAAoAgQgAEEIaigCABD4AgsgAkEwaiQAC5YJAxV/A30BfiMAQSBrIgUkAAJAIABBCGooAgAiBEUNACAFQQhqIABBBGooAgAiCxCmAyAFIAUoAgggBSgCDBCCAyAFKAIAsyAFKAIEs5RDAAAgQZUiFyABXw0AAn8CQAJAAkACQAJAAkAgBEHj8bgcSw0AIARBJGwiB0EASA0AIARB5PG4HElBAnQhAiAHBH8gByACEP4CBSACCyIMRQ0DIAUgDDYCFCAFIAQ2AhAgCyAEQSRsIgZqIREgBCEHIAshAgNAIAYgCkcEQCAHRQ0DIAJBHGooAgAhCCACKAIMIQ0gAigCCCEOIAIoAgQhDyACKAIAIRACQCACQSBqKAIAIglFBEBBASEDDAELIAlBAEgNAyAJQQEQ/gIiA0UNBQsgAyAIIAkQwgMhCCACKQIQIRogCiAMaiIDQQRqIA82AgAgA0EIaiAONgIAIANBDGogDTYCACADQSBqIAk2AgAgA0EcaiAINgIAIANBGGogCTYCACADQRBqIBo3AgAgAyAQNgIAIApBJGohCiACQSRqIQIgB0EBayIHDQELCyAFIAQ2AhggASAXXUUgF0MAAABAX3INBSAEsyEZQSQhAkF/IQ1BASEJA0AgBCANakEkbCEOIAIhByAJIQogCyEDA0AgA0EcaigC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NgIIIAEoAgQgAmoiAUGTncAAKQAANwAAIAFBB2pBmp3AACgAADYAAAJ/IAQoAgAiASgCACABKAIIIgNHBEAgAQwBCyABIANBARCjASABKAIIIQMgBCgCAAshAiABIANBAWo2AgggASgCBCADakEDOgAAIAIoAggiASACKAIARgRAIAIgAUEBEKMBIAIoAgghAQsgAiABQQFqNgIIIAIoAgQgAWpBAToAAARAIAQoAgAiAigCACACKAIIIgFrQQFNBEAgAiABQQIQowEgAigCCCEBCyACIAFBAmo2AgggAigCBCABakEAOwAADAMLIAQoAgAiAigCACACKAIIIgFrQQFNBEAgAiABQQIQowEgAigCCCEBCyACIAFBAmo2AgggAigCBCABaiIBIAVBgP4DcUEIdjoAASABIAU6AAAMAgsgAi0AAiEGIAIvAQQhBSACLQABIQcCfyAEKAIAIgEoAgAgASgCCCIDRwRAIAEMAQsgASADQQEQowEgASgCCCEDIAQoAgALIQIgASADQQFqNgIIIAEoAgQgA2pB+QE6AAAgAigCCCIDIAIoAgBHBH8gAgUgAiADQQEQowEgAigCCCEDIAQoAgALIQEgAiADQQFqNgIIIAIoAgQgA2pBBDoAACABKAIIIgIgASgCAEYEQCABIAJBARCjASABKAIIIQILIAEgAkEBajYCCCABKAIEIAJqIAc6AAAgBUGA/gNxQQh2IQcCfyAEKAIAIgEoAgAgASgCCCIDa0EBSwRAIAEMAQsgASADQQIQowEgASgCCCEDIAQoAgALIQIgASADQQJqNgIIIAEoAgQgA2oiASAHOgABIAEgBToAACACKAIIIgEgAigCAEYEQCACIAFBARCjASACKAIIIQELIAIgAUEBajYCCCACKAIEIAFqIAY6AAAMAQtBkJzAAEErQaCdwAAQhwIACyAEKAIAIgIoAgAgAigCCCIBRgRAIAIgAUEBEKMBIAIoAgghAQsgAiABQQFqNgIIIAIoAgQgAWpBADoAAAsgAEEFOgAAC9wHAQt/IwBBgAFrIgwkAAJAIABFIAJFcg0AA0ACQAJAAkAgACACakEYTwRAIAAgAiAAIAJJIgQbQYEBSQ0DIAQNASABIAJrIQYgAkF8cSELIAJBA3EhCSACQQFrIQhBACACayEKA0BBACEEIAhBA08EQANAIAQgBmoi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AwsgA0UgBUH/AXFBA2tBfklyRQRAIAoQOgsCQAJAQQEgB0EEayAHQf8BcSIDQQNNG0H/AXEOAgQBAAsgBkUNAwwCCyADQQNrQX5JDQIgBg0BDAILIAkhAkEBDAMLIAgQOgsgAiAJRw0AC0EACyEBIAAgAjYCBCAAIAE2AgAgBEEwaiQAC/8xAiR/An4jAEEgayIWJAACQAJAIAEtAKABRQRAIAFBKGohAiABQQxqISMDQCABKAIQIQcCQAJAAkACQCABKAIYIgMgASgCHCILTwRAICMoAgAiCyABKQMAIicgC60iJiAmICdWG6ciA0kNASABKAIgIQUgByABKAIIIANqIAEoAhQiFCALIANrIgMgAyAUSxsiCxDCAxogASALNgIcIAFBADYCGCABIAUgCyAFIAtLGzYCICABICcgC618NwMAQQAhAwsgAyALRgRAQQ5BARD+AiIBRQ0CIAFBBmpBgqrAACkAADcAACABQfypwAApAAA3AABBDEEEEP4CIgNFDQMgA0EONgIIIAMgATYCBCADQQ42AgAgAEEANgIEIABBCzoAACAAQQxqQbSgwAA2AgAgAEEIaiADNgIADAgLIBZBCGohFSADIAdqIRRBACEIQQAhEEEAIQlBACERQQAhFyMAQaABayIGJAACQAJAAkACQCALIANrIh4iDEUNACACLQA0IgVBDkYNACAeRSEEIAJB3gBqIRsgAkEYaiEfIAJBKGohCyACQRBqIRwgAkFAayESIAJBNWohISAGQcgAaiEiIAZBhQFqISQgAkHUAGohGSACQTBqIR0gAkEsaiEgIAJB0ABqISUgAkEkaiEaIAJBIGohGAJAAkADQAJAAkACQAJAAkACfwJAAkACfwJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQCAEQQFxRQRAIAJBDjoANCAULQAAIg/AIQMgAigCPCENIAIoAjghDiACLQA2IQogAi0ANSETQQEhB0EDIQQgBUH/AXFBAWsODQEkAhIDDAQJCAcGBT4jC0EAQQBB2JjCABDNAQALIANBCHQgE3IhDSAKQQFrDgYaGx8eHRwZCyAOQQFrDgYQ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AkEIahDoAQwCCyACIABBEGo2AgQgAkEUakECNgIAIAJBHGpBAjYCACACQSxqQYUBNgIAIAJBuMjAADYCECACQQA2AgggAkGEATYCJCACIAA2AiAgAiACQSBqNgIYIAIgAkEEajYCKCABIAJBCGoQ6AEMAQsgAkEUakEBNgIAIAJBHGpBATYCACACQcjIwAA2AhAgAkEANgIIIAJBhAE2AiQgAiAANgIgIAIgAkEgajYCGCABIAJBCGoQ6AELIAJBMGokAAwFCyAAQQRqIQIgAEEUaiIAKAIARQRAIANBJGpBATYCACADQSxqQQE2AgAgA0GYyMAANgIgIANBADYCGCADQYQBNgIMIAMgAjYCCCADIANBCGo2AiggASADQRhqEOgBDAULIAMgADYCBCADQSRqQQI2AgAgA0EsakECNgIAIANBFGpBhQE2AgAgA0GIyMAANgIgIANBADYCGCADQYQBNgIMIAMgAjYCCCADIANBCGo2AiggAyADQQRqNgIQIAEgA0EYahDoAQwECyMAQTBrIgIkAAJAAkACQAJAAkACQCAAQQRqIgQoAgBBAWsOAwABAgMLQQEhACACQRxqQQE2AgAgAkEkakEANgIAIAJBnMfAADYCGCACQZjDwAA2AiAgAkEANgIQIAEgAkEQahDoAUUNAwwECyACIARBBGo2AgxBASEAIAJBHGpBATYCACACQSRqQQE2AgAgAkHQxsAANgIYIAJBADYCECACQYIBNgIsIAIgAkEoajYCICACIAJBDGo2AiggASACQRBqEOgBRQ0CDAMLQQEhACACQRxqQQE2AgAgAkEkakEANgIAIAJBrMbAADYCGCACQZjDwAA2AiAgAkEANgIQIAEgAkEQahDoAUUNAQwCC0EBIQAgAkEcakEBNgIAIAJBJGpBADYCACACQdzHwAA2AhggAkGYw8AANgIgIAJBADYCECABIAJBEGoQ6AENAQsgBCgCEEUEQEEAIQAMAQsgAiAEQRBqNgIMIAJBHGpBATYCACACQSRqQQE2AgAgAkHox8AANgIYIAJBADYCECACQYUBNgIsIAIgAkEoajYCICACIAJBDGo2AiggASACQRBqEOgBIQALIAJBMGokACAADAMLAkACQAJAQQIgACkDCCIFp0ECayAFQgFYG0EBaw4CAQIACyADQSRqQQE2AgAgA0EsakEANgIA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IAEgCWohBiAAIAlrIQcgDCAAIAlHBH8gBiAHakEBay0AAEEKRgVBAAs6AAAgAyEJIAsgBiAHIAooAgwRAgBFDQELC0EBCyAFQTBqJAALzgMBAn8jAEHgAGsiAiQAAkACQAJAAkACQAJAAkBBASABLQAAIgNBH2sgA0EeTRtB/wFxQQFrDgMBAgMACyAAQQU2AgAgACABKQIENwIEDAMLIABBADsBBEEUQQQQ/gIiA0UNAyAAQQA2AgAgAyABKQIANwIAIABBGGpBsL/AADYCACAAQRRqIAM2AgAgA0EQaiABQRBqKAIANgIAIANBCGogAUEIaikCADcCAAwCCyACQRhqIAFBEGooAgA2AgAgAkEQaiABQQhqKQIANwMAIAIgASkCADcDCCACQQA2AiggAkKAgICAEDcDICACQTBqIgEgAkEgakHcwcAAELsCIAJBCGogARByDQMgAEEIaiACKQMgNwIAIABBEGogAkEoaigCADYCACAAQRRqQQA2AgAgAEKCgICAIDcDACACLQAIQR9HDQEgAi0ADEEDRw0BIAJBEGooAgAiACgCACAAKAIEKAIAEQMAIAAoAgQiAUEEaigCAARAIAFBCGooAgAaIAAoAgAQOgsgAigCEBA6DAELIABBAzYCACAAQgM3AwgLIAJB4ABqJAAPC0EUQQQQvAMAC0H0wcAAQTcgAkHYAGpBrMLAAEGIw8AAEMYBAAvABAEDfyMAQTBrIgIkAAJ/AkACQAJAAkAgACgCBCIDDgMAAgMBCyMAQRBrIgAkACAAQci7wAA2AgggAEEONgIEIABBurvAADYCACMAQRBrIgEkACABQQhqIABBCGooAgA2AgAgASAAKQIANwMAIwBBEGsiACQAIAAgASkCADcDCCAAQQhqQeS7wABBACABKAIIQQEQrAEACyACQSRqQQE2AgAgAkEsakEANgIAIAJBnLrAADYCICACQbi3wAA2AiggAkEANgIYQQEgASACQRhqEOgBDQIaIANBA3QhAyAAKAIAIQACQANAIAIgADYCFCAEBEAgAkEBNgIkIAJBqLrAADYCICACQQA2AiwgAkG4t8AANgIoIAJBADYCGCABIAJBGGoQ6AENAgsgAkECNgIkIAJBsLrAADYCICACQQE2AiwgAkEANgIYIAJB4AA2AgQgAiACNgIoIAIgAkEUajYCACABIAJB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SUEBdCEGAkAgBARAIAJBAjYCGCACIAM2AhQgAiAAQQRqKAIANgIQDAELIAJBADYCGAsgAiAFIAYgAkEQahCyASACKAIEIQMgAigCAEUEQCAAIAE2AgAgAEEEaiADNgIADAILIAJBCGooAgAiAEGBgICAeEYNASAARQ0AIAMgABC8AwALEJYCAAsgAkEgaiQAC88BAQJ/IwBBIGsiAyQAAkACQCABIAEgAmoiAUsNAEEIIAAoAgAiAkEBdCIEIAEgASAESRsiASABQQhNGyIBQX9zQR92IQQCQCACBEAgA0EBNgIYIAMgAjYCFCADIABBBGooAgA2AhAMAQsgA0EANgIYCyADIAEgBCADQRBqELIBIAMoAgQhAiADKAIARQRAIAAgATYCACAAQQRqIAI2AgAMAgsgA0EIaigCACIAQYGAgIB4Rg0BIABFDQAgAiAAELwDAAsQlgIACyADQSBqJAALzwEBAn8jAEEgayIDJAACQAJAIAEgASACaiIBSw0AQQggACgCACICQQF0IgQgASABIARJGyIBIAFBCE0bIgFBf3NBH3YhBAJAIAIEQCADQQE2AhggAyACNgIUIAMgAEEEaigCADYCEAwBCyADQQA2AhgLIAMgASAEIANBEGoQrgEgAygCBCECIAMoAgBFBEAgACABNgIAIABBBGogAjYCAAwCCyADQQhqKAIAIgBBgYCAgHhGDQEgAEUNACACIAAQvAMACxCWAgALIANBIGokAAvNAQEDfyMAQSBrIgIkAAJAAkAgAUEBaiIBRQ0AQQggACgCACIDQQF0IgQgASABIARJGyIBIAFBCE0bIgFBf3NBH3YhBAJAIAMEQCACQQE2AhggAiADNgIUIAIgAEEEaigCADYCEAwBCyACQQA2AhgLIAIgASAEIAJBEGoQsgEgAigCBCEDIAIoAgBFBEAgACABNgIAIABBBGogAzYCAAwCCyACQQhqKAIAIgBBgYCAgHhGDQEgAEUNACADIAAQvAMACxCWAgALIAJBIGokAAvNAQEDfyMAQSBrIgIkAAJAAkAgAUEBaiIBRQ0AQQggACgCACIDQQF0IgQgASABIARJGyIBIAFBCE0bIgFBf3NBH3YhBAJAIAMEQCACQQE2AhggAiADNgIUIAIgAEEEaigCADYCEAwBCyACQQA2AhgLIAIgASAEIAJBEGoQrgEgAigCBCEDIAIoAgBFBEAgACABNgIAIABBBGogAzYCAAwCCyACQQhqKAIAIgBBgYCAgHhGDQEgAEUNACADIAAQvAMACxCWAgALIAJBIGokAAvMAQECfyMAQSBrIgMkAAJAAkAgASABIAJqIgFLDQBBCCAAKAIAIgJBAXQiBCABIAEgBEkbIgEgAUEITRsiAUF/c0EfdiEEAkAgAgRAIANBATYCGCADIAI2AhQgAyAAQQRqKAIANgIQDAELIANBADYCGAsgAyABIAQgA0EQahCyASADKAIEIQIgAygCAEUEQCAAIAE2AgAgACACNgIEDAILIANBCGooAgAiAEGBgICAeEYNASAARQ0AIAIgABC8AwALEJYCAAsgA0EgaiQAC8wBAQJ/IwBBIGsiAyQAAkACQCABIAEgAmoiAUsNAEEIIAAoAgAiAkEBdCIEIAEgASAESRsiASABQQhNGyIBQX9zQR92IQQCQCACBEAgA0EBNgIYIAMgAjYCFCADIABBBGooAgA2AhAMAQsgA0EANgIYCyADIAEgBCADQRBqEK4BIAMoAgQhAiADKAIARQRAIAAgATYCACAAIAI2AgQMAgsgA0EIaigCACIAQYGAgIB4Rg0BIABFDQAgAiAAELwDAAsQlgIACyADQSBqJAAL0gEBAX8jAEEwayICJAACfyAAKAIAKAIAIgAoAgBFBEAgAiAAKAIENgIAIAIgACgCCDYCBCACQSRqQQI2AgAgAkEsakECNgIAIAJBFGpBNjYCACACQdTywAA2AiAgAkEANgIYIAJBNjYCDCACIAJBCGo2AiggAiACQQRqNgIQIAIgAjYCCCABIAJBGGoQ6AEMAQsgAkEkakEBNgIAIAJBLGpBADYCACACQazywAA2AiAgAkGU8MAANgIoIAJBADYCGCABIAJBGGoQ6AELIAJBMGokAAvYAQEBfyMAQRBrIhMkACAAKAIAIAEgAiAAKAIEKAIMEQIAIQEgE0EAOgANIBMgAToADCATIAA2AgggE0EIaiADIAQgBSAGEHMgByAIIAkgChBzIAsgDCANIA4QcyAPIBAgESASEHMhAQJ/IBMtAAwiACATLQANRQ0AGiAAQf8BcSECQQEgAg0AGiABKAIAIgAtABhBBHFFBEAgACgCAEHH8MIAQQIgACgCBCgCDBECAAwBCyAAKAIAQcbwwgBBASAAKAIEKAIMEQIACyATQRBqJABB/wFxQQBHC+cBAQF/IwBBEGsiAiQAIAIgADYCACACIABBBGo2AgQgASgCAEGpiMMAQQkgASgCBCgCDBECACEAIAJBADoADSACIAA6AAwgAiABNgIIIAJBCGpBsojDAEELIAJBlIjDABBzQb2IwwBBCSACQQRqQciIwwAQcyEAAn8gAi0ADCIBIAItAA1FDQAaIAFB/wFxIQFBASABDQAaIAAoAgAiAC0AGEEEcUUEQCAAKAIAQcfwwgBBAiAAKAIEKAIMEQIADAELIAAoAgBBxvDCAEEBIAAoAgQoAgwRAgALIAJBEGokAEH/AXFBAEcLiAIBAn8jAEEgayIFJABB8JLDAEHwksMAKAIAIgZBAWo2AgACQAJAIAZBAEgNAEHUlsMAQdSWwwAoAgBBAWoiBjYCACAGQQJLDQAgBSAEOgAYIAUgAzYCFCAFIAI2AhAgBUHgxcIANgIMIAVBhLzCADYCCEHgksMAKAIAIgJBAEgNAEHgksMAIAJBAWoiAjYCAEHgksMAQeiSwwAoAgAEfyAFIAAgASgCEBEBACAFIAUpAwA3AwhB6JLDACgCACAFQQhqQeySwwAoAgAoAhQRAQBB4JLDACgCAAUgAgtBAWs2AgAgBkEBSw0AIAQNAQsACyMAQRBrIgIkACACIAE2AgwgAiAANgIIAAvUAQEBfyMAQRBrIgUkACAFIAAoAgAgASACIAAoAgQoAgwRAgA6AAggBSAANgIEIAUgAkU6AAkgBUEANgIAIAUgA0G46MAAEIQBIARBqOjAABCEASEAAn8gBS0ACCIBIAAoAgAiAkUNABpBASABDQAaIAUoAgQhAAJAIAJBAUcNACAFLQAJRQ0AIAAtABhBBHENAEEBIAAoAgBBzPDCAEEBIAAoAgQoAgwRAgANARoLIAAoAgBBzO3CAEEBIAAoAgQoAgwRAgALIAVBEGokAEH/AXFBAEcLugEAAkAgAgRAAkACQAJ/AkACQCABQQBOBEAgAygCCA0BIAENAkEBIQIMBAsMBgsgAygCBCICRQRAIAFFBEBBASECDAQLIAFBARD+AgwCCyADKAIAIAJBASABEPICDAELIAFBARD+AgsiAkUNAQsgACACNgIEIABBCGogATYCACAAQQA2AgAPCyAAIAE2AgQgAEEIakEBNgIAIABBATYCAA8LIAAgATYCBAsgAEEIakEANgIAIABBATYCAAvPAQEBfyMAQRBrIgUkACAFIAAoAgAgASACIAAoAgQoAgwRAgA6AAggBSAANgIEIAUgAkU6AAkgBUEANgIAIAUgAyAEEIQBIQECfyAFLQAIIgAgASgCACICRQ0AGiAAQf8BcSEBQQEgAQ0AGiAFKAIEIQECQCACQQFHDQAgBS0ACUUNACABLQAYQQRxDQBBASABKAIAQczwwgBBASABKAIEKAIMEQIADQEaCyABKAIAQcztwgBBASABKAIEKAIMEQIACyAFQRBqJABB/wFxQQBHC7oBAgF+A38CQCABKAIYIgVFDQACQCABKQMAIgJQBEAgASgCECEEIAEoAgghAwNAIARBIGshBCADKQMAIANBCGohA0J/hUKAgYKEiJCgwIB/gyICUA0ACyABIAQ2AhAgASADNgIIIAEgAkIBfSACgzcDAAwBCyABIAJCAX0gAoM3AwAgASgCECIERQ0BCyABIAVBAWs2AhhBASEDIAAgBCACeqdBAXZBPHFrQQRrKAAANgABCyAAIAM6AAALxAEBAX8jAEEQayILJAAgACgCACABIAIgACgCBCgCDBECACEBIAtBADoADSALIAE6AAwgCyAANgIIIAtBCGogAyAEIAUgBhBzIAcgCCAJIAoQcyEBAn8gCy0ADCIAIAstAA1FDQAaIABB/wFxIQJBASACDQAaIAEoAgAiAC0AGEEEcUUEQCAAKAIAQcfwwgBBAiAAKAIEKAIMEQIADAELIAAoAgBBxvDCAEEBIAAoAgQoAgwRAgALIAtBEGokAEH/AXFBAEcLrQEBAX8CQCACBEACfwJAAkACQCABQQBOBEAgAygCCEUNAiADKAIEIgQNASABDQMgAgwECyAAQQhqQQA2AgAMBQsgAygCACAEIAIgARDyAgwCCyABDQAgAgwBCyABIAIQ/gILIgMEQCAAIAM2AgQgAEEIaiABNgIAIABBADYCAA8LIAAgATYCBCAAQQhqIAI2AgAMAQsgACABNgIEIABBCGpBADYCAAsgAEEBNgIAC4gBAQN/IAAoAggiAQRAIAAoAgQhAiABQThsIQNBACEBA0AgASACaiIAQRBqKAIABEAgAEEUaigCABA6CyAAQRxqKAIABEAgAEEgaigCABA6CyAAQShqKAIABEAgAEEsaigCABA6CyAAQQRqKAIABEAgAEEIaigCABA6CyADIAFBOGoiAUcNAAsLC6sBAQF/IwBB4ABrIgEkACABQRhqIABBEGopAgA3AwAgAUEQaiAAQQhqKQIANwMAIAEgACkCADcDCCABQQA2AiggAUKAgICAEDcDICABQTBqIgAgAUEgakH4osAAELsCIAFBCGogABDmAUUEQCABKAIkIAEoAigQBCABKAIgBEAgASgCJBA6CyABQeAAaiQADwtBkKPAAEE3IAFB2ABqQcijwABBpKTAABDGAQALugEBAX8jAEEQayIHJAAgACgCACABIAIgACgCBCgCDBECACEBIAdBADoADSAHIAE6AAwgByAANgIIIAdBCGogAyAEIAUgBhBzIQECfyAHLQAMIgAgBy0ADUUNABogAEH/AXEhAkEBIAINABogASgCACIALQAYQQRxRQRAIAAoAgBBx/DCAEECIAAoAgQoAgwRAgAMAQsgACgCAEHG8MIAQQEgACgCBCgCDBECAAsgB0EQaiQAQf8BcUEARwupAQEDfyMAQTBrIgIkACABKAIERQRAIAEoAgwhAyACQRBqIgRBADYCACACQoCAgIAQNwMIIAIgAkEIajYCFCACQShqIANBEGopAgA3AwAgAkEgaiADQQhqKQIANwMAIAIgAykCADcDGCACQRRqQey7wgAgAkEYahBOGiABQQhqIAQoAgA2AgAgASACKQMINwIACyAAQZjFwgA2AgQgACABNgIAIAJBMGokAAuiAQEBfyMAQUBqIgIkACAAKAIAIQAgAkIANwM4IAJBOGogABAfIAJBFGpBAjYCACACQRxqQQE2AgAgAiACKAI8IgA2AjAgAiACKAI4NgIsIAIgADYCKCACQZUCNgIkIAJB3LvCADYCECACQQA2AgggAiACQShqNgIgIAIgAkEgajYCGCABIAJBCGoQ6AEgAigCKARAIAIoAiwQOgsgAkFAayQAC5oBAQF/IwBBEGsiBiQAAkAgAQRAIAYgASADIAQgBSACKAIQEQkAIAYoAgQhAQJAIAYoAgAiAyAGKAIIIgJNBEAgASEEDAELIAJFBEBBBCEEIAEQOgwBCyABIANBAnRBBCACQQJ0IgEQ8gIiBEUNAgsgACACNgIEIAAgBDYCACAGQRBqJAAPC0GEt8AAQTIQtwMACyABQQQQvAMAC6cBAQF/IwBBIGsiAiQAAn8gAC0A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AiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB0NLAACACQQhqEE4gAkEgaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBuLvCACACQQhqEE4gAkEgaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB7LvCACACQQhqEE4gAkEgaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBnNLCACACQQhqEE4gAkEgaiQAC1MBAn8jAEEgayICJAAgASgCBCEDIAEoAgAgAkEYaiAAQRBqKQIANwMAIAJBEGogAEEIaikCADcDACACIAApAgA3AwggAyACQQhqEE4gAkEgaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB2PLCACACQQhqEE4gAkEgaiQAC1MBAn8jAEEgayICJAAgACgCBCEDIAAoAgAgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAyACQQhqEE4gAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBqIrAACACQQhqEE4gAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBhLXAACACQQhqEE4gAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB0NLAACACQQhqEE4gAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcD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rsAANgIAQeiSwwAoAgAhBEHoksMAQQE2AgBFDQELQfCSwwAoAgBB/////wdxRQ0AEMwDDQBB5JLDAEEBOgAAC0HgksMAQQA2AgACQCAERQ0AIAQgAigCABEDACACQQRqKAIARQ0AIAJBCGooAgAaIAQQOgsgAEEgaiQADAILIABBFGpBATYCACAAQRxqQQA2AgAgAEHExMIANgIQIABBhLzCADYCGCAAQQA2AgggAEEIakHoxMIAEKICAAsACyABQQM6AAwgAUEIaiIAKAIAIAAtAAQ6AAALIAFBIGokAAwECyABQRRqQQE2AgAgAUEcakEANgIAIAFBnLDAADYCEAwCC0GksMAAQStBnLHAABCHAgALIAFBFGpBATYCACABQRxqQQA2AgAgAUHor8AANgIQCyABQfCvwAA2AhggAUEANgIIIAFBCGpByKHAABCiAgALCyADQRBqJAALSgEBfyMAQSBrIgAkACAAQRRqQQE2AgAgAEEcakEANgIAIABB5NLCADYCECAAQbTSwgA2AhggAEEANgIIIABBCGpB7NLCABCiAgALPAAgACABKQMANwMAIABBGGogAUEYaikDADcDACAAQRBqIAFBEGopAwA3AwAgAEEIaiABQQhqKQMANwMAC0YBAn8gASgCBCECIAEoAgAhA0EIQQQQ/gIiAUUEQEEIQQQQvAMACyABIAI2AgQgASADNgIAIABBqMXCADYCBCAAIAE2AgALmXcDFn4ifwF8IAEoAhhBAXEhGCAAKwMAIToCQAJAAkAgASgCEEEBRgRAAn8gASEkIAFBFGooAgAhJyMAQfAIayIfJAAgOr0hAwJAIDogOmIEQEECIQEMAQsgA0L/////////B4MiBkKAgICAgICACIQgA0IBhkL+////////D4MgA0I0iKdB/w9xIgAbIgRCAYMhBUEDIQECQAJAAkBBAUECQQQgA0KAgICAgICA+P8AgyIHUCIZGyAHQoCAgICAgID4/wBRG0EDQQQgGRsgBlAbQQJrDgMAAQIDC0EEIQEMAgsgAEGzCGshHCAFUCEBQgEhAgwBC0KAgICAgICAICAEQgGGIARCgICAgICAgAhRIhkbIQRCAkIBIBkbIQIgBVAhAUHLd0HMdyAZGyAAaiEcCyAfIBw7AegIIB8gAjcD4AggH0IBNwPYCCAfIAQ3A9AIIB8gAToA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QY7twgA2ApQIIB9BAjsBkAggH0GQCGoMAQsgH0EDNgKYCCAfQZHtwgA2ApQIIB9BAjsBkAggH0GQCGoLIQEgH0HMCGogADYCACAfIAE2AsgIIB8gLDYCxAggHyAyNgLACCAkIB9BwAhqEFAgH0HwCGokAAwCC0GU7cIAQSVBvO3CABCHAgALIABBKEGIh8MAEJcDAAsPCyABQQAhASMAQYABayIgJAAgOr0hAgJAIDogOmIEQEECIQAMAQsgAkL/////////B4MiBkKAgICAgICACIQgAkIBhkL+////////D4MgAkI0iKdB/w9xIhkbIgNCAYMhBUEDIQACQAJAAkBBAUECQQQgAkKAgICAgICA+P8AgyIHUCIcGyAHQoCAgICAgID4/wBRG0EDQQQgHBsgBlAbQQJrDgMAAQIDC0EEIQAMAgsgGUGzCGshASAFUCEAQgEhBAwBC0KAgICAgICAICADQgGGIANCgICAgICAgAhRIgEbIQNCAkIBIAEbIQQgBVAhAEHLd0HMdyABGyAZaiEBCyAgIAE7AXggICAENwNwICBCATcDaCAgIAM3A2AgICAAOgB6An8gAEECRgRAQZzVwgAhLUEADAELIBhFBEBBi+3CAEGc1cIAIAJCAFMbIS0gAkI/iKcMAQtBi+3CAEGM7cIAIAJCAFMbIS1BAQshMkEBIQECfwJAAkACQAJAQQMgAEECayAAQQFNG0H/AXFBAWsOAwIBAAMLICBBIGohGSAgQQ9qIRojAEEwayIYJAACQAJAAkACQAJAAkACQCAgQeAAaiIAKQMAIgJQRQRAIAApAwgiBFBFBEAgACkDECIDUEUEQCACIAIgA3wiA1gEQCACIARaBEACQAJAIANC//////////8fWARAIBggAC8BGCIAOwEIIBggAiAEfSIENwMAIAAgAEEgayAAIANCgICAgBBUIgEbIhxBEGsgHCADQiCGIAMgARsiA0KAgICAgIDAAFQiARsiHEEIayAcIANCEIYgAyABGyIDQoCAgICAgICAAVQiARsiHEEEayAcIANCCIYgAyABGyIDQoCAgICAgICAEFQiARsiHEECayAcIANCBIYgAyABGyIDQoCAgICAgICAwABUIgEbIANCAoYgAyABGyIFQj+Hp0F/c2oiAWvBIhxBAEgNAiAYQn8gHK0iBogiAyAEgzcDECAD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AEETQbmcwgBBCiACQQxqQcScwgAQtQEgAkEQaiQACzsBAX8jAEEQayICJAAgAiAAKAIANgIMIAFBnKrCAEETQa+qwgBBBCACQQxqQbSqwgAQtQEgAkEQaiQAC+QCAQJ/IwBBIGsiAiQAIAJBAToAGCACIAE2AhQgAiAANgIQIAJB2O7CADYCDCACQZzVwgA2AggjAEEQayIBJAACQCACQQhqIgAoAgwiAgRAIAAoAggiA0UNASABIAI2AgggASAANgIEIAEgAzYCACMAQRBrIgAkACAAQQhqIAFBCGooAgA2AgAgACABKQIANwMAIwBBEGsiASQAIAAoAgAiAkEUaigCACEDAkACfwJAAkAgAkEMaigCAA4CAAEDCyADDQJBACECQYS8wgAMAQsgAw0BIAIoAggiAygCBCECIAMoAgALIQMgASACNgIEIAEgAzYCACABQczFwgAgACgCBCIBKAIIIAAoAgggAS0AEBCsAQALIAFBADYCBCABIAI2AgwgAUG4xcIAIAAoAgQiASgCCCAAKAIIIAEtABAQrAEAC0GEvMIAQStBiMXCABCHAgALQYS8wgBBK0H4xMIAEIcCAAs2AQF/IwBBEGsiAiQAIAJBCGogARC5AiACKAIMIQEgACACKAIINgIAIAAgATYCBCACQRBqJAALNgEBfyMAQRBrIgIkACACQQhqIAEQ4AIgAigCDCEBIAAgAigCCDYCACAAIAE2AgQgAkEQaiQAC0kBAn9B/vPAACECQQQhAwJAAkACQCAAKAIALQAAQQFrDgIAAQILIAFB9PPAAEEKEPgCDwtB7PPAACECQQghAwsgASACIAMQ+AILNAEBfyAAKAIAIAAoAgQoAgARAwAgACgCBCIBQQRqKAIABEAgAUEIaigCABogACgCABA6Cws4AQF/IwBBEGsiAiQAIAIgADYCDCABQaacwgBBE0G5nMIAQQogAkEMakHEnMIAELUBIAJBEGokAAs4AQF/IwBBEGsiAiQAIAIgADYCDCABQZyqwgBBE0GvqsIAQQQgAkEMakG0qsIAELUBIAJBEGokAAszAAJAIABB/P///wdLDQAgAEUEQEEEDwsgACAAQf3///8HSUECdBD+AiIARQ0AIAAPCwALPAEBfyACLQADRQRAIAIgASgAADYAAAsCQAJAAkAgAEH/AXFBAmsOAgECAAsgAigAACEDCyABIAM2AAALC8gDAgF+BH8gACgCACEAIAEQjQNFBEAgARCOA0UEQCAAIAEQnQMPCyMAQYABayIEJAAgACkDACECQYABIQAgBEGAAWohBQJAAkADQCAARQRAQQAhAAwDCyAFQQFrQTBBNyACpyIDQQ9xIgZBCkkbIAZqOgAAIAJCEFoEQCAFQQJrIgVBMEE3IANB/wFxIgNBoAFJGyADQQR2ajoAACAAQQJrIQAgAkKAAlQgAkIIiCECRQ0BDAILCyAAQQFrIQALIABBgQFJDQAgAEGAAUH88MIAEJYDAAsgAUEBQYzxwgBBAiAAIARqQYABIABrEEYgBEGAAWokAA8LIwBBgAFrIgQkACAAKQMAIQJBgAEhACAEQYABaiEFAkACQANAIABFBEBBACEADAMLIAVBAWtBMEHXACACpyIDQQ9xIgZBCkkbIAZqOgAAIAJCEFoEQCAFQQJrIgVBMEHXACADQf8BcSIDQaABSRsgA0EEdmo6AAAgAEECayEAIAJCgAJUIAJCCIghAkUNAQwCCwsgAEEBayEACyAAQYEBSQ0AIABBgAFB/PDCABCWAwALIAFBAUGM8cIAQQIgACAEakGAASAAaxBGIARBgAFqJAALMgAgACgCACEAIAEQjQNFBEAgARCOA0UEQCAAIAEQmQMPCyAAIAEQvQEPCyAAIAEQvAELtwEBA38gACgCACEAIAEQjQNFBEAgARCOA0UEQCAAIAEQnAMPCyAAIAEQuwEPCyMAQYABayIDJAAgAC0AACEAA0AgAiADakH/AGpBMEHXACAAQQ9xIgRBCkkbIARqOgAAIAJBAWshAiAAIgRBBHYhACAEQQ9LDQALIAJBgAFqIgBBgQFPBEAgAEGAAUH88MIAEJYDAAsgAUEBQYzxwgBBAiACIANqQYABakEAIAJrEEYgA0GAAWokAAu9AgEDfyAAKAIAIQAgARCNA0UEQCABEI4DRQRAIAAzAQBBASABEHwPCyMAQYABayIDJAAgAC8BACEAA0AgAiADakH/AGpBMEE3IABBD3EiBEEKSRsgBGo6AAAgAkEBayECIAAiBEEEdiEAIARBD0sNAAsgAkGAAWoiAEGBAU8EQCAAQYABQfzwwgAQlgMACyABQQFBjPHCAEECIAIgA2pBgAFqQQAgAmsQRiADQYABaiQADwsjAEGAAWsiAyQAIAAvAQAhAANAIAIgA2pB/wBqQTBB1wAgAEEPcSIEQQpJGyAEajoAACACQQFrIQIgACIEQQR2IQAgBEEPSw0ACyACQYABaiIAQYEBTwRAIABBgAFB/PDCABCWAwALIAFBAUGM8cIAQQIgAiADakGAAWpBACACaxBGIANBgAFqJAALLAEBfyMAQRBrIgAkACAAQQhqIgIgAUGvvMIAQQsQvAIgAhDVASAAQRBqJAALLgAgAEEEOgAEIABBBDYCACAAQQZqIAI6AAAgAEEFaiABOgAAIABBFGpBADsBAAsrACABIAJPBEAgASACayIBIAAgAWogAhA9DwtBlKXAAEEhQbilwAAQhwIACywAIAAgASkCADcCACAAQRBqIAFBEGooAgA2AgAgAEEIaiABQQhqKQIANwIACzEAIAAgASgCACACIAMgASgCBCgCDBECADoACCAAIAE2AgQgACADRToACSAAQQA2AgALKQAgASACTwRAIAIgACACaiABIAJrED0PC0HUosAAQSNBhKXAABCHAgALLgAgASAAKAIALQAAQQRzQQdxQQJ0IgBByPjAAGooAgAgAEGo+MAAaigCABD4AgsqACAAKAIARQRAIAAoAgQgASAAQQhqKAIAKAIQEQAADwsgAEEEaiABEGsLLAACQCABEI0DRQRAIAEQjgMNASAAIAEQwAIPCyAAIAEQvAEPCyAAIAEQvQELJwAgACAAKAIEQQFxIAFyQQJyNgIEIAAgAWoiACAAKAIEQQFyNgIECy0BAX8gAEHQqcIAQZSpwgAgAS0AAEEERiICGzYCBCAAIAFBAWogASACGzYCAAs6AQJ/QbySwwAtAAAhAUG8ksMAQQA6AABBwJLDACgCACECQcCSwwBBADYCACAAIAI2AgQgACABNgIACzEAIABBAzoAICAAQoCAgICABDcCGCAAQQA2AhAgAEEANgIIIAAgAjYCBCAAIAE2AgALLQAgASgCACACIAMgASgCBCgCDBECACECIABBADoABSAAIAI6AAQgACABNgIACyABAX8CQCAAQQRqKAIAIgFFDQAgACgCAEUNACABEDoLCyMAAkAgAUH8////B00EQCAAIAFBBCACEPICIgANAQsACyAACyMAIAIgAigCBEF+cTYCBCAAIAFBAXI2AgQgACABaiABNgIACx4AIAAoAgAiAK1CACAArH0gAEEATiIAGyAAIAEQfAslACAARQRAQYS3wABBMhC3AwALIAAgAiADIAQgBSABKAIQEQsACyMAIABBADYCECAAIAEpAgA3AgAgAEEIaiABQQhqKQIANwIACygAIAEgACgCAC0AAEECdCIAQZTSwABqKAIAIABB2NHAAGooAgAQ+AILKAAgASAAKAIALQAAQQJ0IgBB/IHBAGooAgAgAEHcgcEAaigCABD4AgsoACABIAAoAgAtAABBAnQiAEH0z8IAaigCACAAQdDOwgBqKAIAEPgCCx8BAn4gACkDACICIAJCP4ciA4UgA30gAkIAWSABEHwLIwAgAEUEQEGEt8AAQTIQtwMACyAAIAIgAyAEIAEoAhARBwALIwAgAEUEQEGEt8AAQTIQtwMACyAAIAIgAyAEIAEoAhARFQALIwAgAEUEQEGEt8AAQTIQtwMACyAAIAIgAyAEIAEoAhARIwALIwAgAEUEQEGEt8AAQTIQtwMACyAAIAIgAyAEIAEoAhARJQALIwAgAEUEQEGEt8AAQTIQtwMACyAAIAIgAyAEIAEoAhARJwALIQAgAEGA1MAANgIEIAAgAUEEakEAIAEtAABBH0YbNgIACyUAIAEgAC0AAEECdCIAQfTPwgBqKAIAIABB0M7CAGooAgAQ+AILHgAgACABQQNyNgIEIAAgAWoiACAAKAIEQQFyNgIECwoAIABBCBC8AwALFAAgACgCAARAIABBBGooAgAQOgsLIgEBfyABKAIAEAohAiAAIAE2AgggACACNgIEIABBADYCAAshACAARQRAQYS3wABBMhC3AwALIAAgAiADIAEoAhARBQALIwAgAUHc88AAQeHzwAAgACgCAC0AACIAG0EFQQsgABsQ+AILIwAgAUGC9MAAQYb0wAAgACgCAC0AACIAG0EEQQYgABsQ+AILLAEBfwJAAkAgAEH/AXFBAWsOEAAAAQABAQEAAQEBAQEBAQABCyAAIQELIAEL7wwBBH8gACAAKQMAIAKtfDcDACAAQQhqIgUoAgBBf3MhAyACQcAATwRAA0AgAS0AMyABLQAjIAEtABMgAS0AACADQf8BcXNBAnRByI3CAGooAgAgAUEBai0AACADQQh2Qf8BcXNBAnRByIXCAGooAgAgAUECai0AACADQRB2Qf8BcXNBAnRByP3BAGooAgAgAUEDai0AACADQRh2c0EC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QQE2AgAgAEG84cAANgIwIABBADYCKCAAQaQBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOgBDBYLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBjOHAADYCMCAAQQA2AiggAEGkATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDoAQwVCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQdzgwAA2AjAgAEEANgIoIABBpAE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6AEMFAsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEGg4MAANgIwIABBADYCKCAAQaQBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOgBDBMLIAAgAkEEajYCICAAIAJBCGo2AiQgAEE0akEDNgIAIABBPGpBAjYCACAAQRRqQaYBNgIAIABB6N/AADYCMCAAQQA2AiggAEGmATYCDCAAIABBCGo2AjggACAAQSBqNgIQIAAgAEEkajYCCCABIABBKGoQ6AEMEgsgACACQQRqNgIgIAAgAkEIajYCJCAAQTRqQQM2AgAgAEE8akECNgIAIABBFGpBpwE2AgAgAEGk38AANgIwIABBADYCKCAAQacBNgIMIAAgAEEIajYCOCAAIABBJGo2AhAgACAAQSBqNgIIIAEgAEEoahDoAQwRCyAAQTRqQQE2AgAgAEE8akEANgIAIABB9N7AADYCMCAAQfDTwAA2AjggAEEANgIoIAEgAEEoahDoAQwQCyAAIAJBAmo2AiAgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQI2AgAgAEEUakGoATYCACAAQcDewAA2AjAgAEEANgIoIABBqQE2AgwgACAAQQhqNgI4IAAgAEEkajYCECAAIABBIGo2AgggASAAQShqEOgBDA8LIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBhN7AADYCMCAAQQA2AiggAEGpATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDoAQwOCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQczdwAA2AjAgAEEANgIoIABBqgE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6AEMDQsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEGg3cAANgIwIABBADYCKCAAQaoBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOgBDAwLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABB/NzAADYCMCAAQQA2AiggAEGqATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDoAQwLCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQdjcwAA2AjAgAEEANgIoIABBqgE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6AEMCgsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEG03MAANgIwIABBADYCKCAAQaoBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOgBDAkLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBgNzAADYCMCAAQQA2AiggAEGqATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDoAQwICyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQdDbwAA2AjAgAEEANgIoIABBqgE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6AEMBwsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEGk28AANgIwIABBADYCKCAAQaoBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOgBDAYLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABB/NrAADYCMCAAQQA2AiggAEGqATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDoAQwFCyAAQTRqQQE2AgAgAEE8akEANgIAIABB2NrAADYCMCAAQfDTwAA2AjggAEEANgIoIAEgAEEoahDoAQwECyAAQTRqQQE2AgAgAEE8akEANgIAIABBvNjAADYCMCAAQfDTwAA2AjggAEEANgIoIAEgAEEoahDoAQwDCyAAIAJBBGo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQfjXwAA2AjAgAEEANgIoIABBqwE2Agwg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HwAAACAAAAAQCBAA+AcQAOAHEADIBxAAsAcQAAAAAAAAAIA/AAAAQAAAQEAAAEBAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcaW1hZ2UtMC4yNC42XC4vc3JjXGJ1ZmZlci5ycwBQCBAAWwAAALcDAABGAAAASW1hZ2UgaW5kZXggIG91dCBvZiBib3VuZHMgALwIEAAMAAAAyAgQAA8AAABQCBAAWwAAALIDAAAVAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcYnl0ZW9yZGVyLTEuNC4zXHNyY1xsaWIucnMAAAD4CBAAWQAAALUHAAAcAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZUM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xjb2xvci5ycwAAAI8JEABaAAAAFQMAADAAAACPCRAAWgAAABQDAAAqAAAAjwkQAFoAAAATAwAAKgAAAI8JEABaAAAAEgMAACoAAAAEAAAAjwkQAFoAAABmAQAAAQAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xjb2RlY3NccG5nLnJzAEAKEABfAAAA+wAAAAkAAABAChAAXwAAAAEBAAATAAAAYXR0ZW1wdCB0byBkaXZpZGUgYnkgemVyb2ludGVybmFsIGVycm9yOiBlbnRlcmVkIHVucmVhY2hhYmxlIGNvZGUAAABAChAAXwAAAAkBAAASAAAAZXhwZWN0ZWQgaW50ZXJsYWNlIGluZm9ybWF0aW9uAAAUCxAAHgAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHBuZy0wLjE3Ljdcc3JjXGRlY29kZXJcbW9kLnJzPAsQAFwAAAALAgAALAAAADwLEABcAAAAEwIAAB4AAABOZXh0IGZyYW1lIGNhbGxlZCB3aGVuIGFscmVhZHkgYXQgaW1hZ2UgZW5kALgLEAArAAAAPAsQAFwAAADYAQAAIQAAAE5leHQgZnJhbWUgY2FuIG5ldmVyIGJlIGluaXRpYWwA/AsQAB8AAAA8CxAAXAAAANcBAAAkAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZQA8CxAAXAAAAI8CAAAyAAAAPAsQAFwAAAB6AQAAOgAAADwLEABcAAAA/AIAACAAAAA8CxAAXAAAAP0CAAA4AAAAPAsQAFwAAAAIAwAALAAAADwLEABcAAAACAMAAEcAAAA8CxAAXAAAAA8DAAARAAAAPAsQAFwAAAATAwAAHAAAAEFkYW03IGludGVybGFjZWQgcm93cyBhcmUgc2hvcnRlciB0aGFuIHRoZSBidWZmZXIuAAA8CxAAXAAAAE8CAAASAAAAPAsQAFwAAABXAgAAOwAAADwLEABcAAAAWQIAADMAAAA8CxAAXAAAAF0CAAA+AAAAPAsQAFwAAABdAgAAIAAAADwLEABcAAAAawIAACQAAAA8CxAAXAAAAGsCAAARAAAAPAsQAFwAAABOAgAAEgAAADwLEABcAAAAxwEAAB0AAABpbnRlcm5hbCBlcnJvcjogZW50ZXJlZCB1bnJlYWNoYWJsZSBjb2RlOiAAAKQNEAAqAAAAPAsQAFwAAAARAQAAGAAAAGZhaWxlZCB0byB3cml0ZSB3aG9sZSBidWZmZXLoDRAAHAAAABcAAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcZ2lmLTAuMTIuMFxzcmNcZW5jb2Rlci5yc05FVFNDQVBFMi4wAAA7DhAAWAAAABUBAAAmAAAAOw4QAFgAAAADAQAAGwAAADsOEABYAAAA/QAAACYAAAA7DhAAWAAAAOUAAAAmAAAAR0lGODlhAAA7DhAAWAAAAMQAAAAmAAAAAgAAAAAAAABjaHVua3MgY2Fubm90IGhhdmUgYSBzaXplIG9mIHplcm8AAAAADxAAIQAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvY29yZS9zcmMvc2xpY2UvbW9kLnJzAAAALA8QAE0AAABxAwAACQAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlcHJvYy0wLjIzLjBcc3JjXGdlb21ldHJpY190cmFuc2Zvcm1hdGlvbnMucnOMDxAAcAAAAIkCAAANAAAAYHVud3JhcF90aHJvd2AgZmFpbGVkAAAAJQAAAAwAAAAEAAAAJgAAACUAAAAMAAAABAAAACcAAAAmAAAAJBAQACgAAAApAAAAKgAAACsAAAAsAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcY29uc29sZV9lcnJvcl9wYW5pY19ob29rLTAuMS43XHNyY1xsaWIucnNgEBAAaAAAAJUAAAAOAAAAc3BlZWRoeXBlcnNwZWVkcmV2ZXJzZXJhaW5ib3dyb3RhdGVzcGlucmV2c2xpZGV3aWdnbGVzaGFrZUZhaWxlZCB0byBwYXJzZSBjb21tYW5kczogEhEQABoAAABGYWlsZWQgdG8gd3JpdGUgZnJhbWU6IAA0ERAAFwAAAGFzc2VydGlvbiBmYWlsZWQ6IG1pZCA8PSBzZWxmLmxlbigpADAAAAAMAAAABAAAADEAAAAyAAAAMwAAAGEgRGlzcGxheSBpbXBsZW1lbnRhdGlvbiByZXR1cm5lZCBhbiBlcnJvciB1bmV4cGVjdGVkbHkANAAAAAAAAAABAAAANQAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvYWxsb2Mvc3JjL3N0cmluZy5ycwDYERAASwAAAOkJAAAOAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9tb2QucnMAAAA0EhAATQAAAA0MAAAJAAAAYXNzZXJ0aW9uIGZhaWxlZDogayA8PSBzZWxmLmxlbigpAAAANBIQAE0AAAA4DAAACQAAAAAAAABjaHVua3MgY2Fubm90IGhhdmUgYSBzaXplIG9mIHplcm8AAADMEhAAIQAAADQSEABNAAAAwAMAAAkAAABtaXNzaW5nIGZpZWxkIGBgCBMQAA8AAAAXExAAAQAAAHVua25vd24gZmllbGQgYGAsIGV4cGVjdGVkIAAoExAADwAAADcTEAAMAAAAYCwgdGhlcmUgYXJlIG5vIGZpZWxkcwAAKBMQAA8AAABUExAAFgAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGdpZi0wLjEyLjBcc3JjXHJlYWRlclxtb2QucnMAfBMQAFsAAAB4AQAAIwAAAHwTEABbAAAAegEAABgAAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlAHwTEABbAAAAggEAACsAAAB8ExAAWwAAAIMBAAAgAAAAbm8gY29sb3IgdGFibGUgYXZhaWxhYmxlIGZvciBjdXJyZW50IGZyYW1lAAB8ExAAWwAAAD8BAAArAAAAaW1hZ2UgdHJ1bmNhdGVkAHwTEABbAAAARAEAABwAAABpbnRlcm5hbCBlcnJvcjogZW50ZXJlZCB1bnJlYWNoYWJsZSBjb2RlfBMQAFsAAADvAAAAFQAAAGZpbGUgZG9lcyBub3QgY29udGFpbiBhbnkgaW1hZ2UgZGF0YXVuZXhwZWN0ZWQgRU9GSW1hZ2UgZGltZW5zaW9ucyAoLCApIGFyZSB0b28gbGFyZ2UAAAAKFRAAEgAAABwVEAACAAAAHhUQAA8AAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2NvcmUvc3JjL29wcy9hcml0aC5ycwAAAEgVEABNAAAA6AEAAAEAQbCrwAALsQhhdHRlbXB0IHRvIGRpdmlkZSBieSB6ZXJvAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZUM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xjb2RlY3NcZ2lmLnJzAAD3FRAAXwAAACsCAAA1AAAA9xUQAF8AAAAiAgAAKAAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xidWZmZXIucnMAeBYQAFsAAAC3AwAARgAAAEltYWdlIGluZGV4ICBvdXQgb2YgYm91bmRzIADkFhAADAAAAPAWEAAPAAAAeBYQAFsAAACyAwAAFQAAADcAAAAYAQAACAAAADgAAAA5AAAAOgAAADsAAAA8AAAAAAAAAAEAAAA9AAAAPgAAAD8AAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L3N0ZC9zcmMvaW8vY3Vyc29yLnJzVBcQAEwAAADrAAAACgAAAG9uZS10aW1lIGluaXRpYWxpemF0aW9uIG1heSBub3QgYmUgcGVyZm9ybWVkIHJlY3Vyc2l2ZWx5sBcQADgAAABPbmNlIGluc3RhbmNlIGhhcyBwcmV2aW91c2x5IGJlZW4gcG9pc29uZWQAAPAXEAAqAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZS9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvc3RkL3NyYy9zeW5jL29uY2UucnMATxgQAEwAAACPAAAAMgAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvYWxsb2Mvc3JjL3NsaWNlLnJzAACsGBAASgAAAJIAAAARAAAARXJyADwAAAAEAAAABAAAAEAAAABPawAAPAAAAAQAAAAEAAAAQQAAAGdpZnBuZ1Vuc3VwcG9ydGVkIGV4dGVuc2lvbjogAAAANhkQABcAAABGYWlsZWQgdG8gY3JlYXRlIHJlYWRlcjogAAAAWBkQABkAAABGYWlsZWQgdG8gY29sbGVjdCBmcmFtZXM6IAAAfBkQABoAAABGYWlsZWQgdG8gY3JlYXRlIGR5bmFtaWMgaW1hZ2U6IKAZEAAgAAAAc3JjXHV0aWxzLnJzyBkQAAwAAAAyAAAAEgBB8LPAAAvBDWF0dGVtcHQgdG8gZGl2aWRlIGJ5IHplcm8AAADIGRAADAAAADgAAAAgAAAAAAAAAGF0dGVtcHQgdG8gY2FsY3VsYXRlIHRoZSByZW1haW5kZXIgd2l0aCBhIGRpdmlzb3Igb2YgemVybwAAAMgZEAAMAAAASwAAABgAAADIGRAADAAAAE4AAAAYAAAAfBoQAAAAAABDAAAABAAAAAQAAABEAAAARQAAAEYAAABJAAAADAAAAAQAAABKAAAASwAAAEwAAABhIERpc3BsYXkgaW1wbGVtZW50YXRpb24gcmV0dXJuZWQgYW4gZXJyb3IgdW5leHBlY3RlZGx5AE0AAAAAAAAAAQAAADUAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2FsbG9jL3NyYy9zdHJpbmcucnMA/BoQAEsAAADpCQAADgAAAGludmFsaWQgdHlwZTogLCBleHBlY3RlZCAAAABYGxAADgAAAGYbEAALAAAAY2xvc3VyZSBpbnZva2VkIHJlY3Vyc2l2ZWx5IG9yIGFmdGVyIGJlaW5nIGRyb3BwZWQAAHN0cnVjdCB2YXJpYW50AAC4GxAADgAAAHR1cGxlIHZhcmlhbnQAAADQGxAADQAAAG5ld3R5cGUgdmFyaWFudADoGxAADwAAAHVuaXQgdmFyaWFudAAcEAAMAAAAZW51bRQcEAAEAAAAbWFwACAcEAADAAAAc2VxdWVuY2UsHBAACAAAAG5ld3R5cGUgc3RydWN0AAA8HBAADgAAAE9wdGlvbiB2YWx1ZVQcEAAMAAAAdW5pdCB2YWx1ZQAAaBwQAAoAAABieXRlIGFycmF5AAB8HBAACgAAAHN0cmluZyAAkBwQAAcAAABjaGFyYWN0ZXIgYGCgHBAACwAAAKscEAABAAAAZmxvYXRpbmcgcG9pbnQgYLwcEAAQAAAAqxwQAAEAAABpbnRlZ2VyIGAAAADcHBAACQAAAKscEAABAAAAYm9vbGVhbiBgAAAA+BwQAAkAAACrHBAAAQAAAG9uZSBvZiAAFB0QAAcAAAAsIAAAJB0QAAIAAACrHBAAAQAAAKscEAABAAAAYCBvciBgAACrHBAAAQAAAEAdEAAGAAAAqxwQAAEAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xzZXJkZS0xLjAuMTU5XHNyY1xkZVxtb2QucnNleHBsaWNpdCBwYW5pY2AdEABaAAAA7AgAABIAAABhIHN0cmluZ2YzMgBiAAAACAAAAAQAAABjAAAAZAAAAGUAAAAIAAAABAAAAGYAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xpbWFnZS0wLjI0LjZcLi9zcmNcYnVmZmVyLnJzAAgeEABbAAAAygIAAAoAAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlAAgeEABbAAAAyQIAAEMAAABCdWZmZXIgbGVuZ3RoIGluIGBJbWFnZUJ1ZmZlcjo6bmV3YCBvdmVyZmxvd3MgdXNpemUACB4QAFsAAADfBAAADgAAAGRlc2NyaXB0aW9uKCkgaXMgZGVwcmVjYXRlZDsgdXNlIERpc3BsYXkoKUxpbWl0U3VwcG9ydF9ub25fZXhoYXVzdGl2ZQAAAGcAAAAEAAAABAAAAGgAAABMaW1pdHNtYXhfaW1hZ2Vfd2lkdGgAAABnAAAABAAAAAQAAABpAAAAbWF4X2ltYWdlX2hlaWdodG1heF9hbGxvYwAAAGcAAAAEAAAABAAAAGoAAABrAAAAFAAAAAQAAABsAAAAawAAABQAAAAEAAAAbQAAAGwAAACgHxAAbgAAAG8AAABwAAAAcQAAAHIAAABzAAAADAAAAAQAAAB0AAAAcwAAAAwAAAAEAAAAdQAAAHQAAADcHxAAdgAAAHcAAAB4AAAAeQAAAHoAAAB7AAAACAAAAAQAAAB8AAAAewAAAAgAAAAEAAAAfQAAAHwAAAAYIBAAfgAAAH8AAAB4AAAAgAAAAHoAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2NvcmUvc3JjL29wcy9hcml0aC5ycwAAAFQgEABNAAAA6AEAAAEAQcDBwAALskFhdHRlbXB0IHRvIGRpdmlkZSBieSB6ZXJvAAAAiAAAAAwAAAAEAAAAiQAAAIoAAACLAAAAYSBEaXNwbGF5IGltcGxlbWVudGF0aW9uIHJldHVybmVkIGFuIGVycm9yIHVuZXhwZWN0ZWRseQCMAAAAAAAAAAEAAAA1AAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9hbGxvYy9zcmMvc3RyaW5nLnJzADwhEABLAAAA6QkAAA4AAABUaGUgZGVjb2RlciBmb3IgIGRvZXMgbm90IHN1cHBvcnQgdGhlIGZvcm1hdCBmZWF0dXJlcyAAAJghEAAQAAAAqCEQACYAAABUaGUgZGVjb2RlciBkb2VzIG5vdCBzdXBwb3J0IHRoZSBmb3JtYXQgZmVhdHVyZSDgIRAAMAAAAFRoZSBpbWFnZSBmb3JtYXQgIGlzIG5vdCBzdXBwb3J0ZWQAABgiEAARAAAAKSIQABEAAABUaGUgaW1hZ2UgZm9ybWF0IGNvdWxkIG5vdCBiZSBkZXRlcm1pbmVkTCIQACgAAABUaGUgZmlsZSBleHRlbnNpb24gIHdhcyBub3QgcmVjb2duaXplZCBhcyBhbiBpbWFnZSBmb3JtYXQAAAB8IhAAEwAAAI8iEAAmAAAAIGRvZXMgbm90IHN1cHBvcnQgdGhlIGNvbG9yIHR5cGUgYGAAmCEQABAAAADIIhAAIgAAAOoiEAABAAAAVGhlIGVuZCBvZiB0aGUgaW1hZ2UgaGFzIGJlZW4gcmVhY2hlZAAAAAQjEAAlAAAAVGhlIHBhcmFtZXRlciBpcyBtYWxmb3JtZWQ6IDQjEAAcAAAAVGhlIGVuZCB0aGUgaW1hZ2Ugc3RyZWFtIGhhcyBiZWVuIHJlYWNoZWQgZHVlIHRvIGEgcHJldmlvdXMgZXJyb3IAAABYIxAAQQAAAFRoZSBJbWFnZSdzIGRpbWVuc2lvbnMgYXJlIGVpdGhlciB0b28gc21hbGwgb3IgdG9vIGxhcmdlpCMQADgAAAAKAAAA5CMQAAEAAABGb3JtYXQgZXJyb3IgZW5jb2RpbmcgOgrwIxAAFgAAAAYkEAACAAAA8CMQABYAAABGb3JtYXQgZXJyb3IgZGVjb2RpbmcgOiAgJBAAFgAAADYkEAACAAAAICQQABYAAABGb3JtYXQgZXJyb3JQJBAADAAAAFRoZSBmb2xsb3dpbmcgc3RyaWN0IGxpbWl0cyBhcmUgc3BlY2lmaWVkIGJ1dCBub3Qgc3VwcG9ydGVkIGJ5IHRoZSBvcGVydGF0aW9uOiAAZCQQAE8AAABJbnN1ZmZpY2llbnQgbWVtb3J5ALwkEAATAAAASW1hZ2UgaXMgdG9vIGxhcmdlAADYJBAAEgAAAGBVbmtub3duYAAAAPQkEAAJAAAAYC4AAAglEAACAAAA6iIQAAEAAADqIhAAAQAAAOoiEAABAAAAmCEQAAAAAABJb0Vycm9yAIwAAAAEAAAABAAAAI0AAABVbnN1cHBvcnRlZACMAAAABAAAAAQAAACOAAAATGltaXRzAACMAAAABAAAAAQAAACPAAAAUGFyYW1ldGVyAAAAjAAAAAQAAAAEAAAAkAAAAEVuY29kaW5njAAAAAQAAAAEAAAAkQAAAERlY29kaW5njAAAAAQAAAAEAAAAkgAAAFVuc3VwcG9ydGVkRXJyb3Jmb3JtYXQAAIwAAAAEAAAABAAAAJMAAABraW5kjAAAAAQAAAAEAAAAlAAAAEdlbmVyaWNGZWF0dXJlAACMAAAABAAAAAQAAACVAAAARm9ybWF0Q29sb3IAjAAAAAQAAAAEAAAAhgAAAEVuY29kaW5nRXJyb3J1bmRlcmx5aW5nAIwAAAAEAAAABAAAAJYAAABQYXJhbWV0ZXJFcnJvcgAAjAAAAAQAAAAEAAAAlwAAAE5vTW9yZURhdGFHZW5lcmljRmFpbGVkQWxyZWFkeURpbWVuc2lvbk1pc21hdGNoRGVjb2RpbmdFcnJvckxpbWl0RXJyb3IAAIwAAAAEAAAABAAAAJgAAABsaW1pdHMAAIwAAAAEAAAABAAAAJkAAABzdXBwb3J0ZWQAAACMAAAABAAAAAQAAACaAAAASW5zdWZmaWNpZW50TWVtb3J5RGltZW5zaW9uRXJyb3JVbmtub3duUGF0aEV4dGVuc2lvbowAAAAEAAAABAAAAIMAAABOYW1lRXhhY3QAAACMAAAABAAAAAQAAACBAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZUM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlLTAuMjQuNlwuL3NyY1xjb2xvci5ycwAAAKMnEABaAAAAhwEAAB4AAABSZ2JhMzJGUmdiMzJGUmdiYTE2UmdiMTZMYTE2TDE2UmdiYThSZ2I4TGE4TDhVbmtub3dumwAAAAQAAAAEAAAAnAAAAEJncmE4QmdyOFJnYmE0UmdiNExhNEw0UmdiYTJSZ2IyTGEyTDJSZ2JhMVJnYjFMYTFMMUE4AQIDBAIEBggMEAECAwQBAgMEAwRRb2lBdmlmRmFyYmZlbGRPcGVuRXhySGRySWNvQm1wRGRzVGdhVGlmZlBubVdlYlBHaWZKcGVnUG5nAAMAAAAEAAAAAwAAAAQAAAADAAAABAAAAAMAAAADAAAAAwAAAAMAAAADAAAABwAAAAgAAAAEAAAAAwAAANQoEADQKBAAzSgQAMkoEADGKBAAwigQAL8oEAC8KBAAuSgQALYoEACzKBAArCgQAKQoEACgKBAAnSgQAJ0AAAAEAAAABAAAAJ4AAACfAAAAoAAAAGRlc2NyaXB0aW9uKCkgaXMgZGVwcmVjYXRlZDsgdXNlIERpc3BsYXlTb21lnQAAAAQAAAAEAAAAoQAAAE5vbmWdAAAABAAAAAQAAACiAAAAnQAAAAQAAAAEAAAAowAAAGZhaWxlZCB0byBmaWxsIHdob2xlIGJ1ZmZlcgDIKRAAGwAAACUAAACwAAAACAAAAAQAAACxAAAAsAAAAAgAAAAEAAAAsgAAALEAAADwKRAAswAAALQAAAC1AAAAtgAAALcAAABsaW1pdHMgYXJlIGV4Y2VlZGVkACwqEAATAAAA8CkQAAAAAABObyBjb21wcmVzc2lvbiBmbGFnIGluIHRoZSBpVFh0IGNodW5rLgAAUCoQACYAAABVc2luZyBhIGZsYWcgdGhhdCBpcyBub3QgMCBvciAyNTUgYXMgYSBjb21wcmVzc2lvbiBmbGFnIGZvciBpVFh0IGNodW5rLgCAKhAARwAAAFVzaW5nIGFuIHVucmVjb2duaXplZCBieXRlIGFzIGNvbXByZXNzaW9uIG1ldGhvZC4AAADQKhAAMQAAAE91dCBvZiBkZWNvbXByZXNzaW9uIHNwYWNlLiBUcnkgd2l0aCBhIGxhcmdlciBsaW1pdC4MKxAANAAAAEludmFsaWQgY29tcHJlc3NlZCB0ZXh0IGRhdGEuAAAASCsQAB0AAABObyBudWxsIHNlcGFyYXRvciBpbiB0RVh0IGNodW5rLnArEAAgAAAAS2V5d29yZCBlbXB0eSBvciBsb25nZXIgdGhhbiA3OSBieXRlcy4AAJgrEAAmAAAAVW5yZXByZXNlbnRhYmxlIGRhdGEgaW4gdEVYdCBjaHVuay4AyCsQACMAAAAuAAAA8CkQAAAAAAD0KxAAAQAAAElEQVQgb3IgZkRBVCBjaHVuayBpcyBoYXMgbm90IGVub3VnaCBkYXRhIGZvciBpbWFnZS4ILBAANAAAAENvcnJ1cHQgZGVmbGF0ZSBzdHJlYW0uIEQsEAAYAAAARXJyb3IgbnVtYmVyIAAAAGQsEAANAAAA9CsQAAEAAABIYXMgbW9yZSBvdXRwdXQuhCwQABAAAABOZWVkcyBtb3JlIGlucHV0LgAAAJwsEAARAAAAVW5leHBlY3RlZCBkb25lIHN0YXR1cy4AuCwQABcAAABBZGxlcjMyIGNoZWNrc3VtIGZhaWxlZC7YLBAAGAAAAEludmFsaWQgaW5wdXQgcGFyYW1ldGVycy4AAAD4LBAAGQAAAFVuZXhwZWN0ZWQgZW5kIG9mIGRhdGEuABwtEAAXAAAAU3ViIGZyYW1lIGlzIG91dC1vZi1ib3VuZHMuADwtEAAbAAAAVW5rbm93biBpbnRlcmxhY2UgbWV0aG9kIAAAAGAtEAAZAAAA9CsQAAEAAABVbmtub3duIGZpbHRlciBtZXRob2QgAACMLRAAFgAAAPQrEAABAAAAVW5rbm93biBjb21wcmVzc2lvbiBtZXRob2QgALQtEAAbAAAA9CsQAAEAAABJbnZhbGlkIHNSR0IgcmVuZGVyaW5nIGludGVudCAAAOAtEAAeAAAA9CsQAAEAAABJbnZhbGlkIHBoeXNpY2FsIHBpeGVsIHNpemUgdW5pdCAAAAAQLhAAIQAAAPQrEAABAAAASW52YWxpZCBibGVuZCBvcCAAAABELhAAEQAAAPQrEAABAAAASW52YWxpZCBkaXNwb3NlIG9wIABoLhAAEwAAAPQrEAABAAAASW52YWxpZCBjb2xvciB0eXBlIACMLhAAEwAAAPQrEAABAAAASW52YWxpZCBkaXNwb3NlIG9wZXJhdGlvbiAAALAuEAAaAAAA9CsQAAEAAABUcmFuc3BhcmVuY3kgY2h1bmsgZm91bmQgZm9yIGNvbG9yIHR5cGUg3C4QACgAAAD0KxAAAQAAAEludmFsaWQgY29sb3IvZGVwdGggY29tYmluYXRpb24gaW4gaGVhZGVyOiAvFC8QACsAAAA/LxAAAQAAAE1pc3NpbmcgcGFsZXR0ZSBvZiBpbmRleGVkIGltYWdlLgAAAFAvEAAhAAAATm90IGVub3VnaCBwYWxldHRlIGVudHJpZXMsIGV4cGVjdCAgZ290IHwvEAAjAAAAny8QAAUAAAD0KxAAAQAAAFNlcXVlbmNlIGlzIG5vdCBpbiBvcmRlciwgZXhwZWN0ZWQgIyBnb3QgIwAAvC8QACQAAADgLxAABgAAAPQrEAABAAAAQ2h1bmsgIG11c3QgYXBwZWFyIGF0IG1vc3Qgb25jZS4AMBAABgAAAAYwEAAaAAAAIG11c3QgYXBwZWFyIGJldHdlZW4gUExURSBhbmQgSURBVCBjaHVua3MuAAAAMBAABgAAADAwEAAqAAAAIGlzIGludmFsaWQgYWZ0ZXIgUExURSBjaHVuay4AAAAAMBAABgAAAGwwEAAdAAAAIGlzIGludmFsaWQgYWZ0ZXIgSURBVCBjaHVuay4AAAAAMBAABgAAAJwwEAAdAAAAIGNodW5rIGFwcGVhcmVkIGJlZm9yZSBJSERSIGNodW5rAAAA8CkQAAAAAADMMBAAIQAAAElEQVQgb3IgZkRBVCBjaHVuayBpcyBtaXNzaW5nLgAAADEQAB4AAABmY1RMIGNodW5rIG1pc3NpbmcgYmVmb3JlIGZkQVQgY2h1bmsuAAAAKDEQACUAAABJSERSIGNodW5rIG1pc3NpbmcAAFgxEAASAAAAVW5leHBlY3RlZCBlbmQgb2YgZGF0YSB3aXRoaW4gYSBjaHVuay4AAHQxEAAmAAAAVW5leHBlY3RlZCBlbmQgb2YgZGF0YSBiZWZvcmUgaW1hZ2UgZW5kLqQxEAAoAAAASW52YWxpZCBQTkcgc2lnbmF0dXJlLgAA1DEQABYAAABDUkMgZXJyb3I6IGV4cGVjdGVkIDB4IGhhdmUgMHggd2hpbGUgZGVjb2RpbmcgIGNodW5rLgAAAPQxEAAWAAAACjIQAAgAAAASMhAAEAAAACIyEAAHAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNccG5nLTAuMTcuN1xzcmNcZGVjb2RlclxzdHJlYW0ucnMATDIQAF8AAADnAQAAHAAAAEwyEABfAAAA5QEAADkAAABMMhAAXwAAAKkCAAAjAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZQBMMhAAXwAAACUDAAAcAAAATDIQAF8AAAAkAwAAHAAAAEwyEABfAAAANAMAACAAAABMMhAAXwAAADoDAAAnAAAATDIQAF8AAABHAwAAJwAAAEwyEABfAAAAhAMAACcAAABMMhAAXwAAAKEDAAAnAAAATDIQAF8AAADTAwAAJwAAAEwyEABfAAAA7AMAACcAAABMMhAAXwAAACwEAAAYAAAATDIQAF8AAAAFBAAAJwAAAEwyEABfAAAAmQQAAA4AAABMMhAAXwAAAKsEAAAcAAAATDIQAF8AAADGBAAAIwAAAEwyEABfAAAAyAQAACUAAABMMhAAXwAAAM8EAAAOAAAATDIQAF8AAADRBAAAGwAAAEwyEABfAAAA0wQAABwAAAC4AAAABAAAAAQAAACkAAAAuAAAAAQAAAAEAAAAuQAAALgAAAAEAAAABAAAALoAAABQYXJ0aWFsQ2h1bmu4AAAABAAAAAQAAAC7AAAASW1hZ2VFbmRJbWFnZURhdGFGbHVzaGVkSW1hZ2VEYXRhRnJhbWVDb250cm9sAAAAuAAAAAQAAAAEAAAAvAAAAEFuaW1hdGlvbkNvbnRyb2y4AAAABAAAAAQAAAC9AAAAUGl4ZWxEaW1lbnNpb25zALgAAAAEAAAABAAAAL4AAABDaHVua0NvbXBsZXRlQ2h1bmtCZWdpbkhlYWRlcgAAALgAAAAEAAAABAAAAKgAAAC4AAAABAAAAAQAAACpAAAAuAAAAAQAAAAEAAAAvwAAAE5vdGhpbmdMaW1pdHNFeGNlZWRlZFBhcmFtZXRlcgAAuAAAAAQAAAAEAAAAwAAAAEZvcm1hdAAAuAAAAAQAAAAEAAAAwQAAAElvRXJyb3IAuAAAAAQAAAAEAAAAwgAAAEZvcm1hdEVycm9yaW5uZXK4AAAABAAAAAQAAADDAAAAQmFkVGV4dEVuY29kaW5nALgAAAAEAAAABAAAAMQAAABCYWRGaWx0ZXIAAAC4AAAABAAAAAQAAADFAAAATm9Nb3JlSW1hZ2VEYXRhQ29ycnVwdEZsYXRlU3RyZWFtZXJyuAAAAAQAAAAEAAAArAAAAEJhZFN1YkZyYW1lQm91bmRzVW5rbm93bkludGVybGFjZU1ldGhvZFVua25vd25GaWx0ZXJNZXRob2RVbmtub3duQ29tcHJlc3Npb25NZXRob2RJbnZhbGlkU3JnYlJlbmRlcmluZ0ludGVudEludmFsaWRVbml0SW52YWxpZEJsZW5kT3BJbnZhbGlkRGlzcG9zZU9wSW52YWxpZENvbG9yVHlwZUludmFsaWRCaXREZXB0aENvbG9yV2l0aEJhZFRybnNJbnZhbGlkQ29sb3JCaXREZXB0aGNvbG9yX3R5cGViaXRfZGVwdGhQYWxldHRlUmVxdWlyZWRTaG9ydFBhbGV0dGVleHBlY3RlZGxlbkFwbmdPcmRlcnByZXNlbnREdXBsaWNhdGVDaHVua2tpbmRPdXRzaWRlUGx0ZUlkYXRBZnRlclBsdGVBZnRlcklkYXRDaHVua0JlZm9yZUloZHJNaXNzaW5nSW1hZ2VEYXRhTWlzc2luZ0ZjdGxNaXNzaW5nSWhkclVuZXhwZWN0ZWRFbmRPZkNodW5rVW5leHBlY3RlZEVvZkludmFsaWRTaWduYXR1cmVDcmNNaXNtYXRjaHJlY292ZXJjcmNfdmFsY3JjX3N1bWNodW5rAGludGVybmFsIGVycm9yOiBlbnRlcmVkIHVucmVhY2hhYmxlIGNvZGU6IAAAFDgQACoAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xwbmctMC4xNy43XHNyY1xjb21tb24ucnMAYXR0ZW1wdCB0byBkaXZpZGUgYnkgemVybwAAAEg4EABXAAAAQAAAAB0AAABOb3QgYSBwb3NzaWJsZSBieXRlIHJvdW5kZWQgcGl4ZWwgd2lkdGgAzDgQACcAAABIOBAAVwAAAF4CAAASAAAARW5kIG9mIGltYWdlIGhhcyBiZWVuIHJlYWNoZWQAAAAMORAAHQAAAHdyb25nIGRhdGEgc2l6ZSwgZXhwZWN0ZWQgIGdvdCAANDkQABoAAABOORAABQAAAFJnYmFHcmF5c2NhbGVBbHBoYUluZGV4ZWRSZ2JHcmF5c2NhbGVTaXh0ZWVuRWlnaHRGb3VyVHdvT25lUGl4ZWxEaW1lbnNpb25zeHBwdQAAxwAAAAQAAAAEAAAAuQAAAHlwcHV1bml0xwAAAAQAAAAEAAAAyAAAAE1ldGVyVW5zcGVjaWZpZWRQcmV2aW91c0JhY2tncm91bmROb25lT3ZlclNvdXJjZXNlcXVlbmNlX251bWJlcndpZHRoaGVpZ2h0eF9vZmZzZXR5X29mZnNldGRlbGF5X251bWRlbGF5X2RlbmRpc3Bvc2Vfb3BibGVuZF9vcAAADDoQAA8AAAAbOhAABQAAACA6EAAGAAAAJjoQAAgAAAAuOhAACAAAADY6EAAJAAAAPzoQAAkAAABIOhAACgAAAFI6EAAIAAAAxwAAAAQAAAAEAAAAyQAAAMcAAAAEAAAABAAAAMoAAADHAAAABAAAAAQAAADLAAAARnJhbWVDb250cm9sQW5pbWF0aW9uQ29udHJvbG51bV9mcmFtZXNudW1fcGxheXNQYXJhbWV0ZXJFcnJvcmlubmVyAADHAAAABAAAAAQAAADMAAAAUG9sbGVkQWZ0ZXJFbmRPZkltYWdlSW1hZ2VCdWZmZXJTaXplZXhwZWN0ZWTHAAAABAAAAAQAAAC6AAAAYWN0dWFsAAAAAAAAAQAAAAAAAAABAAAAAAAAAAMAAAAAAAAAAQAAAAAAAAACAAAAAAAAAAEAAAAAAAAABAAAAAAAAAABAAAAAQAAAAMAAAABAAAAAgAAAAEAAAAEAAAAAAAAAAIAAAAAAAAAAQAAAAAAAAAEAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAMAAAAAAAAAAQAAAAAAAAACAAAAAQAAAAQAAAABAAAAAQAAAAEAAAADAAAAAQAAAA4AAAAJAAAABAAAAAkAAAAJAAAACQAAAAMAAAAHAAAAaDkQAIA5EABkORAAgDkQAIA5EACAORAAfTkQAHY5EABDaHVua1R5cGV0eXBlAAAAzgAAAAQAAAABAAAAzwAAAGNyaXRpY2FszgAAAAEAAAABAAAA0AAAAHByaXZhdGVyZXNlcnZlZHNhZmVjb3B5AGg8EAAAAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNccG5nLTAuMTcuN1xzcmNcZGVjb2Rlclx6bGliLnJzAAAAwDwQAF0AAABIAAAAEgAAAMA8EABdAAAAgAAAABUAAADAPBAAXQAAAIwAAAAWAAAATm8gbW9yZSBmb3J3YXJkIHByb2dyZXNzIG1hZGUgaW4gc3RyZWFtIGRlY29kaW5nLgAAAMA8EABdAAAAngAAABUAAABhc3NlcnRpb24gZmFpbGVkOiBzdGVwICE9IDAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2NvcmUvc3JjL2l0ZXIvYWRhcHRlcnMvc3RlcF9ieS5yc689EABZAAAAFQAAAAkAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xwbmctMC4xNy43XHNyY1xmaWx0ZXIucnNGaWx0ZXJpbmcgZmFpbGVkOiBieXRlcyBwZXIgcGl4ZWwgaXMgZ3JlYXRlciB0aGFuIGxlbmd0aCBvZiByb3cAABg+EABXAAAAsgAAAB4AAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlABg+EABXAAAAuAAAADAAAAAYPhAAVwAAAHcAAAAeAAAAGD4QAFcAAABjAAAANgAAAEZpbHRlcmluZyBmYWlsZWQ6IG5vdCBlbm91Z2ggZGF0YSBpbiBwcmV2aW91cyByb3cAAAAYPhAAVwAAAJgAAAANAAAAGD4QAFcAAACZAAAADQAAABg+EABXAAAAmgAAAA0AAAAYPhAAVwAAAJsAAAANAAAAGD4QAFcAAACcAAAADQAAABg+EABXAAAAnQAAAA0AAAB1bnJlYWNoYWJsZQDRAAAACAAAAAQAAADSAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNccG5nLTAuMTcuN1xzcmNcdGV4dF9tZXRhZGF0YS5ycwAAzD8QAF4AAAC5AAAAJgAAAEludmFsaWRLZXl3b3JkU2l6ZVVucmVwcmVzZW50YWJsZU1pc3NpbmdDb21wcmVzc2lv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dC1vZi1ib3VuZHN1bnN1cHBvcnRlZCBHSUYgdmVyc2lvbm1hbGZvcm1lZCBHSUYgaGVhZGVyY29udHJvbCBleHRlbnNpb24gaGFzIHdyb25nIGxlbmd0aERlY29kaW5nRm9ybWF0RXJyb3J1bmRlcmx5aW5nAOMAAAAEAAAABAAAAOQAAABJbwAA4wAAAAQAAAAEAAAA5QAAAEZvcm1hdAAA4wAAAAQAAAAEAAAA5gAAAGNhbm5vdCBhY2Nlc3MgYSBUaHJlYWQgTG9jYWwgU3RvcmFnZSB2YWx1ZSBkdXJpbmcgb3IgYWZ0ZXIgZGVzdHJ1Y3Rpb24AAOcAAAAAAAAAAQAAAOgAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L3N0ZC9zcmMvdGhyZWFkL2xvY2FsLnJzANiOEABPAAAApgEAABoAAADpAAAACAAAAAQAAADqAAAAYXNzZXJ0aW9uIGZhaWxlZDogcGl4ZWwubGVuKCkgPT0gNEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGNvbG9yX3F1YW50LTEuMS4wXHNyY1xsaWIucnMAAABqjxAAWwAAALoAAAAJAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcZ2lmLTAuMTIuMFxzcmNcY29tbW9uLnJzANiPEABXAAAA9QAAACIAAADYjxAAVwAAAPUAAAAsAAAA2I8QAFcAAAD1AAAANgAAANiPEABXAAAA9QAAAEAAAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlANiPEABXAAAA9QAAAEsAAADrAAAACAAAAAQAAADsAAAA7QAAAO4AAAAMAAAABAAAACYAAADuAAAADAAAAAQAAAAnAAAAJgAAAMCQEADvAAAA8AAAACoAAADxAAAA8gAAAGNhcGFjaXR5IG92ZXJmbG93AAAA/JAQABEAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2FsbG9jL3NyYy92ZWMvc3BlY19mcm9tX2l0ZXJfbmVzdGVkLnJzAAAYkRAAXgAAADsAAAASAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9pdGVyLnJzAACIkRAATgAAAFUHAAARAEHwo8IAC/IyYXR0ZW1wdCB0byBkaXZpZGUgYnkgemVyb0luZGV4IG91dCBvZiBib3VuZHMJkhAAEwAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvY29yZS9zcmMvc2xpY2Uvc29ydC5ycwAAJJIQAE4AAADLBAAAFQAAACSSEABOAAAA2QQAAB4AAAAkkhAATgAAAOIEAAAYAAAAJJIQAE4AAADnBAAAHAAAAFRvbyBtdWNoIG9yIHRvbyBsaXR0bGUgcGl4ZWwgZGF0YSBmb3IgdGhlIGdpdmVuIHdpZHRoIGFuZCBoZWlnaHQgdG8gY3JlYXRlIGEgR0lGIEZyYW1lAAC0khAAVgAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGdpZi0wLjEyLjBcc3JjXGNvbW1vbi5ycwAUkxAAVwAAANAAAAAJAAAAc3BlZWQgbmVlZHMgdG8gYmUgaW4gdGhlIHJhbmdlIFsxLCAzMF0AABSTEABXAAAA0QAAAAkAAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlABSTEABXAAAA9QAAAEsAAABkZXNjcmlwdGlvbigpIGlzIGRlcHJlY2F0ZWQ7IHVzZSBEaXNwbGF5dGhlIEdJRiBmb3JtYXQgcmVxdWlyZXMgYSBjb2xvciBwYWxldHRlIGJ1dCBub25lIHdhcyBnaXZlbgAAGJQQADoAAAB0aGUgaW1hZ2UgaGFzIHRvbyBtYW55IGNvbG9ycwAAAFyUEAAdAAAA8wAAAAgAAAAEAAAAsQAAAPMAAAAIAAAABAAAALIAAACxAAAAhJQQALMAAADaAAAAtQAAALYAAADbAAAA9AAAAAEAAAABAAAA9QAAAPQAAAABAAAA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dGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcd2VlemwtMC4xLjdcc3JjXGxpYi5ycwAAANSbEABVAAAAXwAAAAUAAABNaW5pbXVtIGNvZGUgc2l6ZSAyIHJlcXVpcmVkLCBnb3QgAAA8nBAAIgAAANSbEABVAAAAaAAAAAUAAADUmxAAVQAAAGkAAAAFAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcd2VlemwtMC4xLjdcc3JjXGVuY29kZS5yc4icEABYAAAA/wEAABUAAAAMAQAADAAAAAQAAAANAQAADgEAAA8BAABhIERpc3BsYXkgaW1wbGVtZW50YXRpb24gcmV0dXJuZWQgYW4gZXJyb3IgdW5leHBlY3RlZGx5ABABAAAAAAAAAQAAADUAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2FsbG9jL3NyYy9zdHJpbmcucnMAUJ0QAEsAAADpCQAADgAAAAoKU3RhY2s6CgoAABEBAAAEAAAABAAAABIBAAATAQAAFAEAAEpzVmFsdWUoKQAAANCdEAAIAAAA2J0QAAEAAAAaAQAABAAAAAQAAAAbAQAAHAEAAB0BAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlQWNjZXNzRXJyb3IAAASeEAAAAAAAdW5jYXRlZ29yaXplZCBlcnJvcm90aGVyIGVycm9yb3V0IG9mIG1lbW9yeXVuZXhwZWN0ZWQgZW5kIG9mIGZpbGV1bnN1cHBvcnRlZG9wZXJhdGlvbiBpbnRlcnJ1cHRlZGFyZ3VtZW50IGxpc3QgdG9vIGxvbmdpbnZhbGlkIGZpbGVuYW1ldG9vIG1hbnkgbGlua3Njcm9zcy1kZXZpY2UgbGluayBvciByZW5hbWVkZWFkbG9ja2V4ZWN1dGFibGUgZmlsZSBidXN5cmVzb3VyY2UgYnVzeWZpbGUgdG9vIGxhcmdlZmlsZXN5c3RlbSBxdW90YSBleGNlZWRlZHNlZWsgb24gdW5zZWVrYWJsZSBmaWxlbm8gc3RvcmFnZSBzcGFjZXdyaXRlIHplcm90aW1lZCBvdXRpbnZhbGlkIGRhdGFpbnZhbGlkIGlucHV0IHBhcmFtZXRlcnN0YWxlIG5ldHdvcmsgZmlsZSBoYW5kbGVmaWxlc3lzdGVtIGxvb3Agb3IgaW5kaXJlY3Rpb24gbGltaXQgKGUuZy4gc3ltbGluayBsb29wKXJlYWQtb25seSBmaWxlc3lzdGVtIG9yIHN0b3JhZ2UgbWVkaXVtZGlyZWN0b3J5IG5vdCBlbXB0eWlzIGEgZGlyZWN0b3J5bm90IGEgZGlyZWN0b3J5b3BlcmF0aW9uIHdvdWxkIGJsb2NrZW50aXR5IGFscmVhZHkgZXhpc3RzYnJva2VuIHBpcGVuZXR3b3JrIGRvd25hZGRyZXNzIG5vdCBhdmFpbGFibGVhZGRyZXNzIGluIHVzZW5vdCBjb25uZWN0ZWRjb25uZWN0aW9uIGFib3J0ZWRuZXR3b3JrIHVucmVhY2hhYmxlaG9zdCB1bnJlYWNoYWJsZWNvbm5lY3Rpb24gcmVzZXRjb25uZWN0aW9uIHJlZnVzZWRwZXJtaXNzaW9uIGRlbmllZGVudGl0eSBub3QgZm91bmRFcnJvcmtpbmQAABoBAAABAAAAAQAAAB4BAABtZXNzYWdlABoBAAAIAAAABAAAAB8BAABLaW5kT3Njb2RlAAAaAQAABAAAAAQAAAAgAQAAIQEAAAwAAAAEAAAAIgEAACAob3MgZXJyb3IgKQSeEAAAAAAAkKEQAAsAAACboRAAAQAAAG1lbW9yeSBhbGxvY2F0aW9uIG9mICBieXRlcyBmYWlsZWQAALShEAAVAAAAyaEQAA0AAABsaWJyYXJ5L3N0ZC9zcmMvYWxsb2MucnPooRAAGAAAAFUBAAAJAAAAY2Fubm90IG1vZGlmeSB0aGUgcGFuaWMgaG9vayBmcm9tIGEgcGFuaWNraW5nIHRocmVhZBCiEAA0AAAAbGlicmFyeS9zdGQvc3JjL3Bhbmlja2luZy5yc0yiEAAcAAAAhgAAAAkAAABMohAAHAAAAD4CAAAeAAAATKIQABwAAAA9AgAAHwAAACEBAAAMAAAABAAAACMBAAAaAQAACAAAAAQAAAAkAQAAJQEAABAAAAAEAAAAJgEAACcBAAAaAQAACAAAAAQAAAAoAQAAKQEAABoBAAAAAAAAAQAAACoBAABVbnN1cHBvcnRlZAAaAQAABAAAAAQAAAArAQAAQ3VzdG9tZXJyb3IAGgEAAAQAAAAEAAAALAEAAFVuY2F0ZWdvcml6ZWRPdGhlck91dE9mTWVtb3J5VW5leHBlY3RlZEVvZkludGVycnVwdGVkQXJndW1lbnRMaXN0VG9vTG9uZ0ludmFsaWRGaWxlbmFtZVRvb01hbnlMaW5rc0Nyb3NzZXNEZXZpY2VzRGVhZGxvY2tFeGVjdXRhYmxlRmlsZUJ1c3lSZXNvdXJjZUJ1c3lGaWxlVG9vTGFyZ2VGaWxlc3lzdGVtUXVvdGFFeGNlZWRlZE5vdFNlZWthYmxlU3RvcmFnZUZ1bGxXcml0ZVplcm9UaW1lZE91dEludmFsaWREYXRhSW52YWxpZElucHV0U3RhbGVOZXR3b3JrRmlsZUhhbmRsZUZpbGVzeXN0ZW1Mb29wUmVhZE9ubHlGaWxlc3lzdGVtRGlyZWN0b3J5Tm90RW1wdHlJc0FEaXJlY3RvcnlOb3RBRGlyZWN0b3J5V291bGRCbG9ja0FscmVhZHlFeGlzdHNCcm9rZW5QaXBlTmV0d29ya0Rvd25BZGRyTm90QXZhaWxhYmxlQWRkckluVXNlTm90Q29ubmVjdGVkQ29ubmVjdGlvbkFib3J0ZWROZXR3b3JrVW5yZWFjaGFibGVIb3N0VW5yZWFjaGFibGVDb25uZWN0aW9uUmVzZXRDb25uZWN0aW9uUmVmdXNlZFBlcm1pc3Npb25EZW5pZWROb3RGb3VuZG9wZXJhdGlvbiBzdWNjZXNzZnVsAA4AAAAQAAAAFgAAABUAAAALAAAAFgAAAA0AAAALAAAAEwAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABEAAAASAAAAEAAAABAAAAATAAAAEgAAAA0AAAAOAAAAFQAAAAwAAAALAAAAFQAAABUAAAAPAAAADgAAABMAAAAmAAAAOAAAABkAAAAXAAAADAAAAAkAAAAKAAAAEAAAABcAAAAZAAAADgAAAA0AAAAUAAAACAAAABsAAADLnhAAu54QAKWeEACQnhAAhZ4QAG+eEABinhAA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',
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
        case 'wiggle': {
          let size = 2;
          const param = option[1];

          if (param === 'big') size = 4;
          else if (param === 'bigger') size = 6;
          else if (param === 'huge') size = 10;

          commands.push({ name: option[0], param: size });
          break;
        }
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
        case 'sliderev': {
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
