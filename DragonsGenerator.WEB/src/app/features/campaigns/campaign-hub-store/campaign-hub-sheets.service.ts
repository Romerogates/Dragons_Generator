import { Injectable, Injector, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, throwError } from 'rxjs';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { CharacterCloudService } from '@core/services/character-cloud.service';
import { CharacterHandoffService } from '@core/services/character-handoff.service';
import { AuthService } from '@core/services/auth.service';
import { getCampaignPdfService } from '@core/services/campaign-pdf.loader';
import type { Character } from '@core/models/Character/character';
import type { CampaignMember, CampaignPregen } from '@core/models/Campaign/campaign';
import { memberCharacterLoadingKey } from '@core/utils/campaign-roster.util';
import {
  assignedPregensForUser,
  characterFromNamedPayload,
  characterFromOwnedCloudRow,
  pregenHandoutMeta,
  readyPregensForPlayerView,
} from '@core/utils/campaign-hub-sheets.util';
import { CampaignHubStore } from './campaign-hub.store';

/**
 * Fiches joueur / pré-tirés du hub (consult, PDF, level-up).
 * Fourni avec `CampaignHubStore` sur `CampaignDetailPage`. Persist = store uniquement.
 */
@Injectable()
export class CampaignHubSheetsService {
  private readonly hub = inject(CampaignHubStore);
  private readonly campaigns = inject(CampaignCloudService);
  private readonly characters = inject(CharacterCloudService);
  private readonly handoff = inject(CharacterHandoffService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly auth = inject(AuthService);

  readonly memberCharacterLoadingId = signal<string | null>(null);
  readonly pregenPdfLoadingId = signal<string | null>(null);

  memberLoadingKey(memberId: string, scope: 'proposed' | 'approved'): string {
    return memberCharacterLoadingKey(memberId, scope);
  }

  isMemberCharacterLoading(memberId: string, scope: 'proposed' | 'approved'): boolean {
    return this.memberCharacterLoadingId() === this.memberLoadingKey(memberId, scope);
  }

  viewMemberCharacter(member: CampaignMember, scope: 'proposed' | 'approved'): void {
    const key = this.memberLoadingKey(member.id, scope);
    if (this.memberCharacterLoadingId() === key) return;
    const campaignId = this.hub.campaign()?.id;
    if (!campaignId) return;
    this.memberCharacterLoadingId.set(key);
    this.hub.error.set(null);
    this.loadMemberCharacter(member, scope).subscribe({
      next: (character) => {
        this.handoff.setCurrent(character, {
          mode: 'consult',
          sourceLabel:
            scope === 'proposed'
              ? `Proposition de ${member.displayName}`
              : 'Personnage de campagne',
          returnUrl: `/campaigns/${campaignId}?tab=players`,
          proposalReview:
            scope === 'proposed'
              ? {
                  campaignId,
                  memberId: member.id,
                  memberDisplayName: member.displayName,
                }
              : undefined,
        });
        this.memberCharacterLoadingId.set(null);
        void this.router.navigate(['/character-sheet']);
      },
      error: () => {
        this.memberCharacterLoadingId.set(null);
        this.hub.error.set("Impossible d'ouvrir la fiche.");
      },
    });
  }

  printMemberFullSheet(member: CampaignMember, scope: 'proposed' | 'approved' = 'approved'): void {
    const key = this.memberLoadingKey(member.id, scope);
    if (this.memberCharacterLoadingId() === key) return;
    this.memberCharacterLoadingId.set(key);
    this.hub.error.set(null);
    this.loadMemberCharacter(member, scope).subscribe({
      next: (character) => {
        void getCampaignPdfService(this.injector).then((pdf) =>
          pdf.downloadPlayerFullSheet(character).finally(() => {
            this.memberCharacterLoadingId.set(null);
          }),
        );
      },
      error: () => {
        this.memberCharacterLoadingId.set(null);
        this.hub.error.set('Impossible de générer la fiche PDF.');
      },
    });
  }

  printPregenHandout(pregen: CampaignPregen): void {
    const c = this.hub.campaign();
    if (!c) return;
    const meta = pregenHandoutMeta(pregen);
    void getCampaignPdfService(this.injector).then((pdf) =>
      pdf.downloadPregenHandout(c.title, pregen.characterName, pregen.publicHook, meta),
    );
  }

  printPregenFullSheet(pregen: CampaignPregen): void {
    if (this.pregenPdfLoadingId()) return;
    this.pregenPdfLoadingId.set(pregen.id);
    this.hub.pregenFeedback.set(null);
    this.loadPregenCharacter(pregen).subscribe({
      next: (character) => {
        void getCampaignPdfService(this.injector).then((pdf) =>
          pdf.downloadPlayerFullSheet(character).finally(() => {
            this.pregenPdfLoadingId.set(null);
          }),
        );
      },
      error: () => {
        this.pregenPdfLoadingId.set(null);
        this.hub.pregenFeedback.set('Impossible de générer la fiche PDF.');
      },
    });
  }

  viewPregenCharacter(pregen: CampaignPregen): void {
    const campaignId = this.hub.campaign()?.id;
    if (!campaignId) return;
    this.pregenPdfLoadingId.set(pregen.id);
    this.hub.pregenFeedback.set(null);
    this.loadPregenCharacter(pregen).subscribe({
      next: (character) => {
        this.handoff.setCurrent(character, {
          mode: 'consult',
          sourceLabel: 'Pré-tiré de campagne',
          returnUrl: `/campaigns/${campaignId}?tab=pregens`,
        });
        this.pregenPdfLoadingId.set(null);
        void this.router.navigate(['/character-sheet']);
      },
      error: () => {
        this.pregenPdfLoadingId.set(null);
        this.hub.pregenFeedback.set('Impossible d’ouvrir la fiche.');
      },
    });
  }

  openLevelUpFromXp(onNoCharacter: () => void): void {
    const userId = this.auth.user()?.id;
    const me = this.hub.campaign()?.members.find((m) => m.userId === userId && m.role === 'player');
    const charId = me?.approvedCharacterId;
    if (!charId) {
      onNoCharacter();
      return;
    }
    this.characters.get(charId).subscribe({
      next: (row) => {
        this.handoff.stashEdit(characterFromOwnedCloudRow(row));
        void this.router.navigate(['/create'], { queryParams: { levelUp: '1' } });
      },
      error: () => this.hub.error.set('Impossible d’ouvrir la fiche pour monter de niveau.'),
    });
  }

  myAssignedPregens(): CampaignPregen[] {
    return assignedPregensForUser(
      this.hub.campaign()?.data.pregenCharacters,
      this.auth.user()?.id,
    );
  }

  readyPregensForPlayers(): CampaignPregen[] {
    return readyPregensForPlayerView(this.hub.campaign(), this.auth.user()?.id);
  }

  private loadMemberCharacter(
    member: CampaignMember,
    scope: 'proposed' | 'approved',
  ): Observable<Character> {
    const c = this.hub.campaign();
    if (!c) return throwError(() => new Error('Campagne introuvable'));
    return this.campaigns
      .getMemberCharacter(c.id, member.id, scope)
      .pipe(map((res) => characterFromNamedPayload(res)));
  }

  private loadPregenCharacter(pregen: CampaignPregen): Observable<Character> {
    const c = this.hub.campaign();
    if (!c) return throwError(() => new Error('Campagne introuvable'));
    if (c.isOwner) {
      return this.characters.get(pregen.characterId).pipe(map((res) => characterFromNamedPayload(res)));
    }
    return this.campaigns
      .getPregenCharacter(c.id, pregen.id)
      .pipe(map((res) => characterFromNamedPayload(res)));
  }
}
