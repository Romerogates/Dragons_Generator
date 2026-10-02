import { parseAdventureSections, adventureSectionsForEdit, serializeAdventureSections, patchAdventureSection, adventureSectionEditorValue, ADVENTURE_SECTION_TITLES } from './adventure-synopsis.util';

describe('parseAdventureSections', () => {
  const sample = `**Accroche** — La jungle de Kardel s’éveille.

**Contexte** — Un monde de dragons et d’éléphants.

**Personnages clés**
- Thoth, le roi de Kardel
- Lénaïa, une enfant
- Amaro, le chef

**Acte 1** — Les héros arrivent au village.`;

  it('splits fixed IA tags in stable order', () => {
    const sections = parseAdventureSections(sample);
    expect(sections.map((s) => s.title)).toEqual([
      'Accroche',
      'Contexte',
      'Personnages clés',
      'Acte 1',
    ]);
    expect(sections[0].body).toContain('jungle de Kardel');
    expect(sections[2].bullets.length).toBe(3);
    expect(sections[2].bullets[0]).toContain('Thoth');
  });

  it('falls back to a single Synopsis block without tags', () => {
    const sections = parseAdventureSections('Un texte libre sans balises.');
    expect(sections.length).toBe(1);
    expect(sections[0]!.title).toBe('Synopsis');
  });

  it('keeps the full IA tag set in fixed order', () => {
    const full = `**Accroche** — Hook.

**Contexte** — World.

**Personnages clés** — Intro.
- Alpha, le premier
- Beta, le second

**Acte 1** — Début.

**Acte 2** — Milieu.

**Acte 3** — Fin.

**Pistes pour le MJ** — Idée.`;
    expect(parseAdventureSections(full).map((s) => s.title)).toEqual([
      'Accroche',
      'Contexte',
      'Personnages clés',
      'Acte 1',
      'Acte 2',
      'Acte 3',
      'Pistes pour le MJ',
    ]);
  });

  it('returns empty for blank input', () => {
    expect(parseAdventureSections('')).toEqual([]);
    expect(parseAdventureSections(null)).toEqual([]);
  });

  it('adventureSectionsForEdit always exposes the 7 IA titles', () => {
    const edited = adventureSectionsForEdit(sample);
    expect(edited.map((s) => s.title)).toEqual([...ADVENTURE_SECTION_TITLES]);
    expect(edited[0]!.body).toContain('jungle');
  });

  it('round-trips serialize → parse for filled sections', () => {
    const edited = adventureSectionsForEdit(sample);
    const raw = serializeAdventureSections(edited);
    const again = parseAdventureSections(raw);
    expect(again.map((s) => s.title)).toEqual([
      'Accroche',
      'Contexte',
      'Personnages clés',
      'Acte 1',
    ]);
  });

  it('patchAdventureSection updates one block without dropping others', () => {
    const next = patchAdventureSection(sample, 'Accroche', 'Nouveau hook.');
    expect(next).toContain('**Accroche** — Nouveau hook.');
    expect(next).toContain('**Contexte**');
  });

  it('accepts italic headers and skips empty / duplicate titles', () => {
    const italic = `*Accroche*: Hook en ligne.

*Accroche*: Doublon ignoré.

*Contexte*: Monde.`;
    const sections = parseAdventureSections(italic);
    expect(sections.map((s) => s.title)).toEqual(['Accroche', 'Contexte']);
    expect(sections[0]!.body).toContain('Hook');
  });

  it('adventureSectionsForEdit puts synopsis-only text into Accroche', () => {
    const edited = adventureSectionsForEdit('Texte libre seul.');
    expect(edited[0]!.title).toBe('Accroche');
    expect(edited[0]!.body).toContain('Texte libre');
    expect(edited.slice(1).every((s) => !s.body && !s.bullets.length)).toBeTrue();
  });

  it('serializeAdventureSections omits empty sections and formats bullets-only', () => {
    const raw = serializeAdventureSections([
      { title: 'Accroche', body: 'Hook', bullets: [] },
      { title: 'Contexte', body: '', bullets: [] },
      { title: 'Personnages clés', body: '', bullets: ['A', 'B'] },
    ]);
    expect(raw).toContain('**Accroche** — Hook');
    expect(raw).not.toContain('**Contexte**');
    expect(raw).toContain('**Personnages clés**');
    expect(raw).toContain('- A');
  });

  it('patchAdventureSection parses bullets and ignores unknown title', () => {
    expect(patchAdventureSection(sample, 'Inconnu', 'x')).toBe(sample);
    const next = patchAdventureSection(sample, 'Personnages clés', 'Intro\n- Un\n* Deux\n• Trois');
    expect(next).toContain('- Un');
    expect(next).toContain('- Deux');
    expect(next).toContain('- Trois');
  });

  it('adventureSectionEditorValue joins body and bullets', () => {
    expect(
      adventureSectionEditorValue({ title: 'Accroche', body: 'Hook', bullets: ['A', 'B'] }),
    ).toBe('Hook\n- A\n- B');
    expect(adventureSectionEditorValue({ title: 'X', body: '  ', bullets: [] })).toBe('');
  });
});
