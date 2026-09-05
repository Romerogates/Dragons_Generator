import { animalTotemEmoji, animalTotemIconify } from './animal-totem-icon.util';

describe('animalTotemEmoji', () => {
  it('maps crocodile / serpent / loup from labels and beast ids', () => {
    expect(animalTotemEmoji('Crocodile')).toBe('🐊');
    expect(animalTotemEmoji('beast-crocodile')).toBe('🐊');
    expect(animalTotemEmoji('Serpent constricteur')).toBe('🐍');
    expect(animalTotemEmoji('beast-serpent-constricteur')).toBe('🐍');
    expect(animalTotemEmoji('Loup')).toBe('🐺');
    expect(animalTotemEmoji('beast-loup', 'Loup')).toBe('🐺');
  });

  it('does not treat crocodile as wolf', () => {
    expect(animalTotemEmoji('beast-crocodile', 'Crocodile')).not.toBe('🐺');
    expect(animalTotemIconify('beast-crocodile', 'Crocodile')).toBe('fluent-emoji:crocodile');
  });
});
