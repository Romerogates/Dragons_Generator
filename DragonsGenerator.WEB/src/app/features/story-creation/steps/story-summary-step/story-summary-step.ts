import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { StoryBuilderService } from '@core/services/story-builder.service';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { CampaignPdfService, CreaturePrintEntry } from '@core/services/campaign-pdf.service';
import { DataService } from '@core/services/data.service';
import { AuthService } from '@core/services/auth.service';
import { forkJoin, catchError, map, of, Observable } from 'rxjs';
import {
  ADVENTURE_TONE_LABELS,
  CREATURE_ROLE_LABELS,
} from '@core/models/Story/story';
import {
  storyLocationContext,
  storyRegionLabel,
} from '@core/utils/story-location.util';

@Component({
  selector: 'app-story-summary-step',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './story-summary-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class StorySummaryStep implements OnInit, OnDestroy {
  readonly builder = inject(StoryBuilderService);
  private router = inject(Router);
  private campaigns = inject(CampaignCloudService);
  private pdf = inject(CampaignPdfService);
  private data = inject(DataService);
  private auth = inject(AuthService);
  private sanitizer = inject(DomSanitizer);

  readonly saved = signal(false);
  readonly saving = signal(false);
  readonly printing = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly copyFeedback = signal(false);
  readonly savedCampaignId = signal<string | null>(null);

  readonly isLoadingPreview = signal(false);
  readonly pdfPreviewUrl = signal<SafeResourceUrl | null>(null);
  private rawBlobUrl: string | null = null;

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (this.builder.creatures().length) {
      this.loadBestiaryPreview();
    }
  }

  ngOnDestroy(): void {
    this.revokePreviewUrl();
  }

  private revokePreviewUrl(): void {
    if (this.rawBlobUrl) {
      URL.revokeObjectURL(this.rawBlobUrl);
      this.rawBlobUrl = null;
    }
  }

  private loadBestiaryPreview(): void {
    this.isLoadingPreview.set(true);
    this.loadEntries().subscribe({
      next: async (entries) => {
        try {
          if (!entries.length) return;
          this.revokePreviewUrl();
          const url = await this.pdf.generateCreaturesPdfBlob(
            entries,
            this.builder.title().trim() || 'Scénario',
          );
          this.rawBlobUrl = url;
          this.pdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
        } catch (err) {
          console.error('Erreur génération aperçu bestiaire :', err);
        } finally {
          this.isLoadingPreview.set(false);
        }
      },
      error: () => this.isLoadingPreview.set(false),
    });
  }

  openFullscreen(): void {
    if (this.rawBlobUrl) window.open(this.rawBlobUrl, '_blank');
  }

  saveStory(): void {
    this.saveError.set(null);

    if (!this.auth.isLoggedIn()) {
      this.saveError.set('Connectez-vous pour sauvegarder la campagne dans le cloud.');
      return;
    }

    const b = this.builder;
    const data = b.buildCampaignData();
    const title = b.title().trim() || 'Nouvelle campagne';
    const editId = b.editingCampaignId();

    this.saving.set(true);
    const save$ = editId
      ? this.campaigns.update(editId, title, data)
      : this.campaigns.create(title, data);

    save$.subscribe({
      next: (summary) => {
        this.saved.set(true);
        this.savedCampaignId.set(summary.id);
        this.saving.set(false);
        this.builder.reset();
        if (editId) {
          this.router.navigate(['/campaigns', summary.id]);
        }
      },
      error: () => {
        this.saveError.set(
          editId ? 'Échec de la mise à jour cloud.' : 'Échec de la sauvegarde cloud.',
        );
        this.saving.set(false);
      },
    });
  }

  copyToClipboard(): void {
    const text = this.buildExportText();
    navigator.clipboard.writeText(text).then(() => {
      this.copyFeedback.set(true);
      setTimeout(() => this.copyFeedback.set(false), 2000);
    });
  }

  downloadMarkdown(): void {
    const text = this.buildExportText();
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.builder.title().trim() || 'aventure'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  startNew(): void {
    this.builder.reset();
  }

  goToLibrary(): void {
    const id = this.savedCampaignId();
    if (id) {
      this.router.navigate(['/campaigns', id]);
    } else {
      this.router.navigate(['/campaigns']);
    }
  }

  printBestiary(): void {
    this.printing.set(true);
    this.loadEntries().subscribe({
      next: async (entries) => {
        try {
          await this.pdf.downloadCreaturesCompilation(
            entries,
            this.builder.title().trim() || 'Scénario',
          );
        } finally {
          this.printing.set(false);
        }
      },
      error: () => this.printing.set(false),
    });
  }

  printPackMj(): void {
    this.printing.set(true);
    this.loadEntries().subscribe({
      next: async (entries) => {
        try {
          const b = this.builder;
          const data = b.buildCampaignData();
          await this.pdf.downloadCampaignPack(
            b.title().trim() || 'Scénario',
            data,
            entries,
            [],
          );
        } finally {
          this.printing.set(false);
        }
      },
      error: () => this.printing.set(false),
    });
  }

  private loadEntries(): Observable<CreaturePrintEntry[]> {
    const selections = this.builder.creatures();
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

  protected toneLabels = ADVENTURE_TONE_LABELS;
  protected roleLabels = CREATURE_ROLE_LABELS;
  protected regionLabel = storyRegionLabel;
  protected locationContext = storyLocationContext;

  private buildExportText(): string {
    const b = this.builder;
    const lines = [
      `# ${b.title().trim() || 'Aventure'}`,
      '',
      `**Niveau des héros:** ${b.partyLevel()}`,
      `**Ton:** ${ADVENTURE_TONE_LABELS[b.tone()]}`,
      storyRegionLabel(b.region()) ? `**Région:** ${storyRegionLabel(b.region())}` : '',
      b.setting().trim() ? `**Ambiance:** ${b.setting().trim()}` : '',
      '',
      '## Personnages',
      '',
    ];

    for (const c of b.creatures()) {
      lines.push(`### ${c.customName} (${c.creatureName})`);
      lines.push(`*Rôle: ${CREATURE_ROLE_LABELS[c.role]}*`);
      if (c.backstory.trim()) {
        lines.push('');
        lines.push(c.backstory.trim());
      }
      lines.push('');
    }

    lines.push('## Aventure');
    lines.push('');
    lines.push(b.adventure().trim());

    return lines.filter((l) => l !== undefined).join('\n');
  }
}
