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
          'AGFzbQEAAAABtQIpYAJ/fwF/YAJ/fwBgA39/fwF/YAF/AGABfwF/YAN/f38AYAZ/f39/f38AYAR/f39/AGABfwF+YAV/f39/fwBgAn99AX1gBX9/f39/AX9gAAF/YAN/f30AYAAAYAJ9fQF9YAF9AX1gBn9/f39/fwF/YAN/fX8AYAd/f39/f39/AX9gA399fQBgBH9/f38Bf2AAAXxgCH9/f39/f39/AGACf30AYAR/f35+AGAHf39/f39/fwBgCX9/f39/f35+fgBgB39/f39/fn4AYAJ/fwF+YAN+f38Bf2ATf39/f39/f39/f39/f39/f39/fwF/YAt/f39/f39/f39/fwF/YAN/fn4AYAV/f31/fwBgBH99f38AYAV/f35/fwBgBH9+f38AYAV/f3x/fwBgBH98f38AYAF8AXwC9AgiA3diZxpfX3diaW5kZ2VuX29iamVjdF9kcm9wX3JlZgADA3diZxVfX3diaW5kZ2VuX3N0cmluZ19nZXQAAQN3YmcVX193YmluZGdlbl9udW1iZXJfZ2V0AAEDd2JnFV9fd2JpbmRnZW5fc3RyaW5nX25ldwAAA3diZxRfX3diaW5kZ2VuX2Vycm9yX25ldwAAA3diZxRfX3diaW5kZ2VuX2lzX29iamVjdAAEA3diZxlfX3diaW5kZ2VuX2pzdmFsX2xvb3NlX2VxAAADd2JnFl9fd2JpbmRnZW5fYm9vbGVhbl9nZXQABAN3YmcdX193YmdfU3RyaW5nXzg4ODEwZGZlYjQwMjE5MDIAAQN3YmcaX193YmdfZ2V0XzI3ZmUzZGFjMWM0ZDAyMjQAAAN3YmcdX193YmdfbGVuZ3RoX2U0OThmYmMyNGY5YzFkNGYABAN3YmcWX193YmluZGdlbl9pc19mdW5jdGlvbgAEA3diZxtfX3diZ19uZXh0X2I3ZDUzMGMwNGZkOGIyMTcABAN3YmcbX193YmdfbmV4dF84ODU2MGVjMDZhMDk0ZGVhAAQDd2JnG19fd2JnX2RvbmVfMWViZWMwM2JiZDkxOTg0MwAEA3diZxxfX3diZ192YWx1ZV82YWM4ZGE1Y2M1YjNlZmRhAAQDd2JnH19fd2JnX2l0ZXJhdG9yXzU1ZjExNDQ0NjIyMWFhNWEADAN3YmcaX193YmdfZ2V0X2JhZjQ4NTVmOWE5ODYxODYAAAN3YmcbX193YmdfY2FsbF85NWQxZWE0ODhkMDNlNGU4AAADd2JnHl9fd2JnX2lzQXJyYXlfMzlkMjg5OTdiZjZiOTZiNAAEA3diZy1fX3diZ19pbnN0YW5jZW9mX0FycmF5QnVmZmVyX2E2OWYwMmVlNGM0ZjUwNjUABAN3YmceX193YmdfZW50cmllc180ZTEzMTViNzc0MjQ1OTUyAAQDd2JnHV9fd2JnX2J1ZmZlcl9jZjY1YzA3ZGUzNGI5YTA4AAQDd2JnGl9fd2JnX25ld181MzdiNzM0MWNlOTBiYjMxAAQDd2JnGl9fd2JnX3NldF8xNzQ5OWU4YWE0MDAzZWJkAAUDd2JnHV9fd2JnX2xlbmd0aF8yN2EyYWZlOGFiNDJiMDlmAAQDd2JnLF9fd2JnX2luc3RhbmNlb2ZfVWludDhBcnJheV8wMWNlYmU3OWNhNjA2Y2NhAAQDd2JnHV9fd2JnX3JhbmRvbV9hZmIzMjY1NTI3Y2Y2N2M4ABYDd2JnGl9fd2JnX25ld19hYmRhNzZlODgzYmE4YTVmAAwDd2JnHF9fd2JnX3N0YWNrXzY1ODI3OWZlNDQ1NDFjZjYAAQN3YmccX193YmdfZXJyb3JfZjg1MTY2N2FmNzFiY2ZjNgABA3diZxdfX3diaW5kZ2VuX2RlYnVnX3N0cmluZwABA3diZxBfX3diaW5kZ2VuX3Rocm93AAEDd2JnEV9fd2JpbmRnZW5fbWVtb3J5AAwDxwPFAwkXBgYNAgcEBgEGBQAGBwEFBwEBABgAEAMABQUJGQICBQUBAREFBgcSAwIFAgcAAQMFAQEBAQEDAQsBEgECAAMCAQABARoAGwAABgATBA0CAAscAAAAAAAAHR4FAwAHAwMAAgEBAQAMAAEDAwEFAQcAAAEABgQFAAABBQEBAQEBAQUFAQEFBQAfAAkLBwsBIAcDBBMBAAYAAAAAAAEUAAEEAwEACQAhAgUFAQUADBQAAAEBBAEAAAMACQAAAAAAAQAAAAAAAAAAAAAAAAQDDQMAAAMBAQ4AAQEAAQEDAwAAAAAAAAEFAAICAAcCAgEGAgIBAw4OAQEABQsAAAAAAAABAQEAAwAABAUAAAAAAAUFAQcFAAAAAQEDBQcDAgUAEQEAAAAACQsiJCYBAAEDAwEHAAAEBQAAAgEDAAABAQEBAAAGBA8PBAAAAAQB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ACABLwFAIg8gAS8BCCIGIAEtAEhrQf//A3FHDQIgAS0ACiITQQxJDQEMAgsgDyATQZC0wgAQzQEACyABIBNBAWo6AAogASAGQQF0QQFyOwEICyABIA9BAWo7AUAgByETIAwhDwtBACENIAghDCAORQ0ACwwBC0EBIBQgDUEBcRshFAtBASEGIAlFDQAgCiABKAIUIgJLDQIgASgCECAJIAoQwgMaIAEgCjYCGCABIAo2AhwLIBRBACAUQQFHGwshDiABIAw7ATogASAGOwE4IAFBPmogEzoAACABQTxqIA87AQAgACAFIBBrNgIEIAAgAyASazYCACAAIA4gFCADIBJLGzoACAwBCyAKIAJB4LLCABCXAwALIAtB0ABqJAALryECHX8DfiMAQdAAayILJAACQAJ/An8CQAJAAkACQAJAAkACQAJ/AkACQAJAAkACQCABLQBHRQRAIAEpAzghIyABQQA7ATggI0L//wODUEUNAiABLQALIgggAS0ACiIJSQ0BIAMhEiAIIQwMBQsgAEECOgAIIABCADcCAAwPCyALQgA3AxgCfyADQcAAIAhrIgdB+AFxQQN2IgxJBEAgA0EJTw0DIAtBGGogAiADEMIDGiADQQN0IQdB0LDCAAwBCyAHQf8BcUHIAE8NAyALQRhqIAJBACADIAxPGyAMEMIDGiAHQfgBcSEHIAMgDGshEiACIAxqCyECIAEgByAIaiIMOgALIAEgASkDACALKQMYIAithoQ3AwAMAwsgI0IQiKchDCAjQjCIpyETIAMhEiAjQiCIpwwDCyADQQhBoLPCABCXAwALIAxBCEGQs8IAEJcDAAsgCSAMQf8BcUsEQEEBIRQMCAsgASAMIAlrOgALIAEgASkDACIjIAmtiDcDAEEDIRQgAS8BCCAjp3EiDCABLwFATw0HIAwgAS8BQkYNASABLwFEIAxB//8DcUYNAiABQSBqIQggAUEoaiIJKAIABEAgAUEQaiAIIAwQcRogCSgCACIJIAxB//8DcSIITQ0EIAFBJGooAgAgCEECdGoiCC0AAiETIAgvAQAMAQsgAS0ASUUNByABEJQCIAFBEGogCCAMEHEaIAFBKGooAgAiCSAMQf//A3EiCE0NBCABQSRqKAIAIAhBAnRqIggtAAIhEyAILwEACyEPIAFBHGooAgAiCCABQRhqKAIAIglJDQQg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NwNwIANCADcDaCADQgA3A2AgA0IANwNYIANCADcDUCADQgA3A0ggA0IANwNAIANCADcDOCADQgA3AzAgA0IANwMoIANCADcDICADQgA3AxggA0IANwMQIANCADcDCCADQgA3AwAgA0IANwO4AiADQgA3A7ACIANCADcDqAIgA0IANwOgAiADQgA3A5gCIANCADcDkAIgA0IANwOIAiADQgA3A4ACIANCADcD+AEgA0IANwPwASADQgA3A+gBIANCADcD4AEgA0IANwPYASADQgA3A9ABIANCADcDyAEgA0IANwPAASADQgA3A7gBIANCADcDsAEgA0IANwOoASADQgA3A6ABIANCADcD2AMgA0IANwPQAyADQgA3A8gDIANCADcDwAMgA0IANwO4AyADQgA3A7ADIANCADcDqAMgA0IANwOgAyADQgA3A5gDIANCADcDkAMgA0IANwOIAyADQgA3A4ADIANCADcD+AIgA0IANwPwAiADQgA3A+gCIANCADcD4AIgA0IANwPYAiADQgA3A9ACIANCADcDyAIgA0IANwPAAiADQeADakEAQdAAEMADGkGckMMAKAIAIgohByACQQNrQRhtIgVBACAFQQBKGyIOIQYgDkFobCEPIA5BAnRBrJDDAGohBQNAIAQgB08gBCAEIAdJaiADIARBA3RqIAZBAEgEfEQAAAAAAAAAAAUgBSgCALcLOQMAIAVBBGohBSAGQQFqIQYiBCAHS3JFDQALQQAhBgNAQQAhBCADQcACaiAGQQN0aiAcIAAgBEEDdGorAwAgAyAGIARrQQN0aisDAKKgOQMAIAYgCkkEQCAGIAYgCklqIgYgCk0NAQsLRAAAAAAAAPB/RAAAAAAAAOB/IAIgD2oiAkGXCGsiBUH/B0siEBtEAAAAAAAAAABEAAAAAAAAYAMgAkEYayIJQblwSSIRG0QAAAAAAADwPyAJQYJ4SCISGyAJQf8HSiITG0H9FyAJIAlB/RdOG0H+D2sgBSAQGyIVQfBoIAkgCUHwaEwbQZIPaiACQbEHaiARGyIWIAkgEhsgExtB/wdqrUI0hr+iIR4gCkECdCADakHcA2ohD0EPIAJrQR9xIRdBECACa0EfcSEUIAJBGWshGCAKIQUCQANAIANBwAJqIAVBA3RqKwMAIRwCQCAFRQ0AIANB4ANqIQggBSEEA0AgHEQA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BCACQZi3wgAQzQEACyABQQRqKAIAIgggBEEybGoiAi0AMCIGQRBJDQQgAUEUaigCACIFIQYgASgCDCAFRgRAIAFBDGogBRChASABKAIUIQYLIAFBEGoiAygCACAGQQl0akH/AUGABBDAAxogASABKAIUIgZBAWoiCTYCFCAJRQ0DIAMoAgAgBkEJdGoiAyAIIARBMmxqIgQtACBBAXRqIAIvAQA7AQAgAyAEQSFqLQAAQQF0aiACLwECOwEAIAMgBEEiai0AAEEBdGogAi8BBDsBACADIARBI2otAABBAXRqIAIvAQY7AQAgAyAEQSRqLQAAQQF0aiACLwEIOwEAIAMgBEElai0AAEEBdGogAi8BCjsBACADIARBJmotAABBAXRqIAIvAQw7AQAgAyAEQSdqLQAAQQF0aiACLwEOOwEAIAMgBEEoai0AAEEBdGogAi8BEDsBACADIARBKWotAABBAXRqIAIvARI7AQAgAyAEQSpqLQAAQQF0aiACLwEUOwEAIAMgBEErai0AAEEBdGogAi8BFjsBACADIARBLGotAABBAXRqIAIvARg7AQAgAyAEQS1qLQAAQQF0aiACLwEaOwEAIAMgBEEuai0AAEEBdGogAi8BHDsBACADIARBL2otAABBAXRqIAIvAR47AQAgByABQSBqKAIAIgJJBEAgAUEcaigCACAHQQF0aiAFOwEADAYLIAcgAkGot8IAEM0BAAsgBSgCACACQTJsaiICQQE6ADAgAiADOgAgIAIgCjsBACAHIAFBIGooAgAiAkkEQCABQRxqKAIAIAdBAXRqIAZBgCByOwEADAULIAcgAkHIt8IAEM0BAAsgAiAEQfi2wgAQzQEACyAEIAdBiLfCABDNAQALQfy1wgBBK0G4t8IAEIcCAAsgAiAGakEgaiADOgAAIAIgBkEBdGogCjsBACACQTBqIgIgAi0AAEEBajoAAAsgAUEgaiICKAIAIgQgASgCGEYEQCALIAQQogEgAigCACEECyABQRxqKAIAIARBAXRqQYDAADsBACACIAIoAgBBAWo2AgAgCiECQQELIQEgACACOwECIAAgATsBAAvYIgIXfwF+IwBBsAFrIgIkACACIAE2AgwjAEEQayIGJAAgAUHAAWooAgAEQCABQQA2AsABCyACQegAaiEIIAYgARBUAkACQAJAAkACQAJAAkACQAJAIAYtAAAiBUELRwRAA0AgBigCCCEMIAYoAgQhBAJAAkACQAJAIAVBD3FBAWsOCgIDAwMDAwEDAwADCyAIQgI3AgAMBgsgBEEnai0AACENIAQtACohDyAELwEkIQ4gBC8BIiERIAQvASAhEiAELwEeIRMgBC0AKSEUIAQtACYhFSAELQAoIRYgBC8BHCEXIARBFGooAgAiCQRAAkAgBEEYaigCACIDRQRAQQEhCgwBCyADQQBOIgdFDQkgAyAHEP4CIgpFDQoLIAogCSADEMIDGgsCQCAEKAIARQRAIARBCGooAgAhCSAEKAIEIQcMAQsgBEEIaigCACEQQQEhGEEBIQkgBEEMaigCACIHBEAgB0EATiILRQ0JIAcgCxD+AiIJRQ0LCyAJIBAgBxDCAxoLIAFBxAFqIQsCQCABQdgBaigCACIQRQ0AIAFB1AFqKAIARQ0AIBAQOgsCQCALKAIARQ0AIAFByAFqKAIARQ0AIAFBzAFqKAIAEDoLIAEgGDYCxAEgAUHuAWogDzoAACABQe0BaiAUOgAAIAFB7AFqIBY6AAAgAUHrAWogDToAACABQeoBaiAVOgAAIAFB6AFqIA47AQAgAUHmAWogETsBACABQeQBaiASOwEAIAFB4gFqIBM7AQAgAUHgAWogFzsBACABQdwBaiADNgIAIAFB2AFqIAo2AgAgAUHUAWogAzYCACABQdABaiAHNgIAIAFBzAFqIAk2AgAgAUHIAWogBzYCACAEQRRqKAIAIAFBsAFqKAIAckUNBCAERSAFQQFHckUEQCAMEDoLIAhBAjYCACAIIAs2AgQMBgsgBEUNACAMEDoLIAYgARBUIAYtAAAiBUELRw0ACwsgBikCBCEZIAggBkEMaigCADYCCCAIIBk3AgAMAgtBKkEBEP4CIgNFDQUgA0EoakH0r8AALwAAOwAAIANBIGpB7K/AACkAADcAACADQRhqQeSvwAApAAA3AAAgA0EQakHcr8AAKQAANwAAIANBCGpB1K/AACkAADcAACADQcyvwAApAAA3AABBDEEEEP4CIgdFDQcgB0EqNgIIIAcgAzYCBCAHQSo2AgAgCEHEosAANgIIIAggBzYCBCAIQQA2AgALIARFIAVBAUdyDQAgDBA6CyAGQRBqJAAMBAsQlgIACyADIAcQvAMACyAHIAsQvAMAC0EqQQEQvAMACwJAAkACQCACKAJoQQJGBEACQAJAIAIoAmwiBQRAIAJBEGohAyAFLQAoIQcgBS8BJCEIIAUvASIhCSAFLwEeIQwgBS8BICEKAkACQAJ/IAUvARwiBUUEQEEBIQRBAAwBC0EBIQYgBUEKbCIFIAVodiIEQQFHBEADQAJAIAQgBk0EQCAGIARrIgYgBmh2IQYMAQsgBCAGayIEIARodiEECyAEIAZHDQALIAZFDQILIAZBAUYhBCAFIAZuCyEFIAMgBzoAGCADIAg2AhQgAyAJNgIQIAMgDDYCDCADIAo2AgggAyAENgIEIAMgBTYCAAwBC0GAwsAAQRlB5MHAABCHAgALAkAgAUHoAWovAQAgAUHmAWovAQAiAyADQQJ0IAFB8gFqLQAAG2wiCEUEQEEBIQUMAQsgCEEATiIDRQ0FIAggAxD/AiIFRQ0GCyACQegAaiEHIwBBMGsiBiQAIAFB5gFqLwEAIgMgA0ECdCABQfIBai0AABshCiABQegBai8BACEDAkACQAJAAkACQAJAAkACQAJAAkAgAUHuAWotAABFBEAgAyAKbCIDIAhLDQMgBkEgaiABIAUgAxAwIAYoAiAiA0ECRw0BIAYtACRFDQIMCQsgBkIANwIUIAYgAzYCEANAIAZBCGohD0EAIQNBACENIwBBEGsiBCQAAkACQAJAIAZBEGoiDCgCACILRQ0AIAwoAggiCUEETw0AIAwoAgQhDSAEQoSAgIAgNwIIIARCiICAgIABNwIAAkAgDSAEIAlBAnRqKAIAaiIDIAtJDQAgBEIBNwIIIARChICAgCA3AgAgCUEERg0CIAQgCUECdGooAgAhAyAMIAlBAWoiDjYCCCADIAtJDQAgBEIBNwIIIARChICAgCA3AgAgDkEERg0CIAQgDkECdGooAgAhAyAMIAlBAmoiDjYCCCADIAtJDQAgBEIBNwIIIARChICAgCA3AgAgDkEERg0CIAQgDkECdGooAgAhAyAMIAlBA2oiDjYCCCADIAtJDQAgBEIBNwIIIARChICAgCA3AgAgDkEERg0CIAQgDkECdGooAgAhAyAMIAlBBGoiDjYCCCADIAtJDQAgBEIBNwIIIARChICAgCA3AgAgCUUNAiAEIA5BAnRqKAIAIQMgDCAJQQVqNgIICyAMIAM2AgRBASEDCyAPIA02AgQgDyADNgIAIARBEGokAAwBC0EEQQRBlKzCABDNAQALIAYoAghFDQkgBigCDCAKbCIDIAhLDQQgCiAIIANrIgRLDQUgBkEgaiABIAMgBWogChAwIAYtACQhAyAGKAIgIgRBAkcNBiADDQALQQ9BARD+AiIERQ0GIARBB2pBj7DAACkAADcAACAEQYiwwAApAAA3AABBDEEEEP4CIgNFDREgA0EPNgIIIAMgBDYCBCADQQ82AgAgB0HEosAANgIIIAcgAzYCBCAHQQA2AgAMCQsgByAGKAAlNgAFIAdBCGogBkEoaigAADYAACAHIAYtACQ6AAQgByADNgIADAgLQQ9BARD+AiIERQ0FIARBB2pBj7DAACkAADcAACAEQYiwwAApAAA3AABBDEEEEP4CIgNFDQ8gA0EPNgIIIAMgBDYCBCADQQ82AgAgB0HEosAANgIIIAcgAzYCBCAHQQA2AgAMBwsgAyAIQZiwwAAQlwMACyADIAhB+K/AABCWAwALIAogBEH4r8AAEJcDAAsgByAGKAAlNgAFIAdBCGogBkEoaigAADYAACAHIAM6AAQgByAENgIADAMLQQ9BARC8AwALQQ9BARC8AwALIAdBAjYCAAsgBkEwaiQAIAIoAmhBAkcNAgJAIAIoAiAiA0H/////A3EgA0cNACADQQJ0rSACKAIkIgStfiIZQiCIpw0AIBmnIAhNDQILIAgEQCAFEDoLIAJByABqIgMiAUEAOgAAIAFBAjoAASACQfQAakEyNgIAIAIgAkEkajYCcCACQTI2AmwgAiACQSBqNgJoIAJBAjYClAEgAkEDNgKMASACQbymwAA2AogBIAJBADYCgAEgAiACQegAajYCkAEgAkHYAGogAkGAAWoQXiACQawBaiACQeAAaigCADYCACACQQY6AKABIAIgAikDWDcCpAEgAEEEaiIBIAMpAgA3AhAgASACQaABaiIFKQIANwIAIAFBGGogA0EIaikCADcCACABQQhqIAVBCGopAgA3AgAgAEEENgIADAYLIABBBzYCAAwFCyACIAg2AkAgAiAFNgI8IAIgCDYCOCACIAQ2AjQgAiADNgIwIAIoAhwgAigCGHIgASgC+AEiCCADR3JFIAQgASgC/AEiBEZxRQRAIAIgAkEwajYCiAEgAiACQQxqNgKEASACIAJBEGo2AoABIAJB6ABqIQMgAkGAAWohCSMAQUBq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IAEoApwDIA9qNgKcAyAPIAMoAgAiAUsNByAAQQA2AgAgAEEUaiAZNgIAIABBEGogEzYCACAAQQ1qIAw6AAAgAEEMaiAdOgAAIABBCGogBDYCACAAIAIoAgBBAWo2AgQLIA5B0ABqJAAPCyAFIAtBkJvAABCWAwALQQBBAEGgm8AAEM0BAAtBAUEAQbCbwAAQmAMACyAPIARBsJvAABCXAwALIA8gBEHAm8AAEJcDAAsgDyACQdCbwAAQlwMACyAPIAFB4JvAABCXAwALjgoBAX8jAEEwayICJAACfwJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQCAALQAAQQFrDhEBAgMEBQYHCAkKCwwNDg8QEQALIAIgAC0AAToACCACQSRqQQI2AgAgAkEsakEBNgIAIAJBxLrAADYCICACQQA2AhggAkHaADYCFCACIAJBEGo2AiggAiACQQhqNgIQIAEgAkEYahDoAQwRCyACIAApAwg3AwggAkEkakECNgIAIAJBLGpBATYCACACQai6wAA2AiAgAkEANgIYIAJB2wA2AhQgAiACQRBqNgIoIAIgAkEIajYCECABIAJBGGoQ6AEMEAsgAiAAKQMINwMIIAJBJGpBAjYCACACQSxqQQE2AgAgAkGousAANgIgIAJBADYCGCACQdwANgIUIAIgAkEQajYCKCACIAJBCGo2AhAgASACQRhqEOgBDA8LIAIgACsDCDkDCCACQSRqQQI2AgAgAkEsakEBNgIAIAJBjLrAADYCICACQQA2AhggAkHdADYCFCACIAJBEGo2AiggAiACQQhqNgIQIAEgAkEYahDoAQwOCyACIAAoAgQ2AgggAkEkakECNgIAIAJBLGpBATYCACACQey5wAA2AiAgAkEANgIYIAJB3gA2AhQgAiACQRBqNgIoIAIgAkEIajYCECABIAJBGGoQ6AEMDQsgAiAAKQIENwMIIAJBJGpBATYCACACQSxqQQE2AgAgAkHYucAANgIgIAJBADYCGCACQd8ANgIUIAIgAkEQajYCKCACIAJBCGo2AhAgASACQRhqEOgBDAwLIAJBJGpBATYCACACQSxqQQA2AgAgAkHIucAANgIgIAJB+LfAADYCKCACQQA2AhggASACQRhqEOgBDAsLIAJBJGpBATYCACACQSxqQQA2AgAgAkG0ucAANgIgIAJB+LfAADYCKCACQQA2AhggASACQRhqEOgBDAoLIAJBJGpBATYCACACQSxqQQA2AgAgAkGgucAANgIgIAJB+LfAADYCKCACQQA2AhggASACQRhqEOgBDAkLIAJBJGpBATYCACACQSxqQQA2AgAgAkGMucAANgIgIAJB+LfAADYCKCACQQA2AhggASACQRhqEOgBDAgLIAJBJGpBATYCACACQSxqQQA2AgAgAkH0uMAANgIgIAJB+LfAADYCKCACQQA2AhggASACQRhqEOgBDAcLIAJBJGpBATYCACACQSxqQQA2AgAgAkHkuMAANgIgIAJB+LfAADYCKCACQQA2AhggASACQRhqEOgBDAYLIAJBJGpBATYCACACQSxqQQA2AgAgAkHYuMAANgIgIAJB+LfAADYCKCACQQA2AhggASACQRhqEOgBDAULIAJBJGpBATYCACACQSxqQQA2AgAgAkHMuMAANgIgIAJB+LfAADYCKCACQQA2AhggASACQRhqEOgBDAQLIAJBJGpBATYCACACQSxqQQA2AgAgAkG4uMAANgIgIAJB+LfAADYCKCACQQA2AhggASACQRhqEOgBDAMLIAJBJGpBATYCACACQSxqQQA2AgAgAkGguMAANgIgIAJB+LfAADYCKCACQQA2AhggASACQRhqEOgBDAILIAJBJGpBATYCACACQSxqQQA2AgAgAkGIuMAANgIgIAJB+LfAADYCKCACQQA2AhggASACQRhqEOgBDAELIAEgACgCBCAAQQhqKAIAEPgCCyACQTBqJAALlgkDFX8DfQF+IwBBIGsiBSQAAkAgAEEIaigCACIERQ0AIAVBCGogAEEEaigCACILEKYDIAUgBSgCCCAFKAIMEIIDIAUoAgCzIAUoAgSzlEMAACBBlSIXIAFfDQACfwJAAkACQAJAAkACQCAEQePxuBxLDQAgBEEkbCIHQQBIDQAgBEHk8bgcSUECdCECIAcEfyAHIAIQ/gIFIAILIgxFDQMgBSAMNgIUIAUgBDYCECALIARBJGwiBmohESAEIQcgCyECA0AgBiAKRwRAIAdFDQMgAkEcaigCACEIIAIoAgwhDSACKAIIIQ4gAigCBCEPIAIoAgAhEAJAIAJBIGooAgAiCUUEQEEBIQMMAQsgCUEASA0DIAlBARD+AiIDRQ0FCyADIAggCRDCAyEI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BSACLwECAn8gBCgCACIBKAIAIAEoAggiA0cEQCABDAELIAEgA0EBEKMBIAEoAgghAyAEKAIACyECIAEgA0EBajYCCCABKAIEIANqQf8BOgAAIAIoAggiAyACKAIARwR/IAIFIAIgA0EBEKMBIAIoAgghAyAEKAIACyEBIAIgA0EBajYCCCACKAIEIANqQQs6AAAgASgCACABKAIIIgJrQQpNBEAgASACQQsQowEgASgCCCECCyABIAJBC2o2AgggASgCBCACaiIBQaOfwAApAAA3AAAgAUEHakGqn8AAKAAANgAAAn8gBCgCACIBKAIAIAEoAggiA0cEQCABDAELIAEgA0EBEKMBIAEoAgghAyAEKAIACyECIAEgA0EBajYCCCABKAIEIANqQQM6AAAgAigCCCIBIAIoAgBGBEAgAiABQQEQowEgAigCCCEBCyACIAFBAWo2AgggAigCBCABakEBOgAABEAgBCgCACICKAIAIAIoAggiAWtBAU0EQCACIAFBAhCjASACKAIIIQELIAIgAUECajYCCCACKAIEIAFqQQA7AAAMAwsgBCgCACICKAIAIAIoAggiAWtBAU0EQCACIAFBAhCjASACKAIIIQELIAIgAUECajYCCCACKAIEIAFqIgEgBUGA/gNxQQh2OgABIAEgBToAAAwCCyACLQACIQYgAi8BBCEFIAItAAEhBwJ/IAQoAgAiASgCACABKAIIIgNHBEAgAQwBCyABIANBARCjASABKAIIIQMgBCgCAAshAiABIANBAWo2AgggASgCBCADakH5AToAACACKAIIIgMgAigCAEcEfyACBSACIANBARCjASACKAIIIQMgBCgCAAshASACIANBAWo2AgggAigCBCADakEEOgAAIAEoAggiAiABKAIARgRAIAEgAkEBEKMBIAEoAgghAgsgASACQQFqNgIIIAEoAgQgAmogBzoAACAFQYD+A3FBCHYhBwJ/IAQoAgAiASgCACABKAIIIgNrQQFLBEAgAQwBCyABIANBAhCjASABKAIIIQMgBCgCAAshAiABIANBAmo2AgggASgCBCADaiIBIAc6AAEgASAFOgAAIAIoAggiASACKAIARgRAIAIgAUEBEKMBIAIoAgghAQsgAiABQQFqNgIIIAIoAgQgAWogBjoAAAwBC0GgnsAAQStBsJ/AABCHAgALIAQo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xgEACyAEQTBqJAAgCEUgB0VyRQRAIAUQOgsCQCAARQ0AIAMoAiBFDQAgBRA6CyADQdAAaiQAC6MOAgN/AX4jAEEwayIDJAACfwJAAkACQAJAAkACQCAAKAIAQQFrDgUBAgMEBQALIwBBMGsiAiQAAn8CQCAAQQRqIgAoAhBFBEAgAC0AAEEDRw0BIAJBFGpBATYCACACQRxqQQA2AgAgAkGcycAANgIQIAJB2MPAADYCGCACQQA2AgggASACQQhqEOgBDAILIAIgAEEQajYCBCACQRRqQQI2AgAgAkEcakECNgIAIAJBLGpBhQE2AgAgAkH4yMAANgIQIAJBADYCCCACQYQBNgIkIAIgADYCICACIAJBIGo2AhggAiACQQRqNgIoIAEgAkEIahDoAQwBCyACQRRqQQE2AgAgAkEcakEBNgIAIAJBiMnAADYCECACQQA2AgggAkGEATYCJCACIAA2AiAgAiACQSBqNgIYIAEgAkEIahDoAQsgAkEwaiQADAULIABBBGohAiAAQRRqIgAoAgBFBEAgA0EkakEBNgIAIANBLGpBATYCACADQdjIwAA2AiAgA0EANgIYIANBhAE2AgwgAyACNgIIIAMgA0EIajYCKCABIANBGGoQ6AEMBQsgAyAANgIEIANBJGpBAjYCACADQSxqQQI2AgAgA0EUakGFATYCACADQcjIwAA2AiAgA0EANgIYIANBhAE2AgwgAyACNgIIIAMgA0EIajYCKCADIANBBGo2AhAgASADQRhqEOgBDAQLIwBBMGsiAiQAAkACQAJAAkACQAJAIABBBGoiBCgCAEEBaw4DAAECAwtBASEAIAJBHGpBATYCACACQSRqQQA2AgAgAkHcx8AANgIYIAJB2MPAADYCICACQQA2AhAgASACQRBqEOgBRQ0DDAQLIAIgBEEEajYCDEEBIQAgAkEcakEBNgIAIAJBJGpBATYCACACQZDHwAA2AhggAkEANgIQIAJBggE2AiwgAiACQShqNgIgIAIgAkEMajYCKCABIAJBEGoQ6AFFDQIMAwtBASEAIAJBHGpBATYCACACQSRqQQA2AgAgAkHsxsAANgIYIAJB2MPAADYCICACQQA2AhAgASACQRBqEOgBRQ0BDAILQQEhACACQRxqQQE2AgAgAkEkakEANgIAIAJBnMjAADYCGCACQdjDwAA2AiAgAkEANgIQIAEgAkEQahDoAQ0BCyAEKAIQRQRAQQAhAAwBCyACIARBEGo2AgwgAkEcakEBNgIAIAJBJGpBATYCACACQajIwAA2AhggAkEANgIQIAJBhQE2AiwgAiACQShqNgIgIAIgAkEMajYCKCABIAJBEGoQ6AEhAAsgAkEwaiQAIAAMAwsCQAJAAkBBAiAAKQMIIgWnQQJrIAVCAVgbQQFrDgIBAgALIANBJGpBATYCACADQSxqQQA2AgAgA0GsysAANgIgIANB2MPAADYCKCADQQA2AhggASADQRhqEOgBDAQLIANBJGpBATYCACADQSxqQQA2AgAgA0GQysAANgIgIANB2MPAADYCKCADQQA2AhggASADQRhqEOgBDAMLIANBJGpBATYCACADQSxqQQA2AgAgA0H0ycAANgIgIANB2MPAADYCKCADQQA2AhggASADQRhqEOgBDAILIwBBMGsiAiQAAn8CQAJAAkACQAJAAkBBASAAQQRqIgAtAAAiBEEEayAEQQNNG0H/AXFBAWsOAgECAAsgAiAAQQFqNgIEIAJBFGpBAzYCACACQRxqQQI2AgAgAkEsakGGATYCACACQazGwAA2AhAgAkEANgIIIAJBhAE2AiQgAiAAQRBqNgIgIAIgAkEgajYCGCACIAJBBGo2AiggASACQQhqEOgBDAULIARBAmsOAgIDAQsgAiAAQQRqNgIAIAAtABBBA0YEQCACQRRqQQE2AgAgAkEcakEBNgIAIAJB0MTAADYCECACQQA2AgggAkGCATYCJCACIAJBIGo2AhggAiACNgIgIAEgAkEIahDoAQwECyACIABBEGo2AgQgAkEUakECNgIAIAJBHGpBAjYCACACQSxqQYIBNgIAIAJBkMTAADYCECACQQA2AgggAkGHATYCJCACIAJBIGo2AhggAiACNgIoIAIgAkEEajYCICABIAJBCGoQ6AEMAwsgAiAANgIEIAJBFGpBAjYCACACQRxqQQE2AgAgAkH8xMAANgIQIAJBADYCCCACQYcBNgIkIAIgAkEgajYCGCACIAJBBGo2AiAgASACQQhqEOgBDAILIAIgADYCBCACQRRqQQI2AgAgAkEcakEBNgIAIAJB+MXAADYCECACQQA2AgggAkGHATYCJCACIAJBIGo2AhggAiACQQRqNgIgIAEgAkEIahDoAQwBCyACQRRqQQE2AgAgAkEcakEANgIAIAJBtMXAADYCECACQdjDwAA2AhggAkEANgIIIAEgAkEIahDoAQsgAkEwaiQADAELIABBBGogARBrCyADQTBqJAAL/wIBAn8gAEEUaigCAARAIABBEGooAgAQOgsCQCAAQThqKAIAIgFFDQAgASAAQTxqIgEoAgAoAgARAwAgASgCACIBQQRqKAIARQ0AIAFBCGooAgAaIAAoAjgQOgsgAEHEAGooAgAEQCAAQcgAaigCABA6CyAAQdAAaigCAARAIABB1ABqKAIAEDoLIAAoAigEQCAAQSxqKAIAEDoLAkAgAEHoAGooAgAiAUECRg0AAkAgAEH8AGooAgAiAkUNACAAQfgAaigCAEUNACACEDogACgCaCEBCyABRQ0AIABB7ABqKAIARQ0AIABB8ABqKAIAEDoLAkAgAEGwAWooAgAiAUUNACAAKAKsAUUNACABEDoLAkAgAEHYAWooAgAiAUUNACAAQdQBaigCAEUNACABEDoLAkAgACgCxAFFDQAgAEHIAWooAgBFDQAgAEHMAWooAgAQOgsgACgCuAEEQCAAQbwBaigCABA6CyAAQYgCaigCAARAIABBjAJqKAIAEDoLC7cFAQt/IwBBMGsiBSQAIAVCgYCAgKABNwMgIAUgAjYCHCAFQQA2AhggBSACNgIUIAUgATYCECAFIAI2AgwgBUEANgIIIAAoAgQhCiAAKAIAIQsgACgCCCEMAn8DQAJAIARFBEACQCACIAhJDQADQCABIAhqIQYCfyACIAhrIgNBCE8EQCADIQACQAJAAkACQAJAAkAgBkEDakF8cSIDIAZGDQAgAyAGayIDIAAgACADSxsiBEUNAEEAIQNBASEHA0AgAyAGai0AAEEKRg0GIAQgA0EBaiIDRw0ACyAEIABBCGsiA0sNAgwBCyAAQQhrIQNBACEECwNAAkAgBCAGaiIHKAIAQYqUqNAAcyINQX9zIA1BgYKECGtxQYCBgoR4cQ0AIAdBBGooAgBBipSo0ABzIgdBf3MgB0GBgoQIa3FBgIGChHhxDQAgBEEIaiIEIANNDQELCyAAIARJDQELQQAhByAAIARGDQEDQCAEIAZqLQAAQQpGBEAgBCEDQQEhBwwECyAEQQFqIgQgAEcNAAsMAQsgBCAAQZz1wgAQlgMACyAAIQMLIAUgAzYCBCAFIAc2AgAgBSgCBCEAIAUoAgAMAQtBACEAQQAgA0UNABoDQEEBIAAgBmotAABBCkYNARogAyAAQQFqIgBHDQALIAMhAEEAC0EBRwRAIAIhCAwCCyAAIAhqIgBBAWohCAJAIAAgAk8NACAAIAFqLQAAQQpHDQBBACEEIAgiAyEADAQLIAIgCE8NAAsLQQEhBCACIgAgCSIDRw0BC0EADAILAkAgDC0AAARAIAtB+PDCAEEEIAooAgwRAgANAQsgASAJaiEGIAAgCWshByAMIAAgCUcEfyAGIAdqQQFrLQAAQQpGBUEACzoAACADIQkgCyAGIAcgCigCDBECAEUNAQsLQQELIAVBMGokAAvOAwECfyMAQeAAayICJAACQAJAAkACQAJAAkACQEEBIAEtAAAiA0EfayADQR5NG0H/AXFBAWsOAwECAwALIABBBTYCACAAIAEpAgQ3AgQMAwsgAEEAOwEEQRRBBBD+AiIDRQ0DIABBADYCACADIAEpAgA3AgAgAEEYakHwv8AANgIAIABBFGogAzYCACADQRBqIAFBEGooAgA2AgAgA0EIaiABQQhqKQIANwIADAILIAJBGGogAUEQaigCADYCACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBADYCKCACQoCAgIAQNwMgIAJBMGoiASACQSBqQZzCwAAQuwIgAkEIaiABEHINAyAAQQhqIAIpAyA3AgAgAEEQaiACQShqKAIANgIAIABBFGpBADYCACAAQoKAgIAgNwMAIAItAAhBH0cNASACLQAMQQNHDQEgAkEQaigCACIAKAIAIAAoAgQoAgARAwAgACgCBCIBQQRqKAIABEAgAUEIaigCABogACgCABA6CyACKAIQEDoMAQsgAEEDNgIAIABCAzcDCAsgAkHgAGokAA8LQRRBBBC8AwALQbTCwABBNyACQdgAakHswsAAQcjDwAAQxgEAC8AEAQN/IwBBMGsiAiQAAn8CQAJAAkACQCAAKAIEIgMOAwACAwELIwBBEGsiACQAIABBiLzAADYCCCAAQQ42AgQgAEH6u8AANgIAIwBBEGsiASQAIAFBCGogAEEIaigCADYCACABIAApAgA3AwAjAEEQayIAJAAgACABKQIANwMIIABBCGpBpLzAAEEAIAEoAghBARCsAQALIAJBJGpBATYCACACQSxqQQA2AgAgAkHcusAANgIgIAJB+LfAADYCKCACQQA2AhhBASABIAJBGGoQ6AENAhogA0EDdCEDIAAoAgAhAAJAA0AgAiAANgIUIAQEQCACQQE2AiQgAkHousAANgIgIAJBADYCLCACQfi3wAA2AiggAkEANgIYIAEgAkEYahDoAQ0CCyACQQI2AiQgAkHwusAANgIgIAJBATYCLCACQQA2AhggAkHgADYCBCACIAI2AiggAiACQRRqNgIAIAEgAkEYahDoAQ0BIABBCGohACAEQQFrIQQgA0EIayIDDQALQQAMAwtBAQwCCyACQSRqQQI2AgAgAkEsakEBNgIAIAJB8LrAADYCICACQQA2AhggAkHhADYCBCACIAAoAgA2AgAgAiACNgIoIAEgAkEYahDoAQwBCyACQQxqQeEANgIAIAJBJGpBAzYCACACQSxqQQI2AgAgAkGIu8AANgIgIAJBADYCGCACQeEANgIEIAIgACgCACIANgIAIAIgAEEIajYCCCACIAI2AiggASACQRhqEOgBCyACQTBqJAAL1QMCB38BfCABQcQAaiABQYABaiABQZEBai0AAEECRiICGygCACEEIAFBQGsgAUH8AGogAhsoAgAhBQJ/IAEtAOwBRQRAIAQhAkEADAELAn8gBLhEAAAAAAAAwD+imyIJRAAAAAAAAPBBYyAJRAAAAAAAAAAAZiICcQRAIAmrDAELQQALQQAgAhshAiAJRAAA4P///+9BZCEGIAW4RAAAAAAAAMA/opsiCUQAAAAAAAAAAGYhB0F/IAIgBhshAkF/An8gCUQAAAAAAADwQWMgCUQAAAAAAAAAAGZxBEAgCasMAQtBAAtBACAHGyAJRAAA4P///+9BZBshB0EBCyEGIAEtAOkBQQRzQQdxQQJ0QfyEwQBqKAIAIAVsIQMCQAJAAkAgAS0A6AEiAUEIaw4JAgAAAAAAAAABAAsgAUEITQRAIANBCCABbiIBbiIIIAMgASAIbEdqIQMMAgtB4PHAAEEZQfzxwAAQhwIACyADQQF0IQMLIABBADoAKCAAIAY2AgwgACAENgIEIAAgBTYCACAAQSRqQQE6AAAgAEEgaiAENgIAIABBHGogBTYCACAAQRhqIAc2AgAgAEEUaiACNgIAIABBEGpBADYCACAAIANBAWo2AggLuQMBBH8gAEEANgIIIABBFGpBADYC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IANB4PDCADYCHCADIAQpAgA3AwggAyADQRdqNgIQIAQpAgghByAEKQIQIQggAyAELQAgOgA4IAMgBCgCHDYCNCADIAY2AjAgAyAINwMoIAMgBzcDICADIANBCGo2AhhBASABIANBGGogAigCDBEAAA0AGiADKAIYQf/wwgBBAiADKAIcKAIMEQIACzoACCAAIAVBAWo2AgAgA0FAayQAIAALowIBBH8gAEIANwIQIAACf0EAIAFBgAJJDQAaQR8gAUH///8HSw0AGiABQQYgAUEIdmciAmt2QQFxIAJBAXRrQT5qCyIDNgIcIANBAnRB0JPDAGohAgJAAkACQAJAQeyWwwAoAgAiBEEBIAN0IgVxBEAgAigCACECIAMQ7AIhAyACELgDIAFHDQEgAiEDDAILQeyWwwAgBCAFcjYCACACIAA2AgAMAwsgASADdCEEA0AgAiAEQR12QQRxakEQaiIFKAIAIgNFDQIgBEEBdCEEIAMiAhC4AyABRw0ACwsgAygCCCIBIAA2AgwgAyAANgIIIAAgAzYCDCAAIAE2AgggAEEANgIYDwsgBSAANgIACyAAIAI2AhggACAANgIIIAAgADYCDAu9AgEFfyMAQRBrIgMkABAQIQUgASgCACICIAUQESEBIANBCGoQugIgAygCDCABIAMoAggiBBshAQJAAkACQAJAIARFBEAgARALQQFGDQEgAEECOgAEIAFBhAFJDQIgARAADAILIABBAzoABCAAIAE2AgAMAQsgASACEBIhAiADELoCIAMoAgQgAiADKAIAIgQbIQICQAJAAkACQCAERQRAIAIQBUEBRw0DIAIQDCIEEAshBiAEQYQBSQ0BIAQQACAGQQFGDQIMAwsgAEEDOgAEIAAgAjYCAAwDCyAGQQFHDQELIABBADoABCAAIAI2AgAgAUGEAU8EQCABEAALIAVBgwFLDQMMBAsgAEECOgAEIAJBhAFJDQAgAhAACyABQYQBSQ0AIAEQAAsgBUGDAU0NAQsgBRAACyADQRBqJAALpQIBBX8jAEEwayICJAAgAAJ/AkAgAUEQaigCAARAIAJBGGogAUEIahCTAiACKAIYDQELIABBCGpBADYCAEEADAELIAJBEGogAigCHBD5ASACKAIUIQUgAigCECEDIAEgASgCFEEBajYCFCABQQRqIQQCQCABKAIARQ0AIAQoAgAiBkGEAUkNACAGEAALIAFBATYCACAEIAU2AgAgAiADIgE2AiQgAkEIaiABEAECQCACKAIIIgQEQCACKAIMIQMMAQsgAkEkaiACQShqQZCLwAAQXyEDQQAhBCACKAIkIQELIAFBhAFPBEAgARAACyAEBEAgACADNgIEIABBDGogAzYCACAAQQhqIAQ2AgBBAAwBCyAAIAM2AgRBAQs2AgAgAkEwaiQAC5UCAQF/IwBBEGsiAiQAIAAoAgAhAAJ/AkAgASgCCEEBRwRAIAEoAhBBAUcNAQsgAkEANgIMIAEgAkEMagJ/IABBgAFPBEAgAEGAEE8EQCAAQYCABE8EQCACIABBP3FBgAFyOgAPIAIgAEESdkHwAXI6AAwgAiAAQQZ2QT9xQYABcjoADiACIABBDHZBP3FBgAFyOgANQQQMAwsgAiAAQT9xQYABcjoADiACIABBDHZB4AFyOgAMIAIgAEEGdkE/cUGAAXI6AA1BAwwCCyACIABBP3FBgAFyOgANIAIgAEEGdkHAAXI6AAxBAgwBCyACIAA6AAxBAQsQQAwBCyABKAIAIAAgASgCBCgCEBEAAAsgAkEQaiQAC2ABDH9B2JTDACgCACICBEBB0JTDACEGA0AgAiIBKAIIIQIgASgCBCEDIAEoAgAhBCABQQxqKAIAGiABIQYgBUEBaiEFIAINAAsLQZCXwwBB/x8gBSAFQf8fTRs2AgAgCAvKAgEFfyMAQTBrIgIkAANAQYKAxAAhBkEwIQMCQAJAAkACQAJAAkACQAJAAkAgACAFai0AACIEDigIBgYGBgYGBgYAAgYGAQYGBgYGBgYGBgYGBgYGBgYGBgYGBAYGBgYDBQtB9AAhAwwHC0HyACEDDAYLQe4AIQMMBQtBJyEDDAQLQSIhAwwDCyAEQdwARg0BCyAEEG8EfyAEQQFyZ0ECdkEHcwVBgYDEACEGIAQQlwEEQCAEIQMMAwsgBEEBcmdBAnZBB3MLIQMgBCEGDAELQdwAIQMLIAJBBTYCKCACIAY2AiQgAiADNgIgIAJBzQE2AhwgAkEBNgIMIAJB+PnAADYCCCACQQE2AhQgAkEANgIAIAIgAkEgajYCGCACIAJBGGo2AhAgASACEOgBIgRFBEAgBUEDRyAFQQFqIQUNAQsLIAJBMGokACAEC58CAQN/AkAgAUFAaygCAEECRwRAAn8CQCABKAKgAyICBEAgAkEBcUUgAUH4AWotAAAiA0EQR3INASACQRBxIQJBCAwCCyABQfgBai0AACECIAEtAPkBIQEMAwtBCCADIANBB00bIAMgAkEQcSICGwsCQCACRQRAIAEtAPkBIQEMAQsgAS0A+QEiAkEddEEddUEASARAIAIhAQwBCyABKAIQIQMCQAJAAkACQCACQQFrDgMCAQMAC0EEIQEgA0ECRg0BDAMLQQYhASADQQJHDQILIAIhAQwBC0ECQQYgA0ECRhshAQsQ1QJB/wFxIgINAUHEmsAAQStB8JrAABCHAgALQcSawABBK0GkncAAEIcCAAsgACACOgABIAAgAToAAAv8AQIFfwF+IwBB0ABrIgEkACAAKAIIIQMgACgCDCEEIAAQyAMiAikCACEGIAJCADcCACABQcgAaiACQRBqIgUoAgA2AgAgAUFAayACQQhqIgIpAgA3AwAgBUEANgIAIAJCgICAgBA3AgAgASAGNwM4IAFBCGpBFEEBEIIDIAFBEGogAUE4aiADIAQgASgCCCABKAIMEJACIABBGGoiAigCAARAIABBHGooAgAQOgsgACABKQMQNwIAIABBIGogAUEwaigCADYCACACIAFBKGopAwA3AgAgAEEQaiABQSBqKQMANwIAIABBCGogAUEYaikDADcCACABQdAAaiQAC8QCAQR/IwBB4NEAayICJAACQAJAQejVAEEEEP4CIgEEQCABQgA3AohSIAFBkNIAakEANgIAIAIQjwMgAkGgG2oQjwMgAkHANmoQjwMgAUGA0gBqQgA3AgAgAUH40QBqQgA3AgAgAUHw0QBqQgA3AgAgAUHo0QBqQgA3AgAgAUIANwLgUSABQQA2ApRSIAFBnNIAakEAQcoDEMADGiABIAJB4NEAEMIDIgFBADYCmFJBgIACQQEQ/gIiA0UNAUGAgARBARD/AiIERQ0CIABBADoAJCAAIAE2AgggAEGAgAI2AgwgAEIANwIAIABBIGpBgIAENgIAIABBHGogBDYCACAAQRRqQoCAgICAgMAANwIAIABBEGogAzYCACACQeDRAGokAA8LQejVAEEEELwDAAtBgIACQQEQvAMAC0GAgARBARC8AwALggIBCH8gASgCBCIDQQhqIgIoAgAiBCEFIAMoAgAgBGtB/x9NBEAgAyAEQYAgEKMBIAIoAgAh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QQRqKAIANgIQDAELIAJBADYCGAsgAiAEIAUgAkEQahCyASACKAIEIQMgAigCAEUEQCAAIAE2AgAgAEEEaiADNgIADAILIAJBCGooAgAiAEGBgICAeEYNASAARQ0AIAMgABC8AwALEJYCAAsgAkEgaiQAC9gBAQV/IwBBIGsiAiQAAkACQCABQQFqIgFFDQBBBCAAKAIAIgRBAXQiAyABIAEgA0kbIgEgAUEETRsiAUEBdCEFIAFBgICAgARJQQF0IQYCQCAEBEAgAkECNgIYIAIgAzYCFCACIABBBGooAgA2AhAMAQsgAkEANgIYCyACIAUgBiACQRBqELIBIAIoAgQhAyACKAIARQRAIAAgATYCACAAQQRqIAM2AgAMAgsgAkEIaigCACIAQYGAgIB4Rg0BIABFDQAgAyAAELwDAAsQlgIACyACQSBqJAALzwEBAn8jAEEgayIDJAACQAJAIAEgASACaiIBSw0AQQggACgCACICQQF0IgQgASABIARJGyIBIAFBCE0bIgFBf3NBH3YhBAJAIAIEQCADQQE2AhggAyACNgIUIAMgAEEEaigCADYCEAwBCyADQQA2AhgLIAMgASAEIANBEGoQsgEgAygCBCECIAMoAgBFBEAgACABNgIAIABBBGogAjYCAAwCCyADQQhqKAIAIgBBgYCAgHhGDQEgAEUNACACIAAQvAMACxCWAgALIANBIGokAAvPAQECfyMAQSBrIgMkAAJAAkAgASABIAJqIgFLDQBBCCAAKAIAIgJBAXQiBCABIAEgBEkbIgEgAUEITRsiAUF/c0EfdiEEAkAgAgRAIANBATYCGCADIAI2AhQgAyAAQQRqKAIANgIQDAELIANBADYCGAsgAyABIAQgA0EQahCuASADKAIEIQIgAygCAEUEQCAAIAE2AgAgAEEEaiACNgIADAILIANBCGooAgAiAEGBgICAeEYNASAARQ0AIAIgABC8AwALEJYCAAsgA0EgaiQAC80BAQN/IwBBIGsiAiQAAkACQCABQQFqIgFFDQBBCCAAKAIAIgNBAXQiBCABIAEgBEkbIgEgAUEITRsiAUF/c0EfdiEEAkAgAwRAIAJBATYCGCACIAM2AhQgAiAAQQRqKAIANgIQDAELIAJBADYCGAsgAiABIAQgAkEQahCyASACKAIEIQMgAigCAEUEQCAAIAE2AgAg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jPfAAEEIIAJBCGpBlPfAAEGk98AAQQYgAkEMakGU98AAELEBDAELIAFB6PbAAEEVEPgCCyACQRBqJAALPgAgACgCEARAIABBFGooAgAQOgsgAEEcaigCAARAIABBIGooAgAQOgsgAEEoaigCAARAIABBLGooAgAQOgsLWAECfyMAQSBrIgIkACABKAIEIQMgASgCACACQRhqIAAoAgAiAEEQaikCADcDACACQRBqIABBCGopAgA3AwAgAiAAKQIANwMIIAMgAkEIahBOIAJBIGokAAtiAQF/IwBBIGsiBSQAIAUgAjYCBCAFIAE2AgAgBUEYaiADQRBqKQIANwMAIAVBEGogA0EIaikCADcDACAFIAMpAgA3AwggACAFQZiEwAAgBUEEakGYhMAAIAVBCGogBBBnAAtdAQJ/IwBBIGsiAiQAIAJBCGoiAyABQdCMwABBABCzAiACIAA2AhggAiAAQQRqNgIcIAMgAkEYakHUjcAAEIQBGiADIAJBHGpB1I3AABCEARogAxDCASACQSBqJAALZwEBfyMAQRBrIgIkAAJ/IAAoAgAiACkDAFAEQCACIABBCGo2AgggAUHgssAAQQIgAkEIakHkssAAEK8BDAELIAIgAEEIajYCDCABQcyywABBAyACQQxqQdCywAAQrwELIAJBEGokAAuUAgECfyMAQRBrIgIkACACIAAoAgAiADYCBCACIABBBGo2AgggAiAAQQhqNgIMIwBBEGsiACQAIAEoAgBB3/PAAEEPIAEoAgQoAgwRAgAhAyAAQQA6AA0gACADOgAMIAAgATYCCCAAQQhqQe7zwABBBCACQQRqQfTzwAAQc0GE9MAAQQQgAkEIakH088AAEHNBiPTAAEEEIAJBDGpBjPTAABBzIQECfyAALQAMIgMgAC0ADUUNABpBASADDQAaIAEoAgAiAS0AGEEEcUUEQCABKAIAQYfxwgBBAiABKAIEKAIMEQIADAELIAEoAgBBhvHCAEEBIAEoAgQoAgwRAgALIABBEGokAEH/AXFBAEcgAkEQaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBuIzAACACQQhqEE4gAkEgaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBxLXAACACQQhqEE4gAkEgaiQAC2oBAX4gASkCACECAkAgAS0AAEEERgRAIABBgAQ7AQRBCEEEEP4CIgFFDQEgASACNwIAIABBGGpB6MDAADYCACAAQRRqIAE2AgAgAEEBNgIADwsgACACNwIEIABBBTYCAA8LQQhBBBC8AwALWQEBfyMAQSBrIgIkACACIAAoAgA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakGQ08AAIAJBCGoQTiACQSBqJAALWQEBfyMAQSBrIgIkACACIAAoAgA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakH4u8IAIAJBCGoQTiACQSBqJAALWQEBfyMAQSBrIgIkACACIAAoAgA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakGsvMIAIAJBCGoQTiACQSBqJAALWQEBfyMAQSBrIgIkACACIAAoAgA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakHc0sIAIAJBCGoQTiACQSBqJAALUwECfyMAQSBrIgIkACABKAIEIQMgASgCACACQRhqIABBEGopAgA3AwAgAkEQaiAAQQhqKQIANwMAIAIgACkCADcDCCADIAJBCGoQTiACQSBqJAALWQEBfyMAQSBrIgIkACACIAAoAgA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakGY88IAIAJBCGoQTiACQSBqJAALUwECfyMAQSBrIgIkACAAKAIEIQMgACgCACACQRhqIAFBEGopAgA3AwAgAkEQaiABQQhqKQIANwMAIAIgASkCADcDCCADIAJBCGoQTiACQSBqJAALVgEBfyMAQSBrIgIkACACIAA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakG4jMAAIAJBCGoQTiACQSBqJAALVgEBfyMAQSBrIgIkACACIAA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakHEtcAAIAJBCGoQTiACQSBqJAALVgEBfyMAQSBrIgIkACACIAA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakGQ08AAIAJBCGoQTiACQSBqJAALVgEBfyMAQSBrIgIkACACIAA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakH4u8IAIAJBCGoQTiACQSBqJAALVgEBfyMAQSBrIgIkACACIAA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakGY88IAIAJBCGoQTiACQSBqJAALTQACf0EAIABBA0kNABpBASAAQQRNDQAaQQIgAEEJSQ0AGkEDIABBEUkNABpBBCAAQSFJDQAaQQUgAEHBAEkNABpBBkEHIABBgQFJGwsLOwAgACgCIARAIABBJGooAgAQOgsgAEEsaigCAARAIABBMGooAgAQOgsgAEEUaigCAARAIAAoAhAQOgsLawEBfQJAIAEqAgggApIiAkMAAAAAXUUEQEMAALRDIQMgAkMAALRDXkUNAQsgAyECCyAAIAEpAgw3AgwgACABKgIEOAIEIAAgASgCADYCACAAQwAAAAAgAiACQwAAtMOSi0MAAAA0XRs4AggLWgECfwJAIAAtAABBH0cNACAALQAEQQNHDQAgAEEIaigCACIBKAIAIAEoAgQoAgARAwAgASgCBCICQQRqKAIABEAgAkEIaigCABogASgCABA6CyAAKAIIEDoLC2IBAX8jAEEQayICJAACfyAAKAIARQRAIAIgAEEEajYCCCABQaidwgBBBiACQQhqQbCdwgAQrwEMAQsgAiAAQQRqNgIMIAFBlJ3CAEECIAJBDGpBmJ3CABCvAQsgAkEQaiQAC2EBAX8jAEEQayICJAACfyAALQAAQQRGBEAgAiAAQQFqNgIIIAFBmKvCAEEGIAJBCGpBoKvCABCvAQwBCyACIAA2AgwgAUGEq8IAQQIgAkEMakGIq8IAEK8BCyACQRBqJAALTQECfwJAIAAoAgAiAUECRg0AAkAgAEEUaigCACICRQ0AIAAoAhBFDQAgAhA6IAAoAgAhAQsgAUUNACAAKAIERQ0AIABBCGooAgAQOgsLWAECfyMAQRBrIgIkACABLQAAQQNHBH9BAAUgAkEIaiABKAIEIgEoAgAgASgCBCgCJBEBACACKAIMIQMgAigCCAshASAAIAM2AgQgACABNgIAIAJBEGokAAtYAQJ/IwBBEGsiAiQAIAEtAABBA0cEf0EABSACQQhqIAEoAgQiASgCACABKAIEKAIYEQEAIAIoAgwhAyACKAIICyEBIAAgAzYCBCAAIAE2AgAgAkEQaiQAC0oBAX8jAEEgayIAJAAgAEEUakEBNgIAIABBHGpBADYCACAAQfTRwgA2AhAgAEHY0cIANgIYIABBADYCCCAAQQhqQczSwgAQogIAC3oBAn9B3PPAACECQQMhAwJAAkACQAJAAkACQCAAKAIALQAAQQJrDg8BAAIAAAADAAAAAAAAAAQFCwALIAFB2fPAAEEDEPgCDwsgAUHV88AAQQQQ+AIPCyABQdDzwABBBRD4Ag8LQcnzwAAhAkEHIQMLIAEgAiADEPgCC1IBA38jAEEQayICJAAgAiABNgIMIAJBDGoiA0EAEKQDIQEgA0EBEKQDIQMgAigCDCIEQYQBTwRAIAQQAAsgACADNgIEIAAgATYCACACQRBqJAALVgECfyABKAIAIQIgAUEANgIAAkAgAgRAIAEoAgQhA0EIQQQQ/gIiAUUNASABIAM2AgQgASACNgIAIABBuLzAADYCBCAAIAE2AgAPCwALQQhBBBC8AwALUwEBfyMAQRBrIgIkAAJ/IAAoAgAiACkDAFAEQCABQeTTwABBBBD4AgwBCyACIABBCGo2AgwgAUHQ08AAQQQgAkEMakHU08AAEK8BCyACQRBqJAALVgECfyABKAIAIQIgAUEANgIAAkAgAgRAIAEoAgQhA0EIQQQQ/gIiAUUNASABIAM2AgQgASACNgIAIABBnIvBADYCBCAAIAE2AgAPCwALQQhBBBC8AwALVgECfyABKAIAIQIgAUEANgIAAkAgAgRAIAEoAgQhA0EIQQQQ/gIiAUUNASABIAM2AgQgASACNgIAIABB+J7CADYCBCAAIAE2AgAPCwALQQhBBBC8AwALVQEBfyAAQSBqIAAtAEYQZiAAQQA6AEcgAEEAOwE4IABBGGpCADcDACAAQQA6AAsgAEIANwMAIAAgAC0ARkEBaiIBOgAKIABBfyABQQ9xdEF/czsBCAtLAQJ/IAAtAABBA0YEQCAAKAIEIgEoAgAgASgCBCgCABEDACABKAIEIgJBBGooAgAEQCACQQhqKAIAGiABKAIAEDoLIAAoAgQQOgsLWAEBfyMAQRBrIgIkACACIAAoAgAiADYCCCACIABBEGo2AgwgAUGszcAAQQ5BtMzAAEEEIAJBCGpBvM3AAEGRzcAAQQogAkEMakGczcAAELEBIAJBEGokAAtYAQF/IwBBEGsiAiQAIAIgACgCACIANgIIIAIgAEEQajYCDCABQfvNwABBDUGczMAAQQYgAkEIakGkzMAAQZHNwABBCiACQQxqQZzNwAAQsQEgAkEQaiQAC1gBAX8jAEEQayICJAAgAiAAKAIAIgA2AgggAiAAQRBqNgIMIAFBhM3AAEENQZzMwABBBiACQQhqQaTMwABBkc3AAEEKIAJBDGpBnM3AABCxASACQRBqJAALWAEBfyMAQRBrIgIkACACIAAoAgAiAEEQajYCCCACIAA2AgwgAUGMzMAAQRBBnMzAAEEGIAJBCGpBpMzAAEG0zMAAQQQgAkEMakG4zMAAELEBIAJBEGokAAtTAQF/IwBBEGsiAiQAAn8gACgCACIAKAIARQRAIAFB5NPAAEEEEPgCDAELIAIgAEEEajYCDCABQdDTwABBBCACQQxqQejTwAAQrwELIAJBEGokAAtYAQF/IwBBEGsiAiQAIAIgACgCACIANgIIIAIgAEEEajYCDCABQaD2wABBEEGw9sAAQQogAkEIakH088AAQbr2wABBCSACQQxqQfTzwAAQsQEgAkEQaiQAC1IBAX8jAEEgayICJAAgAkEMakEBNgIAIAJBFGpBATYCACACQeCdwAA2AgggAkEANgIAIAJBJTYCHCACIAA2AhggAiACQRhqNgIQIAIgARCiAgALUgEBfyMAQSBrIgMkACADQQxqQQE2AgAgA0EUakEANgIAIANB3NXCADYCECADQQA2AgAgAyABNgIcIAMgADYCGCADIANBGGo2AgggAyACEKICAAtQAQF/IwBBEGsiAiQAAn8gACgCACIAKAIARQRAIAFB5NPAAEEEEPgCDAELIAIgADYCDCABQdDTwABBBCACQQxqQfjTwAAQrwELIAJBEGokAAtIAQF/IAIgACgCACIAKAIAIAAoAggiA2tLBEAgACADIAIQowEgACgCCCEDCyAAKAIEIANqIAEgAhDCAxogACACIANqNgIIQQALSAEBfyACIAAoAgAiACgCACAAKAIIIgNrSwRAIAAgAyACEKQBIAAoAgghAwsgACgCBCADaiABIAIQwgMaIAAgAiADajYCCEEACzwBAn8jAEEQayICJAAgAkEIaiAAKAIAEAggAigCCCIAIAIoAgwiAyABEL0DIAMEQCAAEDoLIAJBEGokAAs/AQF+IAAgAcBBA3RBsPfAAGopAwAgA60gAq1C/wGDfn4iBELx/////wBUNgIAIAAgBEIHfEIDiKdBAWo2AgQLSAEBfyACIAAoAgAiACgCACAAKAIIIgNrSwRAIAAgAyACEKcBIAAoAgghAwsgACgCBCADaiABIAIQwgMaIAAgAiADajYCCEEAC0gBAX8gAiAAKAIAIgAoAgAgACgCCCIDa0sEQCAAIAMgAhCoASAAKAIIIQMLIAAoAgQgA2ogASACEMIDGiAAIAIgA2o2AghBAAtFAQF9IAACfyABKgIAEO4CIgJDAACAT10gAkMAAAAAYHEEQCACqQwBC0EACzoAASAAIAJDAACAQ10gAkMAAIC/XnE6AAALSAAgACADNgIMIAAgAjYCCCAAIAU2AgQgACAENgIAIAAgASkCADcCECAAQSBqIAFBEGooAgA2AgAgAEEYaiABQQhqKQIANwIAC0MBAX8gAiAAKAIAIAAoAggiA2tLBEAgACADIAIQowEgACgCCCEDCyAAKAIEIANqIAEgAhDCAxogACACIANqNgIIQQALQwEBfyACIAAoAgAgACgCCCIDa0sEQCAAIAMgAhCkASAAKAIIIQMLIAAoAgQgA2ogASACEMIDGiAAIAIgA2o2AghBAAtBAQF/IAEoAgAiAiABKAIETwR/QQAFIAEgAkEBajYCACABKAIIKAIAIAIQCSEBQQELIQIgACABNgIEIAAgAjYCAAs+AQJ/IAAgAC0ARiIBQQFqIgI6AAogAEEBIAFBD3F0QQJqOwFAIABBfyACQQ9xdEF/czsBCCAAQSBqIAEQZgv0BAEGfyMAQRBrIgMkAEH5ksMALQAAQQNHBEAgA0EBOgALIAMgA0ELajYCDCADQQxqIQAjAEEgayIBJAACQAJAAkACQAJAAkACQEH5ksMALQAAQQFrDgMCBAEAC0H5ksMAQQI6AAAgAUH5ksMANgIIIAAoAgAiAC0AACAAQQA6AABBAXFFDQIjAEEgayIAJAACQAJAAkBBsJPDACgCAEH/////B3EEQBDMA0UNAQtBoJPDACgCAEGgk8MAQX82AgANAQJAAkBBsJPDACgCAEH/////B3FFBEBBrJPDACgCACECQayTwwBB9IHAADYCAEGok8MAKAIAIQRBqJPDAEEBNgIADAELEMwDQayTwwAoAgAhAkGsk8MAQfSBwAA2AgBBqJPDACgCACEEQaiTwwBBATYCAEUNAQtBsJPDACgCAEH/////B3FFDQAQzAMNAEGkk8MAQQE6AAALQaCTwwBBADYCAAJAIARFDQAgBCACKAIAEQMAIAJBBGooAgBFDQAgAkEIaigCABogBBA6CyAAQSBqJAAMAgsgAEEUakEBNgIAIABBHGpBADYCACAAQYTFwgA2AhAgAEHEvMIANgIYIABBADYCCCAAQQhqQajFwgAQogIACwALIAFBAzoADCABQQhqIgAoAgAgAC0ABDoAAAsgAUEgaiQADAQLIAFBFGpBATYCACABQRxqQQA2AgAgAUH4gsAANgIQDAILQYCDwABBK0H4g8AAEIcCAAsgAUEUakEBNgIAIAFBHGpBADYCACABQcSCwAA2AhALIAFBzILAADYCGCABQQA2AgggAUEIakHopMAAEKICAAsLIANBEGokAAtKAQF/IwBBIGsiACQAIABBFGpBATYCACAAQRxqQQA2AgAgAEGk08IANgIQIABB9NLCADYCGCAAQQA2AgggAEEIakGs08IAEKICAAs8ACAAIAEpAwA3AwAgAEEYaiABQRhqKQMANwMAIABBEGogAUEQaikDADcDACAAQQhqIAFBCGopAwA3AwALRgECfyABKAIEIQIgASgCACEDQQhBBBD+AiIBRQRAQQhBBBC8AwALIAEgAjYCBCABIAM2AgAgAEHoxcIANgIEIAAgATYCAAuZdwMWfiJ/AXwgASgCGEEBcSEYIAArAwAhOgJAAkACQCABKAIQQQFGBEACfyABISQgAUEUaigCACEnIwBB8AhrIh8kACA6vSEDAkAgOiA6YgRAQQIhAQwBCyADQv////////8HgyIGQoCAgICAgIAIhCADQgGGQv7///////8PgyADQjSIp0H/D3EiABsiBEIBgyEFQQMhAQJAAkACQEEBQQJBBCADQoCAgICAgID4/wCDIgdQIhkbIAdCgICAgICAgPj/AFEbQQNBBCAZGyAGUBtBAmsOAwABAgMLQQQhAQwCCyAAQbMIayEcIAVQIQFCASECDAELQoCAgICAgIAgIARCAYYgBEKAgICAgICACFEiGRshBEICQgEgGRshAiAFUCEBQct3Qcx3IBkbIABqIRwLIB8gHDsB6AggHyACNwPgCCAfQgE3A9gIIB8gBDcD0AggHyABOgDqCAJ/QdzVwgAgAUECRg0AGiAYRQRAIANCP4inISxBy+3CAEHc1cIAIANCAFMbDAELQQEhLEHL7cIAQcztwgAgA0IAUxsLITJBASEAAkACQAJ/AkACQAJAAkBBAyABQQJrIAFBAU0bQf8BcUEBaw4DAgEAAwtBdEEFIBzBIgBBAEgbIABsIgBBv/0ASw0EIB9BkAhqISAgH0EQaiEiIABBBHZBFWoiGiEcQYCAfkEAICdrICdBgIACTxshGwJAAkACQAJAAkACQAJAIB9B0AhqIgApAwAiAlBFBEAgAkL//////////x9WDQEgHEUNA0GgfyAALwEYIgBBIGsgACACQoCAgIAQVCIAGyIBQRBrIAEgAkIghiACIAAbIgJCgICAgICAwABUIgAbIgFBCGsgASACQhCGIAIgABsiAkKAgICAgICAgAFUIgAbIgFBBGsgASACQgiGIAIgABsiAkKAgICAgICAgBBUIgAbIgFBAmsgASACQgSGIAIgABsiAkKAgICAgICAgMAAVCIAGyACQgKGIAIgABsiAkI/h6dBf3NqIgFrwUHQAGxBsKcFakHOEG0iAEHRAE8NAiAAQQR0IgBB2t3CAGovAQAhHgJ/AkACQCAAQdDdwgBqKQMAIgNC/////w+DIgQgAiACQn+FQj+IhiICQiCIIgV+IgZCIIggA0IgiCIDIAV+fCADIAJC/////w+DIgJ+IgNCIIh8IAZC/////w+DIAIgBH5CIIh8IANC/////w+DfEKAgICACHxCIIh8IgJBQCABIABB2N3CAGovAQBqayIBQT9xrSIDiKciAEGQzgBPBEAgAEHAhD1JDQEgAEGAwtcvSQ0CQQhBCSAAQYCU69wDSSIZGyEYQYDC1y9BgJTr3AMgGRsMAwsgAEHkAE8EQEECQQMgAEHoB0kiGRshGEHkAEHoByAZGwwDCyAAQQlLIRhBAUEKIABBCkkbDAILQQRBBSAAQaCNBkkiGRshGEGQzgBBoI0GIBkbDAELQQZBByAAQYCt4gRJIhkbIRhBwIQ9QYCt4gQgGRsLIRlCASADhiEEAkAgGCAea0EQdEGAgARqQRB1Ih4gG8EiI0oEQCACIARCAX0iBoMhBSABQf//A3EhISAeIBtrwSAcIB4gI2sgHEkbIiNBAWshJUEAIQEDQCAAIBluIR0gASAcRg0HIAAgGSAdbGshACABICJqIB1BMGo6AAAgASAlRg0IIAEgGEYNAiABQQFqIQEgGUEKSSAZQQpuIRlFDQALQdDpwgBBGUHM68IAEIcCAAsgICAiIBxBACAeIBsgAkIKgCAZrSADhiAEEGkMCAsgAUEBaiIBIBwgASAcSxshACAhQQFrQT9xrSEHQgEhAgNAIAIgB4hQRQRAICBBADYCAAwJCyAAIAFGDQcgASAiaiAFQgp+IgUgA4inQTBqOgAAIAJCCn4hAiAFIAaDIQUgIyABQQFqIgFHDQALICAgIiAcICMgHiAbIAUgBCACEGkMBwtBk9nCAEEcQfjqwgAQhwIAC0GI68IAQSRBrOvCABCHAgALIABB0QBBkOjCABDNAQALQazqwgBBIUG868IAEIcCAAsgHCAcQdzrwgAQzQEACyAgICIgHCAjIB4gGyAArSADhiAFfCAZrSADhiAEEGkMAQsgACAcQezrwgAQzQEACyAbwSEtAkAgHygCkAhFBEAgH0HACGohLiAfQRBqIR5BACEhIwBB0AZrIh0kAAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgH0HQCGoiACkDACICUEUEQCAAKQMIIgNQDQEgACkDECIEUA0CIAIgBHwgAlQNAyACIANUDQQgAC8BGCEAIB0gAj4CCCAdQQFBAiACQoCAgIAQVCIBGzYCqAEgHUEAIAJCIIinIAEbNgIMIB1BEGpBAEGYARDAAxogHUGwAWpBBHJBAEGcARDAAxogHUEBNgKwASAdQQE2AtACIACtwyACQgF9eX1CwprB6AR+QoChzaC0AnxCIIinIgHBISUCQCAAwSIYQQBOBEAgHUEIaiAAEDsaDAELIB1BsAFqQQAgGGvBEDsaCwJAICVBAEgEQCAdQQhqQQAgJWvBEEQMAQsgHUGwAWogAUH//wNxEEQLIB0oAtACIRwgHUGoBWogHUGwAWpBoAEQwgMaIB0gHDYCyAYCQCAaIiJBCkkNAAJAIBxBKEsEQCAcIQEMAQsgHUGgBWohGCAcIQEDQAJAIAFFDQAgAUEBa0H/////A3EiGUEBaiIbQQFxIAFBAnQhAAJ/IBlFBEBCACECIB1BqAVqIABqDAELIBtB/v///wdxIRsgACAYaiEBQgAhAgNAIAFBBGoiACAANQIAIAJCIIaEIgJCgJTr3AOAIgM+AgAgASABNQIAIAIgA0KAlOvcA359QiCGhCICQoCU69wDgCIDPgIAIAIgA0KAlOvcA359IQIgAUEIayEBIBtBAmsiGw0ACyABQQhqCyEARQ0AIABBBGsiACAANQIAIAJCIIaEQoCU69wDgD4CAAsgIkEJayIiQQlNDQIgHSgCyAYiAUEpSQ0ACwsMDgsCfwJ/AkAgIkECdEHk1sIAaigCACIBBEAgHSgCyAYiAEEpTw0aQQAgAEUNAxogAEEBa0H/////A3EiGEEBaiIZQQFxISIgAEECdCEAIAGtIQMgGA0BQgAhAiAdQagFaiAAagwCC0GPiMMAQRtByIfDABCHAgALIBlB/v///wdxIRsgACAdakGgBWohAUIAIQIDQCABQQRqIgAgADUCACACQiCGhCICIAOAIgQ+AgAgASABNQIAIAIgAyAEfn1CIIaEIgIgA4AiBD4CACACIAMgBH59IQIgAUEIayEBIBtBAmsiGw0ACyABQQhqCyEAICIEQCAAQQRrIgAgADUCACACQiCGhCADgD4CAAsgHSgCyAYLIgAgHSgCqAEiGCAAIBhLGyIAQShLDRYgAEUEQEEAIQAMBwsgAEEBcSEgIABBAUYEQEEAISIMBgsgAEF+cSEjQQAhIiAdQagFaiEBIB1BCGohGwNAIAEgASgCACImIBsoAgBqIhkgIkEBcWoiLzYCACABQQRqIiIgIigCACIwIBtBBGooAgBqIiIgGSAmSSAZIC9LcmoiGTYCACAZICJJICIgMElyISIgG0EIaiEbIAFBCGohASAjICFBAmoiIUcNAAsMBQtBk9nCAEEcQazcwgAQhwIAC0HA2cIAQR1BvNzCABCHAgALQfDZwgBBHEHM3MIAEIcCAAtBnNrCAEE2QdzcwgAQhwIAC0Hk2sIAQTdB7NzCABCHAgALICAEfyAhQQJ0IgEgHUGoBWpqIhkgGSgCACIZIB1BCGogAWooAgBqIgEgImoiGzYCACABIBlJIAEgG0tyBSAiC0EBcUUNACAAQSdLDQEgHUGoBWogAEECdGpBATYCACAAQQFqIQALIB0gADYCyAYgACAcIAAgHEsbIgFBKU8NBiABQQJ0IQECQANAIAEEQEF/IAFBBGsiASAdQbABamooAgAiACABIB1BqAVqaigCACIZRyAAIBlLGyIbRQ0BDAILC0F/QQAgARshGwsgG0EBTQRAICVBAWohJQwECyAYQSlPDRIgGEUEQEEAIRgMAwsgGEEBa0H/////A3EiAEEBaiIBQQNxIRsgAEEDSQRAIB1BCGohAUIAIQIMAgsgAUH8////B3EhGSAdQQhqIQFCACECA0AgASABNQIAQgp+IAJ8IgI+AgAgAUEEaiIAIAA1AgBCCn4gAkIgiHwiAj4CACABQQhqIgAgADUCAEIKfiACQiCIfCICPgIAIAFBDGoiACAANQIAQgp+IAJCIIh8IgI+AgAgAkIgiCECIAFBEGohASAZQQRrIhkNAAsMAQsgAEEoQciHwwAQzQEACyAbBEADQCABIAE1AgBCCn4gAnwiAj4CACABQQRqIQEgAkIgiCECIBtBAWsiGw0ACwsgAqciAEUNACAYQSdLDREgHUEIaiAYQQJ0aiAANgIAIBhBAWohGAsgHSAYNgKoAQtBACEAAkAgJcEiASAtwSIYTgRAICUgLWvBIBogASAYayAaSRsiIg0BC0EAISIMAQsgHUHYAmoiASAdQbABaiIAQaABEMIDGiAdIBw2AvgDIAFBARA7ITMgHSgC0AIhASAdQYAEaiIYIABBoAEQwgMaIB0gATYCoAUgGEECEDshNCAdKALQAiEBIB1BqAVqIhggAEGgARDCAxogHSABNgLIBiAdQawBaiE1IB1B1AJqITYgHUH8A2ohNyAdQaQFaiE4IBhBAxA7ITkgHSgCqAEhACAdKALQAiEcIB0oAvgDIS8gHSgCoAUhMCAdKALIBiEoQQAhIwJAA0AgIyEgAkACQAJAAkACQCAAQSlJBEAgIEEBaiEjIABBAnQhGEEAIQECQAJAAkADQCABIBhGDQEgHUEIaiABaiABQQRqIQEoAgBFDQALIAAgKCAAIChLGyIYQSlPDRkgGEECdCEBAkADQCABBEBBfyABIDhqKAIAIhkgAUEEayIBIB1BCGpqKAIAIhtHIBkgG0sbIhtFDQEMAgsLQX9BACABGyEbC0EAISYgG0ECSQRAIBgEQEEBISFBACEAIBhBAUcEQCAYQX5xISYgHUEIaiEBIB1BqAVqIRsDQCABIAEoAgAiKSAbKAIAQX9zaiIZICFBAXFqIio2AgAgAUEEaiIhICEoAgAiKyAbQQRqKAIAQX9zaiIhIBkgKUkgGSAqS3JqIhk2AgAgISArSSAZICFJciEhIBtBCGohGyABQQhqIQEgJiAAQQJqIgBHDQALCyAYQQFxBH8gAEECdCIAIB1BCGpqIgEgASgCACIBIAAgOWooAgBBf3NqIgAgIWoiGTYCACAAIAFJIAAgGUtyBSAhC0EBcUUNEAsgHSAYNgKoAUEIISYgGCEACyAAIDAgACAwSxsiGUEpTw0GIBlBAnQhAQNAIAFFDQJBfyABIDdqKAIAIhggAUEEayIBIB1BCGpqKAIAIhtHIBggG0sbIhtFDQALDAILICAgIksNAyAaICJJDQQgICAiRg0LIB4gIGpBMCAiICBrEMADGgwLC0F/QQAgARshGwsCQCAbQQFLBEAgACEZDAELIBkEQEEBISFBACEAIBlBAUcEQCAZQX5xISkgHUEIaiEBIB1BgARqIRsDQCABIAEoAgAiKiAbKAIAQX9zaiIYICFBAXFqIis2AgAgAUEEaiIhICEoAgAiMSAbQQRqKAIAQX9zaiIhIBggKkkgGCArS3JqIhg2AgAgISAxSSAYICFJciEhIBtBCGohGyABQQhqIQEgKSAAQQJqIgBHDQALCyAZQQFxBH8gAEECdCIAIB1BCGpqIgEgASgCACIBIAAgNGooAgBBf3NqIgAgIWoiGDYCACAAIAFJIAAgGEtyBSAhC0EBcUUNDQsgHSAZNgKoASAmQQRyISYLIBkgLyAZIC9LGyIYQSlPDRYgGEECdCEBAkADQCABBEBBfyABIDZqKAIAIgAgAUEEayIBIB1BCGpqKAIAIhtHIAAgG0sbIhtFDQEMAgsLQX9BACABGyEbCwJAIBtBAUsEQCAZIRgMAQsgGARAQQEhIUEAIQAgGEEBRwRAIBhBfnEhKSAdQQhqIQEgHUHYAmohGwNAIAEgASgCACIqIBsoAgBBf3NqIhkgIUEBcWoiKzYCACABQQRqIiEgISgCACIxIBtBBGooAgBBf3NqIiEgGSAqSSAZICtLcmoiGTYCACAhIDFJIBkgIUlyISEgG0EIaiEbIAFBCGohASApIABBAmoiAEcNAAsLIBhBAXEEfyAAQQJ0IgAgHUEIamoiASABKAIAIgEgACAzaigCAEF/c2oiACAhaiIZNgIAIAAgAUkgACAZS3IFICELQQFxRQ0NCyAdIBg2AqgBICZBAmohJgsgGCAcIBggHEsbIgBBKU8NEyAAQQJ0IQECQANAIAEEQEF/IAEgNWooAgAiGSABQQRrIgEgHUEIamooAgAiG0cgGSAbSxsiG0UNAQwCCwtBf0EAIAEbIRsLAkAgG0EBSwRAIBghAAwBCyAABEBBASEhQQAhGCAAQQFHBEAgAEF+cSEpIB1BCGohASAdQbABaiEbA0AgASABKAIAIiogGygCAEF/c2oiGSAhQQFxaiIrNgIAIAFBBGoiISAhKAIAIjEgG0EEaigCAEF/c2oiISAZICpJIBkgK0tyaiIZNgIAIBkgIUkgISAxSXIhISAbQQhqIRsgAUEIaiEBICkgGEECaiIYRw0ACwsgAEEBcQR/IBhBAnQiASAdQQhqaiIYIBgoAgAiGCAdQbABaiABaigCAEF/c2oiASAhaiIZNgIAIAEgGEkgASAZS3IFICELQQFxRQ0NCyAdIAA2AqgBICZBAWohJgsgGiAgRwRAIB4gIGogJkEwajoAACAAQSlPDRQgAEUEQEEAIQAMBwsgAEEBa0H/////A3EiAUEBaiIYQQNxIRsgAUEDSQRAIB1BCGohAUIAIQIMBgsgGEH8////B3EhGSAdQQhqIQFCACECA0AgASABNQIAQgp+IAJ8IgI+AgAgAUEEaiIYIBg1AgBCCn4gAkIgiHwiAj4CACABQQhqIhggGDUCAEIKfiACQiCIfCICPgIAIAFBDGoiGCAYNQIAQgp+IAJCIIh8IgI+AgAgAkIgiCECIAFBEGohASAZQQRrIhkNAAsMBQsgGiAaQYzdwgAQzQEACwwSCyAgICJB/NzCABCYAwALICIgGkH83MIAEJcDAAsgGUEoQciHwwAQlwMACyAbBEADQCABIAE1AgBCCn4gAnwiAj4CACABQQRqIQEgAkIgiCECIBtBAWsiGw0ACwsgAqciAUUNACAAQSdLDQIgHUEIaiAAQQJ0aiABNgIAIABBAWohAAsgHSAANgKoASAiICNHDQALQQEhAAwBCyAAQShByIfDABDNAQALAkACQAJAAkACQAJAIBxBKUkEQCAcRQRAQQAhHAwDCyAcQQFrQf////8DcSIBQQFqIhhBA3EhGyABQQNJBEAgHUGwAWohAUIAIQIMAgsgGEH8////B3EhGSAdQbABaiEBQgAhAgNAIAEgATUCAEIFfiACfCICPgIAIAFBBGoiGCAYNQIAQgV+IAJCIIh8IgI+AgAgAUEIaiIYIBg1AgBCBX4gAkIgiHwiAj4CACABQQxqIhggGDUCAEIFfiACQiCIfCICPgIAIAJCIIghAiABQRBqIQEgGUEEayIZDQALDAELDBULIBsEQANAIAEgATUCAEIFfiACfCICPgIAIAFBBGohASACQiCIIQIgG0EBayIbDQALCyACpyIBRQ0AIBxBJ0sNASAdQbABaiAcQQJ0aiABNgIAIBxBAWohHAsgHSAcNgLQAiAdKAKoASIBIBwgASAcSxsiAUEpTw0FIAFBAnQhAQJAA0AgAQRAQX8gAUEEayIBIB1BsAFqaigCACIYIAEgHUEIamooAgAiGUcgGCAZSxsiG0UNAQwCCwtBf0EAIAEbIRsLAkACQCAbQf8BcQ4CAAEFCyAARQ0EICJBAWsiACAaTw0CIAAgHmotAABBAXFFDQQLIBogIkkNAkEAIQEgHiEbAkADQCABICJGDQEgAUEBaiEBIBtBAWsiGyAiaiIALQAAQTlGDQALIAAgAC0AAEEBajoAACAiICIgAWtBAWpNDQQgAEEBakEwIAFBAWsQwAMaDAQLAn9BMSAiRQ0AGiAeQTE6AABBMCAiQQFGDQAaIB5BAWpBMCAiQQFrEMADGkEwCyEAICVBEHRBgIAEakEQdSIlIC3BTCAaICJNcg0DIB4gImogADoAACAiQQFqISIMAwsgHEEoQciHwwAQzQEACyAAIBpBnN3CABDNAQALICIgGkGs3cIAEJcDAAsgGiAiTw0AICIgGkG83cIAEJcDAAsgLiAlOwEIIC4gIjYCBCAuIB42AgAgHUHQBmokAAwDCyABQShByIfDABCXAwALQdiHwwBBGkHIh8MAEIcCAAsgH0HICGogH0GYCGooAgA2AgAgHyAfKQOQCDcDwAgLIC0gHy4ByAgiAEgEQCAfQQhqIB8oAsAIIB8oAsQIIAAgJyAfQZAIahBsIB8oAgwhACAfKAIIDAQLQQIhACAfQQI7AZAIICcEQCAfQaAIaiAnNgIAIB9BADsBnAggH0ECNgKYCCAfQcjtwgA2ApQIIB9BkAhqDAQLQQEhACAfQQE2ApgIIB9Bze3CADYClAggH0GQCGoMAwtBAiEAIB9BAjsBkAggJwRAIB9BoAhqICc2AgAgH0EAOwGcCCAfQQI2ApgIIB9ByO3CADYClAggH0GQCGoMAwtBASEAIB9BATYCmAggH0HN7cIANgKUCCAfQZAIagwCCyAfQQM2ApgIIB9Bzu3CADYClAggH0ECOwGQCCAfQZAIagwBCyAfQQM2ApgIIB9B0e3CADYClAggH0ECOwGQCCAfQZAIagshASAfQcwIaiAANgIAIB8gATYCyAggHyAsNgLECCAfIDI2AsAIICQgH0HACGoQUCAfQfAIaiQADAILQdTtwgBBJUH87cIAEIcCAAsgAEEoQciHwwAQlwMACw8LIAFBACEBIwBBgAFrIiAkACA6vSECAkAgOiA6YgRAQQIhAAwBCyACQv////////8HgyIGQoCAgICAgIAIhCACQgGGQv7///////8PgyACQjSIp0H/D3EiGRsiA0IBgyEFQQMhAAJAAkACQEEBQQJBBCACQoCAgICAgID4/wCDIgdQIhwbIAdCgICAgICAgPj/AFEbQQNBBCAcGyAGUBtBAmsOAwABAgMLQQQhAAwCCyAZQbMIayEBIAVQIQBCASEEDAELQoCAgICAgIAgIANCAYYgA0KAgICAgICACFEiARshA0ICQgEgARshBCAFUCEAQct3Qcx3IAEbIBlqIQELICAgATsBeCAgIAQ3A3AgIEIBNwNoICAgAzcDYCAgIAA6AHoCfyAAQQJGBEBB3NXCACEtQQAMAQsgGEUEQEHL7cIAQdzVwgAgAkIAUxshLSACQj+IpwwBC0HL7cIAQcztwgAgAkIAUxshLUEBCyEyQQEhAQJ/AkACQAJAAkBBAyAAQQJrIABBAU0bQf8BcUEBaw4DAgEAAwsgIEEgaiEZICBBD2ohGiMAQTBrIhgkAAJAAkACQAJAAkACQAJAICBB4ABqIgApAwAiAlBFBEAgACkDCCIEUEUEQCAAKQMQIgNQRQRAIAIgAiADfCIDWARAIAIgBFoEQAJAAkAgA0L//////////x9YBEAgGCAALwEYIgA7AQggGCACIAR9IgQ3AwAgACAAQSBrIAAgA0KAgICAEFQiARsiHEEQayAcIANCIIYgAyABGyIDQoCAgICAgMAAVCIBGyIcQQhrIBwgA0IQhiADIAEbIgNCgICAgICAgIABVCIBGyIcQQRrIBwgA0IIhiADIAEbIgNCgICAgICAgIAQVCIBGyIcQQJrIBwgA0IEhiADIAEbIgNCgICAgICAgIDAAFQiARsgA0IChiADIAEbIgVCP4enQX9zaiIBa8EiHEEASA0CIBhCfyAcrSIGiCIDIASDNwMQIAMgBFQNDSAYIAA7AQggGCACNwMAIBggAiADgzcDECACIANWDQ1BoH8gAWvBQdAAbEGwpwVqQc4QbSIAQdEATw0BIABBBHQiAEHQ3cIAaikDACIHQv////8PgyIDIAIgBkI/gyIChiIIQiCIIg5+IglCIIgiFCAHQiCIIgYgDn58IAYgCEL/////D4MiB34iCEIgiCIVfCAJQv////8PgyADIAd+QiCIfCAIQv////8Pg3xCgICAgAh8QiCIIRBCAUEAIAEgAEHY3cIAai8BAGprQT9xrSIJhiIHQgF9IQwgAyAEIAKGIgJCIIgiBH4iCEL/////D4MgAyACQv////8PgyICfkIgiHwgAiAGfiICQv////8Pg3xCgICAgAh8QiCIIQ0gBCAGfiEEIAJCIIghAiAIQiCIIQggAEHa3cIAai8BACEAAn8CQAJAIAYgBSAFQn+FQj+IhiIFQiCIIhF+IhYgAyARfiIKQiCIIhJ8IAYgBUL/////D4MiBX4iD0IgiCITfCAKQv////8PgyADIAV+QiCIfCAPQv////8Pg3xCgICAgAh8QiCIIg98QgF8IgogCYinIgFBkM4ATwRAIAFBwIQ9SQ0BIAFBgMLXL0kNAkEIQQkgAUGAlOvcA0kiHBshG0GAwtcvQYCU69wDIBwbDAMLIAFB5ABPBEBBAkEDIAFB6AdJIhwbIRtB5ABB6AcgHBsMAwsgAUEJSyEbQQFBCiABQQpJGwwCC0EEQQUgAUGgjQZJIhwbIRtBkM4AQaCNBiAcGwwBC0EGQQcgAUGAreIESSIcGyEbQcCEPUGAreIEIBwbCyEcIBB8IQsgCiAMgyEDIBsgAGtBAWohJCAKIAQgCHwgAnwgDXwiF31CAXwiDSAMgyEEQQAhAANAIAEgHG4hHwJAAkACQCAAQRFHBEAgACAaaiIhIB9BMGoiHToAACANIAEgHCAfbGsiAa0gCYYiCCADfCICVg0NIAAgG0cNA0ERIABBAWoiACAAQRFNGyEBQgEhAgNAIAIhBSAEIQYgACABRg0CIAAgGmogA0IKfiIDIAmIp0EwaiIcOgAAIABBAWohACAFQgp+IQIgBkIKfiIEIAMgDIMiA1gNAAsgAEEBayIbQRFPDQIgBCADfSIJIAdaIQEgAiAKIAt9fiIKIAJ8IQggByAJVg0OIAogAn0iCSADWA0OIBogG2ohGyAGQgp+IAMgB3x9IQogByAJfSEMIAkgA30hC0IAIQYDQCADIAd8IgIgCVQgBiALfCADIAx8WnJFBEBBASEBDBALIBsgHEEBayIcOgAAIAYgCnwiDSAHWiEBIAIgCVoNECAGIAd9IQYgAiEDIAcgDVgNAAsMDwtBEUERQezpwgAQzQEACyABQRFBjOrCABDNAQALIABBEUGc6sIAEJcDAAsgAEEBaiEAIBxBCkkgHEEKbiEcRQ0AC0HQ6cIAQRlBwOnCABCHAgALQYDpwgBBLUGw6cIAEIcCAAsgAEHRAEGQ6MIAEM0BAAtB3NXCAEEdQZzWwgAQhwIAC0Hk2sIAQTdB4OjCABCHAgALQZzawgBBNkHQ6MIAEIcCAAtB8NnCAEEcQcDowgAQhwIAC0HA2cIAQR1BsOjCABCHAgALQZPZwgBBHEGg6MIAEIcCAAsgAEEBaiEBAkAgAEERSQRAIA0gAn0iBCAcrSAJhiIFWiEAIAogC30iCUIBfCEHIAQgBVQgCUIBfSIJIAJYcg0BIAMgBXwiAiAUfCAVfCAQfCAGIA4gEX1+fCASfSATfSAPfSEGIBIgE3wgD3wgFnwhBEIAIAsgAyAIfHx9IQxCAiAXIAIgCHx8fSELA0AgAiAIfCIOIAlUIAQgDHwgBiAIfFpyRQRAIAMgCHwhAkEBIQAMAwsgISAdQQFrIh06AAAgAyAFfCEDIAQgC3whCiAJIA5WBEAgAiAFfCECIAUgBnwhBiAEIAV9IQQgBSAKWA0BCwsgBSAKWCEAIAMgCHwhAgwBCyABQRFB/OnCABCXAwALAkACQCAARSACIAdackUEQCACIAV8IgMgB1QgByACfSADIAd9WnINAQsgAiANQgR9WCACQgJacQ0BIBlBADYCAAwFCyAZQQA2AgAMBAsgGSAkOwEIIBkgATYCBAwCCyADIQILAkACQCABRSACIAhackUEQCACIAd8IgMgCFQgCCACfSADIAh9WnINAQsgAiAFQlh+IAR8WCACIAVCFH5acQ0BIBlBADYCAAwDCyAZQQA2AgAMAgsgGSAkOwEIIBkgADYCBAsgGSAaNgIACyAYQTBqJAAMAQsgGEEANgIgIwBBIGsiACQAIAAgGDYCBCAAIBhBEGo2AgAgAEEYaiAYQRhqIgFBEGopAgA3AwAgAEEQaiABQQhqKQIANwMAIAAgASkCADcDCEEAIABBsO/CACAAQQRqQbDvwgAgAEEIakGs1sIAEGcACwJAICAoAiBFBEAgIEHQAGohLiAgQQ9qISEjAEHACmsiASQAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAICBB4ABqIgApAwAiAlBFBEAgACkDCCIDUA0BIAApAxAiBFANAiACIAR8IgUgAlQNAyACIANUDQQgACwAGiEmIAAvARghACABIAI+AgAgAUEBQQIgAkKAgICAEFQiGBs2AqABIAFBACACQiCIpyAYGzYCBCABQQhqQQBBmAEQwAMaIAEgAz4CqAEgAUEBQQIgA0KAgICAEFQiGBs2AsgCIAFBACADQiCIpyAYGzYCrAEgAUGwAWpBAEGYARDAAxogASAEPgLQAiABQQFBAiAEQoCAgIAQVCIYGzYC8AMgAUEAIARCIIinIBgbNgLUAiABQdgCakEAQZgBEMADGiABQfgDakEEckEAQZwBEMADGiABQQE2AvgDIAFBATYCmAUgAK3DIAVCAX15fULCmsHoBH5CgKHNoLQCfEIgiKciGMEhJQJAIADBIhlBAE4EQCABIAAQOxogAUGoAWogABA7GiABQdACaiAAEDsaDAELIAFB+ANqQQAgGWvBEDsaCwJAICVBAEgEQCABQQAgJWvBIgAQRCABQagBaiAAEEQgAUHQAmogABBEDAELIAFB+ANqIBhB//8DcRBECyABKAKgASEZIAFBmAlqIAFBoAEQwgMaIAEgGTYCuAogGSABKALwAyIcIBkgHEsbIhhBKEsNDyAYRQRAQQAhGAwHCyAYQQFxISQgGEEBRg0FIBhBfnEhHSABQZgJaiEAIAFB0AJqIRoDQCAAIB4gACgCACIfIBooAgBqIhtqIic2AgAgAEEEaiIeIB4oAgAiLCAaQQRqKAIAaiIeIBsgH0kgGyAnS3JqIhs2AgAgHiAsSSAbIB5JciEeIBpBCGohGiAAQQhqIQAgHSAjQQJqIiNHDQALDAULQZPZwgBBHEGw2cIAEIcCAAtBwNnCAEEdQeDZwgAQhwIAC0Hw2cIAQRxBjNrCABCHAgALQZzawgBBNkHU2sIAEIcCAAtB5NrCAEE3QZzbwgAQhwIACyAkBH8gI0ECdCIAIAFBmAlqaiIbIBsoAgAiGyABQdACaiAAaigCAGoiACAeaiIaNgIAIAAgG0kgACAaS3IFIB4LRQ0AIBhBJ0sNFCABQZgJaiAYQQJ0akEBNgIAIBhBAWohGAsgASAYNgK4CiABKAKYBSIbIBggGCAbSRsiAEEpTw0JIABBAnQhAAJAA0AgAARAQX8gAEEEayIAIAFBmAlqaigCACIYIAAgAUH4A2pqKAIAIhpHIBggGksbIhpFDQEMAgsLQX9BACAAGyEaCyAaICZOBEAgGUEpTw0MIBlFBEBBACEZDAMLIBlBAWtB/////wNxIgBBAWoiGEEDcSEaIABBA0kEQCABIQBCACECDAILIBhB/P///wdxIR4gASEAQgAhAgNAIAAgADUCAEIKfiACfCICPgIAIABBBGoiGCAYNQIAQgp+IAJCIIh8IgI+AgAgAEEIaiIYIBg1AgBCCn4gAkIgiHwiAj4CACAAQQxqIhggGDUCAEIKfiACQiCIfCICPgIAIAJCIIghAiAAQRBqIQAgHkEEayIeDQALDAELICVBAWohJQwGCyAaBEADQCAAIAA1AgBCCn4gAnwiAj4CACAAQQRqIQAgAkIgiCECIBpBAWsiGg0ACwsgAqciAEUNACAZQSdLDQEgASAZQQJ0aiAANgIAIBlBAWohGQsgASAZNgKgASABKALIAiIYQSlPDQYgGEUEQEEAIRgMAwsgGEEBa0H/////A3EiAEEBaiIZQQNxIRogAEEDSQRAIAFBqAFqIQBCACECDAILIBlB/P///wdxIR4gAUGoAWohAEIAIQIDQCAAIAA1AgBCCn4gAnwiAj4CACAAQQRqIhkgGTUCAEIKfiACQiCIfCICPgIAIABBCGoiGSAZNQIAQgp+IAJCIIh8IgI+AgAgAEEMaiIZIBk1AgBCCn4gAkIgiHwiAj4CACACQiCIIQIgAEEQaiEAIB5BBGsiHg0ACwwBCyAZQShByIfDABDNAQALIBoEQANAIAAgADUCAEIKfiACfCICPgIAIABBBGohACACQiCIIQIgGkEBayIaDQALCyACpyIARQ0AIBhBJ0sNDyABQagBaiAYQQJ0aiAANgIAIBhBAWohGAsgASAYNgLIAiAcQSlPDQ8gHEUEQCABQQA2AvADDAILIBxBAWtB/////wNxIgBBAWoiGEEDcSEaIABBA0kEQCABQdACaiEAQgAhAgwBCyAYQfz///8HcSEeIAFB0AJqIQBCACECA0AgACAANQIAQgp+IAJ8IgI+AgAgAEEEaiIYIBg1AgBCCn4gAkIgiHwiAj4CACAAQQhqIhggGDUCAEIKfiACQiCIfCICPgIAIABBDGoiGCAYNQIAQgp+IAJCIIh8IgI+AgAgAkIgiCECIABBEGohACAeQQRrIh4NAAsMAAsgGgRAA0AgACAANQIAQgp+IAJ8IgI+AgAgAEEEaiEAIAJCIIghAiAaQQFrIhoNAAsLIAEgAqciAAR/IBxBJ0sNAiABQdACaiAcQQJ0aiAANgIAIBxBAWoFIBwLNgLwAwsgAUGgBWoiGCABQfgDaiIAQaABEMIDGiABIBs2AsAGIBhBARA7ITMgASgCmAUhGCABQcgGaiIZIABBoAEQwgMaIAEgGDYC6AcgGUECEDshNCABKAKYBSEYIAFB8AdqIhkgAEGgARDCAxogASAYNgKQCSAZQQMQOyE1AkAgASgCoAEiGSABKAKQCSIsIBkgLEsbIhhBKE0EQCABQZwFaiE2IAFBxAZqITcgAUHsB2ohOCABKAKYBSEnIAEoAsAGIS8gASgC6AchMEEAIRwDQCAYQQJ0IQACQANAIAAEQEF/IAAgOGooAgAiGyAAQQRrIgAgAWooAgAiGkcgGiAbSRsiGkUNAQwCCwtBf0EAIAAbIRoLQQAhJCAaQQFNBEAgGARAQQEhHkEAISMgGEEBRwRAIBhBfnEhJCABIgBB8AdqIRoDQCAAIB4gACgCACIdIBooAgBBf3NqIhlqIh42AgAgAEEEaiIbIBsoAgAiHyAaQQRqKAIAQX9zaiIbIBkgHUkgGSAeS3JqIhk2AgAgGSAbSSAbIB9JciEeIBpBCGohGiAAQQhqIQAgJCAjQQJqIiNHDQALCyAYQQFxBH8gASAjQQJ0IgBqIhkgGSgCACIZIAAgNWooAgBBf3NqIgAgHmoiGzYCACAAIBlJIAAgG0tyBSAeC0UNCAsgASAYNgKgAUEIISQgGCEZCyAZIDAgGSAwSxsiGEEpTw0EIBwhGyAYQQJ0IQACQANAIAAEQEF/IAAgN2ooAgAiHCAAQQRrIgAgAWooAgAiGkcgGiAcSRsiGkUNAQwCCwtBf0EAIAAbIRoLAkAgGkEBSwRAIBkhGAwBCyAYBEBBASEeQQAhIyAYQQFHBEAgGEF+cSEdIAEiAEHIBmohGgNAIAAgHiAAKAIAIh8gGigCAEF/c2oiGWoiHjYCACAAQQRqIhwgHCgCACIoIBpBBGooAgBBf3NqIhwgGSAfSSAZIB5LcmoiGTYCACAZIBxJIBwgKElyIR4gGkEIaiEaIABBCGohACAdICNBAmoiI0cNAAsLIBhBAXEEfyABICNBAnQiAGoiGSAZKAIAIhkgACA0aigCAEF/c2oiACAeaiIcNgIAIAAgGUkgACAcS3IFIB4LRQ0ICyABIBg2AqABICRBBHIhJAsCQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgGCAvIBggL0sbIhxBKUkEQCAcQQJ0IQACQANAIAAEQEF/IAAgNmooAgAiGSAAQQRrIgAgAWooAgAiGkcgGSAaSxsiGkUNAQwCCwtBf0EAIAAbIRoLAkAgGkEBSwRAIBghHAwBCyAcBEBBASEeQQAhIyAcQQFHBEAgHEF+cSEdIAEiAEGgBWohGgNAIAAgHiAAKAIAIh8gGigCAEF/c2oiGGoiHjYCACAAQQRqIhkgGSgCACIoIBpBBGooAgBBf3NqIhkgGCAfSSAYIB5LcmoiGDYCACAYIBlJIBkgKElyIR4gGkEIaiEaIABBCGohACAdICNBAmoiI0cNAAsLIBxBAXEEfyABICNBAnQiAGoiGCAYKAIAIhggACAzaigCAEF/c2oiACAeaiIZNgIAIAAgGEkgACAZS3IFIB4LRQ0YCyABIBw2AqABICRBAmohJAsgHCAnIBwgJ0sbIhlBKU8NFyAZQQJ0IQACQANAIAAEQEF/IABBBGsiACABQfgDamooAgAiGCAAIAFqKAIAIhpHIBggGksbIhpFDQEMAgsLQX9BACAAGyEaCwJAIBpBAUsEQCAcIRkMAQsgGQRAQQEhHkEAISMgGUEBRwRAIBlBfnEhHSABIgBB+ANqIRoDQCAAIB4gACgCACIfIBooAgBBf3NqIhhqIh42AgAgAEEEaiIcIBwoAgAiKCAaQQRqKAIAQX9zaiIcIBggH0kgGCAeS3JqIhg2AgAgGCAcSSAcIChJciEeIBpBCGohGiAAQQhqIQAgHSAjQQJqIiNHDQALCyAZQQFxBH8gASAjQQJ0IgBqIhggGCgCACIYIAFB+ANqIABqKAIAQX9zaiIAIB5qIhw2AgAgACAYSSAAIBxLcgUgHgtFDRgLIAEgGTYCoAEgJEEBaiEkCyAbQRFGDQIgGyAhaiAkQTBqOgAAIBkgASgCyAIiHyAZIB9LGyIAQSlPDRUgG0EBaiEcIABBAnQhAAJAA0AgAARAQX8gAEEEayIAIAFBqAFqaigCACIYIAAgAWooAgAiGkcgGCAaSxsiGEUNAQwCCwtBf0EAIAAbIRgLIAFBmAlqIAFBoAEQwgMaIAEgGTYCuAogGSABKALwAyIdIBkgHUsbIiRBKEsNBAJAICRFBEBBACEkDAELQQAhHkEAISMgJEEBRwRAICRBfnEhOSABQZgJaiEAIAFB0AJqIRoDQCAAIB4gACgCACIpIBooAgBqIihqIio2AgAgAEEEaiIeIB4oAgAiKyAaQQRqKAIAaiIeICggKUkgKCAqS3JqIig2AgAgHiArSSAeIChLciEeIBpBCGohGiAAQQhqIQAgOSAjQQJqIiNHDQALCyAkQQFxBH8gI0ECdCIAIAFBmAlqaiIaIB4gGigCACIaIAFB0AJqIABqKAIAaiIAaiIeNgIAIAAgGkkgACAeS3IFIB4LRQ0AICRBJ0sNAiABQZgJaiAkQQJ0akEBNgIAICRBAWohJAsgASAkNgK4CiAnICQgJCAnSRsiAEEpTw0VIABBAnQhAAJAA0AgAARAQX8gAEEEayIAIAFBmAlqaigCACIaIAAgAUH4A2pqKAIAIh5HIBogHksbIhpFDQEMAgsLQX9BACAAGyEaCyAYICZIIBogJkhyRQRAIBlBKU8NGCAZRQRAQQAhGQwJCyAZQQFrQf////8DcSIAQQFqIhhBA3EhGiAAQQNJBEAgASEAQgAhAgwICyAYQfz///8HcSEeIAEhAEIAIQIDQCAAIAA1AgBCCn4gAnwiAj4CACAAQQRqIhggGDUCAEIKfiACQiCIfCICPgIAIABBCGoiGCAYNQIAQgp+IAJCIIh8IgI+AgAgAEEMaiIYIBg1AgBCCn4gAkIgiHwiAj4CACACQiCIIQIgAEEQaiEAIB5BBGsiHg0ACwwHCyAaICZODQUgGCAmSARAIAFBARA7GiABKAKgASIAIAEoApgFIhggACAYSxsiAEEpTw0WIABBAnQhACABQQRrIRggAUH0A2ohGQJAA0AgAARAIAAgGGohGiAAIBlqIR4gAEEEayEAQX8gHigCACIeIBooAgAiGkcgGiAeSRsiGkUNAQwCCwtBf0EAIAAbIRoLIBpBAk8NBgsgG0ERTw0DQX8hGiAbIQACQANAIABBf0YNASAaQQFqIRogACAhaiAAQQFrIQAtAABBOUYNAAsgACAhaiIYQQFqIhkgGS0AAEEBajoAACAbIABBAmpJDQYgGEECakEwIBoQwAMaDAYLICFBMToAACAbBEAgIUEBakEwIBsQwAMaCyAcQRFJBEAgHCAhakEwOgAAICVBAWohJSAbQQJqIRwMBgsgHEERQYzcwgAQzQEACwwfCyAkQShByIfDABDNAQALQRFBEUHs28IAEM0BAAsgHEERQfzbwgAQlwMACyAkQShByIfDABCXAwALIBxBEU0EQCAuICU7AQggLiAcNgIEIC4gITYCACABQcAKaiQADBQLIBxBEUGc3MIAEJcDAAsgGgRAA0AgACAANQIAQgp+IAJ8IgI+AgAgAEEEaiEAIAJCIIghAiAaQQFrIhoNAAsLIAKnIgBFDQAgGUEnSw0BIAEgGUECdGogADYCACAZQQFqIRkLIAEgGTYCoAEgH0EpTw0BIB9FBEBBACEfDAQLIB9BAWtB/////wNxIgBBAWoiGEEDcSEaIABBA0kEQCABQagBaiEAQgAhAgwDCyAYQfz///8HcSEeIAFBqAFqIQBCACECA0AgACAANQIAQgp+IAJ8IgI+AgAgAEEEaiIYIBg1AgBCCn4gAkIgiHwiAj4CACAAQQhqIhggGDUCAEIKfiACQiCIfCICPgIAIABBDGoiGCAYNQIAQgp+IAJCIIh8IgI+AgAgAkIgiCECIABBEGohACAeQQRrIh4NAAsMAgsgGUEoQciHwwAQzQEACyAfQShByIfDABCXAwALIBoEQANAIAAgADUCAEIKfiACfCICPgIAIABBBGohACACQiCIIQIgGkEBayIaDQALCyACpyIARQ0AIB9BJ0sNASABQagBaiAfQQJ0aiAANgIAIB9BAWohHwsgASAfNgLIAiAdQSlPDQEgHUUEQEEAIR0MBAsgHUEBa0H/////A3EiAEEBaiIYQQNxIRogAEEDSQRAIAFB0AJqIQBCACECDAMLIBhB/P///wdxIR4gAUHQAmohAEIAIQIDQCAAIAA1AgBCCn4gAnwiAj4CACAAQQRqIhggGDUCAEIKfiACQiCIfCICPgIAIABBCGoiGCAYNQIAQgp+IAJCIIh8IgI+AgAgAEEMaiIYIBg1AgBCCn4gAkIgiHwiAj4CACACQiCIIQIgAEEQaiEAIB5BBGsiHg0ACwwCCyAfQShByIfDABDNAQALIB1BKEHIh8MAEJcDAAsgGgRAA0AgACAANQIAQgp+IAJ8IgI+AgAgAEEEaiEAIAJCIIghAiAaQQFrIhoNAAsLIAKnIgBFDQAgHUEnSw0DIAFB0AJqIB1BAnRqIAA2AgAgHUEBaiEdCyABIB02AvADIBkgLCAZICxLGyIYQShNDQALCwwCCyAdQShByIfDABDNAQALIBxBKEHIh8MAEM0BAAsgGEEoQciHwwAQlwMACyAAQShByIfDABCXAwALQdiHwwBBGkHIh8MAEIcCAAsgGUEoQciHwwAQlwMACyAgQdgAaiAgQShqKAIANgIAICAgICkDIDcDUAsgICAgKAJQICAoAlQgIC8BWEEAICBBIGoQbCAgKAIEIQEgICgCAAwDCyAgQQI7ASAgIEEBNgIoICBBze3CADYCJCAgQSBqDAILICBBAzYCKCAgQc7twgA2AiQgIEECOwEgICBBIGoMAQsgIEEDNgIoICBB0e3CADYCJCAgQQI7ASAgIEEgagshACAgQdwAaiABNgIAICAgADYCWCAgIDI2AlQgICAtNgJQICBB0ABqEFAgIEGAAWokAA8LIBhBKEHIh8MAEJcDAAsgGEEoQciHwwAQzQEACyAcQShByIfDABCXAwALOgEBfyMAQRBrIgMkACADQQhqIAEgAhBTAkAgAygCCEUEQCAAIAEQNAwBCyAAQQc2AgALIANBEGokAAs5AAJAAn8gAkGAgMQARwRAQQEgACACIAEoAhARAAANARoLIAMNAUEACw8LIAAgAyAEIAEoAgwRAgALOwEBfyMAQRBrIgIkACACIAAoAgA2AgwgAUHevsAAQQxB6r7AAEEPIAJBDGpB/L7AABC1ASACQRBqJAALOwEBfyMAQRBrIgIkACACIAAoAgA2AgwgAUGIzsAAQQpBtMzAAEEEIAJBDGpBlM7AABC1ASACQRBqJAALOwEBfyMAQRBrIgIkACACIAAoAgA2AgwgAUHk68AAQQtB7+vAAEEFIAJBDGpB9OvAABC1ASACQRBqJAALOwEBfyMAQRBrIgIkACACIAAoAgA2AgwgAUHD9sAAQQ5B0fbAAEEFIAJBDGpB2PbAABC1ASACQRBqJAALOwEBfyMAQRBrIgIkACACIAAoAgA2AgwgAUHmnMIAQRNB+ZzCAEEKIAJBDGpBhJ3CABC1ASACQRBqJAALOwEBfyMAQRBrIgIkACACIAAoAgA2AgwgAUHcqsIAQRNB76rCAEEEIAJBDGpB9KrCABC1ASACQRBqJAAL5AIBAn8jAEEgayICJAAgAkEBOgAYIAIgATYCFCACIAA2AhAgAkGY78IANgIMIAJB3NXCADYCCCMAQRBrIgEkAAJAIAJBCGoiACgCDCICBEAgACgCCCIDRQ0BIAEgAjYCCCABIAA2AgQgASADNgIAIwBBEGsiACQAIABBCGogAUEIaigCADYCACAAIAEpAgA3AwAjAEEQayIBJAAgACgCACICQRRqKAIAIQMCQAJ/AkACQCACQQxqKAIADgIAAQMLIAMNAkEAIQJBxLzCAAwBCyADDQEgAigCCCIDKAIEIQIgAygCAAshAyABIAI2AgQgASADNgIAIAFBjMbCACAAKAIEIgEoAgggACgCCCABLQAQEKwBAAsgAUEANgIEIAEgAjYCDCABQfjFwgAgACgCBCIBKAIIIAAoAgggAS0AEBCsAQALQcS8wgBBK0HIxcIAEIcCAAtBxLzCAEErQbjFwgAQhwIACzYBAX8jAEEQayICJAAgAkEIaiABELkCIAIoAgwhASAAIAIoAgg2AgAgACABNgIEIAJBEGokAAs2AQF/IwBBEGsiAiQAIAJBCGogARDgAiACKAIMIQEgACACKAIINgIAIAAgATYCBCACQRBqJAALSQECf0G+9MAAIQJBBCEDAkACQAJAIAAoAgAtAABBAWsOAgABAgsgAUG09MAAQQoQ+AIPC0Gs9MAAIQJBCCEDCyABIAIgAxD4Ags0AQF/IAAoAgAgACgCBCgCABEDACAAKAIEIgFBBGooAgAEQCABQQhqKAIAGiAAKAIAEDoLCzgBAX8jAEEQayICJAAgAiAANgIMIAFB5pzCAEETQfmcwgBBCiACQQxqQYSdwgAQtQEgAkEQaiQACzgBAX8jAEEQayICJAAgAiAANgIMIAFB3KrCAEETQe+qwgBBBCACQQxqQfSqwgAQtQEgAkEQaiQACzMAAkAgAEH8////B0sNACAARQRAQQQPCyAAIABB/f///wdJQQJ0EP4CIgBFDQAgAA8LAAs8AQF/IAItAANFBEAgAiABKAAANgAACwJAAkACQCAAQf8BcUECaw4CAQIACyACKAAAIQMLIAEgAzYAAAsLyAMCAX4EfyAAKAIAIQAgARCNA0UEQCABEI4DRQRAIAAgARCdAw8LIwBBgAFrIgQkACAAKQMAIQJBgAEhACAEQYABaiEFAkACQANAIABFBEBBACEADAMLIAVBAWtBMEE3IAKnIgNBD3EiBkEKSRsgBmo6AAAgAkIQWgRAIAVBAmsiBUEwQTcgA0H/AXEiA0GgAUkbIANBBHZqOgAAIABBAmshACACQoACVCACQgiIIQJFDQEMAgsLIABBAWshAAsgAEGBAUkNACAAQYABQbzxwgAQlgMACyABQQFBzPHCAEECIAAgBGpBgAEgAGsQRiAEQYABaiQADwsjAEGAAWsiBCQAIAApAwAhAkGAASEAIARBgAFqIQUCQAJAA0AgAEUEQEEAIQAMAwsgBUEBa0EwQdcAIAKnIgNBD3EiBkEKSRsgBmo6AAAgAkIQWgRAIAVBAmsiBUEwQdcAIANB/wFxIgNBoAFJGyADQQR2ajoAACAAQQJrIQAgAkKAAlQgAkIIiCECRQ0BDAILCyAAQQFrIQALIABBgQFJDQAgAEGAAUG88cIAEJYDAAsgAUEBQczxwgBBAiAAIARqQYABIABrEEYgBEGAAWokAAsyACAAKAIAIQAgARCNA0UEQCABEI4DRQRAIAAgARCZAw8LIAAgARC9AQ8LIAAgARC8AQu3AQEDfyAAKAIAIQAgARCNA0UEQCABEI4DRQRAIAAgARCcAw8LIAAgARC7AQ8LIwBBgAFrIgMkACAALQAAIQADQCACIANqQf8AakEwQdcAIABBD3EiBEEKSRsgBGo6AAAgAkEBayECIAAiBEEEdiEAIARBD0sNAAsgAkGAAWoiAEGBAU8EQCAAQYABQbzxwgAQlgMACyABQQFBzPHCAEECIAIgA2pBgAFqQQAgAmsQRiADQYABaiQAC70CAQN/IAAoAgAhACABEI0DRQRAIAEQjgNFBEAgADMBAEEBIAEQfA8LIwBBgAFrIgMkACAALwEAIQADQCACIANqQf8AakEwQTcgAEEPcSIEQQpJGyAEajoAACACQQFrIQIgACIEQQR2IQAgBEEPSw0ACyACQYABaiIAQYEBTwRAIABBgAFBvPHCABCWAwALIAFBAUHM8cIAQQIgAiADakGAAWpBACACaxBGIANBgAFqJAAPCyMAQYABayIDJAAgAC8BACEAA0AgAiADakH/AGpBMEHXACAAQQ9xIgRBCkkbIARqOgAAIAJBAWshAiAAIgRBBHYhACAEQQ9LDQALIAJBgAFqIgBBgQFPBEAgAEGAAUG88cIAEJYDAAsgAUEBQczxwgBBAiACIANqQYABakEAIAJrEEYgA0GAAWokAAssAQF/IwBBEGsiACQAIABBCGoiAiABQe+8wgBBCxC8AiACENUBIABBEGokAAsuACAAQQQ6AAQgAEEENgIAIABBBmogAjoAACAAQQVqIAE6AAAgAEEUakEAOwEACysAIAEgAk8EQCABIAJrIgEgACABaiACED0PC0HsqcAAQSFBkKrAABCHAgALLAAgACABKQIANwIAIABBEGogAUEQaigCADYCACAAQQhqIAFBCGopAgA3AgALMQAgACABKAIAIAIgAyABKAIEKAIMEQIAOgAIIAAgATYCBCAAIANFOgAJIABBADYCAAspACABIAJPBEAgAiAAIAJqIAEgAmsQPQ8LQfSlwABBI0HcqcAAEIcCAAsuACABIAAoAgAtAABBBHNBB3FBAnQiAEGI+cAAaigCACAAQej4wABqKAIAEPgCCyoAIAAoAgBFBEAgACgCBCABIABBCGooAgAoAhARAAAPCyAAQQRqIAEQawssAAJAIAEQjQNFBEAgARCOAw0BIAAgARDAAg8LIAAgARC8AQ8LIAAgARC9AQsnACAAIAAoAgRBAXEgAXJBAnI2AgQgACABaiIAIAAoAgRBAXI2AgQLLQEBfyAAQZCqwgBB1KnCACABLQAAQQRGIgIbNgIEIAAgAUEBaiABIAIbNgIACzoBAn9B/JLDAC0AACEBQfySwwBBADoAAEGAk8MAKAIAIQJBgJPDAEEANgIAIAAgAjYCBCAAIAE2AgALMQAgAEEDOgAgIABCgICAgIAENwIYIABBADYCECAAQQA2AgggACACNgIEIAAgATYCAAstACABKAIAIAIgAyABKAIEKAIMEQIAIQIgAEEAOgAFIAAgAjoABCAAIAE2AgALIAEBfwJAIABBBGooAgAiAUUNACAAKAIARQ0AIAEQOgsLIwACQCABQfz///8HTQRAIAAgAUEEIAIQ8gIiAA0BCwALIAALIwAgAiACKAIEQX5xNgIEIAAgAUEBcjYCBCAAIAFqIAE2AgALHgAgACgCACIArUIAIACsfSAAQQBOIgAbIAAgARB8CyUAIABFBEBBxLfAAEEyELcDAAsgACACIAMgBCAFIAEoAhARCwALIwAgAEEANgIQIAAgASkCADcCACAAQQhqIAFBCGopAgA3AgALKAAgASAAKAIALQAAQQJ0IgBB1NLAAGooAgAgAEGY0sAAaigCABD4AgsoACABIAAoAgAtAABBAnQiAEG8gsEAaigCACAAQZyCwQBqKAIAEPgCCygAIAEgACgCAC0AAEECdCIAQbTQwgBqKAIAIABBkM/CAGooAgAQ+AILHwECfiAAKQMAIgIgAkI/hyIDhSADfSACQgBZIAEQfAsjACAARQRAQcS3wABBMhC3AwALIAAgAiADIAQgASgCEBEHAAsjACAARQRAQcS3wABBMhC3AwALIAAgAiADIAQgASgCEBEVAAsjACAARQRAQcS3wABBMhC3AwALIAAgAiADIAQgASgCEBEjAAsjACAARQRAQcS3wABBMhC3AwALIAAgAiADIAQgASgCEBElAAsjACAARQRAQcS3wABBMhC3AwALIAAgAiADIAQgASgCEBEnAAshACAAQcDUwAA2AgQgACABQQRqQQAgAS0AAEEfRhs2AgALJQAgASAALQAAQQJ0IgBBtNDCAGooAgAgAEGQz8IAaigCABD4AgseACAAIAFBA3I2AgQgACABaiIAIAAoAgRBAXI2AgQLCgAgAEEIELwDAAsUACAAKAIABEAgAEEEaigCABA6CwsiAQF/IAEoAgAQCiECIAAgATYCCCAAIAI2AgQgAEEANgIACyEAIABFBEBBxLfAAEEyELcDAAsgACACIAMgASgCEBEFAAsjACABQZz0wABBofTAACAAKAIALQAAIgAbQQVBCyAAGxD4AgsjACABQcL0wABBxvTAACAAKAIALQAAIgAbQQRBBiAAGxD4AgssAQF/AkACQCAAQf8BcUEB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NgIEIAAgATYCAAsiACAAQQA2AhggAEEANgIQIABCgICAgAI3AwggAEIBNwMACxsAIAAoAgAiAEEEaigCACAAQQhqKAIAIAEQQQscACAAKAIAIgBBBGooAgAgAEEIaigCACABEL0DCxwAIAAgASkCADcCACAAQQhqIAFBCGooAgA2AgALHQAgASgCAEUEQAALIABBnIvBADYCBCAAIAE2AgALIQAgACABQQRqNgIAIABBoJfCAEHcl8IAIAEoAgAbNgIECx0AIAEoAgBFBEAACyAAQfiewgA2AgQgACABNgIACxwAIAAoAgAiACgCACABIABBBGooAgAoAgwRAAALHAAgACgCACIAKAIAIAEgAEEEaigCACgCEBEAAAscACAAIAEoAgAgAiADIAQgBSABKAIEKAIMEQYACxkBAX8gACgCECIBBH8gAQUgAEEUaigCAAsLFAAgASABIAAgACABXRsgACAAXBsLFAAgACAAIAEgACABXRsgASABXBsLEQAgAMBBAnRB6PfAAGooAgALGAAgACgCACIAKAIAIABBBGooAgAgARBBCxcAIABBBGooAgAgAEEIaigCACABEL0DCxYAIABBBGooAgAgAEEIaigCACABEEELEgBBGSAAQQF2a0EAIABBH0cbCxYAIAAgAUEBcjYCBCAAIAFqIAE2AgALGAAgALxBgICAgHhxQf////cDcr4gAJKPCyEAIAC9QoCAgICAgICAgH+DQv/////////vP4S/IACgnQsTAQF/IAAtADkgAEEBOgA5QQFxCxAAIAAgAWpBAWtBACABa3ELkAYBBn8CfyAAIQUCQAJAAkAgAkEJTwRAIAMgAhBoIgcNAUEADAQLQQhBCBDxAiEAQRRBCBDxAiEBQRBBCBDxAiECQQBBEEEIEPECQQJ0ayIEQYCAfCACIAAgAWpqa0F3cUEDayIAIAAgBEsbIANNDQFBECADQQRqQRBBCBDxAkEFayADSxtBCBDxAiECIAUQ0QMiACAAELgDIgQQzgMhAQJAAkACQAJAAkACQAJAIAAQkQNFBEAgAiAETQ0BIAFB/JbDACgCAEYNAiABQfiWwwAoAgBGDQMgARCKAw0HIAEQuAMiBiAEaiIIIAJJDQcgCCACayEEIAZBgAJJDQQgARCCAQwFCyAAELgDIQEgAkGAAkkNBiABIAJrQYGACEkgAkEE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aiQAQQALDgAgACgCABoDQAwACwALdwEBfyMAQTBrIgMkACADIAE2AgQgAyAANgIAIANBFGpBAjYCACADQRxqQQI2AgAgA0EsakEyNgIAIANB4PXCADYCECADQQA2AgggA0EyNgIkIAMgA0EgajYCGCADIANBBGo2AiggAyADNgIgIANBCGogAhCiAgALdwEBfyMAQTBrIgMkACADIAE2AgQgAyAANgIAIANBFGpBAjYCACADQRxqQQI2AgAgA0EsakEyNgIAIANBgPbCADYCECADQQA2AgggA0EyNgIkIAMgA0EgajYCGCADIANBBGo2AiggAyADNgIgIANBCGogAhCiAgALdwEBfyMAQTBrIgMkACADIAE2AgQgAyAANgIAIANBFGpBAjYCACADQRxqQQI2AgAgA0EsakEyNgIAIANBtPbCADYCECADQQA2AgggA0EyNgIkIAMgA0EgajYCGCADIANBBGo2AiggAyADNgIgIANBCGogAhCiAgALDQAgADUCAEEBIAEQfAttAQF/IwBBEGsiAyQAIAMgATYCDCADIAA2AggjAEEgayIAJAAgAEEMakEBNgIAIABBFGpBATYCACAAQajvwgA2AgggAEEANgIAIABBtAI2AhwgACADQQhqNgIYIAAgAEEYajYCECAAIAIQogIACw0AIAAoAgAgASACEGILDQAgADEAAEEBIAEQfAsNACAAKQMAQQEgARB8C8sCAQN/IAAoAgAtAAAhAiMAQYABayIEJAACQAJAAkACQCABKAIYIgBBEHFFBEAgAEEgcQ0BIAKtQv8Bg0EBIAEQfCECDAQLQQAhAANAIAAgBGpB/wBqQTBB1wAgAkEPcSIDQQpJGyADajoAACAAQQFrIQAgAkH/AXEiA0EEdiECIANBD0sNAAsgAEGAAWoiAkGBAU8NASABQQFBzPHCAEECIAAgBGpBgAFqQQAgAGsQRiECDAMLQQAhAANAIAAgBGpB/wBqQTBBNyACQQ9xIgNBCkkbIANqOgAAIABBAWshACACQf8BcSIDQQR2IQIgA0EPSw0ACyAAQYABaiICQYEBTw0BIAFBAUHM8cIAQQIgACAEakGAAWpBACAAaxBGIQIMAgsgAkGAAUG88cIAEJYDAAsgAkGAAUG88cIAEJYDAAsgBEGAAWokACACC8cDAgF+BH8gACgCACkDACECIwBBgAFrIgUkAAJAAkACQAJAIAEoAhgiAEEQcUUEQCAAQSBxDQEgAkEBIAEQfCEADAQLQYABIQAgBUGAAWohBAJAAkADQCAARQRAQQAhAAwDCyAEQQFrQTBB1wAgAqciA0EPcSIGQQpJGyAGajoAACACQhBaBEAgBEECayIEQTBB1wAgA0H/AXEiA0GgAUkbIANBBHZqOgAAIABBAmshACACQoACVCACQgiIIQJFDQEMAgsLIABBAWshAAsgAEGBAU8NAgsgAUEBQczxwgBBAiAAIAVqQYABIABrEEYhAAwDC0GAASEAIAVBgAFqIQQCQAJAA0AgAEUEQEEAIQAMAwsgBEEBa0EwQTcgAqciA0EPcSIGQQpJGyAGajoAACACQhBaBEAgBEECayIEQTBBNyADQf8BcSIDQaABSRsgA0EEdmo6AAAgAEECayEAIAJCgAJUIAJCCIghAkUNAQwCCwsgAEEBayEACyAAQYEBTw0CCyABQQFBzPHCAEECIAAgBWpBgAEgAGsQRiEADAILIABBgAFBvPHCABCWAwALIABBgAFBvPHCABCWAwALIAVBgAFqJAAgAAsLACAAIwBqJAAjAAsOACABQeqBwABBChD4AgsOACABQeSNwABBCRD4AgvgAQEBfyAAKAIAIQAjAEEgayICJAAgAiAANgIMIAIgASgCAEGqiMMAQQ8gASgCBCgCDBECADoAGCACIAE2AhQgAkEAOgAZIAJBADYCECACQRBqIAJBDGpBvIjDABCEASEAAn8gAi0AGCIBIAAoAgAiAEUNABpBASABDQAaIAIoAhQhAQJAIABBAUcNACACLQAZRQ0AIAEtABhBBHENAEEBIAEoAgBBjPHCAEEBIAEoAgQoAgwRAgANARoLIAEoAgBBjO7CAEEBIAEoAgQoAgwRAgALIAJBIGokAEH/AXFBAEcLCwAgACgCACABEAkLDQAgAUHcvsAAQQIQQAsMACAAIAEpAgA3AwALsAkBEn8gACgCACEAIwBBIGsiCCQAIAhBCGogAEEEaigCACAAQQhqKAIAEIIDIAggCCkDCDcDGCAIIAhBGGoQpgMgCCAIKQMANwMQAn8gCEEQaiEAIwBBQGoiAyQAAkACf0EBIAEoAgAiDUEiIAEoAgQiDigCECIREQAADQAaIAMgACkCADcDACADQQhqIAMQXCADKAIIIgYEQANAIAMoAhQhDyADKAIQIRBBACECAkACQAJAIAMoAgwiBUUNACAFIAZqIRNBACEHIAYhCQJAA0ACQCAJIgosAAAiAEEATgRAIApBAWohCSAAQf8BcSEBDAELIAotAAFBP3EhBCAAQR9xIQEgAEFfTQRAIAFBBnQgBHIhASAKQQJqIQkMAQsgCi0AAkE/cSAEQQZ0ciEEIApBA2ohCSAAQXBJBEAgBCABQQx0ciEBDAELIAFBEnRBgIDwAHEgCS0AAEE/cSAEQQZ0cnIiAUGAgMQARg0CIApBBGohCQtBgoDEACEAQTAhBAJAAkACQAJAAkACQAJAAkACQCABDigGAQEBAQEBAQECBAEBAwEBAQEBAQEBAQEBAQEBAQEBAQEBBQEBAQEFAAsgAUHcAEYNBAsgARBvRQRAIAEQlwENBgsgAUGBgMQARg0FIAFBAXJnQQJ2QQdzIQQgASEADAQLQfQAIQQMAwtB8gAhBAwCC0HuACEEDAELIAEhBAsgAiAHSw0BAkAgAkUNACACIAVPBEAgAiAFRg0BDAMLIAIgBmosAABBQEgNAgsCQCAHRQ0AIAUgB00EQCAFIAdHDQMMAQsgBiAHaiwAAEG/f0wNAgsgDSACIAZqIAcgAmsgDigCDBECAA0FQQUhDANAIAwhEiAAIQJBgYDEACEAQdwAIQsCQAJAAkACQAJAQQMgAkGAgMQAayACQf//wwBNG0EBaw4DAQQAAgtBACEMQf0AIQsgAiEAAkACQAJAIBJB/wFxQQFrDgUGBQABAgQLQQIhDEH7ACELDAULQQMhDEH1ACELDAQLQQQhDEHcACELDAMLQYCAxAAhACAEIgtBgIDEAEcNAgsCf0EBIAFBgAFJDQAaQQIgAUGAEEkNABpBA0EEIAFBgIAESRsLIAdqIQIMAwsgEkEBIAQbIQxBMEHXACACIARBAnR2QQ9xIgJBCkkbIAJqIQsgBEEBa0EAIAQbIQQLIA0gCyAREQAARQ0ACwwFCyAHIAprIAlqIQcgCSATRw0BDAILCyAGIAUgAiAHQeT4wgAQ/AIACyACRQRAQQAhAgwBCyACIAVPBEAgAiAFRg0BDAcLIAIgBmosAABBv39MDQYLIA0gAiAGaiAFIAJrIA4oAgwRAgANACAPRQ0BA0AgAyAQLQAAOgAfIANBtwI2AiQgAyADQR9qNgIgIANBATYCPCADQQE2AjQgA0GI+cIANgIwIANBATYCLCADQZD5wgA2AiggAyADQSBqNgI4IA0gDiADQShqEE4NASAQQQFqIRAgD0EBayIPDQALDAELQQEMAwsgA0EIaiADEFwgAygCCCIGDQALCyANQSIgEREAAAsgA0FAayQADAELIAYgBSACIAVB9PjCABD8AgALIAhBIGokAAsMACAAKAIAIAEQzQMLqgEBAX8gACgCACECIwBBEGsiACQAAn8CQAJAAkACQCACLQAAQQFrDgMBAgMACyAAIAJBAWo2AgQgAUGgz8AAQQUgAEEEakGoz8AAEK8BDAMLIAAgAkEEajYCCCABQZzPwABBBCAAQQhqQdjMwAAQrwEMAgsgACACQQRqNgIMIAFB/87AAEENIABBDGpBjM/AABCvAQwBCyABQfjOwABBBxD4AgsgAEEQaiQACwsAIAAoAgAgARB6C44EAQF/IAAoAgAhAiMAQRBrIgAkAAJ/AkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQCACLQAAQQFrDhkBAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZAAsgAUHH0cAAQQIQ+AIMGQsgAUHF0cAAQQIQ+AIMGAsgAUHC0cAAQQMQ+AIMFwsgAUG+0cAAQQQQ+AIMFgsgAUG50cAAQQUQ+AIMFQsgAUG30cAAQQIQ+AIMFAsgAUG00cAAQQMQ+AIMEwsgAUGw0cAAQQQQ+AIMEgsgAUGr0cAAQQUQ+AIMEQsgAUGp0cAAQQIQ+AIMEAsgAUGm0cAAQQMQ+AIMDwsgAUGi0cAAQQQQ+AIMDgsgAUGd0cAAQQUQ+AIMDQsgAUH70MAAQQIQ+AIMDAsgAUH40MAAQQMQ+AIMCwsgAUH00MAAQQQQ+AIMCgsgAUHv0MAAQQUQ+AIMCQsgAUHs0MAAQQMQ+AIMCAsgAUHo0MAAQQQQ+AIMBwsgAUHj0MAAQQUQ+AIMBgsgAUHd0MAAQQYQ+AIMBQsgAUGZ0cAAQQQQ+AIMBAsgAUGU0cAAQQUQ+AIMAwsgAUHX0MAAQQYQ+AIMAgsgAUHQ0MAAQQcQ+AIMAQsgACACQQFqNgIMIAFB/dDAAEEHIABBDGpBhNHAABCvAQsgAEEQaiQAC/EJAQF/IAAoAgAhAiMAQRBrIgAkAAJ/AkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgAi0AAEEBaw4eAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eAAsgACACQQRqNgIAIAAgAkEIajYCBCAAIAJBDGo2AgggACACQRBqNgIMIAFBrvDAAEELQbnwwABBByAAQYjpwABBwPDAAEEHIABBBGpB+OjAAEHH8MAAQQcgAEEIakH46MAAQc7wwABBBSAAQQxqQejowAAQqgEMHgsgAUGe8MAAQRAQ+AIMHQsgAUGR8MAAQQ0Q+AIMHAsgAUH978AAQRQQ+AIMGwsgAUHy78AAQQsQ+AIMGgsgAUHn78AAQQsQ+AIMGQsgAUHX78AAQRAQ+AIMGAsgACACQQFqNgIMIAFByO/AAEEPQaPvwABBBCAAQQxqQejowAAQtQEMFwsgACACQQFqNgIMIAFBv+/AAEEJQaPvwABBBCAAQQxqQejowAAQtQEMFgsgACACQQFqNgIMIAFBtu/AAEEJQaPvwABBBCAAQQxqQejowAAQtQEMFQsgACACQQFqNgIMIAFBp+/AAEEPQaPvwABBBCAAQQxqQejowAAQtQEMFAsgACACQQFqNgIMIAFBle/AAEEOQaPvwABBBCAAQQxqQejowAAQtQEMEwsgACACQQRqNgIIIAAgAkEIajYCDCABQYXvwABBCUGO78AAQQcgAEEIakH46MAAQfruwABBCCAAQQxqQfjowAAQsQEMEgsgACACQQRqNgIIIAAgAkEIajYCDCABQe7uwABBDEH67sAAQQggAEEIakGI6cAAQYLvwABBAyAAQQxqQYjpwAAQsQEMEQsgAUHf7sAAQQ8Q+AIMEAsgACACQQJqNgIIIAAgAkEBajYCDCABQbjuwABBFEHM7sAAQQogAEEIakHk6sAAQdbuwABBCSAAQQxqQdTqwAAQsQEMDwsgACACQQFqNgIMIAFBqO7AAEEQIABBDGpB5OrAABCvAQwOCyAAIAJBAWo2AgwgAUGZ7sAAQQ8gAEEMakGk6cAAEK8BDA0LIAAgAkEBajYCDCABQYnuwABBECAAQQxqQaTpwAAQrwEMDAsgACACQQFqNgIMIAFB+e3AAEEQIABBDGpBpOnAABCvAQwLCyAAIAJBAWo2AgwgAUHr7cAAQQ4gAEEMakGk6cAAEK8BDAoLIAAgAkEBajYCDCABQeDtwABBCyAAQQxqQaTpwAAQrwEMCQsgACACQQFqNgIMIAFBxu3AAEEaIABBDGpBpOnAABCvAQwICyAAIAJBAWo2AgwgAUGu7cAAQRggAEEMakGk6cAAEK8BDAcLIAAgAkEBajYCDCABQZvtwABBEyAAQQxqQaTpwAAQrwEMBgsgACACQQFqNgIMIAFBhe3AAEEWIABBDGpBpOnAABCvAQwFCyABQfTswABBERD4AgwECyAAIAJBAWo2AgwgAUHP7MAAQRJB4ezAAEEDIABBDGpB5OzAABC1AQwDCyABQcDswABBDxD4AgwCCyAAIAJBBGo2AgwgAUGk7MAAQQkgAEEMakGw7MAAEK8BDAELIAAgAkEBajYCDCABQYTswABBDyAAQQxqQZTswAAQrwELIABBEGokAAvIHAEBfyAAKAIAIQIjAEFAaiIAJAACfwJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIAItAABBAWsOHgECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaHhscHQALIAAgAkEIajYCBCAAIAJBDGo2AiAgACACQRBqNgIkIABBFGpBBDYCACAAQRxqQQM2AgAgAEE8akGkATYCACAAQTRqQaUBNgIAIABB7OTAADYCECAAQQA2AgggAEGlATYCLCAAIABBKGo2AhggACAAQSRqNgI4IAAgAEEgajYCMCAAIABBBGo2AiggASAAQQhqEOgBDB4LIABBNGpBATYCACAAQTxqQQA2AgAgAEGs5MAANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDB0LIABBNGpBATYCACAAQTxqQQA2AgAgAEGM5MAANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDBwLIABBNGpBATYCACAAQTxqQQA2AgAgAEHc48AANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDBsLIABBNGpBATYCACAAQTxqQQA2AgAgAEGs48AANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDBoLIABBNGpBATYCACAAQTxqQQA2AgAgAEGQ48AANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDBkLIABBNGpBATYCACAAQTxqQQA2AgAgAEHg4sAANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDBgLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBsOLAADYCMCAAQQA2AiggAEGkATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDoAQwXCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQfzhwAA2AjAgAEEANgIoIABBpAE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6AEMFgsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEHM4cAANgIwIABBADYCKCAAQaQBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOgBDBULIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBnOHAADYCMCAAQQA2AiggAEGkATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDoAQwUCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQeDgwAA2AjAgAEEANgIoIABBpAE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6AEMEwsgACACQQRqNgIgIAAgAkEIajYCJCAAQTRqQQM2AgAgAEE8akECNgIAIABBFGpBpgE2AgAgAEGo4MAANgIwIABBADYCKCAAQaYBNgIMIAAgAEEIajYCOCAAIABBIGo2AhAgACAAQSRqNgIIIAEgAEEoahDoAQwSCyAAIAJBBGo2AiAgACACQQhqNgIkIABBNGpBAzYCACAAQTxqQQI2AgAgAEEUakGnATYCACAAQeTfwAA2AjAgAEEANgIoIABBpwE2AgwgACAAQQhqNgI4IAAgAEEkajYCECAAIABBIGo2AgggASAAQShqEOgBDBELIABBNGpBATYCACAAQTxqQQA2AgAgAEG038AANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDBALIAAgAkECajYCICAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBAjYCACAAQRRqQagBNgIAIABBgN/AADYCMCAAQQA2AiggAEGpATYCDCAAIABBCGo2AjggACAAQSRqNgIQIAAgAEEgajYCCCABIABBKGoQ6AEMDwsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEHE3sAANgIwIABBADYCKCAAQakBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOgBDA4LIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBjN7AADYCMCAAQQA2AiggAEGqATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDoAQwNCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQeDdwAA2AjAgAEEANgIoIABBqgE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6AEMDAsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEG83cAANgIwIABBADYCKCAAQaoBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOgBDAsLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBmN3AADYCMCAAQQA2AiggAEGqATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDoAQwKCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQfTcwAA2AjAgAEEANgIoIABBqgE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6AEMCQsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEHA3MAANgIwIABBADYCKCAAQaoBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOgBDAgLIAAgAkEBajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBkNzAADYCMCAAQQA2AiggAEGqATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDoAQwHCyAAIAJBAWo2AiQgAEE0akECNgIAIABBPGpBATYCACAAQeTbwAA2AjAgAEEANgIoIABBqgE2AgwgACAAQQhqNgI4IAAgAEEkajYCCCABIABBKGoQ6AEMBgsgACACQQFqNgIkIABBNGpBAjYCACAAQTxqQQE2AgAgAEG828AANgIwIABBADYCKCAAQaoBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOgBDAULIABBNGpBATYCACAAQTxqQQA2AgAgAEGY28AANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDAQLIABBNGpBATYCACAAQTxqQQA2AgAgAEH82MAANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDAMLIAAgAkEEajYCJCAAQTRqQQI2AgAgAEE8akEBNgIAIABBuNjAADYCMCAAQQA2AiggAEGrATYCDCAAIABBCGo2AjggACAAQSRqNgIIIAEgAEEoahDoAQwCCwJAAkACQAJAAkACQAJAAkAgAi0AAUEBaw4HAQIDBAUGBwALIABBNGpBATYCACAAQTxqQQA2AgAgAEGs2MAANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDAgLIABBNGpBATYCACAAQTxqQQA2AgAgAEGA2MAANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDAcLIABBNGpBATYCACAAQTxqQQA2AgAgAEHQ18AANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDAYLIABBNGpBATYCACAAQTxqQQA2AgAgAEGo18AANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDAULIABBNGpBATYCACAAQTxqQQA2AgAgAEGA18AANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDAQLIABBNGpBATYCACAAQTxqQQA2AgAgAEHE1sAANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDAMLIABBNGpBATYCACAAQTxqQQA2AgAgAEGI1sAANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDAILIABBNGpBATYCACAAQTxqQQA2AgAgAEG41cAANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDAELIAAgAkEBaiICNgIkIABBNGpBATYCACAAQTxqQQA2AgAgAEGc2cAANgIwIABBsNTAADYCOCAAQQA2AihBASABIABBKGoQ6AENABoCQAJAAkACQCACLQAAIgIOAwECAwALAkACQAJAAkAgAkH8AWsOAwECAwALIABBNGpBAjYCACAAQTxqQQE2AgAgAEG02cAANgIwIABBADYCKCAAQawBNgIMIAAgAEEIajYCOCAAIABBJGo2AgggASAAQShqEOgBDAYLIABBNGpBATYCACAAQTxqQQA2AgAgAEH02sAANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDAULIABBNGpBATYCACAAQTxqQQA2AgAgAEHU2sAANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDAQLIABBNGpBATYCACAAQTxqQQA2AgAgAEGw2sAANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDAMLIABBNGpBATYCACAAQTxqQQA2AgAgAEGQ2sAANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDAILIABBNGpBATYCACAAQTxqQQA2AgAgAEHw2cAANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBDAELIABBNGpBATYCACAAQTxqQQA2AgAgAEHU2cAANgIwIABBsNTAADYCOCAAQQA2AiggASAAQShqEOgBCyAAQUBrJAALDAAgACABKQJANwMAC9ABAQF/IAAoAgAhAiMAQRBrIgAkACAAIAFBqPnAAEEJELwCIAAgAigAACIBNgIIIABBsfnAAEEEIABBCGpBuPnAABBzIAAgAUF/c0EFdkEBcToADEHI+cAAQQggAEEMakHQ+cAAEHMgACABQQ12QQFxOgANQeD5wABBByAAQQ1qQdD5wAAQcyAAIAFBFXZBAXE6AA5B5/nAAEEIIABBDmpB0PnAABBzIAAgAUEddkEBcToAD0Hv+cAAQQggAEEPakHQ+cAAEHMQ1QEgAEEQaiQACzQAIAEgACgCAC0AAEEYdEGAgIAgakEYdUECdCIAQeyVwQBqKAIAIABB0JXBAGooAgAQ+AILCwAgACgCACABEGsLDAAgACgCACABENgCCwwAIAAoAgAgARCZAwsMACAAKAIAIAEQnAMLDAAgACgCACABELwBCw4AIAFBwLTCAEELEPgCCwkAIAAgARAgAAsKACAAKAIEQXhxCwoAIAAoAgRBAXELCgAgACgCDEEBcQsKACAAKAIMQQF2CxoAIAAgAUGck8MAKAIAIgBBmQIgABsRAQAACwoAIAIgACABEEALCwAgACgCACABEH8LDQAgAUH49MIAQQIQQAuvAQEDfyABIQUCQCACQQ9NBEAgACEBDAELIABBACAA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MC9saWJyYXJ5L2FsbG9jL3NyYy9yYXdfdmVjLnJzLAAQAEwAAACqAQAACQAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvYWxsb2Mvc3JjL3ZlYy9tb2QucnOIABAATAAAANQHAAAkAAAAcmVzaXplYSBzZXF1ZW5jZQEAAAAAAAAAAQAAAAIAAAADAAAABAAAAG9uZS10aW1lIGluaXRpYWxpemF0aW9uIG1heSBub3QgYmUgcGVyZm9ybWVkIHJlY3Vyc2l2ZWx5DAEQADgAAABPbmNlIGluc3RhbmNlIGhhcyBwcmV2aW91c2x5IGJlZW4gcG9pc29uZWQAAEwBEAAqAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZS9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvc3RkL3NyYy9zeW5jL29uY2UucnMAqwEQAEwAAACPAAAAMgAAAAEAAAAEAAAABAAAAAUAAAABAAAABAAAAAQAAAAGAAAATWFwQWNjZXNzOjpuZXh0X3ZhbHVlIGNhbGxlZCBiZWZvcmUgbmV4dF9rZXlDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xzZXJkZS0xLjAuMTU5XHNyY1xkZVx2YWx1ZS5yc1QCEABcAAAAyAQAABsAAABzcmNcc2hha2UucnPAAhAADAAAABwAAAAVAAAAAAAAAGF0dGVtcHQgdG8gY2FsY3VsYXRlIHRoZSByZW1haW5kZXIgd2l0aCBhIGRpdmlzb3Igb2YgemVyb2Fzc2VydGlvbiBmYWlsZWQ6IHggYXMgdTY0ICsgd2lkdGggYXMgdTY0IDw9IHNlbGYud2lkdGgoKSBhcyB1NjRDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xpbWFnZS0wLjI0LjZcLi9zcmNcaW1hZ2UucnMAWQMQAFoAAAC9AwAACQAAAGFzc2VydGlvbiBmYWlsZWQ6IHkgYXMgdTY0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AABdAgAAIAAAAEwMEABcAAAAawIAACQAAABMDBAAXAAAAGsCAAARAAAATAwQAFwAAABOAgAAEgAAAEwMEABcAAAAxwEAAB0AAABpbnRlcm5hbCBlcnJvcjogZW50ZXJlZCB1bnJlYWNoYWJsZSBjb2RlOiAAALQOEAAqAAAATAwQAFwAAAARAQAAGAAAAGZhaWxlZCB0byB3cml0ZSB3aG9sZSBidWZmZXL4DhAAHAAAABcAAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcZ2lmLTAuMTIuMFxzcmNcZW5jb2Rlci5yc05FVFNDQVBFMi4wAABLDxAAWAAAABUBAAAmAAAASw8QAFgAAAADAQAAGwAAAEsPEABYAAAA/QAAACYAAABLDxAAWAAAAOUAAAAmAAAAR0lGODlhAABLDxAAWAAAAMQAAAAmAAAAAgAAAAAAAABjaHVua3MgY2Fubm90IGhhdmUgYSBzaXplIG9mIHplcm8AAAAQEBAAIQAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvY29yZS9zcmMvc2xpY2UvbW9kLnJzAAAAPBAQAE0AAABxAwAACQAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGltYWdlcHJvYy0wLjIzLjBcc3JjXGdlb21ldHJpY190cmFuc2Zvcm1hdGlvbnMucnOcEBAAcAAAAIkCAAANAAAAYHVud3JhcF90aHJvd2AgZmFpbGVkAAAAKAAAAAwAAAAEAAAAKQAAACgAAAAMAAAABAAAACoAAAApAAAANBEQACsAAAAsAAAALQAAAC4AAAAvAAAAAAAAAGNodW5rcyBjYW5ub3QgaGF2ZSBhIHNpemUgb2YgemVybwAAAHQREAAhAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9tb2QucnMAAACgERAATQAAAMADAAAJAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcY29uc29sZV9lcnJvcl9wYW5pY19ob29rLTAuMS43XHNyY1xsaWIucnMAEhAAaAAAAJUAAAAOAAAAc3BlZWRoeXBlcnNwZWVkcmV2ZXJzZXJhaW5ib3dyb3RhdGVzcGlucmV2c2xpZGV3aWdnbGVzaGFrZUZhaWxlZCB0byBwYXJzZSBjb21tYW5kczogshIQABoAAABGYWlsZWQgdG8gd3JpdGUgZnJhbWU6IADUEhAAFwAAAGFzc2VydGlvbiBmYWlsZWQ6IG1pZCA8PSBzZWxmLmxlbigpSW1hZ2UgZGltZW5zaW9ucyAoLCApIGFyZSB0b28gbGFyZ2UAABcTEAASAAAAKRMQAAIAAAArExAADwAAADQAAAAMAAAABAAAADUAAAA2AAAANwAAAGEgRGlzcGxheSBpbXBsZW1lbnRhdGlvbiByZXR1cm5lZCBhbiBlcnJvciB1bmV4cGVjdGVkbHkAOAAAAAAAAAABAAAAOQAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvYWxsb2Mvc3JjL3N0cmluZy5ycwC0ExAASwAAAOkJAAAOAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9jb3JlL3NyYy9vcHMvYXJpdGgucnMAAAAQFBAATQAAAOgBAAABAAAAYXR0ZW1wdCB0byBkaXZpZGUgYnkgemVybwAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvY29yZS9zcmMvc2xpY2UvbW9kLnJzAAAAjBQQAE0AAAANDAAACQAAAGFzc2VydGlvbiBmYWlsZWQ6IGsgPD0gc2VsZi5sZW4oKQAAAIwUEABNAAAAOAwAAAkAAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcaW1hZ2UtMC4yNC42XC4vc3JjXGNvZGVjc1xnaWYucnMAAEsVEABfAAAAKwIAADUAAABLFRAAXwAAACICAAAoAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcaW1hZ2UtMC4yNC42XC4vc3JjXGJ1ZmZlci5ycwDMFRAAWwAAALcDAABGAAAASW1hZ2UgaW5kZXggIG91dCBvZiBib3VuZHMgADgWEAAMAAAARBYQAA8AAADMFRAAWwAAALIDAAAVAAAAbWlzc2luZyBmaWVsZCBgYHQWEAAPAAAAgxYQAAEAAAB1bmtub3duIGZpZWxkIGBgLCBleHBlY3RlZCAAlBYQAA8AAACjFhAADAAAAGAsIHRoZXJlIGFyZSBubyBmaWVsZHMAAJQWEAAPAAAAwBYQABYAAAA6AAAAGAEAAAgAAAA7AAAAPAAAAD0AAAA+AAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcZ2lmLTAuMTIuMFxzcmNccmVhZGVyXG1vZC5ycwAEFxAAWwAAAHgBAAAjAAAABBcQAFsAAAB6AQAAGAAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWUABBcQAFsAAACCAQAAKwAAAAQXEABbAAAAgwEAACAAAABubyBjb2xvciB0YWJsZSBhdmFpbGFibGUgZm9yIGN1cnJlbnQgZnJhbWUAAAQXEABbAAAAPwEAACsAAABpbWFnZSB0cnVuY2F0ZWQABBcQAFsAAABEAQAAHAAAAGludGVybmFsIGVycm9yOiBlbnRlcmVkIHVucmVhY2hhYmxlIGNvZGUEFxAAWwAAAO8AAAAVAAAAZmlsZSBkb2VzIG5vdCBjb250YWluIGFueSBpbWFnZSBkYXRhdW5leHBlY3RlZCBFT0YvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L3N0ZC9zcmMvaW8vY3Vyc29yLnJzAACSGBAATAAAAOsAAAAKAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9hbGxvYy9zcmMvc2xpY2UucnMAAPAYEABKAAAAkgAAABEAAABFcnIAPwAAAAQAAAAEAAAAQAAAAE9rAAA/AAAABAAAAAQAAABBAAAAZ2lmcG5nVW5zdXBwb3J0ZWQgZXh0ZW5zaW9uOiAAAAB6GRAAFwAAAEZhaWxlZCB0byBjcmVhdGUgcmVhZGVyOiAAAACcGRAAGQAAAEZhaWxlZCB0byBjb2xsZWN0IGZyYW1lczogAADAGRAAGgAAAEZhaWxlZCB0byBjcmVhdGUgZHluYW1pYyBpbWFnZTog5BkQACAAAABzcmNcdXRpbHMucnMMGhAADAAAADIAAAASAEGwtMAAC8ENYXR0ZW1wdCB0byBkaXZpZGUgYnkgemVybwAAAAwaEAAMAAAAOAAAACAAAAAAAAAAYXR0ZW1wdCB0byBjYWxjdWxhdGUgdGhlIHJlbWFpbmRlciB3aXRoIGEgZGl2aXNvciBvZiB6ZXJvAAAADBoQAAwAAABLAAAAGAAAAAwaEAAMAAAATgAAABgAAAC8GhAAAAAAAEMAAAAEAAAABAAAAEQAAABFAAAARgAAAEkAAAAMAAAABAAAAEoAAABLAAAATAAAAGEgRGlzcGxheSBpbXBsZW1lbnRhdGlvbiByZXR1cm5lZCBhbiBlcnJvciB1bmV4cGVjdGVkbHkATQAAAAAAAAABAAAAOQAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvYWxsb2Mvc3JjL3N0cmluZy5ycwA8GxAASwAAAOkJAAAOAAAAaW52YWxpZCB0eXBlOiAsIGV4cGVjdGVkIAAAAJgbEAAOAAAAphsQAAsAAABjbG9zdXJlIGludm9rZWQgcmVjdXJzaXZlbHkgb3IgYWZ0ZXIgYmVpbmcgZHJvcHBlZAAAc3RydWN0IHZhcmlhbnQAAPgbEAAOAAAAdHVwbGUgdmFyaWFudAAAABAcEAANAAAAbmV3dHlwZSB2YXJpYW50ACgcEAAPAAAAdW5pdCB2YXJpYW50QBwQAAwAAABlbnVtVBwQAAQAAABtYXAAYBwQAAMAAABzZXF1ZW5jZWwcEAAIAAAA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IGNvbXByZXNzaW9uIGZsYWcgaW4gdGhlIGlUWHQgY2h1bmsuAACQKhAAJgAAAFVzaW5nIGEgZmxhZyB0aGF0IGlzIG5vdCAwIG9yIDI1NSBhcyBhIGNvbXByZXNzaW9uIGZsYWcgZm9yIGlUWHQgY2h1bmsuAMAqEABHAAAAVXNpbmcgYW4gdW5yZWNvZ25pemVkIGJ5dGUgYXMgY29tcHJlc3Npb24gbWV0aG9kLgAAABArEAAxAAAAT3V0IG9mIGRlY29tcHJlc3Npb24gc3BhY2UuIFRyeSB3aXRoIGEgbGFyZ2VyIGxpbWl0LkwrEAA0AAAASW52YWxpZCBjb21wcmVzc2VkIHRleHQgZGF0YS4AAACIKxAAHQAAAE5vIG51bGwgc2VwYXJhdG9yIGluIHRFWHQgY2h1bmsusCsQACAAAABLZXl3b3JkIGVtcHR5IG9yIGxvbmdlciB0aGFuIDc5IGJ5dGVzLgAA2CsQACYAAABVbnJlcHJlc2VudGFibGUgZGF0YSBpbiB0RVh0IGNodW5rLgAILBAAIwAAAC4AAAAwKhAAAAAAADQsEAABAAAASURBVCBvciBmREFUIGNodW5rIGlzIGhhcyBub3QgZW5vdWdoIGRhdGEgZm9yIGltYWdlLkgsEAA0AAAAQ29ycnVwdCBkZWZsYXRlIHN0cmVhbS4ghCwQABgAAABFcnJvciBudW1iZXIgAAAApCwQAA0AAAA0LBAAAQAAAEhhcyBtb3JlIG91dHB1dC7ELBAAEAAAAE5lZWRzIG1vcmUgaW5wdXQuAAAA3CwQABEAAABVbmV4cGVjdGVkIGRvbmUgc3RhdHVzLgD4LBAAFwAAAEFkbGVyMzIgY2hlY2tzdW0gZmFpbGVkLhgtEAAYAAAASW52YWxpZCBpbnB1dCBwYXJhbWV0ZXJzLgAAADgtEAAZAAAAVW5leHBlY3RlZCBlbmQgb2YgZGF0YS4AXC0QABcAAABTdWIgZnJhbWUgaXMgb3V0LW9mLWJvdW5kcy4AfC0QABsAAABVbmtub3duIGludGVybGFjZSBtZXRob2QgAAAAoC0QABkAAAA0LBAAAQAAAFVua25vd24gZmlsdGVyIG1ldGhvZCAAAMwtEAAWAAAANCwQAAEAAABVbmtub3duIGNvbXByZXNzaW9uIG1ldGhvZCAA9C0QABsA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c2lvbnMAuAAAAAQAAAAEAAAAvgAAAENodW5rQ29tcGxldGVDaHVua0JlZ2luSGVhZGVyAAAAuAAAAAQAAAAEAAAAqAAAALgAAAAEAAAABAAAAKkAAAC4AAAABAAAAAQAAAC/AAAATm90aGluZ0xpbWl0c0V4Y2VlZGVkUGFyYW1ldGVyAAC4AAAABAAAAAQAAADAAAAARm9ybWF0AAC4AAAABAAAAAQAAADBAAAASW9FcnJvcgC4AAAABAAAAAQAAADCAAAARm9ybWF0RXJyb3Jpbm5lcrgAAAAEAAAABAAAAMMAAABCYWRUZXh0RW5jb2RpbmcAuAAAAAQAAAAEAAAAxAAAAEJhZEZpbHRlcgAAALgAAAAEAAAABAAAAMUAAABOb01vcmVJbWFnZURhdGFDb3JydXB0RmxhdGVTdHJlYW1lcnK4AAAABAAAAAQAAACsAAAAQmFkU3ViRnJhbWVCb3VuZHNVbmtub3duSW50ZXJsYWNlTWV0aG9kVW5rbm93bkZpbHRlck1ldGhvZFVua25vd25Db21wcmVzc2lvbk1ldGhvZEludmFsaWRTcmdiUmVuZGVyaW5nSW50ZW50SW52YWxpZFVuaXRJbnZhbGlkQmxlbmRPcEludmFsaWREaXNwb3NlT3BJbnZhbGlkQ29sb3JUeXBlSW52YWxpZEJpdERlcHRoQ29sb3JXaXRoQmFkVHJuc0ludmFsaWRDb2xvckJpdERlcHRoY29sb3JfdHlwZWJpdF9kZXB0aFBhbGV0dGVSZXF1aXJlZFNob3J0UGFsZXR0ZWV4cGVjdGVkbGVuQXBuZ09yZGVycHJlc2VudER1cGxpY2F0ZUNodW5ra2luZE91dHNpZGVQbHRlSWRhdEFmdGVyUGx0ZUFmdGVySWRhdENodW5rQmVmb3JlSWhkck1pc3NpbmdJbWFnZURhdGFNaXNzaW5nRmN0bE1pc3NpbmdJaGRyVW5leHBlY3RlZEVuZE9mQ2h1bmtVbmV4cGVjdGVkRW9mSW52YWxpZFNpZ25hdHVyZUNyY01pc21hdGNocmVjb3ZlcmNyY192YWxjcmNfc3VtY2h1bmsAaW50ZXJuYWwgZXJyb3I6IGVudGVyZWQgdW5yZWFjaGFibGUgY29kZTogAABUOBAAKgAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHBuZy0wLjE3Ljdcc3JjXGNvbW1vbi5ycwBhdHRlbXB0IHRvIGRpdmlkZSBieSB6ZXJvAAAAiDgQAFcAAABAAAAAHQAAAE5vdCBhIHBvc3NpYmxlIGJ5dGUgcm91bmRlZCBwaXhlbCB3aWR0aAAMORAAJwAAAIg4EABXAAAAXgIAABIAAABFbmQgb2YgaW1hZ2UgaGFzIGJlZW4gcmVhY2hlZAAAAEw5EAAdAAAAd3JvbmcgZGF0YSBzaXplLCBleHBlY3RlZCAgZ290IAB0ORAAGgAAAI45EAAFAAAAUmdiYUdyYXlzY2FsZUFscGhhSW5kZXhlZFJnYkdyYXlzY2FsZVNpeHRlZW5FaWdodEZvdXJUd29PbmVQaXhlbERpbWVuc2lvbnN4cHB1AADHAAAABAAAAAQAAAC5AAAAeXBwdXVuaXTHAAAABAAAAAQAAADIAAAATWV0ZXJVbnNwZWNpZmllZFByZXZpb3VzQmFja2dyb3VuZE5vbmVPdmVyU291cmNlc2VxdWVuY2VfbnVtYmVyd2lkdGhoZWlnaHR4X29mZnNldHlfb2Zmc2V0ZGVsYXlfbnVtZGVsYXlfZGVuZGlzcG9zZV9vcGJsZW5kX29wAABMOhAADwAAAFs6EAAFAAAAYDoQAAYAAABmOhAACAAAAG46EAAIAAAAdjoQAAkAAAB/OhAACQAAAIg6EAAKAAAAkjoQAAgAAADHAAAABAAAAAQAAADJAAAAxwAAAAQAAAAEAAAAygAAAMcAAAAEAAAABAAAAMsAAABGcmFtZUNvbnRyb2xBbmltYXRpb25Db250cm9sbnVtX2ZyYW1lc251bV9wbGF5c1BhcmFtZXRlckVycm9yaW5uZXIAAMcAAAAEAAAABAAAAMwAAABQb2xsZWRBZnRlckVuZE9mSW1hZ2VJbWFnZUJ1ZmZlclNpemVleHBlY3RlZMcAAAAEAAAABAAAALoAAABhY3R1YWwAAAAAAAABAAAAAAAAAAEAAAAAAAAAAwAAAAAAAAABAAAAAAAAAAIAAAAAAAAAAQAAAAAAAAAEAAAAAAAAAAEAAAABAAAAAwAAAAEAAAACAAAAAQAAAAQAAAAAAAAAAgAAAAAAAAABAAAAAAAAAAQAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAwAAAAAAAAABAAAAAAAAAAIAAAABAAAABAAAAAEAAAABAAAAAQAAAAMAAAABAAAADgAAAAkAAAAEAAAACQAAAAkAAAAJAAAAAwAAAAcAAACoORAAwDkQAKQ5EADAORAAwDkQAMA5EAC9ORAAtjkQAENodW5rVHlwZXR5cGUAAADOAAAABAAAAAEAAADPAAAAY3JpdGljYWzOAAAAAQAAAAEAAADQAAAAcHJpdmF0ZXJlc2VydmVkc2FmZWNvcHkAqDwQAAAAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xwbmctMC4xNy43XHNyY1xkZWNvZGVyXHpsaWIucnMAAAAAPRAAXQAAAEgAAAASAAAAAD0QAF0AAACAAAAAFQAAAAA9EABdAAAAjAAAABYAAABObyBtb3JlIGZvcndhcmQgcHJvZ3Jlc3MgbWFkZSBpbiBzdHJlYW0gZGVjb2RpbmcuAAAAAD0QAF0AAACeAAAAFQAAAGFzc2VydGlvbiBmYWlsZWQ6IHN0ZXAgIT0gMC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvY29yZS9zcmMvaXRlci9hZGFwdGVycy9zdGVwX2J5LnJz7z0QAFkAAAAVAAAACQAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHBuZy0wLjE3Ljdcc3JjXGZpbHRlci5yc0ZpbHRlcmluZyBmYWlsZWQ6IGJ5dGVzIHBlciBwaXhlbCBpcyBncmVhdGVyIHRoYW4gbGVuZ3RoIG9mIHJvdwAAWD4QAFcAAACyAAAAHgAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWUAWD4QAFcAAAC4AAAAMAAAAFg+EABXAAAAdwAAAB4AAABYPhAAVwAAAGMAAAA2AAAARmlsdGVyaW5nIGZhaWxlZDogbm90IGVub3VnaCBkYXRhIGluIHByZXZpb3VzIHJvdwAAAFg+EABXAAAAmAAAAA0AAABYPhAAVwAAAJkAAAANAAAAWD4QAFcAAACaAAAADQAAAFg+EABXAAAAmwAAAA0AAABYPhAAVwAAAJwAAAANAAAAWD4QAFcAAACdAAAADQAAAHVucmVhY2hhYmxlANEAAAAIAAAABAAAANIAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xwbmctMC4xNy43XHNyY1x0ZXh0X21ldGFkYXRhLnJzAAAMQBAAXgAAALkAAAAmAAAASW52YWxpZEtleXdvcmRTaXplVW5yZXByZXNlbnRhYmxlTWlzc2luZ0NvbXByZXNzaW9uRmxhZ0ludmFsaWRDb21wcmVzc2lvbkZsYWdJbnZhbGlkQ29tcHJlc3Npb25NZXRob2RPdXRPZkRlY29tcHJlc3Npb25TcGFjZUluZmxhdGlvbkVycm9yTWlzc2luZ051bGxTZXBhcmF0b3IAAA8AAAASAAAAFAAAAA4AAAAXAAAAGAAAABYAAAAWAAAAjkAQAHxAEAAGQRAA+EAQAOFAEADJQBAAs0AQAJ1AEABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xwbmctMC4xNy43XHNyY1x1dGlscy5ycwBBwIPBAAuNB2F0dGVtcHQgdG8gZGl2aWRlIGJ5IHplcm8AAABcQRAAVgAAACQAAAAWAAAAXEEQAFYAAAAlAAAAGgAAAP9DOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xwbmctMC4xNy43XHNyY1xkZWNvZGVyXG1vZC5ycwAAAP1BEABcAAAAmgMAAAkAAAD9QRAAXAAAAKADAAAZAAAAAgAAAAEAAAAEAAAAAQAAAAEAAAABAAAAAwAAAAEAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2FsbG9jL3NyYy92ZWMvbW9kLnJznEIQAEwAAADUBwAAJAAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVj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AABObyBlbmQgY29kZSBpbiBsencgc3RyZWFtAAAACIwQAF8AAACpAgAAIgAAAAiMEABfAAAAhQIAADwAAABpbnZhbGlkIG1pbmltYWwgY29kZSBzaXplAAAACIwQAF8AAAAxAQAAHwAAAAiMEABfAAAATAIAACMAAAB1bmtub3duIGV4dGVudGlvbiBibG9jayBlbmNvdW50ZXJlZGV4cGVjdGVkIGJsb2NrIHRlcm1pbmF0b3Igbm90IGZvdW5kdW5rbm93biBibG9jayB0eXBlIGVuY291bnRlcmVkCIwQAF8AAAD6AQAALwAAAGZyYW1lIGRlc2NyaXB0b3IgaXMgb3V0LW9mLWJvdW5kc3Vuc3VwcG9ydGVkIEdJRiB2ZXJzaW9ubWFsZm9ybWVkIEdJRiBoZWFkZXJjb250cm9sIGV4dGVuc2lvbiBoYXMgd3JvbmcgbGVuZ3RoRGVjb2RpbmdGb3JtYXRFcnJvcnVuZGVybHlpbmcA4wAAAAQAAAAEAAAA5AAAAElvAADjAAAABAAAAAQAAADlAAAARm9ybWF0AADjAAAABAAAAAQAAADmAAAAY2Fubm90IGFjY2VzcyBhIFRocmVhZCBMb2NhbCBTdG9yYWdlIHZhbHVlIGR1cmluZyBvciBhZnRlciBkZXN0cnVjdGlvbgAA5wAAAAAAAAABAAAA6AAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvc3RkL3NyYy90aHJlYWQvbG9jYWwucnMAGI8QAE8AAACmAQAAGgAAAOkAAAAIAAAABAAAAOoAAABhc3NlcnRpb24gZmFpbGVkOiBwaXhlbC5sZW4oKSA9PSA0QzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcY29sb3JfcXVhbnQtMS4xLjBcc3JjXGxpYi5ycwAAAKqPEABbAAAAugAAAAkAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xnaWYtMC4xMi4wXHNyY1xjb21tb24ucnMAGJAQAFcAAAD1AAAAIgAAABiQEABXAAAA9QAAACwAAAAYkBAAVwAAAPUAAAA2AAAAGJAQAFcAAAD1AAAAQAAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWUAGJAQAFcAAAD1AAAASwAAAOsAAAAIAAAABAAAAOwAAADtAAAA7gAAAAwAAAAEAAAAKQAAAO4AAAAMAAAABAAAACoAAAApAAAAAJEQAO8AAADwAAAALQAAAPEAAADyAAAAY2FwYWNpdHkgb3ZlcmZsb3cAAAA8kRAAEQAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvYWxsb2Mvc3JjL3ZlYy9zcGVjX2Zyb21faXRlcl9uZXN0ZWQucnMAAFiREABeAAAAOwAAABIAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL2l0ZXIucnMAAMiREABOAAAAVQcAABEAQbCkwgAL8jJhdHRlbXB0IHRvIGRpdmlkZSBieSB6ZXJvSW5kZXggb3V0IG9mIGJvdW5kc0mSEAATAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9jb3JlL3NyYy9zbGljZS9zb3J0LnJzAABkkhAATgAAAMsEAAAVAAAAZJIQAE4AAADZBAAAHgAAAGSSEABOAAAA4gQAABgAAABkkhAATgAAAOcEAAAcAAAAVG9vIG11Y2ggb3IgdG9vIGxpdHRsZSBwaXhlbCBkYXRhIGZvciB0aGUgZ2l2ZW4gd2lkdGggYW5kIGhlaWdodCB0byBjcmVhdGUgYSBHSUYgRnJhbWUAAPSSEABWAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcZ2lmLTAuMTIuMFxzcmNcY29tbW9uLnJzAFSTEABXAAAA0AAAAAkAAABzcGVlZCBuZWVkcyB0byBiZSBpbiB0aGUgcmFuZ2UgWzEsIDMwXQAAVJMQAFcAAADRAAAACQAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBg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b3JvdXQgb2YgbWVtb3J5dW5leHBlY3RlZCBlbmQgb2YgZmlsZXVuc3VwcG9ydGVkb3BlcmF0aW9uIGludGVycnVwdGVkYXJndW1lbnQgbGlzdCB0b28gbG9uZ2ludmFsaWQgZmlsZW5hbWV0b28gbWFueSBsaW5rc2Nyb3NzLWRldmljZSBsaW5rIG9yIHJlbmFtZWRlYWRsb2NrZXhlY3V0YWJsZSBmaWxlIGJ1c3lyZXNvdXJjZSBidXN5ZmlsZSB0b28gbGFyZ2VmaWxlc3lzdGVtIHF1b3RhIGV4Y2VlZGVkc2VlayBvbiB1bnNlZWthYmxlIGZpbGVubyBzdG9yYWdlIHNwYWNld3JpdGUgemVyb3RpbWVkIG91dGludmFsaWQgZGF0YWludmFsaWQgaW5wdXQgcGFyYW1ldGVyc3RhbGUgbmV0d29yayBmaWxlIGhhbmRsZWZpbGVzeXN0ZW0gbG9vcCBvciBpbmRpcmVjdGlvbiBsaW1pdCAoZS5nLiBzeW1saW5rIGxvb3ApcmVhZC1vbmx5IGZpbGVzeXN0ZW0gb3Igc3RvcmFnZSBtZWRpdW1kaXJlY3Rvcnkgbm90IGVtcHR5aXMgYSBkaXJlY3Rvcnlub3QgYSBkaXJlY3RvcnlvcGVyYXRpb24gd291bGQgYmxvY2tlbnRpdHkgYWxyZWFkeSBleGlzdHNicm9rZW4gcGlwZW5ldHdvcmsgZG93bmFkZHJlc3Mgbm90IGF2YWlsYWJsZWFkZHJlc3MgaW4gdXNlbm90IGNvbm5lY3RlZGNvbm5lY3Rpb24gYWJvcnRlZG5ldHdvcmsgdW5yZWFjaGFibGVob3N0IHVucmVhY2hhYmxlY29ubmVjdGlvbiByZXNldGNvbm5lY3Rpb24gcmVmdXNlZHBlcm1pc3Npb24gZGVuaWVkZW50aXR5IG5vdCBmb3VuZEVycm9ya2luZAAAGgEAAAEAAAABAAAAHgEAAG1lc3NhZ2UAGgEAAAgAAAAEAAAAHwEAAEtpbmRPc2NvZGUAABoBAAAEAAAABAAAACABAAAhAQAADAAAAAQAAAAiAQAAIChvcyBlcnJvciApRJ4QAAAAAADQoRAACwAAANuhEAABAAAAbWVtb3J5IGFsbG9jYXRpb24gb2YgIGJ5dGVzIGZhaWxlZAAA9KEQABUAAAAJohAADQAAAGxpYnJhcnkvc3RkL3NyYy9hbGxvYy5ycyiiEAAYAAAAVQEAAAkAAABjYW5ub3QgbW9kaWZ5IHRoZSBwYW5pYyBob29rIGZyb20gYSBwYW5pY2tpbmcgdGhyZWFkUKIQADQAAABsaWJyYXJ5L3N0ZC9zcmMvcGFuaWNraW5nLnJzjKIQABwAAACGAAAACQAAAIyiEAAcAAAAPgIAAB4AAACMohAAHAAAAD0CAAAfAAAAIQEAAAwAAAAEAAAAIwEAABoBAAAIAAAABAAAACQBAAAlAQAAEAAAAAQAAAAmAQAAJwEAABoBAAAIAAAABAAAACgBAAApAQAAGgEAAAAAAAABAAAAKgEAAFVuc3VwcG9ydGVkABoBAAAEAAAABAAAACsBAABDdXN0b21lcnJvcgAaAQAABAAAAAQAAAAsAQAAVW5jYXRlZ29yaXplZE90aGVyT3V0T2ZNZW1vcnlVbmV4cGVjdGVkRW9mSW50ZXJydXB0ZWRBcmd1bWVudExpc3RUb29Mb25nSW52YWxpZEZpbGVuYW1lVG9vTWFueUxpbmtzQ3Jvc3Nlc0RldmljZXNEZWFkbG9ja0V4ZWN1dGFibGVGaWxlQnVzeVJlc291cmNlQnVzeUZpbGVUb29MYXJnZUZpbGVzeXN0ZW1RdW90YUV4Y2VlZGVkTm90U2Vla2FibGVTdG9yYWdlRnVsbFdyaXRlWmVyb1RpbWVkT3V0SW52YWxpZERhdGFJbnZhbGlkSW5wdXRTdGFsZU5ldHdvcmtGaWxlSGFuZGxlRmlsZXN5c3RlbUxvb3BSZWFkT25seUZpbGVzeXN0ZW1EaXJlY3RvcnlOb3RFbXB0eUlzQURpcmVjdG9yeU5vdEFEaXJlY3RvcnlXb3VsZEJsb2NrQWxyZWFkeUV4aXN0c0Jyb2tlblBpcGVOZXR3b3JrRG93bkFkZHJOb3RBdmFpbGFibGVBZGRySW5Vc2VOb3RDb25uZWN0ZWRDb25uZWN0aW9uQWJvcnRlZE5ldHdvcmtVbnJlYWNoYWJsZUhvc3RVbnJlYWNoYWJsZUNvbm5lY3Rpb25SZXNldENvbm5lY3Rpb25SZWZ1c2VkUGVybWlzc2lvbkRlbmllZE5vdEZvdW5kb3BlcmF0aW9uIHN1Y2Nlc3NmdWwADgAAABAAAAAWAAAAFQAAAAsAAAAWAAAA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',
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
