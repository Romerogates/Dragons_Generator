import { CharacterHandoffService } from './character-handoff.service';
import type { Character } from '@core/models/Character/character';

describe('CharacterHandoffService', () => {
  let service: CharacterHandoffService;

  beforeEach(() => {
    sessionStorage.clear();
    service = new CharacterHandoffService();
  });

  afterEach(() => sessionStorage.clear());

  it('defaults to own mode', () => {
    service.setCurrent({ name: 'Aria' } as Character);
    expect(service.peekMode()).toBe('own');
    expect(service.peekSourceLabel()).toBeNull();
  });

  it('stores consult mode and source label', () => {
    service.setCurrent({ name: 'Borin' } as Character, {
      mode: 'consult',
      sourceLabel: 'Pré-tiré',
      returnUrl: '/campaigns/1/play',
    });
    expect(service.peekCurrent()?.name).toBe('Borin');
    expect(service.peekMode()).toBe('consult');
    expect(service.peekSourceLabel()).toBe('Pré-tiré');
    expect(service.peekReturnUrl()).toBe('/campaigns/1/play');
  });

  it('clears mode with character', () => {
    service.setCurrent({ name: 'X' } as Character, {
      mode: 'consult',
      sourceLabel: 'Chat',
      returnUrl: '/play',
    });
    service.clearCurrent();
    expect(service.peekCurrent()).toBeNull();
    expect(service.peekMode()).toBe('own');
    expect(service.peekSourceLabel()).toBeNull();
    expect(service.peekReturnUrl()).toBeNull();
  });
});
