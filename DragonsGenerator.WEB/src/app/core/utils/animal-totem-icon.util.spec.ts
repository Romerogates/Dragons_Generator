import { animalTotemEmoji, animalTotemIconify } from './animal-totem-icon.util';

describe('animalTotemEmoji', () => {
  it('maps known beasts from labels and ids', () => {
    expect(animalTotemEmoji('Crocodile')).toBe('🐊');
    expect(animalTotemEmoji('beast-crocodile')).toBe('🐊');
    expect(animalTotemEmoji('alligator')).toBe('🐊');
    expect(animalTotemEmoji('Serpent constricteur')).toBe('🐍');
    expect(animalTotemEmoji('beast-serpent-constricteur')).toBe('🐍');
    expect(animalTotemEmoji('vipère')).toBe('🐍');
    expect(animalTotemEmoji('Ours')).toBe('🐻');
    expect(animalTotemEmoji('bear')).toBe('🐻');
    expect(animalTotemEmoji('Aigle')).toBe('🦅');
    expect(animalTotemEmoji('faucon')).toBe('🦅');
    expect(animalTotemEmoji('Cerf')).toBe('🦌');
    expect(animalTotemEmoji('chevreuil')).toBe('🦌');
    expect(animalTotemEmoji('Panthère')).toBe('🐈');
    expect(animalTotemEmoji('félins')).toBe('🐈');
    expect(animalTotemEmoji('Corbeau')).toBe('🐦');
    expect(animalTotemEmoji('chouette')).toBe('🐦');
    expect(animalTotemEmoji('Cheval')).toBe('🐴');
    expect(animalTotemEmoji('Sanglier')).toBe('🐗');
    expect(animalTotemEmoji('Requin')).toBe('🦈');
    expect(animalTotemEmoji('Araignée')).toBe('🕷️');
    expect(animalTotemEmoji('Grenouille')).toBe('🐸');
    expect(animalTotemEmoji('Rat')).toBe('🐀');
    expect(animalTotemEmoji('Dauphin')).toBe('🐬');
    expect(animalTotemEmoji('Abeille')).toBe('🐝');
    expect(animalTotemEmoji('guêpe')).toBe('🐝');
    expect(animalTotemEmoji('Loup')).toBe('🐺');
    expect(animalTotemEmoji('beast-loup', 'Loup')).toBe('🐺');
  });

  it('joins id + label and ignores nullish parts', () => {
    expect(animalTotemEmoji(null, undefined, 'Crocodile')).toBe('🐊');
    expect(animalTotemEmoji('beast-unknown', 'Ours brun')).toBe('🐻');
  });

  it('falls back to paw prints for unknown beasts', () => {
    expect(animalTotemEmoji('totem-mystère')).toBe('🐾');
    expect(animalTotemEmoji()).toBe('🐾');
  });

  it('does not treat crocodile as wolf', () => {
    expect(animalTotemEmoji('beast-crocodile', 'Crocodile')).not.toBe('🐺');
  });
});

describe('animalTotemIconify', () => {
  it('maps known beasts to fluent-emoji icons', () => {
    expect(animalTotemIconify('Crocodile')).toBe('fluent-emoji:crocodile');
    expect(animalTotemIconify('alligator')).toBe('fluent-emoji:crocodile');
    expect(animalTotemIconify('Serpent')).toBe('fluent-emoji:snake');
    expect(animalTotemIconify('vipère')).toBe('fluent-emoji:snake');
    expect(animalTotemIconify('Ours')).toBe('fluent-emoji:bear');
    expect(animalTotemIconify('Aigle')).toBe('fluent-emoji:eagle');
    expect(animalTotemIconify('Cerf')).toBe('fluent-emoji:deer');
    expect(animalTotemIconify('Tigre')).toBe('fluent-emoji:cat');
    expect(animalTotemIconify('Corbeau')).toBe('fluent-emoji:bird');
    expect(animalTotemIconify('Cheval')).toBe('fluent-emoji:horse');
    expect(animalTotemIconify('Sanglier')).toBe('fluent-emoji:boar');
    expect(animalTotemIconify('Requin')).toBe('fluent-emoji:shark');
    expect(animalTotemIconify('Araignée')).toBe('fluent-emoji:spider');
    expect(animalTotemIconify('Grenouille')).toBe('fluent-emoji:frog');
    expect(animalTotemIconify('Souris')).toBe('fluent-emoji:rat');
    expect(animalTotemIconify('Dauphin')).toBe('fluent-emoji:dolphin');
    expect(animalTotemIconify('Abeille')).toBe('fluent-emoji:honeybee');
    expect(animalTotemIconify('Loup')).toBe('fluent-emoji:wolf');
  });

  it('falls back to paw-prints for unknown', () => {
    expect(animalTotemIconify('totem-inconnu')).toBe('fluent-emoji:paw-prints');
    expect(animalTotemIconify(null, undefined)).toBe('fluent-emoji:paw-prints');
  });

  it('prefers crocodile over wolf when both labels present', () => {
    expect(animalTotemIconify('beast-crocodile', 'Crocodile')).toBe('fluent-emoji:crocodile');
  });
});
