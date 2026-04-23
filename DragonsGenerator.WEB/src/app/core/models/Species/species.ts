// src/app/core/models/Species/species.ts

// ASP.NET sérialise par défaut en camelCase, donc on utilise camelCase ici.

export interface Source {
  book: string;
  pages: string;
}

export interface Flavor {
  summary: string;
  culture?: string;
  origins?: string;
  loreNotes?: string[];
}

export interface Height {
  desc: string;
  rangeM?: string;
}

export interface Weight {
  desc: string;
  rangeKg?: string;
}

export interface Age {
  maturityYears: number;
  lifespanYears: number;
  desc: string;
  adulthoodCulturalYears?: number;
  lifespanMaxYears?: number;
}

export interface Alignment {
  tendency: string;
  desc: string;
}

export interface FlexibleAsi {
  count: number;
  value: number;
  excluded: string[];
}

export interface BaseStats {
  abilityScoreIncrease: Record<string, number>;
  speedM: number;
  size: string;
  darkvisionM: number;
  height: Height;
  weight: Weight;
  age: Age;
  alignment: Alignment;
  flexibleAsi?: FlexibleAsi;
  speedNotes?: string;
  speedNotReducedByHeavyArmor?: boolean;
}

// `mechanics` est un JsonElement côté C# avec des formes très variables
// selon le trait/règle. On le type en `unknown` (à narrower au cas par cas
// dans les composants si besoin) plutôt qu'en `any`.
export interface Trait {
  id: string;
  name: string;
  desc: string;
  mechanics?: unknown;
}

export interface CreationChoice {
  id: string;
  name: string;
  desc: string;
  type: string;
  choiceCount?: number;
  options?: unknown; // tableau hétérogène d'options
  optionGroups?: unknown; // groupes d'options (cf. melessë)
  spellList?: string;
  spellLevel?: number;
  spellcastingAbility?: string;
  valuePerChoice?: number;
  excluded?: string[];
}

export interface Languages {
  fixed: string[];
  choiceCount: number;
  notes?: string;
  grantsFromChoice?: unknown;
}

export interface Subspecies {
  id: string;
  name: string;
  playable: boolean;
  flavor: string;
  abilityScoreIncrease: Record<string, number>;
  traits: Trait[];
  creationChoices: CreationChoice[];
  playableNotes?: string;
  languages?: Languages;
}

export interface OptionalRule {
  id: string;
  name: string;
  desc: string;
  mechanics?: unknown;
}

export interface CivilizationLink {
  id: string;
  name: string;
  desc: string;
}

export interface Species {
  id: string;
  name: string;
  nameAlt: string[];
  source: Source;
  flavor: Flavor;
  baseStats: BaseStats;
  traits: Trait[];
  creationChoices: CreationChoice[];
  languages: Languages;
  subspecies: Subspecies[];
  optionalRules: OptionalRule[];
  civilizationLinks?: CivilizationLink[];
}
