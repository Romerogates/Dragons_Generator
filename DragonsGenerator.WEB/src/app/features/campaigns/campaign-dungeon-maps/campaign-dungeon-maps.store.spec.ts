import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { emptyCampaignData, type CampaignDetail } from '@core/models/Campaign/campaign';
import { createEmptyDungeonMap, type CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';
import { DungeonCloudService } from '@core/services/dungeon-cloud.service';
import { CampaignDungeonMapsStore } from './campaign-dungeon-maps.store';

function campaign(maps: CampaignDungeonMap[] = []): CampaignDetail {
  return {
    id: 'c1',
    title: 'Hub',
    role: 'dm',
    isOwner: true,
    updatedAt: '2026-01-01T00:00:00Z',
    members: [],
    data: { ...emptyCampaignData(), dungeonMaps: maps },
  };
}

describe('CampaignDungeonMapsStore', () => {
  let store: CampaignDungeonMapsStore;
  let create: jasmine.Spy;
  let update: jasmine.Spy;
  let list: jasmine.Spy;
  let get: jasmine.Spy;
  const campaignSig = signal(campaign());
  const libraryMode = signal(false);
  const draft = signal<CampaignDungeonMap | null>(null);
  const editingId = signal<string | null>(null);
  const emitted: unknown[] = [];

  beforeEach(() => {
    campaignSig.set(campaign());
    libraryMode.set(false);
    draft.set(null);
    editingId.set(null);
    emitted.length = 0;
    create = jasmine.createSpy('create').and.returnValue(
      of({ id: 'lib-1', name: 'Lib', updatedAt: '2026-02-01T00:00:00Z' }),
    );
    update = jasmine.createSpy('update').and.returnValue(
      of({ id: 'lib-1', name: 'Lib', updatedAt: '2026-02-01T00:00:00Z' }),
    );
    list = jasmine.createSpy('list').and.returnValue(of([{ id: 'lib-1', name: 'Cave', updatedAt: 't' }]));
    get = jasmine.createSpy('get').and.returnValue(
      of({
        id: 'lib-1',
        name: 'Cave',
        data: createEmptyDungeonMap('Cave'),
        updatedAt: 't',
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        CampaignDungeonMapsStore,
        {
          provide: DungeonCloudService,
          useValue: { create, update, list, get },
        },
      ],
    });
    store = TestBed.inject(CampaignDungeonMapsStore);
    store.configure({
      campaign: () => campaignSig(),
      libraryMode: () => libraryMode(),
      draftMap: () => draft(),
      editingMapId: () => editingId(),
      setDraftMap: (m) => draft.set(m),
      emitData: (p) => emitted.push(p),
    });
  });

  afterEach(() => store.destroy());

  it('loadLibraryList remplit la liste', () => {
    store.loadLibraryList(() => undefined);
    expect(store.libraryList().length).toBe(1);
    expect(store.libraryBusy()).toBe(false);
  });

  it('loadLibraryList appelle onError si list échoue', () => {
    list.and.returnValue(throwError(() => new Error('net')));
    const onError = jasmine.createSpy('onError');
    store.loadLibraryList(onError);
    expect(onError).toHaveBeenCalled();
    expect(store.libraryBusy()).toBe(false);
  });

  it('publishGeneratedMap en libraryMode persiste sans create cloud', () => {
    libraryMode.set(true);
    const named = createEmptyDungeonMap('Solo');
    const onOk = jasmine.createSpy('ok');
    store.publishGeneratedMap(named, onOk, () => undefined);
    expect(create).not.toHaveBeenCalled();
    expect(onOk).toHaveBeenCalledWith(named);
    expect(emitted.length).toBe(1);
  });

  it('publishGeneratedMap quota appelle onQuota', () => {
    create.and.returnValue(throwError(() => new Error('quota')));
    const onQuota = jasmine.createSpy('quota');
    store.publishGeneratedMap(createEmptyDungeonMap('Q'), () => undefined, onQuota);
    expect(onQuota).toHaveBeenCalled();
    expect(store.quotaMessage('generate')).toContain('50');
  });

  it('importFromLibrary lie la carte et persiste', () => {
    const onOk = jasmine.createSpy('ok');
    store.importFromLibrary({ id: 'lib-1', name: 'Cave', updatedAt: 't' }, onOk, () => undefined);
    expect(get).toHaveBeenCalledWith('lib-1');
    expect(onOk).toHaveBeenCalled();
    expect(store.libraryGeometryCache().has('lib-1')).toBeTrue();
  });

  it('persistMaps immédiat émet dungeonMaps', () => {
    const map = createEmptyDungeonMap('A');
    store.persistMaps([map], true);
    expect(emitted.length).toBeGreaterThan(0);
    expect((emitted[0] as { dungeonMaps?: unknown }).dungeonMaps).toBeDefined();
  });
});
