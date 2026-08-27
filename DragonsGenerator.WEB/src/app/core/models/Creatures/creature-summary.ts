export interface CreatureSummary {
  id: string;
  name: string;
  category: string;
  part: string | null;
  section: string | null;
  challengeRating: string;
  xp: number;
  armorClass: number;
}
