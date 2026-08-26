export interface Deity {
  id: string;
  name: string;
  tonality?: string | null;
  domains: string[];
  description?: string | null;
  otherNames: string[];
  worshippersNote?: string | null;
  grantsPowersTo: string[];
  source?: string | null;
}

export interface DeitySummary {
  id: string;
  name: string;
  tonality?: string | null;
  domains: string[];
}
