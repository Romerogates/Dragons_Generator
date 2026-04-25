export interface Language {
  id: string;
  name: string;
  category: string; // ex: 'base', 'exotique', 'secret'
  linguistics: LanguageLinguistics;
  speakers: LanguageSpeakers;
  lore: LanguageLore;
}

export interface LanguageLinguistics {
  writingSystems: WritingSystem[];
  isOralOnly: boolean;
  writingNotes?: string | null;
}

export interface WritingSystem {
  id: string;
  label: string;
  type: string;
}

export interface LanguageSpeakers {
  primary: SpeakerRef[];
  regions: string[];
  isExtinct?: boolean | null;
}

export interface SpeakerRef {
  id: string;
  label: string;
}

export interface LanguageLore {
  fullDescription: string;
  sonority?: string | null;
}
