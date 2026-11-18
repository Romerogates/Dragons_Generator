import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { AuthService } from '@core/services/auth.service';
import { ConnectivityService } from '@core/services/connectivity.service';
import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';
import type { Combatant, SessionTablePawn } from '@core/models/Campaign/campaign';
import { CampaignPlaySessionStore } from '../campaign-play-session-store/campaign-play-session.store';
import { PlayBattleMap } from './play-battle-map';

function floorMap(): CampaignDungeonMap {
  return {
    id: 'm1',
    name: 'Cave',
    theme: 'cave',
    gridWidth: 4,
    gridHeight: 3,
    tiles: [
      ['wall', 'wall', 'wall', 'wall'],
      ['wall', 'floor', 'floor', 'wall'],
      ['wall', 'wall', 'wall', 'wall'],
    ],
    rooms: [{ id: 'r1', label: '1', x: 1, y: 1, width: 2, height: 1 }],
    markers: [],
    fogOfWarEnabled: true,
    revealedRoomIds: [],
    createdAt: '',
    updatedAt: '',
  };
}

describe('PlayBattleMap', () => {
  let fixture: ComponentFixture<PlayBattleMap>;
  let cmp: PlayBattleMap;
  const isDm = signal(true);
  const activeCombat = signal<{ combatants: Combatant[] } | null>(null);
  const activeSessionMap = signal<CampaignDungeonMap | null>(floorMap());
  const tablePawns = signal<SessionTablePawn[]>([
    { id: 'pawn-u1', name: 'Aria', mapX: 1, mapY: 1, memberUserId: 'u1' },
  ]);
  const placeEveningToken = jasmine.createSpy('placeEveningToken');
  const ensureEveningPawns = jasmine.createSpy('ensureEveningPawns');
  const setFeedback = jasmine.createSpy('setFeedback');

  beforeEach(async () => {
    isDm.set(true);
    activeCombat.set(null);
    activeSessionMap.set(floorMap());
    tablePawns.set([{ id: 'pawn-u1', name: 'Aria', mapX: 1, mapY: 1, memberUserId: 'u1' }]);
    placeEveningToken.calls.reset();
    ensureEveningPawns.calls.reset();
    setFeedback.calls.reset();

    await TestBed.configureTestingModule({
      imports: [PlayBattleMap],
      providers: [
        ...zonelessTestProviders,
        {
          provide: CampaignPlaySessionStore,
          useValue: {
            isDm,
            isSpectator: () => false,
            activeCombat,
            activeSessionMap,
            combatTurnOrder: signal([]),
            currentTurn: signal(null),
            approvedPlayers: signal([{ userId: 'u1' }]),
            activeSession: () => ({ tablePawns: tablePawns() }),
            ensureEveningPawns,
            placeEveningToken,
            setFeedback,
            toggleSessionFog: () => true,
            updateEveningPawn: jasmine.createSpy('updateEveningPawn'),
            patchSessionDungeonMap: jasmine.createSpy('patchSessionDungeonMap'),
          },
        },
        { provide: AuthService, useValue: { user: () => ({ id: 'u1' }) } },
        { provide: ConnectivityService, useValue: { isOnline: () => true } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayBattleMap);
    cmp = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('affiche la carte hors onglet donjon et pose un pion hors combat', () => {
    expect(cmp.showBattleMap()).toBeTrue();
    expect(cmp.tokenRoster()[0].id).toBe('pawn-u1');
    expect(cmp.battleMapTokens()[0].id).toBe('pawn-u1');
    cmp.selectTokenForPlacement('pawn-u1');
    expect(cmp.selectedTokenCombatant()?.name).toBe('Aria');
    (cmp as unknown as { placeCombatantOnMap: (id: string, x: number, y: number) => void }).placeCombatantOnMap(
      'pawn-u1',
      2,
      1,
    );
    expect(placeEveningToken).toHaveBeenCalledWith('pawn-u1', 2, 1, { immediate: true });
  });

  it('masque la carte pour le MJ sur l’onglet donjon', () => {
    fixture.componentRef.setInput('sessionView', 'dungeon');
    fixture.detectChanges();
    expect(cmp.showBattleMap()).toBeFalse();
  });

  it('utilise les combattants pendant un combat', () => {
    activeCombat.set({
      combatants: [
        {
          id: 'c1',
          name: 'Aria',
          kind: 'player',
          initiativeBonus: 0,
          mapX: 1,
          mapY: 1,
          memberUserId: 'u1',
        },
        {
          id: 'dead',
          name: 'Gob',
          kind: 'monster',
          initiativeBonus: 0,
          defeated: true,
        },
      ],
    });
    fixture.detectChanges();
    expect(cmp.tokenRoster().map((c) => c.id)).toEqual(['c1']);
    expect(cmp.battleMapTokens()[0].id).toBe('c1');
    cmp.selectTokenForPlacement('c1');
    expect(cmp.selectedTokenCombatant()?.id).toBe('c1');
  });

  it('refuse une case occupée hors combat', () => {
    (cmp as unknown as { placeCombatantOnMap: (id: string, x: number, y: number) => void }).placeCombatantOnMap(
      'other',
      1,
      1,
    );
    expect(setFeedback).toHaveBeenCalled();
    expect(placeEveningToken).not.toHaveBeenCalled();
  });

  it('laisse un joueur déplacer son pion, pas celui d’un autre', () => {
    isDm.set(false);
    tablePawns.set([
      { id: 'pawn-u1', name: 'Aria', mapX: 1, mapY: 1, memberUserId: 'u1' },
      { id: 'pawn-u2', name: 'Lila', mapX: 2, mapY: 1, memberUserId: 'u2' },
    ]);
    fixture.detectChanges();
    const place = (
      cmp as unknown as { placeCombatantOnMap: (id: string, x: number, y: number) => void }
    ).placeCombatantOnMap.bind(cmp);
    place('pawn-u2', 1, 1);
    expect(placeEveningToken).not.toHaveBeenCalled();
    place('pawn-u1', 2, 1);
    expect(setFeedback).toHaveBeenCalled();
    placeEveningToken.calls.reset();
    tablePawns.set([{ id: 'pawn-u1', name: 'Aria', mapX: 1, mapY: 1, memberUserId: 'u1' }]);
    fixture.detectChanges();
    place('pawn-u1', 2, 1);
    expect(placeEveningToken).toHaveBeenCalledWith('pawn-u1', 2, 1, { immediate: true });
  });
});
