import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  inject,
  OnDestroy,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CloudCharacterSummary } from '@core/services/character-cloud.service';
import { CampaignSummary } from '@core/models/Campaign/campaign';
import {
  SupportTicket,
  SupportTicketMessage,
  SupportTicketThread,
} from '@core/models/support-ticket';
import {
  supportStatusLabel,
  supportWaitingLabel,
  supportWaitingOn,
} from '@core/utils/support-status.util';
import { SupportOverlayService } from '@core/services/support-overlay.service';

export interface SupportReplyPayload {
  body: string;
  characterId: string;
  campaignId: string;
  file: File | null;
  notifyEmail: boolean;
}

@Component({
  selector: 'app-support-conversation',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NgTemplateOutlet],
  templateUrl: './support-conversation.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: { class: 'contents' },
})
export class SupportConversation implements AfterViewInit, OnDestroy {
  readonly audience = input<'player' | 'staff'>('player');
  readonly thread = input.required<SupportTicketThread>();
  readonly myCharacters = input<CloudCharacterSummary[]>([]);
  readonly myCampaigns = input<CampaignSummary[]>([]);
  readonly sending = input(false);
  readonly error = input<string | null>(null);
  readonly adminNotes = input('');

  readonly closed = output<void>();
  readonly send = output<SupportReplyPayload>();
  readonly downloadCharacter = output<{ ticket?: SupportTicket; message?: SupportTicketMessage }>();
  readonly openAttachment = output<{ ticket?: SupportTicket; message?: SupportTicketMessage }>();
  readonly takeTicket = output<string>();
  readonly setStatus = output<{ id: string; status: string }>();
  readonly saveNotes = output<{ id: string; notes: string }>();
  readonly notesChange = output<string>();

  replyBody = '';
  replyCharacterId = '';
  replyCampaignId = '';
  replyFile: File | null = null;
  readonly replyFileName = signal('');
  readonly attachOpen = signal(false);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly overlay = inject(SupportOverlayService);

  readonly isStaff = computed(() => this.audience() === 'staff');
  readonly ticket = computed(() => this.thread().ticket);
  readonly waiting = computed(() => {
    const msgs = this.thread().messages;
    const last = msgs.length ? msgs[msgs.length - 1]!.fromStaff : false;
    return supportWaitingOn(this.ticket().status, last);
  });
  readonly waitingText = computed(() => supportWaitingLabel(this.waiting(), this.audience()));
  readonly canEmail = computed(() => !!this.thread().canEmailPlayer);
  readonly campaignQuery = computed(() => (this.isStaff() ? { support: '1' } : {}));
  readonly selectedCharacter = computed(() =>
    this.myCharacters().find((c) => c.id === this.replyCharacterId) ?? null,
  );
  readonly selectedCampaign = computed(() =>
    this.myCampaigns().find((c) => c.id === this.replyCampaignId) ?? null,
  );

  constructor() {
    this.overlay.open.set(true);
    effect(() => {
      const messageCount = this.thread().messages.length;
      untracked(() =>
        queueMicrotask(() => {
          if (messageCount > -1) this.scrollToBottom();
        }),
      );
    });
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  ngOnDestroy(): void {
    this.overlay.open.set(false);
  }

  statusLabel(status: string): string {
    return supportStatusLabel(status, this.audience());
  }

  isMine(fromStaff: boolean): boolean {
    return this.isStaff() ? fromStaff : !fromStaff;
  }

  onReplyFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.replyFile = input.files?.[0] ?? null;
    this.replyFileName.set(this.replyFile?.name ?? '');
  }

  emitSend(notifyEmail: boolean): void {
    const body = this.replyBody.trim();
    if (body.length < 2) return;
    this.send.emit({
      body,
      characterId: this.replyCharacterId,
      campaignId: this.replyCampaignId,
      file: this.replyFile,
      notifyEmail,
    });
  }

  replyByMail(): void {
    this.emitSend(true);
  }

  clearReplyUi(): void {
    this.replyBody = '';
    this.replyCharacterId = '';
    this.replyCampaignId = '';
    this.replyFile = null;
    this.replyFileName.set('');
    this.attachOpen.set(false);
  }

  private scrollToBottom(): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }
}
