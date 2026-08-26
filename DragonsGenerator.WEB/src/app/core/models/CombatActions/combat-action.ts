export interface CombatAction {
  id: string;
  name: string;
  actionCost: string;
  category: string;
  description?: string | null;
  mechanics?: unknown;
  source?: string | null;
}

export interface CombatActionSummary {
  id: string;
  name: string;
  actionCost: string;
  category: string;
}
