import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PdfGeneratorService } from '@core/services/pdf-generator.service';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { NotificationService } from '@core/services/notification.service';
import type { Character } from '@core/models/Character/character';
import {
  CharacterHandoffService,
  type CharacterProposalReview,
} from '@core/services/character-handoff.service';
import { PdfPagePreview } from '@shared/components/pdf-page-preview/pdf-page-preview';
import { prefersNativePdfFallback } from '@core/utils/pdf-preview.util';
import { CharacterPlayView } from './character-play-view';

type SheetViewMode = 'pdf' | 'ui';

const VIEW_MODE_KEY = 'dg_character_sheet_view';

function readStoredViewMode(): SheetViewMode {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    if (v === 'ui' || v === 'pdf') return v;
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches) {
    return 'ui';
  }
  return 'pdf';
}

@Component({
  selector: 'app-character-sheet',
  standalone: true,
  imports: [CommonModule, RouterLink, CharacterPlayView, PdfPagePreview],
  templateUrl: './character-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CharacterSheet implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly pdfService = inject(PdfGeneratorService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly handoff = inject(CharacterHandoffService);
  private readonly campaigns = inject(CampaignCloudService);
  private readonly notifications = inject(NotificationService);

  readonly character = signal<Character | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly pdfPreviewUrl = signal<SafeResourceUrl | null>(null);
  readonly pdfRawUrl = signal<string | null>(null);
  readonly pdfFailed = signal(false);
  readonly pdfJsFailed = signal(false);
  /** Tablette / mobile : iframe PDF souvent inutilisable. */
  readonly useNativePdfFallback = prefersNativePdfFallback();
  readonly isConsult = signal(false);
  readonly consultSourceLabel = signal<string | null>(null);
  readonly consultReturnUrl = signal<string | null>(null);
  readonly proposalReview = signal<CharacterProposalReview | null>(null);
  readonly proposalActionBusy = signal(false);
  readonly proposalActionError = signal<string | null>(null);
  /** Interface affichée : PDF par défaut (fiche Jouer en consultation table). */
  readonly viewMode = signal<SheetViewMode>(readStoredViewMode());

  readonly consultBackLabel = computed(() => {
    const url = this.consultReturnUrl();
    if (url?.includes('/play')) return '← Retour à la table';
    if (url?.includes('tab=players')) return '← Retour aux joueurs';
    if (this.consultSourceLabel()) return '← Retour';
    return '← Retour';
  });

  readonly errorBackLink = computed(() => this.consultReturnUrl() ?? '/characters');
  readonly errorBackLabel = computed(() => {
    const url = this.consultReturnUrl();
    if (url?.includes('/play')) return 'Retour à la table';
    if (url?.includes('tab=players')) return 'Retour aux joueurs';
    return 'Retour à la liste';
  });

  readonly auraFeatures = computed(() => {
    const feats = this.character()?.features ?? [];
    return feats
      .filter((f) => /aura/i.test(f.name) || /Portée d'aura/i.test(f.desc ?? ''))
      .map((f) => {
        const m = (f.desc ?? '').match(/Portée d'aura\s*:\s*([\d.,]+)\s*m/i);
        return m ? `${f.name} (${m[1]} m)` : f.name;
      });
  });

  async ngOnInit(): Promise<void> {
    try {
      const character = this.handoff.peekCurrent();
      if (!character) {
        this.error.set('Aucun personnage sélectionné.');
        this.loading.set(false);
        return;
      }
      this.character.set(character);
      this.isConsult.set(this.handoff.peekMode() === 'consult');
      this.consultSourceLabel.set(this.handoff.peekSourceLabel());
      this.consultReturnUrl.set(this.handoff.peekReturnUrl());
      this.proposalReview.set(this.handoff.peekProposalReview());
      if (this.isConsult()) {
        this.viewMode.set('ui');
      }

      try {
        const url = await this.pdfService.generatePdfBlob(character);
        this.pdfRawUrl.set(url);
        this.pdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      } catch (e) {
        console.error(e);
        this.pdfFailed.set(true);
        if (this.viewMode() === 'pdf') this.viewMode.set('ui');
      }
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    const url = this.pdfRawUrl();
    if (url) URL.revokeObjectURL(url);
  }

  setViewMode(mode: SheetViewMode): void {
    this.viewMode.set(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      /* ignore quota / private mode */
    }
  }

  toggleViewMode(): void {
    this.setViewMode(this.viewMode() === 'pdf' ? 'ui' : 'pdf');
  }

  onPdfJsFailed(): void {
    this.pdfJsFailed.set(true);
  }

  getName(): string {
    return this.character()?.name || 'Héros';
  }

  getSpecies(): string {
    const c = this.character();
    return c?.species?.label || '';
  }

  getClass(): string {
    const c = this.character();
    const cls = c?.classes?.[0];
    if (!cls) return '';
    return cls.subclassLabel
      ? `${cls.classLabel} — ${cls.subclassLabel}`
      : cls.classLabel || '';
  }

  getLevel(): number {
    return this.character()?.totalLevel ?? 1;
  }

  getHp(): number {
    return this.character()?.vitality?.hitPointsMax ?? 0;
  }

  getAc(): number {
    return this.character()?.defense?.armorClass ?? 10;
  }

  downloadPdf(): void {
    const c = this.character();
    if (c) this.pdfService.generatePdf(c);
  }

  openFullscreen(): void {
    const url = this.pdfRawUrl();
    if (url) window.open(url, '_blank');
  }

  editCharacter(): void {
    if (this.isConsult()) return;
    const c = this.character();
    if (!c) return;
    this.handoff.stashEdit(c);
    this.router.navigate(['/create']);
  }

  approveProposal(): void {
    this.resolveProposal('approve');
  }

  rejectProposal(): void {
    this.resolveProposal('reject');
  }

  private resolveProposal(action: 'approve' | 'reject'): void {
    const review = this.proposalReview();
    if (!review || this.proposalActionBusy()) return;
    this.proposalActionBusy.set(true);
    this.proposalActionError.set(null);
    const req =
      action === 'approve'
        ? this.campaigns.approveProposal(review.campaignId, review.memberId)
        : this.campaigns.rejectProposal(review.campaignId, review.memberId);
    req.subscribe({
      next: () => {
        this.notifications.refresh();
        this.handoff.clearCurrent();
        this.proposalReview.set(null);
        this.proposalActionBusy.set(false);
        this.backToList();
      },
      error: () => {
        this.proposalActionBusy.set(false);
        this.proposalActionError.set(
          action === 'approve'
            ? 'Impossible d’accepter cette proposition.'
            : 'Impossible de refuser cette proposition.',
        );
      },
    });
  }

  backToList(): void {
    if (this.isConsult()) {
      const returnUrl = this.consultReturnUrl() ?? this.handoff.peekReturnUrl();
      if (returnUrl) {
        void this.router.navigateByUrl(returnUrl);
        return;
      }
      void this.router.navigate(['/']);
      return;
    }
    this.router.navigate(['/characters']);
  }
}
