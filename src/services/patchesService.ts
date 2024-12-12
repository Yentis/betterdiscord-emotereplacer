import { AttachService } from './attachService';
import { BaseService } from './baseService';
import { CompletionsService } from './completionsService';
import { EmoteService } from './emoteService';
import { ModulesService } from './modulesService';
import { PendingReply } from '../interfaces/pendingReply';
import Emoji from '../interfaces/emoji';
import EmojiStore from '../interfaces/modules/emojiStore';
import { Sticker } from 'interfaces/sticker';
import { SendMessageService } from './sendMessageService';

export class PatchesService extends BaseService {
  sendMessageService!: SendMessageService;
  attachService!: AttachService;
  completionsService!: CompletionsService;
  emoteService!: EmoteService;
  modulesService!: ModulesService;

  private patcher = this.bdApi.Patcher;

  public start(
    sendMessageService: SendMessageService,
    attachService: AttachService,
    completionsService: CompletionsService,
    emoteService: EmoteService,
    modulesService: ModulesService
  ): Promise<void> {
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

  private messageStorePatch(): void {
    this.patcher.instead(
      this.modulesService.messageStore,
      'sendMessage',
      (_, args, original: unknown) => this.sendMessageService.onSendMessage(args, original)
    );

    this.patcher.instead(
      this.modulesService.messageStore,
      'sendStickers',
      (_, args, original: unknown) => this.sendMessageService.onSendSticker(args, original)
    );
  }

  private changeDraftPatch(): void {
    this.patcher.before(this.modulesService.draft, 'changeDraft', (_, args) =>
      this.onChangeDraft(args)
    );
  }

  private onChangeDraft(args: unknown[]): void {
    const channelId = args[0] as string | undefined;
    if (channelId !== undefined) this.attachService.setCanAttach(channelId);
    if (!this.attachService.canAttach) return;

    const draft = args[1] as string | undefined;
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
      this.logger.warn('Error in onChangeDraft', err);
    }
  }

  private pendingReplyPatch(): void {
    const pendingReplyDispatcher = this.modulesService.pendingReplyDispatcher;

    const createPendingReply = pendingReplyDispatcher.createPendingReplyKey;
    if (createPendingReply === undefined) {
      this.logger.warn('Create pending reply function name not found');
      return;
    }

    const deletePendingReply = pendingReplyDispatcher.deletePendingReplyKey;
    if (deletePendingReply === undefined) {
      this.logger.warn('Delete pending reply function name not found');
      return;
    }

    const setPendingReplyShouldMention = pendingReplyDispatcher.setPendingReplyShouldMentionKey;
    if (setPendingReplyShouldMention === undefined) {
      this.logger.warn('Set pending reply should mention function name not found');
      return;
    }

    this.patcher.before(pendingReplyDispatcher.module, createPendingReply as never, (_, args) => {
      if (!args[0]) return;
      const reply = args[0] as PendingReply;

      this.attachService.pendingReply = reply;
    });

    this.patcher.instead(
      pendingReplyDispatcher.module,
      deletePendingReply as never,
      (_, args, original) => this.onDeletePendingReply(args, original)
    );

    this.patcher.before(
      pendingReplyDispatcher.module,
      setPendingReplyShouldMention as never,
      (_, args) => {
        if (typeof args[0] !== 'string' || typeof args[1] !== 'boolean') return;
        const channelId = args[0] as string;
        const shouldMention = args[1] as boolean;

        if (this.attachService.pendingReply?.channel.id !== channelId) return;
        this.attachService.pendingReply.shouldMention = shouldMention;
      }
    );
  }

  private async onDeletePendingReply(args: unknown[], original: unknown): Promise<void> {
    const callDefault = original as (...args: unknown[]) => unknown;

    try {
      // Prevent Discord from deleting the pending reply until our emote has been uploaded
      if (this.attachService.pendingUpload) await this.attachService.pendingUpload;
      callDefault(...args);
    } catch (err) {
      this.logger.warn('Error in onDeletePendingReply', err);
    } finally {
      this.attachService.pendingReply = undefined;
    }
  }

  private emojiSearchPatch(): void {
    this.patcher.after(this.modulesService.emojiSearch, 'search', (_, _2, result) =>
      this.onEmojiSearch(result)
    );
  }

  private onEmojiSearch(result: unknown): void {
    const searchResult = result as {
      unlocked: unknown[];
      locked: unknown[];
    };

    searchResult.unlocked.push(...searchResult.locked);
    searchResult.locked = [];
  }

  private lockedEmojisPatch(): void {
    const emojiStore = this.modulesService.emojiStore;

    this.patcher.after(emojiStore, 'getEmojiUnavailableReason', (_, args, result) =>
      this.onGetEmojiUnavailableReason(args, result)
    );

    this.patcher.after(emojiStore, 'getEmojiUnavailableReasons', (_, args, result) => {
      result.emojiNitroLocked = false;
      return result;
    });

    this.patcher.after(emojiStore, 'isEmojiDisabled', (_, args) =>
      this.onIsEmojiDisabled(args, emojiStore)
    );

    this.patcher.after(emojiStore, 'isEmojiCategoryNitroLocked', (_, _args, result) => {
      result = false;
      return result;
    });
  }

  private onGetEmojiUnavailableReason(args: unknown[], result: unknown): unknown {
    const EmojiDisabledReasons = this.modulesService.emojiDisabledReasons;
    const options = args[0] as { emoji?: Emoji; intention?: number } | undefined;

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

  private onIsEmojiDisabled(args: unknown[], emojiStore: EmojiStore): boolean {
    const [emoji, channel, intention] = args;

    const reason = emojiStore.getEmojiUnavailableReason({
      emoji,
      channel,
      intention,
    });

    return reason !== null;
  }

  private stickerSendablePatch(): void {
    const stickerSendabilityStore = this.modulesService.stickerSendabilityStore;
    const StickerSendability = stickerSendabilityStore.StickerSendability;

    if (!StickerSendability) return;
    if (stickerSendabilityStore.getStickerSendabilityKey === undefined) return;
    if (!stickerSendabilityStore.isSendableSticker) return;

    this.patcher.after(
      stickerSendabilityStore.module,
      stickerSendabilityStore.getStickerSendabilityKey,
      (_, args) => {
        const sticker = args[0] as Sticker | undefined;
        if (!this.isSendableSticker(sticker)) return;

        return StickerSendability.SENDABLE;
      }
    );

    this.patcher.after(
      stickerSendabilityStore.module,
      stickerSendabilityStore.isSendableSticker.key,
      (_, args) => {
        const sticker = args[0] as Sticker | undefined;
        if (!this.isSendableSticker(sticker)) return;

        return true;
      }
    );
  }

  private isSendableSticker(sticker?: Sticker): boolean {
    return sticker?.type === this.modulesService.stickerType.GUILD;
  }

  public stop(): void {
    this.patcher.unpatchAll();
  }
}
