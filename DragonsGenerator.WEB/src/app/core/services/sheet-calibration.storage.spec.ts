import {
  clearCalibrationOverrides,
  loadCalibrationOverrides,
  mergeAnchors,
  saveCalibrationOverrides,
} from './sheet-calibration.storage';

describe('sheet-calibration.storage', () => {
  beforeEach(() => {
    clearCalibrationOverrides();
  });

  it('loadCalibrationOverrides returns empty when missing', () => {
    expect(loadCalibrationOverrides()).toEqual({});
  });

  it('loadCalibrationOverrides returns empty on invalid json', () => {
    localStorage.setItem('dragons-pdf-calibration-v1', '{bad');
    expect(loadCalibrationOverrides()).toEqual({});
  });

  it('save and load roundtrip', () => {
    const data = {
      'sheet-page1': [
        {
          id: 'name',
          label: 'Nom',
          group: 'Identité',
          x: 1,
          y: 2,
          sampleText: 'X',
          fontSize: 12,
        },
      ],
    };
    saveCalibrationOverrides(data);
    expect(loadCalibrationOverrides()).toEqual(data);
  });

  it('mergeAnchors uses defaults when saved is empty', () => {
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
    expect(mergeAnchors(defaults, [])).toEqual(defaults);
    expect(mergeAnchors(defaults, undefined)).toEqual(defaults);
  });

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
