import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from '@core/services/notification.service';
import type { CampaignMember } from '@core/models/Campaign/campaign';
import { canRequestCharacterPick as memberAllowsCharacterPick } from '@core/utils/campaign-roster.util';
import {
  campaignJoinSharePayload,
  campaignJoinUrl,
  copyTextToClipboard,
  joinLinkShareFallbackFeedback,
} from '@core/utils/campaign-hub-access.util';
import { CampaignHubStore } from './campaign-hub.store';
import { CampaignHubMembersService } from './campaign-hub-members.service';
import { CampaignHubSyncService } from './campaign-hub-sync.service';
import { CampaignHubNavService } from './campaign-hub-nav.service';
import { CampaignHubSheetsService } from './campaign-hub-sheets.service';
import { CampaignHubBootService } from './campaign-hub-boot.service';
import type { MemberCharacterAction } from '../campaign-detail/campaign-detail-roster/campaign-detail-roster';

/**
 * Roster / invitations / quitter-archiver-supprimer.
 * Persist = store uniquement.
 */
@Injectable()
export class CampaignHubRosterService {
  private readonly router = inject(Router);
  private readonly hub = inject(CampaignHubStore);
  private readonly members = inject(CampaignHubMembersService);
  private readonly hubSync = inject(CampaignHubSyncService);
  private readonly hubNav = inject(CampaignHubNavService);
  private readonly hubSheets = inject(CampaignHubSheetsService);
  private readonly boot = inject(CampaignHubBootService);
  private readonly notifications = inject(NotificationService);

  readonly showLeaveConfirm = signal(false);
  readonly leaveConfirmInput = signal('');
  readonly showDeleteConfirm = signal(false);
  readonly deleteConfirmInput = signal('');
  readonly leaving = this.hub.leaving;
  readonly archiving = this.hub.archiving;
  readonly deletingCampaign = this.hub.deletingCampaign;
  readonly deleteCampaignError = this.hub.deleteCampaignError;

  readonly canConfirmLeave = computed(() => {
    const c = this.hub.campaign();
    return !!c && this.leaveConfirmInput().trim() === c.title.trim();
  });

  readonly canConfirmDeleteCampaign = computed(() => {
    const c = this.hub.campaign();
    return !!c && this.deleteConfirmInput().trim() === c.title.trim();
  });

  canNativeShare(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  }

  copyCampaignJoinLink(): void {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    this.members.copyJoinLink(origin, navigator.clipboard);
  }

  shareCampaignJoinLink(): void {
    const c = this.hub.campaign();
    if (!c?.isOwner) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    this.members.ensureJoinLinkToken((token) => {
      const url = campaignJoinUrl(origin, token);
      if (this.canNativeShare()) {
        void navigator
          .share(campaignJoinSharePayload(c.title, url))
          .then(() => this.hub.rosterFeedback.set('Invitation partagée.'))
          .catch(() => undefined);
        return;
      }
      void copyTextToClipboard(url, navigator.clipboard).then((result) => {
        this.hub.rosterFeedback.set(joinLinkShareFallbackFeedback(result));
      });
    });
  }

  regenerateJoinLink(): void {
    const c = this.hub.campaign();
    if (!c?.isOwner || this.hub.joinLinkBusy()) return;
    this.boot.askConfirm(
      'Régénérer le lien ?',
      'L’ancien lien d’invitation ne fonctionnera plus. Les joueurs devront utiliser le nouveau.',
      () => this.members.rotateJoinLink(),
      'Régénérer',
      true,
    );
  }

  revokeJoinLink(): void {
    this.members.revokeJoinLink();
  }

  copyFriendsInviteLink(): void {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    this.members.copyFriendsInviteLink(origin, navigator.clipboard);
  }

  openLevelUpFromXp(): void {
    this.hubSheets.openLevelUpFromXp(() => this.hubNav.setTab('players'));
  }

  inviteFriend(userId: string): void {
    const displayName = this.boot.friendsList().find((f) => f.id === userId)?.displayName ?? 'ami';
    this.members.inviteFriend(userId, displayName, {
      onOk: () => {
        this.members.loadPendingInvites();
        if (this.hubNav.tab() === 'overview') this.hubSync.loadActivity();
      },
      onFail: () => this.members.loadPendingInvites(),
    });
  }

  private rosterReload(): void {
    this.boot.reload();
    this.notifications.refresh();
    if (this.hubNav.tab() === 'overview') this.hubSync.loadActivity();
  }

  proposeCharacter(characterId: string): void {
    this.members.proposeCharacter(characterId, { onOk: () => this.rosterReload() });
  }

  approveMember(member: CampaignMember): void {
    this.members.approveMember(member, { onOk: () => this.rosterReload() });
  }

  rejectMember(member: CampaignMember): void {
    if (!this.hub.campaign()) return;
    const name = member.proposedCharacterName ?? 'cette proposition';
    this.boot.askConfirm(
      'Refuser la proposition',
      `Refuser « ${name} » de ${member.displayName} ? Le joueur devra en proposer une autre.`,
      () => this.members.rejectMember(member, { onOk: () => this.rosterReload() }),
      'Refuser',
      true,
    );
  }

  canRequestCharacterPick(member: CampaignMember): boolean {
    return memberAllowsCharacterPick(member);
  }

  requestCharacterPick(member: CampaignMember): void {
    if (!this.canRequestCharacterPick(member) || this.hub.characterRequestLoadingId()) return;
    this.members.requestCharacterPick(member, {
      onOk: () => {
        this.notifications.refresh();
        if (this.hubNav.tab() === 'overview') this.hubSync.loadActivity();
      },
    });
  }

  isCharacterRequestLoading(memberId: string): boolean {
    return this.hub.characterRequestLoadingId() === memberId;
  }

  removeMember(member: CampaignMember): void {
    if (!this.hub.campaign()) return;
    this.boot.askConfirm(
      'Retirer le joueur',
      `Retirer ${member.displayName} de la campagne ?`,
      () =>
        this.members.removeMember(member, {
          onOk: () => {
            this.boot.reload();
            if (this.hubNav.tab() === 'overview') this.hubSync.loadActivity();
          },
        }),
      'Retirer',
    );
  }

  setMemberAsSpectator(member: CampaignMember): void {
    if (!this.hub.campaign()?.isOwner) return;
    this.boot.askConfirm(
      'Passer en spectateur',
      `${member.displayName} ne pourra plus jouer (lecture seule sur /play). Continuer ?`,
      () => this.members.setMemberSpectator(member, { onOk: () => this.boot.reload() }),
      'Spectateur',
    );
  }

  onRosterMemberCharacterAction(action: MemberCharacterAction, mode: 'view' | 'print'): void {
    if (mode === 'view') this.hubSheets.viewMemberCharacter(action.member, action.scope);
    else this.hubSheets.printMemberFullSheet(action.member, action.scope);
  }

  requestLeaveCampaign(): void {
    const c = this.hub.campaign();
    if (!c || c.isOwner || this.leaving()) return;
    this.leaveConfirmInput.set('');
    this.showLeaveConfirm.set(true);
  }

  cancelLeaveCampaign(): void {
    this.showLeaveConfirm.set(false);
    this.leaveConfirmInput.set('');
  }

  leaveCampaign(): void {
    if (!this.canConfirmLeave()) return;
    this.members.leaveCampaign(() => {
      this.showLeaveConfirm.set(false);
      void this.router.navigate(['/campaigns']);
    });
  }

  setCampaignArchived(archived: boolean): void {
    this.members.setArchived(archived);
  }

  requestDeleteCampaign(): void {
    const c = this.hub.campaign();
    if (!c?.isOwner || this.deletingCampaign()) return;
    this.deleteConfirmInput.set('');
    this.deleteCampaignError.set(null);
    this.showDeleteConfirm.set(true);
  }

  cancelDeleteCampaign(): void {
    this.showDeleteConfirm.set(false);
    this.deleteConfirmInput.set('');
    this.deleteCampaignError.set(null);
  }

  deleteCampaignFromDetail(): void {
    const c = this.hub.campaign();
    if (!c || !this.canConfirmDeleteCampaign()) return;
    this.members.deleteCampaign(this.deleteConfirmInput(), () => {
      this.showDeleteConfirm.set(false);
      void this.router.navigate(['/campaigns']);
    });
  }
}
