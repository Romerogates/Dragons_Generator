import {
  ABILITY_POINT_COSTS,
  DEFAULT_ABILITY_SCORE,
  MAX_ABILITY_SCORE,
  MIN_ABILITY_SCORE,
  STARTING_POINTS,
} from './character-ability';
import * as creation from './character-creation';

describe('constantes de caractéristiques (source unique)', () => {
  it('réexporte les mêmes références depuis character-creation', () => {
    expect(creation.ABILITY_POINT_COSTS).toBe(ABILITY_POINT_COSTS);
    expect(creation.DEFAULT_ABILITY_SCORE).toBe(DEFAULT_ABILITY_SCORE);
    expect(creation.STARTING_POINTS).toBe(STARTING_POINTS);
    expect(creation.MIN_ABILITY_SCORE).toBe(MIN_ABILITY_SCORE);
    expect(creation.MAX_ABILITY_SCORE).toBe(MAX_ABILITY_SCORE);
  });
});
