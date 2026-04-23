export interface SpeciesRef {
  id: string;
  label: string;
}

export interface RoleRef {
  id: string;
  label: string;
}

export interface LanguageRef {
  id: string;
  label: string;
}

export interface WritingSystemRef {
  id: string;
  label: string;
}

export interface Randomization {
  diceMin: number;
  diceMax: number;
}

export interface Demographics {
  primarySpecies: SpeciesRef[];
  secondarySpecies: SpeciesRef[];
  isCosmopolitan: boolean;
  cosmopolitanZones: string[];
  socialRoles: RoleRef[];
  hostilePopulations?: SpeciesRef[];
  hordeAllies?: SpeciesRef[];
  historicalRulers?: SpeciesRef[];
  underwaterPopulations?: SpeciesRef[];
}

export interface Linguistics {
  officialLanguages: LanguageRef[];
  additionalLanguagesSpoken: boolean;
  writingSystems: WritingSystemRef[];
  additionalWritingSystemsUsed?: boolean;
}

export interface Lore {
  fullDescription: string;
  threatIds: string[];
  geographyTags: string[];
  notableFeatures?: string[];
}

export interface Civilisation {
  id: string;
  name: string;
  randomization: Randomization;
  demographics: Demographics;
  linguistics: Linguistics;
  lore: Lore;
}
