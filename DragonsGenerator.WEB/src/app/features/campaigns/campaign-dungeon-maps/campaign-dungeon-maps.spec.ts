import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import {
  emptyCampaignData,
  type CampaignDetail,
} from '@core/models/Campaign/campaign';
import { createEmptyDungeonMap } from '@core/models/Campaign/dungeon-map';
import { DungeonCloudService } from '@core/services/dungeon-cloud.service';
import { UiBannerPreferencesService } from '@core/services/ui-banner-preferences.service';
import { generateDungeonMap } from '@core/utils/dungeon-generator.util';
import { CampaignDungeonMaps } from './campaign-dungeon-maps';

function shellCampaign(maps = [createEmptyDungeonMap('Carte test')]): CampaignDetail {
  return {
    id: 'camp-1',
    title: 'Campagne test',
    data: { ...emptyCampaignData(), dungeonMaps: maps },
    role: 'dm',
    isOwner: true,
    updatedAt: new Date().toISOString(),
    members: [],
  };
}

describe('CampaignDungeonMaps', () => {
  let fixture: ComponentFixture<CampaignDungeonMaps>;
  let component: CampaignDungeonMaps;
  let cloud: jasmine.SpyObj<DungeonCloudService>;

  beforeEach(async () => {
    cloud = jasmine.createSpyObj('DungeonCloudService', [
      'list',
      'create',
      'update',
      'get',
      'listGallery',
    ]);
    cloud.list.and.returnValue(of([]));
    cloud.create.and.returnValue(of({ id: 'lib-1', name: 'Lib', updatedAt: new Date().toISOString() }));
    cloud.update.and.returnValue(of({ id: 'lib-1', name: 'Lib', updatedAt: new Date().toISOString() }));
    cloud.get.and.returnValue(
      of({
        id: 'lib-1',
        name: 'Lib',
        data: createEmptyDungeonMap('Lib'),
        updatedAt: new Date().toISOString(),
      }),
    );

    await TestBed.configureTestingModule({
      imports: [CampaignDungeonMaps],
      providers: [
        ...zonelessTestProviders,
        { provide: DungeonCloudService, useValue: cloud },
        {
          provide: UiBannerPreferencesService,
          useValue: {
            hideAllBanners: () => false,
            isVisible: () => true,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CampaignDungeonMaps);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('campaign', shellCampaign());
    fixture.detectChanges();
  });

  function ed() {
    return component.workspace.editor;
  }
  function paint() {
    return ed().paint;
  }
  function rooms() {
    return ed().rooms;
  }
  function files() {
    return ed().files;
  }
  function hist() {
    return ed().hist;
  }
  function gen() {
    return component.workspace.gen;
  }
  function core() {
    return component.workspace.core;
  }

  it('expose les outils éditeur attendus', () => {
    const ids = paint().tools.map((t) => t.id);
    expect(ids).toContain('floor');
    expect(ids).toContain('wall');
    expect(ids).toContain('fill');
    expect(ids).toContain('door');
    paint().setTool('fill');
    expect(paint().activeTool()).toBe('fill');
    paint().setBrushSize(2);
    expect(paint().brushSize()).toBe(2);
    paint().setFillKind('wall');
    expect(paint().fillKind()).toBe('wall');
  });

  it('ouvre le générateur avec grille compacte 32×32', () => {
    gen().openGenerator();
    expect(gen().showGenerator()).toBeTrue();
    expect(gen().genGridW()).toBe(32);
    expect(gen().genGridH()).toBe(32);
    expect(gen().sizePreset()).toBe('compact');
  });

  it('active / désactive le fog of war', () => {
    const map = createEmptyDungeonMap('Fog');
    map.id = 'm-fog';
    fixture.componentRef.setInput('campaign', shellCampaign([map]));
    fixture.detectChanges();
    ed().openEditor(map.id);
    fixture.detectChanges();

    expect(core().editingMap()?.fogOfWarEnabled).toBeFalsy();
    rooms().toggleFogOfWar();
    expect(core().editingMap()?.fogOfWarEnabled).toBeTrue();
    rooms().toggleFogOfWar();
    expect(core().editingMap()?.fogOfWarEnabled).toBeFalse();
  });

  it('paint floor pousse l’undo puis Ctrl+Z restaure', () => {
    const map = generateDungeonMap(
      {
        gridWidth: 16,
        gridHeight: 16,
        roomCount: 3,
        corridorDensity: 40,
        theme: 'generic',
        seed: 11,
      },
      { name: 'Paint' },
    );
    fixture.componentRef.setInput('campaign', shellCampaign([map]));
    fixture.detectChanges();
    ed().openEditor(map.id);
    paint().setTool('floor');
    const before = core().editingMap()!.tiles.map((row) => [...row]);

    // Trouver une case mur pour peindre
    let painted = false;
    for (let y = 0; y < map.gridHeight && !painted; y++) {
      for (let x = 0; x < map.gridWidth && !painted; x++) {
        if (before[y][x] === 'wall') {
          paint().applyTileAt(x, y, true, false);
          painted = true;
        }
      }
    }
    expect(painted).toBeTrue();
    expect(hist().canUndo()).toBeTrue();
    expect(core().editingMap()!.tiles).not.toEqual(before);

    hist().undo();
    expect(core().editingMap()!.tiles).toEqual(before);
    expect(hist().canRedo()).toBeTrue();
  });

  it('promoteRoomEncounter émet un EncounterGroup', () => {
    const map = generateDungeonMap(
      {
        gridWidth: 20,
        gridHeight: 20,
        roomCount: 4,
        corridorDensity: 50,
        theme: 'crypt',
        seed: 5,
      },
      { name: 'Boss' },
    );
    const room = map.rooms[0];
    room.randomEncounter = { creatures: [{ name: 'Zombie', quantity: 2, cr: '1/4' }] };
    fixture.componentRef.setInput('campaign', shellCampaign([map]));
    fixture.detectChanges();
    ed().openEditor(map.id);

    const spy = jasmine.createSpy('data');
    component.dataChange.subscribe(spy);
    rooms().promoteRoomEncounter(room.id);

    const encCall = spy.calls.all().find((c) => c.args[0].encounters);
    expect(encCall).toBeTruthy();
    const encs = encCall!.args[0].encounters as { name: string; creatures: unknown[] }[];
    expect(encs.length).toBe(1);
    expect(encs[0].creatures.length).toBe(1);
    expect(core().editingMap()?.rooms.find((r) => r.id === room.id)?.encounterId).toBeTruthy();
  });

  it('exportJson télécharge sans erreur', () => {
    const map = createEmptyDungeonMap('Json');
    fixture.componentRef.setInput('campaign', shellCampaign([map]));
    fixture.detectChanges();
    ed().openEditor(map.id);

    const createSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
    const revokeSpy = spyOn(URL, 'revokeObjectURL');
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');
    files().exportJson();
    expect(createSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalled();
  });

  it('affiche un message clair si create bibliothèque échoue (quota)', () => {
    cloud.create.and.returnValue(throwError(() => new Error('quota')));
    gen().openGenerator();
    gen().genName.set('Quota');
    gen().generateMap();
    expect(core().message()?.includes('Limite atteinte')).toBeTrue();
    expect(core().message()?.includes('50')).toBeTrue();
  });
});
