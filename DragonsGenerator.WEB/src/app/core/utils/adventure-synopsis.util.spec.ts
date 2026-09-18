import { parseAdventureSections } from './adventure-synopsis.util';

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
});
