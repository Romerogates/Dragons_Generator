import { grimoireCoordsFromAnchors } from './grimoire-calibration-coords.util';
import { GRIMOIRE_BASE_COORDS } from '@core/config/grimoire-coords.config';

describe('grimoire-calibration-coords.util', () => {
  it('maps circle anchors to grimoire base coords', () => {
    const coords = grimoireCoordsFromAnchors([
      {
        id: 'cantrip-1',
        label: 'Mineur',
        group: 'Mineurs',
        x: 250,
        y: 221,
        sampleText: '',
        fontSize: 10,
        render: 'circle-row',
      },
      {
        id: 'prep-1',
        label: 'Préparé',
        group: 'Tableau',
        x: 76,
        y: 490,
        sampleText: '',
        fontSize: 8,
        render: 'circle',
      },
    ]);

    expect(coords.base.cantripXStart).toBe(250);
    expect(coords.base.cantripY).toBe(221);
    expect(coords.base.colPrepared).toBe(76);
    expect(coords.base.spellTableStartY).toBe(493);
    expect(coords.base.nameX).toBe(GRIMOIRE_BASE_COORDS.nameX);
  });

  it('maps header, table, medallions and cleric panel anchors', () => {
    const coords = grimoireCoordsFromAnchors([
      { id: 'name', label: 'Nom', group: 'En-tête', x: 1, y: 2, sampleText: '', fontSize: 15 },
      { id: 'ability', label: 'Carac', group: 'En-tête', x: 3, y: 4, sampleText: '', fontSize: 10 },
      { id: 'save-dc', label: 'DD', group: 'En-tête', x: 5, y: 6, sampleText: '', fontSize: 12 },
      { id: 'attack-mod', label: 'Atk', group: 'En-tête', x: 7, y: 8, sampleText: '', fontSize: 12 },
      { id: 'slot-1', label: 'Slot', group: 'Emp', x: 9, y: 10, sampleText: '', fontSize: 10 },
      { id: 'spell-name', label: 'Nom', group: 'Tab', x: 11, y: 12, sampleText: '', fontSize: 10 },
      { id: 'effect', label: 'Eff', group: 'Tab', x: 13, y: 14, sampleText: '', fontSize: 7 },
      { id: 'page-ref', label: 'Pg', group: 'Tab', x: 15, y: 16, sampleText: '', fontSize: 7 },
      { id: 'level-0', label: 'M', group: 'Med', x: 17, y: 18, sampleText: '', fontSize: 11 },
      { id: 'deity', label: 'Div', group: 'Pan', x: 19, y: 20, sampleText: '', fontSize: 10 },
      { id: 'focus', label: 'Foc', group: 'Pan', x: 21, y: 22, sampleText: '', fontSize: 9 },
      { id: 'channel', label: 'Ch', group: 'Pan', x: 23, y: 24, sampleText: '', fontSize: 8 },
    ]);

    expect(coords.base.nameX).toBe(1);
    expect(coords.base.abilityX).toBe(3);
    expect(coords.base.saveDCX).toBe(5);
    expect(coords.base.attackModX).toBe(7);
    expect(coords.base.slotXStart).toBe(9);
    expect(coords.base.slotRows[0]?.y).toBe(10);
    expect(coords.base.colName).toBe(11);
    expect(coords.base.spellTableStartY).toBe(12);
    expect(coords.base.colEffect).toBe(13);
    expect(coords.base.colPage).toBe(15);
    expect(coords.spellTableLevel.levelX).toBe(17);
    expect(coords.spellTableLevel.levelYs[0]).toBe(18);
    expect(coords.panelCleric.line1X).toBe(19);
    expect(coords.panelCleric.line2X).toBe(21);
    expect(coords.panelCleric.channelsX).toBe(23);
  });
});
