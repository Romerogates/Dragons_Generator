import { Injectable, Injector, inject, signal } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { catchError, forkJoin, map, of, type Observable } from 'rxjs';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { DataService } from '@core/services/data.service';
import { getCampaignPdfService } from '@core/services/campaign-pdf.loader';
import type { CreaturePrintEntry, PlayerGmSummary } from '@core/services/campaign-pdf.types';
import type { Character } from '@core/models/Character/character';
import type { CampaignData } from '@core/models/Campaign/campaign';
import {
  downloadBlobUrl,
  namedPdfObjectUrl,
  prefersNativePdfFallback,
} from '@core/utils/pdf-preview.util';
import { exportEveningPdf, exportUnifiedEveningPack } from '@core/utils/evening-pdf.util';
import { CampaignHubStore } from './campaign-hub.store';

/**
 * Pack MJ / bestiaire / PDF soirée du hub.
 * Fourni avec `CampaignHubStore` sur `CampaignDetailPage`.
 */
@Injectable()
export class CampaignHubPdfService {
  private readonly hub = inject(CampaignHubStore);
  private readonly data = inject(DataService);
  private readonly campaigns = inject(CampaignCloudService);
  private readonly injector = inject(Injector);
  private readonly sanitizer = inject(DomSanitizer);

  readonly printing = signal(false);
  readonly isLoadingPreview = signal(false);
  readonly pdfPreviewUrl = signal<SafeResourceUrl | null>(null);
  readonly pdfPreviewRawUrl = signal<string | null>(null);
  readonly pdfPreviewKind = signal<'pack' | 'bestiary'>('pack');

  private rawBlobUrl: string | null = null;
  private previewCacheKey: string | null = null;

  destroy(): void {
    this.revokePreviewUrl();
  }

  async exportSessionEveningPdf(sessionId: string): Promise<void> {
    const c = this.hub.campaign();
    if (!c) return;
    const session = (c.data.sessions ?? []).find((s) => s.id === sessionId);
    if (!session) return;
    try {
      await exportEveningPdf(
        c.title,
        session,
        (c.data.handouts ?? []).filter((h) => h.published),
      );
    } catch {
      this.hub.error.set('Impossible d’exporter le PDF soirée.');
    }
  }

  async exportSessionUnifiedPack(sessionId: string): Promise<void> {
    const c = this.hub.campaign();
    if (!c) return;
    const session = (c.data.sessions ?? []).find((s) => s.id === sessionId);
    if (!session) return;
    try {
      await exportUnifiedEveningPack(
        c.title,
        session,
        (c.data.handouts ?? []).filter((h) => h.published),
        {
          adventureSynopsis: c.data.adventure,
          encounterNames: (c.data.encounters ?? []).map((e) => e.name || 'Rencontre'),
          creatureNames: (c.data.creatures ?? [])
            .map((cr) => cr.customName?.trim() || cr.creatureName || '')
            .filter(Boolean)
            .slice(0, 40),
          playerNames: (c.members ?? [])
            .filter((m) => m.role === 'player')
            .map((p) => p.displayName || p.approvedCharacterName || '')
            .filter(Boolean),
        },
      );
    } catch {
      this.hub.error.set('Impossible d’exporter le pack soirée.');
    }
  }

  openBestiaryFullscreen(): void {
    const url = this.rawBlobUrl;
    if (!url) return;
    if (prefersNativePdfFallback()) {
      const name =
        this.pdfPreviewKind() === 'bestiary'
          ? `bestiaire-${this.hub.campaign()?.title ?? 'campagne'}.pdf`
          : `pack-mj-${this.hub.campaign()?.title ?? 'campagne'}.pdf`;
      downloadBlobUrl(url, name.replace(/\s+/g, '-'));
      return;
    }
    window.open(url, '_blank');
  }

  downloadPdfPreview(): void {
    const url = this.rawBlobUrl;
    if (!url) return;
    const name =
      this.pdfPreviewKind() === 'bestiary'
        ? `bestiaire-${this.hub.campaign()?.title ?? 'campagne'}.pdf`
        : `pack-mj-${this.hub.campaign()?.title ?? 'campagne'}.pdf`;
    downloadBlobUrl(url, name.replace(/\s+/g, '-'));
  }

  loadPackPreview(): void {
    const c = this.hub.campaign();
    if (!c?.isOwner) {
      this.revokePreviewUrl();
      return;
    }
    const cacheKey = `${c.id}:pack`;
    if (this.previewCacheKey === cacheKey && this.pdfPreviewUrl()) {
      this.pdfPreviewKind.set('pack');
      return;
    }

    this.pdfPreviewKind.set('pack');
    this.isLoadingPreview.set(true);
    this.loadCreatureEntries(c.data).subscribe({
      next: async (entries) => {
        try {
          this.revokePreviewUrl();
          const summaries = await this.loadPlayerSummaries();
          const pdf = await getCampaignPdfService(this.injector);
          const url = await pdf.generateCampaignPackBlob(c.title, c.data, entries, summaries);
          await this.setPreviewBlobUrl(url, `pack-mj-${c.title.replace(/\s+/g, '-')}.pdf`);
          this.previewCacheKey = cacheKey;
        } catch {
          this.revokePreviewUrl();
        } finally {
          this.isLoadingPreview.set(false);
        }
      },
      error: () => {
        this.revokePreviewUrl();
        this.isLoadingPreview.set(false);
      },
    });
  }

  loadBestiaryPreview(): void {
    const c = this.hub.campaign();
    if (!c?.isOwner || !c.data.creatures.length) {
      this.revokePreviewUrl();
      return;
    }
    const cacheKey = `${c.id}:bestiary`;
    if (this.previewCacheKey === cacheKey && this.pdfPreviewUrl()) {
      this.pdfPreviewKind.set('bestiary');
      return;
    }

    this.pdfPreviewKind.set('bestiary');
    this.isLoadingPreview.set(true);
    this.loadCreatureEntries(c.data).subscribe({
      next: async (entries) => {
        try {
          if (!entries.length) {
            this.revokePreviewUrl();
            return;
          }
          this.revokePreviewUrl();
          const pdf = await getCampaignPdfService(this.injector);
          const url = await pdf.generateCreaturesPdfBlob(entries, c.title, c.data);
          await this.setPreviewBlobUrl(url, `bestiaire-${c.title.replace(/\s+/g, '-')}.pdf`);
          this.previewCacheKey = cacheKey;
        } catch {
          this.revokePreviewUrl();
        } finally {
          this.isLoadingPreview.set(false);
        }
      },
      error: () => {
        this.revokePreviewUrl();
        this.isLoadingPreview.set(false);
      },
    });
  }

  printBestiary(): void {
    this.runPrint(async (entries) => {
      const c = this.hub.campaign()!;
      const pdf = await getCampaignPdfService(this.injector);
      await pdf.downloadCreaturesCompilation(entries, c.title, c.data);
    });
  }

  printPackMj(): void {
    const c = this.hub.campaign();
    if (!c) return;
    this.printing.set(true);
    this.hub.error.set(null);
    this.loadCreatureEntries(c.data).subscribe({
      next: (entries) => {
        void (async () => {
          try {
            const summaries = await this.loadPlayerSummaries();
            const pdf = await getCampaignPdfService(this.injector);
            await pdf.downloadCampaignPack(c.title, c.data, entries, summaries);
          } catch {
            this.hub.error.set('Échec de la génération PDF.');
          } finally {
            this.printing.set(false);
          }
        })();
      },
      error: () => {
        this.hub.error.set('Impossible de charger les fiches créatures.');
        this.printing.set(false);
      },
    });
  }

  printPlayerSummariesPdf(): void {
    void this.runPrintPlayerSummariesOnly();
  }

  printAllPlayerSheets(): void {
    void this.runPrintPlayerFullSheets();
  }

  private runPrint(action: (entries: CreaturePrintEntry[]) => Promise<void>): void {
    const c = this.hub.campaign();
    if (!c?.data.creatures.length) {
      this.hub.error.set('Aucune créature à imprimer.');
      return;
    }
    this.printing.set(true);
    this.hub.error.set(null);
    this.loadCreatureEntries(c.data).subscribe({
      next: (entries) => {
        action(entries)
          .catch(() => this.hub.error.set('Échec de la génération PDF.'))
          .finally(() => this.printing.set(false));
      },
      error: () => {
        this.hub.error.set('Impossible de charger les fiches créatures.');
        this.printing.set(false);
      },
    });
  }

  private loadCreatureEntries(data: CampaignData): Observable<CreaturePrintEntry[]> {
    const selections = data.creatures;
    if (!selections.length) return of([]);
    return forkJoin(
      selections.map((s) =>
        this.data.getCreatureById(s.creatureId).pipe(
          catchError(() => of(null)),
          map(
            (creature): CreaturePrintEntry | null =>
              creature
                ? {
                    creature,
                    customName: s.customName,
                    role: s.role,
                    backstory: s.backstory,
                  }
                : null,
          ),
        ),
      ),
    ).pipe(map((list) => list.filter((x): x is CreaturePrintEntry => x !== null)));
  }

  private approvedPlayers() {
    return (this.hub.campaign()?.members ?? []).filter(
      (p) => p.role === 'player' && p.proposalStatus === 'approved' && p.approvedCharacterId,
    );
  }

  private async loadPlayerSummaries(): Promise<PlayerGmSummary[]> {
    const c = this.hub.campaign();
    if (!c) return [];
    const approved = this.approvedPlayers();
    const pdf = await getCampaignPdfService(this.injector);
    const summaries = await Promise.all(
      approved.map(
        (p) =>
          new Promise<PlayerGmSummary | null>((resolve) => {
            this.campaigns.getMemberCharacter(c.id, p.id, 'approved').subscribe({
              next: (res) => resolve(pdf.buildPlayerGmSummary(res.data as Character)),
              error: () => resolve(null),
            });
          }),
      ),
    );
    return summaries.filter((s): s is PlayerGmSummary => s !== null);
  }

  private async runPrintPlayerSummariesOnly(): Promise<void> {
    this.printing.set(true);
    try {
      const summaries = await this.loadPlayerSummaries();
      if (!summaries.length) {
        this.hub.error.set('Aucun joueur avec personnage approuvé.');
        return;
      }
      const pdf = await getCampaignPdfService(this.injector);
      await pdf.downloadPlayerSummaries(this.hub.campaign()?.title ?? 'Campagne', summaries);
    } catch {
      this.hub.error.set('Échec de la génération PDF.');
    } finally {
      this.printing.set(false);
    }
  }

  private async runPrintPlayerFullSheets(): Promise<void> {
    const c = this.hub.campaign();
    if (!c) return;
    const approved = this.approvedPlayers();
    if (!approved.length) {
      this.hub.error.set('Aucun joueur avec personnage approuvé.');
      return;
    }
    this.printing.set(true);
    try {
      const pdf = await getCampaignPdfService(this.injector);
      for (const p of approved) {
        await new Promise<void>((resolve, reject) => {
          this.campaigns.getMemberCharacter(c.id, p.id, 'approved').subscribe({
            next: async (res) => {
              try {
                const character = { ...(res.data as object), name: res.name } as Character;
                await pdf.downloadPlayerFullSheet(character);
                resolve();
              } catch {
                reject();
              }
            },
            error: () => reject(),
          });
        });
      }
    } catch {
      this.hub.error.set('Échec lors de la génération des fiches joueurs.');
    } finally {
      this.printing.set(false);
    }
  }

  private revokePreviewUrl(): void {
    if (this.rawBlobUrl) {
      URL.revokeObjectURL(this.rawBlobUrl);
      this.rawBlobUrl = null;
    }
    this.pdfPreviewUrl.set(null);
    this.pdfPreviewRawUrl.set(null);
    this.previewCacheKey = null;
  }

  private async setPreviewBlobUrl(url: string, filename: string): Promise<void> {
    let named: string;
    try {
      named = await namedPdfObjectUrl(url, filename);
      if (named !== url) URL.revokeObjectURL(url);
    } catch {
      named = url;
    }
    this.rawBlobUrl = named;
    this.pdfPreviewRawUrl.set(named);
    this.pdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(named));
  }
}
