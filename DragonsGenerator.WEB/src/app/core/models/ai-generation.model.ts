export type AiGenerationKind =
  | 'creature-backstory'
  | 'creature-batch'
  | 'adventure'
  | 'character-backstory'
  | 'pregen-story'
  | 'pregen-hero';

export interface AiRouteInfo {
  primary: string;
  fallback: string | null;
  primaryLabel: string;
  fallbackLabel: string | null;
}

export interface AiStatusResponse {
  localLlmEnabled: boolean;
  groqConfigured: boolean;
  shortGeneration: AiRouteInfo;
  adventureGeneration: AiRouteInfo;
}

export interface AiProgressOptions<T = unknown> {
  batchIndex?: number;
  batchTotal?: number;
  /** Appliqué dès la réponse (y compris si la barre est en arrière-plan). */
  onSuccess?: (value: T) => void;
  onError?: (err: unknown) => void;
  /** Toast affiché quand la gén finit en arrière-plan. */
  readyMessage?: string;
}

export interface AiProgressStage {
  at: number;
  label: string;
}

export interface AiProgressProfile {
  providerLabel: string;
  estimatedMs: number;
  stages: AiProgressStage[];
}

export const AI_GENERATION_BUSY = 'AI_GENERATION_BUSY';
export const AI_GENERATION_ABORTED = 'AI_GENERATION_ABORTED';

export function isAiGenerationAborted(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === AI_GENERATION_ABORTED;
}

export function readyMessageForKind(kind: AiGenerationKind): string {
  switch (kind) {
    case 'adventure':
      return 'Aventure prête';
    case 'creature-backstory':
    case 'creature-batch':
      return 'Vies générées';
    case 'character-backstory':
      return 'Historique prêt';
    case 'pregen-story':
    case 'pregen-hero':
      return 'Pré-tiré prêt';
  }
}
