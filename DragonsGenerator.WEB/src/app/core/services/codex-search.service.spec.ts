import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { DataService } from './data.service';
import { CodexSearchService } from './codex-search.service';

describe('CodexSearchService', () => {
  let service: CodexSearchService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        CodexSearchService,
        {
          provide: DataService,
          useValue: {
            getSpeciesSummary: () => of([{ id: 'hum', name: 'Humain' }]),
            getClassesSummary: () => of([{ id: 'mag', name: 'Magicien' }]),
            getCivilisationsSummary: () => of([]),
            getEquipmentsSummary: () => of([{ id: 'epee', name: 'Épée longue' }]),
            getSpellsSummary: () =>
              of([
                { id: 'aid', name: 'Aide' },
                { id: 'boule', name: 'Boule de feu' },
                { id: 'sortilege-cache', name: 'Lumière' },
              ]),
            getCreaturesSummary: () => of([{ id: 'gob', name: 'Gobelin' }]),
            getSkillsSummary: () => of([]),
            getFeatsSummary: () => of([]),
            getBackgroundsSummary: () => of([]),
            getCombatActionsSummary: () => of([]),
            getDeitiesSummary: () => of([]),
          },
        },
      ],
    });
    service = TestBed.inject(CodexSearchService);
    service.ensureIndex();
  });

  it('finds catalog entries by name including accents', () => {
    expect(service.entries('gobelin').some((h) => h.path === '/creatures/gob')).toBeTrue();
    expect(service.entries('epee').some((h) => h.path === '/equipments/epee')).toBeTrue();
    expect(service.entries('boule').some((h) => h.label === 'Boule de feu')).toBeTrue();
  });

  it('still matches section synonyms', () => {
    expect(service.sections('monstre').some((l) => l.path === '/creatures')).toBeTrue();
  });

  it('returns no entries for empty query', () => {
    expect(service.entries('')).toEqual([]);
    expect(service.entries('   ')).toEqual([]);
  });

  it('ranks the spell name, not the Sortilèges category', () => {
    expect(service.entries('sort').some((h) => h.category === 'Sortilèges')).toBeFalse();
    const hits = service.entries('boule');
    expect(hits[0]?.label).toBe('Boule de feu');
  });
});
