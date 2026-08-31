export type GuideAudience = 'all' | 'dm' | 'player';

export interface GuideNavItem {
  id: string;
  label: string;
  icon: string;
  accent: string;
  audience: GuideAudience;
  isNew?: boolean;
}

export interface GuideBlogPost {
  id: string;
  date: string;
  tag: string;
  title: string;
  summary: string;
  icon: string;
  border: string;
  tagColor: string;
  isNew?: boolean;
}

export interface GuideQuickCard {
  title: string;
  description: string;
  icon: string;
  link: string;
  accent: string;
  prefetch?: 'campaigns' | 'create' | 'support' | 'species';
}

export interface GuideStep {
  title: string;
  body: string;
  badge?: 'MJ' | 'Joueur' | 'Tous';
  link?: string;
  linkLabel?: string;
}

export interface GuideFaqItem {
  id: string;
  question: string;
  answer: string;
  audience: GuideAudience;
}

export interface GuideGlossaryItem {
  term: string;
  definition: string;
}

export interface GuideChecklistItem {
  id: string;
  label: string;
}

export interface GuideIndexItem {
  label: string;
  description: string;
  sectionId: string;
  audience: GuideAudience;
}

export interface GuideFlashCard {
  title: string;
  bullets: string[];
  audience: GuideAudience;
  icon: string;
  sectionId: string;
}

export interface GuideOneshotStep {
  title: string;
  detail: string;
  role: 'MJ' | 'Joueur' | 'Tous';
}

export interface GuideRoleFlowStep {
  role: string;
  label: string;
}

export interface GuideLabeledFlowStep {
  label: string;
  detail: string;
}

export interface GuideEditorTool {
  tool: string;
  detail: string;
}
