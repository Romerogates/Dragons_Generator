export interface Skill {
  id: string;
  name: string;
  ability: string;
  description: string;
  examples: string[];
  passiveCheck: boolean;
  source?: string | null;
}

export interface SkillSummary {
  id: string;
  name: string;
  ability: string;
}
