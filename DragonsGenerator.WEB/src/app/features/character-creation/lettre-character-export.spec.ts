import { TestBed } from '@angular/core/testing';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CharacterBuilderService } from '@core/services/character-builder.service';
import { DataService } from '@core/services/data.service';
import { of } from 'rxjs';
import { seedLettreBuilder, LETTRE_STARTING_SLOTS } from '@testing/lettre-fixtures';
import { CURRENT_SCHEMA_VERSION } from '@core/models/Character/character';

describe('Lettré character export (build + JSON)', () => {
  let builder: CharacterBuilderService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: {
            getSpecies: () => of([]),
            getClasses: () => of([]),
            getBackgrounds: () => of([]),
          },
        },
        CharacterBuilderService,
      ],
    });

    builder = TestBed.inject(CharacterBuilderService);
    seedLettreBuilder(builder);
  });

  it('build() produces a Lettré character with weapon proficiencies and equipment', () => {
    const character = builder.build();

    expect(character.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(character.name).toBe('Tyrolienne');
    expect(character.classes[0].classId).toBe('cls-lettre');
    expect(character.classes[0].classLabel).toBe('Lettré');
    expect(character.proficiencies.weapons).toContain('wp-dague');
    expect(character.proficiencies.weapons).toContain('wp-epee-courte');
    expect(character.proficiencies.tools).toEqual(
      jasmine.arrayContaining(['tl-lyre', 'tl-des', 'tl-echecs']),
    );

    const refIds = character.equipment.map((e) => e.refId);
    expect(refIds).toContain('wp-dague');
    expect(refIds).toContain('ar-armure-de-cuir');
    expect(refIds).toContain('gr-sac-derudit');

    const dague = character.equipment.find((e) => e.refId === 'wp-dague');
    const custom = dague?.customData as Record<string, unknown> | undefined;
    expect(custom?.['isWeapon']).toBeTrue();
    expect(custom?.['damage']).toBe('1d4');
  });

  it('JSON round-trip preserves Lettré export fields', () => {
    const original = builder.build();
    const json = JSON.stringify(original);
    const parsed = JSON.parse(json);

    expect(parsed.classes[0].classId).toBe('cls-lettre');
    expect(parsed.proficiencies.weapons).toContain('wp-dague');
    expect(parsed.equipment.some((e: { refId: string }) => e.refId === 'wp-dague')).toBeTrue();
    expect(parsed.personality?.backgroundId).toBe('bg-erudit');
  });

  it('creation state keeps mastered-choice equipment slots for wizard step', () => {
    const c = builder.creation();
    expect(c.startingEquipmentSlots).toEqual(LETTRE_STARTING_SLOTS);

    const masteredAlt = c.startingEquipmentSlots.find((slot) =>
      slot.alternatives?.some((alt) => alt.some((item) => item.id === 'wp-mastered-choice')),
    );
    expect(masteredAlt).toBeTruthy();

    const toolAlt = c.startingEquipmentSlots.find((slot) =>
      slot.alternatives?.some((alt) => alt.some((item) => item.id === 'tl-mastered-choice')),
    );
    expect(toolAlt).toBeTruthy();
  });

  it('exported weapons include all mastered proficiencies chosen in skills step', () => {
    const weapons = builder.build().proficiencies.weapons;
    expect(weapons.filter((id) => id.startsWith('wp-')).length).toBeGreaterThanOrEqual(4);
    expect(weapons).not.toContain('wp-mastered-choice');
    expect(weapons).not.toContain('tl-mastered-choice');
  });
});
