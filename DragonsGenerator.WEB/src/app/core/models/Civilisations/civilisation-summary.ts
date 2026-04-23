export interface CivilisationSummary {
  id: string;
  name: string;
  diceMin: number;
  diceMax: number;
  isCosmopolitan: boolean;
  primarySpecies: string[]; // C'est un tableau de chaînes de caractères (string), car tu as fait un .Select(s => s.Label) en C#
}
