export type {
  ToolCatalogEntry,
  ToolCatalogGroup,
} from '@core/utils/skills-tool-catalog.util';

export interface BgToolChoiceOption {
  key: string;
  label: string;
  category: string | null;
  selected: boolean;
}

export interface BgToolChoiceGroup {
  groupIndex: number;
  chooseCount: number;
  note?: string;
  options: BgToolChoiceOption[];
}

/** Groupe `tools.choose` tel que renvoyé par l’API (camelCase ou snake_case). */
export interface BgToolChooseGroupRaw {
  chooseCount?: number;
  choose_count?: number;
  count?: number;
  note?: string;
  options?: unknown[];
  category_options?: unknown[];
  categoryOptions?: unknown[];
}
