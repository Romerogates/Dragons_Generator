export const BREATH_SHAPE_FR: Record<string, string> = {
  cone: 'Cône',
  line: 'Ligne',
  ligne: 'Ligne',
  sphere: 'Sphère',
  sphère: 'Sphère',
};

export interface SpeciesStepCardOption {
  id: string;
  title: string;
  subtitle?: string;
  desc: string;
  stats?: string;
  badge?: string;
  icon: string;
}

export type SpeciesStepPhase = 'species' | 'subspecies' | 'choice';

export interface SpeciesChoiceOptionView {
  id: string;
  name: string;
  desc?: string;
  note?: string;
  damageType?: string;
  areaShape?: string;
  areaLengthM?: number;
  group?: string;
}

export function breathShapeLabel(shape: string | undefined): string {
  if (!shape) return '';
  return BREATH_SHAPE_FR[shape.toLowerCase()] ?? shape;
}
