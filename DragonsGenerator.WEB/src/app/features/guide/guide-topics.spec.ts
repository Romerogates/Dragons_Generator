import { GUIDE_TOPICS, getGuideTopic, guideTopicsByGroup } from './guide-topics';
import { getGuideRulebook, GUIDE_RULEBOOKS } from './guide-rulebooks';
import {
  GUIDE_CLASS_PLAYBOOKS,
  classBeginnerPackFilename,
  getGuideClassPlaybook,
} from './guide-class-playbooks';
import {
  GUIDE_SUBCLASS_PLAYBOOKS,
  getGuideSubclassPlaybook,
} from './guide-subclass-playbooks';
import {
  GUIDE_SPECIES_PLAYBOOKS,
  getGuideSpeciesPlaybook,
} from './guide-species-playbooks';
import {
  GUIDE_BLOG_POSTS,
  GUIDE_FAQ_ITEMS,
  GUIDE_FEATURE_INDEX,
  GUIDE_GLOSSARY,
  GUIDE_NEWS_TTL_MS,
  isGuideBlogPostNew,
  parseGuideBlogDate,
} from './guide-content';

describe('guide-topics', () => {
  it('maps nav sections to rich forum topics', () => {
    expect(GUIDE_TOPICS.length).toBeGreaterThan(10);
    const faq = getGuideTopic('faq');
    expect(faq?.title).toContain('FAQ');
    expect(faq?.paragraphs.length).toBeGreaterThan(0);
    expect(faq?.steps.length).toBe(GUIDE_FAQ_ITEMS.length);
  });

  it('exposes full glossaire and index without truncation', () => {
    expect(getGuideTopic('glossaire')?.steps.length).toBe(GUIDE_GLOSSARY.length);
    expect(getGuideTopic('index')?.steps.length).toBe(GUIDE_FEATURE_INDEX.length);
  });

  it('lists every journal post and marks Nouveau only within TTL', () => {
    const journal = getGuideTopic('journal');
    expect(journal?.steps.length).toBe(GUIDE_BLOG_POSTS.length);
    const fresh = GUIDE_BLOG_POSTS.filter((p) => isGuideBlogPostNew(p));
    expect(journal?.steps.filter((s) => s.badge === 'Nouveau').length).toBe(fresh.length);
  });

  it('no longer ships empty captures topic', () => {
    expect(getGuideTopic('captures')).toBeUndefined();
  });

  it('exposes deep links for demarrage', () => {
    const t = getGuideTopic('demarrage');
    expect(t?.links.some((l) => l.path === '/create')).toBe(true);
    expect(t?.links.some((l) => l.path === '/guide/mj-table')).toBe(true);
    expect(t?.steps.length).toBeGreaterThan(0);
  });

  it('codex topic links come from CODEX_NAV_LINKS', () => {
    const t = getGuideTopic('codex');
    expect(t?.links.some((l) => l.path === '/codex')).toBe(true);
    expect(t?.links.some((l) => l.path === '/backgrounds')).toBe(true);
    expect(t?.links.some((l) => l.path === '/civilisations')).toBe(true);
    expect(t?.links.some((l) => l.path === '/species')).toBe(true);
  });

  it('no longer ships beginner topics as wiki articles', () => {
    expect(getGuideTopic('mj-debut')).toBeUndefined();
    expect(getGuideTopic('joueur-debut')).toBeUndefined();
  });

  it('no longer ships checklists topic', () => {
    expect(getGuideTopic('checklists')).toBeUndefined();
  });

  it('filters by audience and query', () => {
    const dmOnly = guideTopicsByGroup('dm', '', 'all');
    const flat = dmOnly.flatMap((s) => s.topics);
    expect(flat.every((t) => t.audience === 'all' || t.audience === 'dm')).toBe(true);

    const searched = guideTopicsByGroup('all', 'faq', 'all');
    expect(searched.some((s) => s.topics.some((t) => t.id === 'faq'))).toBe(true);
  });
  it('index wiki steps point to real Codex / app URLs when href is set', () => {
    const index = getGuideTopic('index');
    expect(index?.steps.some((s) => s.link === '/creatures')).toBe(true);
    expect(index?.steps.some((s) => s.link === '/species')).toBe(true);
    expect(index?.links.some((l) => l.path === '/spells')).toBe(true);
  });

  it('schemas topic uses structured steps (not concatenated role→label strings)', () => {
    const schemas = getGuideTopic('schemas');
    expect(schemas?.steps.length).toBeGreaterThan(2);
    expect(schemas?.steps.every((s) => !s.body.includes(' → '))).toBe(true);
  });
});

describe('guide blog isNew TTL', () => {
  it('parses French dates and expires after 14 days', () => {
    expect(parseGuideBlogDate('31 août 2026')).toBe(Date.UTC(2026, 7, 31));
    const post = {
      ...GUIDE_BLOG_POSTS[0],
      date: '20 septembre 2026',
      isNew: true,
    };
    const day0 = Date.UTC(2026, 8, 20);
    expect(isGuideBlogPostNew(post, day0)).toBe(true);
    expect(isGuideBlogPostNew(post, day0 + GUIDE_NEWS_TTL_MS + 1)).toBe(false);
    expect(isGuideBlogPostNew({ ...post, isNew: false }, day0)).toBe(false);
  });
});

describe('guide-rulebooks', () => {
  it('exposes table/online rulebooks plus oneshot sheet', () => {
    expect(GUIDE_RULEBOOKS.length).toBe(5);
    expect(getGuideRulebook('mj-table')?.mode).toBe('table');
    expect(getGuideRulebook('mj-en-ligne')?.mode).toBe('en-ligne');
    expect(getGuideRulebook('oneshot')?.mode).toBe('oneshot');
    expect(getGuideRulebook('joueur-table')?.chapters.some((c) => c.id === 'combat')).toBe(true);
    expect(getGuideRulebook('mj-table')?.chapters.some((c) => c.id === 'stats')).toBe(true);
  });

  it('enrichit les livrets en ligne avec aperçus Table / init (liens, pas fake screenshots)', () => {
    for (const id of ['mj-en-ligne', 'joueur-en-ligne'] as const) {
      const book = getGuideRulebook(id);
      expect(book?.chapters.some((c) => c.id === 'apercus')).toBe(true);
      expect(book?.related.some((r) => r.path === '/campaigns')).toBe(true);
      const captions = book?.chapters.find((c) => c.id === 'apercus')?.sections ?? [];
      expect(
        captions.some((s) => s.id.includes('init') || s.title.toLowerCase().includes('initiative')),
      ).toBe(true);
    }
  });

  it('includes fiche annotée, glossaire and init≠toucher on table books', () => {
    for (const id of ['mj-table', 'joueur-table'] as const) {
      const book = getGuideRulebook(id);
      expect(book?.chapters.some((c) => c.id === 'fiche')).toBe(true);
      expect(book?.chapters.some((c) => c.id === 'glossaire')).toBe(true);
      const combat = book?.chapters.find((c) => c.id === 'combat');
      expect(combat?.sections.some((s) => s.id === 'init-vs-toucher')).toBe(true);
      expect(combat?.sections.some((s) => s.id === 'schema-initiative' && (!!s.diagram?.length || !!s.flowSteps?.length))).toBe(
        true,
      );
    }
    const dd = getGuideRulebook('mj-table')
      ?.chapters.find((c) => c.id === 'stats')
      ?.sections.find((s) => s.id === 'dd');
    expect(dd?.bullets?.some((b) => b.includes('Eana'))).toBe(true);
    expect(getGuideRulebook('inconnu')).toBeNull();
  });

  it('aligns fiche labels with sheet vocabulary (Pv, Bonus de maîtrise)', () => {
    const fiche = getGuideRulebook('joueur-table')?.chapters.find((c) => c.id === 'fiche');
    const zones = fiche?.sections.find((s) => s.id === 'zones')?.numbered?.join(' ') ?? '';
    expect(zones).toContain('Bonus de maîtrise');
    expect(zones).toContain('Pv');
    expect(zones).toContain('Perception passive');
  });

  it('links combat-actions from table rulebooks', () => {
    expect(getGuideRulebook('mj-table')?.related.some((r) => r.path === '/combat-actions')).toBe(
      true,
    );
    expect(getGuideRulebook('joueur-table')?.related.some((r) => r.path === '/combat-actions')).toBe(
      true,
    );
  });
});

describe('guide-class-playbooks', () => {
  it('covers all main classes and skips spells for barbarian', () => {
    expect(GUIDE_CLASS_PLAYBOOKS.length).toBe(13);
    const barb = getGuideClassPlaybook('cls-barbare');
    expect(barb?.hasSpells).toBe(false);
    expect(barb?.chapters.some((c) => c.id === 'pas-sorts')).toBe(true);
    const traps = barb?.chapters
      .find((c) => c.id === 'role')
      ?.sections.find((s) => s.id === 'pieges');
    expect(traps?.bullets?.length).toBeGreaterThanOrEqual(2);
    expect(barb?.related.some((r) => r.path === '/classes/cls-barbare')).toBe(true);
    const wiz = getGuideClassPlaybook('cls-magicien');
    expect(wiz?.hasSpells).toBe(true);
    expect(wiz?.chapters.some((c) => c.id === 'sorts')).toBe(true);
  });

  it('builds pack filename and ignores unknown class', () => {
    expect(classBeginnerPackFilename('cls-barbare')).toBe('dragons-pack-debutant-barbare.pdf');
    expect(getGuideClassPlaybook(null)).toBeNull();
    expect(getGuideClassPlaybook('cls-inexistant')).toBeNull();
  });

  it('links subclass tips from parent class playbooks', () => {
    const barb = getGuideClassPlaybook('cls-barbare');
    expect(barb?.related.some((r) => r.path.includes('/guide/sous-classe/'))).toBe(true);
  });
});

describe('guide subclass + species playbooks', () => {
  it('ships a few subclass tips (template pattern)', () => {
    expect(GUIDE_SUBCLASS_PLAYBOOKS.length).toBeGreaterThanOrEqual(3);
    expect(getGuideSubclassPlaybook('subcls-berserker')?.classId).toBe('cls-barbare');
    expect(getGuideSubclassPlaybook('subcls-inconnu')).toBeNull();
  });

  it('ships a few species tips', () => {
    expect(GUIDE_SPECIES_PLAYBOOKS.length).toBeGreaterThanOrEqual(2);
    expect(getGuideSpeciesPlaybook('sp-humain')?.speciesName).toBe('Humain');
    expect(getGuideSpeciesPlaybook('sp-inconnu')).toBeNull();
  });
});
