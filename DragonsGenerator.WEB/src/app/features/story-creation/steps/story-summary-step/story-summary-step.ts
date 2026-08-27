import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { StoryBuilderService } from '@core/services/story-builder.service';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { CampaignPdfService, CreaturePrintEntry } from '@core/services/campaign-pdf.service';
import { DataService } from '@core/services/data.service';
import { AuthService } from '@core/services/auth.service';
import { emptyCampaignData } from '@core/models/Campaign/campaign';
import { forkJoin, catchError, map, of, Observable } from 'rxjs';
import {
  ADVENTURE_TONE_LABELS,
  CREATURE_ROLE_LABELS,
} from '@core/models/Story/story';

@Component({
  selector: 'app-story-summary-step',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './story-summary-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class StorySummaryStep implements OnInit {
  readonly builder = inject(StoryBuilderService);
  private router = inject(Router);
  private campaigns = inject(CampaignCloudService);
  private pdf = inject(CampaignPdfService);
  private data = inject(DataService);
  private auth = inject(AuthService);

  readonly saved = signal(false);
  readonly saving = signal(false);
  readonly printing = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly copyFeedback = signal(false);
  readonly savedCampaignId = signal<string | null>(null);

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  saveStory(): void {
    this.saveError.set(null);

    if (!this.auth.isLoggedIn()) {
      this.saveError.set('Connectez-vous pour sauvegarder la campagne dans le cloud.');
      return;
    }

    const b = this.builder;
    const data = {
      ...emptyCampaignData(b.partyLevel()),
      setting: b.setting().trim(),
      partyLevel: b.partyLevel(),
      tone: b.tone(),
      adventure: b.adventure().trim(),
      creatures: b.creatures(),
      encounters: [],
      notes: '',
    };

    this.saving.set(true);
    this.campaigns.create(b.title().trim() || 'Nouvelle campagne', data).subscribe({
      next: (summary) => {
        this.saved.set(true);
        this.savedCampaignId.set(summary.id);
        this.saving.set(false);
        this.builder.reset();
      },
      error: () => {
        this.saveError.set('Échec de la sauvegarde cloud.');
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
          const data = {
            ...emptyCampaignData(b.partyLevel()),
            setting: b.setting().trim(),
            partyLevel: b.partyLevel(),
            tone: b.tone(),
            adventure: b.adventure().trim(),
            creatures: b.creatures(),
            encounters: [],
            notes: '',
          };
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

  private buildExportText(): string {
    const b = this.builder;
    const lines = [
      `# ${b.title().trim() || 'Aventure'}`,
      '',
      `**Niveau des héros:** ${b.partyLevel()}`,
      `**Ton:** ${ADVENTURE_TONE_LABELS[b.tone()]}`,
      b.setting().trim() ? `**Lieu:** ${b.setting().trim()}` : '',
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
