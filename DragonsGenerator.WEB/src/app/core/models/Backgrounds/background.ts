// core/models/Backgrounds/background.ts
//
// Suit le pattern { id, name, data } de CharacterClass.
// ASP.NET sérialise en camelCase → on utilise camelCase ici.

export interface Background {
  id: string;
  name: string;
  data: BackgroundData;
}

export interface BackgroundData {
  preset: boolean;
  source: BackgroundSource;
  flavor: BackgroundFlavor;
  proficiencies: BackgroundProficiencies;
  equipment: BackgroundEquipment;
  privilege: BackgroundPrivilege;
  personalityTables: PersonalityTables | null;
  handicapsCompatible?: string[];
}

// ---------------------------------------------------------------------------
// Source & Flavor
// ---------------------------------------------------------------------------

export interface BackgroundSource {
  book: string;
  pages: string;
}

export interface BackgroundFlavor {
  summary: string;
  adventureHook: string | null;
}

// ---------------------------------------------------------------------------
// Maîtrises
// ---------------------------------------------------------------------------

export interface BackgroundProficiencies {
  skills: BackgroundSkillChoice;
  tools: BackgroundToolChoice;
  languages: BackgroundLanguageChoice;
}

export interface BackgroundSkillChoice {
  chooseCount: number;
  /** Liste d'IDs ou "any" pour l'historique personnalisé. */
  options: string[] | 'any';
}

export interface BackgroundToolChoice {
  fixed: BackgroundToolRef[];
  choose: BackgroundToolChooseGroup[];
}

export interface BackgroundToolRef {
  type: 'tool' | 'instrument' | 'gameSet' | 'vehicle';
  id?: string;
  any?: boolean;
}

export interface BackgroundToolChooseGroup {
  chooseCount: number;
  options?: BackgroundToolRef[];
  /** Uniquement pour bg-custom : catégories libres. */
  categoryOptions?: string[];
  note?: string;
}

export interface BackgroundLanguageChoice {
  choiceCount: number;
  note?: string;
}

// ---------------------------------------------------------------------------
// Équipement
// ---------------------------------------------------------------------------

export interface BackgroundEquipment {
  fixed: BackgroundEquipmentItem[];
  currency: { or: number };
  /** Si true, l'outil choisi dans les maîtrises est ajouté à l'équipement. */
  fromToolProficiency?: boolean;
  /** Si true, l'équipement est libre (historique personnalisé). */
  custom?: boolean;
  budgetRules?: BackgroundBudgetRules;
}

export interface BackgroundBudgetRules {
  desc: string;
  currencyRange: { min: number; max: number };
}

export interface BackgroundEquipmentItem {
  id: string;
  name: string;
  qty: number;
  location: 'equipped' | 'backpack' | 'storage';
}

// ---------------------------------------------------------------------------
// Privilège
// ---------------------------------------------------------------------------

export interface BackgroundPrivilege {
  id: string | null;
  name: string | null;
  desc: string | null;
  custom?: boolean;
  guidelines?: string;
}

// ---------------------------------------------------------------------------
// Tables de personnalité
// ---------------------------------------------------------------------------

export interface PersonalityTables {
  traits: PersonalityTable;
  ideals: PersonalityTableWithAlignment;
  bonds: PersonalityTable;
  flaws: PersonalityTable;
}

export interface PersonalityTable {
  die: string;
  entries: PersonalityEntry[];
}

export interface PersonalityTableWithAlignment {
  die: string;
  entries: PersonalityEntryWithAlignment[];
}

export interface PersonalityEntry {
  roll: number;
  text: string;
}

export interface PersonalityEntryWithAlignment extends PersonalityEntry {
  alignment: string;
}
