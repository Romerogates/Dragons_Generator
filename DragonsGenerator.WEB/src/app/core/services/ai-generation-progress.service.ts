import { Injectable, computed, inject, signal } from '@angular/core';
import {
  EMPTY,
  EmptyError,
  Observable,
  Subject,
  Subscription,
  finalize,
  firstValueFrom,
  from,
  share,
  tap,
  throwError,
} from 'rxjs';
import { catchError, switchMap, takeUntil } from 'rxjs/operators';
import type {
  AiGenerationKind,
  AiProgressOptions,
  AiProgressProfile,
  AiProgressStage,
  AiStatusResponse,
} from '@core/models/ai-generation.model';
import {
  AI_GENERATION_ABORTED,
  AI_GENERATION_BUSY,
  readyMessageForKind,
} from '@core/models/ai-generation.model';
import { AiStatusService } from './ai-status.service';

interface ActiveRun {
  profile: AiProgressProfile;
  startedAt: number;
  batchIndex: number;
  batchTotal: number;
  kind: AiGenerationKind;
  readyMessage: string;
}

@Injectable({ providedIn: 'root' })
export class AiGenerationProgressService {
  private readonly aiStatus = inject(AiStatusService);

  readonly active = signal(false);
  /** True when the user hid the full bar but the request keeps running. */
  readonly background = signal(false);
  readonly progress = signal(0);
  readonly stageLabel = signal('');
  readonly providerLabel = signal('');
  readonly detail = signal<string | null>(null);
  readonly kind = signal<AiGenerationKind | null>(null);
  /** Ephemeral toast after a background run completes. */
  readonly toastMessage = signal<string | null>(null);

  /** Full progress UI (not background pill). */
  readonly foregroundActive = computed(() => this.active() && !this.background());

  private timer: ReturnType<typeof setInterval> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private activeRun: ActiveRun | null = null;
  private runSub: Subscription | null = null;
  private readonly cancel$ = new Subject<void>();
  private aborted = false;

  /**
   * Starts a tracked generation. Keeps an internal subscription so
   * « Continuer en arrière-plan » can hide the UI without aborting HTTP.
   * Callers should prefer `onSuccess` / `onError` in options; a returned
   * Observable may still be subscribed for local UI.
   */
  run<T>(kind: AiGenerationKind, work: () => Observable<T>, options?: AiProgressOptions<T>): Observable<T> {
    if (this.active()) {
      return throwError(() => ({ code: AI_GENERATION_BUSY, message: this.busyMessage() }));
    }

    // Claim immediately so a second run() cannot start during async begin().
    this.aborted = false;
    this.active.set(true);
    this.background.set(false);
    this.kind.set(kind);

    let succeeded = false;

    const shared = from(this.begin(kind, options as AiProgressOptions | undefined)).pipe(
      switchMap(() => {
        if (this.aborted) return EMPTY;
        return work();
      }),
      takeUntil(this.cancel$),
      tap((value) => {
        succeeded = true;
        options?.onSuccess?.(value);
      }),
      catchError((err) => {
        options?.onError?.(err);
        this.clearRunSubscription();
        this.reset();
        return throwError(() => err);
      }),
      finalize(() => {
        this.clearRunSubscription();
        if (succeeded) this.complete();
        else if (this.active()) this.reset();
      }),
      share(),
    );

    this.runSub = shared.subscribe({
      error: () => {
        /* surfaced via returned Observable / onError */
      },
    });

    return shared;
  }

  async begin(kind: AiGenerationKind, options?: AiProgressOptions): Promise<void> {
    this.clearTimers();
    if (!this.active()) {
      this.aborted = false;
    }
    const status = await firstValueFrom(this.aiStatus.getStatus());
    if (this.aborted) return;

    const profile = buildProfile(kind, status);
    this.activeRun = {
      profile,
      startedAt: Date.now(),
      batchIndex: options?.batchIndex ?? 0,
      batchTotal: options?.batchTotal ?? 1,
      kind,
      readyMessage: options?.readyMessage ?? readyMessageForKind(kind),
    };
    this.kind.set(kind);
    this.background.set(false);
    this.active.set(true);
    this.progress.set(0);
    this.providerLabel.set(profile.providerLabel);
    this.detail.set(buildDetail(options));
    this.applyStage(profile.stages, 0);
    this.timer = setInterval(() => this.tick(), 150);
  }

  /** Abort in-flight HTTP (when tracked via `run`) and reset UI. */
  stop(): void {
    this.aborted = true;
    this.clearRunSubscription();
    this.reset();
    this.cancel$.next();
  }

  /** Hide the full bar; keep the request alive. */
  sendToBackground(): void {
    if (!this.active()) return;
    this.background.set(true);
  }

  /** Show the full bar again while the request is still running. */
  restoreForeground(): void {
    if (!this.active()) return;
    this.background.set(false);
  }

  /** For sequential / begin()-based loops. */
  isAborted(): boolean {
    return this.aborted;
  }

  busyMessage(): string {
    return 'Une génération est déjà en cours — elle s’affichera ici quand elle sera prête. Vous pouvez l’arrêter via la pastille.';
  }

  /** Throws `{ code: AI_GENERATION_ABORTED }` when the user stopped mid-flight. */
  throwIfAborted(): void {
    if (this.aborted) {
      throw { code: AI_GENERATION_ABORTED, message: 'Génération annulée.' };
    }
  }

  /**
   * Awaits an HTTP (or other) observable, aborting when `stop()` is called
   * (used by pré-tiré / begin()-based flows).
   */
  async awaitWhileActive<T>(source: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(source.pipe(takeUntil(this.cancel$)));
    } catch (err) {
      if (this.aborted || err instanceof EmptyError) {
        throw { code: AI_GENERATION_ABORTED, message: 'Génération annulée.' };
      }
      throw err;
    }
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
    const wasBackground = this.background();
    const msg = this.activeRun?.readyMessage;
    this.hideTimer = setTimeout(() => {
      this.reset();
      if (wasBackground && msg) this.showToast(msg);
    }, wasBackground ? 0 : 700);
  }

  /** @deprecated Prefer `stop()` — kept for existing begin()/cancel callers. */
  cancel(): void {
    this.stop();
  }

  dismissToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.toastMessage.set(null);
  }

  private showToast(message: string): void {
    this.dismissToast();
    this.toastMessage.set(message);
    this.toastTimer = setTimeout(() => this.dismissToast(), 4500);
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
    this.background.set(false);
    this.kind.set(null);
    this.progress.set(0);
    this.stageLabel.set('');
    this.providerLabel.set('');
    this.detail.set(null);
  }

  private clearRunSubscription(): void {
    if (this.runSub) {
      this.runSub.unsubscribe();
      this.runSub = null;
    }
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
        // Aligné sur budget API ~85 s (évite barre « coincée » puis 504).
        estimatedMs: 75000,
        stages: [
          { at: 0, label: 'Préparation du contexte narratif…' },
          { at: 0.08, label: 'Appel Groq (cloud) — rédaction…' },
          { at: 0.35, label: 'Tissage de l\'intrigue et des lieux…' },
          { at: 0.6, label: 'Mise en forme de l\'aventure…' },
          { at: 0.82, label: 'Dernière passe — encore un instant…' },
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
