export type GuideAudience = 'all' | 'dm' | 'player';

export interface GuideNavGroup {
  id: string;
  label: string;
  sectionIds: string[];
}

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
  /** Date FR affichée (ex. « 31 août 2026 ») — sert aussi à l’expiration isNew (14 j). */
  date: string;
  tag: string;
  title: string;
  summary: string;
  icon: string;
  border: string;
  tagColor: string;
  /** Intention éditoriale ; l’affichage « Nouveau » expire aussi à 14 j / après lecture. */
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
  badge?: 'MJ' | 'Joueur' | 'Tous' | 'Nouveau';
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

export interface GuideIndexItem {
  label: string;
  description: string;
  sectionId: string;
  audience: GuideAudience;
  /** Lien app réel (Codex / outil) — prioritaire sur `/guide/{sectionId}` dans l’index wiki. */
  href?: string;
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
