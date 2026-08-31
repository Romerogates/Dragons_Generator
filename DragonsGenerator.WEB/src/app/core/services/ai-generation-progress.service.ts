import { Injectable, inject, signal } from '@angular/core';
import { Observable, finalize, firstValueFrom, from, tap, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import type {
  AiGenerationKind,
  AiProgressOptions,
  AiProgressProfile,
  AiProgressStage,
  AiStatusResponse,
} from '@core/models/ai-generation.model';
import { AiStatusService } from './ai-status.service';

interface ActiveRun {
  profile: AiProgressProfile;
  startedAt: number;
  batchIndex: number;
  batchTotal: number;
}

@Injectable({ providedIn: 'root' })
export class AiGenerationProgressService {
  private readonly aiStatus = inject(AiStatusService);

  readonly active = signal(false);
  readonly progress = signal(0);
  readonly stageLabel = signal('');
  readonly providerLabel = signal('');
  readonly detail = signal<string | null>(null);

  private timer: ReturnType<typeof setInterval> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private activeRun: ActiveRun | null = null;

  run<T>(kind: AiGenerationKind, work: () => Observable<T>, options?: AiProgressOptions): Observable<T> {
    let succeeded = false;
    return from(this.begin(kind, options)).pipe(
      switchMap(() => work()),
      tap(() => {
        succeeded = true;
      }),
      catchError((err) => {
        this.cancel();
        return throwError(() => err);
      }),
      finalize(() => {
        if (succeeded) this.complete();
      }),
    );
  }

  async begin(kind: AiGenerationKind, options?: AiProgressOptions): Promise<void> {
    this.clearTimers();
    const status = await firstValueFrom(this.aiStatus.getStatus());
    const profile = buildProfile(kind, status);
    this.activeRun = {
      profile,
      startedAt: Date.now(),
      batchIndex: options?.batchIndex ?? 0,
      batchTotal: options?.batchTotal ?? 1,
    };
    this.active.set(true);
    this.progress.set(0);
    this.providerLabel.set(profile.providerLabel);
    this.detail.set(buildDetail(options));
    this.applyStage(profile.stages, 0);
    this.timer = setInterval(() => this.tick(), 150);
  }

  setBatchProgress(index: number, total: number): void {
    if (!this.activeRun) return;
    this.activeRun.batchIndex = index;
    this.activeRun.batchTotal = total;
    this.detail.set(`Créature ${index + 1} / ${total}`);
    this.activeRun.startedAt = Date.now();
    this.progress.set(Math.min(this.progress(), Math.round((index / total) * 100)));
  }

  setStageLabel(label: string): void {
    if (this.active()) this.stageLabel.set(label);
  }

  complete(): void {
    this.clearTimers();
    this.progress.set(100);
    this.stageLabel.set('Terminé !');
    this.hideTimer = setTimeout(() => this.reset(), 700);
  }

  cancel(): void {
    this.reset();
  }

  private tick(): void {
    const run = this.activeRun;
    if (!run) return;

    const elapsed = Date.now() - run.startedAt;
    const batchWeight = run.batchTotal > 1 ? 1 / run.batchTotal : 1;
    const batchBase = run.batchIndex / run.batchTotal;
    const localRatio = Math.min(1, elapsed / run.profile.estimatedMs);
    const overall = batchBase + localRatio * batchWeight;
    const capped = Math.min(0.92, overall);
    this.progress.set(Math.round(capped * 100));
    this.applyStage(run.profile.stages, localRatio);
  }

  private applyStage(stages: AiProgressStage[], ratio: number): void {
    let label = stages[0]?.label ?? 'Génération en cours…';
    for (const stage of stages) {
      if (ratio >= stage.at) label = stage.label;
    }
    this.stageLabel.set(label);
  }

  private reset(): void {
    this.clearTimers();
    this.activeRun = null;
    this.active.set(false);
    this.progress.set(0);
    this.stageLabel.set('');
    this.providerLabel.set('');
    this.detail.set(null);
  }

  private clearTimers(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}

function buildDetail(options?: AiProgressOptions): string | null {
  if (!options?.batchTotal || options.batchTotal <= 1) return null;
  const index = (options.batchIndex ?? 0) + 1;
  return `Créature ${index} / ${options.batchTotal}`;
}

function buildProfile(kind: AiGenerationKind, status: AiStatusResponse): AiProgressProfile {
  switch (kind) {
    case 'adventure':
      return {
        providerLabel: status.adventureGeneration.primaryLabel,
        estimatedMs: status.adventureGeneration.fallback ? 45000 : 32000,
        stages: [
          { at: 0, label: 'Préparation du contexte narratif…' },
          { at: 0.12, label: 'Appel Groq (cloud) — rédaction…' },
          { at: 0.45, label: 'Tissage de l\'intrigue et des lieux…' },
          { at: 0.72, label: 'Mise en forme de l\'aventure…' },
          ...(status.adventureGeneration.fallback
            ? [{ at: 0.88, label: 'Secours Ollama (local) si besoin…' }]
            : []),
        ],
      };
    case 'creature-batch':
      return shortProfile(status, 'Génération des vies (lot)…', 14000);
    case 'creature-backstory':
      return shortProfile(status, 'Génération de la vie…', 10000);
    case 'character-backstory':
      return shortProfile(status, 'Génération de l\'histoire…', 10000);
    case 'pregen-story':
      return shortProfile(status, 'Création du récit du héros…', 12000);
    case 'pregen-hero':
      return pregenHeroProfile(status);
  }
}

function pregenHeroProfile(status: AiStatusResponse): AiProgressProfile {
  const usesOllama = status.shortGeneration.primary === 'ollama';
  return {
    providerLabel: status.shortGeneration.primaryLabel,
    estimatedMs: usesOllama ? 38000 : 24000,
    stages: [
      { at: 0, label: 'Chargement du codex…' },
      { at: 0.1, label: 'Tirage aléatoire — espèce, classe, équipement…' },
      { at: 0.35, label: 'Validation et enregistrement de la fiche…' },
      {
        at: 0.52,
        label: usesOllama ? 'Ollama (local) — récit du héros…' : 'Groq (cloud) — récit du héros…',
      },
      { at: 0.78, label: 'Finalisation du pré-tiré…' },
      ...(status.shortGeneration.fallback
        ? [{ at: 0.9, label: 'Secours Groq (cloud) si besoin…' }]
        : []),
    ],
  };
}

function shortProfile(
  status: AiStatusResponse,
  intro: string,
  ollamaMs: number,
): AiProgressProfile {
  const usesOllama = status.shortGeneration.primary === 'ollama';
  return {
    providerLabel: status.shortGeneration.primaryLabel,
    estimatedMs: usesOllama ? ollamaMs : Math.round(ollamaMs * 0.45),
    stages: usesOllama
      ? [
          { at: 0, label: intro },
          { at: 0.15, label: 'Ollama (local) — rédaction…' },
          { at: 0.65, label: 'Peaufinage du texte…' },
          ...(status.shortGeneration.fallback
            ? [{ at: 0.85, label: 'Secours Groq (cloud) si besoin…' }]
            : []),
        ]
      : [
          { at: 0, label: intro },
          { at: 0.2, label: 'Groq (cloud) — rédaction…' },
          { at: 0.7, label: 'Peaufinage du texte…' },
        ],
  };
}
