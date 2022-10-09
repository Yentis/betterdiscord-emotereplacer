/// <reference types="lodash" />
import { Plugin, Meta } from "betterdiscord";
import { Pica } from "pica";
interface ExtendedMeta extends Meta {
    source: string;
    license: string;
}
declare class RawPlugin implements Plugin {
    private meta;
    constructor(meta: ExtendedMeta);
    start(): void;
    private showLibraryMissingModal;
    stop(): void;
}
interface Modifier {
    name: string;
    type: string;
    info: string;
    arguments: string[];
}
interface Completion {
    name: string;
    data: Modifier | string;
}
interface Cached {
    draft?: string;
    candidateText?: string;
    completions?: Completion[];
    matchText?: string;
    matchStart?: number;
    selectedIndex?: number;
    windowOffset?: number;
}
interface SettingsFieldProps {
    noteOnTop: boolean;
}
interface SettingsField {
    name: string | undefined;
    note: string | undefined;
    onChange: ((newValue: unknown) => void) | undefined;
    settingtype: HTMLElement;
    props?: SettingsFieldProps;
    getElement: () => Element;
}
interface SettingGroup {
    groupName: string;
    append: (...elements: (Element | SettingsField)[]) => void;
}
interface SliderOptions {
    units: string;
    markers: number[];
}
interface Slider extends SettingsField {
    min: number;
    max: number;
    value: number;
    options?: SliderOptions;
}
interface Switch extends SettingsField {
    isChecked: boolean;
}
interface Textbox extends SettingsField {
    value: string | undefined;
}
interface DropdownValue {
    label: string;
    value: string;
}
interface Dropdown extends SettingsField {
    defaultValue: string;
    values: DropdownValue[];
}
interface RadioItem {
    name: string;
    value: string;
    desc?: string;
    color?: string;
}
interface RadioGroup extends SettingsField {
    defaultValue: string;
    values: RadioItem[];
}
interface Changelog {
    title: string;
    type: string;
    items: string[];
}
interface ZeresPluginLibrary {
    Modals: {
        showChangelogModal: (title: string, version: string, changelog: Changelog[]) => void;
    };
    PluginUpdater: {
        checkForUpdate: (name: string, version: string, raw: string) => void;
    };
    Settings: {
        SettingPanel: {
            build: (onChange: (value: unknown) => void, ...settings: (SettingsField | SettingGroup)[]) => HTMLElement;
        };
        SettingField: new (name: string | undefined, note: string | undefined, onChange: ((newValue: unknown) => void) | undefined, settingtype: HTMLElement, props?: SettingsFieldProps) => SettingsField;
        SettingGroup: new (groupName: string) => SettingGroup;
        Slider: new (name: string | undefined, note: string | undefined, min: number, max: number, value: number, onChange: ((newValue: number) => void) | undefined, options?: SliderOptions) => Slider;
        Switch: new (name: string | undefined, note: string | undefined, isChecked: boolean, onChange: ((newValue: boolean) => void) | undefined) => Switch;
        Textbox: new (name: string | undefined, note: string | undefined, value: string | undefined, onChange: ((newValue: string) => void) | undefined) => Textbox;
        Dropdown: new (name: string | undefined, note: string | undefined, defaultValue: string, values: DropdownValue[], onChange: ((newValue: string) => void) | undefined) => Dropdown;
        RadioGroup: new (name: string | undefined, note: string | undefined, defaultValue: string, values: RadioItem[], onChange: ((newValue: string) => void) | undefined) => RadioGroup;
    };
}
declare abstract class BaseService {
    plugin: EmoteReplacerPlugin;
    zeresPluginLibrary: ZeresPluginLibrary;
    constructor(plugin: EmoteReplacerPlugin, zeresPluginLibrary: ZeresPluginLibrary);
    abstract start(...args: unknown[]): Promise<void>;
    abstract stop(): void;
}
interface Channel {
    guild_id: string;
}
interface ChannelStore {
    getChannel: (id: string) => Channel | undefined;
}
interface Classes {
    TextArea: {
        channelTextArea: string;
        textArea: string;
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
    Wrapper: {
        base: string;
    };
    Size: {
        size12: string;
    };
}
interface ComponentDispatcher {
    ComponentDispatch: {
        dispatch: (dispatchType: string, data: unknown) => void;
    };
}
interface DeletePendingReply {
    deletePendingReply: unknown;
}
interface DiscordConstants {
    EmojiDisabledReasons: {
        GUILD_SUBSCRIPTION_UNAVAILABLE: number;
        PREMIUM_LOCKED: number;
    };
}
interface DiscordPermissions {
    Permissions: {
        ATTACH_FILES: bigint;
    };
}
interface Dispatcher {
    subscribe: <T>(event: string, callback: (data: T) => void) => void;
    unsubscribe: <T>(event: string, callback: (data: T) => void) => void;
}
interface Draft {
    changeDraft: () => void;
    clearDraft: (channelId: string, draftType: number) => void;
}
interface EmojiSearch {
    search: unknown;
}
interface EmojiStore {
    getEmojiUnavailableReason: (params: {
        emoji: unknown;
        channel: unknown;
        intention: unknown;
    }) => unknown;
    isEmojiDisabled: unknown;
}
interface MessageStore {
    sendMessage: unknown;
}
interface Permissions {
    can: (permissions: bigint, channel: Channel, userId: string) => boolean;
}
interface SelectedChannelStore {
    getChannelId: () => string;
}
interface Emoji {
    id: string;
    name: string;
    originalName?: string;
    allNamesString: string;
    url: string;
    animated: boolean;
    available: boolean;
    managed: boolean;
}
interface Message {
    content: string;
    channel_id: string;
    tts: boolean;
    invalidEmojis?: Emoji[];
    validNonShortcutEmojis?: Emoji[];
}
interface Uploader {
    upload: (options: {
        channelId: string;
        file: File;
        draftType: number;
        message: Message;
        hasSpoiler: boolean;
        filename: string;
    }) => void;
}
interface UserStore {
    getCurrentUser: () => {
        id: string;
    } | undefined;
}
declare class ModulesService extends BaseService {
    selectedChannelStore: SelectedChannelStore;
    channelStore: ChannelStore;
    uploader: Uploader;
    draft: Draft;
    permissions: Permissions;
    discordPermissions: DiscordPermissions;
    dispatcher: Dispatcher;
    componentDispatcher: ComponentDispatcher;
    deletePendingReply: DeletePendingReply;
    emojiStore: EmojiStore;
    emojiSearch: EmojiSearch;
    discordConstants: DiscordConstants;
    userStore: UserStore;
    messageStore: MessageStore;
    classes: Classes;
    start(): Promise<void>;
    stop(): void;
}
declare class HtmlService extends BaseService {
    modulesService: ModulesService;
    start(modulesService: ModulesService): Promise<void>;
    addClasses(element: Element, ...classes: string[]): void;
    getClassSelector(classes: string): string;
    getTextAreaField(): Element | undefined;
    getTextAreaContainer(): Element | undefined;
    stop(): void;
}
interface Listener {
    element?: Element;
    name: string;
    callback: EventListener;
}
declare class ListenersService extends BaseService {
    private listeners;
    addListenersWatchers: Record<string, {
        onAddListeners: () => void;
    }>;
    start(): Promise<void>;
    addListener(id: string, listener: Listener): void;
    removeListener(id: string): void;
    requestAddListeners(targetId: string): void;
    stop(): void;
}
interface Settings {
    emoteSize: number;
    autocompleteEmoteSize: number;
    autocompleteItems: number;
    customEmotes: Record<string, string>;
    requirePrefix: boolean;
    prefix: string;
    resizeMethod: string;
    showStandardEmotes: boolean;
}
declare class SettingsService extends BaseService {
    private static readonly ADD_BUTTON_CLICK_LISTENER;
    private static readonly REFRESH_BUTTON_CLICK_LISTENER;
    private static readonly DELETE_BUTTON_CLICK_LISTENER;
    listenersService: ListenersService;
    settings: Settings;
    start(listenersService: ListenersService): Promise<void>;
    getSettingsElement(): HTMLElement;
    private pushRegularSettings;
    private createCustomEmoteContainer;
    stop(): void;
}
declare class EmoteService extends BaseService {
    listenersService: ListenersService;
    settingsService: SettingsService;
    htmlService: HtmlService;
    emoteNames: Record<string, string> | undefined;
    modifiers: Modifier[];
    start(listenersService: ListenersService, settingsService: SettingsService, htmlService: HtmlService): Promise<void>;
    private initEmotes;
    refreshEmotes(): void;
    private getEmoteNames;
    private setEmoteNames;
    private getModifiers;
    getPrefixedName(name: string): string;
    shouldCompleteEmote(input: string): boolean;
    shouldCompleteCommand(input: string): boolean;
    private escapeRegExp;
    private getRegexCommand;
    getCompletionsEmote(text: string): Cached;
    getCompletionsCommands(text: string): Cached;
    stop(): void;
}
interface ScrollOptions {
    locked?: boolean;
    clamped?: boolean;
}
declare class CompletionsService extends BaseService {
    static readonly TAG: string;
    private static readonly TEXTAREA_KEYDOWN_LISTENER;
    private static readonly TEXTAREA_WHEEL_LISTENER;
    private static readonly TEXTAREA_BLUR_LISTENER;
    private static readonly AUTOCOMPLETE_DIV_WHEEL_LISTENER;
    private static readonly EMOTE_ROW_MOUSEENTER_LISTENER;
    private static readonly EMOTE_ROW_MOUSEDOWN_LISTENER;
    emoteService: EmoteService;
    settingsService: SettingsService;
    modulesService: ModulesService;
    listenersService: ListenersService;
    htmlService: HtmlService;
    draft: string;
    cached: Cached | undefined;
    start(emoteService: EmoteService, settingsService: SettingsService, modulesService: ModulesService, listenersService: ListenersService, htmlService: HtmlService): Promise<void>;
    private addListeners;
    browseCompletions(event: KeyboardEvent): void;
    private prepareCompletions;
    private insertSelectedCompletion;
    destroyCompletions(): void;
    renderCompletions: import("lodash").DebouncedFunc<() => void>;
    scrollCompletions(e: WheelEvent, options?: ScrollOptions): void;
    private scrollWindow;
    stop(): void;
}
declare class AttachService extends BaseService {
    modulesService: ModulesService;
    canAttach: boolean;
    pendingUpload: Promise<void> | undefined;
    onMessagesLoaded: ((data: {
        channelId: string;
    }) => void) | undefined;
    onChannelSelect: ((data: {
        channelId: string;
    }) => void) | undefined;
    start(modulesService: ModulesService): Promise<void>;
    private getUserId;
    private setCanAttach;
    private initChannelSubscription;
    stop(): void;
}
declare class GifsicleService extends BaseService {
    start(): Promise<void>;
    modifyGif(url: string, options: (string | undefined)[][]): Promise<Buffer>;
    private getCommands;
    private processCommands;
    private doModification;
    private getCommandIndex;
    private processSpecialCommands;
    private processSpecialCommand;
    private processNormalCommands;
    private removeEveryOtherFrame;
    stop(): void;
}
declare class SendMessageService extends BaseService {
    emoteService: EmoteService;
    attachService: AttachService;
    modulesService: ModulesService;
    settingsService: SettingsService;
    gifsicleService: GifsicleService;
    picaInstance: Pica;
    start(emoteService: EmoteService, attachService: AttachService, modulesService: ModulesService, settingsService: SettingsService, gifsicleService: GifsicleService): Promise<void>;
    private onSendMessage;
    private getTargetEmoteFromMessage;
    private getTextPos;
    private getNthIndexOf;
    private fetchBlobAndUpload;
    private findCommand;
    private getGifModifiers;
    private getMetaAndModifyGif;
    private addResizeCommand;
    private getScaleFactor;
    private getEmoteSize;
    private getEmoteWideness;
    private uploadFile;
    private compress;
    private applyScaling;
    private applyCommands;
    stop(): void;
}
declare class EmoteReplacerPlugin implements Plugin {
    settingsService: SettingsService | undefined;
    emoteService: EmoteService | undefined;
    completionsService: CompletionsService | undefined;
    attachService: AttachService | undefined;
    listenersService: ListenersService | undefined;
    gifsicleService: GifsicleService | undefined;
    modulesService: ModulesService | undefined;
    sendMessageService: SendMessageService | undefined;
    htmlService: HtmlService | undefined;
    meta: ExtendedMeta;
    private updateInterval;
    constructor(meta: ExtendedMeta);
    start(): void;
    private doStart;
    private showChangelogIfNeeded;
    private startServicesAndPatches;
    observer(e: MutationRecord): void;
    onSwitch(): void;
    getSettingsPanel(): HTMLElement;
    stop(): void;
}
interface BdWindow {
    ZeresPluginLibrary: ZeresPluginLibrary;
}
declare const _default: typeof RawPlugin | typeof EmoteReplacerPlugin;
export { _default as default, BdWindow };