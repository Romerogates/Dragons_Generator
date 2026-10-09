import { ComponentFixture, TestBed } from '@angular/core/testing';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { PlayCombatFlow } from './play-combat-flow';
import type { PlayCombatHost } from './play-combat-host';

describe('PlayCombatFlow', () => {
  let fixture: ComponentFixture<PlayCombatFlow>;
  let component: PlayCombatFlow;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayCombatFlow],
      providers: [...zonelessTestProviders],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayCombatFlow);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('host', {
      state: { isDm: () => true, sessionView: () => 'resume' },
    } as unknown as PlayCombatHost);
  });

  it('binds a PlayCombatHost contract, not the panel type alias', () => {
    expect(component.host().state.isDm()).toBeTrue();
    expect(typeof component.host().state.isDm).toBe('function');
  });
});
