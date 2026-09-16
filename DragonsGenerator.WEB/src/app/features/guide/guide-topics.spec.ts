import { GUIDE_TOPICS, getGuideTopic, guideTopicsByGroup } from './guide-topics';
import { getGuideRulebook, GUIDE_RULEBOOKS } from './guide-rulebooks';
import {
  GUIDE_CLASS_PLAYBOOKS,
  classBeginnerPackFilename,
  getGuideClassPlaybook,
} from './guide-class-playbooks';

describe('guide-topics', () => {
  it('maps nav sections to rich forum topics', () => {
    expect(GUIDE_TOPICS.length).toBeGreaterThan(10);
    const faq = getGuideTopic('faq');
    expect(faq?.title).toContain('FAQ');
    expect(faq?.paragraphs.length).toBeGreaterThan(0);
    expect(faq?.steps.length).toBeGreaterThan(0);
  });

  it('exposes deep links for demarrage', () => {
    const t = getGuideTopic('demarrage');
    expect(t?.links.some((l) => l.path === '/create')).toBe(true);
    expect(t?.links.some((l) => l.path === '/guide/mj-table')).toBe(true);
    expect(t?.steps.length).toBeGreaterThan(0);
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

  it('includes fiche annotée, glossaire and init≠toucher on table books', () => {
    for (const id of ['mj-table', 'joueur-table'] as const) {
      const book = getGuideRulebook(id);
      expect(book?.chapters.some((c) => c.id === 'fiche')).toBe(true);
      expect(book?.chapters.some((c) => c.id === 'glossaire')).toBe(true);
      const combat = book?.chapters.find((c) => c.id === 'combat');
      expect(combat?.sections.some((s) => s.id === 'init-vs-toucher')).toBe(true);
      expect(combat?.sections.some((s) => s.id === 'schema-initiative' && !!s.diagram?.length)).toBe(
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
});
