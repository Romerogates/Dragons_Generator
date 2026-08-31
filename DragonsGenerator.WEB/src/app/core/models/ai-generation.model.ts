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

export interface AiProgressOptions {
  batchIndex?: number;
  batchTotal?: number;
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
