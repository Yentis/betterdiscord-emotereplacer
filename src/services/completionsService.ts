import Cached from '../interfaces/cached';
import { Listener } from '../interfaces/listener';
import ScrollOptions from '../interfaces/scrollOptions';
import { AttachService } from './attachService';
import { BaseService } from './baseService';
import { EmoteService } from './emoteService';
import { HtmlService } from './htmlService';
import { ListenersService } from './listenersService';
import { ModulesService } from './modulesService';
import { SettingsService } from './settingsService';
import { Utils } from '../utils/utils';

export class CompletionsService extends BaseService {
  public static readonly TAG = CompletionsService.name;
  private static readonly TEXTAREA_KEYDOWN_LISTENER = 'textAreaKeydown';
  private static readonly TEXTAREA_WHEEL_LISTENER = 'textAreaWheel';
  private static readonly TEXTAREA_FOCUS_LISTENER = 'textAreaFocus';
  private static readonly TEXTAREA_BLUR_LISTENER = 'textAreaBlur';
  private static readonly AUTOCOMPLETE_DIV_WHEEL_LISTENER = 'autocompleteDivWheel';
  private static readonly EMOTE_ROW_MOUSEENTER_LISTENER = 'emoteRowMouseenter';
  private static readonly EMOTE_ROW_MOUSEDOWN_LISTENER = 'emoteRowMousedown';

  emoteService!: EmoteService;
  settingsService!: SettingsService;
  modulesService!: ModulesService;
  listenersService!: ListenersService;
  htmlService!: HtmlService;
  attachService!: AttachService;

  draft = '';
  cached: Cached | undefined;
  curEditor?: Element;

  public start(
    emoteService: EmoteService,
    settingsService: SettingsService,
    modulesService: ModulesService,
    listenersService: ListenersService,
    htmlService: HtmlService,
    attachService: AttachService
  ): Promise<void> {
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

  private addListeners(): void {
    const editors = this.htmlService.getEditors();
    if (editors.length === 0) return;
    this.curEditor = editors[0];

    this.listenersService.removeListeners(CompletionsService.TEXTAREA_KEYDOWN_LISTENER);
    this.listenersService.removeListeners(CompletionsService.TEXTAREA_WHEEL_LISTENER);
    this.listenersService.removeListeners(CompletionsService.TEXTAREA_FOCUS_LISTENER);
    this.listenersService.removeListeners(CompletionsService.TEXTAREA_BLUR_LISTENER);

    editors.forEach((editor, index) => {
      const focusListener: Listener = {
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

      const blurListener: Listener = {
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

      const keydownListener: Listener = {
        element: textArea,
        name: 'keydown',
        callback: (evt: Event) => {
          this.browseCompletions(evt as KeyboardEvent);
        },
      };

      textArea.addEventListener(keydownListener.name, keydownListener.callback);
      this.listenersService.addListener(
        `${CompletionsService.TEXTAREA_KEYDOWN_LISTENER}${index}`,
        keydownListener
      );

      const wheelListener: Listener = {
        element: textArea,
        name: 'wheel',
        callback: (evt: Event) => {
          this.scrollCompletions(evt as WheelEvent);
        },
      };

      textArea.addEventListener(wheelListener.name, wheelListener.callback, { passive: true });

      this.listenersService.addListener(
        `${CompletionsService.TEXTAREA_WHEEL_LISTENER}${index}`,
        wheelListener
      );
    });
  }

  public browseCompletions(event: KeyboardEvent): void {
    if (
      !this.emoteService.shouldCompleteEmote(this.draft) &&
      !this.emoteService.shouldCompleteCommand(this.draft)
    ) {
      return;
    }

    let delta = 0;
    let options: ScrollOptions | undefined;
    const autocompleteItems = Math.round(this.settingsService.settings.autocompleteItems);

    switch (event.key) {
      case 'Tab':
      case 'Enter':
        if (!this.prepareCompletions()) {
          break;
        }

        // Prevent Discord's default behavior (send message)
        event.stopPropagation();
        // Prevent adding a tab or line break to text
        event.preventDefault();

        this.insertSelectedCompletion().catch((error) => this.logger.error(error));
        break;

      case 'ArrowUp':
        delta = -1;
        break;

      case 'ArrowDown':
        delta = 1;
        break;

      case 'PageUp':
        delta = -autocompleteItems;
        options = { locked: true, clamped: true };
        break;

      case 'PageDown':
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

  private prepareCompletions(): boolean {
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

  private async insertSelectedCompletion(): Promise<void> {
    const { completions, matchText, selectedIndex } = this.cached ?? {};
    const curDraft = this.draft;
    const matchTextLength = matchText?.length ?? 0;
    const channelId = this.attachService.curChannelId;

    if (completions === undefined || selectedIndex === undefined || channelId === undefined) {
      return;
    }

    const selectedCompletion = completions[selectedIndex];
    if (!selectedCompletion) return;
    const completionValueArguments =
      typeof selectedCompletion.data === 'string' ? undefined : selectedCompletion.data.arguments;

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

  private async insertDraft(channelId: string, draft: string): Promise<void> {
    await new Promise<void>((resolve) => {
      const listener = () => {
        resolve();
        this.modulesService.draftStore.removeChangeListener(listener);
      };

      this.modulesService.draftStore.addChangeListener(listener);
      this.modulesService.draft.clearDraft(channelId, 0);
    });

    this.modulesService.componentDispatcher.dispatchToLastSubscribed('INSERT_TEXT', {
      plainText: draft,
    });
  }

  public destroyCompletions(): void {
    const textAreaContainer = this.htmlService.getTextAreaContainer(this.curEditor);

    if (textAreaContainer) {
      const completions = this.htmlService
        .getTextAreaContainer(this.curEditor)
        ?.querySelectorAll(`.${this.plugin.meta.name}`);

      completions?.forEach((completion) => {
        completion.remove();
      });
    }

    this.cached = undefined;
  }

  private doRenderCompletions(): void {
    const channelTextArea = this.htmlService.getTextAreaContainer(this.curEditor);
    if (!channelTextArea) return;

    const oldAutoComplete = channelTextArea?.querySelectorAll(`.${this.plugin.meta.name}`) ?? [];
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
    const autocompleteListener: Listener = {
      element: autocompleteDiv,
      name: 'wheel',
      callback: (evt: Event) => {
        this.scrollCompletions(evt as WheelEvent, { locked: true });
      },
    };

    autocompleteDiv.addEventListener(autocompleteListener.name, autocompleteListener.callback, {
      passive: true,
    });

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

    const header = document.createElement('div');
    this.htmlService.addClasses(header, discordClasses.Autocomplete.base);
    autocompleteInnerDiv.append(header);

    const contentTitle = document.createElement('h3');
    this.htmlService.addClasses(contentTitle, discordClasses.Autocomplete.contentTitle);

    contentTitle.innerText = (isEmote ? 'Emoji matching ' : 'Commands ') + (matchText ?? '');
    header.append(contentTitle);

    for (const [index, { name, data }] of matchList?.entries() ?? []) {
      const emoteRow = document.createElement('div');
      emoteRow.setAttribute('aria-disabled', 'false');

      this.htmlService.addClasses(
        emoteRow,
        discordClasses.Autocomplete.clickable,
        discordClasses.Autocomplete.autocompleteRowVertical,
        discordClasses.Autocomplete.autocompleteRowVerticalSmall
      );

      const mouseEnterListener: Listener = {
        element: emoteRow,
        name: 'mouseenter',
        callback: () => {
          if (!this.cached) this.cached = {};
          this.cached.selectedIndex = index + firstIndex;

          for (const child of autocompleteInnerDiv.children ?? []) {
            child.setAttribute('aria-selected', 'false');
          }
        },
      };
      emoteRow.addEventListener(mouseEnterListener.name, mouseEnterListener.callback);
      this.listenersService.addListener(
        `${CompletionsService.EMOTE_ROW_MOUSEENTER_LISTENER}${index}`,
        mouseEnterListener
      );

      const mouseDownListener: Listener = {
        element: emoteRow,
        name: 'mousedown',
        callback: (evt: Event) => {
          // Prevent loss of focus
          evt.preventDefault();

          if (!this.cached) this.cached = {};
          this.cached.selectedIndex = index + firstIndex;
          this.insertSelectedCompletion().catch((error) => this.logger.error(error));
        },
      };
      emoteRow.addEventListener(mouseDownListener.name, mouseDownListener.callback);
      this.listenersService.addListener(
        `${CompletionsService.EMOTE_ROW_MOUSEDOWN_LISTENER}${index}`,
        mouseDownListener
      );
      autocompleteInnerDiv.append(emoteRow);

      const emoteSelector = document.createElement('div');
      this.htmlService.addClasses(emoteSelector, discordClasses.Autocomplete.base);
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
          Utils.loadImagePromise(data, false, containerImage).catch((error) =>
            this.logger.error(error)
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
  }

  public renderCompletions = BdApi.Utils.debounce(this.doRenderCompletions.bind(this), 250);

  public scrollCompletions(e: WheelEvent, options?: ScrollOptions): void {
    const delta = Math.sign(e.deltaY);
    this.scrollWindow(delta, options);
  }

  private scrollWindow(
    delta: number,
    { locked = false, clamped = false }: ScrollOptions = {}
  ): void {
    if (!this.cached) return;

    const preScroll = 2;
    const { completions, selectedIndex: prevSelectedIndex, windowOffset } = this.cached;
    const autocompleteItems = Math.round(this.settingsService.settings.autocompleteItems);

    if (!completions) {
      return;
    }

    // Change selected index
    const completionsCount = completions.length;
    let selectedIndex = (prevSelectedIndex ?? 0) + delta;
    if (clamped) {
      selectedIndex = Utils.clamp(selectedIndex, 0, completionsCount - 1);
    } else {
      selectedIndex =
        (selectedIndex % completionsCount) + (selectedIndex < 0 ? completionsCount : 0);
    }
    this.cached.selectedIndex = selectedIndex;

    const boundMax = Math.max(0, completionsCount - autocompleteItems);

    // Clamp window position to bounds based on new selected index
    const boundLower = Utils.clamp(
      selectedIndex + preScroll - (autocompleteItems - 1),
      0,
      boundMax
    );
    const boundUpper = Utils.clamp(selectedIndex - preScroll, 0, boundMax);

    this.cached.windowOffset = Utils.clamp(
      (windowOffset ?? 0) + (locked ? delta : 0),
      boundLower,
      boundUpper
    );

    // Render immediately
    this.doRenderCompletions();
  }

  public stop(): void {
    this.draft = '';
    this.cached = undefined;
    this.curEditor = undefined;
  }
}
