import { GUIDE_TOPICS, getGuideTopic, guideTopicsByGroup } from './guide-topics';

describe('guide-topics', () => {
  it('maps nav sections to forum topics', () => {
    expect(GUIDE_TOPICS.length).toBeGreaterThan(10);
    const faq = getGuideTopic('faq');
    expect(faq?.title).toContain('FAQ');
    expect(faq?.paragraphs.length).toBeGreaterThan(0);
  });

  it('filters by audience and query', () => {
    const dmOnly = guideTopicsByGroup('dm', '', 'all');
    const flat = dmOnly.flatMap((s) => s.topics);
    expect(flat.every((t) => t.audience === 'all' || t.audience === 'dm')).toBe(true);

    const searched = guideTopicsByGroup('all', 'faq', 'all');
    expect(searched.some((s) => s.topics.some((t) => t.id === 'faq'))).toBe(true);
  });
});
