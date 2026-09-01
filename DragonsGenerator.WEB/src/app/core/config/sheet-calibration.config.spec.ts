import {
  buildCalibrationExport,
  getSheetCalibrationTemplate,
  grimoireKindFromSheetId,
  resolveSheetCalibrationId,
} from './sheet-calibration.config';
import { mergeAnchors } from '@core/services/sheet-calibration.storage';

describe('sheet-calibration.config', () => {
  it('resolveSheetCalibrationId maps cleric alias', () => {
    expect(resolveSheetCalibrationId('cleric')).toBe('grimoire-cleric');
    expect(resolveSheetCalibrationId('sheet-page1')).toBe('sheet-page1');
  });

  it('getSheetCalibrationTemplate finds and misses', () => {
    expect(getSheetCalibrationTemplate('sheet-page1')?.id).toBe('sheet-page1');
    expect(getSheetCalibrationTemplate('unknown')).toBeUndefined();
  });

  it('grimoireKindFromSheetId resolves cleric', () => {
    expect(grimoireKindFromSheetId('grimoire-cleric')).toBe('cleric');
    expect(grimoireKindFromSheetId('sheet-page1')).toBeNull();
  });

  it('buildCalibrationExport includes every template', () => {
    const exp = buildCalibrationExport({});
    expect(exp.version).toBe(1);
    expect(exp.sheets['sheet-page1']?.anchors.length).toBeGreaterThan(0);
    expect(exp.sheets['grimoire-cleric']?.anchors.length).toBeGreaterThan(0);
  });

  it('buildCalibrationExport merges overrides', () => {
    const overrides = {
      'sheet-page1': [
        {
          id: 'name',
          label: 'Nom',
          group: 'Identité',
          x: 99,
          y: 88,
          sampleText: 'Override',
          fontSize: 14,
        },
      ],
    };
    const exp = buildCalibrationExport(overrides);
    expect(exp.sheets['sheet-page1']?.anchors[0]?.x).toBe(99);
  });
});

describe('sheet-calibration.config merge helper', () => {
  it('mergeAnchors prefers saved positions and text', () => {
    const defaults = [
      {
        id: 'a',
        label: 'A',
        group: 'G',
        x: 1,
        y: 2,
        sampleText: 'old',
        fontSize: 10,
      },
    ];
    const saved = [{ ...defaults[0], x: 99, sampleText: 'new' }];
    const merged = mergeAnchors(defaults, saved);
    expect(merged[0].x).toBe(99);
    expect(merged[0].sampleText).toBe('new');
  });
});
