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

function setLogger(pluginName) {
    Logger = new LoggerClass(pluginName);
}

class LoggerClass {
    pluginName;
    constructor(pluginName) {
        this.pluginName = pluginName;
    }
    debug(...args) {
        console.debug(this.pluginName, ...args);
    }
    info(...args) {
        console.info(this.pluginName, ...args);
    }
    warn(...args) {
        console.warn(this.pluginName, ...args);
    }
    error(...args) {
        console.error(this.pluginName, ...args);
    }
}

let Logger;

class RawPlugin {
    meta;
    constructor(meta) {
        this.meta = meta;
        setLogger(meta.name);
    }
    start() {
        this.showLibraryMissingModal();
    }
    showLibraryMissingModal() {
        BdApi.UI.showConfirmationModal('Library Missing', `The library plugin needed for ${this.meta.name} is missing. ` + 'Please click Download Now to install it.', {
            confirmText: 'Download Now',
            cancelText: 'Cancel',
            onConfirm: () => {
                request.get('https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js', undefined, ((error, _response, body) => {
                    if (error !== undefined && error !== null) {
                        electron.shell.openExternal('https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi' + '/BDPluginLibrary/master/release/0PluginLibrary.plugin.js').catch((error => {
                            Logger.error(error);
                        }));
                        return;
                    }
                    fs.writeFile(path.join(BdApi.Plugins.folder, '0PluginLibrary.plugin.js'), body, (() => {}));
                }));
            }
        });
    }
    stop() {}
}

function changeDraftPatch(pluginName, attachService, completionsService, emoteService, modulesService) {
    BdApi.Patcher.before(pluginName, modulesService.draft, 'changeDraft', ((_, args) => onChangeDraft(args, attachService, completionsService, emoteService)));
}

function onChangeDraft(args, attachService, completionsService, emoteService) {
    const channelId = args[0];
    if (channelId !== undefined) attachService.setCanAttach(channelId);
    if (!attachService.canAttach) return;
    const draft = args[1];
    if (draft === undefined) return;
    completionsService.draft = draft;
    try {
        const lastText = completionsService.cached?.draft;
        if (!emoteService.shouldCompleteEmote(draft) && !emoteService.shouldCompleteCommand(draft)) {
            completionsService.destroyCompletions();
            return;
        }
        if (lastText !== draft) {
            completionsService.renderCompletions();
        }
    } catch (err) {
        Logger.warn('Error in onChangeDraft', err);
    }
}

function pendingReplyPatch(pluginName, attachService, modulesService) {
    const pendingReplyDispatcher = modulesService.pendingReplyDispatcher;
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
    const setPendingReplyShouldMention = pendingReplyDispatcher.setPendingReplyShouldMentionKey;
    if (setPendingReplyShouldMention === undefined) {
        Logger.warn('Set pending reply should mention function name not found');
        return;
    }
    BdApi.Patcher.before(pluginName, pendingReplyDispatcher.module, createPendingReply, ((_, args) => {
        if (!args[0]) return;
        const reply = args[0];
        attachService.pendingReply = reply;
    }));
    BdApi.Patcher.instead(pluginName, pendingReplyDispatcher.module, deletePendingReply, ((_, args, original) => onDeletePendingReply(args, original, attachService)));
    BdApi.Patcher.before(pluginName, pendingReplyDispatcher.module, setPendingReplyShouldMention, ((_, args) => {
        if (typeof args[0] !== 'string' || typeof args[1] !== 'boolean') return;
        const channelId = args[0];
        const shouldMention = args[1];
        if (attachService.pendingReply?.channel.id !== channelId) return;
        attachService.pendingReply.shouldMention = shouldMention;
    }));
}

async function onDeletePendingReply(args, original, attachService) {
    const callDefault = original;
    try {
        if (attachService.pendingUpload) await attachService.pendingUpload;
        callDefault(...args);
    } catch (err) {
        Logger.warn('Error in onDeletePendingReply', err);
    } finally {
        attachService.pendingReply = undefined;
    }
}

function emojiSearchPatch(pluginName, attachService, modulesService) {
    BdApi.Patcher.after(pluginName, modulesService.emojiSearch, 'search', ((_, _2, result) => onEmojiSearch(result, attachService)));
}

function onEmojiSearch(result, attachService) {
    if (!attachService.canAttach) return;
    const searchResult = result;
    searchResult.unlocked.push(...searchResult.locked);
    searchResult.locked = [];
}

function lockedEmojisPatch(pluginName, attachService, modulesService) {
    const emojiStore = modulesService.emojiStore;
    BdApi.Patcher.after(pluginName, emojiStore, 'getEmojiUnavailableReason', ((_, args, result) => onGetEmojiUnavailableReason(args, result, attachService, modulesService)));
    BdApi.Patcher.after(pluginName, emojiStore, 'isEmojiDisabled', ((_, args) => onIsEmojiDisabled(args, emojiStore)));
}

function onGetEmojiUnavailableReason(args, result, attachService, modulesService) {
    if (!attachService.canAttach) return result;
    const EmojiDisabledReasons = modulesService.emojiDisabledReasons;
    const options = args[0];
    const isReactIntention = options?.intention === 0;
    if (isReactIntention) return result;
    if (result === EmojiDisabledReasons.DISALLOW_EXTERNAL) {
        const emojiId = options?.emoji?.id;
        if (emojiId === undefined) return result;
        attachService.externalEmotes.add(emojiId);
        result = null;
    } else if (result === EmojiDisabledReasons.PREMIUM_LOCKED || result === EmojiDisabledReasons.GUILD_SUBSCRIPTION_UNAVAILABLE) {
        result = null;
    }
    return result;
}

function onIsEmojiDisabled(args, emojiStore) {
    const [emoji, channel, intention] = args;
    const reason = emojiStore.getEmojiUnavailableReason({
        emoji,
        channel,
        intention
    });
    return reason !== null;
}

const PLUGIN_CHANGELOG = [ {
    title: '1.13.1',
    type: 'fixed',
    items: [ 'Fix emote upload not working', 'Fix emotes with reply always pinging even when turned off', 'Fix emotes not working in threads when using split view' ]
}, {
    title: '1.13.0',
    type: 'added',
    items: [ 'It\'s now possible to add custom emotes directly from your PC instead of entering a URL', 'Allow uploading images to channels that don\'t allow external emotes', 'Emotes are now shown as disabled in the reactions menu, as they cannot be used for reacting' ]
}, {
    title: '1.13.0',
    type: 'fixed',
    items: [ 'Custom emote menu no longer shows broken emotes from the standard set', 'Custom emotes starting with numbers or containing spaces can now be removed' ]
} ];

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
    showStandardEmotes: true
};

function urlGetBuffer(url) {
    if (url.startsWith('http')) return httpsGetBuffer(url); else return fsGetBuffer(url);
}

async function fsGetBuffer(url) {
    const data = fs.readFileSync(url, '');
    return await Promise.resolve(buffer.Buffer.from(data));
}

function httpsGetBuffer(url) {
    return new Promise(((resolve, reject) => {
        https.get(url, (res => {
            const buffers = [];
            res.on('data', (chunk => {
                buffers.push(chunk);
            }));
            res.on('end', (() => {
                const statusCode = res.statusCode ?? 0;
                if (statusCode !== 0 && (statusCode < 200 || statusCode >= 400)) {
                    reject(new Error(res.statusMessage));
                    return;
                }
                resolve(buffer.Buffer.concat(buffers));
            }));
        })).on('error', (error => {
            reject(error);
        }));
    }));
}

async function loadImagePromise(url, waitForLoad = true, element) {
    const image = element ?? new Image;
    const loadPromise = new Promise(((resolve, reject) => {
        image.onload = () => {
            resolve();
        };
        image.onerror = () => {
            reject(new Error(`Failed to load image for url ${url}`));
        };
    }));
    if (url.startsWith('http') && !waitForLoad) {
        image.src = url;
    } else {
        const buffer = await urlGetBuffer(url);
        image.src = URL.createObjectURL(new Blob([ buffer ]));
    }
    if (waitForLoad) await loadPromise;
    return image;
}

function delay(duration) {
    return new Promise((resolve => {
        setTimeout((() => {
            resolve();
        }), duration);
    }));
}

class BaseService {
    plugin;
    zeresPluginLibrary;
    constructor(plugin, zeresPluginLibrary) {
        this.plugin = plugin;
        this.zeresPluginLibrary = zeresPluginLibrary;
    }
}

class CompletionsService extends BaseService {
    static TAG=CompletionsService.name;
    static TEXTAREA_KEYDOWN_LISTENER='textAreaKeydown';
    static TEXTAREA_WHEEL_LISTENER='textAreaWheel';
    static TEXTAREA_FOCUS_LISTENER='textAreaFocus';
    static TEXTAREA_BLUR_LISTENER='textAreaBlur';
    static AUTOCOMPLETE_DIV_WHEEL_LISTENER='autocompleteDivWheel';
    static EMOTE_ROW_MOUSEENTER_LISTENER='emoteRowMouseenter';
    static EMOTE_ROW_MOUSEDOWN_LISTENER='emoteRowMousedown';
    emoteService;
    settingsService;
    modulesService;
    listenersService;
    htmlService;
    attachService;
    draft='';
    cached;
    curEditor;
    start(emoteService, settingsService, modulesService, listenersService, htmlService, attachService) {
        this.emoteService = emoteService;
        this.settingsService = settingsService;
        this.modulesService = modulesService;
        this.listenersService = listenersService;
        this.htmlService = htmlService;
        this.attachService = attachService;
        this.listenersService.addListenersWatchers[CompletionsService.TAG] = {
            onAddListeners: () => {
                this.addListeners();
            }
        };
        this.addListeners();
        return Promise.resolve();
    }
    addListeners() {
        const editors = this.htmlService.getEditors();
        if (editors.length === 0) return;
        this.curEditor = editors[0];
        this.listenersService.removeListeners(CompletionsService.TEXTAREA_KEYDOWN_LISTENER);
        this.listenersService.removeListeners(CompletionsService.TEXTAREA_WHEEL_LISTENER);
        this.listenersService.removeListeners(CompletionsService.TEXTAREA_FOCUS_LISTENER);
        this.listenersService.removeListeners(CompletionsService.TEXTAREA_BLUR_LISTENER);
        editors.forEach(((editor, index) => {
            const focusListener = {
                element: editor,
                name: 'focus',
                callback: () => {
                    this.curEditor = editor;
                }
            };
            editor.addEventListener(focusListener.name, focusListener.callback);
            this.listenersService.addListener(`${CompletionsService.TEXTAREA_FOCUS_LISTENER}${index}`, focusListener);
            const blurListener = {
                element: editor,
                name: 'blur',
                callback: () => {
                    this.destroyCompletions();
                    this.curEditor = undefined;
                }
            };
            editor.addEventListener(blurListener.name, blurListener.callback);
            this.listenersService.addListener(`${CompletionsService.TEXTAREA_BLUR_LISTENER}${index}`, blurListener);
            const textArea = this.htmlService.getTextAreaField(editor);
            if (!textArea) return;
            const keydownListener = {
                element: textArea,
                name: 'keydown',
                callback: evt => {
                    this.browseCompletions(evt);
                }
            };
            textArea.addEventListener(keydownListener.name, keydownListener.callback);
            this.listenersService.addListener(`${CompletionsService.TEXTAREA_KEYDOWN_LISTENER}${index}`, keydownListener);
            const wheelListener = {
                element: textArea,
                name: 'wheel',
                callback: evt => {
                    this.scrollCompletions(evt);
                }
            };
            textArea.addEventListener(wheelListener.name, wheelListener.callback);
            this.listenersService.addListener(`${CompletionsService.TEXTAREA_WHEEL_LISTENER}${index}`, wheelListener);
        }));
    }
    browseCompletions(event) {
        if (!this.emoteService.shouldCompleteEmote(this.draft) && !this.emoteService.shouldCompleteCommand(this.draft)) {
            return;
        }
        let delta = 0, options;
        const autocompleteItems = Math.round(this.settingsService.settings.autocompleteItems);
        switch (event.which) {
          case 9:
          case 13:
            if (!this.prepareCompletions()) {
                break;
            }
            event.stopPropagation();
            event.preventDefault();
            this.insertSelectedCompletion().catch(console.error);
            break;

          case 38:
            delta = -1;
            break;

          case 40:
            delta = 1;
            break;

          case 33:
            delta = -autocompleteItems;
            options = {
                locked: true,
                clamped: true
            };
            break;

          case 34:
            delta = autocompleteItems;
            options = {
                locked: true,
                clamped: true
            };
            break;
        }
        if (delta !== 0 && this.prepareCompletions()) {
            event.stopPropagation();
            event.preventDefault();
            this.scrollWindow(delta, options);
        }
    }
    prepareCompletions() {
        const candidateText = this.draft;
        const lastText = this.cached?.candidateText;
        if (lastText !== candidateText) {
            if (this.emoteService.shouldCompleteEmote(candidateText)) {
                const {completions, matchText, matchStart} = this.emoteService.getCompletionsEmote(candidateText);
                this.cached = {
                    candidateText,
                    completions,
                    matchText,
                    matchStart,
                    selectedIndex: 0,
                    windowOffset: 0
                };
            } else if (this.emoteService.shouldCompleteCommand(candidateText)) {
                const {completions, matchText, matchStart} = this.emoteService.getCompletionsCommands(candidateText);
                this.cached = {
                    candidateText,
                    completions,
                    matchText,
                    matchStart,
                    selectedIndex: 0,
                    windowOffset: 0
                };
            }
        }
        const {completions} = this.cached ?? {};
        return completions !== undefined && completions.length !== 0;
    }
    async insertSelectedCompletion() {
        const {completions, matchText, selectedIndex} = this.cached ?? {};
        const curDraft = this.draft;
        const matchTextLength = matchText?.length ?? 0;
        const channelId = this.attachService.curChannelId;
        if (completions === undefined || selectedIndex === undefined || channelId === undefined) {
            return;
        }
        this.modulesService.draft.clearDraft(channelId, 0);
        await delay(100);
        const selectedCompletion = completions[selectedIndex];
        if (!selectedCompletion) return;
        const completionValueArguments = typeof selectedCompletion.data === 'string' ? undefined : selectedCompletion.data.arguments;
        let suffix = ' ';
        if (completionValueArguments) {
            const argumentOptional = completionValueArguments.some((argument => argument === ''));
            if (!argumentOptional) suffix = '-';
        }
        selectedCompletion.name += suffix;
        const newDraft = curDraft.substring(0, curDraft.length - matchTextLength);
        this.destroyCompletions();
        await delay(0);
        this.modulesService.componentDispatcher.dispatchToLastSubscribed('INSERT_TEXT', {
            plainText: newDraft + selectedCompletion.name
        });
    }
    destroyCompletions() {
        const textAreaContainer = this.htmlService.getTextAreaContainer(this.curEditor);
        if (textAreaContainer) {
            const completions = this.htmlService.getTextAreaContainer(this.curEditor)?.querySelectorAll(`.${this.plugin.meta.name}`);
            completions?.forEach((completion => {
                completion.remove();
            }));
        }
        this.cached = undefined;
        this.renderCompletions.cancel();
    }
    renderCompletions=_.debounce((() => {
        const channelTextArea = this.htmlService.getTextAreaContainer(this.curEditor);
        if (!channelTextArea) return;
        const oldAutoComplete = channelTextArea?.querySelectorAll(`.${this.plugin.meta.name}`) ?? [];
        const discordClasses = this.modulesService.classes;
        const isEmote = this.emoteService.shouldCompleteEmote(this.draft);
        for (const autoComplete of oldAutoComplete) {
            autoComplete.remove();
        }
        if (!this.emoteService.shouldCompleteEmote(this.draft) && !this.emoteService.shouldCompleteCommand(this.draft) || !this.prepareCompletions()) {
            return;
        }
        const {completions, matchText, selectedIndex} = this.cached ?? {};
        const firstIndex = this.cached?.windowOffset ?? 0;
        const matchList = completions?.slice(firstIndex, firstIndex + Math.round(this.settingsService.settings.autocompleteItems));
        const autocompleteDiv = document.createElement('div');
        this.htmlService.addClasses(autocompleteDiv, discordClasses.Autocomplete.autocomplete, this.plugin.meta.name);
        const autocompleteListener = {
            element: autocompleteDiv,
            name: 'wheel',
            callback: evt => {
                this.scrollCompletions(evt, {
                    locked: true
                });
            }
        };
        autocompleteDiv.addEventListener(autocompleteListener.name, autocompleteListener.callback);
        this.listenersService.addListener(CompletionsService.AUTOCOMPLETE_DIV_WHEEL_LISTENER, autocompleteListener);
        channelTextArea.append(autocompleteDiv);
        const autocompleteInnerDiv = document.createElement('div');
        this.htmlService.addClasses(autocompleteInnerDiv, discordClasses.Autocomplete.autocompleteInner);
        autocompleteDiv.append(autocompleteInnerDiv);
        const titleRow = document.createElement('div');
        this.htmlService.addClasses(titleRow, discordClasses.Autocomplete.autocompleteRowVertical);
        autocompleteInnerDiv.append(titleRow);
        const selector = document.createElement('div');
        this.htmlService.addClasses(selector, discordClasses.Autocomplete.base);
        titleRow.append(selector);
        const contentTitle = document.createElement('h3');
        this.htmlService.addClasses(contentTitle, discordClasses.Autocomplete.contentTitle, discordClasses.Wrapper.base, discordClasses.Size.size12);
        contentTitle.innerText = isEmote ? 'Emoji matching ' : 'Commands ';
        selector.append(contentTitle);
        const matchTextElement = document.createElement('strong');
        matchTextElement.textContent = matchText ?? '';
        contentTitle.append(matchTextElement);
        for (const [index, {name, data}] of matchList?.entries() ?? []) {
            const emoteRow = document.createElement('div');
            emoteRow.setAttribute('aria-disabled', 'false');
            this.htmlService.addClasses(emoteRow, discordClasses.Autocomplete.clickable, discordClasses.Autocomplete.autocompleteRowVertical, discordClasses.Autocomplete.autocompleteRowVerticalSmall);
            const mouseEnterListener = {
                element: emoteRow,
                name: 'mouseenter',
                callback: () => {
                    if (!this.cached) this.cached = {};
                    this.cached.selectedIndex = index + firstIndex;
                    for (const child of titleRow.parentElement?.children ?? []) {
                        child.setAttribute('aria-selected', 'false');
                        for (const nestedChild of child.children) {
                            this.htmlService.addClasses(nestedChild, discordClasses.Autocomplete.base);
                        }
                    }
                }
            };
            emoteRow.addEventListener(mouseEnterListener.name, mouseEnterListener.callback);
            this.listenersService.addListener(`${CompletionsService.EMOTE_ROW_MOUSEENTER_LISTENER}${index}`, mouseEnterListener);
            const mouseDownListener = {
                element: emoteRow,
                name: 'mousedown',
                callback: evt => {
                    evt.preventDefault();
                    if (!this.cached) this.cached = {};
                    this.cached.selectedIndex = index + firstIndex;
                    this.insertSelectedCompletion().catch(console.error);
                }
            };
            emoteRow.addEventListener(mouseDownListener.name, mouseDownListener.callback);
            this.listenersService.addListener(`${CompletionsService.EMOTE_ROW_MOUSEDOWN_LISTENER}${index}`, mouseDownListener);
            autocompleteInnerDiv.append(emoteRow);
            const emoteSelector = document.createElement('div');
            this.htmlService.addClasses(emoteSelector, discordClasses.Autocomplete.base);
            emoteRow.append(emoteSelector);
            if (index + firstIndex === selectedIndex) {
                emoteRow.setAttribute('aria-selected', 'true');
            }
            const emoteContainer = document.createElement('div');
            this.htmlService.addClasses(emoteContainer, discordClasses.Autocomplete.autocompleteRowContent);
            emoteSelector.append(emoteContainer);
            if (isEmote) {
                const containerIcon = document.createElement('div');
                this.htmlService.addClasses(containerIcon, discordClasses.Autocomplete.autocompleteRowIcon);
                emoteContainer.append(containerIcon);
                const settingsAutocompleteEmoteSize = this.settingsService.settings.autocompleteEmoteSize;
                const containerImage = document.createElement('img');
                containerImage.alt = name;
                containerImage.title = name;
                containerImage.style.minWidth = `${Math.round(settingsAutocompleteEmoteSize)}px`;
                containerImage.style.minHeight = `${Math.round(settingsAutocompleteEmoteSize)}px`;
                containerImage.style.width = `${Math.round(settingsAutocompleteEmoteSize)}px`;
                containerImage.style.height = `${Math.round(settingsAutocompleteEmoteSize)}px`;
                this.htmlService.addClasses(containerImage, discordClasses.Autocomplete.emojiImage);
                containerIcon.append(containerImage);
                if (typeof data === 'string') {
                    loadImagePromise(data, false, containerImage).catch(console.error);
                }
            }
            const containerContent = document.createElement('div');
            containerContent.style.color = 'var(--interactive-active)';
            this.htmlService.addClasses(containerContent, discordClasses.Autocomplete.autocompleteRowContentPrimary);
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
    }), 250);
    scrollCompletions(e, options) {
        const delta = Math.sign(e.deltaY);
        this.scrollWindow(delta, options);
    }
    scrollWindow(delta, {locked = false, clamped = false} = {}) {
        if (!this.cached) return;
        const preScroll = 2;
        const {completions, selectedIndex: prevSel, windowOffset} = this.cached;
        const autocompleteItems = Math.round(this.settingsService.settings.autocompleteItems);
        if (!completions) {
            return;
        }
        const num = completions.length;
        let sel = (prevSel ?? 0) + delta;
        if (clamped) {
            sel = _.clamp(sel, 0, num - 1);
        } else {
            sel = sel % num + (sel < 0 ? num : 0);
        }
        this.cached.selectedIndex = sel;
        const boundLower = _.clamp(sel + preScroll - (autocompleteItems - 1), 0, num - autocompleteItems);
        const boundUpper = _.clamp(sel - preScroll, 0, num - autocompleteItems);
        this.cached.windowOffset = _.clamp((windowOffset ?? 0) + (locked ? delta : 0), boundLower, boundUpper);
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
    modifiers=[];
    start(listenersService, settingsService, htmlService) {
        this.listenersService = listenersService;
        this.settingsService = settingsService;
        this.htmlService = htmlService;
        this.initEmotes();
        return Promise.resolve();
    }
    initEmotes() {
        Promise.all([ this.getEmoteNames(), this.getModifiers() ]).then((([emoteNames, modifiers]) => {
            this.setEmoteNames(emoteNames);
            this.modifiers = modifiers;
            if (this.htmlService.getEditors().length > 0) {
                this.listenersService.requestAddListeners(CompletionsService.TAG);
            }
        })).catch((error => {
            Logger.warn('Failed to get emote names and/or modifiers', error);
        }));
    }
    refreshEmotes() {
        this.emoteNames = undefined;
        BdApi.showToast('Reloading emote database...', {
            type: 'info'
        });
        this.getEmoteNames().then((names => {
            this.setEmoteNames(names);
            BdApi.showToast('Emote database reloaded!', {
                type: 'success'
            });
        })).catch((error => {
            Logger.warn('Failed to get emote names', error);
        }));
    }
    async getEmoteNames() {
        if (!this.settingsService.settings.showStandardEmotes) {
            return {};
        }
        const data = await urlGetBuffer('https://raw.githubusercontent.com/Yentis/yentis.github.io/master/emotes/emotes.json');
        const emoteNames = JSON.parse(data.toString());
        Object.keys(emoteNames).forEach((key => {
            const split = emoteNames[key]?.split('.');
            const [name, extension] = split ?? [];
            delete emoteNames[key];
            if (name === undefined || extension === undefined) return;
            emoteNames[name] = 'https://raw.githubusercontent.com/Yentis/yentis.github.io/master/emotes' + `/images/${key}.${extension}`;
        }));
        return emoteNames;
    }
    setEmoteNames(emoteNames) {
        const customEmotes = {};
        Object.entries(this.settingsService.settings.customEmotes).forEach((([name, url]) => {
            customEmotes[this.getPrefixedName(name)] = url;
        }));
        const standardNames = {};
        Object.entries(emoteNames).forEach((([name, url]) => {
            const prefixedName = this.getPrefixedName(name);
            standardNames[prefixedName] = url;
        }));
        this.emoteNames = {
            ...standardNames,
            ...customEmotes
        };
    }
    async getModifiers() {
        const data = await urlGetBuffer('https://raw.githubusercontent.com/Yentis/betterdiscord-emotereplacer/master/modifiers.json');
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
        const prefix = this.settingsService.settings.requirePrefix ? this.escapeRegExp(this.settingsService.settings.prefix) : '';
        return new RegExp('(?:^|\\s)' + prefix + '\\w{2,}$').test(input);
    }
    shouldCompleteCommand(input) {
        return this.getRegexCommand().test(input);
    }
    escapeRegExp(input) {
        return input.replace(/[-\\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }
    getRegexCommand() {
        const prefix = this.settingsService.settings.requirePrefix ? this.escapeRegExp(this.settingsService.settings.prefix) : '';
        return new RegExp('((?<!\\/)(?:' + prefix + '|<)[\\w:>]*\\.)([\\w\\.-]*)$');
    }
    getCompletionsEmote(text) {
        const settingsPrefix = this.settingsService.settings.prefix;
        const prefix = this.settingsService.settings.requirePrefix ? this.escapeRegExp(settingsPrefix) : '';
        const match = text.match(new RegExp('(^|\\s)(' + prefix + '\\w{2,})$'));
        if (match === null) {
            return {
                completions: [],
                matchText: undefined,
                matchStart: -1
            };
        }
        const emoteArray = [];
        Object.entries(this.emoteNames ?? {}).forEach((([key, value]) => {
            emoteArray.push({
                name: key,
                data: value
            });
        }));
        const matchText = (match[2] ?? '').toLowerCase();
        const completions = emoteArray.filter((emote => {
            const matchWithoutPrefix = matchText.startsWith(settingsPrefix) ? matchText.replace(settingsPrefix, '') : matchText;
            if (emote.name.toLowerCase().search(matchWithoutPrefix) !== -1) {
                return emote;
            } else {
                return false;
            }
        }));
        const matchIndex = match.index ?? 0;
        const matchFirst = match[1] ?? '';
        const matchStart = matchIndex + matchFirst.length;
        return {
            completions,
            matchText,
            matchStart
        };
    }
    getCompletionsCommands(text) {
        const regex = this.getRegexCommand();
        const match = text.match(regex);
        if (match === null) {
            return {
                completions: [],
                matchText: undefined,
                matchStart: -1
            };
        }
        const commandPart = match[2]?.substring(match[2].lastIndexOf('.') + 1) ?? '';
        const commandArray = [];
        this.modifiers.forEach((modifier => {
            commandArray.push({
                name: modifier.name,
                data: modifier
            });
        }));
        const completions = commandArray.filter((command => commandPart === '' || command.name.toLowerCase().search(commandPart) !== -1));
        const matchText = commandPart;
        const matchIndex = match.index ?? 0;
        const matchZero = match[0] ?? '';
        const matchStart = matchIndex + matchZero.length;
        return {
            completions,
            matchText,
            matchStart
        };
    }
    stop() {
        this.emoteNames = undefined;
        this.modifiers = [];
    }
}

class AttachService extends BaseService {
    modulesService;
    canAttach=false;
    externalEmotes=new Set;
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
        return new Promise((resolve => {
            const getCurrentUser = this.modulesService.userStore.getCurrentUser;
            let user = getCurrentUser();
            if (user) {
                resolve(user.id);
                return;
            }
            this.onMessagesLoaded = () => {
                user = getCurrentUser();
                const userId = user?.id ?? '';
                if (this.onMessagesLoaded) {
                    this.modulesService.dispatcher.unsubscribe('LOAD_MESSAGES_SUCCESS', this.onMessagesLoaded);
                    this.onMessagesLoaded = undefined;
                }
                if (!userId) return;
                resolve(userId);
            };
            this.modulesService.dispatcher.subscribe('LOAD_MESSAGES_SUCCESS', this.onMessagesLoaded);
        }));
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
        this.canAttach = this.modulesService.permissions.can(permissions.ATTACH_FILES, channel, this.userId);
        this.curChannelId = channelId;
    }
    stop() {
        if (this.onMessagesLoaded) {
            this.modulesService.dispatcher.unsubscribe('LOAD_MESSAGES_SUCCESS', this.onMessagesLoaded);
            this.onMessagesLoaded = undefined;
        }
        if (this.onChannelSelect) {
            this.modulesService.dispatcher.unsubscribe('CHANNEL_SELECT', this.onChannelSelect);
            this.onChannelSelect = undefined;
        }
        this.canAttach = false;
        this.pendingUpload = undefined;
    }
}

class SettingsService extends BaseService {
    static ADD_BUTTON_CLICK_LISTENER='addButtonClick';
    static REFRESH_BUTTON_CLICK_LISTENER='refreshButtonClick';
    static DELETE_BUTTON_CLICK_LISTENER='deleteButtonClick';
    listenersService;
    settings=DEFAULT_SETTINGS;
    start(listenersService) {
        this.listenersService = listenersService;
        const savedSettings = BdApi.Data.load(this.plugin.meta.name, SETTINGS_KEY);
        this.settings = Object.assign({}, DEFAULT_SETTINGS, savedSettings);
        return Promise.resolve();
    }
    getSettingsElement() {
        const emoteService = this.plugin.emoteService;
        if (!emoteService) return new HTMLElement;
        const Settings = this.zeresPluginLibrary.Settings;
        const settings = [];
        this.pushRegularSettings(settings, emoteService);
        const emoteFolderPicker = document.createElement('input');
        emoteFolderPicker.type = 'file';
        emoteFolderPicker.multiple = true;
        emoteFolderPicker.accept = '.png,.gif';
        let emoteName;
        const emoteNameTextbox = new Settings.Textbox(undefined, 'Emote name', undefined, (val => {
            emoteName = val;
        }));
        let imageUrl;
        const imageUrlTextbox = new Settings.Textbox(undefined, 'Image URL (must end with .gif or .png, 128px recommended)', undefined, (val => {
            imageUrl = val;
        }));
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.classList.add('bd-button');
        addButton.textContent = 'Add';
        const addSettingField = new Settings.SettingField(undefined, undefined, undefined, addButton);
        const customEmotesContainer = document.createElement('div');
        const addListener = {
            element: addButton,
            name: 'click',
            callback: () => {
                const files = emoteFolderPicker.files ?? [];
                const addPromises = (files.length > 0 ? Array.from(files).map((file => {
                    const fileName = file.name.substring(0, file.name.lastIndexOf('.'));
                    return this.addEmote(fileName, file.path);
                })) : [ this.addEmote(emoteName, imageUrl) ]).map((async promise => {
                    const emoteName = await promise;
                    customEmotesContainer.append(this.createCustomEmoteContainer(emoteName, customEmotesContainer, emoteService));
                }));
                Promise.allSettled(addPromises).then((results => {
                    const errors = [];
                    results.forEach((result => {
                        if (result.status === 'fulfilled') return;
                        errors.push(result.reason);
                        console.error(result.reason);
                    }));
                    const firstError = errors[0];
                    if (firstError) {
                        BdApi.showToast(`${firstError.message}${errors.length > 1 ? '\nSee console for all errors' : ''}`, {
                            type: 'error'
                        });
                        if (addPromises.length === 1) return;
                    }
                    emoteFolderPicker.value = '';
                    const emoteNameTextboxInput = emoteNameTextbox.getElement().querySelector('input');
                    if (emoteNameTextboxInput) emoteNameTextboxInput.value = '';
                    const imageUrlTextboxInput = imageUrlTextbox.getElement().querySelector('input');
                    if (imageUrlTextboxInput) imageUrlTextboxInput.value = '';
                    BdApi.saveData(this.plugin.meta.name, SETTINGS_KEY, this.settings);
                    BdApi.showToast('Emote(s) have been saved', {
                        type: 'success'
                    });
                })).catch((error => {
                    BdApi.showToast(error.message, {
                        type: 'error'
                    });
                }));
            }
        };
        addButton.addEventListener(addListener.name, addListener.callback);
        this.listenersService.addListener(SettingsService.ADD_BUTTON_CLICK_LISTENER, addListener);
        Object.keys(this.settings.customEmotes).forEach((key => {
            customEmotesContainer.append(this.createCustomEmoteContainer(key, customEmotesContainer, emoteService));
        }));
        const customEmoteGroup = new Settings.SettingGroup('Custom emotes');
        customEmoteGroup.append(emoteFolderPicker, emoteNameTextbox, imageUrlTextbox, addSettingField, customEmotesContainer);
        settings.push(customEmoteGroup);
        const refreshButton = document.createElement('button');
        refreshButton.type = 'button';
        refreshButton.classList.add('bd-button');
        refreshButton.textContent = 'Refresh emote list';
        const refreshSettingField = new Settings.SettingField(undefined, undefined, undefined, refreshButton);
        const refreshListener = {
            element: refreshButton,
            name: 'click',
            callback: () => {
                emoteService.refreshEmotes();
            }
        };
        refreshButton.addEventListener(refreshListener.name, refreshListener.callback);
        this.listenersService.addListener(SettingsService.REFRESH_BUTTON_CLICK_LISTENER, refreshListener);
        settings.push(refreshSettingField);
        return Settings.SettingPanel.build((() => {
            BdApi.saveData(this.plugin.meta.name, SETTINGS_KEY, this.settings);
        }), ...settings);
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
        const targetEmoteName = emoteNames[emoteService.getPrefixedName(emoteName)] ?? '';
        if (targetEmoteName) throw new Error('Emote name already exists!');
        this.settings.customEmotes[emoteName] = imageUrl;
        emoteNames[emoteService.getPrefixedName(emoteName)] = imageUrl;
        emoteService.emoteNames = emoteNames;
        return await Promise.resolve(emoteName);
    }
    pushRegularSettings(settings, emoteService) {
        const Settings = this.zeresPluginLibrary.Settings;
        settings.push(new Settings.Slider('Emote Size', 'The size of emotes. (default 48)', 32, 128, this.settings.emoteSize, (val => {
            this.settings.emoteSize = Math.round(val);
        }), {
            units: 'px',
            markers: [ 32, 48, 64, 96, 128 ]
        }));
        settings.push(new Settings.Slider('Autocomplete Emote Size', 'The size of emotes in the autocomplete window. (default 15)', 15, 64, this.settings.autocompleteEmoteSize, (val => {
            this.settings.autocompleteEmoteSize = Math.round(val);
        }), {
            units: 'px',
            markers: [ 15, 32, 48, 64 ]
        }));
        settings.push(new Settings.Slider('Autocomplete Items', 'The amount of emotes shown in the autocomplete window. (default 10)', 1, 25, this.settings.autocompleteItems, (val => {
            this.settings.autocompleteItems = Math.round(val);
        }), {
            units: ' items',
            markers: [ 1, 5, 10, 15, 20, 25 ]
        }));
        settings.push(new Settings.Switch('Require prefix', 'If this is enabled, ' + 'the autocomplete list will not be shown unless the prefix is also typed.', this.settings.requirePrefix, (checked => {
            this.settings.requirePrefix = checked;
        })));
        settings.push(new Settings.Switch('Show standard custom emotes', 'If this is enabled, the standard custom emotes will be visible.', this.settings.showStandardEmotes, (checked => {
            this.settings.showStandardEmotes = checked;
            emoteService.refreshEmotes();
        })));
        settings.push(new Settings.Textbox('Prefix', 'The prefix to check against for the above setting. ' + 'It is recommended to use a single character not in use by other chat functionality, ' + 'other prefixes may cause issues.', this.settings.prefix, _.debounce((val => {
            if (val === this.settings.prefix) return;
            const previousPrefix = this.settings.prefix;
            this.settings.prefix = val;
            BdApi.saveData(this.plugin.meta.name, SETTINGS_KEY, this.settings);
            const previousEmoteNames = Object.assign({}, emoteService.emoteNames);
            const emoteNames = {};
            Object.entries(previousEmoteNames).forEach((([name, value]) => {
                const prefixedName = emoteService.getPrefixedName(name.replace(previousPrefix, ''));
                emoteNames[prefixedName] = value;
            }));
            emoteService.emoteNames = emoteNames;
        }), 2000)));
        settings.push(new Settings.RadioGroup('Resize Method', 'How emotes will be scaled down to fit your selected emote size', this.settings.resizeMethod, [ {
            name: 'Scale down smallest side',
            value: 'smallest'
        }, {
            name: 'Scale down largest side',
            value: 'largest'
        } ], (val => {
            this.settings.resizeMethod = val;
        })));
    }
    createCustomEmoteContainer(emoteName, container, emoteService) {
        const Settings = this.zeresPluginLibrary.Settings;
        const customEmoteContainer = document.createElement('div');
        customEmoteContainer.style.display = 'flex';
        const url = this.settings.customEmotes[emoteName] ?? '';
        const containerImage = document.createElement('img');
        containerImage.alt = emoteName;
        containerImage.title = emoteName;
        containerImage.style.minWidth = `${Math.round(this.settings.autocompleteEmoteSize)}px`;
        containerImage.style.minHeight = `${Math.round(this.settings.autocompleteEmoteSize)}px`;
        containerImage.style.width = `${Math.round(this.settings.autocompleteEmoteSize)}px`;
        containerImage.style.height = `${Math.round(this.settings.autocompleteEmoteSize)}px`;
        containerImage.style.marginRight = '0.5rem';
        customEmoteContainer.append(containerImage);
        loadImagePromise(url, false, containerImage).catch(console.error);
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.classList.add('bd-button', 'bd-button-danger');
        deleteButton.innerHTML = '<svg class="" fill="#FFFFFF" viewBox="0 0 24 24" ' + 'style="width: 20px; height: 20px;"><path fill="none" d="M0 0h24v24H0V0z"></path>' + '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm2.46-7.12l1.41-1.41L12 12.59l2.12-2.' + '12 1.41 1.41L13.41 14l2.12 2.12-1.41 1.41L12 15.41l-2.12 2.12-1.41-1.41L10.59 14l-2.13-2.1' + '2zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"></path><path fill="none" d="M0 0h24v24H0z"></path></svg>';
        customEmoteContainer.append(deleteButton);
        const deleteListener = {
            element: deleteButton,
            name: 'click',
            callback: () => {
                delete this.settings.customEmotes[emoteName];
                if (emoteService.emoteNames) {
                    delete emoteService.emoteNames[emoteService.getPrefixedName(emoteName)];
                }
                BdApi.saveData(this.plugin.meta.name, SETTINGS_KEY, this.settings);
                BdApi.showToast(`Emote ${emoteName} has been deleted!`, {
                    type: 'success'
                });
                document.getElementById(emoteName)?.remove();
            }
        };
        deleteButton.addEventListener(deleteListener.name, deleteListener.callback);
        this.listenersService.addListener(`${SettingsService.DELETE_BUTTON_CLICK_LISTENER}${emoteName}`, deleteListener);
        const targetEmote = this.settings.customEmotes[emoteName];
        const existingEmote = new Settings.SettingField(emoteName, targetEmote, undefined, customEmoteContainer, {
            noteOnTop: true
        });
        existingEmote.getElement().id = emoteName;
        return existingEmote.getElement();
    }
    stop() {}
}

class ListenersService extends BaseService {
    listeners={};
    addListenersWatchers={};
    start() {
        return Promise.resolve();
    }
    addListener(id, listener) {
        if (this.listeners[id]) this.removeListener(id);
        this.listeners[id] = listener;
    }
    removeListeners(idPrefix) {
        const listeners = Object.keys(this.listeners).filter((id => id.startsWith(idPrefix)));
        if (listeners.length === 0) return;
        listeners.forEach((id => {
            this.removeListener(id);
        }));
    }
    removeListener(id) {
        const listener = this.listeners[id];
        if (!listener) return;
        const {element, name, callback} = listener;
        if (element) {
            element.removeEventListener(name, callback);
        }
        delete this.listeners[id];
    }
    requestAddListeners(targetId) {
        Object.entries(this.addListenersWatchers).forEach((([id, addListenersWatcher]) => {
            if (id !== targetId) return;
            addListenersWatcher.onAddListeners();
        }));
    }
    stop() {
        Object.keys(this.listeners).forEach((id => {
            this.removeListener(id);
        }));
    }
}

let wasm$1;

const heap = new Array(128).fill(undefined);

heap.push(undefined, null, true, false);

function getObject(idx) {
    return heap[idx];
}

let WASM_VECTOR_LEN = 0;

let cachedUint8Memory0 = null;

function getUint8Memory0() {
    if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
        cachedUint8Memory0 = new Uint8Array(wasm$1.memory.buffer);
    }
    return cachedUint8Memory0;
}

const cachedTextEncoder = new TextEncoder('utf-8');

const encodeString = typeof cachedTextEncoder.encodeInto === 'function' ? function(arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
} : function(arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
};

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length);
        getUint8Memory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }
    let len = arg.length;
    let ptr = malloc(len);
    const mem = getUint8Memory0();
    let offset = 0;
    for (;offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3);
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
    if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0) {
        cachedInt32Memory0 = new Int32Array(wasm$1.memory.buffer);
    }
    return cachedInt32Memory0;
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
    fatal: true
});

cachedTextDecoder.decode();

function getStringFromWasm0(ptr, len) {
    return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];
    heap[idx] = obj;
    return idx;
}

let cachedFloat64Memory0 = null;

function getFloat64Memory0() {
    if (cachedFloat64Memory0 === null || cachedFloat64Memory0.byteLength === 0) {
        cachedFloat64Memory0 = new Float64Array(wasm$1.memory.buffer);
    }
    return cachedFloat64Memory0;
}

function debugString(val) {
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
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        return toString.call(val);
    }
    if (className == 'Object') {
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    return className;
}

function initPanicHook() {
    wasm$1.initPanicHook();
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

function applyCommands(data, commands) {
    try {
        const retptr = wasm$1.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(data, wasm$1.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm$1.applyCommands(retptr, ptr0, len0, addHeapObject(commands));
        var r0 = getInt32Memory0()[retptr / 4 + 0];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        var r2 = getInt32Memory0()[retptr / 4 + 2];
        var r3 = getInt32Memory0()[retptr / 4 + 3];
        if (r3) {
            throw takeObject(r2);
        }
        var v1 = getArrayU8FromWasm0(r0, r1).slice();
        wasm$1.__wbindgen_free(r0, r1 * 1);
        return v1;
    } finally {
        wasm$1.__wbindgen_add_to_stack_pointer(16);
    }
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        wasm$1.__wbindgen_exn_store(addHeapObject(e));
    }
}

async function load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
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
            return {
                instance,
                module
            };
        } else {
            return instance;
        }
    }
}

function getImports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbindgen_string_get = function(arg0, arg1) {
        const obj = getObject(arg1);
        const ret = typeof obj === 'string' ? obj : undefined;
        var ptr0 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm$1.__wbindgen_malloc, wasm$1.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        getInt32Memory0()[arg0 / 4 + 1] = len0;
        getInt32Memory0()[arg0 / 4 + 0] = ptr0;
    };
    imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
        takeObject(arg0);
    };
    imports.wbg.__wbg_log_e8367a5df6be19a7 = function(arg0, arg1) {
        console.log(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
        const ret = getStringFromWasm0(arg0, arg1);
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_is_object = function(arg0) {
        const val = getObject(arg0);
        const ret = typeof val === 'object' && val !== null;
        return ret;
    };
    imports.wbg.__wbindgen_is_undefined = function(arg0) {
        const ret = getObject(arg0) === undefined;
        return ret;
    };
    imports.wbg.__wbindgen_in = function(arg0, arg1) {
        const ret = getObject(arg0) in getObject(arg1);
        return ret;
    };
    imports.wbg.__wbindgen_number_get = function(arg0, arg1) {
        const obj = getObject(arg1);
        const ret = typeof obj === 'number' ? obj : undefined;
        getFloat64Memory0()[arg0 / 8 + 1] = isLikeNone(ret) ? 0 : ret;
        getInt32Memory0()[arg0 / 4 + 0] = !isLikeNone(ret);
    };
    imports.wbg.__wbindgen_error_new = function(arg0, arg1) {
        const ret = new Error(getStringFromWasm0(arg0, arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_jsval_loose_eq = function(arg0, arg1) {
        const ret = getObject(arg0) == getObject(arg1);
        return ret;
    };
    imports.wbg.__wbindgen_boolean_get = function(arg0) {
        const v = getObject(arg0);
        const ret = typeof v === 'boolean' ? v ? 1 : 0 : 2;
        return ret;
    };
    imports.wbg.__wbg_String_88810dfeb4021902 = function(arg0, arg1) {
        const ret = String(getObject(arg1));
        const ptr0 = passStringToWasm0(ret, wasm$1.__wbindgen_malloc, wasm$1.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        getInt32Memory0()[arg0 / 4 + 1] = len0;
        getInt32Memory0()[arg0 / 4 + 0] = ptr0;
    };
    imports.wbg.__wbindgen_object_clone_ref = function(arg0) {
        const ret = getObject(arg0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_getwithrefkey_5e6d9547403deab8 = function(arg0, arg1) {
        const ret = getObject(arg0)[getObject(arg1)];
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_getRandomValues_3774744e221a22ad = function() {
        return handleError((function(arg0, arg1) {
            getObject(arg0).getRandomValues(getObject(arg1));
        }), arguments);
    };
    imports.wbg.__wbg_randomFillSync_e950366c42764a07 = function() {
        return handleError((function(arg0, arg1) {
            getObject(arg0).randomFillSync(takeObject(arg1));
        }), arguments);
    };
    imports.wbg.__wbg_crypto_70a96de3b6b73dac = function(arg0) {
        const ret = getObject(arg0).crypto;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_process_dd1577445152112e = function(arg0) {
        const ret = getObject(arg0).process;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_versions_58036bec3add9e6f = function(arg0) {
        const ret = getObject(arg0).versions;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_node_6a9d28205ed5b0d8 = function(arg0) {
        const ret = getObject(arg0).node;
        return addHeapObject(ret);
    };
    imports.wbg.__wbindgen_is_string = function(arg0) {
        const ret = typeof getObject(arg0) === 'string';
        return ret;
    };
    imports.wbg.__wbg_msCrypto_adbc770ec9eca9c7 = function(arg0) {
        const ret = getObject(arg0).msCrypto;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_require_f05d779769764e82 = function() {
        return handleError((function() {
            const ret = module.require;
            return addHeapObject(ret);
        }), arguments);
    };
    imports.wbg.__wbindgen_is_function = function(arg0) {
        const ret = typeof getObject(arg0) === 'function';
        return ret;
    };
    imports.wbg.__wbg_get_27fe3dac1c4d0224 = function(arg0, arg1) {
        const ret = getObject(arg0)[arg1 >>> 0];
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_length_e498fbc24f9c1d4f = function(arg0) {
        const ret = getObject(arg0).length;
        return ret;
    };
    imports.wbg.__wbg_newnoargs_2b8b6bd7753c76ba = function(arg0, arg1) {
        const ret = new Function(getStringFromWasm0(arg0, arg1));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_next_b7d530c04fd8b217 = function(arg0) {
        const ret = getObject(arg0).next;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_next_88560ec06a094dea = function() {
        return handleError((function(arg0) {
            const ret = getObject(arg0).next();
            return addHeapObject(ret);
        }), arguments);
    };
    imports.wbg.__wbg_done_1ebec03bbd919843 = function(arg0) {
        const ret = getObject(arg0).done;
        return ret;
    };
    imports.wbg.__wbg_value_6ac8da5cc5b3efda = function(arg0) {
        const ret = getObject(arg0).value;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_iterator_55f114446221aa5a = function() {
        const ret = Symbol.iterator;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_get_baf4855f9a986186 = function() {
        return handleError((function(arg0, arg1) {
            const ret = Reflect.get(getObject(arg0), getObject(arg1));
            return addHeapObject(ret);
        }), arguments);
    };
    imports.wbg.__wbg_call_95d1ea488d03e4e8 = function() {
        return handleError((function(arg0, arg1) {
            const ret = getObject(arg0).call(getObject(arg1));
            return addHeapObject(ret);
        }), arguments);
    };
    imports.wbg.__wbg_self_e7c1f827057f6584 = function() {
        return handleError((function() {
            const ret = self.self;
            return addHeapObject(ret);
        }), arguments);
    };
    imports.wbg.__wbg_window_a09ec664e14b1b81 = function() {
        return handleError((function() {
            const ret = window.window;
            return addHeapObject(ret);
        }), arguments);
    };
    imports.wbg.__wbg_globalThis_87cbb8506fecf3a9 = function() {
        return handleError((function() {
            const ret = globalThis.globalThis;
            return addHeapObject(ret);
        }), arguments);
    };
    imports.wbg.__wbg_global_c85a9259e621f3db = function() {
        return handleError((function() {
            const ret = global.global;
            return addHeapObject(ret);
        }), arguments);
    };
    imports.wbg.__wbg_isArray_39d28997bf6b96b4 = function(arg0) {
        const ret = Array.isArray(getObject(arg0));
        return ret;
    };
    imports.wbg.__wbg_instanceof_ArrayBuffer_a69f02ee4c4f5065 = function(arg0) {
        let result;
        try {
            result = getObject(arg0) instanceof ArrayBuffer;
        } catch {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_call_9495de66fdbe016b = function() {
        return handleError((function(arg0, arg1, arg2) {
            const ret = getObject(arg0).call(getObject(arg1), getObject(arg2));
            return addHeapObject(ret);
        }), arguments);
    };
    imports.wbg.__wbg_buffer_cf65c07de34b9a08 = function(arg0) {
        const ret = getObject(arg0).buffer;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_newwithbyteoffsetandlength_9fb2f11355ecadf5 = function(arg0, arg1, arg2) {
        const ret = new Uint8Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_new_537b7341ce90bb31 = function(arg0) {
        const ret = new Uint8Array(getObject(arg0));
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_set_17499e8aa4003ebd = function(arg0, arg1, arg2) {
        getObject(arg0).set(getObject(arg1), arg2 >>> 0);
    };
    imports.wbg.__wbg_length_27a2afe8ab42b09f = function(arg0) {
        const ret = getObject(arg0).length;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Uint8Array_01cebe79ca606cca = function(arg0) {
        let result;
        try {
            result = getObject(arg0) instanceof Uint8Array;
        } catch {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_newwithlength_b56c882b57805732 = function(arg0) {
        const ret = new Uint8Array(arg0 >>> 0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_subarray_7526649b91a252a6 = function(arg0, arg1, arg2) {
        const ret = getObject(arg0).subarray(arg1 >>> 0, arg2 >>> 0);
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_new_abda76e883ba8a5f = function() {
        const ret = new Error;
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_stack_658279fe44541cf6 = function(arg0, arg1) {
        const ret = getObject(arg1).stack;
        const ptr0 = passStringToWasm0(ret, wasm$1.__wbindgen_malloc, wasm$1.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        getInt32Memory0()[arg0 / 4 + 1] = len0;
        getInt32Memory0()[arg0 / 4 + 0] = ptr0;
    };
    imports.wbg.__wbg_error_f851667af71bcfc6 = function(arg0, arg1) {
        try {
            console.error(getStringFromWasm0(arg0, arg1));
        } finally {
            wasm$1.__wbindgen_free(arg0, arg1);
        }
    };
    imports.wbg.__wbindgen_debug_string = function(arg0, arg1) {
        const ret = debugString(getObject(arg1));
        const ptr0 = passStringToWasm0(ret, wasm$1.__wbindgen_malloc, wasm$1.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        getInt32Memory0()[arg0 / 4 + 1] = len0;
        getInt32Memory0()[arg0 / 4 + 0] = ptr0;
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbindgen_memory = function() {
        const ret = wasm$1.memory;
        return addHeapObject(ret);
    };
    return imports;
}

function finalizeInit(instance, module) {
    wasm$1 = instance.exports;
    init.__wbindgen_wasm_module = module;
    cachedFloat64Memory0 = null;
    cachedInt32Memory0 = null;
    cachedUint8Memory0 = null;
    return wasm$1;
}

async function init(input) {
    if (typeof input === 'undefined') {
        input = new URL('gif_wasm_bg.wasm', typeof document === 'undefined' ? new (require('u' + 'rl').URL)('file:' + __filename).href : document.currentScript && document.currentScript.src || new URL('EmoteReplacer.plugin.js', document.baseURI).href);
    }
    const imports = getImports();
    if (typeof input === 'string' || typeof Request === 'function' && input instanceof Request || typeof URL === 'function' && input instanceof URL) {
        input = fetch(input);
    }
    const {instance, module} = await load(await input, imports);
    return finalizeInit(instance, module);
}

function _loadWasmModule(sync, filepath, src, imports) {
    function _instantiateOrCompile(source, imports, stream) {
        var instantiateFunc = stream ? WebAssembly.instantiateStreaming : WebAssembly.instantiate;
        var compileFunc = stream ? WebAssembly.compileStreaming : WebAssembly.compile;
        if (imports) {
            return instantiateFunc(source, imports);
        } else {
            return compileFunc(source);
        }
    }
    var buf = null;
    var isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;
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

function wasm(imports) {
    return _loadWasmModule(0, null, 'AGFzbQEAAAAB+gEkYAF/AGACf38Bf2ACf38AYAN/f38Bf2ABfwF/YAN/f38AYAZ/f39/f38AYAABf2AEf39/fwBgAX8BfmACf30BfWAFf39/f38Bf2AFf39/f38AYAAAYAF9AX1gBH9/fX0Bf2AGf39/f39/AX9gB39/f39/f38Bf2ADf319AGAEf39/fwF/YAJ9fQF9YAV/f39/fQF/YAd/f39/f39/AGAJf39/f39/fn5+AGACf38BfmADfn9/AX9gAn9/AX1gAX0Bf2ADf399AGAFf39+f38AYAR/fn9/AGAFf399f38AYAR/fX9/AGAFf398f38AYAR/fH9/AGABfAF8Av8ONwN3YmcVX193YmluZGdlbl9zdHJpbmdfZ2V0AAIDd2JnGl9fd2JpbmRnZW5fb2JqZWN0X2Ryb3BfcmVmAAADd2JnGl9fd2JnX2xvZ19lODM2N2E1ZGY2YmUxOWE3AAIDd2JnFV9fd2JpbmRnZW5fc3RyaW5nX25ldwABA3diZxRfX3diaW5kZ2VuX2lzX29iamVjdAAEA3diZxdfX3diaW5kZ2VuX2lzX3VuZGVmaW5lZAAEA3diZw1fX3diaW5kZ2VuX2luAAEDd2JnFV9fd2JpbmRnZW5fbnVtYmVyX2dldAACA3diZxRfX3diaW5kZ2VuX2Vycm9yX25ldwABA3diZxlfX3diaW5kZ2VuX2pzdmFsX2xvb3NlX2VxAAEDd2JnFl9fd2JpbmRnZW5fYm9vbGVhbl9nZXQABAN3YmcdX193YmdfU3RyaW5nXzg4ODEwZGZlYjQwMjE5MDIAAgN3YmcbX193YmluZGdlbl9vYmplY3RfY2xvbmVfcmVmAAQDd2JnJF9fd2JnX2dldHdpdGhyZWZrZXlfNWU2ZDk1NDc0MDNkZWFiOAABA3diZyZfX3diZ19nZXRSYW5kb21WYWx1ZXNfMzc3NDc0NGUyMjFhMjJhZAACA3diZyVfX3diZ19yYW5kb21GaWxsU3luY19lOTUwMzY2YzQyNzY0YTA3AAIDd2JnHV9fd2JnX2NyeXB0b183MGE5NmRlM2I2YjczZGFjAAQDd2JnHl9fd2JnX3Byb2Nlc3NfZGQxNTc3NDQ1MTUyMTEyZQAEA3diZx9fX3diZ192ZXJzaW9uc181ODAzNmJlYzNhZGQ5ZTZmAAQDd2JnG19fd2JnX25vZGVfNmE5ZDI4MjA1ZWQ1YjBkOAAEA3diZxRfX3diaW5kZ2VuX2lzX3N0cmluZwAEA3diZx9fX3diZ19tc0NyeXB0b19hZGJjNzcwZWM5ZWNhOWM3AAQDd2JnHl9fd2JnX3JlcXVpcmVfZjA1ZDc3OTc2OTc2NGU4MgAHA3diZxZfX3diaW5kZ2VuX2lzX2Z1bmN0aW9uAAQDd2JnGl9fd2JnX2dldF8yN2ZlM2RhYzFjNGQwMjI0AAEDd2JnHV9fd2JnX2xlbmd0aF9lNDk4ZmJjMjRmOWMxZDRmAAQDd2JnIF9fd2JnX25ld25vYXJnc18yYjhiNmJkNzc1M2M3NmJhAAEDd2JnG19fd2JnX25leHRfYjdkNTMwYzA0ZmQ4YjIxNwAEA3diZxtfX3diZ19uZXh0Xzg4NTYwZWMwNmEwOTRkZWEABAN3YmcbX193YmdfZG9uZV8xZWJlYzAzYmJkOTE5ODQzAAQDd2JnHF9fd2JnX3ZhbHVlXzZhYzhkYTVjYzViM2VmZGEABAN3YmcfX193YmdfaXRlcmF0b3JfNTVmMTE0NDQ2MjIxYWE1YQAHA3diZxpfX3diZ19nZXRfYmFmNDg1NWY5YTk4NjE4NgABA3diZxtfX3diZ19jYWxsXzk1ZDFlYTQ4OGQwM2U0ZTgAAQN3YmcbX193Ymdfc2VsZl9lN2MxZjgyNzA1N2Y2NTg0AAcDd2JnHV9fd2JnX3dpbmRvd19hMDllYzY2NGUxNGIxYjgxAAcDd2JnIV9fd2JnX2dsb2JhbFRoaXNfODdjYmI4NTA2ZmVjZjNhOQAHA3diZx1fX3diZ19nbG9iYWxfYzg1YTkyNTllNjIxZjNkYgAHA3diZx5fX3diZ19pc0FycmF5XzM5ZDI4OTk3YmY2Yjk2YjQABAN3YmctX193YmdfaW5zdGFuY2VvZl9BcnJheUJ1ZmZlcl9hNjlmMDJlZTRjNGY1MDY1AAQDd2JnG19fd2JnX2NhbGxfOTQ5NWRlNjZmZGJlMDE2YgADA3diZx1fX3diZ19idWZmZXJfY2Y2NWMwN2RlMzRiOWEwOAAEA3diZzFfX3diZ19uZXd3aXRoYnl0ZW9mZnNldGFuZGxlbmd0aF85ZmIyZjExMzU1ZWNhZGY1AAMDd2JnGl9fd2JnX25ld181MzdiNzM0MWNlOTBiYjMx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ACAGQQF0aiAPQQFqOwEAIBYgFigCAEEBajYCACABLwFAIg8gAS8BCCIGIAEtAEhrQf//A3FHDQIgAS0ACiITQQxJDQEMAgsgDyATQZDswAAQkwIACyABIBNBAWo6AAogASAGQQF0QQFyOwEICyABIA9BAWo7AUAgByETIAwhDwtBACENIAghDCAORQ0ACwwBC0EBIBQgDUEBcRshFAtBASEGIAlFDQAgCiABKAIUIgJLDQIgASgCECAJIAoQ7QMaIAEgCjYCGCABIAo2AhwLIBRBACAUQQFHGwshDiABIAw7ATogASAGOwE4IAFBPmogEzoAACABQTxqIA87AQAgACAFIBBrNgIEIAAgAyASazYCACAAIA4gFCADIBJLGzoACAwBCyAKIAJB4OrAABDRAwALIAtB0ABqJAALgBsCGX8DfCMAQbAEayIDJAAgA0IANwOYASADQgA3A5ABIANCADcDiAEgA0IANwOAASADQgA3A3ggA0IANwNwIANCADcDaCADQgA3A2AgA0IANwNYIANCADcDUCADQgA3A0ggA0IANwNAIANCADcDOCADQgA3AzAgA0IANwMoIANCADcDICADQgA3AxggA0IANwMQIANCADcDCCADQgA3AwAgA0IANwO4AiADQgA3A7ACIANCADcDqAIgA0IANwOgAiADQgA3A5gCIANCADcDkAIgA0IANwOIAiADQgA3A4ACIANCADcD+AEgA0IANwPwASADQgA3A+gBIANCADcD4AEgA0IANwPYASADQgA3A9ABIANCADcDyAEgA0IANwPAASADQgA3A7gBIANCADcDsAEgA0IANwOoASADQgA3A6ABIANCADcD2AMgA0IANwPQAyADQgA3A8gDIANCADcDwAMgA0IANwO4AyADQgA3A7ADIANCADcDqAMgA0IANwOgAyADQgA3A5gDIANCADcDkAMgA0IANwOIAyADQgA3A4ADIANCADcD+AIgA0IANwPwAiADQgA3A+gCIANCADcD4AIgA0IANwPYAiADQgA3A9ACIANCADcDyAIgA0IANwPAAiADQeADakEAQdAAEOsDGkHM68EAKAIAIgohByACQQNrQRhtIgVBACAFQQBKGyIOIQYgDkFobCEPIA5BAnRB3OvBAGohBQNAIAQgB08gBCAEIAdJaiADIARBA3RqIAZBAEgEfEQAAAAA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IAZBMGokAAsgBygCDCIDQYMBTQ0BCyADEAELIAdBIGokACAJKAIIIS8CQAJAIAACfwJAIAkoAgwiKkUEQCAJIC82AtgEIAlBHjYCvAcgCSAJQdgEajYCuAcgCUEBNgKkBSAJQQE2ApwFIAlBrJjAADYCmAUgCUEANgKQBSAJIAlBuAdqNgKgBSAJQagCaiAJQZAFahCJASAJKALYBCIDQYQBTwRAIAMQAQsgCSgCqAIhBSAJKAKsAiEEIAkoArACIQYgAkUNASABEEoMAQsgCSgCECErIAlByAdqIgggAjYCACAJQcQHaiABNgIAIAkgAjYCwAcgCUIANwO4ByMAQYAGayICJAAgAkEIaiIBQoDh65cQNwIAIAFBADoABCACIAIpAwg3A+AFIAJB+AVqIAlBuAdqIgFBEGopAwA3AwAgAkHwBWoiCiABQQhqKQMANwMAIAIgASkDADcD6AUjAEGABGsiASQAIAFBiAJqIgNBOWpBADsAACADQTVqQQA2AAAgAkHgBWoiBi0AByELIAYtAAYhDCAGLQAFIQ9BgAJBARC3AyINRQRAQYACQQEQ6QMACyAJQZAFaiEFIAJB4ANqIQQgAkHoBWohByADQQA6ADQgA0EAOgB0IAMgCzoAcyADIAw6AHIgAyAPOgBxIANBAToAcCADQQA2AhAgA0EANgJsIANCgICAgBA3AiggA0KAgID4DzcCGCADQYACNgIAIAMgDTYCBCADQQA2AgggA0GAAjsBDCADQSBqQgE3AgAgA0EwakEANgIAIANBPGpCgICAgCA3AgAgBikCACE5AkACQAJAAkACQAJAQYDAAEEBELcDIgYEQCABQYQDaiABQYgCakH4ABDtAxpBIEEBELcDIgtFDQEgAUHUAWoiA0EAOgAqIANBATsBKCADQQA7ARwgA0IANwEeIANBADYCACADQQA2AgggA0H03cAANgIEIANBFGpBADYCACADQSZqQQA6AAAgAUEYaiAHQRBqKQMANwMAIAFBEGogB0EIaikDADcDACABQgA3AiwgAUKAwAA3AiQgASAGNgIgIAEgBykDADcDCCABQTRqIAFBgANqIgNB/AAQ7QMaIAFB0AFqQQA2AgAgAUHMAWogCzYCACABQcABakEANgIAIAEgOUIgiDwAggIgAUEAOgCwASABQQA6AIACIAEgOT4CuAEgAUEg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NgIAIAVBCGogBzYCACAFIAo7ARIgBSAIOwEQIAUgATYCACAFQQE6ABQgBSAGNgIEQQAQsQIhDEEAELECIQ8gASgCACABKAIIIgJrQQVNBEAgASACQQYQ7wEgASgCCCECCyABKAIEIAJqIg1BwJ7AACgAADYAACANQQRqQcSewAAvAAA7AAAgASACQQZqIgI2AgggASgCACACa0EBTQRAIAEgAkECEO8BIAEoAgghAgsgASgCBCACaiINIAhBgP4DcUEIdjoAASANIAg6AAAgASACQQJqIgI2AgggASgCACACa0EBTQRAIAEgAkECEO8BIAEoAgghAgsgASgCBCACaiIIIApBgP4DcUEIdjoAASAIIAo6AAAgASACQQJqIgI2AgggAiABKAIARgRAIAEgAkEBEO8BIAEoAgghAgsgASgCBCACaiAPQQR0IAxyQYB/cjoAACABIAJBAWoiAjYCCCACIAEoAgBGBEAgASACQQEQ7wEgASgCCCECCyABKAIEIAJqQQA6AAAgASACQQFqIgI2AgggAiABKAIARgRAIAEgAkEBEO8BIAEoAgghAgsgASACQQFqNgIIIAEoAgQgAmpBADoAACAFQRhqIAVB7IfAAEEAEN0BIAUtABgiAkEFRw0BIAQgBSkDADcCACAEQRBqIAVBEGopAwA3AgAgBEEIaiAFQQhqKQMANwIADAILIAYgAhDpAwALIAQgBSgAGTYAASAEQQRqIAUoABw2AAAgBEECOgAUIAQgAjoAACABKAIIIgIgASgCAEYEQCABIAJBARDvASABKAIIIQILIAEgAkEBajYCCCABKAIEIAJqQTs6AAAgBkUNACAHEEoLIAVBIGokAAJAAkACQAJAAkAgDi0AbEECRwRAIA5B7AFqIA5B6ABqKQMANwIAIA5B5AFqIA5B4ABqKQMANwIAIA4gDikDWDcC3AEMAQsgDiAOKQNYNwOwASAOQdgBaiAOQbABahCmAiAOKALYASIBQQZHDQELIA5ByAFqIgEgDkHkAWopAgA3AwAgDkHQAWoiAiAOQewBaikCADcDACAOIA4pAtwBNwPAASAdLwEgQQJHDQEgDkHoAWogAikDADcDACAOQeABaiABKQMANwMAIA4gDikDwAE3A9gBDAILIB4gDikC9AE3AhwgDkHIAGogDkHsAWopAgAiOTcDACAOQUBrIA5B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CGoiBikCACIQNwMAIAYgDzcCACACIA03A6AQIAJBuBBqIBA3AwAgAiANNwOwECACQbAQaiACKAK8EBEAACADQRBqIQMgBEEQayIEDQALCyACIAJBBGo2ApQIIAJBCGogACACQZQIaiABEK8BIAIoAhhFDQAgAkGYCGogAkEIakGICBDtAxogAigCnBAiA0HAAEsNASADBEAgA0EEdCEEQcCJwQApAgAhDkHIicEAKQIAIQ8gBSEDA0AgAykCACENIAMgDjcCACACQagQaiADQQhqIgYpAgAiEDcDACAGIA83AgAgAiANNwOgECACQbgQaiAQNwMAIAIgDTcDsBAgAkGwEGogAigCvBARAAAgA0EQaiEDIARBEGsiBA0ACwsgAiACQQRqNgKUCCACQQhqIAAgAkGUCGogARCvASACKAIYRQ0AIAJBmAhqIAJBCGpBiAgQ7QMaIAIoApwQIgNBwABLDQEgAwRAIANBBHQhBEHAicEAKQIAIQ5ByInBACkCACEPIAUhAwNAIAMpAgAhDSADIA43AgAgAkGoEGogA0EIaiIGKQIAIhA3AwAgBiAPNwIAIAIgDTcDoBAgAkG4EGogEDcDACACIA03A7AQIAJBsBBqIAIoArwQEQAAIANBEGohAyAEQRBrIgQNAAsLIAIgAkEEajYClAggAkEIaiAAIAJBlAhqIAEQrwEgAigCGEUNACACQZgIaiACQQhqQYgIEO0DGiACKAKcECIDQcAASw0BIAMEQCADQQR0IQRBwInBACkCACEOQciJwQApAgAhDyAFIQMDQCADKQIAIQ0gAyAONwIAIAJBqBBqIANBCGoiBikCACIQNwMAIAYgDzcCACACIA03A6AQIAJBuBBqIBA3AwAgAiANNwOwECACQbAQaiACKAK8EBEAACADQRBqIQMgBEEQayIEDQALCyACIAJBBGo2ApQIIAJBCGogACACQZQIaiABEK8BIAIoAhhFDQAgAkGYCGogAkEIakGICBDtAxogAigCnBAiA0HAAEsNASADRQ0AIANBBHQhA0HAicEAKQIAIQ5ByInBACkCACEPA0AgBSkCACENIAUgDjcCACACQagQaiAFQQhqIgApAgAiEDcDACAAIA83AgAgAiANNwOgECACQbgQaiAQNwMAIAIgDTcDsBAgAkGwEGogAigCvBARAAAgBUEQaiEFIANB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aiACLwEOOwEAIAMgBEEoai0AAEEBdGogAi8BEDsBACADIARBKWotAABBAXRqIAIvARI7AQAgAyAEQSpqLQAAQQF0aiACLwEUOwEAIAMgBEErai0AAEEBdGogAi8BFjsBACADIARBLGotAABBAXRqIAIvARg7AQAgAyAEQS1qLQAAQQF0aiACLwEaOwEAIAMgBEEuai0AAEEBdGogAi8BHDsBACADIARBL2otAABBAXRqIAIvAR47AQAgByABQSBqKAIAIgJJBEAgAUEcaigCACAHQQF0aiAFOwEADAYLIAcgAkGo78AAEJMCAAsgBSgCACACQTJsaiICQQE6ADAgAiADOgAgIAIgCjsBACAHIAFBIGooAgAiAkkEQCABQRxqKAIAIAdBAXRqIAZBgCByOwEADAULIAcgAkHI78AAEJMCAAsgAiAEQfjuwAAQkwIACyAEIAdBiO/AABCTAgALQfztwABBK0G478AAEMYCAAsgAiAGakEgaiADOgAAIAIgBkEBdGogCjsBACACQTBqIgIgAi0AAEEBajoAAAsgAUEgaiICKAIAIgQgASgCGEYEQCALIAQQ7gEgAigCACEECyABQRxqKAIAIARBAXRqQYDAADsBACACIAIoAgBBAWo2AgAgCiECQQELIQEgACACOwECIAAgATsBAAvNIgIXfwF+IwBBsAFrIgIkACACIAE2AgwjAEEQayIGJAAgAUHIAWooAgAEQCABQQA2AsgBCyACQegAaiEIIAYgARB2AkACQAJAAkACQAJAAkACQAJAIAYtAAAiBUELRwRAA0AgBigCCCEMIAYoAgQhBAJAAkACQAJAIAVBD3FBAWsOCgIDAwMDAwEDAwADCyAIQgI3AgAMBgsgBEEnai0AACENIAQtACohDyAELwEkIQ4gBC8BIiERIAQvASAhEiAELwEeIRMgBC0AKSEUIAQtACYhFSAELQAoIRYgBC8BHCEXIARBFGooAgAiCQRAAkAgBEEYaigCACIDRQRAQQEhCgwBCyADQQBOIgdFDQkgAyAHELcDIgpFDQoLIAogCSADEO0DGgsCQCAEKAIARQRAIARBCGooAgAhCSAEKAIEIQcMAQsgBEEIaigCACEQQQEhGEEBIQkgBEEMaigCACIHBEAgB0EATiILRQ0JIAcgCxC3AyIJRQ0LCyAJIBAgBxDtAxoLIAFBzAFq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ACIDNgIAIAFBgAhqIAIgAyAAEHAgASgCgAgEQANAIAAgASgChAgiAzYCACABQYAIaiACIAMgABBwIAEoAoAIDQALCyABQYAQaiQAIAAPCwALQZwIQQQQ6QMAC44KAQF/IwBBMGsiAiQAAn8CQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgAC0AAEEBaw4RAQIDBAUGBwgJCgsMDQ4PEBEACyACIAAtAAE6AAggAkEkakECNgIAIAJBLGpBATYCACACQZC5wAA2AiAgAkEANgIYIAJB9wA2AhQgAiACQRBqNgIoIAIgAkEIajYCECABIAJBGGoQrAIMEQsgAiAAKQMINwMIIAJBJGpBAjYCACACQSxqQQE2AgAgAkH0uMAANgIgIAJBADYCGCACQfgANgIUIAIgAkEQajYCKCACIAJBCGo2AhAgASACQRhqEKwCDBALIAIgACkDCDcDCCACQSRqQQI2AgAgAkEsakEBNgIAIAJB9LjAADYCICACQQA2AhggAkH5ADYCFCACIAJBEGo2AiggAiACQQhqNgIQIAEgAkEYahCsAgwPCyACIAArAwg5AwggAkEkakECNgIAIAJBLGpBATYCACACQdi4wAA2AiAgAkEANgIYIAJB+gA2AhQgAiACQRBqNgIoIAIgAkEIajYCECABIAJBGGoQrAIMDgsgAiAAKAIENgIIIAJBJGpBAjYCACACQSxqQQE2AgAgAkG4uMAANgIgIAJBADYCGCACQfsANgIUIAIgAkEQajYCKCACIAJBCGo2AhAgASACQRhqEKwCDA0LIAIgACkCBDcDCCACQSRqQQE2AgAgAkEsakEBNgIAIAJBpLjAADYCICACQQA2AhggAkH8ADYCFCACIAJBEGo2AiggAiACQQhqNgIQIAEgAkEYahCsAgwMCyACQSRqQQE2AgAgAkEsakEANgIAIAJBlLjAADYCICACQcS2wAA2AiggAkEANgIYIAEgAkEYahCsAgwLCyACQSRqQQE2AgAgAkEsakEANgIAIAJBgLjAADYCICACQcS2wAA2AiggAkEANgIYIAEgAkEYahCsAgwKCyACQSRqQQE2AgAgAkEsakEANgIAIAJB7LfAADYCICACQcS2wAA2AiggAkEANgIYIAEgAkEYahCsAgwJCyACQSRqQQE2AgAgAkEsakEANgIAIAJB2LfAADYCICACQcS2wAA2AiggAkEANgIYIAEgAkEYahCsAgwICyACQSRqQQE2AgAgAkEsakEANgIAIAJBwLfAADYCICACQcS2wAA2AiggAkEANgIYIAEgAkEYahCsAgwHCyACQSRqQQE2AgAgAkEsakEANgIAIAJBsLfAADYCICACQcS2wAA2AiggAkEANgIYIAEgAkEYahCsAgwGCyACQSRqQQE2AgAgAkEsakEANgIAIAJBpLfAADYCICACQcS2wAA2AiggAkEANgIYIAEgAkEYahCsAgwFCyACQSRqQQE2AgAgAkEsakEANgIAIAJBmLfAADYCICACQcS2wAA2AiggAkEANgIYIAEgAkEYahCsAgwECyACQSRqQQE2AgAgAkEsakEANgIAIAJBhLfAADYCICACQcS2wAA2AiggAkEANgIYIAEgAkEYahCsAgwDCyACQSRqQQE2AgAgAkEsakEANgIAIAJB7LbAADYCICACQcS2wAA2AiggAkEANgIYIAEgAkEYahCsAgwCCyACQSRqQQE2AgAgAkEsakEANgIAIAJB1LbAADYCICACQcS2wAA2AiggAkEANgIYIAEgAkEYahCsAgwBCyABIAAoAgQgAEEIaigCABCtAwsgAkEwaiQAC+MLAgV/An4jAEGQGGsiAiQAIAJBkBBqQciJwQApAgAiBzcDACACQaAQaiAHNwMAIAJBsBBqIAc3AwAgAkHAEGogBzcDACACQdAQaiAHNwMAIAJB4BBqIAc3AwAgAkHwEGogBzcDACACQYARaiAHNwMAIAJBwInBACkCACIINwOIECACIAg3A5gQIAIgCDcDqBAgAiAINwO4ECACIAg3A8gQIAIgCDcD2BAgAiAINwPoECACIAg3A/gQIAJBkBFqIAc3AwAgAiAINwOIESACQaARaiAHNwMAIAIgCDcDmBEgAkGwEWogBzcDACACIAg3A6gRIAJBwBFqIAc3AwAgAiAINwO4ESACQdARaiAHNwMAIAIgCDcDyBEgAkHgEWogBzcDACACIAg3A9gRIAJB8BFqIAc3AwAgAiAINwPoESACQYASaiAHNwMAIAIgCDcD+BEgAkGQEmogBzcDACACIAg3A4gSIAJBoBJqIAc3AwAgAiAINwOYEiACQbASaiAHNwMAIAIgCDcDqBIgAkHAEmogBzcDACACIAg3A7gS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NgKIASACQSNGDQIgAEEANgKMASACQSRGDQIgAEEANgKQASACQSVGDQIgAEEANgKUASACQSZGDQIgAEEANgKYASACQSdGDQIgAEEANgKcASACQShGDQJBKEEoQdTjwQAQkwIACyADQShB1OPBABCTAgALQf7jwQBBHUHU48EAEMYCAAsgACgCoAEgBWohAiABQR9xIgdFBEAgACACNgKgASAADwsCQCACQQFrIgNBJ00EQCACIQQgACADQQJ0aigCACIGQQAgAWsiAXYiA0UNASACQSdNBEAgACACQQJ0aiADNgIAIAJBAWohBAwCCyACQShB1OPBABCTAgALIANBKEHU48EAEJMCAAsCQCACIAVBAWoiCEsEQCABQR9xIQEgAkECdCAAakEIayEDA0AgAkECa0EoTw0CIANBBGogBiAHdCADKAIAIgYgAXZyNgIAIANBBGshAyAIIAJBAWsiAkkNAAsLIAAgBUECdGoiASABKAIAIAd0NgIAIAAgBDYCoAEgAA8LQX9BKEHU48EAEJMCAAvFCAEFfwJAAkAgAi0AACIFRQ0AIAIvAQINACACQQRqLwEARQ0BCwJAIAEoAgAiAwRAIAFBACADGyIEKAIAIgEoAgAgASgCCCIDRgRAIAEgA0EBEO8BIAEoAgghAwsgASADQQFqNgIIIAEoAgQgA2pBIToAACAFBEAgAkEEai8BACEFIAIvAQICfyAEKAIAIgEoAgAgASgCCCIDRwRAIAEMAQsgASADQQEQ7wEgASgCCCEDIAQoAgALIQIgASADQQFqNgIIIAEoAgQgA2pB/wE6AAAgAigCCCIDIAIoAgBHBH8gAgUgAiADQQEQ7wEgAigCCCEDIAQoAgALIQEgAiADQQFqNgIIIAIoAgQgA2pBCzoAACABKAIAIAEoAggiAmtBCk0EQCABIAJBCxDvASABKAIIIQILIAEgAkELajYCCCABKAIEIAJqIgFB9J3AACkAADcAACABQQdqQfudwAAoAAA2AAACfyAEKAIAIgEoAgAgASgCCCIDRwRAIAEMAQsgASADQQEQ7wEgASgCCCEDIAQoAgALIQIgASADQQFqNgIIIAEoAgQgA2pBAzoAACACKAIIIgEgAigCAEYEQCACIAFBARDvASACKAIIIQELIAIgAUEBajYCCCACKAIEIAFqQQE6AAAEQCAEKAIAIgIoAgAgAigCCCIBa0EBTQRAIAIgAUECEO8BIAIoAgghAQsgAiABQQJqNgIIIAIoAgQgAWpBADsAAAwDCyAEKAIAIgIoAgAgAigCCCIBa0EBTQRAIAIgAUECEO8BIAIoAgghAQsgAiABQQJqNgIIIAIoAgQgAWoiASAFQYD+A3FBCHY6AAEgASAFOgAADAILIAItAAIhBiACLwEEIQUgAi0AASEHAn8gBCgCACIBKAIAIAEoAggiA0cEQCABDAELIAEgA0EBEO8BIAEoAgghAyAEKAIACyECIAEgA0EBajYCCCABKAIEIANqQfkBOgAAIAIoAggiAyACKAIARwR/IAIFIAIgA0EBEO8BIAIoAgghAyAEKAIACyEBIAIgA0EBajYCCCACKAIEIANqQQQ6AAAgASgCCCICIAEoAgBGBEAgASACQQEQ7wEgASgCCCECCyABIAJBAWo2AgggASgCBCACaiAHOgAAIAVBgP4DcUEIdiEHAn8gBCgCACIBKAIAIAEoAggiA2tBAUsEQCABDAELIAEgA0ECEO8BIAEoAgghAyAEKAIACyECIAEgA0ECajYCCCABKAIEIANqIgEgBzoAASABIAU6AAAgAigCCCIBIAIoAgBGBEAgAiABQQEQ7wEgAigCCCEBCyACIAFBAWo2AgggAigCBCABaiAGOgAADAELQfGcwABBK0GAnsAAEMYCAAsgBCgCACICKAIAIAIoAggiAUYEQCACIAFBARDvASACKAIIIQELIAIgAUEBajYCCCACKAIEIAFqQQA6AAALIABBBToAAAuQGQMcfwR+AX0jAEHQAGsiBCQAIAQgATYCLAJAAkACQAJAAkACQAJAAkACQCABEARBAUYEQCAEQTBqIgJBADYCCCACQdSWwAA2AgQgAiABNgIQIAJB5JbAADYCACAEKAI0IgEgBCgCMEYNBCAEQUBrIRoDQCAEIAFBCGo2AjQgASgCACECIAEoAgQhAyMAQRBrIhMkACATIAM2AgwgEyACNgIIAn9BACEDIwBBEGsiFiQAIBNBCGoiAkEEaigCACEXIAIoAgAhEAJAQQBBrLPAACgCABEEACIKBEAgCigCAA0BIApBfzYCACAQQRl2IhitQoGChIiQoMCAAX4hICAKQRBqKAIAIgZBDGshCCAKQQRqKAIAIQUgECECAkACQANAIAYgAiAFcSICaikA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AGogAEEoaikCADcDACACIAApAiA3A1BBASAFIAYgAkHQAGogBBB6AkACQCACKAIwQQNGDQAgAUGYAWohBAJAA0ACQCACQQhqIAgQsQECfyACKAIMIgAEQCACKAIIDAELA0AgAkHQAGogBBB4IAIoAlAiAEECRg0ACyAAQQFrDQEgAigCWCEAIAIoAlQLIgUgAkEQakYgAEEdRnENAiAFIAARAAAgAigCMEEDRw0BDAMLCyACKAIwQQNGDQEgASADEGkMAQsgAigCFCIDBEAgAigCSCEAIAIoAkQhASACKAIoIgQoAgQhBSAEKAIAIQQgAigCJCgCACEIIAIoAiAoAgAgAigCQCEHIAIoAiwhCSACKAIQIQogAiACKQMYNwNYIAIgAzYCVCACIAo2AlAgCGtBASAEIAUgAkHQAGogCRB6IAdBAkkNAiABIAAoAgARAAAgAEEEaigCAEUNAiAAQQhqKAIAGiABEEoMAgtBsJrAAEErQdyawAAQxgIACyACKAJAIgBBAUYNAAJAAkACQCAAQQFrDgIAAgELAAtBnJnAAEEoQaCawAAQxgIACyACKAJEIAIoAkgQ4wMACyACQeAAaiQAC+kGAQl/IwBB4ABrIgIkACACQTxqQQA6AAAgAkE4aiABQaQBajYCACACQTRqIAEoAqABNgIAIAJBKGogAEEYaikCADcDACACQSBqIABBEGopAgA3AwAgAkEYaiAAQQhqKQIANwMAIAJBADYCQCACQQA2AjAgAiAAKQIANwMQIAFBgAFqIQggAUGIAWooAgAiA0GEAWooAgAiBCADQYABaigCAGsiByABQYQBaigCACIDTgRAIAggA0EBdBBTIAEoAoQBIQMLIAEoAoABIANBAWsgBHFBA3RqIgMgAkEQajYCACADQRU2AgQgASgCiAFBhAFqIARBAWo2AgAgASgCpAEhBQNAAkAgBSgC+AEiA0GAgARxBEAgAyEEDAELIAUgA0GAgARqIgQgBSgC+AEiBiADIAZGGzYC+AEgAyAGRw0BCwsgBEH/AXEiA0UgBEEIdkH/AXEgA0cgB0EATHFyRQRAIAVB8AFqQQEQzAILIAJBMGohAyAAQThqKAIAIQQgAEE0aigCACIFKAIEIQYgBSgCACEFIABBMGooAgAoAgAgAkHYAGogAEEoaikCADcDACACIAApAiA3A1BBACAF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CEEQaiIHKAIAIgIgBEHwAWoiBUEUaigCACIESQRAIAMgBUEQaigCACACQQZ0aiIELQAAQQFxIgI6AAcgBEEBOgAAIAJFBEBBACECQcTvwQAoAgBB/////wdxBEAQ9gNBAXMhAgsCQAJAAkACQAJAIAQtAAFFBEAgAUECIAEoAgAiBiAGQQFGGzYCACAGQQFHDQEDQCAHKAIIIAUoAggiBkEQdkcNAyAFIAZBAWogBSgCCCIKIAYgCkYiBhs2AgggBkUNAAsgACgCmAEiBkGEAWooAgAgBkGAAWooAgBrQQBKDQMgACgCpAEiBkGAAWooAgAgBigCQHNBAUsNAyAEQQE6AAIDQBDXAiAELQABDQYgBC0AAg0ACwwECyADIAI6AAwgAyAENgIIQfT7wABBKyADQQhqQaD8wABBsPzAABCPAgALIAdCgICAgHA3AgQMBgsgB0KggICAcDcCBCABKAIAQQNGDQUgASABKAIAIgVBACAFQQJHGzYCAAwFCyAFIAUoAghBAWs2AggLIAdCgICAgHA3AgQgASgCAEEDRwRAIAEgASgCACIFQQAgBUECRxs2AgALIAINBUHE78EAKAIAQf////8HcUUNBRD2A0UNBAwFCyADIAI6AAwgAyAENgIIQfT7wABBKyADQQhqQaD8wABBwPzAABCPAgALIANBADYCHCADQYT1wAA2AhggA0EBNgIUIANB3PXAADYCECADQQA2AgggA0EHaiADQQhqEKMCAAsgAiAEQeT7wAAQkwIACyACDQFBxO/BACgCAEH/////B3FFDQEQ9gMNAQsgBEEBOgABCyAEQQA6AAALIANBIGokAAwBCyAIIANBAWo2AhQLIAEoAgBBA0cNAAsLIAAoAqQBIgBB+AFqIgEgASgCACIBQYACazYCACAAQfABakECIAFB/wFxIgAgAEECTxsQzAIgCEEwaiQAC/QFAQd/An8gAQRAQStBgIDEACAAKAIYIglBAXEiARshCiABIAVqDAELIAAoAhghCUEtIQogBUEBagshCAJAIAlBBHFFBEBBACECDAELAkAgA0EQTwRAIAIgAxBIIQYMAQsgA0UEQAwBCyADQQNxIQsCQCADQQFrQQNJBEAgAiEBDAELIANBfHEhByACIQEDQCAGIAEsAABBv39KaiABLAABQb9/SmogASwAAkG/f0pqIAEsAANBv39KaiEGIAFBBGohASAHQQRrIgcNAAsLIAtFDQADQCAGIAEsAABBv39KaiEGIAFBAWohASALQQFrIgsNAAsLIAYgCGohCAsCQAJAIAAoAghFBEBBASEBIAAoAgAiByAAQQRqKAIAIgAgCiACIAMQ3AINAQwCCwJAAkACQAJAIAggAEEMaigCACIHSQRAIAlBCHENBCAHIAhrIgYhB0EBIAAtACAiASABQQNGG0EDcSIBQQFrDgIBAgMLQQEhASAAKAIAIgcgAEEEaigCACIAIAogAiADENwCDQQMBQtBACEHIAYhAQwBCyAGQQF2IQEgBkEBakEBdiEHCyABQQFqIQEgAEEEaigCACEGIAAoAhwhCCAAKAIAIQACQANAIAFBAWsiAUUNASAAIAggBigCEBEBAEUNAAtBAQ8LQQEhASAIQYCAxABGDQEgACAGIAogAiADENwCDQEgACAEIAUgBigCDBEDAA0BQQAhAQJ/A0AgByABIAdGDQEaIAFBAWohASAAIAggBigCEBEBAEUNAAsgAUEBawsgB0khAQwBCyAAKAIcIQsgAEEwNgIcIAAtACAhDEEBIQEgAEEBOgAgIAAoAgAiBiAAQQRqKAIAIgkgCiACIAMQ3AINACAHIAhrQQFqIQECQANAIAFBAWsiAUUNASAGQTAgCSgCEBEBAEUNAAtBAQ8LQQEhASAGIAQgBSAJKAIMEQMADQAgACAMOgAgIAAgCzYCHEEADwsgAQ8LIAcgBCAFIAAoAgwRAwALsQUBBH8CQAJAAkACQCAAKAIAIgFB6AFqKAIAQQFrDgMBAgMACyABQewBahBxDAILIAFB7AFqEEcMAQsgAUHsAWoQgAELIAFBlAJqKAIAIgAEQCAAQRhsIQIgAUGQAmooAgBBCGohAANAIAAoAgAiAyADKAIAIgNBAWs2AgAgA0EBRgRAIAAQtwILIABBGGohACACQRhrIgINAAsLIAEoAowCBEAgAUGQAmooAgAQSgsCQAJAAkACQCABQfABaigCAEEBaw4DAQIDAAsgAUH0AWoQcQwCCyABQfQBahBHDAELIAFB9AFqEIABCyABQfwBaigCAARAIAFBgAJqKAIAEEoLIAFBxABqKAIAIQIgASgCQEF+cSIAIAFBgAFqKAIAQX5xIgRHBEADQCAAQf4AcUH+AEYEQCACKAIAIAIQSiECCyAEIABBAmoiAEcNAAsLIAIQSiABQcwBaigCACIABEAgAEEEdCECIAFByAFqKAIAQQhqIQADQCAAKAIAIgMgAygCACIDQQFrNgIAIANBAUYEQCAAELcCCyAAQRBqIQAgAkEQayICDQALCyABKALEAQRAIAFByAFqKAIAEEoLAkAgAUHQAWooAgAiAEUNACAAIAFB1AFqIgAoAgAoAgARAAAgACgCACIAQQRqKAIARQ0AIABBCGooAgAaIAEoAtABEEoLAkAgAUHYAWooAgAiAEUNACAAIAFB3AFqIgAoAgAoAgARAAAgACgCACIAQQRqKAIARQ0AIABBCGooAgAaIAEoAtgBEEoLAkAgAUHgAWooAgAiAEUNACAAIAFB5AFqIgAoAgAoAgARAAAgACgCACIAQQRqKAIARQ0AIABBCGooAgAaIAEoAuABEEoLAkAgAUF/Rg0AIAEgASgCBCIAQQFrNgIEIABBAUcNACABEEoLC7MFAQR/AkACQAJAAkAgACgCACIBQegBaigCAEEBaw4DAQIDAAsgAUHsAWoQcgwCCyABQewBahCpAQwBCyABQewBahCBAQsgAUGUAmooAgAiAARAIABBGGwhAiABQZACaigCAEEIaiEAA0AgACgCACIDIAMoAgAiA0EBazYCACADQQFGBEAgABC3AgsgAEEYaiEAIAJBGGsiAg0ACwsgASgCjAIEQCABQZACaigCABBKCwJAAkACQAJAIAFB8AFqKAIAQQFrDgMBAgMACyABQfQBahByDAILIAFB9AFqEKkBDAELIAFB9AFqEIEBCyABQfwBaigCAARAIAFBgAJqKAIAEEoLIAFBxABqKAIAIQIgASgCQEF+cSIAIAFBgAFqKAIAQX5xIgRHBEADQCAAQf4AcUH+AEYEQCACKAIAIAIQSiECCyAEIABBAmoiAEcNAAsLIAIQSiABQcwBaigCACIABEAgAEEEdCECIAFByAFqKAIAQQhqIQADQCAAKAIAIgMgAygCACIDQQFrNgIAIANBAUYEQCAAELcCCyAAQRBqIQAgAkEQayICDQALCyABKALEAQRAIAFByAFqKAIAEEoLAkAgAUHQAWooAgAiAEUNACAAIAFB1AFqIgAoAgAoAgARAAAgACgCACIAQQRqKAIARQ0AIABBCGooAgAaIAEoAtABEEoLAkAgAUHYAWooAgAiAEUN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bCEAIAJBtAFqKAIAQQhqIQEDQCABKAIAIgMgAygCACIDQQFrNgIAIANBAUYEQCABELwCCyABQQxqIQEgAEEMayIADQALCyACKAKwAQRAIAJBtAFqKAIAEEoLIAIQSgsLsQQBA38gACgCACIBIAEoAoACIgFBAWs2AoACAkAgAUEBRw0AIAAoAgAiASABKAJAIgIgASgC0AEiA3I2AkAgAiADcUUEQCABQYABahBuIAFBoAFqEG4LIAEtAIgCIAFBAToAiAJFDQAgACgCACICQcQBaigCAARAIAIoAsABEEoLIAJBjAFqKAIAIgAEQCAAQQxsIQAgAkGIAWooAgBBCGohAQNAIAEoAgAiAyADKAIAIgNBAWs2AgAgA0EBRgRAIAEQvgILIAFBDGohASAAQQxrIgANAAsLIAIoAoQBBEAgAkGIAWooAgAQSgsgAkGYAWooAgAiAARAIABBDGwhACACQZQBaigCAEEIaiEBA0AgASgCACIDIAMoAgAiA0EBazYCACADQQFGBEAgARC+AgsgAUEMaiEBIABBDGsiAA0ACwsgAigCkAEEQCACQZQBaigCABBKCyACQawBaigCACIABEAgAEEMbCEAIAJBqAFqKAIAQQhqIQEDQCABKAIAIgMgAygCACIDQQFrNgIAIANBAUYEQCABEL4CCyABQQxqIQEgAEEMayIADQALCyACKAKkAQRAIAJBqAFqKAIAEEoLIAJBuAFqKAIAIgAEQCAAQQxsIQAgAkG0AWooAgBBCGohAQNAIAEoAgAiAyADKAIAIgNBAWs2AgAgA0EBRgRAIAEQvgILIAFBDGohASAAQQxrIgANAAsLIAIoArABBEAgAkG0AWooAgAQSgsgAhBKCwv5BAEKfyMAQTBrIgMkACADQQM6ACggA0KAgICAgAQ3AyAgA0EANgIYIANBADYCECADIAE2AgwgAyAANgIIAn8CQAJAIAIoAgAiCkUEQCACQRRqKAIAIgBFDQEgAigCECEBIABBA3QhBSAAQQFrQf////8BcUEBaiEHIAIoAgghAANAIABBBGooAgAiBARAIAMoAgggACgCACAEIAMoAgwoAgwRAwANBAsgASgCACADQQhqIAFBBGooAgARAQANAyABQQhqIQEgAEEIaiEAIAVBCGsiBQ0ACwwBCyACKAIEIgBFDQAgAEEFdCELIABBAWtB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ASgCUBDjAwALIAFB4ABqJAAMAQtBtIXAAEHGACABQdgAakH8hcAAQdyGwAAQjwIACwwCCyADIAIoAqQBQUBrRgRAIABBOGogAUE4aigCADYCACAAQTBqIAFBMGopAgA3AwAgAEEoaiABQShqKQIANwMAIABBIGogAUEgaikCADcDACAAQRhqIAFBGGopAgA3AwAgAEEQaiABQRBqKQIANwMAIABBCGogAUEIaikCADcDACAAIAEpAgA3AwAgACACEGcMAgsgAEE4aiIEIAFBOGooAgA2AgAgAEEwaiIFIAFBMGopAgA3AwAgAEEoaiIIIAFBKGopAgA3AwAgAEEgaiIHIAFBIGopAgA3AwAgAEEYaiIKIAFBGGopAgA3AwAgAEEQaiIJIAFBEGopAgA3AwAgAEEIaiILIAFBCGopAgA3AwAgACABKQIANwMAIwBB4ABrIgEkACACKAKgASEMIAFBIGogCykCADcDACABQShqIAkpAgA3AwAgAUEwaiAKKQIANwMAIAFBOGogBykCADcDACABQUBrIAgpAgA3AwAgAUHIAGogBSkCADcDACABQdAAaiAEKAIANgIAIAFBAToAFCABIAJBpAFqNgIQIAEgDDYCDCABQQA2AgggASAAKQIANwMYIAFBADYCVCADIAFBCGpB0QAQjAIgASgCCEEDRwRAIAIgAUEIahBpCyABKAJUIgJBAUcEQAJAAkACQCACQQFrDgIAAgELAAtBnJnAAEEoQaCawAAQxgIACyABKAJYIAEoAlwQ4wMACyABQeAAaiQADAELIABBOGogAUE4aigCADYCACAAQTBqIAFBMGopAgA3AwAgAEEoaiABQShqKQIANwMAIABBIGogAUEgaikCADcDACAAQRhqIAFBGGopAgA3AwAgAEEQaiABQRBqKQIANwMAIABBCGogAUEIaikCADcDACAAIAEpAgA3AwAgACACEGcLIABBQGskAAsgBkHgAGokAA8LIAZBADYCNCAGQbiSwAA2AjAgBkEBNgIsIAZBtJTAADYCKCAGQQA2AiBBASAGQRxqQYyUwAAgBkEgakGMlcAAEKACAAv3EAIMfwR9IwBB4ABrIgYkACAGIAA2AgwgBiADNgIUAkACQCAGAn8CQAJAIABBAXYiACADSQ0AIAENASACRQ0AIAJBAXYMAgsgBCgCCCEAIAQoAgQhAiAEKAIAIQMgBiAEKAIMIgQ2AhwgBEUNAyADIQEgAARAIAAgBG4iASAAIAEgBGxHaiIHIANqIQELIAYgBTYCHCABIANrIgVBACABIAVPGyIBIAcgASAHSRsiBUUNAgNAIAYgACAEIAAgBEkbNgIoIAAgBGshACAGIAI2AiQgAiAEaiECIAYgAzYCICADQQFqIQMgBkEcaiEIQQAhCiMAQSBrIgckAAJAAkAgBkEgaiIBKAIIIgkEQCAIKAIAIghBBGooAgAhDCAIKAIAIQ4gASgCBCEIIAEoAgCzIRQDQCAOKAIAIgEqAgggASoCACAKsyISlCABKgIEIBSUkpIgASoCICABKgIYIBKUIAEqAhwgFJSSkiIVlRCjAyETQQQgCSAJQQRPGyELIAxBBGooAgAhDyAMKAIAKAIAIg0oAgQhECATQwAAAABdIBMgDSgCACIRs2ByIAEqAhQgASoCDCASlCABKgIQIBSUkpIgFZUQowMiEkMAAAAAXSASIBCzYHJyBH8gDwUgE0MAAAAAYCEBIA1BDGooAgAgEUF/An8gEkMAAAAAYCINIBJDAACAT11xBEAgEqkMAQtBAAtBACANGyASQ///f09eG2xBfwJ/IAEgE0MAAIBPXXEEQCATqQwBC0EAC0EAIAEbIBND//9/T14bakECdGoLKAAAIQEgByALNgIEIAlBA00NAiAIIAE2AAAgCkEBaiEKIAggC2ohCCAJIAtrIgkNAAsLIAdBIGokAAwBCyAHQQA2AhBBACAHQQRqQdSgwAAgB0EIakG0ocAAEKACAAsgBUEBayIFDQALDAILEPgCIgEgAkEBdiICIAEgAksbCzYCECAEKAIAIQMgBCgCCCEBIAYgADYCHCAEKAIEIQcgBCgCDCECIAZB2ABqIAU2AgAgBkHMAGogAjYCACAGQcQAaiAHNgIAIAZByABqIAAgAmwiBCABIAEgBEsbIgQ2AgAgBkHUAGogBkEQaiIJNgIAIAZB0ABqIAZBHGoiCjYCACAGIAM2AkAgBiAFNgI8IAYgAjYCLCAGIAAgA2o2AiAgBiABIARrNgIoIAYgBCAHajYCJCAGIAk2AjggBiAKNgI0IAYgBkEMajYCMCAGQSBqIQEjAEFAaiIAJAACQEHs7sEAKAIAIgJFBEAQ4gEoAgBBQGshA0Hs7sEAKAIAIgJFBEAgAEE4aiABQThqKAIANgIAIABBMGogAUEwaikCADcDACAAQShqIAFBKGopAgA3AwAgAEEgaiABQSBqKQIANwMAIABBGGogAUEYaikCADcDACAAQRBqIAFBEGopAgA3AwAgAEEIaiABQQhqKQIANwMAIAAgAzYCPCAAIAEpAgA3AwAjAEHgAGsiASQAIAAoAjwhAgJAQQBBtKrAACgCABEEACIDBEAgAUEUaiAAQQhqKQIANwIAIAFBHGogAEEQaikCADcCACABQSRqIABBGGopAgA3AgAgAUEsaiAAQSBqKQIANwIAIAFBNGogAEEoaikCADcCACABQTxqIABBMGopAgA3AgAgAUHEAGogAEE4aigCADYCACABIAM2AgggAUEANgJIIAEgACkCADcCDCACIAFBCGpBDRCMAiABKAIIENcBIAEoAkgiAkEBRwRAAkACQAJAIAJBAWsOAgACAQsAC0GcmcAAQShBoJrAABDGAgALIAEoAkwgASgCUBDjAwALIAFB4ABqJAAMAQtBtIXAAEHGACABQdgAakH8hcAAQdyGwAAQjwIACwwCCyADIAIoAqQBQUBrRgRAIABBOGogAUE4aigCADYCACAAQTBqIAFBMGopAgA3AwAgAEEoaiABQShqKQIANwMAIABBIGogAUEgaikCADcDACAAQRhqIAFBGGopAgA3AwAgAEEQaiABQRBqKQIANwMAIABBCGogAUEIaikCADcDACAAIAEpAgA3AwAgACACEGIMAgsgAEE4aiIEIAFBOGooAgA2AgAgAEEwaiIFIAFBMGopAgA3AwAgAEEoaiIHIAFBKGopAgA3AwAgAEEgaiIJIAFBIGopAgA3AwAgAEEYaiIKIAFBGGopAgA3AwAgAEEQaiIIIAFBEGopAgA3AwAgAEEIaiILIAFBCGopAgA3AwAgACABKQIANwMAIwBB4ABrIgEkACACKAKgASEMIAFBIGogCykCADcDACABQShqIAgpAgA3AwAgAUEwaiAKKQIANwMAIAFBOGogCSkCADcDACABQUBrIAcpAgA3AwAgAUHIAGogBSkCADcDACABQdAAaiAEKAIANgIAIAFBAToAFCABIAJBpAFqNgIQIAEgDDYCDCABQQA2AgggASAAKQIANwMYIAFBADYCVCADIAFBCGpB2QAQjAIgASgCCEEDRwRAIAIgAUEIahBpCyABKAJUIgJBAUcEQAJAAkACQCACQQFrDgIAAgELAAtBnJnAAEEoQaCawAAQxgIACyABKAJYIAEoAlwQ4wMACyABQeAAaiQADAELIABBOGogAUE4aigCADYCACAAQTBqIAFBMGopAgA3AwAgAEEoaiABQShqKQIANwMAIABBIGogAUEgaikCADcDACAAQRhqIAFBGGopAgA3AwAgAEEQaiABQRBqKQIANwMAIABBCGogAUEIaikCADcDACAAIAEpAgA3AwAgACACEGILIABBQGskAAsgBkHgAGokAA8LIAZBADYCNCAGQbiSwAA2AjAgBkEBNgIsIAZBtJTAADYCKCAGQQA2AiBBASAGQRxqQYyUwAAgBkEgakGMlcAAEKACAAvEDwIIfwN9IwBB4ABrIgYkACAGIAA2AgwgBiADNgIUAkACQCAGAn8CQAJAIABBAXYiACADSQ0AIAENASACRQ0AIAJBAXYMAgsgBCgCCCEAIAQoAgQhAiAEKAIAIQMgBiAEKAIMIgQ2AhwgBEUNAyADIQEgAARAIAAgBG4iASAAIAEgBGxHaiIHIANqIQELIAYgBTYCHCABIANrIgVBACABIAVPGyIBIAcgASAHSRsiBUUNAgNAIAYgACAEIAAgBEkbNgIoIAAgBGshACAGIAI2AiQgAiAEaiECIAYgAzYCICADQQFqIQMgBkEcaiEIIwBBIGsiByQAAkACQCAGQSBqIgEoAggiCQRAIAgoAgAiCEEEaigCACELIAgoAgAhDCABKAIEIQggASgCALMhDkEAIQoDQCALKAIAIAtBBGooAgAgDCgCACIBKgIIIAEqAgAgCrMiD5QgASoCBCAOlJKSIAEqAiAgASoCGCAPlCABKgIcIA6UkpIiEJUgASoCFCABKgIMIA+UIAEqAhAgDpSSkiAQlRBQIQ0gB0EEIAkgCUEETxsiATYCBCAJQQNNDQIgCCANNgAAIAEgCGohCCAKQQFqIQogCSABayIJDQALCyAHQSBqJAAMAQsgB0EANgIQQQAgB0EEakHUoMAAIAdBCGpBtKHAABCgAgALIAVBAWsiBQ0ACwwCCxD4AiIBIAJBAXYiAiABIAJLGws2AhAgBCgCACEDIAQoAgghASAGIAA2AhwgBCgCBCEHIAQoAgwhAiAGQdgAaiAFNgIAIAZBzABqIAI2AgAgBkHEAGogBzYCACAGQcgAaiAAIAJsIgQgASABIARLGyIENgIAIAZB1ABqIAZBEGoiCTYCACAGQdAAaiAGQRxqIgg2AgAgBiADNgJAIAYgBTYCPCAGIAI2AiwgBiAAIANqNgIgIAYgASAEazYCKCAGIAQgB2o2AiQgBiAJNgI4IAYgCDYCNCAGIAZBDGo2AjAgBkEgaiEBIwBBQGoiACQAAkBB7O7BACgCACICRQRAEOIBKAIAQUBrIQNB7O7BACgCACICRQRAIABBOGogAUE4aigCADYCACAAQTBqIAFBMGopAgA3AwAgAEEoaiABQShqKQIANwMAIABBIGogAUEgaikCADcDACAAQRhqIAFBGGopAgA3AwAgAEEQaiABQRBqKQIANwMAIABBCGogAUEIaikCADcDACAAIAM2AjwgACABKQIANwMAIwBB4ABrIgEkACAAKAI8IQICQEEAQbSqwAAoAgARBAAiAwRAIAFBFGogAEEIaikCADcCACABQRxqIABBEGopAgA3AgAgAUEkaiAAQRhqKQIANwIAIAFBLGogAEEgaikCADcCACABQTRqIABBKGopAgA3AgAgAUE8aiAAQTBqKQIANwIAIAFBxABqIABBOGooAgA2AgAgASADNgIIIAFBADYCSCABIAApAgA3AgwgAiABQQhqQQgQjAIgASgCCBDXASABKAJIIgJBAUcEQAJAAkACQCACQQFrDgIAAgELAAtBnJnAAEEoQaCawAAQxgIACyABKAJMIAEoAlAQ4wMACyABQeAAaiQADAELQbSFwABBxgAgAUHYAGpB/IXAAEHchsAAEI8CAAsMAgsgAyACKAKkAUFAa0YEQCAAQThqIAFBOGooAgA2AgAgAEEwaiABQTBqKQIANwMAIABBKGogAUEoaikCADcDACAAQSBqIAFBIGopAgA3AwAgAEEYaiABQRhqKQIANwMAIABBEGogAUEQaikCADcDACAAQQhqIAFBCGopAgA3AwAgACABKQIANwMAIAAgAhBgDAILIABBOGoiBCABQThqKAIANgIAIABBMGoiBSABQTBqKQIANwMAIABBKGoiByABQShqKQIANwMAIABBIGoiCSABQSBqKQIANwMAIABBGGoiCCABQRhqKQIANwMAIABBEGoiCiABQRBqKQIANwMAIABBCGoiCyABQQhqKQIANwMAIAAgASkCADcDACMAQeAAayIBJAAgAigCoAEhDCABQSBqIAspAgA3AwAgAUEoaiAKKQIANwMAIAFBMGogCCkCADcDACABQThqIAkpAgA3AwAgAUFAayAHKQIANwMAIAFByABqIAUpAgA3AwAgAUHQAGogBCgCADYCACABQQE6ABQgASACQaQBajYCECABIAw2AgwgAUEANgIIIAEgACkCADcDGCABQQA2AlQgAyABQQhqQdgAEIwCIAEoAghBA0cEQCACIAFBCGoQaQsgASgCVCICQQFHBEACQAJAAkAgAkEBaw4CAAIBCwALQZyZwABBKEGgmsAAEMYCAAsgASgCWCABKAJcEOMDAAsgAUHgAGokAAwBCyAAQThqIAFBOGooAgA2AgAgAEEwaiABQTBqKQIANwMAIABBKGogAUEoaikCADcDACAAQSBqIAFBIGopAgA3AwAgAEEYaiABQRhqKQIANwMAIABBEGogAUEQaikCADcDACAAQQhqIAFBCGopAgA3AwAgACABKQIANwMAIAAgAhBgCyAAQUBrJAALIAZB4ABqJAAPCyAGQQA2AjQgBkG4ksAANgIwIAZBATYCLCAGQbSUwAA2AiggBkEANgIgQQEgBkEcakGMlMAAIAZBIGpBjJXAABCgAgALxA8CCH8DfSMAQeAAayIGJAAgBiAANgIMIAYgAzYCFAJAAkAgBgJ/AkACQCAAQQF2IgAgA0kNACABDQEgAkUNACACQQF2DAILIAQoAgghACAEKAIEIQIgBCgCACEDIAYgBCgCDCIENgIcIARFDQMgAyEBIAAEQCAAIARuIgEgACABIARsR2oiByADaiEBCyAGIAU2AhwgASADayIFQQAgASAFTxsiASAHIAEgB0kbIgVFDQIDQCAGIAAgBCAAIARJGzYCKCAAIARrIQAgBiACNgIkIAIgBGohAiAGIAM2AiAgA0EBaiEDIAZBHGohCCMAQSBrIgckAAJAAkAgBkEgaiIBKAIIIgkEQCAIKAIAIghBBGooAgAhCyAIKAIAIQwgASgCBCEIIAEoAgCzIQ5BACEKA0AgCygCACALQQRqKAIAIAwoAgAiASoCCCABKgIAIAqzIg+UIAEqAgQgDpSSkiABKgIgIAEqAhggD5QgASoCHCAOlJKSIhCVIAEqAhQgASoCDCAPlCABKgIQIA6UkpIgEJUQSyENIAdBBCAJIAlBBE8bIgE2AgQgCUEDTQ0CIAggDTYAACABIAhqIQggCkEBaiEKIAkgAWsiCQ0ACwsgB0EgaiQADAELIAdBADYCEEEAIAdBBGpB1KDAACAHQQhqQbShwAAQoAIACyAFQQFrIgUNAAsMAgsQ+AIiASACQQF2IgIgASACSxsLNgIQIAQoAgAhAyAEKAIIIQEgBiAANgIcIAQoAgQhByAEKAIMIQIgBkHYAGogBTYCACAGQcwAaiACNgIAIAZBxABqIAc2AgAgBkHIAGogACACbCIEIAEgASAESxsiBDYCACAGQdQAaiAGQRBqIgk2AgAgBkHQAGogBkEcaiIINgIAIAYgAzYCQCAGIAU2AjwgBiACNgIsIAYgACADajYCICAGIAEgBGs2AiggBiAEIAdqNgIkIAYgCTYCOCAGIAg2AjQgBiAGQQxqNgIwIAZBIGohASMAQUBqIgAkAAJAQezuwQAoAgAiAkUEQBDiASgCAEFAayEDQezuwQAoAgAiAkUEQCAAQThqIAFBOGooAgA2AgAgAEEwaiABQTBqKQIANwMAIABBKGogAUEoaikCADcDACAAQSBqIAFBIGopAgA3AwAgAEEYaiABQRhqKQIANwMAIABBEGogAUEQaikCADcDACAAQQhqIAFBCGopAgA3AwAgACADNgI8IAAgASkCADcDACMAQeAAayIBJAAgACgCPCECAkBBAEG0qsAAKAIAEQQAIgMEQCABQRRqIABBCGopAgA3AgAgAUEcaiAAQRBqKQIANwIAIAFBJGogAEEYaikCADcCACABQSxqIABBIGopAgA3AgAgAUE0aiAAQShqKQIANwIAIAFBPGogAEEwaikCADcCACABQcQAaiAAQThqKAIANgIAIAEgAzYCCCABQQA2AkggASAAKQIANwIMIAIgAUEIakEGEIwCIAEoAggQ1wEgASgCSCICQQFHBEACQAJAAkAgAkEBaw4CAAIBCwALQZyZwABBKEGgmsAAEMYCAAsgASgCTCABKAJQEOMDAAsgAUHgAGokAAwBC0G0hcAAQcYAIAFB2ABqQfyFwABB3IbAABCPAgALDAILIAMgAigCpAFBQGtGBEAgAEE4aiABQThqKAIANgIAIABBMGogAUEwaikCADcDACAAQShqIAFBKGopAgA3AwAgAEEgaiABQSBqKQIANwMAIABBGGogAUEYaikCADcDACAAQRBqIAFBEGopAgA3AwAgAEEIaiABQQhqKQIANwMAIAAgASkCADcDACAAIAIQYQwCCyAAQThqIgQgAUE4aigCADYCACAAQTBqIgUgAUEwaikCADcDACAAQShqIgcgAUEoaikCADcDACAAQSBqIgkgAUEgaikCADcDACAAQRhqIgggAUEYaikCADcDACAAQRBqIgogAUEQaikCADcDACAAQQhqIgsgAUEIaikCADcDACAAIAEpAgA3AwAjAEHgAGsiASQAIAIoAqABIQwgAUEgaiALKQIANwMAIAFBKGogCikCADcDACABQTBqIAgpAgA3AwAgAUE4aiAJKQIANwMAIAFBQGsgBykCADcDACABQcgAaiAFKQIANwMAIAFB0ABqIAQoAgA2AgAgAUEBOgAUIAEgAkGkAWo2AhAgASAMNgIMIAFBADYCCCABIAApAgA3AxggAUEANgJUIAMgAUEIakHUABCMAiABKAIIQQNHBEAgAiABQQhqEGkLIAEoAlQiAkEBRwRAAkACQAJAIAJBAWsOAgACAQsAC0GcmcAAQShBoJrAABDGAgALIAEoAlggASgCXBDjAwALIAFB4ABqJAAMAQsgAEE4aiABQThqKAIANgIAIABBMGogAUEwaikCADcDACAAQShqIAFBKGopAgA3AwAgAEEgaiABQSBqKQIANwMAIABBGGogAUEYaikCADcDACAAQRBqIAFBEGopAgA3AwAgAEEIaiABQQhqKQIANwMAIAAgASkCADcDACAAIAIQYQsgAEFAayQACyAGQeAAaiQADwsgBkEANgI0IAZBuJLAADYCMCAGQQE2AiwgBkG0lMAANgIoIAZBADYCIEEBIAZBHGpBjJTAACAGQSBqQYyVwAAQoAIAC7oQAgx/A30jAEHgAGsiBiQAIAYgADYCDCAGIAM2AhQCQAJAIAYCfwJAAkAgAEEBdiIAIANJDQAgAQ0BIAJFDQAgAkEBdgwCCyAEKAIIIQAgBCgCBCECIAQoAgAhAyAGIAQoAgwiBDYCHCAERQ0DIAMhASAABEAgACAEbiIBIAAgASAEbEdqIgcgA2ohAQsgBiAFNgIcIAEgA2siBUEAIAEgBU8bIgEgByABIAdJGyIFRQ0CA0AgBiAAIAQgACAESRs2AiggACAEayEAIAYgAjYCJCACIARqIQIgBiADNgIgIANBAWohAyAGQRxqIQgjAEEgayIBJAACQAJAIAZBIGoiCSgCCCIHBEAgCCgCACIIQQRqKAIAIQwgCCgCACEOIAkoAgQhCCAJKAIAsyEUQQAhCQNAQQQgByAHQQRPGyELIA4oAgAiDSoCCCAJs5IQowMhEiAMQQRqKAIAIQ8gDCgCACgCACIKKAIEIRAgEkMAAAAAXSASIAooAgAiEbNgciANKgIUIBSSEKMDIhNDAAAAAF0gEyAQs2BycgR/IA8FIBJDAAAAAGAhDSAKQQxqKAIAIBFBfwJ/IBNDAAAAAGAiCiATQwAAgE9dcQRAIBOpDAELQQALQQAgChsgE0P//39PXhtsQX8CfyANIBJDAACAT11xBEAgEqkMAQtBAAtBACANGyASQ///f09eG2pBAnRqCygAACEKIAEgCzYCBCAHQQNNDQIgCCAKNgAAIAlBAWohCSAIIAtqIQggByALayIHDQALCyABQSBqJAAMAQsgAUEANgIQQQAgAUEEakHUoMAAIAFBCGpBtKHAABCgAgALIAVBAWsiBQ0ACwwCCxD4AiIBIAJBAXYiAiABIAJLGws2AhAgBCgCACEDIAQoAgghASAGIAA2AhwgBCgCBCEHIAQoAgwhAiAGQdgAaiAFNgIAIAZBzABqIAI2AgAgBkHEAGogBzYCACAGQcgAaiAAIAJsIgQgASABIARLGyIENgIAIAZB1ABqIAZBEGoiCDYCACAGQdAAaiAGQRxqIgk2AgAgBiADNgJAIAYgBTYCPCAGIAI2AiwgBiAAIANqNgIgIAYgASAEazYCKCAGIAQgB2o2AiQgBiAINgI4IAYgCTYCNCAGIAZBDGo2AjAgBkEgaiEBIwBBQGoiACQAAkBB7O7BACgCACICRQRAEOIBKAIAQUBrIQNB7O7BACgCACICRQRAIABBOGogAUE4aigCADYCACAAQTBqIAFBMGopAgA3AwAgAEEoaiABQShqKQIANwMAIABBIGogAUEgaikCADcDACAAQRhqIAFBGGopAgA3AwAgAEEQaiABQRBqKQIANwMAIABBCGogAUEIaikCADcDACAAIAM2AjwgACABKQIANwMAIwBB4ABrIgEkACAAKAI8IQICQEEAQbSqwAAoAgARBAAiAwRAIAFBFGogAEEIaikCADcCACABQRxqIABBEGopAgA3AgAgAUEkaiAAQRhqKQIANwIAIAFBLGogAEEgaikCADcCACABQTRqIABBKGopAgA3AgAgAUE8aiAAQTBqKQIANwIAIAFBxABqIABBOGooAgA2AgAgASADNgIIIAFBADYCSCABIAApAgA3AgwgAiABQQhqQQwQjAIgASgCCBDXASABKAJIIgJBAUcEQAJAAkACQCACQQFrDgIAAgELAAtBnJnAAEEoQaCawAAQxgIACyABKAJMIAEoAlAQ4wMACyABQeAAaiQADAELQbSFwABBxgAgAUHYAGpB/IXAAEHchsAAEI8CAAsMAgsgAyACKAKkAUFAa0YEQCAAQThqIAFBOGooAgA2AgAgAEEwaiABQTBqKQIANwMAIABBKGogAUEoaikCADcDACAAQSBqIAFBIGopAgA3AwAgAEEYaiABQRhqKQIANwMAIABBEGogAUEQaikCADcDACAAQQhqIAFBCGopAgA3AwAgACABKQIANwMAIAAgAhBmDAILIABBOGoiBCABQThqKAIANgIAIABBMGoiBSABQTBqKQIANwMAIABBKGoiByABQShqKQIANwMAIABBIGoiCCABQSBqKQIANwMAIABBGGoiCSABQRhqKQIANwMAIABBEGoiCyABQRBqKQIANwMAIABBCGoiDCABQQhqKQIANwMAIAAgASkCADcDACMAQeAAayIBJAAgAigCoAEhCiABQSBqIAwpAgA3AwAgAUEoaiALKQIANwMAIAFBMGogCSkCADcDACABQThqIAgpAgA3AwAgAUFAayAHKQIANwMAIAFByABqIAUpAgA3AwAgAUHQAGogBCgCADYCACABQQE6ABQgASACQaQBajYCECABIAo2AgwgAUEANgIIIAEgACkCADcDGCABQQA2AlQgAyABQQhqQdYAEIwCIAEoAghBA0cEQCACIAFBCGoQaQsgASgCVCICQQFHBEACQAJAAkAgAkEBaw4CAAIBCwALQZyZwABBKEGgmsAAEMYCAAsgASgCWCABKAJcEOMDAAsgAUHgAGokAAwBCyAAQThqIAFBOGooAgA2AgAgAEEwaiABQTBqKQIANwMAIABBKGogAUEoaikCADcDACAAQSBqIAFBIGopAgA3AwAgAEEYaiABQRhqKQIANwMAIABBEGogAUEQaikCADcDACAAQQhqIAFBCGopAgA3AwAgACABKQIANwMAIAAgAhBmCyAAQUBrJAALIAZB4ABqJAAPCyAGQQA2AjQgBkG4ksAANgIwIAZBATYCLCAGQbSUwAA2AiggBkEANgIgQQEgBkEcakGMlMAAIAZBIGpBjJXAABCgAgAL2AQBBH8gACABEPkDIQICQAJAAkAgABDmAw0AIAAoAgAhAwJAIAAQywNFBEAgASADaiEBIAAgAxD6AyIAQZjzwQAoAgBHDQEgAigCBEEDcUEDRw0CQZDzwQAgATYCACAAIAEgAhCBAw8LIAEgA2pBEGohAAwCCyADQYACTwRAIAAQygEMAQsgAEEMaigCACIEIABBCGooAgAiBUcEQCAFIAQ2AgwgBCAFNgIIDAELQYjzwQBBiPPBACgCAEF+IANBA3Z3cTYCAAsgAhDEAwRAIAAgASACEIEDDAILAkBBnPPBACgCACACRwRAIAJBmPPBACgCAEcNAUGY88EAIAA2AgBBkPPBAEGQ88EAKAIAIAFqIgE2AgAgACABEKIDDwtBnPPBACAANgIAQZTzwQBBlPPBACgCACABaiIBNgIAIAAgAUEBcjYCBCAAQZjzwQAoAgBHDQFBkPPBAEEANgIAQZjzwQBBADYCAA8LIAIQ5QMiAyABaiEBAkAgA0GAAk8EQCACEMoBDAELIAJBDGooAgAiBCACQQhqKAIAIgJHBEAgAiAENgIMIAQgAjYCCAwBC0GI88EAQYjzwQAoAgBBfiADQQN2d3E2AgALIAAgARCiAyAAQZjzwQAoAgBHDQFBkPPBACABNgIACw8LIAFBgAJPBEAgACABEMwBDwsgAUF4cUGA8cEAaiECAn9BiPPBACgCACIDQQEgAUEDdnQiAXEEQCACKAIIDAELQYjzwQAgASADcjYCACACCyEBIAIgADYCCCABIAA2AgwgACACNgIMIAAgATYCCAvoBQEDfyAAKAIAIgEgASgCOCIBQQFrNgI4AkAgAUEBRw0AIAAoAgAhASMAQSBrIgIkACABLQAAIQMgAUEBOgAAIAIgA0EBcSIDOgAHAkACQCADRQRAQQAhA0HE78EAKAIAQf////8HcQRAEPYDQQFzIQMLIAEtAAENASABQTRqLQAARQRAIAFBAToANCABQQRqEJsBIAFBHGoQmwELAkAgAw0AQcTvwQAoAgBB/////wdxRQ0AEPYDDQAgAUEBOgABCyABQQA6AAAgAkEgaiQADAILIAJBADYCHCACQYSswAA2AhggAkEBNgIUIAJB/KvAADYCECACQQA2AgggAkEHaiACQQhqEKECAAsgAiADOgAMIAIgATYCCEGxgsAAQSsgAkEIakHcgsAAQdiDwAAQjwIACyABLQBAIAFBAToAQEUNACAAKAIAIgFBDGooAgAiAARAIABBDGwhAiABQQhqKAIAQQhqIQADQCAAKAIAIgMgAygCACIDQQFrNgIAIANBAUYEQCAAELwCCyAAQQxqIQAgAkEMayICDQALCyABKAIEBEAgAUEIaigCABBKCyABQRhqKAIAIgAEQCAAQQxsIQIgAUEUaigCAEEIaiEAA0AgACgCACIDIAMoAgAiA0EBazYCACADQQFGBEAgABC8AgsgAEEMaiEAIAJBDGsiAg0ACwsgASgCEARAIAFBFGooAgAQSgsgAUEkaigCACIABEAgAEEMbCECIAFBIGooAgBBCGohAANAIAAoAgAiAyADKAIAIgNBAWs2AgAgA0EBRgRAIAAQvAILIABBDGohACACQQxrIgINAAsLIAEoAhwEQCABQSBqKAIAEEoLIAFBMGooAgAiAARAIABBDGwhAiABQSxqKAIAQQhqIQADQCAAKAIAIgMgAygCACIDQQFrNgIAIANBAUYEQCAAELwCCyAAQQxqIQAgAkEMayICDQALCyABKAIoBEAgAUEsaigCABBKCyABEEoLC+gFAQN/IAAoAgAiASABKAI4IgFBAWs2AjgCQCABQQFHDQAgACgCACEBIwBBIGsiAiQAIAEtAAAhAyABQQE6AAAgAiADQQFxIgM6AAcCQAJAIANFBEBBACEDQcTvwQAoAgBB/////wdxBEAQ9gNBAXMhAwsgAS0AAQ0BIAFBNGotAABFBEAgAUEBOgA0IAFBBGoQmQEgAUEcahCZAQsCQCADDQBBxO/BACgCAEH/////B3FFDQAQ9gMNACABQQE6AAELIAFBADoAACACQSBqJAAMAgsgAkEANgIcIAJBhPXAADYCGCACQQE2AhQgAkHc9cAANgIQIAJBADYCCCACQQdqIAJBCGoQowIACyACIAM6AAwgAiABNgIIQeCFwQBBKyACQQhqQYyGwQBBiIfBABCPAgALIAEtAEAgAUEBOgBARQ0AIAAoAgAiAUEMaigCACIABEAgAEEMbCECIAFBCGooAgBBCGohAANAIAAoAgAiAyADKAIAIgNBAWs2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CGogAUEIaikCADcDACAAIAM2AjwgACABKQIANwMAIwBB4ABrIgEkACAAKAI8IQICQEEAQbSqwAAoAgARBAAiAwRAIAFBFGogAEEIaikCADcCACABQRxqIABBEGopAgA3AgAgAUEkaiAAQRhqKQIANwIAIAFBLGogAEEgaikCADcCACABQTRqIABBKGopAgA3AgAgAUE8aiAAQTBqKQIANwIAIAFBxABqIABBOGooAgA2AgAgASADNgIIIAFBADYCSCABIAApAgA3AgwgAiABQQhqQQUQjAIgASgCCBDXASABKAJIIgJBAUcEQAJAAkACQCACQQFrDgIAAgELAAtBnJnAAEEoQaCawAAQxgIACyABKAJMIAEoAlAQ4wMACyABQeAAaiQADAELQbSFwABBxgAgAUHYAGpB/IXAAEHchsAAEI8CAAsMAgsgAyACKAKkAUFAa0YEQCAAQThqIAFBOGooAgA2AgAgAEEwaiABQTBqKQIANwMAIABBKGogAUEoaikCADcDACAAQSBqIAFBIGopAgA3AwAgAEEYaiABQRhqKQIANwMAIABBEGogAUEQaikCADcDACAAQQhqIAFBCGopAgA3AwAgACABKQIANwMAIAAgAhBlDAILIABBOGoiBCABQThqKAIANgIAIABBMGoiBSABQTBqKQIANwMAIABBKGoiByABQShqKQIANwMAIABBIGoiCCABQSBqKQIANwMAIABBGGoiCSABQRhqKQIANwMAIABBEGoiCiABQRBqKQIANwMAIABBCGoiCyABQQhqKQIANwMAIAAgASkCADcDACMAQeAAayIBJAAgAigCoAEhDCABQSBqIAspAgA3AwAgAUEoaiAKKQIANwMAIAFBMGogCSkCADcDACABQThqIAgpAgA3AwAgAUFAayAHKQIANwMAIAFByABqIAUpAgA3AwAgAUHQAGogBCgCADYCACABQQE6ABQgASACQaQBajYCECABIAw2AgwgAUEANgIIIAEgACkCADcDGCABQQA2AlQgAyABQQhqQdMAEIwCIAEoAghBA0cEQCACIAFBCGoQaQsgASgCVCICQQFHBEACQAJAAkAgAkEBaw4CAAIBCwALQZyZwABBKEGgmsAAEMYCAAsgASgCWCABKAJcEOMDAAsgAUHgAGokAAwBCyAAQThqIAFBOGooAgA2AgAgAEEwaiABQTBqKQIANwMAIABBKGogAUEoaikCADcDACAAQSBqIAFBIGopAgA3AwAgAEEYaiABQRhqKQIANwMAIABBEGogAUEQaikCADcDACAAQQhqIAFBCGopAgA3AwAgACABKQIANwMAIAAgAhBlCyAAQUBrJAALIAZB4ABqJAAPCyAGQQA2AjQgBkG4ksAANgIwIAZBATYCLCAGQbSUwAA2AiggBkEANgIgQQEgBkEcakGMlMAAIAZBIGpBjJXAABCgAgALwg8CCX8BfSMAQeAAayIGJAAgBiAANgIMIAYgAzYCFAJAAkAgBgJ/AkACQCAAQQF2IgAgA0kNACABDQEgAkUNACACQQF2DAILIAQoAgghAiAEKAIEIQcgBCgCACEAIAYgBCgCDCIDNgIcIANFDQMgACEEQQAhASACBEAgAiADbiIBIAIgASADbEdqIgEgAGohBAsgBkEwaiADNgIAIAZBLGogAjYCACAGIAc2AiggBiAANgIgIAYgBDYCJCAGQQA2AjQgBiAEIABrIgBBACAAIARNGyIANgI8IAYgACABIAAgAUkbNgI4IwBBIGsiACQAAkACQAJAIAZBIGoiASgCFCICIAEoAhgiCU8NACABKAIIIgpFDQAgASgCECEDIAEoAgwhCyABKAIAIQwgBUEEaigCACEHIAUoAgAhDQNAIAsgAiADbCIEayIBIAMgASADSRsiAQRAIAQgCmohBCACIAxqsyEPQQAhBQNAIAcoAgAgB0EEaigCACANKAIAIggqAgggBbOSIAgqAhQgD5IQSyEOIABBBCABIAFBBE8bIgg2AgQgAUEDTQ0EIAQgDjYAACAEIAhqIQQgBUEBaiEFIAEgCGsiAQ0ACwsgAkEBaiICIAlHDQALCyAAQSBqJAAMAQsgAEEANgIQQQAgAEEEakHUoMAAIABBCGpBtKHAABCgAgALDAILEPgCIgEgAkEBdiICIAEgAksbCzYCECAEKAIAIQMgBCgCCCEBIAYgADYCHCAEKAIEIQcgBCgCDCECIAZB2ABqIAU2AgAgBkHMAGogAjYCACAGQcQAaiAHNgIAIAZByABqIAAgAmwiBCABIAEgBEsbIgQ2AgAgBkHUAGogBkEQaiIINgIAIAZB0ABqIAZBHGoiCTYCACAGIAM2AkAgBiAFNgI8IAYgAjYCLCAGIAAgA2o2AiAgBiABIARrNgIoIAYgBCAHajYCJCAGIAg2AjggBiAJNgI0IAYgBkEMajYCMCAGQSBqIQEjAEFAaiIAJAACQEHs7sEAKAIAIgJFBEAQ4gEoAgBBQGshA0Hs7sEAKAIAIgJFBEAgAEE4aiABQThqKAIANgIAIABBMGogAUEwaikCADcDACAAQShqIAFBKGopAgA3AwAgAEEgaiABQSBqKQIANwMAIABBGGogAUEYaikCADcDACAAQRBqIAFBEGopAgA3AwAgAEEIaiABQQhqKQIANwMAIAAgAzYCPCAAIAEpAgA3AwAjAEHgAGsiASQAIAAoAjwhAgJAQQBBtKrAACgCABEEACIDBEAgAUEUaiAAQQhqKQIANwIAIAFBHGogAEEQaikCADcCACABQSRqIABBGGopAgA3AgAgAUEsaiAAQSBqKQIANwIAIAFBNGogAEEoaikCADcCACABQTxqIABBMGopAgA3AgAgAUHEAGogAEE4aigCADYCACABIAM2AgggAUEANgJIIAEgACkCADcCDCACIAFBCGpBChCMAiABKAIIENcBIAEoAkgiAkEBRwRAAkACQAJAIAJBAWsOAgACAQsAC0GcmcAAQShBoJrAABDGAgALIAEoAkwgASgCUBDjAwALIAFB4ABqJAAMAQtBtIXAAEHGACABQdgAakH8hcAAQdyGwAAQjwIACwwCCyADIAIoAqQBQUBrRgRAIABBOGogAUE4aigCADYCACAAQTBqIAFBMGopAgA3AwAgAEEoaiABQShqKQIANwMAIABBIGogAUEgaikCADcDACAAQRhqIAFBGGopAgA3AwAgAEEQaiABQRBqKQIANwMAIABBCGogAUEIaikCADcDACAAIAEpAgA3AwAgACACEF8MAgsgAEE4aiIEIAFBOGooAgA2AgAgAEEwaiIFIAFBMGopAgA3AwAgAEEoaiIHIAFBKGopAgA3AwAgAEEgaiIIIAFBIGopAgA3AwAgAEEYaiIJIAFBGGopAgA3AwAgAEEQaiIKIAFBEGopAgA3AwAgAEEIaiILIAFBCGopAgA3AwAgACABKQIANwMAIwBB4ABrIgEkACACKAKgASEMIAFBIGogCykCADcDACABQShqIAopAgA3AwAgAUEwaiAJKQIANwMAIAFBOGogCCkCADcDACABQUBrIAcpAgA3AwAgAUHIAGogBSkCADcDACABQdAAaiAEKAIANgIAIAFBAToAFCABIAJBpAFqNgIQIAEgDDYCDCABQQA2AgggASAAKQIANwMYIAFBADYCVCADIAFBCGpB1QAQjAIgASgCCEEDRwRAIAIgAUEIahBpCyABKAJUIgJBAUcEQAJAAkACQCACQQFrDgIAAgELAAtBnJnAAEEoQaCawAAQxgIACyABKAJYIAEoAlwQ4wMACyABQeAAaiQADAELIABBOGogAUE4aigCADYCACAAQTBqIAFBMGopAgA3AwAgAEEoaiABQShqKQIANwMAIABBIGogAUEgaikCADcDACAAQRhqIAFBGGopAgA3AwAgAEEQaiABQRBqKQIANwMAIABBCGogAUEIaikCADcDACAAIAEpAgA3AwAgACACEF8LIABBQGskAAsgBkHgAGokAA8LIAZBADYCNCAGQbiSwAA2AjAgBkEBNgIsIAZBtJTAADYCKCAGQQA2AiBBASAGQRxqQYyUwAAgBkEgakGMlcAAEKACAAviDwIJfwJ9IwBB4ABrIgYkACAGIAA2AgwgBiADNgIUAkACQCAGAn8CQAJAIABBAXYiACADSQ0AIAENASACRQ0AIAJBAXYMAgsgBCgCCCECIAQoAgQhByAEKAIAIQAgBiAEKAIMIgM2AhwgA0UNAyAAIQRBACEBIAIEQCACIANuIgEgAiABIANsR2oiASAAaiEECyAGQTBqIAM2AgAgBkEsaiACNgIAIAYgBzYCKCAGIAA2AiAgBiAENgIkIAZBADYCNCAGIAQgAGsiAEEAIAAgBE0bIgA2AjwgBiAAIAEgACABSRs2AjgjAEEgayIAJAACQAJAAkAgBkEgaiIBKAIUIgMgASgCGCIJTw0AIAEoAggiCkUNACABKAIQIQQgASgCDCELIAEoAgAhDCAFQQRqKAIAIQggBSgCACENA0AgCyADIARsIgJrIgEgBCABIARJGyIBBEAgAiAKaiEFIAMgDGqzIQ9BACEHA0AgCCgCACAIQQRqKAIAIA0oAgAiAioCCCACKgIAIAezIhCUIAIqAgQgD5SSkiACKgIUIAIqAgwgEJQgAioCECAPlJKSEEshDiAAQQQgASABQQRPGyICNgIEIAFBA00NBCAFIA42AAAgAiAFaiEFIAdBAWohByABIAJrIgENAAsLIANBAWoiAyAJRw0ACwsgAEEgaiQADAELIABBADYCEEEAIABBBGpB1KDAACAAQQhqQbShwAAQoAIACwwCCxD4AiIBIAJBAXYiAiABIAJLGws2AhAgBCgCACEDIAQoAgghASAGIAA2AhwgBCgCBCEHIAQoAgwhAiAGQdgAaiAFNgIAIAZBzABqIAI2AgAgBkHEAGogBzYCACAGQcgAaiAAIAJsIgQgASABIARLGyIENgIAIAZB1ABqIAZBEGoiCDYCACAGQdAAaiAGQRxqIgk2AgAgBiADNgJAIAYgBTYCPCAGIAI2AiwgBiAAIANqNgIgIAYgASAEazYCKCAGIAQgB2o2AiQgBiAINgI4IAYgCTYCNCAGIAZBDGo2AjAgBkEgaiEBIwBBQGoiACQAAkBB7O7BACgCACICRQRAEOIBKAIAQUBrIQNB7O7BACgCACICRQRAIABBOGogAUE4aigCADYCACAAQTBqIAFBMGopAgA3AwAgAEEoaiABQShqKQIANwMAIABBIGogAUEgaikCADcDACAAQRhqIAFBGGopAgA3AwAgAEEQaiABQRBqKQIANwMAIABBCGogAUEIaikCADcDACAAIAM2AjwgACABKQIANwMAIwBB4ABrIgEkACAAKAI8IQICQEEAQbSqwAAoAgARBAAiAwRAIAFBFGogAEEIaikCADcCACABQRxqIABBEGopAgA3AgAgAUEkaiAAQRhqKQIANwIAIAFBLGogAEEgaikCADcCACABQTRqIABBKGopAgA3AgAgAUE8aiAAQTBqKQIANwIAIAFBxABqIABBOGooAgA2AgAgASADNgIIIAFBADYCSCABIAApAgA3AgwgAiABQQhqQQcQjAIgASgCCBDXASABKAJIIgJBAUcEQAJAAkACQCACQQFrDgIAAgELAAtBnJnAAEEoQaCawAAQxgIACyABKAJMIAEoAlAQ4wMACyABQeAAaiQADAELQbSFwABBxgAgAUHYAGpB/IXAAEHchsAAEI8CAAsMAgsgAyACKAKkAUFAa0YEQCAAQThqIAFBOGooAgA2AgAgAEEwaiABQTBqKQIANwMAIABBKGogAUEoaikCADcDACAAQSBqIAFBIGopAgA3AwAgAEEYaiABQRhqKQIANwMAIABBEGogAUEQaikCADcDACAAQQhqIAFBCGopAgA3AwAgACABKQIANwMAIAAgAhBjDAILIABBOGoiBCABQThqKAIANgIAIABBMGoiBSABQTBqKQIANwMAIABBKGoiByABQShqKQIANwMAIABBIGoiCCABQSBqKQIANwMAIABBGGoiCSABQRhqKQIANwMAIABBEGoiCiABQRBqKQIANwMAIABBCGoiCyABQQhqKQIANwMAIAAgASkCADcDACMAQeAAayIBJAAgAigCoAEhDCABQSBqIAspAgA3AwAgAUEoaiAKKQIANwMAIAFBMGogCSkCADcDACABQThqIAgpAgA3AwAgAUFAayAHKQIANwMAIAFByABqIAUpAgA3AwAgAUHQAGogBCgCADYCACABQQE6ABQgASACQaQBajYCECABIAw2AgwgAUEANgIIIAEgACkCADcDGCABQQA2AlQgAyABQQhqQdcAEIwCIAEoAghBA0cEQCACIAFBCGoQaQsgASgCVCICQQFHBEACQAJAAkAgAkEBaw4CAAIBCwALQZyZwABBKEGgmsAAEMYCAAsgASgCWCABKAJcEOMDAAsgAUHgAGokAAwBCyAAQThqIAFBOGooAgA2AgAgAEEwaiABQTBqKQIANwMAIABBKGogAUEoaikCADcDACAAQSBqIAFBIGopAgA3AwAgAEEYaiABQRhqKQIANwMAIABBEGogAUEQaikCADcDACAAQQhqIAFBCGopAgA3AwAgACABKQIANwMAIAAgAhBjCyAAQUBrJAALIAZB4ABqJAAPCyAGQQA2AjQgBkG4ksAANgIwIAZBATYCLCAGQbSUwAA2AiggBkEANgIgQQEgBkEcakGMlMAAIAZBIGpBjJXAABCgAgALwg8CCX8BfSMAQeAAayIGJAAgBiAANgIMIAYgAzYCFAJAAkAgBgJ/AkACQCAAQQF2IgAgA0kNACABDQEgAkUNACACQQF2DAILIAQoAgghAiAEKAIEIQcgBCgCACEAIAYgBCgCDCIDNgIcIANFDQMgACEEQQAhASACBEAgAiADbiIBIAIgASADbEdqIgEgAGohBAsgBkEwaiADNgIAIAZBLGogAjYCACAGIAc2AiggBiAANgIgIAYgBDYCJCAGQQA2AjQgBiAEIABrIgBBACAAIARNGyIANgI8IAYgACABIAAgAUkbNgI4IwBBIGsiACQAAkACQAJAIAZBIGoiASgCFCICIAEoAhgiCU8NACABKAIIIgpFDQAgASgCECEDIAEoAgwhCyABKAIAIQwgBUEEaigCACEHIAUoAgAhDQNAIAsgAiADbCIEayIBIAMgASADSRsiAQRAIAQgCmohBCACIAxqsyEPQQAhBQNAIAcoAgAgB0EEaigCACANKAIAIggqAgggBbOSIAgqAhQgD5IQUCEOIABBBCABIAFBBE8bIgg2AgQgAUEDTQ0EIAQgDjYAACAEIAhqIQQgBUEBaiEFIAEgCGsiAQ0ACwsgAkEBaiICIAlHDQALCyAAQSBqJAAMAQsgAEEANgIQQQAgAEEEakHUoMAAIABBCGpBtKHAABCgAgALDAILEPgCIgEgAkEBdiICIAEgAksbCzYCECAEKAIAIQMgBCgCCCEBIAYgADYCHCAEKAIEIQcgBCgCDCECIAZB2ABqIAU2AgAgBkHMAGogAjYCACAGQcQAaiAHNgIAIAZByABqIAAgAmwiBCABIAEgBEsbIgQ2AgAgBkHUAGogBkEQaiIINgIAIAZB0ABqIAZBHGoiCTYCACAGIAM2AkAgBiAFNgI8IAYgAjYCLCAGIAAgA2o2AiAgBiABIARrNgIoIAYgBCAHajYCJCAGIAg2AjggBiAJNgI0IAYgBkEMajYCMCAGQSBqIQEjAEFAaiIAJAACQEHs7sEAKAIAIgJFBEAQ4gEoAgBBQGshA0Hs7sEAKAIAIgJFBEAgAEE4aiABQThqKAIANgIAIABBMGogAUEwaikCADcDACAAQShqIAFBKGopAgA3AwAgAEEgaiABQSBqKQIANwMAIABBGGogAUEYaikCADcDACAAQRBqIAFBEGopAgA3AwAgAEEIaiABQQhqKQIANwMAIAAgAzYCPCAAIAEpAgA3AwAjAEHgAGsiASQAIAAoAjwhAgJAQQBBtKrAACgCABEEACIDBEAgAUEUaiAAQQhqKQIANwIAIAFBHGogAEEQaikCADcCACABQSRqIABBGGopAgA3AgAgAUEsaiAAQSBqKQIANwIAIAFBNGogAEEoaikCADcCACABQTxqIABBMGopAgA3AgAgAUHEAGogAEE4aigCADYCACABIAM2AgggAUEANgJIIAEgACkCADcCDCACIAFBCGpBCRCMAiABKAIIENcBIAEoAkgiAkEBRwRAAkACQAJAIAJBAWsOAgACAQsAC0GcmcAAQShBoJrAABDGAgALIAEoAkwgASgCUBDjAwALIAFB4ABqJAAMAQtBtIXAAEHGACABQdgAakH8hcAAQdyGwAAQjwIACwwCCyADIAIoAqQBQUBrRgRAIABBOGogAUE4aigCADYCACAAQTBqIAFBMGopAgA3AwAgAEEoaiABQShqKQIANwMAIABBIGogAUEgaikCADcDACAAQRhqIAFBGGopAgA3AwAgAEEQaiABQRBqKQIANwMAIABBCGogAUEIaikCADcDACAAIAEpAgA3AwAgACACEGQMAgsgAEE4aiIEIAFBOGooAgA2AgAgAEEwaiIFIAFBMGopAgA3AwAgAEEoaiIHIAFBKGopAgA3AwAgAEEgaiIIIAFBIGopAgA3AwAgAEEYaiIJIAFBGGopAgA3AwAgAEEQaiIKIAFBEGopAgA3AwAgAEEIaiILIAFBCGopAgA3AwAgACABKQIANwMAIwBB4ABrIgEkACACKAKgASEMIAFBIGogCykCADcDACABQShqIAopAgA3AwAgAUEwaiAJKQIANwMAIAFBOGogCCkCADcDACABQUBrIAcpAgA3AwAgAUHIAGogBSkCADcDACABQdAAaiAEKAIANgIAIAFBAToAFCABIAJBpAFqNgIQIAEgDDYCDCABQQA2AgggASAAKQIANwMYIAFBADYCVCADIAFBCGpB0gAQjAIgASgCCEEDRwRAIAIgAUEIahBpCyABKAJUIgJBAUcEQAJAAkACQCACQQFrDgIAAgELAAtBnJnAAEEoQaCawAAQxgIACyABKAJYIAEoAlwQ4wMACyABQeAAaiQADAELIABBOGogAUE4aigCADYCACAAQTBqIAFBMGopAgA3AwAgAEEoaiABQShqKQIANwMAIABBIGogAUEgaikCADcDACAAQRhqIAFBGGopAgA3AwAgAEEQaiABQRBqKQIANwMAIABBCGogAUEIaikCADcDACAAIAEpAgA3AwAgACACEGQLIABBQGskAAsgBkHgAGokAA8LIAZBADYCNCAGQbiSwAA2AjAgBkEBNgIsIAZBtJTAADYCKCAGQQA2AiBBASAGQRxqQYyUwAAgBkEgakGMlcAAEKACAAvgAwEJfyAAQShqKAIAIgYgAkH/AXEiCEsEQCAAQSRqKAIAIAhBAnRqKAIAIgZBAWtBACAGGyECAkAgBiAAKAIEIg1JIgUgAnJFDQAgBEH/AXEhBCADQf8BcSEKIAFB/wFxIQsgAEEYaigCACEMIABB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OQNAIAMgBTYCPCADIAQ6ADkgAyAGOgA4IwBBMGsiBCQAIAQgAjYCBCAEIAE2AgAgBEEUakHhADYCACAEQeIANgIMIAQgA0E4ajYCCCAEIAQ2AhAgBEECNgIsIARBAjYCJCAEQdCwwAA2AiAgBEEANgIYIAQgBEEIajYCKAJ/IwBBQGoiASQAIAFBADYCCCABQoCAgIAQNwMAIAFBEGoiAiABQfiuwAAQ/AIgBEEYaiACEKoCRQRAIAEoAgQgASgCCBAIIAEoAgAEQCABKAIEEEoLIAFBQGskAAwBC0GQr8AAQTcgAUE4akHIr8AAQaSwwAAQjwIACyAEQTBqJAAgCEUgB0VyRQRAIAUQSgsCQCAARQ0AIAMoAiBFDQAgBRBKCyADQdAAaiQAC68NAQl/IwBBgAFrIgMkACADQQhqIABBOGooAgBBCGopAgA3AwAgAygCCARAIAMoAgwaCyADIAAoAgAQ0gIiATYCSAJAIAFFDQAgASABKAIAIgFBAWs2AgAgAUEBRw0AIANByABqEMMCCyADQUBrIgQgAEE0aigCADYCACADQThqIgIgAEEsaikCADcDACADQTBqIgcgAEEkaikCADcDACADQShqIgYgAEEcaikCADcDACADQSBqIgUgAEEUaikCADcDACADQRhqIgggAEEMaikCADcDACADIAApAgQ3AxAgACgCOCEJIwBBEGsiASQAAkACQEG088EAKAIARQRAQbTzwQBBfzYCAEG488EAKAIADQFBuPPBACAJNgIAQbTzwQBBADYCACABQRBqJAAMAgtByJLBAEEQIAFBCGpB2JLBAEHYnMEAEI8CAAsACyADQfgAaiAEKAIANgIAIANB8ABqIAIpAwA3AwAgA0HoAGogBykDADcDACADQeAAaiAGKQMANwMAIANB2ABqIAUpAwA3AwAgA0HQAGogCCkDADcDACADIAMpAxA3A0gjAEFAaiIHJAAgB0E4aiADQcgAaiIBQTBqKAIANgIAIAdBMGogAUEoaikCADcDACAHQShqIAFBIGopAgA3AwAgB0EgaiABQRhqKQIANwMAIAdBGGogAUEQaikCADcDACAHQRBqIAFBCGopAgA3AwAgByABKQIANwMIIwAiASEIIAFBgAJrQUBxIgIkACACQfgBaiAHQQhqIgFBMGooAgA2AgAgAkHwAWogAUEoaikCADcDACACQegBaiABQSBqKQIANwMAIAJB4AFqIAFBGGopAgA3AwAgAkHYAWogAUEQaikCADcDACACQdABaiABQQhqKQIANwMAIAIgASkCADcDyAEgAiACQcgBahCNAQJAAkACQAJAAkACQAJAQezuwQAoAgBFBEBB7O7BACACNgIAIAIoAqABIgQgAigCpAEiBkGUAmooAgAiAU8NASACIAZBkAJqKAIAIARBGGxqIgEtABBBAXEiBToA/wEgAUEBOgAQIAUNBSABQRBqIQFBACEFQcTvwQAoAgBB/////wdxBEAQ9gNBAXMhBQsgAS0AAQ0GIAFBAToAAgJAIAUNAEHE78EAKAIAQf////8HcUUNABD2Aw0AIAFBAToAAQsgAUEAOgAAIAZB2AFqKAIAIgEEQCABIAQgBkHcAWooAgAoAhQRAgALIAQgBkGUAmooAgAiAU8NAiAGQZACaigCACAEQRhsaiIBKAIAQQNHBEAgAiABEGkLIAQgBkGUAmooAgAiAU8NAyACIAZBkAJqKAIAIARBGGxqIgEtABNBAXEiBToA/wEgAUEBOgATIAUNBSABQRNqIQFBACEFQcTvwQAoAgBB/////wdxBEAQ9gNBAXMhBQsgAS0AAQ0GIAFBAToAAgJAIAUNAEHE78EAKAIAQf////8HcUUNABD2Aw0AIAFBAToAAQsgAUEAOgAAIAZB4AFqKAIAIgEEQCABIAQgBkHkAWooAgAoAhQRAgALQezuwQAoAgAgAkcNBEHs7sEAQQA2AgAgAkGIAWoiASgCACIEIAQoAgAiBEEBazYCACAEQQFGBEAgARC3AgsgAigCmAEiASABKAIAIgFBAWs2AgAgAUEBRgRAIAJBmAFqELcCCyACKAIEIQEgAigCAEF+cSIGIAIoAkBBfnEiBUcEQANAIAZB/gBxQf4ARgRAIAEoAgAgARBKIQELIAUgBkECaiIGRw0ACwsgARBKIAIoAqQBIgEgASgCACIBQQFrNgIAIAFBAUYEQCACQaQBahBsCyAIJAAMBwtBrIXBAEEjQdCFwQAQxgIACyAEIAFB7P/AABCTAgALIAQgAUH8/8AAEJMCAAsgBCABQYyAwQAQkwIAC0GIhMEAQTFBnIXBABDGAgALIAJBADYC3AEgAkGE9cAANgLYASACQQE2AtQBIAJB3PXAADYC0AEgAkEANgLIASACQf8BaiACQcgBahCjAgALIAIgBToAzAEgAiABNgLIAUHw/MAAQSsgAkHIAWpBnP3AAEGM/sAAEI8CAAsgB0FAayQAAkAgACgCPCIBQQxqKAIARQ0AIAFBEGooAgAiBEUNACAEIAFBFGoiBCgCACgCABEAACAEKAIAIgRBBGooAgBFDQAgBEEIaigCABogASgCEBBKCyABQgE3AgwgAyAAKAI8IgA2AkggACAAKAIAIgBBAWs2AgAgAEEBRgRAIANByABqENYBCyADQYABaiQAC6QOAgN/AX4jAEEwayIDJAACfwJAAkACQAJAAkACQCAAKAIAQQFrDgUBAgMEBQALIwBBMGsiAiQAAn8CQCAAQQRqIgAoAhBFBEAgAC0AAEEDRw0BIAJBFGpBATYCACACQRxqQQA2AgAgAkGUwcAANgIQIAJB0LvAADYCGCACQQA2AgggASACQQhqEKwCDAILIAIgAEEQajYCBCACQRRqQQI2AgAgAkEcakECNgIAIAJBLGpBgwE2AgAgAkHwwMAANgIQIAJBADYCCCACQYIBNgIkIAIgADYCICACIAJBIGo2AhggAiACQQRqNgIoIAEgAkEIahCsAgwBCyACQRRqQQE2AgAgAkEcakEBNgIAIAJBgMHAADYCECACQQA2AgggAkGCATYCJCACIAA2AiAgAiACQSBqNgIYIAEgAkEIahCsAgsgAkEwaiQADAULIABBBGohAiAAQRRqIgAoAgBFBEAgA0EkakEBNgIAIANBLGpBATYCACADQdDAwAA2AiAgA0EANgIYIANBggE2AgwgAyACNgIIIAMgA0EIajYCKCABIANBGGoQrAIMBQsgAyAANgIEIANBJGpBAjYCACADQSxqQQI2AgAgA0EUakGDATYCACADQcDAwAA2AiAgA0EANgIYIANBggE2AgwgAyACNgIIIAMgA0EIajYCKCADIANBBGo2AhAgASADQRhqEKwCDAQLIwBBMGsiAiQAAkACQAJAAkACQAJAIABBBGoiBCgCAEEBaw4DAAECAwtBASEAIAJBHGpBATYCACACQSRqQQA2AgAgAkHUv8AANgIYIAJB0LvAADYCICACQQA2AhAgASACQRBqEKwCRQ0DDAQLIAIgBEEEajYCDEEBIQAgAkEcakEBNgIAIAJBJGpBATYCACACQYi/wAA2AhggAkEANgIQIAJBgAE2AiwgAiACQShqNgIgIAIgAkEMajYCKCABIAJBEGoQrAJFDQIMAwtBASEAIAJBHGpBATYCACACQSRqQQA2AgAgAkHkvsAANgIYIAJB0LvAADYCICACQQA2AhAgASACQRBqEKwCRQ0BDAILQQEhACACQRxqQQE2AgAgAkEkakEANgIAIAJBlMDAADYCGCACQdC7wAA2AiAgAkEANgIQIAEgAkEQahCsAg0BCyAEKAIQRQRAQQAhAAwBCyACIARBEGo2AgwgAkEcakEBNgIAIAJBJGpBATYCACACQaDAwAA2AhggAkEANgIQIAJBgwE2AiwgAiACQShqNgIgIAIgAkEMajYCKCABIAJBEGoQrAIhAAsgAkEwaiQAIAAMAwsCQAJAAkBBAiAAKQMIIgWnQQJrIAVCAVgbQQFrDgIBAgALIANBJGpBATYCACADQSxqQQA2AgAgA0GkwsAANgIgIANB0LvAADYCKCADQQA2AhggASADQRhqEKwCDAQLIANBJGpBATYCACADQSxqQQA2AgAgA0GIwsAANgIgIANB0LvAADYCKCADQQA2AhggASADQRhqEKwCDAMLIANBJGpBATYCACADQSxqQQA2AgAgA0HswcAANgIgIANB0LvAADYCKCADQQA2AhggASADQRhqEKwCDAILIwBBMGsiAiQAAn8CQAJAAkACQAJAAkBBASAAQQRqIgAtAAAiBEEEayAEQQNNG0H/AXFBAWsOAgECAAsgAiAAQQFqNgIEIAJBFGpBAzYCACACQRxqQQI2AgAgAkEsakGEATYCACACQaS+wAA2AhAgAkEANgIIIAJBggE2AiQgAiAAQRBqNgIgIAIgAkEgajYCGCACIAJBBGo2AiggASACQQhqEKwCDAULIARBAmsOAgIDAQsgAiAAQQRqNgIAIAAtABBBA0YEQCACQRRqQQE2AgAgAkEcakEBNgIAIAJByLzAADYCECACQQA2AgggAkGAATYCJCACIAJBIGo2AhggAiACNgIgIAEgAkEIahCsAgwECyACIABBEGo2AgQgAkEUakECNgIAIAJBHGpBAjYCACACQSxqQYABNgIAIAJBiLzAADYCECACQQA2AgggAkGFATYCJCACIAJBIGo2AhggAiACNgIoIAIgAkEEajYCICABIAJBCGoQrAIMAwsgAiAANgIEIAJBFGpBAjYCACACQRxqQQE2AgAgAkH0vMAANgIQIAJBADYCCCACQYUBNgIkIAIgAkEgajYCGCACIAJBBGo2AiAgASACQQhqEKwCDAILIAIgADYCBCACQRRqQQI2AgAgAkEcakEBNgIAIAJB8L3AADYCECACQQA2AgggAkGFATYCJCACIAJBIGo2AhggAiACQQRqNgIgIAEgAkEIahCsAgwBCyACQRRqQQE2AgAgAkEcakEANgIAIAJBrL3AADYCECACQdC7wAA2AhggAkEANgIIIAEgAkEIahCsAgsgAkEwaiQADAELIABBBGogARCqAQsgA0EwaiQAC/YDAgV+BX8gAUEUai0AACEIIAEoAhAhCUH4BUEEELcDIgcEQCAHQQBB+AUQ6wMhByABKAIsIQoDQEHk7sEAQeTuwQAoAgAiC0EBajYCACALrSIDQvPK0cunjNmy8ACFIgJCEIZC5eABhCACQuHklfPW7Nm87AB8hSIEQrrAhMHS44qUIX0iBSADQoCAgICAgICABISFIAJCsKqA84PS6fnZAH0iAkKl5vmGz86pimSFIgN8IgYgA0INhkLMPISFIgMgBEIViSAFhSIEIAJCIIlC/wGFfCICfCIFIANCEYmFIgNCDYkgAyAEQhCJIAKFIgIgBkIgiXwiBHwiA4UiBkIRiSAGIAJCFYkgBIUiAiAFQiCJfCIEfCIFhSIGQg2JIAYgAkIQiSAEhSICIANCIIl8IgN8hSIEIAJCFYkgA4UiAiAFQiCJfCIDfCIFIAJCEIkgA4VCFYmFIARCEYmFIAVCIImFIgJQDQALIAAgCTYCmAEgACAKNgKgASAAIAc2AkQgAEEANgJAIAAgBzYCBCAAQQA2AgAgACACNwOQASAAIAEpAgA3AoABIABBnAFqIAg6AAAgACABKAIwNgKkASAAQYgBaiABQQhqKQIANwIAAkAgAUEkaigCACIARQ0AIAEoAiBFDQAgABBKCw8LQfgFQQQQ6QMAC4kEAQR/IwBBQGoiASQAIABBCGoiAygCACECIANBADYCAAJAAkACQCACBEAgACgCBCEDQezuwQAoAgAiBEUNASABQRBqIABBFGopAgA3AwAgAUEYaiAAQRxqKQIANwMAIAFBIGogAEEkaikCADcDACABQShqIABBLGopAgA3AwAgAUEwaiAAQTRqKQIANwMAIAFBOGogAEE8aigCADYCACABIAI2AgQgASADNgIAIAEgAEEMaikCADcDCCABIAQQVwJAIAAoAkBBAkkNACAAQcQAaigCACAAQcgAaiICKAIAKAIAEQAAIAIoAgAiAkEEaigCAEUNACACQQhqKAIAGiAAKAJEEEoLIABCATcCQCABIAAoAgAiAC0AAEEBcSICOgA/IABBAToAACACDQJBACECQcTvwQAoAgBB/////wdxBEAQ9gNBAXMhAgsgAC0AAQ0DIABBAToAAgJAIAINAEHE78EAKAIAQf////8HcUUNABD2Aw0AIABBAToAAQsgAEEAOgAAIAFBQGskAA8LQbCawABBK0GYnMAAEMYCAAtB6o3AAEE2QYCPwAAQxgIACyABQQA2AhQgAUGErMAANgIQIAFBATYCDCABQfyrwAA2AgggAUEANgIAIAFBP2ogARChAgALIAEgAjoABCABIAA2AgBB7JrAAEErIAFBmJvAAEGInMAAEI8CAAuJBAEEfyMAQUBqIgEkACAAQQhqIgMoAgAhAiADQQA2AgACQAJAAkAgAgRAIAAoAgQhA0Hs7sEAKAIAIgRFDQEgAUEQaiAAQRRqKQIANwMAIAFBGGogAEEcaikCADcDACABQSBqIABBJGopAgA3AwAgAUEoaiAAQSxqKQIANwMAIAFBMGogAEE0aikCADcDACABQThqIABBPGooAgA2AgAgASACNgIEIAEgAzYCACABIABBDGopAgA3AwggASAEEFYCQCAAKAJAQQJJDQAgAEHEAGooAgAgAEHIAGoiAigCACgCABEAACACKAIAIgJBBGooAgBFDQAgAkEIaigCABogACgCRBBKCyAAQgE3AkAgASAAKAIAIgAtAABBAXEiAjoAPyAAQQE6AAAgAg0CQQAhAkHE78EAKAIAQf////8HcQRAEPYDQQFzIQILIAAtAAENAyAAQQE6AAICQCACDQBBxO/BACgCAEH/////B3FFDQAQ9gMNACAAQQE6AAELIABBADoAACABQUBrJAAPC0GwmsAAQStBmJzAABDGAgALQeqNwABBNkGAj8AAEMYCAAsgAUEANgIUIAFBhKzAADYCECABQQE2AgwgAUH8q8AANgIIIAFBADYCACABQT9qIAEQoQIACyABIAI6AAQgASAANgIAQeyawABBKyABQZibwABBiJzAABCPAgALiQQBBH8jAEFAaiIBJAAgAEEIaiIDKAIAIQIgA0EANgIAAkACQAJAIAIEQCAAKAIEIQNB7O7BACgCACIERQ0BIAFBEGogAEEUaikCADcDACABQRhqIABBHGopAgA3AwAgAUEgaiAAQSRqKQIANwMAIAFBKGogAEEsaikCADcDACABQTBqIABBNGopAgA3AwAgAUE4aiAAQTxqKAIANgIAIAEgAjYCBCABIAM2AgAgASAAQQxqKQIANwMIIAEgBBBbAkAgACgCQEECSQ0AIABBxABqKAIAIABByABqIgIoAgAoAgARAAAgAigCACICQQRqKAIARQ0AIAJBCGooAgAaIAAoAkQQSgsgAEIBNwJAIAEgACgCACIALQAAQQFxIgI6AD8gAEEBOgAAIAINAkEAIQJBxO/BACgCAEH/////B3EEQBD2A0EBcyECCyAALQABDQMgAEEBOgACAkAgAg0AQcTvwQAoAgBB/////wdxRQ0AEPYDDQAgAEEBOgABCyAAQQA6AAAgAUFAayQADwtBsJrAAEErQZicwAAQxgIAC0HqjcAAQTZBgI/AABDGAgALIAFBADYCFCABQYSswAA2AhAgAUEBNgIMIAFB/KvAADYCCCABQQA2AgAgAUE/aiABEKECAAsgASACOgAEIAEgADYCAEHsmsAAQSsgAUGYm8AAQYicwAAQjwIAC4kEAQR/IwBBQGoiASQAIABBCGoiAygCACECIANBADYCAAJAAkACQCACBEAgACgCBCEDQezuwQAoAgAiBEUNASABQRBqIABBFGopAgA3AwAgAUEYaiAAQRxqKQIANwMAIAFBIGogAEEkaikCADcDACABQShqIABBLGopAgA3AwAgAUEwaiAAQTRqKQIANwMAIAFBOGogAEE8aigCADYCACABIAI2AgQgASADNgIAIAEgAEEMaikCADcDCCABIAQQXQJAIAAoAkBBAkkNACAAQcQAaigCACAAQcgAaiICKAIAKAIAEQAAIAIoAgAiAkEEaigCAEUNACACQQhqKAIAGiAAKAJEEEoLIABCATcCQCABIAAoAgAiAC0AAEEBcSICOgA/IABBAToAACACDQJBACECQcTvwQAoAgBB/////wdxBEAQ9gNBAXMhAgsgAC0AAQ0DIABBAToAAgJAIAINAEHE78EAKAIAQf////8HcUUNABD2Aw0AIABBAToAAQsgAEEAOgAAIAFBQGskAA8LQbCawABBK0GYnMAAEMYCAAtB6o3AAEE2QYCPwAAQxgIACyABQQA2AhQgAUGErMAANgIQIAFBATYCDCABQfyrwAA2AgggAUEANgIAIAFBP2ogARChAgALIAEgAjoABCABIAA2AgBB7JrAAEErIAFBmJvAAEGInMAAEI8CAAuJBAEEfyMAQUBqIgEkACAAQQhqIgMoAgAhAiADQQA2AgACQAJAAkAgAgRAIAAoAgQhA0Hs7sEAKAIAIgRFDQEgAUEQaiAAQRRqKQIANwMAIAFBGGogAEEcaikCADcDACABQSBqIABBJGopAgA3AwAgAUEoaiAAQSxqKQIANwMAIAFBMGogAEE0aikCADcDACABQThqIABBPGooAgA2AgAgASACNgIEIAEgAzYCACABIABBDGopAgA3AwggASAEEF4CQCAAKAJAQQJJDQAgAEHEAGooAgAgAEHIAGoiAigCACgCABEAACACKAIAIgJBBGooAgBFDQAgAkEIaigCABogACgCRBBKCyAAQgE3AkAgASAAKAIAIgAtAABBAXEiAjoAPyAAQQE6AAAgAg0CQQAhAkHE78EAKAIAQf////8HcQRAEPYDQQFzIQILIAAtAAENAyAAQQE6AAICQCACDQBBxO/BACgCAEH/////B3FFDQAQ9gMNACAAQQE6AAELIABBADoAACABQUBrJAAPC0GwmsAAQStBmJzAABDGAgALQeqNwABBNkGAj8AAEMYCAAsgAUEANgIUIAFBhKzAADYCECABQQE2AgwgAUH8q8AANgIIIAFBADYCACABQT9qIAEQoQIACyABIAI6AAQgASAANgIAQeyawABBKyABQZibwABBiJzAABCPAgALiQQBBH8jAEFAaiIBJAAgAEEIaiIDKAIAIQIgA0EANgIAAkACQAJAIAIEQCAAKAIEIQNB7O7BACgCACIERQ0BIAFBEGogAEEUaikCADcDACABQRhqIABBHGopAgA3AwAgAUEgaiAAQSRqKQIANwMAIAFBKGogAEEsaikCADcDACABQTBqIABBNGopAgA3AwAgAUE4aiAAQTxqKAIANgIAIAEgAjYCBCABIAM2AgAgASAAQQxqKQIANwMIIAEgBBBZAkAgACgCQEECSQ0AIABBxABqKAIAIABByABqIgIoAgAoAgARAAAgAigCACICQQRqKAIARQ0AIAJBCGooAgAaIAAoAkQQSgsgAEIBNwJAIAEgACgCACIALQAAQQFxIgI6AD8gAEEBOgAAIAINAkEAIQJBxO/BACgCAEH/////B3EEQBD2A0EBcyECCyAALQABDQMgAEEBOgACAkAgAg0AQcTvwQAoAgBB/////wdxRQ0AEPYDDQAgAEEBOgABCyAAQQA6AAAgAUFAayQADwtBsJrAAEErQZicwAAQxgIAC0HqjcAAQTZBgI/AABDGAgALIAFBADYCFCABQYSswAA2AhAgAUEBNgIMIAFB/KvAADYCCCABQQA2AgAgAUE/aiABEKECAAsgASACOgAEIAEgADYCAEHsmsAAQSsgAUGYm8AAQYicwAAQjwIAC4kEAQR/IwBBQGoiASQAIABBCGoiAygCACECIANBADYCAAJAAkACQCACBEAgACgCBCEDQezuwQAoAgAiBEUNASABQRBqIABBFGopAgA3AwAgAUEYaiAAQRxqKQIANwMAIAFBIGogAEEkaikCADcDACABQShqIABBLGopAgA3AwAgAUEwaiAAQTRqKQIANwMAIAFBOGogAEE8aigCADYCACABIAI2AgQgASADNgIAIAEgAEEMaikCADcDCCABIAQQXAJAIAAoAkBBAkkNACAAQcQAaigCACAAQcgAaiICKAIAKAIAEQAAIAIoAgAiAkEEaigCAEUNACACQQhqKAIAGiAAKAJEEEoLIABCATcCQCABIAAoAgAiAC0AAEEBcSICOgA/IABBAToAACACDQJBACECQcTvwQAoAgBB/////wdxBEAQ9gNBAXMhAgsgAC0AAQ0DIABBAToAAgJAIAINAEHE78EAKAIAQf////8HcUUNABD2Aw0AIABBAToAAQsgAEEAOgAAIAFBQGskAA8LQbCawABBK0GYnMAAEMYCAAtB6o3AAEE2QYCPwAAQxgIACyABQQA2AhQgAUGErMAANgIQIAFBATYCDCABQfyrwAA2AgggAUEANgIAIAFBP2ogARChAgALIAEgAjoABCABIAA2AgBB7JrAAEErIAFBmJvAAEGInMAAEI8CAAuJBAEEfyMAQUBqIgEkACAAQQhqIgMoAgAhAiADQQA2AgACQAJAAkAgAgRAIAAoAgQhA0Hs7sEAKAIAIgRFDQEgAUEQaiAAQRRqKQIANwMAIAFBGGogAEEcaikCADcDACABQSBqIABBJGopAgA3AwAgAUEoaiAAQSxqKQIANwMAIAFBMGogAEE0aikCADcDACABQThqIABBPGooAgA2AgAgASACNgIEIAEgAzYCACABIABBDGopAgA3AwggASAEEFoCQCAAKAJAQQJJDQAgAEHEAGooAgAgAEHIAGoiAigCACgCABEAACACKAIAIgJBBGooAgBFDQAgAkEIaigCABogACgCRBBKCyAAQgE3AkAgASAAKAIAIgAtAABBAXEiAjoAPyAAQQE6AAAgAg0CQQAhAkHE78EAKAIAQf////8HcQRAEPYDQQFzIQILIAAtAAENAyAAQQE6AAICQCACDQBBxO/BACgCAEH/////B3FFDQAQ9gMNACAAQQE6AAELIABBADoAACABQUBrJAAPC0GwmsAAQStBmJzAABDGAgALQeqNwABBNkGAj8AAEMYCAAsgAUEANgIUIAFBhKzAADYCECABQQE2AgwgAUH8q8AANgIIIAFBADYCACABQT9qIAEQoQIACyABIAI6AAQgASAANgIAQeyawABBKyABQZibwABBiJzAABCPAgALiQQBBH8jAEFAaiIBJAAgAEEIaiIDKAIAIQIgA0EANgIAAkACQAJAIAIEQCAAKAIEIQNB7O7BACgCACIERQ0BIAFBEGogAEEUaikCADcDACABQRhqIABBHGopAgA3AwAgAUEgaiAAQSRqKQIANwMAIAFBKGogAEEsaikCADcDACABQTBqIABBNGopAgA3AwAgAUE4aiAAQTxqKAIANgIAIAEgAjYCBCABIAM2AgAgASAAQQxqKQIANwMIIAEgBBBYAkAgACgCQEECSQ0AIABBxABqKAIAIABByABqIgIoAgAoAgARAAAgAigCACICQQRqKAIARQ0AIAJBCGooAgAaIAAoAkQQSgsgAEIBNwJAIAEgACgCACIALQAAQQFxIgI6AD8gAEEBOgAAIAINAkEAIQJBxO/BACgCAEH/////B3EEQBD2A0EBcyECCyAALQABDQMgAEEBOgACAkAgAg0AQcTvwQAoAgBB/////wdxRQ0AEPYDDQAgAEEBOgABCyAAQQA6AAAgAUFAayQADwtBsJrAAEErQZicwAAQxgIAC0HqjcAAQTZBgI/AABDGAgALIAFBADYCFCABQYSswAA2AhAgAUEBNgIMIAFB/KvAADYCCCABQQA2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aiICKAIAKAIAEQAAIAIoAgAiAkEEaigCAEUNACACQQhqKAIAGiAAKAJQEEoLIABCATcCTCAAKAIIKAIAIQIgAC0ADCIDBEAgAiACKAIAIgRBAWo2AgAgBEEASA0DIAEgAjYCAAsgACgCACAAQQM2AgBBAkYNAwwEC0GwmsAAQStBmJzAABDGAgALQeqNwABBNkGQj8AAEMYCAAsACyACQUBrIAAoAgQQwQMLAkAgA0UNACABKAIAIgAgACgCACIAQQFrNgIAIABBAUcNACABEGsLIAFBQGskAAu1AwEEfyMAQUBqIgEkACAAQRRqIgMoAgAhAiADQQA2AgACQAJAAkACQCACBEAgACgCECEDQezuwQAoAgAiBEUNASABQRBqIABBIGopAgA3AwAgAUEYaiAAQShqKQIANwMAIAFBIGogAEEwaikCADcDACABQShqIABBOGopAgA3AwAgAUEwaiAAQUBrKQIANwMAIAFBOGogAEHIAGooAgA2AgAgASACNgIEIAEgAzYCACABIABBGGopAgA3AwggASAEEFkCQCAAKAJMQQJJDQAgAEHQAGooAgAgAEHUAGoiAigCACgCABEAACACKAIAIgJBBGooAgBFDQAgAkEIaigCABogACgCUBBKCyAAQgE3AkwgACgCCCgCACECIAAtAAwiAwRAIAIgAigCACIEQQFqNgIAIARBAEgNAyABIAI2AgALIAAoAgAgAEEDNgIAQQJGDQMMBAtBsJrAAEErQZicwAAQxgIAC0HqjcAAQTZBkI/AABDGAgALAAsgAkFAayAAKAIEEMEDCwJAIANFDQAgASgCACIAIAAoAgAiAEEBazYCACAAQQFHDQAgARBrCyABQUBrJAALtQMBBH8jAEFAaiIBJAAgAEEUaiIDKAIAIQIgA0EANgIAAkACQAJAAkAgAgRAIAAoAhAhA0Hs7sEAKAIAIgRFDQEgAUEQaiAAQSBqKQIANwMAIAFBGGogAEEoaikCADcDACABQSBqIABBMGopAgA3AwAgAUEoaiAAQThqKQIANwMAIAFBMGogAEFAaykCADcDACABQThqIABByABqKAIANgIAIAEgAjYCBCABIAM2AgAgASAAQRhqKQIANwMIIAEgBBBWAkAgACgCTEECSQ0AIABB0ABqKAIAIABB1ABqIgIoAgAoAgARAAAgAigCACICQQRqKAIARQ0AIAJBCGooAgAaIAAoAlAQSgsgAEIBNwJMIAAoAggoAgAhAiAALQAMIgMEQCACIAIoAgAiBEEBajYCACAEQQBIDQMgASACNgIACyAAKAIAIABBAzYCAEECRg0DDAQLQbCawABBK0GYnMAAEMYCAAtB6o3AAEE2QZCPwAAQxgIACwALIAJBQGsgACgCBBDBAwsCQCADRQ0AIAEoAgAiACAAKAIAIgBBAWs2AgAgAEEBRw0AIAEQawsgAUFAayQAC7UDAQR/IwBBQGoiASQAIABBFGoiAygCACECIANBADYCAAJAAkACQAJAIAIEQCAAKAIQIQNB7O7BACgCACIERQ0BIAFBEGogAEEgaikCADcDACABQRhqIABBKGopAgA3AwAgAUEgaiAAQTBqKQIANwMAIAFBKGogAEE4aikCADcDACABQTBqIABBQGspAgA3AwAgAUE4aiAAQcgAaigCADYCACABIAI2AgQgASADNgIAIAEgAEEYaikCADcDCCABIAQQXQJAIAAoAkxBAkkNACAAQdAAaigCACAAQdQAaiICKAIAKAIAEQAAIAIoAgAiAkEEaigCAEUNACACQQhqKAIAGiAAKAJQEEoLIABCATcCTCAAKAIIKAIAIQIgAC0ADCIDBEAgAiACKAIAIgRBAWo2AgAgBEEASA0DIAEgAjYCAAsgACgCACAAQQM2AgBBAkYNAwwEC0GwmsAAQStBmJzAABDGAgALQeqNwABBNkGQj8AAEMYCAAsACyACQUBrIAAoAgQQwQMLAkAgA0UNACABKAIAIgAgACgCACIAQQFrNgIAIABBAUcNACABEGsLIAFBQGskAAu1AwEEfyMAQUBqIgEkACAAQRRqIgMoAgAhAiADQQA2AgACQAJAAkACQCACBEAgACgCECEDQezuwQAoAgAiBEUNASABQRBqIABBIGopAgA3AwAgAUEYaiAAQShqKQIANwMAIAFBIGogAEEwaikCADcDACABQShqIABBOGopAgA3AwAgAUEwaiAAQUBrKQIANwMAIAFBOGogAEHIAGooAgA2AgAgASACNgIEIAEgAzYCACABIABBGGopAgA3AwggASAEEFgCQCAAKAJMQQJJDQAgAEHQAGooAgAgAEHUAGoiAigCACgCABEAACACKAIAIgJBBGooAgBFDQAgAkEIaigCABogACgCUBBKCyAAQgE3AkwgACgCCCgCACECIAAtAAwiAwRAIAIgAigCACIEQQFqNgIAIARBAEgNAyABIAI2AgALIAAoAgAgAEEDNgIAQQJGDQMMBAtBsJrAAEErQZicwAAQxgIAC0HqjcAAQTZBkI/AABDGAgALAAsgAkFAayAAKAIEEMEDCwJAIANFDQAgASgCACIAIAAoAgAiAEEBazYCACAAQQFHDQAgARBrCyABQUBrJAALtQMBBH8jAEFAaiIBJAAgAEEUaiIDKAIAIQIgA0EANgIAAkACQAJAAkAgAgRAIAAoAhAhA0Hs7sEAKAIAIgRFDQEgAUEQaiAAQSBqKQIANwMAIAFBGGogAEEoaikCADcDACABQSBqIABBMGopAgA3AwAgAUEoaiAAQThqKQIANwMAIAFBMGogAEFAaykCADcDACABQThqIABByABqKAIANgIAIAEgAjYCBCABIAM2AgAgASAAQRhqKQIANwMIIAEgBBBbAkAgACgCTEECSQ0AIABB0ABqKAIAIABB1ABqIgIoAgAoAgARAAAgAigCACICQQRqKAIARQ0AIAJBCGooAgAaIAAoAlAQSgsgAEIBNwJMIAAoAggoAgAhAiAALQAMIgMEQCACIAIoAgAiBEEBajYCACAEQQBIDQMgASACNgIACyAAKAIAIABBAzYCAEECRg0DDAQLQbCawABBK0GYnMAAEMYCAAtB6o3AAEE2QZCPwAAQxgIACwALIAJBQGsgACgCBBDBAwsCQCADRQ0AIAEoAgAiACAAKAIAIgBBAWs2AgAgAEEBRw0AIAEQawsgAUFAayQAC7UDAQR/IwBBQGoiASQAIABBFGoiAygCACECIANBADYCAAJAAkACQAJAIAIEQCAAKAIQIQNB7O7BACgCACIERQ0BIAFBEGogAEEgaikCADcDACABQRhqIABBKGopAgA3AwAgAUEgaiAAQTBqKQIANwMAIAFBKGogAEE4aikCADcDACABQTBqIABBQGspAgA3AwAgAUE4aiAAQcgAaigCADYCACABIAI2AgQgASADNgIAIAEgAEEYaikCADcDCCABIAQQXgJAIAAoAkxBAkkNACAAQdAAaigCACAAQdQAaiICKAIAKAIAEQAAIAIoAgAiAkEEaigCAEUNACACQQhqKAIAGiAAKAJQEEoLIABCATcCTCAAKAIIKAIAIQIgAC0ADCIDBEAgAiACKAIAIgRBAWo2AgAgBEEASA0DIAEgAjYCAAsgACgCACAAQQM2AgBBAkYNAwwEC0GwmsAAQStBmJzAABDGAgALQeqNwABBNkGQj8AAEMYCAAsACyACQUBrIAAoAgQQwQMLAkAgA0UNACABKAIAIgAgACgCACIAQQFrNgIAIABBAUcNACABEGsLIAFBQGskAAu1AwEEfyMAQUBqIgEkACAAQRRqIgMoAgAhAiADQQA2AgACQAJAAkACQCACBEAgACgCECEDQezuwQAoAgAiBEUNASABQRBqIABBIGopAgA3AwAgAUEYaiAAQShqKQIANwMAIAFBIGogAEEwaikCADcDACABQShqIABBOGopAgA3AwAgAUEwaiAAQUBrKQIANwMAIAFBOGogAEHIAGooAgA2AgAgASACNgIEIAEgAzYCACABIABBGGopAgA3AwggASAEEFoCQCAAKAJMQQJJDQAgAEHQAGooAgAgAEHUAGoiAigCACgCABEAACACKAIAIgJBBGooAgBFDQAgAkEIaigCABogACgCUBBKCyAAQgE3AkwgACgCCCgCACECIAAtAAwiAwRAIAIgAigCACIEQQFqNgIAIARBAEgNAyABIAI2AgALIAAoAgAgAEEDNgIAQQJGDQMMBAtBsJrAAEErQZicwAAQxgIAC0HqjcAAQTZBkI/AABDGAgALAAsgAkFAayAAKAIEEMEDCwJAIANFDQAgASgCACIAIAAoAgAiAEEBazYCACAAQQFHDQAgARBrCyABQUBrJAALtQMBBH8jAEFAaiIBJAAgAEEUaiIDKAIAIQIgA0EANgIAAkACQAJAAkAgAgRAIAAoAhAhA0Hs7sEAKAIAIgRFDQEgAUEQaiAAQSBqKQIANwMAIAFBGGogAEEoaikCADcDACABQSBqIABBMGopAgA3AwAgAUEoaiAAQThqKQIANwMAIAFBMGogAEFAaykCADcDACABQThqIABByABqKAIANgIAIAEgAjYCBCABIAM2AgAgASAAQRhqKQIANwMIIAEgBBBXAkAgACgCTEECSQ0AIABB0ABqKAIAIABB1ABqIgIoAgAoAgARAAAgAigCACICQQRqKAIARQ0AIAJBCGooAgAaIAAoAlAQSgsgAEIBNwJMIAAoAggoAgAhAiAALQAMIgMEQCACIAIoAgAiBEEBajYCACAE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DQIMAQsgAiABNgIAIAENAEGM88EAQYzzwQAoAgBBfiAAKAIcd3E2AgAPCyABIAM2AhggACgCECICBEAgASACNgIQIAIgATYCGAsgAEEUaigCACIARQ0AIAFBFGogADYCACAAIAE2AhgLC9ECAgR/An4jAEFAaiIDJAAgAAJ/IAAtAAgEQCAAKAIAIQVBAQwBCyAAKAIAIQUgAEEEaigCACIEKAIYIgZBBHFFBEBBASAEKAIAQbHNwQBBy83BACAFG0ECQQEgBRsgBCgCBCgCDBEDAA0BGiABIAQgAigCDBEBAAwBCyAFRQRAIAQoAgBByc3BAEECIAQoAgQoAgwRAwAEQEEAIQVBAQwCCyAEKAIYIQYLIANBAToAFyADQZDNwQA2AhwgAyAEKQIANwMIIAMgA0EXajYCECAEKQIIIQcgBCkCECEIIAMgBC0AIDoAOCADIAQoAhw2AjQgAyAGNgIwIAMgCDcDKCADIAc3AyAgAyADQQhqNgIYQQEgASADQRhqIAIoAgwRAQANABogAygCGEGvzcEAQQIgAygCHCgCDBEDAAs6AAggACAFQQFqNgIAIANBQGskACAAC6MCAQR/IABCADcCECAAAn9BACABQYACSQ0AGkEfIAFB////B0sNABogAUEGIAFBCHZnIgJrdkEBcSACQQF0a0E+agsiAzYCHCADQQJ0QfDvwQBqIQICQAJAAkACQEGM88EAKAIAIgRBASADdCIFcQRAIAIoAgAhAiADEKEDIQMgAhDlAyABRw0BIAIhAwwCC0GM88EAIAQgBXI2AgAgAiAANgIADAMLIAEgA3QhBANAIAIgBEEddkEEcWpBEGoiBSgCACIDRQ0CIARBAXQhBCADIgIQ5QMgAUcNAAsLIAMoAggiASAANgIMIAMgADYCCCAAIAM2AgwgACABNgIIIABBADYCGA8LIAUgADYCAAsgACACNgIYIAAgADYCCCAAIAA2AgwLugMBA38jAEEgayIBJAAgACgCACECIABBAjYCAAJAAkACQCACDgMCAQIACyABQRRqQQE2AgAgAUEcakEANgIAIAFBmKfBADYCECABQciSwQA2AhggAUEANgIIIAFBCGpBoKfBABDfAgALIAAtAAQhAiAAQQE6AAQgASACQQFxIgI6AAcCQAJAIAJFBEAgAEEEaiECAkBBxO/BACgCAEH/////B3EEQBD2AyEDIAAtAAUEQCADQQFzIQMMAgsgA0UNBAwDCyAALQAFRQ0CCyABIAM6AAwgASACNgIIQYCVwQBBKyABQQhqQbimwQBBsKfBABCPAgALIAFBADYCHCABQciSwQA2AhggAUEBNgIUIAFB6KXBADYCECABQQA2AggjAEEgayIAJAAgAEHoksEANgIEIAAgAUEHajYCACAAQRhqIAFBCGoiAUEQaikCADcDACAAQRBqIAFBCGopAgA3AwAgACABKQIANwMIQQAgAEHsksEAIABBBGpB7JLBACAAQQhqQaimwQAQnQEAC0HE78EAKAIAQf////8HcUUNABD2Aw0AIABBAToABQsgAkEAOgAACyABQSBqJAAL+wEBBH8jAEEQayIBJAACQCAAKAIoIgANACABEKkDAkACQCABKAIABEAgAUEIaigCACIARQ0BIAEoAgRFDQEgABBKDAELIAFBCGooAgAiAkUNACABKAIEIAEgAiABQQxqKAIAENUBIAEoAgQhACABLQAAIQQEQCACEEoLIAQNACAARQ0BDAILIAEQqQMgASgCAARAIAFBCGooAgAiAEUNASABKAIERQ0BIAAQSgwBCyABQQhqKAIAIgJFDQAgASgCBCABIAIgAUEMaigCABDVASABKAIEIQAgAS0AACEEBEAgAhBKCyAEDQAgAA0BC0EBIQALIAFBEGokACAAC78DAQZ/IwBBIGsiAyQAAkAgACgCACIEIAAoAgQiBUkEQCAAKAIIIQggBSAEayEHA0ACQCAILQAARQRAIANBEGohAAJAAkBBgARBBBC3AyIGBEBBCEEEELcDIgVFDQEgBUHAADYCBCAFIAY2AgBBwAFBwAAQtwMiBEUNAiAEQgA3A4ABIAQgBTYCQCAEQoGAgIAQNwMAIAAgBDYCCCAAQQE6AAwgAEHAADYCBCAAIAY2AgAMBAtBgARBBBDpAwALQQhBBBDpAwALQcABQcAAEOkDAAsgA0EQahCQAgsgAygCGCIEIAQoAgAiAEEBajYCACAAQQBIDQIgA0EIaiIFIANBGGopAwA3AwAgAyADKQMQNwMAIAMtABwhBiABKAIIIgAgASgCAEYEQCABIAAQ6QEgASgCCCEACyABKAIEIABBBHRqIgAgAykDADcCACAAQQhqIAUpAwA3AgAgASABKAIIQQFqNgIIIAIoAggiACACKAIARgRAIAIgABDtASACKAIIIQALIAIoAgQgAEEDdGoiACAGOgAEIAAgBDYCACACIAIoAghBAWo2AgggB0EBayIHDQALCyADQSBqJAAPCwALsQIDAX8DfQF+AkAgASoCACIDIAFBBGoqAgAiBV8EQCAFIAOTQ/7/fz+VIgS8Qf////8Hcb5DAACAf11FDQEgACgCACEBIAUgAyAEQ/7/fz+Ukl0EQANAIAMgBLxBAWu+IgRD/v9/P5SSIAVeDQALCyABQQhqIQIgAUGIAmooAgAiAEHAAE8EQCABQZACaiEAAkACQCABQcgCaikDACIGQgBXDQAgAUHQAmooAgBBAEgNACABIAZCgAJ9NwPIAiAAIAIQNwwBCyAAIAJBABDkAQsgAUEANgKIAkEAIQALIAIgAEECdGooAgAhAiABIABBAWo2AogCIAMgBCACQQl2QYCAgPwDcr5DAACAv5KUkg8LQbyVwABBGUGslsAAEMYCAAtB3JDAAEEmQcyQwAAQxgIAC5UCAQF/IwBBEGsiAiQAIAAoAgAhAAJ/AkAgASgCCEEBRwRAIAEoAhBBAUcNAQsgAkEANgIMIAEgAkEMagJ/IABBgAFPBEAgAEGAEE8EQCAAQYCABE8EQCACIABBP3FBgAFyOgAPIAIgAEESdkHwAXI6AAwgAiAAQQZ2QT9xQYABcjoADiACIABBDHZBP3FBgAFyOgANQQQMAwsgAiAAQT9xQYABcjoADiACIABBDHZB4AFyOgAMIAIgAEEGdkE/cUGAAXI6AA1BAwwCCyACIABBP3FBgAFyOgANIAIgAEEGdkHAAXI6AAxBAgwBCyACIAA6AAxBAQsQTwwBCyABKAIAIAAgASgCBCgCEBEBAAsgAkEQaiQAC2ABDH9B+PDBACgCACICBEBB8PDBACEGA0AgAiIBKAIIIQIgASgCBCEDIAEoAgAhBCABQQxqKAIAGiABIQYgBUEBaiEFIAINAAsLQbDzwQBB/x8gBSAFQf8fTRs2AgAgCAutCQIOfwR+IwBBEGsiBSQAIABBATYClAggBSAANgIMIAAoApAIIgJBAWoiAQRAIAAgATYCkAgCQCACDQAgAEEIaiICKAIAQcABaigCACEBIAAgACgCmAgiA0EBajYCmAggACABQQFyNgIEIANB/wBxDQAgAigCAEFAayAFQQxqED4LIAUgBSgCDDYCBCAAQQhqIgEoAgBBQGsgAEEMahBGAkAgBSgCBCICRQ0AIAIgAigCkAgiA0EBazYCkAggA0EBRw0AIAJBADYCBCACKAKUCA0AIAIQ0wELIABBADYClAggACAAKAIAQQFyNgIAIAUgASgCACIANgIIIAAgACgCACIAQQFrNgIAIABBAUYEQAJAIwBBIGsiByQAAkAgBUEIaigCACIIQYACaigCAEF8cSIABEADQCAHIAAoAgAiBEEDcSICNgIEIAJBAUcNAiMAQSBrIgIkAAJAIABBjAhqKAIAIgNBwQBJBEAgAwRAIABBDGohASADQQR0IQNBwInBACkCACEQQciJwQApAgAhEQNAIAEpAgAhDyABIBA3AgAgAkEIaiABQQhqIgYpAgAiEjcDACAGIBE3AgAgAiAPNwMAIAJBGGogEjcDACACIA83AxAgAkEQaiACKAIcEQAAIAFBEGohASADQRBrIgMNAAsLIAAQSiACQSBqJAAMAQsgA0HAAEHQicEAENEDAAsgBEF8cSIADQALC0IAIQ8jAEGwEGsiASQAIAhBQGsiBkFAayEMIAFBNGohDiABQSBqQQRyIQICQAJAA0BBACEJIAYoAgAiAEF8cSINKAKICCIDQXxxIgQEQCABQRhqIAYgACADQQFBABB1AkAgASgCGARAA0AgBigCACIAQXxxIg0oAogIIgNBfHEiBEUNAiABQRBqIAYgACADQQFBABB1IAEoAhANAAsLIAwoAgAgAEYEQCABQQhqIAwgACADQQFBABB1CyANEEogBCgCECEJIAQpAgghDyAEKAIEIQogBCgCACELIAFBqAhqIARBFGpB9AcQ7QMaCwsgASAJNgIwIAEgDzcDKCABIAo2AiQgASALNgIgIA4gAUGoCGpB9AcQ7QMaIAkEQCABKAKkCCIAQcEATw0CIABFDQEgAEEEdCEDIAIhAANAIAApAgAhDyAAQcCJwQApAgA3AgAgAUGoEGogAEEIaiIEKQIAIhA3AwAgBEHIicEAKQIANwIAIAEgDzcDoBAgAUGwCGogEDcDACABIA83A6gIIAFBqAhqIAEoArQIEQAAIABBEGohACADQRBrIgMNAAsMAQsLIAYoAgBBfHEQSiABQbAQaiQADAELIABBwABB0InBABDRAwALAkAgCEF/Rg0AIAggCCgCBCIAQQFrNgIE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BCkDSDcDGCACIAooAgA2AgAgFiAELwEsOwAAIAYgCy0AADoAACAEIAQpAzA3A0ggBCAFOgBUIAQgEjYCZCAEICA2AmAgBCANQQFxOgBcIAQgHTYCWCAiIAQpAxg3AgAgIkEIaiAbKAIANgIAIAQgBzYCeCAEIBc2AnQgBEFAayEgIwBBgAFrIgokACAKQQhqIgJBADYCACACQQxqQQA2AgACQAJAAkAgBEHIAGoiAkEkaigCACILBEAgAkEoaigCACEFIApB2ABqIApBGGooAgA2AgAgCkHQAGogCkEQaikDADcDACAKIAopAwg3A0gCQCAFRQRAQQEhBgwBCyAFQQBOIgdFDQIgBSAHELcDIgZFDQMLIAogBjYCNCAKIAU2AjAgBiALIAUQ7QMaIAogBTYCOCAKQQhqIQYgCkEwaiELIApByABqIgdBCGohBQJAIAdBDGooAgAiDUUNACAFKAIARQ0AIA0QSgsgBSALKQIANwIAIAVBCGogC0EIaigCADYCACAGIAcpAgA3AgAgBkEIaiAFKQIANwIAIAZBEGogB0EQaigCADYCAAsgAigCGEEBRgRAIAJBHGooAgAhBiAKQdgAaiAKQRhqKAIANgIAIApB0ABqIApBEGopAwA3AwAgCiAKKQMINwNIIApByABqIgUgBjYCBCAFQQE2AgAgCkEIaiIGIAUpAgA3AgAgBkEIaiAFQQhqKQIANwIAIAZBEGogBUEQaigCADYCAAsgCkFAayAKQRhqKAIANgIAIApBOGogCkEQaikDADcDACAKIAopAwg3AzAgCkH4AGogAkEwaigCADYCACAKQfAAaiACQShqKQIANwMAIApB6ABqIAJBIGopAgA3AwAgCkHgAGogAkEYaikCADcDACAKQdgAaiACQRBqKQIANwMAIApB0ABqIAJBCGopAgA3AwAgCiACKQIANwNIIwBB8ABrIgckACAKQTBqIgIoAhAhCyACKAIMIQUgAigCCCENIAIoAgQaIAIoAgAhBiAHQcgAaiAKQcgAaiICQTBqKAIANgIAIAdBQGsgAkEoaikCADcDACAHQThqIAJBIGopAgA3AwAgB0EwaiACQRhqKQIANwMAIAdBKGogAkEQaikCADcDACAHQSBqIAJBCGopAgA3AwAgByACKQIANwMYIAZFBEACf0Gs78EAKAIAIgIEQCACQQFrDAELQazvwQBBgSA2AgBBAAsaCyAKQSBqIR0CQAJAAkACQAJAIAcCfyAFBH8gByALNgJYIAcgBTYCVCAHIA02AlAgB0HgAGoiAiAHQdAAaiIFKQIANwIAIAJBCGogBUEIaigCADYCACAHKAJkIQsCQCAHKAJoIgJBCE8EQCAHQRBqQQAgCyACEMcBIAcoAhQhBSAHKAIQIQYMAQsgAkUEQEEAIQVBACEGDAELIAstAABFBEBBASEGQQAhBQwBC0EBIQYCQCACQQFGDQAgCy0AAUUEQEEBIQUMAgtBAiEFIAJBAkYNACALLQACRQ0BQQMhBSACQQNGDQAgCy0AA0UNAUEEIQUgAkEERg0AIAstAARFDQFBBSEFIAJBBUYNACALLQAFRQ0BIAIhBUEAIQYgAkEGRg0BIAJBBiALLQAGIgYbIQUgBkUhBgwBCyACIQVBACEGCyAGDQIgB0HYAGogB0HoAGooAgA2AgAgByAHKQNgNwNQIAdBCGohEiMAQSBrIgUkAAJAAkACQAJAIAdB0ABqIgIoAgAiCyACKAIIIgZGBEAgBkEBaiILRQ0CIAtBf3NBH3YhDQJAIAYEQCAFQQE2AhggBSAGNgIUIAUgAkEEaigCADYCEAwBCyAFQQA2AhgLIAUgCyANIAVBEGoQ+QEgBSgCBCENIAUoAgANASACIAs2AgAgAiANNgIECyAGIAtHDQMMAgsgBUEIaigCACILQYGAgIB4Rg0BIAtFDQAgDSALEOkDAAsQ2AIACyACIAYQ9gEgAigCACELIAIoAgghBgsgAiAGQQFqIg02AgggAigCBCICIAZqQQA6AAACQAJAAkAgCyANTQRAIAIhBgwBCyANRQRAQQEhBiACEEoMAQsgAiALQQEgDRCnAyIGRQ0BCyASIA02AgQgEiAGNgIAIAVBIGokAAwBCyANQQEQ6QMACyAHKAIMIQYgBygCCAVBAAshCyMAQRBrIgUkACAFQQhqEI4CIAUoAgwhDSAFKAIIIRIgBRCOAiAFKAIEIQIgBSgCACIbBEAgGyACELcDIQILAkAgAgRAIAJCgYCAgBA3AgAgAiAGNgIMIAIgCzYCCEHI78EAKQMAISMDQCAjQgF8IiRQDQJByO/BACAkQcjvwQApAwAiJSAjICVRIgYbNwMAICUhIyAGRQ0ACyACQQA7ARQgAkEQakEANgIAIAJBGGogJDcDACAFQRBqJAAgAgwCCyASIA0Q6QMACyMAQSBrIgAkACAAQRRqQQE2AgAgAEEcakEANgIAIABB6JTBADYCECAAQciSwQA2AhggAEEANgIIIABBCGpB8JTBABDfAgALIgs2AkwgCyALKAIAIgJBAWo2AgAgAkEASA0BQRhBBBC3AyIFRQ0CIAVCADcCCCAFQoKAgIAQNwIAIAcgBTYCYEEAENICIgYEQCAGIAYoAgAiAkEBajYCACACQQBIDQILIAcgBhDSAiICNgJQAkAgAkUNACACIAIoAgAiAkEBazYCACACQQFHDQAgB0HQAGoQwwILIAcoAmAiDSgCCCISBEACQCMAQSBrIgIkACASQQhqIhIgEigCACIbQQFqNgIAIBtBAE4EQCACQSBqJAAMAQsgEkEAEOcCIAJBFGpBATYCACACQRxqQQA2AgAgAkHQk8EANgIQIAJByJLBADYCGCACQQA2AgggAkEIakH4k8EAEN8CAAsLQcAAQQQQtwMiAkUNAyACIAY2AgAgAiAHKQMYNwIEIAIgBTYCPCACIAs2AjggAkEMaiAHQSBqKQMANwIAIAJBFGogB0EoaikDADcCACACQRxqIAdBMGopAwA3AgAgAkEkaiAHQThqKQMANwIAIAJBLGogB0FAaykDADcCACACQTRqIAdByABqKAIANgIAIAdB0ABqQoKAgICAypQINwIAIAJBqIfBACgCABEAAEGsh8EAKAIABEBBsIfBACgCABogAhBKCyAHKQNQISMgDSANKAIAIgJBAWs2AgAgAkEBRgRAIAdB4ABqENYBCyAHKAJMIgIgAigCACICQQFrNgIAIAJBAUYEQCAHQcwAahC4AgsgHUEBNgIAIB0gIzcCBCAHQfAAaiQADAQLIAcoAmAhACAHIAI2AlwgByALNgJYIAcgADYCVCAHIAU2AlBBuIfBAEEvIAdB0ABqQeiHwQBByIjBABCPAgALAAtBGEEEEOkDAAtBwABBBBDpAwALICAgCikCJDcCACAKQYABaiQADAILENgCAAsgBSAHEOkDAAsgBC0AQEEERg0BIBkgBCkDQDcCACAJIBVHBEBBACAUQXBxayECQRghCQNAIAMgCWoiBSgCACIGIAYoAgAiBkEBazYCACAGQQFGBEAgBRC3AgsgAiAJQRBqIglqQRhHDQALCyAcBEAgDxBKCyAIIBBHBEBBACAaQXhxayEDQQghCANAIAAgCGoiAigCACIFIAUoAgAiBUEBazYCACAFQQFGBEAgAhC3AgsgAyAIQQhqIghqQQhHDQALCyAhBEAgExBKCyAEKAIUIgNBiAJqIgAgACgCACIAQQFrNgIAAkAgAEEBRw0AIANBlAJqKAIAIgBFDQAgA0GQAmooAgAhCCAAQRhsIQAgA0HwAWohAkEAIQMDQCAIQQRqIgUgBSgCACIFQQFrNgIAIAVBAUYEQCAIQQM2AgAgAiADENQBGgsgCEEYaiEIIANBAWohAyAAQRhrIgANAAsLIAQoAhQiACAAKAIAIgBBAWs2AgAgAEEBRw0IIARBFGoQbAwICwALIBdBAWohFyAUQRBrIRQgGkEIayEaIAghACAVIAkiA0cNAAsMBAtBwAJBwAAQ6QMAC0H4BUEEEOkDAAsgA0HAABDpAwALIAkgFUcEQCAVIAlrQXBxIQMgCUEIaiEIA0AgCCgCACICIAIoAgAiAkEBazYCACACQQFGBEAgCBC3AgsgCEEQaiEIIANBEGsiAw0ACwsgACEICyAcBEAgDxBKCyAIIBBHBEAgECAIa0F4cSEDA0AgCCgCACIAIAAoAgAiAEEBazYCACAAQQFGBEAgCBC3AgsgCEEIaiEIIANBCGsiAw0ACwsgIQRAIBMQSgsgGSAEKAIUNgIEIBlBBToAAAsCQCAMKAIAIgBFDQAgACAMKAIEKAIAEQAAIAwoAgQiAEEEaigCAEUNACAAQQhqKAIAGiAMKAIAEEoLAkAgDCgCCCIARQ0AIAAgDEEMaiIAKAIAKAIAEQAAIAAoAgAiAEEEaigCAEUNACAAQQhqKAIAGiAMKAIIEEoLAkAgDCgCECIARQ0AIAAgDEEUaiIAKAIAKAIAEQAAIAAoAgAiAEEEaigCAEUNACAAQQhqKAIAGiAMKAIQEEoLAkAgDCgCGCIARQ0AIAAgDEEcaiIAKAIAKAIAEQAAIAAoAgAiAEEEaigCAEUNACAAQQhqKAIAGiAMKAIYEEoLIARBgAFqJAACQAJAAkAgAS0AECIAQQVGIABBBEZyDQACfwJAAkACQAJAIABBAWsOAwECAwALIAEoAhQaQSgMAwsgAS0AEQwCCyABKAIULQAIDAELIAEoAhQtAAgLQf8BcUEkRw0AQezuwQAoAgBFDQELIB4gASkDEDcCAAwBCyABQQA6AEQgAUEBNgJAIAFBADYCOCABQQA2AjAgAUEANgIoIAFBADYCICABQQA2AhggAUEYahDOASEAIAEgAS0ARDoATyABQZABaiIFQgQ3AwAgAUIANwOIASABQoCAgIDAADcDgAEgAUGMAWohCAJAQf8BIAAgAEH/AU8bIgNFDQAgAUGAAWogAxDnASABKAKMASABKAKUASIAayADTw0AIAFBjAFqIAAgAxDmAQsgASADNgLMAiABQQA2AsgCIAEgAUHPAGo2AtACIAFByAJqIAFBgAFqIAgQzwEgASgCgAEhDSABKAKEASECIAEoAogBIRAgASgCjAEhCSABKAKQASEAIAEoApQBIQ8gBUIENwMAIAFCADcDiAEgAUKAgICAwAA3A4ABAkAgA0UNACABQYABaiADEOcBIAEoAowBIAEoApQBIgVrIANPDQAgAUGMAWogBSADEOYBCyADIAFBgAFqIgYgCBDZASABQdgAaiABQYgBaigCADYCACABIAEpA4ABNwNQIAEoAowBIRcgASgCkAEhBSABKAKUASETIAEgADYCjAEgASAAIA9BA3RqNgKIASABIAA2AoQBIAEgCTYCgAEgAUHwAGogBhDCAQJAAkACQAJAAkACQAJAAkAgA0UEQEHAACEPDAELIANBBnQiCEHAABC3AyIPRQ0BQQAhAANAIAAgD2oiCUEAOwEAIAlBAmpBADoAACAIIABBQGsiAEcNAAsLQfgFQQQQtwMiAEUNASAAQQBB+AUQ6wMhACABQYoBaiABQdgAaigCADYBACABIAEpA1A3AYIBIAEoAhghCCABQQA2AhggASgCKCEGIAFBADYCKCABKAIwIQQgAUEANgIwIAEgASkBgAE3A8gCIAEgAUGGAWopAQA3Ac4CIAFBLGooAgAhByABQTRqKAIAIQogASgCHCEMQcACQcAAELcDIglFDQIgCUEAOwHAASAJIAA2AoQBIAlBADYCgAEgCSAANgJEIAlBADYCQCAJQoGAgIAQNwMAIAkgASkDyAI3AcIBIAlBATYCiAIgCSADNgKEAiAJIA82AoACIAkgAzYC/AEgCUEANgL4ASAJQQM2AvABIAlBAzYC6AEgCSAKNgLkASAJIAQ2AuABIAkgBzYC3AEgCSAGNgLYASAJIAw2AtQBIAkgCDYC0AEgCUHIAWogASkB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IigCACENQQAhA0EAIREjAEHwAGsiBCQAAkACQAJAAkACQAJAAkACQCACKAIAIgkgCEcgAkEEaigCACIKIA1HckUEQCAIQf////8DcSAIRw0HIAhBAnStIA2tfiIwQiCIpw0HAkAgMKciBUUEQEEBIQ4MAQsgBUEATiIBRQ0GIAUgARC4AyIORQ0FCwJAAkACQCANRSAIRXJFBEAgAkEQaigCACEVIAJBDGooAgAhCSAIQQJ0IQ9BACEKA0AgCkEBaiEKIAghByADIQEDQCABQXxGDQMgAUEEaiICIBVLDQQgAiAFSw0FIAEgDmogASAJaigAADYAACACIQEgB0EBayIHDQALIAMgD2ohAyAKIA1HDQALCyAMIAU2AhAgDCAONgIMIAwgBTYCCCAMIA02AgQgDCAINgIADAQLQXxBAEHIpsAAENIDAAsgAUEEaiAVQcimwAAQ0QMACyABQQRqIAVBsKXAABDRAwALIAlB/////wNxIAlHDQYgDa0iNCAJQQJ0rX4iMEIgiKcNBgJAIDCnIhNFBEBBBCEVDAELIBNB/////wFLDQUgE0ECdCIDQQBIDQUgE0GAgICAAklBAnQhASADBH8gAyABELgDBSABCyIVRQ0DC0GgqsAAKgIAISxBjKrAACgCACEXIARCgICAgMAANwMoAkAgDUUNACAKsyANs5UiLkMAAIA/lyIvICyUIS0gCUECdCEWIAqtIjBCAX0hMiACQRBqKAIAIRggAkEMaigCACEcA0AgBEEANgIwIC0gLiARs0MAAAA/kpQiKJKNIidDAAAA32AhAUL///////////8AAn4gJ4tDAAAAX10EQCAnrgwBC0KAgICAgICAgIB/C0KAgICAgICAgIB/IAEbICdD////Xl4bQgAgJyAnWxsiMyAwIDAgM1UbITUgKCAtk44iJ0MAAADfYCEBAkBC////////////AAJ+ICeLQwAAAF9dBEAgJ64MAQtCgICAgICAgICAfwtCgICAgICAgICAfyABGyAnQ////15eG0IAICcgJ1sbIjEgMiAxIDJTG0IAIDFCAFkbIjGnIgMgNSAxQgF8IDMgMUL/////D4NVG6ciB08NACAoQwAAAL+SISkgFygCFCEOQwAAAAAhJyADIQEDQCABQQFqQQEgAbMgKZMgL5UgDhEKACEoIAQoAjAiASAEKAIoRgRAIARBKGogARDoASAEKAIwIQELIAQoAiwgAUECdGogKDgCACAEIAQoAjAiD0EBaiIFNgIwICcgKJIhJyIBIAdHDQALIAVFDQAgBCgCLCIHIQEgBUEDcSICBEADQCABIAEqAgAgJ5U4AgAgAUEEaiEBIAJBAWsiAg0ACwsgD0H/////A3FBA0kNACAHIAVBAnRqIQIDQCABIAEqAgAgJ5U4AgAgAUEEaiIFIAUqAgAgJ5U4AgAgAUEIaiIFIAUqAgAgJ5U4AgAgAUEMaiIFIAUqAgAgJ5U4AgAgAUEQaiIBIAJHDQALCwJAIAlFDQAgCSARbCEdIAMgFmxBBGohAiAKIAMgAyAKSRsiJiADa0EBaiEDQQAhDwJAA0ACQCAEKAIwIgFFBEBDAAAAACEnQwAAAAAhKEMAAAAAISlDAAAAACEqDAELIAQoAiwhByABQQJ0IQ5DAAAAACEqIAIhASADIQVDAAAAACEpQwAAAAAhKEMAAAAAIScCQAJAA0AgBUEBayIFBEAgAUUNAiABIBhLDQMgKiAHKgIAIisgASAcakEEaygAACIUQRh2s5SSISogJyArIBRB/wFxs5SSIScgKSArIBRBEHZB/wFxs5SSISkgKCArIBRBCHZB/wFxs5SSISggASAWaiEBIAdBBGohByAOQQRrIg4NAQwECwsgBEHcAGpBBDYCACAEQcQAakECNgIAIARBzABqQQI2AgAgBCAmNgJkIAQgDzYCYCAEQdylwAA2AkAgBEEANgI4IARBBDYCVCAEIAo2AmwMDQtBfCABQcimwAAQ0gMACyABIBhByKbAABDRAwALIA8gHWpBAnQiBUEEaiEBIAVBfEcEQCABIBNLDQIgFSAFQQJ0aiIBICo4AgwgASApOAIIIAEgKDgCBCABICc4AgAgAkEEaiECIA9BAWoiDyAJRg0DDAELC0F8IAFBsKXAABDSAwALIAEgE0GwpcAAENEDAAsgEUEBaiIRIA1HDQALIAQoAihFDQAgBCgCLBBKCyAIQf////8DcSAIRw0GIAhBAnStIDR+IjBCIIinDQYCQCAwpyIRRQRAQQEhFgwBCyARQQBOIgFFDQUgESABELgDIhZFDQILIAwgDTYCBCAMIAg2AgAgDEEQaiARNgIAIAxBDGogFjYCACAMQQhqIBE2AgAgBEKAgICAwAA3AygCQCAIRQ0AIAmzIAizlSItQwAAgD+XIi4gLJQhLCAJQQJ0IRggCUEEdCEcIAmtIjBCAX0hMkEAIQ8DQCAEQQA2AjAgLCAtIA+zQwAAAD+SlCIoko0iJ0MAAADfYCEBQv///////////wACfiAni0MAAABfXQRAICeuDAELQoCAgICAgICAgH8LQoCAgICAgICAgH8gARsgJ0P///9eXhtCACAnICdbGyIzIDAgMCAzVRshNCAoICyTjiInQwAAAN9gIQECQEL///////////8AAn4gJ4tDAAAAX10EQCAnrgwBC0KAgICAgICAgIB/C0KAgICAgICAgIB/IAEbICdD////Xl4bQgAgJyAnWxsiMSAyIDEgMlMbQgAgMUIAWRsiMaciBSA0IDFCAXwgMyAxQv////8Pg1UbpyIHTw0AIChDAAAAv5IhKSAXKAIUIQpDAAAAACEnIAUhAQNAIAFBAWpBASABsyApkyAulSAKEQoAISggBCgCMCIBIAQoAihGBEAgBEEoaiABEOgBIAQoAjAhAQsgBCgCLCABQQJ0aiAoOAIAIAQgBCgCMCIMQQFqIgM2AjAgJyAokiEnIgEgB0cNAAsgA0UNACAEKAIsIgchASADQQNxIgIEQANAIAEgASoCACAnlTgCACABQQRqIQEgAkEBayICDQALCyAMQf////8DcUEDSQ0AIAcgA0ECdGohAgNAIAEgASoCACAnlTgCACABQQRqIgMgAyoCACAnlTgCACABQQhqIgMgAyoCACAnlTgCACABQQxqIgMgAyoCACAnlTgCACABQRBqIgEgAkcNAAsLAkAgDUUNACAFQQJ0QQRqIQogFSAFQQR0aiEDIAkgBSAFIAlJGyIdIAVrQQFqIQxBACEUAkACQAJAAkADQAJAIAQoAjAiAUUEQEMAAAAAISdDAAAAACEoQwAAAAAhKUMAAAAAISoMAQsgBCgCLCEHIAFBAnQhDkMAAAAAISogCiECIAMhASAMIQVDAAAAACEpQwAAAAAhKEMAAAAAIScCQAJAA0AgBUEBayIFBEAgAkUNAiACIBNLDQMgAkEEaiECICcgASoCACAHKgIAIiuUkiEnICogAUEMaioCACArlJIhKiApIAFBCGoqAgAgK5SSISkgKCABQQRqKgIAICuUkiEoIAFBEGohASAHQQRqIQcgDkEEayIODQEMBAsLIARB3ABqQQQ2AgAgBEHEAGpBAjYCACAEQcwAakECNgIAIAQgFDYCZCAEIB02AmAgBEHcpcAANgJAIARBADYCOCAEQQQ2AlQgBCANNgJsDBALQXwgAkHIpsAAENIDAAsgAiATQcimwAAQ0QMACyAEQwAAAAAgJ0MAAH9DliAnQwAAAABdGzgCOCAEQSBqIARBOGoQzwIgBC0AIEEBcUUEQEGMpsAAQStBwKjAABDGAgALIAQtACEhBSAEQwAAAAAgKEMAAH9DliAoQwAAAABdGzgCOCAEQRhqIARBOGoQzwIgBC0AGEEBcQRAIAQtABkhByAEQwAAAAAgKUMAAH9DliApQwAAAABdGzgCOCAEQRBqIARBOGoQzwIgBC0AEEEBcUUNAiAELQARIQ4gBEMAAAAAICpDAAB/Q5YgKkMAAAAAXRs4AjggBEEIaiAEQThqEM8CIAQtAAhBAXFFDQMgCCAUbCAPakECdCICQQRqIQEgAkF8Rg0EIAEgEUsNBSACIBZqIAQtAAlBGHQgDkEQdHIgB0EIdHIgBXI2AAAgCiAYaiEKIAMgHGohAyAUQQFqIhQgDUYNBgwBCwtBjKbAAEErQbCowAAQxgIAC0GMpsAAQStBoKjAABDGAgALQYymwABBK0GQqMAAEMYCAAtBfCABQbClwAAQ0gMACyABIBFBsKXAABDRAwALIA9BAWoiDyAIRw0ACyAEKAIoRQ0AIAQoAiwQSgsgEwRAIBUQSgtBASAXKAIAEQAAIBdBBGooAgBFDQAgF0EIaigCABpBARBKCyAEQfAAaiQADAYLIBEgARDpAwALIAMgARDpAwALIAUgARDpAwALENgCAAsgBCAJNgJoIAQgBEHQAGo2AkggBCAEQegAajYCWCAEIARB4ABqNgJQIARBOGpB2KbAABDfAgALENQDAAsgBkGoAWogBkGQAWooAgA2AgAgBkGgAWogBkGIAWopAwA3AwAgBiAGKQOAATcDmAEgGygCCCEBIBsoAgwhAiAGQQhqIBsQ4AMgBkEwaiAGQZgBaiABIAIgBigCCCAGKAIMENACICUoAgAEQCAGKAJ0EEoLIBIgBikDMDcCACASQSBqIAZB0ABqKAIANgIAIBJBGGogBkHIAGopAwA3AgAgEkEQaiAGQUBrKQMANwIAIBJBCGogBkE4aikDADcCACASQSRqIRIgJCIBICFHDQALCyAeIBI2AgQgHiAaNgIAIAZBsAFqJABBBCEDIAtBBGooAgAhAiAZKAIMIQggC0KAgICAwAA3AgAgHygCACEFIB9BBDYCACALQQQ2AgxBBCEBIAIgBUcEQCAFIAJrQSRuQSRsIQMgAkEcaiEBA0AgAUEEaygCAARAIAEoAgAQSgsgAUEkaiEBIANBJGsiAw0ACyALQQhqKAIAIQMgC0EEaigCACEBCyAAIAggGmtBJG42AgggACAaNgIEIAAgIDYCACABIANHBEAgAyABa0EkbkEkbCEDIAFBHGohAQNAIAFBBGsoAgAEQCABKAIAEEoLIAFBJGohASADQSRrIgMNAAsLIAsoAgAEQCALKAIMEEoLIBlBEGokACAQQSBqJAALdwEBfwJAIAEoAgBFBEAgAEGABDsBBEEMQQQQtwMiAkUNASACIAEpAgA3AgAgAEEYakG4w8AANgIAIABBFGogAjYCACACQQhqIAFBCGooAgA2AgAgAEEANgIADwsgACABKQIENwIEIABBBTYCAA8LQQxBBBDpAwALcgAjAEEwayIBJABBuO7BAC0AAARAIAFBFGpBAjYCACABQRxqQQE2AgAgAUGMncEANgIQIAFBADYCCCABQQM2AiQgASAANgIsIAEgAUEgajYCGCABIAFBLGo2AiAgAUEIakG0ncEAEN8CAAsgAUEwaiQAC/YDAgZ/An4jAEEQayICJAAgACgCACIAQQhqKAIAIQUgAEEEaigCACEAIAEoAgBBzs3BAEEBIAEoAgQoAgwRAwAhAyACQQA6AAUgAiADOgAEIAIgATYCACAFBEADQCACIAA2AgwgAkEMaiEGIwBBQGoiASQAQQEhBAJAIAItAAQNACACLQAFIQQCQAJAAkAgAigCACIDKAIYIgdBBHFFBEAgBA0BDAMLIAQNAUEBIQQgAygCAEHNzcEAQQEgAygCBCgCDBEDAA0DIAMoAhghBwwBC0EBIQQgAygCAEGxzcEAQQIgAygCBCgCDBEDAEUNAQwCC0EBIQQgAUEBOgAXIAFBkM3BADYCHCABIAMpAgA3AwggASABQRdqNgIQIAMpAgghCCADKQIQIQkgASADLQAgOgA4IAEgAygCHDYCNCABIAc2AjAgASAJNwMoIAEgCDcDICABIAFBCGo2AhggBiABQRhqQbCvwQAoAgARAQANASABKAIYQa/NwQBBAiABKAIcKAIMEQMAIQQMAQsgBiADQbCvwQAoAgARAQAhBAsgAkEBOgAFIAIgBDoABCABQUBrJAAgAEEBaiEAIAVBAWsiBQ0ACwsgAi0ABAR/QQEFIAIoAgAiACgCAEHPzcEAQQEgAEEEaigCACgCDBEDAAsgAkEQaiQAC3YBAX8gAC0ABCEBIAAtAAUEQCABQf8BcSEBIAACf0EBIAENABogACgCACIBLQAYQQRxRQRAIAEoAgBBx83BAEECIAEoAgQoAgwRAwAMAQsgASgCAEG5zcEAQQEgASgCBCgCDBEDAAsiAToABAsgAUH/AXFBAEcLagEBfyMAQTBrIgIkACACIAE2AgwgAiAANgIIIAJBHGpBAjYCACACQSRqQQE2AgAgAkHYqcAANgIYIAJBADYCECACQTk2AiwgAiACQShqNgIgIAIgAkEIajYCKCACQRBqEP0BIAJBMGokAAtqAQF/IwBBMGsiAiQAIAIgATYCDCACIAA2AgggAkEcakECNgIAIAJBJGpBATYCACACQfypwAA2AhggAkEANgIQIAJBOTYCLCACIAJBKGo2AiAgAiACQQhqNgIoIAJBEGoQ/QEgAkEwaiQACz4AIAAoAhAEQCAAQRRqKAIAEEoLIABBHGooAgAEQCAAQSBqKAIAEEoLIABBKGooAgAEQCAAQSxqKAIAEEoLC1gBAn8jAEEgayICJAAgASgCBCEDIAEoAgAgAkEYaiAAKAIAIgBBEGopAgA3AwAgAkEQaiAAQQhqKQIANwMAIAIgACkCADcDCCADIAJBCGoQcyACQSBqJAALYwEBfyMAQSBrIgUkACAFIAI2AgQgBSABNgIAIAVBGGogA0EQaikCADcDACAFQRBqIANBCGopAgA3AwAgBSADKQIANwMIIAAgBUGclcAAIAVBBGpBnJXAACAFQQhqIAQQnQEAC2kBAX8jAEEgayICJAAgAkHYq8AANgIEIAIgADYCACACQRhqIAFBEGopAgA3AwAgAkEQaiABQQhqKQIANwMAIAIgASkCADcDCEEAIAJBrJXAACACQQRqQayVwAAgAkEIakHsrMAAEJ0BAAtdAQJ/IwBBIGsiAiQAIAJBCGoiAyABQcSkwABBABD0AiACIAA2AhggAiAAQQRqNgIcIAMgAkEYakHEpMAAEMsBGiADIAJBHGpBxKTAABDLARogAxCKAiACQSBqJAALaQEBfyMAQSBrIgIkACACQbj1wAA2AgQgAiAANgIAIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIQQAgAkGYh8EAIAJBBGpBmIfBACACQQhqQcz2wAAQnQEAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB9JPAACACQQhqEHMgAkEgaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB4K7AACACQQhqEHMgAkEgaiQAC2oBAX4gASkCACECAkAgAS0AAEEERgRAIABBgAQ7AQRBCEEEELcDIgFFDQEgASACNwIAIABBGGpB/MLAADYCACAAQRRqIAE2AgAgAEEBNgIADwsgACACNwIEIABBBTYCAA8LQQhBBBDpAwALWQEBfyMAQSBrIgIkACACIAAoAgA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakH8kcEAIAJBCGoQcyACQSBqJAALWQEBfyMAQSBrIgIkACACIAAoAgA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakGwksEAIAJBCGoQcyACQSBqJAALWQEBfyMAQSBrIgIkACACIAAoAgA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakGMr8EAIAJBCGoQcyACQSBqJAALUwECfyMAQSBrIgIkACABKAIEIQMgASgCACACQRhqIABBEGopAgA3AwAgAkEQaiAAQQhqKQIANwMAIAIgACkCADcDCCADIAJBCGoQcyACQSBqJAALWQEBfyMAQSBrIgIkACACIAAoAgA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakHIz8EAIAJBCGoQcyACQSBqJAALUwECfyMAQSBrIgIkACAAKAIEIQMgACgCACACQRhqIAFBEGopAgA3AwAgAkEQaiABQQhqKQIANwMAIAIgASkCADcDCCADIAJBCGoQcyACQSBqJAALVgEBfyMAQSBrIgIkACACIAA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakH0k8AAIAJBCGoQcyACQSBqJAALVgEBfyMAQSBrIgIkACACIAA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakHgrsAAIAJBCGoQcyACQSBqJAALVgEBfyMAQSBrIgIkACACIAA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakH8kcEAIAJBCGoQcyACQSBqJAALVgEBfyMAQSBrIgIkACACIAA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakHIz8EAIAJBCGoQcyACQSBqJAALTQACf0EAIABBA0kNABpBASAAQQRNDQAaQQIgAEEJSQ0AGkEDIABBEUkNABpBBCAAQSFJDQAaQQUgAEHBAEkNABpBBkEHIABBgQFJGwsLOwAgACgCIARAIABBJGooAgAQSgsgAEEsaigCAARAIABBMGooAgAQSgsgAEEUaigCAARAIAAoAhAQSgsLVQEBfwJ/Qf8BIABDAAB/Q11FDQAaQQAgAEMAAAAAXkUNABpB/wECfyAAQwAAAABgIgEgAEMAAIBPXXEEQCAAqQwBC0EAC0EAIAEbIABDAAB/Q14bCwtrAQF9AkAgASoCCCACkiICQwAAAABdRQRAQwAAtEMhAyACQwAAtENeRQ0BCyADIQILIAAgASkCDDcCDCAAIAEqAgQ4AgQgACABKAIANgIAIABDAAAAACACIAJDAAC0w5KLQwAAADRdGzgCCAtiAQF/IwBBEGsiAiQAAn8gACgCAEUEQCACIABBBGo2AgggAUGk1cAAQQYgAkEIakGs1cAAEPoBDAELIAIgAEEEajYCDCABQZDVwABBAiACQQxqQZTVwAAQ+gELIAJBEGokAAthAQF/IwBBEGsiAiQAAn8gAC0AAEEERgRAIAIgAEEBajYCCCABQZjjwABBBiACQQhqQaDjwAAQ+gEMAQsgAiAANgIMIAFBhOPAAEECIAJBDGpBiOPAABD6AQsg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NgIACyABC0MBAX8gAiAAKAIAIAAoAggiA2tLBEAgACADIAIQ7wEgACgCCCEDCyAAKAIEIANqIAEgAhDtAxogACACIANqNgIIQQALQwEBfyACIAAoAgAgACgCCCIDa0sEQCAAIAMgAhDwASAAKAIIIQMLIAAoAgQgA2ogASACEO0DGiAAIAIgA2o2AghBAAs/AQJ/IAAgAC0ARiIBQQFqIgI6AAogAEEBIAFBD3F0QQJqOwFAIABBfyACQQ9xdEF/czsBCCAAQSBqIAEQnAEL/QEBAn8jAEEQayIDJAAgAyAANgIIIAMgAEEEajYCDCMAQRBrIgIkACACIAEoAgBB0LHBAEEIIAEoAgQoAgwRAwA6AAggAiABNgIEIAJBADoACSACQQA2AgAgAiADQQhqQdixwQAQywEgA0EMakHoscEAEMsBIQACfyACLQAIIgEgACgCACIARQ0AGkEBIAENABogAigCBCEBAkAgAEEBRw0AIAItAAlFDQAgAS0AGEEEcQ0AQQEgASgCAEHMzcEAQQEgASgCBCgCDBEDAA0BGgsgASgCAEGsysEAQQEgASgCBCgCDBEDAAsgAkEQaiQAQf8BcUEARyADQRBqJAALSgEBfyMAQSBrIgAkACAAQRRqQQE2AgAgAEEcakEANgIAIABB+KTBADYCECAAQciSwQA2AhggAEEANgIIIABBCGpBuKXBABDfAgALSgEBfyMAQSBrIgAkACAAQRRqQQE2AgAgAEEcakEANgIAIABB5K/BADYCECAAQbSvwQA2AhggAEEANgIIIABBCGpB7K/BABDfAgALRgECfyABKAIEIQIgASgCACEDQQhBBBC3AyIBRQRAQQhBBBDpAwALIAEgAjYCBCABIAM2AgAgAEHcnsEANgIEIAAgATYCAAufdwMWfiJ/AXwgASgCGEEBcSEYIAArAwAhOgJAAkACQCABKAIQQQFGBEACfyABISQgAUEUaigCACEnIwBB8AhrIh8kACA6vSEDAkAgOiA6YgRAQQIhAQwBCyADQv////////8HgyIGQoCAgICAgIAIhCADQgGGQv7///////8PgyADQjSIp0H/D3EiABsiBEIBgyEFQQMhAQJAAkACQEEBQQJBBCADQoCAgICAgID4/wCDIgdQIhkbIAdCgICAgICAgPj/AFEbQQNBBCAZGyAGUBtBAmsOAwAB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H0EBNgKYCCAfQe3JwQA2ApQIIB9BkAhqDAMLQQIhACAfQQI7AZAIICcEQCAfQaAIaiAnNgIAIB9BADsBnAggH0ECNgKYCCAfQejJwQA2ApQIIB9BkAhqDAMLQQEhACAfQQE2ApgIIB9B7cnBADYClAggH0GQCGoMAgsgH0EDNgKYCCAfQe7JwQA2ApQIIB9BAjsBkAggH0GQCGoMAQsgH0EDNgKYCCAfQfHJwQA2ApQIIB9BAjsBkAggH0GQCGoLIQEgH0HMCGogADYCACAfIAE2AsgIIB8gLDYCxAggHyAyNgLACCAkIB9BwAhqEHQgH0HwCGokAAwCC0H0ycEAQSVBnMrBABDGAgALIABBKEHU48EAENEDAAsPCyABQQAhASMAQYABayIgJAAgOr0hAgJAIDogOmIEQEECIQAMAQsgAkL/////////B4MiBkKAgICAgICACIQgAkIBhkL+////////D4MgAkI0iKdB/w9xIhkbIgNCAYMhBUEDIQACQAJAAkBBAUECQQQgAkKAgICAgICA+P8AgyIHUCIcGyAHQoCAgICAgID4/wBRG0EDQQQgHBsgBlAbQQJrDgMAAQIDC0EEIQAMAgsgGUGzCGshASAFUCEAQgEhBAwBC0KAgICAgICAICADQgGGIANCgICAgICAgAhRIgEbIQNCAkIBIAEbIQQgBVAhAEHLd0HMdyABGyAZaiEBCyAgIAE7AXggICAENwNwICBCATcDaCAgIAM3A2AgICAAOgB6An8gAEECRgRAQfixwQAhLUEADAELIBhFBEBB68nBAEH4scEAIAJCAFMbIS0gAkI/iKcMAQtB68nBAEHsycEAIAJCAFMbIS1BAQshMkEBIQECfwJAAkACQAJAQQMgAEECayAAQQFNG0H/AXFBAWsOAwIBAAMLICBBIGohGSAgQQ9qIRojAEEwayIYJAACQAJAAkACQAJAAkACQCAgQeAAaiIAKQMAIgJQRQRAIAApAwgiBFBFBEAgACkDECIDUEUEQCACIAIgA3wiA1gEQCACIARaBEACQAJAIANC//////////8fWARAIBggAC8BGCIAOwEIIBggAiAEfSIENwMAIAAgAEEgayAAIANCgICAgBBUIgEbIhxBEGsgHCADQiCGIAMgARsiA0KAgICAgIDAAFQiARsiHEEIayAcIANCEIYgAyABGyID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AkEBOgAYIAIgATYCFCACIAA2AhAgAkHIy8EANgIMIAJB+LHBADYCCCMAQRBrIgEkAAJAIAJBCGoiACgCDCICBEAgACgCCCIDRQ0BIAEgAjYCCCABIAA2AgQgASADNgIAIwBBEGsiACQAIABBCGogAUEIaigCADYCACAAIAEpAgA3AwAjAEEQayIBJAAgACgCACICQRRqKAIAIQMCQAJ/AkACQCACQQxqKAIADgIAAQMLIAMNAkEAIQJByJLBAAwBCyADDQEgAigCCCIDKAIEIQIgAygCAAshAyABIAI2AgQgASADNgIAIAFBgJ/BACAAKAIEIgEoAgggACgCCCABLQAQEPgBAAsgAUEANgIEIAEgAjYCDCABQeyewQAgACgCBCIBKAIIIAAoAgggAS0AEBD4AQALQfySwQBBK0G8nsEAEMYCAAtB/JLBAEErQayewQAQxgIACzYBAX8jAEEQayICJAAgAkEIaiABEPoCIAIoAgwhASAAIAIoAgg2AgAgACABNgIEIAJBEGokAAs2AQF/IwBBEGsiAiQAIAJBCGogARCWAyACKAIMIQEgACACKAIINgIAIAAgATYCBCACQRBqJAALNAEBfyAAKAIAIAAoAgQoAgARAAAgACgCBCIBQQRqKAIABEAgAUEIaigCABogACgCABBKCws4AQF/IwBBEGsiAiQAIAIgADYCDCABQeLUwABBE0H11MAAQQogAkEMakGA1cAAEP4BIAJBEGokAAs4AQF/IwBBEGsiAiQAIAIgADYCDCABQdziwABBE0Hv4sAAQQQgAkEMakH04sAAEP4BIAJBEGokAAs4AQF/IwBBEGsiAiQAIAIgADYCDCABQb6AwQBBFEHSgMEAQQQgAkEMakHYgMEAEP4BIAJBEGokAAszAAJAIABB/P///wdLDQAgAEUEQEEEDwsgACAAQf3///8HSUECdBC3AyIARQ0AIAAPCwALMAAgAQRAIABBAToACAsgACAAKAIAIgFBAWs2AgAgAUEBRgRAIAAoAgRBEGoQzQELCz0BAX8gACgCACEBAkAgAEEEai0AAA0AQcTvwQAoAgBB/////wdxRQ0AEPYDDQAgAUEBOgABCyABQQA6AAALPAEBfyACLQADRQRAIAIgASgAADYAAAsCQAJAAkAgAEH/AXFBAmsOAgECAAsgAigAACEDCyABIAM2AAALC9sEAQZ/IwBBEGsiBCQAQYTvwQAtAABBA0cEQCAEQQE6AA8gBEEPaiEBIwBBIGsiACQAAkACQAJAAkACQAJAAkBBhO/BAC0AAEEBaw4DAgQBAAtBhO/BAEECOgAAIAEtAAAgAUEAOgAAIABBhO/BADYCCEEBcUUNAiMAQSBrIgEkAAJAAkACQEHE78EAKAIAQf////8HcQRAEPYDRQ0BC0G078EAKAIAQbTvwQBBfzYCAA0BAkACQEHE78EAKAIAQf////8HcUUEQEHA78EAKAIAIQJBwO/BAEGEkcAANgIAQbzvwQAoAgAhA0G878EAQQE2AgAMAQsQ9gNBwO/BACgCACECQcDvwQBBhJHAADYCAEG878EAKAIAIQNBvO/BAEEBNgIARQ0BC0HE78EAKAIAQf////8HcUUNABD2Aw0AQbjvwQBBAToAAAtBtO/BAEEANgIAAkAgA0UNACADIAIoAgARAAAgAkEEaigCAEUNACACQQhqKAIAGiADEEoLIAFBIGokAAwCCyABQRRqQQE2AgAgAUEcakEANgIAIAFB+J3BADYCECABQciSwQA2AhggAUEANgIIIAFBCGpBnJ7BABDfAgALAAsgAEEDOgAMIABBCGoQyQMLIABBIGokAAwECyAAQRRqQQE2AgAgAEEcakEANgIAIABB5JLAADYCEAwCC0HsksAAQStB5JPAABDGAgALIABBFGpBATYCACAAQRxqQQA2AgAgAEGwksAANgIQCyAAQbiSwAA2AhggAEEANgIIIABBCGpB3JfAABDfAgALCyAEQRBqJAALLAEBfyMAQRBrIgAkACAAQQhqIgIgAUHMocAAQQsQ/QIgAhD/ASAAQRBqJAALMgAgACgCACEAIAEQxwNFBEAgARDIA0UEQCAAIAEQ0wMPCyAAIAEQhgIPCyAAIAEQhQILrAQBDH9B1O7BACgCACIARQRAAn8jAEFAaiIAJAAgAEE4akIANwMAIABBMGpCADcDACAAQShqQgA3AwAgAEIANwMgIABBCGogAEEgahDLAgJAIAAoAggiAUUEQCAAKAI8IQIgACgCOCEDIAAoAjQhBCAAKAIwIQUgACgCLCEGIAAoAighByAAKAIkIQggACgCICEJQdC0wAAQxQIhCkHUtMAAEMUCIQtB2AJBCBC3AyIBRQ0BIAFCgYCAgBA3AwAgAUEIakEAQYACEOsDGiABQQA2AtACIAFCgIAENwPIAiABQoCABDcDwAIgASALNgK8AiABIAo2ArgCIAFCADcDsAIgASACNgKsAiABIAM2AqgCIAEgBDYCpAIgASAFNgKgAiABIAY2ApwCIAEgBzYCmAIgASAINgKUAiABIAk2ApACIAFBwAA2AogCQdTuwQAoAgAhAkHU7sEAIAE2AgACQCACRQ0AIAIgAigCAEEBayIBNgIAIAENACACQQRqIgEgASgCAEEBayIBNgIAIAENACACEEoLIABBQGskAEHU7sEADAILIAAgACgCDDYCFCAAIAE2AhAgAEEsakEBNgIAIABBNGpBATYCACAAQdyzwAA2AiggAEEANgIgIABB6wA2AhwgACAAQRhqNgIwIAAgAEEQajYCGCAAQSBqQcC0wAAQ3wIAC0HYAkEIEOkDAAsoAgAhAAsgACAAKAIAQQFqIgE2AgAgAUUEQAALIAALtwEBA38gACgCACEAIAEQxwNFBEAgARDIA0UEQCAAIAEQ1gMPCyAAIAEQhAIPCyMAQYABayIDJAAgAC0AACEAA0AgAiADakH/AGpBMEHXACAAQQ9xIgRBCkkbIARqOgAAIAJBAWshAiAAIgRBBHYhACAEQQ9LDQALIAJBgAFqIgBBgQFPBEAgAEGAAUHszcEAENADAAsgAUEBQfzNwQBBAiACIANqQYABakEAIAJrEGogA0GAAWokAAssAQF/IwBBEGsiACQAIABBCGoiAiABQYT6wABBCxD9AiACEP8BIABBEGokAAssAQF/IwBBEGsiACQAIABBCGoiAiABQYiUwQBBCxD9AiACEJsCIABBEGokAAssAQF/IwBBEGsiACQAIABBCGoiAiABQaScwQBBCxD9AiACEP8BIABBEGokAAsdACAAKAIAQXxxIgAoAgQEQCAAKAIAEEoLIAAQSgssACAAIAEpAhA3AgAgAEEQaiABQSBqKAIANgIAIABBCGogAUEYaikCADcCAAsxACAAIAEoAgAgAiADIAEoAgQoAgwRAwA6AAggACABNgIEIAAgA0U6AAkgAEEANgIACywAAkAgARDHA0UEQCABEMgDDQEgACABEIIDDwsgACABEIUCDwsgACABEIYCCywAAkAgARDHA0UEQCABEMgDDQEgACABENMDDwsgACABEIUCDwsgACABEIYCCysAIAAoAgBFBEAgACgCBCABIABBCGooAgAoAhARAQAPCyAAQQRqIAEQqgELKgEBfwJ/QezuwQAoAgAiAEUEQBDiAQwBCyAAQaQBagsoAgBBlAJqKAIACycAIAAgACgCBEEBcSABckECcjYCBCAAIAFqIgAgACgCBEEBcjYCBAstAQF/IABBkOLAAEHU4cAAIAEtAABBBEYiAhs2AgQgACABQQFqIAEgAhs2AgALOgECf0GI78EALQAAIQFBiO/BAEEAOgAAQYzvwQAoAgAhAkGM78EAQQA2AgAgACACNgIEIAAgATYCAAsxACAAQQM6ACAgAEKAgICAgAQ3AhggAEEANgIQIABBADYCCCAAIAI2AgQgACABNgIACy0AIAEoAgAgAiADIAEoAgQoAgwRAwAhAiAAQQA6AAUgACACOgAEIAAgATYCAAsgAQF/AkAgAEEEaigCACIBRQ0AIAAoAgBFDQAgARBKCwscAQF/IwBBEGsiAiQAIAIgATYCDCACIAA2AggACyMAAkAgAUH8////B00EQCAAIAFBBCACEKcDIgANAQsACyAACyMAIAIgAigCBEF+cTYCBCAAIAFBAXI2AgQgACABaiABNgIACx8AIAAoAgAiAK1CACAArH0gAEEATiIAGyAAIAEQxQELKAAgASAAKAIALQAAQQJ0IgBB3MTAAGooAgAgAEGgxMAAaigCABCtAwslACAARQRAQc/NwABBMhDkAwALIAAgAiADIAQgBSABKAIQEQsACygAIAEgACgCAC0AAEECdCIAQeSswQBqKAIAIABBwKvBAGooAgAQrQMLIAECfiAAKQMAIgIgAkI/hyIDhSADfSACQgBZIAEQxQELIwAgAEUEQEHPzcAAQTIQ5AMACyAAIAIgAyAEIAEoAhARCAALIwAgAEUEQEHPzcAAQTIQ5AMACyAAIAIgAyAEIAEoAhAREwALIwAgAEUEQEHPzcAAQTIQ5AMACyAAIAIgAyAEIAEoAhARHgALIwAgAEUEQEHPzcAAQTIQ5AMACyAAIAIgAyAEIAEoAhARIAALIwAgAEUEQEHPzcAAQTIQ5AMACyAAIAIgAyAEIAEoAhARIgALJQAgASAALQAAQQJ0IgBB5KzBAGooAgAgAEHAq8EAaigCABCtAwseACAAIAFBA3I2AgQgACABaiIAIAAoAgRBAXI2AgQLCgAgAEEIEOkDAAsUACAAKAIABEAgAEEEaigCABBKCwshACAARQRAQc/NwABBMhDkAwALIAAgAiADIAEoAhARBQALIwAgAUG84sAAQc/iwAAgACgCAC0AACIAG0ETQQ0gABsQrQMLFAAgACgCBARAIABBCGooAgAQSgsLIgAgAC0AAEUEQCABQeDQwQBBBRBPDwsgAUHc0MEAQQQQTwscACAAKAIAIgBBBGooAgAgAEEIaigCACABEOoDCx8AIABFBEBBz83AAEEyEOQDAAsgACACIAEoAhARAQALIQAgACABQQRqNgIAIABBnM/AAEHYz8AAIAEoAgAbNgIECx0AIAEoAgBFBEAACyAAQfTWwAA2AgQgACABNgIACyMBAX4gASkCACECIAFBuJ/BADYCBCABQQE2AgAgACACNwMACxwAIAAoAgAiACgCACABIABBBGooAgAoAhARAQALHAAgACgCACIAKAIAIAEgAEEEaigCACgCDBEBAAscACAAIAEoAgAgAiADIAQgBSABKAIEKAIMEQYACxkBAX8gACgCECIBBH8gAQUgAEEUaigCAAsLFAAgASABIAAgACABXRsgACAAXBsLFAAgACAAIAEgACABXRsgASABXBsLFwAgAEEEaigCACAAQQhqKAIAIAEQ6gMLFgAgAEEEaigCACAAQQhqKAIAIAEQUQsSAEEZIABBAXZrQQAgAEEfRxsLFgAgACABQQFyNgIEIAAgAWogATYCAAsYACAAvEGAgICAeHFB////9wNyviAAko8LIQAgAL1CgICAgICAgICAf4NC/////////+8/hL8gAKCdCxMBAX8gAC0AOSAAQQE6ADlBAXELEAAgACABakEBa0EAIAFrcQuRBgEGfwJ/IAAhBQJAAkACQCACQQlPBEAgAyACEJ4BIgcNAUEADAQLQQhBCBCmAyEAQRRBCBCmAyEBQRBBCBCmAyECQQBBEEEIEKYDQQJ0ayIEQYCAfCACIAAgAWpqa0F3cUEDayIAIAAgBEsbIANNDQFBECADQQRqQRBBCBCmA0EFayADSxtBCBCmAyECIAUQ+wMiACAAEOUDIgQQ+QMhAQJAAkACQAJAAkACQAJAIAAQywNFBEAgAiAETQ0BIAFBnPPBACgCAEYNAiABQZjzwQAoAgBGDQMgARDEAw0HIAEQ5QMiBiAEaiIIIAJJDQcgCCACayEEIAZB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pH8LDABC/fnP6MWPjMd9CwwAQrmH04mTn+XyAAsMAEL3uZCUmpr68HELDQBCqd3+1cDm39HMAAsDAAELAwABCwu87QERAEGAgMAAC+EBVHJpZWQgdG8gc2hyaW5rIHRvIGEgbGFyZ2VyIGNhcGFjaXR5AAAQACQAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2FsbG9jL3NyYy9yYXdfdmVjLnJzLAAQAEwAAACqAQAACQAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvY29yZS9zcmMvaXRlci9hZGFwdGVycy9zdGVwX2J5LnJzAEHwgcAAC9EfYXR0ZW1wdCB0byBkaXZpZGUgYnkgemVybwAAAIgAEABZAAAANAAAABYAAABgdW53cmFwX3Rocm93YCBmYWlsZWRjYWxsZWQgYFJlc3VsdDo6dW53cmFwKClgIG9uIGFuIGBFcnJgIHZhbHVlAQAAAAgAAAAEAAAAAgAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGNyb3NzYmVhbS1jaGFubmVsLTAuNS43XHNyY1xmbGF2b3JzXHplcm8ucnMAAGwBEABqAAAAZgEAACsAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xpbWFnZXByb2MtMC4yMy4wXHNyY1xnZW9tZXRyaWNfdHJhbnNmb3JtYXRpb25zLnJz6AEQAHAAAAD9AQAAGgAAAOgBEABwAAAAiQIAAA0AAABJbWFnZSBkaW1lbnNpb25zICgsICkgYXJlIHRvbyBsYXJnZQB4AhAAEgAAAIoCEAACAAAAjAIQAA8AAABjYW5ub3QgYWNjZXNzIGEgVGhyZWFkIExvY2FsIFN0b3JhZ2UgdmFsdWUgZHVyaW5nIG9yIGFmdGVyIGRlc3RydWN0aW9uAAAOAAAAAAAAAAEAAAAPAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9zdGQvc3JjL3RocmVhZC9sb2NhbC5ycwAMAxAATwAAAKYBAAAaAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9jb3JlL3NyYy9vcHMvYXJpdGgucnMAAABsAxAATQAAAOgBAAABAAAAAAAAAGF0dGVtcHQgdG8gZGl2aWRlIGJ5IHplcm8AAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcaW1hZ2UtMC4yNC42XC4vc3JjXGNvZGVjc1xnaWYucnMAABcEEABfAAAAKwIAADUAAAAXBBAAXwAAACICAAAoAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcaW1hZ2UtMC4yNC42XC4vc3JjXGJ1ZmZlci5ycwCYBBAAWwAAALcDAABGAAAASW1hZ2UgaW5kZXggIG91dCBvZiBib3VuZHMgAAQFEAAMAAAAEAUQAA8AAACYBBAAWwAAALIDAAAVAAAAEAAAACABAAAIAAAAEQAAABIAAAATAAAAFAAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGdpZi0wLjEyLjBcc3JjXHJlYWRlclxtb2QucnMAXAUQAFsAAAB4AQAAIwAAAFwFEABbAAAAegEAABgAAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVlAFwFEABbAAAAggEAACsAAABcBRAAWwAAAIMBAAAgAAAAbm8gY29sb3IgdGFibGUgYXZhaWxhYmxlIGZvciBjdXJyZW50IGZyYW1lAABcBRAAWwAAAD8BAAArAAAAaW1hZ2UgdHJ1bmNhdGVkAFwFEABbAAAARAEAABwAAABpbnRlcm5hbCBlcnJvcjogZW50ZXJlZCB1bnJlYWNoYWJsZSBjb2RlXAUQAFsAAADvAAAAFQAAAGZpbGUgZG9lcyBub3QgY29udGFpbiBhbnkgaW1hZ2UgZGF0YXVuZXhwZWN0ZWQgRU9GYXNzZXJ0aW9uIGZhaWxlZDogaW5qZWN0ZWQgJiYgIXdvcmtlcl90aHJlYWQuaXNfbnVsbCgpQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNccmF5b24tY29yZS0xLjExLjBcc3JjXHJlZ2lzdHJ5LnJzIAcQAGAAAAAcAgAAFQAAACAHEABgAAAAOAIAABEAAABVbmlmb3JtU2FtcGxlcjo6c2FtcGxlX3NpbmdsZV9pbmNsdXNpdmU6IGxvdyA+IGhpZ2hDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xyYW5kLTAuOC41XHNyY1xkaXN0cmlidXRpb25zXHVuaWZvcm0ucnMAAADTBxAAZgAAADcCAAABAAAA0wcQAGYAAADmAwAAAQAAAFVuaWZvcm06Om5ld19pbmNsdXNpdmU6IHJhbmdlIG92ZXJmbG93AAAgAAAAAAAAAAEAAAAhAAAAIgAAACMAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L3N0ZC9zcmMvaW8vY3Vyc29yLnJznAgQAEwAAADrAAAACgAAAG9uZS10aW1lIGluaXRpYWxpemF0aW9uIG1heSBub3QgYmUgcGVyZm9ybWVkIHJlY3Vyc2l2ZWx5+AgQADgAAABPbmNlIGluc3RhbmNlIGhhcyBwcmV2aW91c2x5IGJlZW4gcG9pc29uZWQAADgJEAAqAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZS9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvc3RkL3NyYy9zeW5jL29uY2UucnMAlwkQAEwAAACPAAAAMgAAACAAAAAEAAAABAAAACQAAAAlAAAAJgAAAAAAAABjaHVua3MgY2Fubm90IGhhdmUgYSBzaXplIG9mIHplcm8AAAAQChAAIQAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvY29yZS9zcmMvc2xpY2UvbW9kLnJzAAAAPAoQAE0AAABxAwAACQAAACAAAAAEAAAABAAAACcAAAAgAAAABAAAAAQAAAAoAAAAY2Fubm90IHNhbXBsZSBlbXB0eSByYW5nZUM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHJhbmQtMC44LjVcc3JjXHJuZy5ycwAAANUKEABUAAAAhgAAAAkAAAByZXNpemVDb21tYW5kbmFtZXBhcmFtAABJCxAABAAAAE0LEAAFAAAAc3RydWN0IENvbW1hbmRDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xjb25zb2xlX2Vycm9yX3BhbmljX2hvb2stMC4xLjdcc3JjXGxpYi5ycwAAcgsQAGgAAACVAAAADgAAAHNwZWVkaHlwZXJzcGVlZHJldmVyc2VyYWluYm93cm90YXRlRmFpbGVkIHRvIHBhcnNlIGNvbW1hbmRzOiAAAAAPDBAAGgAAAEZhaWxlZCB0byBjcmVhdGUgcmVhZGVyOiAAAAA0DBAAGQAAAEZhaWxlZCB0byBnZXQgbmV4dCBmcmFtZTogAABYDBAAGgAAAEZhaWxlZCB0byB3cml0ZSBmcmFtZTogAHwMEAAXAAAAaW50ZXJuYWwgZXJyb3I6IGVudGVyZWQgdW5yZWFjaGFibGUgY29kZUM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHJheW9uLWNvcmUtMS4xMS4wXHNyY1xqb2IucnMAxAwQAFsAAADmAAAAIAAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWUAxAwQAFsAAABmAAAAIAAAAGNhbGxlZCBgUmVzdWx0Ojp1bndyYXAoKWAgb24gYW4gYEVycmAgdmFsdWUAKQAAAAgAAAAEAAAAKgAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxz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ZWxkIGBgyBQQAA8AAADXFBAAAQAAAGR1cGxpY2F0ZSBmaWVsZCBgAAAA6BQQABEAAADXFBAAAQAAALAUEACYFBAAgBQQAGgUEABQFBAAAAAAAAAAgD8AAABAAABAQAAAQEBaAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZUM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGNyb3NzYmVhbS1lcG9jaC0wLjkuMTRcc3JjXGludGVybmFsLnJzYxUQAGUAAACCAQAAOQAAAABjYW5ub3QgcmVjdXJzaXZlbHkgYWNxdWlyZSBtdXRleAAAANkVEAAgAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9zdGQvc3JjL3N5cy93YXNtLy4uL3Vuc3VwcG9ydGVkL2xvY2tzL211dGV4LnJzAAAEFhAAZgAAABQAAAAJAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcaW1hZ2UtMC4yNC42XC4vc3JjXGJ1ZmZlci5ycwB8FhAAWwAAALcDAABGAAAASW1hZ2UgaW5kZXggIG91dCBvZiBib3VuZHMgAOgWEAAMAAAA9BYQAA8AAAB8FhAAWwAAALIDAAAVAAAAY2h1bmtfc2l6ZSBtdXN0IG5vdCBiZSB6ZXJvACQXEAAbAAAATm8gZnJhbWVzIGZvdW5kAFgXEAAAAAAAXQAAAAQAAAAEAAAAXgAAAF8AAABgAAAAYwAAAAwAAAAEAAAAZAAAAGUAAABmAAAAYSBEaXNwbGF5IGltcGxlbWVudGF0aW9uIHJldHVybmVkIGFuIGVycm9yIHVuZXhwZWN0ZWRseQBnAAAAAAAAAAEAAABAAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9hbGxvYy9zcmMvc3RyaW5nLnJzANgXEABLAAAA6QkAAA4AAABpbnZhbGlkIHR5cGU6ICwgZXhwZWN0ZWQgAAAANBgQAA4AAABCGBAACwAAAGNhbm5vdCBhY2Nlc3MgYSBUaHJlYWQgTG9jYWwgU3RvcmFnZSB2YWx1ZSBkdXJpbmcgb3IgYWZ0ZXIgZGVzdHJ1Y3Rpb24AAGgAAAAAAAAAAQAAAA8AAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L3N0ZC9zcmMvdGhyZWFkL2xvY2FsLnJzALgYEABPAAAApgEAABoAAABhbHJlYWR5IGJvcnJvd2VkaAAAAAAAAAABAAAAaQAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHNlcmRlLXdhc20tYmluZGdlbi0wLjUuMFxzcmNcbGliLnJzAAA4GRAAYgAAADUAAAAOAAAAagAAAP//////////Y291bGQgbm90IGluaXRpYWxpemUgdGhyZWFkX3JuZzogAAAAuBkQACEAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xyYW5kLTAuOC41XHNyY1xybmdzXHRocmVhZC5yc+QZEABcAAAASAAAABEAQdi0wAALrQUEAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNccmFuZF9jaGFjaGEtMC4zLjFcc3JjXGd1dHMucnNcGhAAXAAAAOYAAAAFAAAAbAAAAAQAAAAEAAAAbQAAAG4AAAAEAAAABAAAAG8AAABuAAAABAAAAAQAAABwAAAAbwAAANgaEABxAAAAcgAAAHMAAAB0AAAAdQAAABQbEAAAAAAAZGVzY3JpcHRpb24oKSBpcyBkZXByZWNhdGVkOyB1c2UgRGlzcGxheXN0cnVjdCB2YXJpYW50AABEGxAADgAAAHR1cGxlIHZhcmlhbnQAAABcGxAADQAAAG5ld3R5cGUgdmFyaWFudAB0GxAADwAAAHVuaXQgdmFyaWFudIwbEAAMAAAAZW51baAbEAAEAAAAbWFwAKwbEAADAAAAc2VxdWVuY2W4GxAACAAAAG5ld3R5cGUgc3RydWN0AADIGxAADgAAAE9wdGlvbiB2YWx1ZeAbEAAMAAAAdW5pdCB2YWx1ZQAA9BsQAAoAAABieXRlIGFycmF5AAAIHBAACgAAAHN0cmluZyAAHBwQAAcAAABjaGFyYWN0ZXIgYGAsHBAACwAAADccEAABAAAAZmxvYXRpbmcgcG9pbnQgYEgcEAAQAAAANxwQAAEAAABpbnRlZ2VyIGAAAABoHBAACQAAADccEAABAAAAYm9vbGVhbiBgAAAAhBwQAAkAAAA3HBAAAQAAAGEgc3RyaW5nZjMyL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9jb3JlL3NyYy9vcHMvYXJpdGgucnOrHBAATQAAAOgBAAABAEGQusAAC5EiYXR0ZW1wdCB0byBkaXZpZGUgYnkgemVyb1JnYmEzMkZSZ2IzMkZSZ2JhMTZSZ2IxNkxhMTZMMTZSZ2JhOFJnYjhMYThMOFVua25vd24AAAB9AAAABAAAAAQAAAB+AAAAQmdyYThCZ3I4UmdiYTRSZ2I0TGE0TDRSZ2JhMlJnYjJMYTJMMlJnYmExUmdiMUxhMUwxQThkZXNjcmlwdGlvbigpIGlzIGRlcHJlY2F0ZWQ7IHVzZSBEaXNwbGF5AAAAVGhlIGRlY29kZXIgZm9yICBkb2VzIG5vdCBzdXBwb3J0IHRoZSBmb3JtYXQgZmVhdHVyZXMgAADQHRAAEAAAAOAdEAAmAAAAVGhlIGRlY29kZXIgZG9lcyBub3Qgc3VwcG9ydCB0aGUgZm9ybWF0IGZlYXR1cmUgGB4QADAAAABUaGUgaW1hZ2UgZm9ybWF0ICBpcyBub3Qgc3VwcG9ydGVkAABQHhAAEQAAAGEeEAARAAAAVGhlIGltYWdlIGZvcm1hdCBjb3VsZCBub3QgYmUgZGV0ZXJtaW5lZIQeEAAoAAAAVGhlIGZpbGUgZXh0ZW5zaW9uICB3YXMgbm90IHJlY29nbml6ZWQgYXMgYW4gaW1hZ2UgZm9ybWF0AAAAtB4QABMAAADHHhAAJgAAACBkb2VzIG5vdCBzdXBwb3J0IHRoZSBjb2xvciB0eXBlIGBgANAdEAAQAAAAAB8QACIAAAAiHxAAAQAAAFRoZSBlbmQgb2YgdGhlIGltYWdlIGhhcyBiZWVuIHJlYWNoZWQAAAA8HxAAJQAAAFRoZSBwYXJhbWV0ZXIgaXMgbWFsZm9ybWVkOiBsHxAAHAAAAFRoZSBlbmQgdGhlIGltYWdlIHN0cmVhbSBoYXMgYmVlbiByZWFjaGVkIGR1ZSB0byBhIHByZXZpb3VzIGVycm9yAAAAkB8QAEEAAABUaGUgSW1hZ2UncyBkaW1lbnNpb25zIGFyZSBlaXRoZXIgdG9vIHNtYWxsIG9yIHRvbyBsYXJnZdwfEAA4AAAACgAAABwgEAABAAAARm9ybWF0IGVycm9yIGVuY29kaW5nIDoKKCAQABYAAAA+IBAAAgAAACggEAAWAAAARm9ybWF0IGVycm9yIGRlY29kaW5nIDogWCAQABYAAABuIBAAAgAAAFggEAAWAAAARm9ybWF0IGVycm9yiCAQAAwAAABUaGUgZm9sbG93aW5nIHN0cmljdCBsaW1pdHMgYXJlIHNwZWNpZmllZCBidXQgbm90IHN1cHBvcnRlZCBieSB0aGUgb3BlcnRhdGlvbjogAJwgEABPAAAASW5zdWZmaWNpZW50IG1lbW9yeQD0IBAAEwAAAEltYWdlIGlzIHRvbyBsYXJnZQAAECEQABIAAABgVW5rbm93bmAAAAAsIRAACQAAAGAuAABAIRAAAgAAACIfEAABAAAAIh8QAAEAAAAiHxAAAQAAANAdEAAAAAAAhgAAAAgAAAAEAAAAhwAAAIYAAAAIAAAABAAAAIgAAACHAAAAbCEQAIkAAACKAAAAiwAAAIwAAACNAAAAjgAAAAwAAAAEAAAAjwAAAI4AAAAMAAAABAAAAJAAAACPAAAAqCEQAJEAAACSAAAAkwAAAJQAAACVAAAAUW9pQXZpZkZhcmJmZWxkT3BlbkV4ckhkckljb0JtcERkc1RnYVRpZmZQbm1XZWJQR2lmSnBlZ1BuZwAAAwAAAAQAAAADAAAABAAAAAMAAAAEAAAAAwAAAAMAAAADAAAAAwAAAAMAAAAHAAAACAAAAAQAAAADAAAAGyIQABciEAAUIhAAECIQAA0iEAAJIhAABiIQAAMiEAAAIhAA/SEQAPohEADzIRAA6yEQAOchEADkIRAAZGVzY3JpcHRpb24oKSBpcyBkZXByZWNhdGVkOyB1c2UgRGlzcGxheWNhbm5vdCBhY2Nlc3MgYSBUaHJlYWQgTG9jYWwgU3RvcmFnZSB2YWx1ZSBkdXJpbmcgb3IgYWZ0ZXIgZGVzdHJ1Y3Rpb24AAJYAAAAAAAAAAQAAAA8AAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L3N0ZC9zcmMvdGhyZWFkL2xvY2FsLnJzABgjEABPAAAApgEAABoAAACXAAAAY3J5cHRvRXJyb3J1bmtub3duX2NvZGUAmQAAAAQAAAAEAAAAmgAAAGludGVybmFsX2NvZGVkZXNjcmlwdGlvbpkAAAAIAAAABAAAAJsAAABvc19lcnJvcpkAAAAEAAAABAAAAJwAAABVbmtub3duIEVycm9yOiAA5CMQAA8AAABPUyBFcnJvcjogAAD8IxAACgAAAE5vZGUuanMgRVMgbW9kdWxlcyBhcmUgbm90IGRpcmVjdGx5IHN1cHBvcnRlZCwgc2VlIGh0dHBzOi8vZG9jcy5ycy9nZXRyYW5kb20jbm9kZWpzLWVzLW1vZHVsZS1zdXBwb3J0Q2FsbGluZyBOb2RlLmpzIEFQSSBjcnlwdG8ucmFuZG9tRmlsbFN5bmMgZmFpbGVkTm9kZS5qcyBjcnlwdG8gQ29tbW9uSlMgbW9kdWxlIGlzIHVuYXZhaWxhYmxlcmFuZFNlY3VyZTogVnhXb3JrcyBSTkcgbW9kdWxlIGlzIG5vdCBpbml0aWFsaXplZENhbGxpbmcgV2ViIEFQSSBjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzIGZhaWxlZFdlYiBDcnlwdG8gQVBJIGlzIHVuYXZhaWxhYmxlUkRSQU5EOiBpbnN0cnVjdGlvbiBub3Qgc3VwcG9ydGVkUkRSQU5EOiBmYWlsZWQgbXVsdGlwbGUgdGltZXM6IENQVSBpc3N1ZSBsaWtlbHlSdGxHZW5SYW5kb206IFdpbmRvd3Mgc3lzdGVtIGZ1bmN0aW9uIGZhaWx1cmVTZWNSYW5kb21Db3B5Qnl0ZXM6IGlPUyBTZWN1cml0eSBmcmFtZXdvcmsgZmFpbHVyZWVycm5vOiBkaWQgbm90IHJldHVybiBhIHBvc2l0aXZlIHZhbHVlZ2V0cmFuZG9tOiB0aGlzIHRhcmdldCBpcyBub3Qgc3VwcG9ydGVkAAAAJwAAACYAAAAnAAAAMgAAAC0AAAAvAAAAIQAAAB0AAAAtAAAAJwAAACcAAAAxAAAALQAAADAAAABlAAAAIiYQAPwlEAAiJhAAyiUQAJ0lEABuJRAATSUQADAlEAADJRAAIiYQACImEADSJBAApSQQAHUkEAAQJBAAcmV0dXJuIHRoaXNjbG9zdXJlIGludm9rZWQgcmVjdXJzaXZlbHkgb3IgYWZ0ZXIgYmVpbmcgZHJvcHBlZAAAAGRlc2NyaXB0aW9uKCkgaXMgZGVwcmVjYXRlZDsgdXNlIERpc3BsYXkvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL2l0ZXIucnMAACwnEABOAAAA4AUAABgAAACqAAAACAAAAAQAAACrAAAAqgAAAAgAAAAEAAAArAAAAKsAAACMJxAArQAAAK4AAACvAAAAsAAAALEAAACyAAAACAAAAAQAAACzAAAAsgAAAAgAAAAEAAAAtAAAALMAAADIJxAAtQAAALYAAAC3AAAAtQAAALgAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xnaWYtMC4xMi4wXHNyY1xyZWFkZXJcZGVjb2Rlci5ycwAEKBAAXwAAABEBAAAcAAAABCgQAF8AAAANAQAAHAAAAAQoEABfAAAACgEAABwAAAAEKBAAXwAAAGkBAAARAAAABCgQAF8AAAB8AgAAIgAAAAQnEAAAAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZQAEKBAAXwAAAGACAAA8AAAABCgQAF8AAAA3AQAAHwAAAE5vIGVuZCBjb2RlIGluIGx6dyBzdHJlYW0AAAAEKBAAXwAAAKkCAAAiAAAABCgQAF8AAACFAgAAPAAAAGludmFsaWQgbWluaW1hbCBjb2RlIHNpemUAAAAEKBAAXwAAADEBAAAfAAAABCgQAF8AAABMAgAAIwAAAHVua25vd24gZXh0ZW50aW9uIGJsb2NrIGVuY291bnRlcmVkZXhwZWN0ZWQgYmxvY2sgdGVybWluYXRvciBub3QgZm91bmR1bmtub3duIGJsb2NrIHR5cGUgZW5jb3VudGVyZWQEKBAAXwAAAPoBAAAvAAAAZnJhbWUgZGVzY3JpcHRvciBpcyBvdXQtb2YtYm91bmRzdW5zdXBwb3J0ZWQgR0lGIHZlcnNpb25tYWxmb3JtZWQgR0lGIGhlYWRlcmNvbnRyb2wgZXh0ZW5zaW9uIGhhcyB3cm9uZyBsZW5ndGhEZWNvZGluZ0Zvcm1hdEVycm9ydW5kZXJseWluZwC5AAAABAAAAAQAAAC6AAAASW8AALkAAAAEAAAABAAAALsAAABGb3JtYXQAALkAAAAEAAAABAAAALwAAABjYW5ub3QgYWNjZXNzIGEgVGhyZWFkIExvY2FsIFN0b3JhZ2UgdmFsdWUgZHVyaW5nIG9yIGFmdGVyIGRlc3RydWN0aW9uAAC9AAAAAAAAAAEAAAAPAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9zdGQvc3JjL3RocmVhZC9sb2NhbC5ycwAUKxAATwAAAKYBAAAaAAAAvgAAAAgAAAAEAAAAvwAAAGFzc2VydGlvbiBmYWlsZWQ6IHBpeGVsLmxlbigpID09IDRDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xjb2xvcl9xdWFudC0xLjEuMFxzcmNcbGliLnJzAAAApisQAFsAAAC6AAAACQAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGdpZi0wLjEyLjBcc3JjXGNvbW1vbi5ycwAULBAAVwAAAPUAAAAiAAAAFCwQAFcAAAD1AAAALAAAABQsEABXAAAA9QAAADYAAAAULBAAVwAAAPUAAABAAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZQAULBAAVwAAAPUAAABLAAAAwAAAAAgAAAAEAAAAwQAAAMIAAADDAAAADAAAAAQAAAAxAAAAwwAAAAwAAAAEAAAAMgAAADEAAAD8LBAAxAAAAMUAAAA1AAAAxgAAAMcAAABjYXBhY2l0eSBvdmVyZmxvdwAAADgtEAARAAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9hbGxvYy9zcmMvdmVjL3NwZWNfZnJvbV9pdGVyX25lc3RlZC5ycwAAVC0QAF4AAAA7AAAAEgAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvY29yZS9zcmMvc2xpY2UvaXRlci5ycwAAxC0QAE4AAABVBwAAEQBBsNzAAAuNLWF0dGVtcHQgdG8gZGl2aWRlIGJ5IHplcm9JbmRleCBvdXQgb2YgYm91bmRzSS4QABMAAAAvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL3NvcnQucnMAAGQuEABOAAAAywQAABUAAABkLhAATgAAANkEAAAeAAAAZC4QAE4AAADiBAAAGAAAAGQuEABOAAAA5wQAABwAAABUb28gbXVjaCBvciB0b28gbGl0dGxlIHBpeGVsIGRhdGEgZm9yIHRoZSBnaXZlbiB3aWR0aCBhbmQgaGVpZ2h0IHRvIGNyZWF0ZSBhIEdJRiBGcmFtZQAA9C4QAFYAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xnaWYtMC4xMi4wXHNyY1xjb21tb24ucnMAVC8QAFcAAADQAAAACQAAAHNwZWVkIG5lZWRzIHRvIGJlIGluIHRoZSByYW5nZSBbMSwgMzBdAABULxAAVwAAANEAAAAJAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZQBULxAAVwAAAPUAAABLAAAAZGVzY3JpcHRpb24oKSBpcyBkZXByZWNhdGVkOyB1c2UgRGlzcGxheXRoZSBHSUYgZm9ybWF0IHJlcXVpcmVzIGEgY29sb3IgcGFsZXR0ZSBidXQgbm9uZSB3YXMgZ2l2ZW4AAFgwEAA6AAAAdGhlIGltYWdlIGhhcyB0b28gbWFueSBjb2xvcnMAAACcMBAAHQAAAMgAAAAIAAAABAAAAKsAAADIAAAACAAAAAQAAACsAAAAqwAAAMQwEACtAAAArgAAAK8AAACwAAAA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ZCwgZ290IADoNxAAIwAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHdlZXpsLTAuMS43XHNyY1xsaWIucnMAAAAUOBAAVQAAAF8AAAAFAAAATWluaW11bSBjb2RlIHNpemUgMiByZXF1aXJlZCwgZ290IAAAfDgQACIAAAAUOBAAVQAAAGgAAAAFAAAAFDgQAFUAAABpAAAABQAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHdlZXpsLTAuMS43XHNyY1xlbmNvZGUucnPIOBAAWAAAAP8BAAAVAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZUM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGNyb3NzYmVhbS1kZXF1ZS0wLjguM1xzcmNcZGVxdWUucnNbORAAYQAAAGwFAABDAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcY3Jvc3NiZWFtLWVwb2NoLTAuOS4xNFxzcmNcaW50ZXJuYWwucnMAAADMORAAZQAAAIIBAAA5AAAAb25lLXRpbWUgaW5pdGlhbGl6YXRpb24gbWF5IG5vdCBiZSBwZXJmb3JtZWQgcmVjdXJzaXZlbHlEOhAAOAAAAE9uY2UgaW5zdGFuY2UgaGFzIHByZXZpb3VzbHkgYmVlbiBwb2lzb25lZAAAhDoQACoAAAAAY2Fubm90IHJlY3Vyc2l2ZWx5IGFjcXVpcmUgbXV0ZXgAAAC5OhAAIAAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvc3RkL3NyYy9zeXMvd2FzbS8uLi91bnN1cHBvcnRlZC9sb2Nrcy9tdXRleC5ycwAA5DoQAGYAAAAUAAAACQAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWUvcnVzdGMvOWViM2FmZTllYmU5YzdkMmI4NGI3MTAwMmQ0NGY0YTBlZGFjOTVlMC9saWJyYXJ5L3N0ZC9zcmMvc3luYy9vbmNlLnJzAIc7EABMAAAAjwAAADIAAABjYWxsZWQgYFJlc3VsdDo6dW53cmFwKClgIG9uIGFuIGBFcnJgIHZhbHVlAOMAAAAIAAAABAAAAOQAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xjcm9zc2JlYW0tY2hhbm5lbC0wLjUuN1xzcmNcd2FrZXIucnMAIDwQAGMAAAADAQAAKwAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHJheW9uLWNvcmUtMS4xMS4wXHNyY1xyZWdpc3RyeS5yc5Q8EABgAAAAgwMAACMAAABQb2lzb25FcnJvckM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXHJheW9uLWNvcmUtMS4xMS4wXHNyY1xyZWdpc3RyeS5ycwAPPRAAYAAAAIMDAAAjAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNccmF5b24tY29yZS0xLjExLjBcc3JjXHNsZWVwXG1vZC5ycwAAAIA9EABhAAAAnQAAABwAAABjYWxsZWQgYFJlc3VsdDo6dW53cmFwKClgIG9uIGFuIGBFcnJgIHZhbHVlAOUAAAAIAAAABAAAAOYAAACAPRAAYQAAAJ4AAAA8AAAAgD0QAGEAAADkAAAAQwAAAIA9EABhAAAAZQEAABwAAACAPRAAYQAAAGcBAAA8AAAAY2FsbGVkIGBSZXN1bHQ6OnVud3JhcCgpYCBvbiBhbiBgRXJyYCB2YWx1ZQDnAAAACAAAAAQAAADmAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNccmF5b24tY29yZS0xLjExLjBcc3JjXGxhdGNoLnJzAAAArD4QAF0AAAAKAQAAKgAAAFRoZSBnbG9iYWwgdGhyZWFkIHBvb2wgaGFzIG5vdCBiZWVuIGluaXRpYWxpemVkLugAAAAIAAAABAAAAOkAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xyYXlvbi1jb3JlLTEuMTEuMFxzcmNccmVnaXN0cnkucnNcPxAAYAAAAKoAAAAKAAAAXD8QAGAAAADCAAAAFgAAAFw/EABgAAAA4wAAACEAAABcPxAAYAAAAKMDAAARAAAAXD8QAGAAAACvAwAAHwAAAFw/EABgAAAAugMAABEAAABSQVlPTl9OVU1fVEhSRUFEU1JBWU9OX1JTX05VTV9DUFVTVGhyZWFkUG9vbEJ1aWxkRXJyb3JraW5kAADqAAAABAAAAAQAAADrAAAASU9FcnJvcgDqAAAABAAAAAQAAADsAAAAR2xvYmFsUG9vbEFscmVhZHlJbml0aWFsaXplZGNhbGxlZCBgUmVzdWx0Ojp1bndyYXAoKWAgb24gYW4gYEVycmAgdmFsdWUA7QAAAAgAAAAEAAAA5AAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGNyb3NzYmVhbS1jaGFubmVsLTAuNS43XHNyY1x3YWtlci5ycwDYQBAAYwAAAAMBAAArAAAAY2FsbGVkIGBSZXN1bHQ6OnVud3JhcCgpYCBvbiBhbiBgRXJyYCB2YWx1ZQDuAAAACAAAAAQAAADmAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNccmF5b24tY29yZS0xLjExLjBcc3JjXGxhdGNoLnJzAAAAiEEQAF0AAAD3AAAAJwAAAIhBEABdAAAA+QAAACgAAABhc3NlcnRpb24gZmFpbGVkOiB0LmdldCgpLmVxKCYoc2VsZiBhcyAqY29uc3QgXykpQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNccmF5b24tY29yZS0xLjExLjBcc3JjXHJlZ2lzdHJ5LnJzAAAAOUIQAGAAAADGAgAADQAAAGFzc2VydGlvbiBmYWlsZWQ6IHQuZ2V0KCkuaXNfbnVsbCgpADlCEABgAAAA2QIAAA0AAABjYWxsZWQgYFJlc3VsdDo6dW53cmFwKClgIG9uIGFuIGBFcnJgIHZhbHVlAO8AAAAIAAAABAAAAOQAAABDOlxVc2Vyc1xZZW50bFwuY2FyZ29ccmVnaXN0cnlcc3JjXGdpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyM1xjcm9zc2JlYW0tY2hhbm5lbC0wLjUuN1xzcmNcZmxhdm9yc1x6ZXJvLnJzAAAcQxAAagAAAGYBAAArAAAA8AAAAAQAAAAEAAAA8QAAAPIAAABAAAAABAAAAPMAAAB0aHJlYWQgbmFtZSBtYXkgbm90IGNvbnRhaW4gaW50ZXJpb3IgbnVsbCBieXRlcwD0AAAAEAAAAAQAAAD1AAAAL3J1c3RjLzllYjNhZmU5ZWJlOWM3ZDJiODRiNzEwMDJkNDRmNGEwZWRhYzk1ZTAvbGlicmFyeS9zdGQvc3JjL3RocmVhZC9tb2QucnMAAAD4QxAATQAAAPkBAAAgAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcY3Jvc3NiZWFtLWVwb2NoLTAuOS4xNFxzcmNcaW50ZXJuYWwucnMAQcyJwQAL8in2AAAAWEQQAGUAAAB5AAAAHgAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWUAWEQQAGUAAACCAQAAOQAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvY29yZS9zcmMvc3luYy9hdG9taWMucnN0aGVyZSBpcyBubyBzdWNoIHRoaW5nIGFzIGFuIGFjcXVpcmUtcmVsZWFzZSBmYWlsdXJlIG9yZGVyaW5na0UQAD0AAAAcRRAATwAAACYMAAAcAAAAdGhlcmUgaXMgbm8gc3VjaCB0aGluZyBhcyBhIHJlbGVhc2UgZmFpbHVyZSBvcmRlcmluZ8BFEAA0AAAAHEUQAE8AAAAnDAAAHQAAABxFEABPAAAASQwAABwAAAAcRRAATwAAAEoMAAAdAAAA9wAAAAQAAAAEAAAA+AAAAG9uZS10aW1lIGluaXRpYWxpemF0aW9uIG1heSBub3QgYmUgcGVyZm9ybWVkIHJlY3Vyc2l2ZWx5PEYQADgAAABPbmNlIGluc3RhbmNlIGhhcyBwcmV2aW91c2x5IGJlZW4gcG9pc29uZWQAAHxGEAAqAAAAY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZS9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvc3RkL3NyYy9zeW5jL29uY2UucnMA20YQAEwAAACPAAAAMgAAAEM6XFVzZXJzXFllbnRsXC5jYXJnb1xyZWdpc3RyeVxzcmNcZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzXGNyb3NzYmVhbS1lcG9jaC0wLjkuMTRcc3JjXHN5bmNcb25jZV9sb2NrLnJzADhHEABrAAAATgAAABMAAAABAAAAQzpcVXNlcnNcWWVudGxcLmNhcmdvXHJlZ2lzdHJ5XHNyY1xnaXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjNcY3Jvc3NiZWFtLWVwb2NoLTAuOS4xNFxzcmNcc3luY1xsaXN0LnJzAAC4RxAAZgAAAOIAAAARAAAAAAAAAPsAAAAMAAAABAAAAPwAAAD9AAAA/gAAAGEgRGlzcGxheSBpbXBsZW1lbnRhdGlvbiByZXR1cm5lZCBhbiBlcnJvciB1bmV4cGVjdGVkbHkA/wAAAAAAAAABAAAAQAAAAC9ydXN0Yy85ZWIzYWZlOWViZTljN2QyYjg0YjcxMDAyZDQ0ZjRhMGVkYWM5NWUwL2xpYnJhcnkvYWxsb2Mvc3JjL3N0cmluZy5ycwCUSBAASwAAAOkJAAAOAAAACgpTdGFjazoKCgAAAAEAAAQAAAAEAAAAAQEAAAIBAAADAQAASnNWYWx1ZSgpAAAAFEkQAAgAAAAcSRAAAQAAAAgBAAAEAAAABAAAAAkBAAAKAQAACwEAAGFscmVhZHkgYm9ycm93ZWQIAQAAAAAAAAEAAABpAAAAAAAAAAgBAAAEAAAABAAAAAwBAABjYWxsZWQgYE9wdGlvbjo6dW53cmFwKClgIG9uIGEgYE5vbmVgIHZhbHVldG9vIG1hbnkgcnVubmluZyB0aHJlYWRzIGluIHRocmVhZCBzY29wZQCnSRAAKAAAAGxpYnJhcnkvc3RkL3NyYy90aHJlYWQvc2NvcGVkLnJz2EkQACAAAAAzAAAADQAAAEFjY2Vzc0Vycm9ybGlicmFyeS9zdGQvc3JjL3RocmVhZC9tb2QucnNmYWlsZWQgdG8gZ2VuZXJhdGUgdW5pcXVlIHRocmVhZCBJRDogYml0c3BhY2UgZXhoYXVzdGVkADBKEAA3AAAAE0oQAB0AAABdBAAADQAAAGNhbGxlZCBgUmVzdWx0Ojp1bndyYXAoKWAgb24gYW4gYEVycmAgdmFsdWUASEkQAAAAAAB1bmNhdGVnb3JpemVkIGVycm9yb3RoZXIgZXJyb3JvdXQgb2YgbWVtb3J5dW5leHBlY3RlZCBlbmQgb2YgZmlsZXVuc3VwcG9ydGVkb3BlcmF0aW9uIGludGVycnVwdGVkYXJndW1lbnQgbGlzdCB0b28gbG9uZ2ludmFsaWQgZmlsZW5hbWV0b28gbWFueSBsaW5rc2Nyb3NzLWRldmljZSBsaW5rIG9yIHJlbmFtZWRlYWRsb2NrZXhlY3V0YWJsZSBmaWxlIGJ1c3lyZXNvdXJjZSBidXN5ZmlsZSB0b28gbGFyZ2VmaWxlc3lzdGVtIHF1b3RhIGV4Y2VlZGVkc2VlayBvbiB1bnNlZWthYmxlIGZpbGVubyBzdG9yYWdlIHNwYWNld3JpdGUgemVyb3RpbWVkIG91dGludmFsaWQgZGF0YWludmFsaWQgaW5wdXQgcGFyYW1ldGVyc3RhbGUgbmV0d29yayBmaWxlIGhhbmRsZWZpbGVzeXN0ZW0gbG9vcCBvciBpbmRpcmVjdGlvbiBsaW1pdCAoZS5nLiBzeW1saW5rIGxvb3ApcmVhZC1vbmx5IGZpbGVzeXN0ZW0gb3Igc3RvcmFnZSBtZWRpdW1kaXJlY3Rvcnkgbm90IGVtcHR5aXMgYSBkaXJlY3Rvcnlub3QgYSBkaXJlY3RvcnlvcGVyYXRpb24gd291bGQgYmxvY2tlbnRpdHkgYWxyZWFkeSBleGlzdHNicm9rZW4gcGlwZW5ldHdvcmsgZG93bmFkZHJlc3Mgbm90IGF2YWlsYWJsZWFkZHJlc3MgaW4gdXNlbm90IGNvbm5lY3RlZGNvbm5lY3Rpb24gYWJvcnRlZG5ldHdvcmsgdW5yZWFjaGFibGVob3N0IHVucmVhY2hhYmxlY29ubmVjdGlvbiByZXNldGNvbm5lY3Rpb24gcmVmdXNlZHBlcm1pc3Npb24gZGVuaWVkZW50aXR5IG5vdCBmb3VuZEVycm9ya2luZAAACAEAAAEAAAABAAAADQEAAG1lc3NhZ2UACAEAAAgAAAAEAAAADgEAAEtpbmRPc2NvZGUAAAgBAAAEAAAABAAAAA8BAAAQAQAADAAAAAQAAAARAQAAIChvcyBlcnJvciApSEkQAAAAAAAAThAACwAAAAtOEAABAAAAUG9pc29uRXJyb3JsaWJyYXJ5L3N0ZC9zcmMvc3lzX2NvbW1vbi90aHJlYWRfaW5mby5ycy9OEAApAAAAKwAAACsAAABtZW1vcnkgYWxsb2NhdGlvbiBvZiAgYnl0ZXMgZmFpbGVkAABoThAAFQAAAH1OEAANAAAAbGlicmFyeS9zdGQvc3JjL2FsbG9jLnJznE4QABgAAABVAQAACQAAAGNhbm5vdCBtb2RpZnkgdGhlIHBhbmljIGhvb2sgZnJvbSBhIHBhbmlja2luZyB0aHJlYWTEThAANAAAAGxpYnJhcnkvc3RkL3NyYy9wYW5pY2tpbmcucnMATxAAHAAAAIYAAAAJAAAAAE8QABwAAAA+AgAAHgAAAABPEAAcAAAAPQIAAB8AAAAQAQAADAAAAAQAAAASAQAACAEAAAgAAAAEAAAAEwEAABQBAAAQAAAABAAAABUBAAAWAQAACAEAAAgAAAAEAAAAFwEAABgBAAAIAQAAAAAAAAEAAAAZAQAAGgEAAAgAAAAEAAAAGwEAABwBAAAIAQAAAAAAAAEAAAAdAQAAVW5zdXBwb3J0ZWQACAEAAAQAAAAEAAAAHgEAAEN1c3RvbWVycm9yAAgBAAAEAAAABAAAAB8BAABVbmNhdGVnb3JpemVkT3RoZXJPdXRPZk1lbW9yeVVuZXhwZWN0ZWRFb2ZJbnRlcnJ1cHRlZEFyZ3VtZW50TGlzdFRvb0xvbmdJbnZhbGlkRmlsZW5hbWVUb29NYW55TGlua3NDcm9zc2VzRGV2aWNlc0RlYWRsb2NrRXhlY3V0YWJsZUZpbGVCdXN5UmVzb3VyY2VCdXN5RmlsZVRvb0xhcmdlRmlsZXN5c3RlbVF1b3RhRXhjZWVkZWROb3RTZWVrYWJsZVN0b3JhZ2VGdWxsV3JpdGVaZXJvVGltZWRPdXRJbnZhbGlkRGF0YUludmFsaWRJbnB1dFN0YWxlTmV0d29ya0ZpbGVIYW5kbGVGaWxlc3lzdGVtTG9vcFJlYWRPbmx5RmlsZXN5c3RlbURpcmVjdG9yeU5vdEVtcHR5SXNBRGlyZWN0b3J5Tm90QURpcmVjdG9yeVdvdWxkQmxvY2tBbHJlYWR5RXhpc3RzQnJva2VuUGlwZU5ldHdvcmtEb3duQWRkck5vdEF2YWlsYWJsZUFkZHJJblVzZU5vdENvbm5lY3RlZENvbm5lY3Rpb25BYm9ydGVkTmV0d29ya1VucmVhY2hhYmxlSG9zdFVucmVhY2hhYmxlQ29ubmVjdGlvblJlc2V0Q29ubmVjdGlvblJlZnVzZWRQZXJtaXNzaW9uRGVuaWVkTm90Rm91bmRvcGVyYXRpb24gc3VjY2Vzc2Z1bG9wZXJhdGlvbiBub3Qgc3VwcG9ydGVkIG9uIHRoaXMgcGxhdGZvcm0AJ1IQACgAAAAkAAAAY29uZHZhciB3YWl0IG5vdCBzdXBwb3J0ZWQAAFxSEAAaAAAAbGlicmFyeS9zdGQvc3JjL3N5cy93YXNtLy4uL3Vuc3VwcG9ydGVkL2xvY2tzL2NvbmR2YXIucnOAUhAAOAAAABQAAAAJAAAAY2Fubm90IHJlY3Vyc2l2ZWx5IGFjcXVpcmUgbXV0ZXjIUhAAIAAAAGxpYnJhcnkvc3RkL3NyYy9zeXMvd2FzbS8uLi91bnN1cHBvcnRlZC9sb2Nrcy9tdXRleC5ycwAA8FIQADYAAAAUAAAACQAAACABAAAIAAAABAAAACEBAABsaWJyYXJ5L3N0ZC9zcmMvc3lzX2NvbW1vbi90aHJlYWRfcGFya2luZy9nZW5lcmljLnJzaW5jb25zaXN0ZW50IHN0YXRlIGluIHVucGFya3xTEAAcAAAASFMQADQAAABsAAAAEgAAAEhTEAA0AAAAegAAAB8AAAAOAAAAEAAAABYAAAAVAAAACwAAABYAAAANAAAACwAAABMAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAA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', imports);
}

class GifsicleService extends BaseService {
    async start() {
        const instance = await wasm();
        await init(instance);
        initPanicHook();
    }
    async modifyGif(url, options) {
        Logger.info('Got GIF request', url, options);
        const commands = this.getCommands(options);
        Logger.info('Processed request commands', commands);
        const buffer = await this.processCommands(url, commands);
        Logger.info('Processed modified emote', {
            length: buffer.length
        });
        return buffer;
    }
    getCommands(options) {
        const commands = [];
        options.forEach((option => {
            switch (option[0]) {
              case 'resize':
                {
                    const command = {
                        name: option[0],
                        param: option[1]
                    };
                    commands.push(command);
                    break;
                }

              case 'reverse':
                {
                    commands.push({
                        name: option[0]
                    });
                    break;
                }

              case 'flip':
                commands.push({
                    name: option[0],
                    param: 0
                });
                break;

              case 'flap':
                commands.push({
                    name: 'flip',
                    param: 1
                });
                break;

              case 'speed':
                {
                    const param = option[1]?.toString() ?? '';
                    commands.push({
                        name: option[0],
                        param: Math.max(2, parseFloat(param))
                    });
                    break;
                }

              case 'hyperspeed':
                commands.push({
                    name: 'hyperspeed'
                });
                break;

              case 'rotate':
                commands.push({
                    name: option[0],
                    param: option[1]
                });
                break;

              case 'wiggle':
                {
                    let size = 2;
                    const param = option[1];
                    if (param === 'big') size = 4; else if (param === 'bigger') size = 6; else if (param === 'huge') size = 10;
                    commands.push({
                        name: option[0],
                        param: size
                    });
                    break;
                }

              case 'rain':
                commands.push({
                    name: option[0],
                    param: option[1] === 'glitter' ? 0 : 1
                });
                break;

              case 'spin':
              case 'spinrev':
              case 'shake':
              case 'rainbow':
              case 'infinite':
              case 'slide':
              case 'sliderev':
                {
                    let speed = 8;
                    const param = option[1];
                    if (param === 'fast') speed = 6; else if (param === 'faster') speed = 4; else if (param === 'hyper') speed = 2;
                    commands.push({
                        name: option[0],
                        param: speed
                    });
                    break;
                }
            }
        }));
        return commands;
    }
    async processCommands(url, commands) {
        let buffer$1 = await urlGetBuffer(url);
        commands.forEach((command => {
            const value = (command.param ?? 0).toString();
            command.param = parseFloat(value);
        }));
        console.log('Commands:', commands);
        const result = applyCommands(buffer$1, commands);
        buffer$1 = buffer.Buffer.from(result);
        if (!(buffer$1 instanceof buffer.Buffer)) throw Error('Did not process gif!');
        return buffer$1;
    }
    stop() {}
}

class ModulesService extends BaseService {
    channelStore;
    uploader;
    draft;
    permissions;
    discordPermissions;
    dispatcher;
    componentDispatcher;
    pendingReplyDispatcher={};
    emojiStore;
    emojiSearch;
    emojiDisabledReasons;
    userStore;
    messageStore;
    classes;
    cloudUploader;
    start() {
        this.channelStore = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps('getChannel', 'hasChannel'));
        this.uploader = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps('instantBatchUpload'));
        this.draft = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps('changeDraft'));
        this.permissions = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps('getChannelPermissions'));
        this.discordPermissions = BdApi.Webpack.getModule((module => typeof module.CREATE_INSTANT_INVITE === 'bigint'), {
            searchExports: true
        });
        this.dispatcher = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps('dispatch', 'subscribe'));
        this.componentDispatcher = BdApi.Webpack.getModule((module => {
            if (module.dispatchToLastSubscribed !== undefined) {
                const componentDispatcher = module;
                return componentDispatcher.emitter.listeners('SHAKE_APP').length > 0;
            }
            return false;
        }), {
            searchExports: true
        });
        this.pendingReplyDispatcher.module = BdApi.Webpack.getModule((module => {
            Object.entries(module).forEach((([key, value]) => {
                if (!(typeof value === 'function')) return;
                const valueString = value.toString();
                if (valueString.includes('DELETE_PENDING_REPLY')) {
                    this.pendingReplyDispatcher.deletePendingReplyKey = key;
                } else if (valueString.includes('CREATE_PENDING_REPLY')) {
                    this.pendingReplyDispatcher.createPendingReplyKey = key;
                } else if (valueString.includes('SET_PENDING_REPLY_SHOULD_MENTION')) {
                    this.pendingReplyDispatcher.setPendingReplyShouldMentionKey = key;
                }
            }));
            return this.pendingReplyDispatcher.deletePendingReplyKey !== undefined;
        }));
        this.emojiStore = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps('getEmojiUnavailableReason'));
        this.emojiSearch = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps('getDisambiguatedEmojiContext'));
        this.emojiDisabledReasons = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps('PREMIUM_LOCKED'), {
            searchExports: true
        });
        this.userStore = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps('getCurrentUser'));
        this.messageStore = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps('sendMessage'));
        this.cloudUploader = BdApi.Webpack.getModule((module => Object.values(module).some((value => {
            if (typeof value !== 'object' || value === null) return false;
            const curValue = value;
            return curValue.NOT_STARTED !== undefined && curValue.UPLOADING !== undefined && module.n !== undefined;
        }))));
        const TextArea = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps('channelTextArea', 'textAreaHeight'));
        const Editor = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps('editor', 'placeholder'));
        const Autocomplete = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps('autocomplete', 'autocompleteInner', 'autocompleteRowVertical'));
        const autocompleteAttached = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps('autocomplete', 'autocompleteAttached'));
        const Wrapper = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps('wrapper', 'base'));
        const Size = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byProps('size12'));
        this.classes = {
            TextArea,
            Editor,
            Autocomplete: {
                ...Autocomplete,
                autocomplete: [ autocompleteAttached?.autocomplete, autocompleteAttached?.autocompleteAttached, Autocomplete?.autocomplete ].join(' ')
            },
            Wrapper,
            Size
        };
        return Promise.resolve();
    }
    stop() {}
}

class SendMessageService extends BaseService {
    emoteService;
    attachService;
    modulesService;
    settingsService;
    gifsicleService;
    start(emoteService, attachService, modulesService, settingsService, gifsicleService) {
        this.emoteService = emoteService;
        this.attachService = attachService;
        this.modulesService = modulesService;
        this.settingsService = settingsService;
        this.gifsicleService = gifsicleService;
        BdApi.Patcher.instead(this.plugin.meta.name, modulesService.messageStore, 'sendMessage', ((_, args, original) => this.onSendMessage(args, original)));
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
                ...discordEmotes
            });
            if (!foundEmote) {
                callDefault(...args);
                return;
            }
            if (!this.attachService.canAttach) {
                BdApi.showToast('This channel does not allow sending images!', {
                    type: 'error'
                });
                callDefault(...args);
                return;
            }
            content = (content.substring(0, foundEmote.pos) + content.substring(foundEmote.pos + foundEmote.nameAndCommand.length)).trim();
            foundEmote.content = content;
            foundEmote.channel = channelId;
            try {
                this.attachService.pendingUpload = this.fetchBlobAndUpload(foundEmote);
                await this.attachService.pendingUpload;
                return;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : error;
                BdApi.showToast(errorMessage, {
                    type: 'error'
                });
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
            if (emoji?.managed === true) return {};
            validEmoji = emoji?.available === true && !this.attachService.externalEmotes.has(emoji.id);
        } else return {};
        if (!emoji) return {};
        const emojiName = emoji.originalName ?? emoji.name;
        const allNamesString = emoji.allNamesString.replace(emoji.name, emojiName);
        const emojiText = `<${emoji.animated ? 'a' : ''}${allNamesString}${emoji.id}>`;
        const result = {};
        const url = emoji.url.split('?')[0] ?? '';
        if (!url) return {};
        const extensionIndex = url.lastIndexOf('.');
        result[emojiText] = {
            name: emojiName,
            url: url.substring(extensionIndex) === '.webp' ? `${url.substring(0, extensionIndex)}.png` : url
        };
        const foundEmote = this.getTextPos(message.content, result);
        if (!foundEmote) return {};
        if (validEmoji && foundEmote.commands.length === 0) return {};
        return result;
    }
    getTextPos(content, emoteCandidates) {
        const foundEmotes = [];
        Object.entries(emoteCandidates).forEach((([key, value]) => {
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
                    commands: []
                };
                if (command) {
                    const commands = command[0]?.split('.') ?? [];
                    emote.commands = commands.filter((command => command !== key)).map((command => {
                        const split = command.split('-');
                        return [ split[0] ?? undefined, split[1] ?? undefined ];
                    }));
                    emote.nameAndCommand = command[0] ?? '';
                }
                const beforeEmote = content.substring(0, pos);
                const afterEmote = content.substring(pos + emote.nameAndCommand.length);
                if (beforeEmote.includes('||') && afterEmote.includes('||')) {
                    const spoilerStart = beforeEmote.substring(beforeEmote.indexOf('||'));
                    emote.nameAndCommand = spoilerStart + emote.nameAndCommand;
                    emote.pos -= spoilerStart.length;
                    const spoilerEnd = afterEmote.substring(0, afterEmote.indexOf('||') + 2);
                    emote.nameAndCommand = emote.nameAndCommand + spoilerEnd;
                    emote.spoiler = true;
                }
                if (!beforeEmote.includes('`') || !afterEmote.includes('`')) {
                    foundEmotes.push(emote);
                }
            }
        }));
        return foundEmotes.pop();
    }
    getNthIndexOf(input, search, nth) {
        const firstIndex = input.indexOf(search);
        const startPos = firstIndex + search.length;
        if (nth === 0) {
            return firstIndex;
        } else {
            const inputAfterFirstOccurrence = input.substring(startPos);
            const nextOccurrence = this.getNthIndexOf(inputAfterFirstOccurrence, search, nth - 1);
            if (nextOccurrence === -1) {
                return -1;
            } else {
                return startPos + nextOccurrence;
            }
        }
    }
    async fetchBlobAndUpload(emote) {
        const url = emote.url, name = emote.name, commands = emote.commands;
        if (url.endsWith('.gif') || this.findCommand(commands, this.getGifModifiers())) {
            return this.getMetaAndModifyGif(emote);
        }
        const resultBlob = await this.compress(url, commands) ?? new Blob([]);
        if (resultBlob.size === 0) throw new Error('Emote URL did not contain data');
        this.uploadFile({
            fileData: resultBlob,
            fullName: name + '.png',
            emote
        });
    }
    findCommand(commands, names) {
        let foundCommand;
        commands.forEach((command => {
            names.forEach((name => {
                if (command[0] === name) foundCommand = command;
            }));
        }));
        return foundCommand;
    }
    getGifModifiers() {
        const gifModifiers = [];
        this.emoteService.modifiers.forEach((modifier => {
            if (modifier.type === 'gif') {
                gifModifiers.push(modifier.name);
            }
        }));
        return gifModifiers;
    }
    async getMetaAndModifyGif(emote) {
        const image = await loadImagePromise(emote.url);
        const commands = emote.commands;
        this.addResizeCommand(commands, image);
        BdApi.showToast('Processing gif...', {
            type: 'info'
        });
        const buffer = await this.gifsicleService.modifyGif(emote.url, commands);
        if (buffer.length === 0) throw Error('Failed to process gif');
        this.uploadFile({
            fileData: buffer,
            fullName: emote.name + '.gif',
            emote
        });
    }
    addResizeCommand(commands, image) {
        const scaleFactorNum = this.getScaleFactor(commands, image);
        let scaleFactor = scaleFactorNum.toString();
        const wideCommand = this.findCommand(commands, [ 'wide' ]);
        if (wideCommand) {
            const wideness = this.getEmoteWideness(wideCommand);
            scaleFactor = `${scaleFactorNum * wideness}x${scaleFactorNum}}`;
        }
        commands.push([ 'resize', scaleFactor ]);
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
        commands.forEach(((command, index, object) => {
            if (command[0] === 'resize') {
                resizeCommand = command;
                object.splice(index, 1);
            }
        }));
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
        const {fileData, fullName, emote} = params;
        const content = emote.content ?? '';
        const channelId = emote.channel ?? '';
        if (!channelId) {
            Logger.error('Channel ID not found for emote:', emote);
            return;
        }
        const upload = new this.modulesService.cloudUploader.n({
            file: new File([ fileData ], fullName),
            platform: 1
        }, channelId);
        upload.spoiler = emote.spoiler;
        const uploadOptions = {
            channelId,
            uploads: [ upload ],
            draftType: 0,
            parsedMessage: {
                content,
                invalidEmojis: [],
                tts: false,
                channel_id: channelId
            }
        };
        const pendingReply = this.attachService.pendingReply;
        if (pendingReply) {
            uploadOptions.options = {
                allowedMentions: {
                    replied_user: pendingReply.shouldMention
                },
                messageReference: {
                    channel_id: pendingReply.message.channel_id,
                    guild_id: pendingReply.channel.guild_id,
                    message_id: pendingReply.message.id
                }
            };
        }
        this.modulesService.uploader.uploadFiles(uploadOptions);
    }
    async compress(url, commands) {
        const image = await loadImagePromise(url);
        const canvas = await this.applyScaling(image, commands);
        return await new Promise((resolve => {
            canvas.toBlob((blob => {
                resolve(blob ?? undefined);
            }), 'image/png', 1);
        }));
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
            resizeQuality: 'high'
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
        let scaleH = 1, scaleV = 1, posX = 0, posY = 0;
        if (this.findCommand(commands, [ 'flip' ])) {
            scaleH = -1;
            posX = canvas.width * -1;
        }
        if (this.findCommand(commands, [ 'flap' ])) {
            scaleV = -1;
            posY = canvas.height * -1;
        }
        const ctx = canvas.getContext('2d');
        const wideCommand = this.findCommand(commands, [ 'wide' ]);
        if (wideCommand) {
            const wideness = this.getEmoteWideness(wideCommand);
            image.width = image.width * wideness;
            canvas.width = canvas.width * wideness;
        }
        const rotateCommand = this.findCommand(commands, [ 'rotate' ]);
        if (rotateCommand) {
            const angle = parseInt(rotateCommand[1] ?? '0') * Math.PI / 180, sin = Math.sin(angle), cos = Math.cos(angle);
            const newWidth = Math.abs(canvas.width * cos) + Math.abs(canvas.height * sin);
            const newHeight = Math.abs(canvas.width * sin) + Math.abs(canvas.height * cos);
            canvas.width = newWidth;
            canvas.height = newHeight;
            ctx?.translate(canvas.width / 2, canvas.height / 2);
            ctx?.rotate(angle);
            posX = -image.width / 2;
            posY = -image.height / 2;
        }
        ctx?.scale(scaleH, scaleV);
        ctx?.drawImage(image, posX, posY, image.width, image.height);
        return canvas;
    }
    stop() {}
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
        return classes.split(' ').map((curClass => !curClass.startsWith('.') ? `.${curClass}` : curClass)).join(' ');
    }
    getTextAreaField(editor) {
        const textArea = this.modulesService.classes.TextArea.textArea;
        return editor?.closest(this.getClassSelector(textArea)) ?? undefined;
    }
    getTextAreaContainer(editor) {
        const channelTextArea = this.modulesService.classes.TextArea.channelTextArea;
        return editor?.closest(this.getClassSelector(channelTextArea)) ?? undefined;
    }
    getEditors() {
        const editor = this.modulesService.classes.Editor.editor;
        return document.querySelectorAll(this.getClassSelector(editor)) ?? [];
    }
    stop() {}
}

class EmoteReplacerPlugin {
    settingsService;
    emoteService;
    completionsService;
    attachService;
    listenersService;
    gifsicleService;
    modulesService;
    sendMessageService;
    htmlService;
    meta;
    updateInterval;
    constructor(meta) {
        this.meta = meta;
        setLogger(meta.name);
    }
    start() {
        this.doStart().catch((error => {
            Logger.error(error);
        }));
    }
    async doStart() {
        const zeresPluginLibrary = window.ZeresPluginLibrary;
        this.showChangelogIfNeeded(zeresPluginLibrary);
        await this.startServicesAndPatches();
    }
    showChangelogIfNeeded(zeresPluginLibrary) {
        const currentVersionInfo = BdApi.Data.load(this.meta.name, CURRENT_VERSION_INFO_KEY) ?? {};
        if (currentVersionInfo.hasShownChangelog !== true || currentVersionInfo.version !== this.meta.version) {
            zeresPluginLibrary.Modals.showChangelogModal(`${this.meta.name} Changelog`, this.meta.version, PLUGIN_CHANGELOG);
            const newVersionInfo = {
                version: this.meta.version,
                hasShownChangelog: true
            };
            BdApi.saveData(this.meta.name, CURRENT_VERSION_INFO_KEY, newVersionInfo);
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
        await this.emoteService.start(this.listenersService, this.settingsService, this.htmlService);
        this.attachService = new AttachService(this, zeresPluginLibrary);
        await this.attachService.start(this.modulesService);
        this.completionsService = new CompletionsService(this, zeresPluginLibrary);
        await this.completionsService.start(this.emoteService, this.settingsService, this.modulesService, this.listenersService, this.htmlService, this.attachService);
        this.gifsicleService = new GifsicleService(this, zeresPluginLibrary);
        await this.gifsicleService.start();
        this.sendMessageService = new SendMessageService(this, zeresPluginLibrary);
        await this.sendMessageService.start(this.emoteService, this.attachService, this.modulesService, this.settingsService, this.gifsicleService);
        const pluginName = this.meta.name;
        changeDraftPatch(pluginName, this.attachService, this.completionsService, this.emoteService, this.modulesService);
        pendingReplyPatch(pluginName, this.attachService, this.modulesService);
        emojiSearchPatch(pluginName, this.attachService, this.modulesService);
        lockedEmojisPatch(pluginName, this.attachService, this.modulesService);
    }
    observer(e) {
        if (!e.addedNodes.length || !(e.addedNodes[0] instanceof Element)) return;
        const elem = e.addedNodes[0];
        const modulesService = this.modulesService;
        if (!modulesService) return;
        const textAreaSelector = this.htmlService?.getClassSelector(modulesService.classes.TextArea.textArea);
        if (textAreaSelector !== undefined && elem.querySelector(textAreaSelector)) {
            this.listenersService?.requestAddListeners(CompletionsService.TAG);
        }
    }
    onSwitch() {
        this.completionsService?.destroyCompletions();
    }
    getSettingsPanel() {
        return this.settingsService?.getSettingsElement() ?? new HTMLElement;
    }
    stop() {
        BdApi.Patcher.unpatchAll(this.meta.name);
        if (this.updateInterval) {
            clearTimeout(this.updateInterval);
            this.updateInterval = undefined;
        }
        this.sendMessageService?.stop();
        this.sendMessageService = undefined;
        this.gifsicleService?.stop();
        this.gifsicleService = undefined;
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

var index = bdWindow.ZeresPluginLibrary === undefined ? RawPlugin : EmoteReplacerPlugin;

module.exports = index;
