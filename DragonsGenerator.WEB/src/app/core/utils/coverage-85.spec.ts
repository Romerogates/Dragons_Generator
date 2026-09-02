import {
  extractPactSlotsFromResources,
  extractScalarResources,
  extractSpellSlotsFromResources,
  maxSpellLevelFromSlots,
  resolveFeatureUses,
} from './feature-uses.util';
import { annotateAuraDesc } from './aura-range.util';
import {
  formatCharacterExportErrors,
  validateCharacterExport,
} from './character-export-validation.util';
import { formatCharacterCloudLoadError } from './character-cloud-sync.util';
import { formatOfflineSyncError, offlineSyncItemLabel } from './offline-sync-error.util';
import { HttpErrorResponse } from '@angular/common/http';
import { CURRENT_SCHEMA_VERSION, type Character } from '@core/models/Character/character';
import { listSubclassOptions } from './character-class-features.util';
import {
  formatCharacterCloudListError,
  formatCharacterCloudSyncSummary,
} from './character-cloud-sync.util';
import {
  activityDetail,
  activityLabel,
  relativeActivityTime,
} from '../../features/campaigns/campaign-detail/campaign-activity.util';
import type { CampaignActivityItem } from '@core/services/campaign-cloud.service';
import { labelForGameId, labelForItemRef, registerGameLabel, formatGameIds } from './game-id-labels';
import { resolveApiAssetUrl } from './api-url.util';
import { relationshipStatusLabel } from './friends-search.util';
import {
  campaignRegionFields,
  campaignRegionFromData,
  storyLocationContext,
  storyRegionLabel,
} from './story-location.util';
import { splitEffectForGrimoire, buildGrimoireEffectSummary } from './spell-grimoire-effect.util';
import type { Spell } from '@core/models/Spells/spell';
import { renderLightMarkdown } from './light-markdown.util';
import { createActiveCombat, createCombatHistoryEntry } from './combat-tracker.util';

describe('coverage 85 — feature-uses.util branches', () => {
  const cls = {
    data: {
      progression: [
        { level: 5, resources: { rage: 3, ki_points: 5, channel_divinity: 1 } },
        { level: 10, resources: { spell_slots: { '1': 4, '2': 2 } } },
      ],
    },
  };

  it('extracts spell slots and pact slots', () => {
    expect(extractSpellSlotsFromResources(undefined)).toEqual([]);
    expect(extractSpellSlotsFromResources({ spell_slots: [] as unknown as object })).toEqual([]);
    expect(
      extractSpellSlotsFromResources({ spell_slots: { '0': 1, '1': 2, 'x': 3 } }),
    ).toEqual([{ level: 1, max: 2 }]);
    expect(maxSpellLevelFromSlots([])).toBe(0);
    expect(extractPactSlotsFromResources({ pact_slots_count: 2, pact_slot_level: 3 })).toEqual([
      { level: 3, max: 2 },
    ]);
    expect(extractPactSlotsFromResources({})).toEqual([]);
  });

  it('resolveFeatureUses covers recharge and formula branches', () => {
    expect(resolveFeatureUses({ recharge: 'passive' }, cls, 5)).toBeUndefined();

    const shortRest = resolveFeatureUses({ recharge: 'short_rest', uses: 2 }, cls, 5);
    expect(shortRest?.recharge).toBe('short_rest');

    const atWill = resolveFeatureUses({ recharge: 'at_will', uses: 1 }, cls, 5);
    expect(atWill?.recharge).toBe('unlimited');

    const baseUp = resolveFeatureUses(
      { recharge: 'long_rest', uses: { base: 1, upgrades: [{ at_level: 5, value: 2 }] } },
      cls,
      5,
    );
    expect(baseUp?.max).toBe(2);

    const perDay = resolveFeatureUses({ recharge: 'long_rest', uses: { per_day: 3 } }, cls, 5);
    expect(perDay?.max).toBe(3);

    const perRest = resolveFeatureUses({ recharge: 'long_rest', uses: { per_rest: 4 } }, cls, 5);
    expect(perRest?.max).toBe(4);

    const numericFormula = resolveFeatureUses(
      { recharge: 'long_rest', uses: { formula: '3' } },
      cls,
      5,
    );
    expect(numericFormula?.max).toBe(3);

    const tableFormula = resolveFeatureUses(
      { recharge: 'long_rest', uses: { formula: 'table:rage' } },
      cls,
      5,
    );
    expect(tableFormula?.max).toBe(3);

    const monkLevel = resolveFeatureUses(
      { recharge: 'short_rest', uses: { formula: 'monk_level' } },
      cls,
      5,
    );
    expect(monkLevel?.max).toBe(5);

    const paladinPool = resolveFeatureUses(
      { recharge: 'long_rest', uses: { formula: 'paladin_level*5' } },
      cls,
      5,
    );
    expect(paladinPool?.max).toBe(25);

    const specialRecharge = resolveFeatureUses(
      { rechargeType: 'special', uses: 1 },
      cls,
      5,
    );
    expect(specialRecharge?.recharge).toBe('long_rest');
  });

  it('resolveFeatureUses covers ki and conduit mechanics', () => {
    const ki = resolveFeatureUses({ id: 'feat-ki', recharge: 'short_rest' }, cls, 5);
    expect(ki?.max).toBe(5);

    const conduit = resolveFeatureUses(
      {
        recharge: 'long_rest',
        mechanics: { uses_key: 'channel_divinity', upgrades: [{ at_level: 6, uses: 2 }] },
      },
      cls,
      6,
    );
    expect(conduit?.max).toBeGreaterThan(0);

    const classLevelPoints = resolveFeatureUses(
      { recharge: 'short_rest', mechanics: { points_formula: 'class_level' } },
      cls,
      5,
    );
    expect(classLevelPoints?.max).toBe(5);

    expect(extractScalarResources({ nested: { x: 1 }, ok: 2 })).toEqual({ ok: 2 });

    const badString = resolveFeatureUses(
      { recharge: 'long_rest', uses: { source_column: 'missing', null_means_unlimited: false } },
      { data: { progression: [{ level: 5, resources: { missing: 'nope' } }] } },
      5,
    );
    expect(badString?.max).toBe(0);
  });
});

describe('coverage 85 — aura-range.util branches', () => {
  it('appends aura tag when missing from desc', () => {
    expect(
      annotateAuraDesc({ mechanics: { range_m_initial: 3 } }, 5),
    ).toBe("Portée d'aura : 3 m.");
    expect(
      annotateAuraDesc(
        { desc: 'Aura sacrée.', mechanics: { range_m_initial: 3, range_m_improved: 9, range_improves_at_level: 18 } },
        5,
      ),
    ).toContain('Aura sacrée.');
    expect(
      annotateAuraDesc(
        { desc: 'Aura.', mechanics: { range_m_initial: 3, range_m_improved: NaN } },
        20,
      ),
    ).toContain('3 m');
  });
});

describe('coverage 85 — character-export-validation branches', () => {
  const base = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: 'Hero',
    species: { id: 'sp-humain', label: 'Humain' },
    classes: [{ classId: 'cls-guerrier', classLabel: 'Guerrier', level: 1, hitDie: 10 }],
    totalLevel: 1,
    proficiencies: { weapons: ['wp-epee-longue'], tools: [], armor: [], languages: [] },
    equipment: [],
  } as unknown as Character;

  it('collects structural validation errors', () => {
    expect(validateCharacterExport({ ...base, schemaVersion: 0 } as Character).valid).toBeFalse();
    expect(validateCharacterExport({ ...base, name: '  ' } as Character).errors).toContain(
      'Le personnage doit avoir un nom.',
    );
    expect(validateCharacterExport({ ...base, classes: [] } as unknown as Character).valid).toBeFalse();
    expect(
      validateCharacterExport({
        ...base,
        classes: [{ classId: ' ', classLabel: 'X', level: 1, hitDie: 8 }],
      } as unknown as Character).valid,
    ).toBeFalse();
    expect(
      validateCharacterExport({ ...base, species: { id: '', label: '' } } as Character).valid,
    ).toBeFalse();
    expect(validateCharacterExport({ ...base, totalLevel: 0 } as Character).valid).toBeFalse();
  });

  it('rejects unresolved tools and blank equipment refs', () => {
    const toolBroken = {
      ...base,
      proficiencies: { ...base.proficiencies, tools: ['tool-any'] },
    } as unknown as Character;
    expect(validateCharacterExport(toolBroken).errors.some((e) => e.includes('outil'))).toBeTrue();

    const eqBroken = {
      ...base,
      equipment: [{ refId: '  ', name: 'Objet', qty: 1 }],
    } as unknown as Character;
    expect(validateCharacterExport(eqBroken).errors.some((e) => e.includes('référence'))).toBeTrue();
  });

  it('formats zero or one export errors', () => {
    expect(formatCharacterExportErrors([])).toBe('');
    expect(formatCharacterExportErrors(['Nom manquant.'])).toBe('Nom manquant.');
  });
});

describe('coverage 85 — cloud/offline error branches', () => {
  it('covers remaining HTTP status branches', () => {
    expect(formatCharacterCloudLoadError('A', new HttpErrorResponse({ status: 403 }))).toContain(
      'session expirée',
    );
    expect(
      formatCharacterCloudLoadError('A', new HttpErrorResponse({ status: 422, error: { message: 'X' } })),
    ).toContain('X');
    expect(
      formatOfflineSyncError({ type: 'campaign-create', title: 'C' }, new HttpErrorResponse({ status: 404 })),
    ).toContain('404');
    expect(offlineSyncItemLabel({ type: 'campaign-create', title: undefined })).toContain('sans titre');
  });
});

describe('coverage 85 — light-markdown branches', () => {
  it('renders h1, h3, underscore bold and blank lines', () => {
    const html = renderLightMarkdown('# H1\n\n### H3\n\n__bold__\n\n\npara');
    expect(html).toContain('H1');
    expect(html).toContain('H3');
    expect(html).toContain('<strong');
    expect(html).toContain('para');
    expect(renderLightMarkdown('   ')).toBe('');
  });
});

describe('coverage 85 — feature-uses extra branches', () => {
  it('covers sorcerer formula and unresolved passive ki path', () => {
    const cls = { data: { progression: [{ level: 7, resources: { ki_points: '7' } }] } };
    const sorc = resolveFeatureUses(
      { recharge: 'long_rest', uses: { formula: 'sorcerer_level' } },
      cls,
      7,
    );
    expect(sorc?.max).toBe(7);

    const kiOnly = resolveFeatureUses({ id: 'feat-ki' }, cls, 7);
    expect(kiOnly?.max).toBe(7);
  });
});

describe('coverage 85 — listSubclassOptions', () => {
  it('normalizes array and catalog shapes', () => {
    expect(listSubclassOptions({ subclasses: [{ id: 'a', name: 'A' }] } as never).length).toBe(1);
    expect(
      listSubclassOptions({ subclasses: { options: [{ id: 'b', name: 'B' }] } } as never).length,
    ).toBe(1);
    expect(listSubclassOptions({} as never)).toEqual([]);
  });
});

describe('coverage 85 — misc util branches', () => {
  it('covers cloud list/sync, game labels, api url and combat history', () => {
    expect(formatCharacterCloudListError(new HttpErrorResponse({ status: 500 }))).toContain('500');
    expect(formatCharacterCloudListError(new Error('x'))).toContain('Impossible de lister');
    expect(formatCharacterCloudSyncSummary(['A', 'B'])).toContain("2 personnages");

    registerGameLabel('ski-perception', 'Perception API');
    expect(labelForGameId('ski-perception')).toBe('Perception API');

    expect(resolveApiAssetUrl('http://x/y')).toBe('http://x/y');
    expect(relationshipStatusLabel('blocked' as never)).toBeNull();

    const history = createCombatHistoryEntry(createActiveCombat([], { label: 'Test' }));
    expect(history.label).toBe('Test');
  });
});

describe('coverage 85 — story-location branches', () => {
  it('handles null/empty region and setting combinations', () => {
    expect(storyRegionLabel(null)).toBe('');
    expect(storyLocationContext(null, '  ')).toBeNull();
    expect(storyLocationContext(null, 'forêt')).toBe('forêt');
    expect(campaignRegionFromData('civ-x', '  ')).toBeNull();
    expect(campaignRegionFields({ kind: 'civilization', id: 'civ-a', name: 'Ajagar' })).toEqual({
      regionId: 'civ-a',
      regionName: 'Ajagar',
    });
    expect(campaignRegionFields(null)).toEqual({ regionId: null, regionName: '' });
  });
});

describe('coverage 85 — spell-grimoire and export edge cases', () => {
  it('covers material truncation and single-part split', () => {
    const spell = {
      id: 'spl-x',
      name: 'X',
      level: 1,
      school: 'evocation',
      castingTime: { amount: 1, unit: 'action' },
      range: { amount: 9, unit: 'm' },
      duration: { amount: null, unit: 'instantane' },
      components: { v: true, s: true, m: 'Poudre de diamant très rare et coûteuse' },
      isRitual: false,
      isConcentration: false,
      isCorrupted: false,
      description: '',
      modularOptions: [],
      classes: [],
    } as Spell;
    expect(buildGrimoireEffectSummary(spell)).toContain('…');
    expect(splitEffectForGrimoire('Seule ligne').body).toBe('Seule ligne');
  });

  it('accepts resolved tool category proficiencies on export', () => {
    const ok = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      name: 'Barde',
      species: { id: 'spc-humain', label: 'Humain' },
      classes: [{ classId: 'cls-barde', classLabel: 'Barde', level: 1, hitDie: 8 }],
      totalLevel: 1,
      proficiencies: {
        weapons: ['wp-dague'],
        tools: ['category-musical-instruments'],
        armor: [],
        languages: [],
      },
      equipment: [],
    } as unknown as Character;
    expect(validateCharacterExport(ok).valid).toBeTrue();
  });

  it('rejects unresolved weapon placeholders on export', () => {
    const broken = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      name: 'Hero',
      species: { id: 'sp-humain', label: 'Humain' },
      classes: [{ classId: 'cls-guerrier', classLabel: 'Guerrier', level: 1, hitDie: 10 }],
      totalLevel: 1,
      proficiencies: { weapons: ['wp-cat-unknown'], tools: [], armor: [], languages: [] },
      equipment: [],
    } as unknown as Character;
    expect(validateCharacterExport(broken).valid).toBeFalse();
  });
});

describe('coverage 85 — activity and label branches', () => {
  const item = (partial: Partial<CampaignActivityItem> & Pick<CampaignActivityItem, 'kind'>): CampaignActivityItem => ({
    id: 'a1',
    actorUserId: 'u1',
    actorDisplayName: 'MJ',
    createdAt: new Date().toISOString(),
    payloadJson: '',
    ...partial,
  });

  it('formats relative times and activity payloads', () => {
    const now = Date.now();
    expect(relativeActivityTime(new Date(now - 7200_000).toISOString())).toContain(' h');
    expect(relativeActivityTime(new Date(now - 172_800_000).toISOString())).toContain(' j');
    expect(relativeActivityTime(new Date(now - 86400 * 10 * 1000).toISOString())).toMatch(/\d/);

    expect(activityLabel('member_joined')).toBe('Joueur rejoint');
    expect(activityDetail(item({ kind: 'character_proposed', payloadJson: '{"characterName":"Elara"}' }))).toBe(
      'Elara',
    );
    expect(activityDetail(item({ kind: 'session_scheduled', payloadJson: '{"title":"S1"}' }))).toBe('S1');
    expect(activityDetail(item({ kind: 'xp_awarded', payloadJson: '{}' }))).toBeNull();
  });

  it('covers category filters and item refs', () => {
    expect(labelForGameId('category-tools')).toContain('Outil');
    expect(labelForGameId('eq-unknown-widget-x2')).toBeTruthy();
    expect(labelForGameId('skill-survie')).toBe('Survie');
    registerGameLabel('skill-custom-cov-id', 'Ath API');
    expect(labelForGameId('ski-custom-cov-id')).toBe('Ath API');
    expect(formatGameIds(['ar-light', 'ar-shield'], ' · ')).toContain(' · ');
    expect(labelForItemRef('wp-dague')).toBe('Dague');
    expect(labelForItemRef({ id: 'wp-dague', qty: 1 })).toBe('Dague');
    expect(
      formatCharacterCloudListError(
        new HttpErrorResponse({ status: 422, error: { errors: [{ reason: 'Quota' }] } }),
      ),
    ).toContain('Quota');
    expect(
      formatOfflineSyncError(
        { type: 'character-save', name: 'Hero' },
        new HttpErrorResponse({
          status: 400,
          error: { errors: { name: ['Invalid'] } },
        }),
      ),
    ).toContain('400');
  });
});
