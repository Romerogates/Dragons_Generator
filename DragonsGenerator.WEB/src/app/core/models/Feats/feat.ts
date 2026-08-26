export interface Feat {
  id: string;
  name: string;
  requiresMagic: boolean;
  category?: string | null;
  description?: string | null;
  repeatable: boolean;
  tags: string[];
  data: Record<string, unknown>;
}

export interface FeatSummary {
  id: string;
  name: string;
  category?: string | null;
  requiresMagic: boolean;
  repeatable: boolean;
}
