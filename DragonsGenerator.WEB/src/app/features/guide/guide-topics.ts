import type { GuideAudience, GuideNavGroup } from './guide.types';
import {
  GUIDE_ALL_NAV,
  GUIDE_BLOG_POSTS,
  GUIDE_FEATURE_INDEX,
  GUIDE_FAQ_ITEMS,
  GUIDE_GLOSSARY,
  GUIDE_NAV_GROUPS,
  GUIDE_START_STEPS,
  GUIDE_CHARACTER_STEPS,
  GUIDE_TIPS,
} from './guide-content';

export interface GuideTopic {
  id: string;
  title: string;
  summary: string;
  icon: string;
  accent: string;
  audience: GuideAudience;
  groupId: string;
  groupLabel: string;
  tags: string[];
  paragraphs: string[];
}

function groupOf(sectionId: string): GuideNavGroup | undefined {
  return GUIDE_NAV_GROUPS.find((g) => g.sectionIds.includes(sectionId));
}

function summaryFor(sectionId: string, fallback: string): string {
  const hit = GUIDE_FEATURE_INDEX.find((i) => i.sectionId === sectionId);
  return hit?.description ?? fallback;
}

function paragraphsFor(id: string): string[] {
  switch (id) {
    case 'demarrage':
      return [
        'Créez un compte, forgez un héros, rejoignez ou créez une campagne.',
        'Le MJ prépare scénario, créatures et sessions ; les joueurs proposent leur personnage.',
        'Le combat et la table plein écran n’existent qu’en session active.',
      ];
    case 'parcours':
      return [
        'Deux parcours : MJ (préparation → table) et Joueur (héros → table).',
        'Utilisez le filtre d’audience du guide pour ne voir que votre rôle.',
      ];
    case 'faq':
      return GUIDE_FAQ_ITEMS.slice(0, 8).map((f) => `${f.question} — ${f.answer}`);
    case 'glossaire':
      return GUIDE_GLOSSARY.slice(0, 12).map((g) => `${g.term} : ${g.definition}`);
    case 'table':
      return GUIDE_START_STEPS.map((s) => `${s.title} — ${s.body}`);
    case 'personnage':
      return GUIDE_CHARACTER_STEPS.map((s) => `${s.title} — ${s.body}`);
    case 'journal':
      return [
        ...GUIDE_BLOG_POSTS.slice(0, 5).map((p) => `${p.title} — ${p.summary}`),
        ...GUIDE_TIPS.slice(0, 3),
      ];
    default: {
      const idx = GUIDE_FEATURE_INDEX.filter((i) => i.sectionId === id).map(
        (i) => `${i.label} — ${i.description}`,
      );
      return idx.length
        ? idx
        : [
            'Cette fiche résume le sujet. Explorez les campagnes, le codex et le support pour aller plus loin.',
            'Les commentaires ci-dessous permettent d’échanger astuces et questions avec la communauté.',
          ];
    }
  }
}

export const GUIDE_TOPICS: GuideTopic[] = GUIDE_ALL_NAV.map((nav) => {
  const group = groupOf(nav.id);
  const tags = [
    nav.audience === 'dm' ? 'mj' : nav.audience === 'player' ? 'joueur' : 'tous',
    group?.label.toLowerCase() ?? 'guide',
  ];
  return {
    id: nav.id,
    title: nav.label,
    summary: summaryFor(nav.id, `Fiche guide · ${nav.label}`),
    icon: nav.icon,
    accent: nav.accent,
    audience: nav.audience,
    groupId: group?.id ?? 'reference',
    groupLabel: group?.label ?? 'Référence',
    tags,
    paragraphs: paragraphsFor(nav.id),
  };
});

export function getGuideTopic(id: string): GuideTopic | undefined {
  return GUIDE_TOPICS.find((t) => t.id === id);
}

export function guideTopicsByGroup(
  audience: GuideAudience | 'all',
  query: string,
  groupFilter: string | 'all',
): { groupId: string; groupLabel: string; topics: GuideTopic[] }[] {
  const q = query.trim().toLowerCase();
  const filtered = GUIDE_TOPICS.filter((t) => {
    if (audience !== 'all' && t.audience !== 'all' && t.audience !== audience) return false;
    if (groupFilter !== 'all' && t.groupId !== groupFilter) return false;
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      t.summary.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.includes(q))
    );
  });

  const order = GUIDE_NAV_GROUPS.map((g) => g.id);
  const map = new Map<string, GuideTopic[]>();
  for (const t of filtered) {
    const list = map.get(t.groupId) ?? [];
    list.push(t);
    map.set(t.groupId, list);
  }

  return order
    .filter((id) => map.has(id))
    .map((id) => {
      const g = GUIDE_NAV_GROUPS.find((x) => x.id === id)!;
      return { groupId: id, groupLabel: g.label, topics: map.get(id)! };
    });
}
