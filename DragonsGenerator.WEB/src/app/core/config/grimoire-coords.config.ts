import type { SpellcastingKind } from '@core/models/Character/character';

/** Espace pixel des fonds grimoire (595 × 842, identique aux JPG). */
export const GRIMOIRE_SHEET = { width: 595, height: 842 } as const;

export interface GrimoireBaseCoords {
  nameX: number;
  nameY: number;
  abilityX: number;
  abilityY: number;
  saveDCX: number;
  saveDCY: number;
  attackModX: number;
  attackModY: number;
  cantripY: number;
  cantripXStart: number;
  cantripSpacing: number;
  slotXStart: number;
  slotSpacing: number;
  slotRows: { y: number; maxCircles: number }[];
  spellTableStartY: number;
  spellTableRowH: number;
  spellTableMaxRows: number;
  colPrepared: number;
  /** Décalage vertical (px) du point « préparé » sous la baseline de ligne. */
  preparedMarkYOffset: number;
  colName: number;
  colEffect: number;
  colPage: number;
}

/** Coordonnées communes (côté gauche + tableau de sorts). */
export const GRIMOIRE_BASE_COORDS: GrimoireBaseCoords = {
  nameX: 130,
  nameY: 160,
  abilityX: 94,
  abilityY: 241,
  saveDCX: 102,
  saveDCY: 327,
  attackModX: 104,
  attackModY: 410,
  cantripY: 220,
  cantripXStart: 260,
  cantripSpacing: 15,
  slotXStart: 261,
  slotSpacing: 15,
  slotRows: [
    { y: 255, maxCircles: 4 },
    { y: 250, maxCircles: 3 },
    { y: 274, maxCircles: 3 },
    { y: 296, maxCircles: 3 },
    { y: 318, maxCircles: 3 },
    { y: 340, maxCircles: 2 },
    { y: 362, maxCircles: 2 },
    { y: 384, maxCircles: 1 },
    { y: 406, maxCircles: 1 },
  ],
  spellTableStartY: 491,
  spellTableRowH: 22.5,
  /** 3 bandes × 5 lignes = 15 (comme grimoire-pretre.jpg). */
  spellTableMaxRows: 15,
  colPrepared: 80,
  preparedMarkYOffset: 3,
  colName: 103,
  colEffect: 276,
  colPage: 530,
};

/** Médaillons « Niveau » (ouroboros) — calibrés sur grimoire-pretre.jpg. */
export const GRIMOIRE_SPELL_TABLE_LEVEL = {
  levelX: 41,
  levelYs: [512, 626, 740],
  rowsPerBand: 5,
  labelFontSize: 11,
  labelBaselineFactor: 0.18,
};

export const GRIMOIRE_PANEL_CLERIC = {
  line1X: 447,
  line1Y: 259,
  line2X: 438,
  line2Y: 307,
  channelsStartY: 385,
  channelsSpacing: 22,
  channelsX: 432,
  valueFontSize: 10,
  focusFontSize: 9,
};

export const GRIMOIRE_PANEL_BARD = {
  line1X: 450,
  line1Y: 255,
  line2X: 450,
  line2Y: 310,
};

export const GRIMOIRE_PANEL_WIZARD = {
  line1X: 450,
  line1Y: 250,
  line2X: 450,
  line2Y: 305,
};

export const GRIMOIRE_PANEL_DRUID = {
  line1X: 450,
  line1Y: 245,
  line2X: 435,
  line2Y: 268,
  circleSpellsCheckX: 443,
  circleSpellsCheckY: 345,
  mysticTranceCheckX: 443,
  mysticTranceCheckY: 368,
  notesX: 440,
  notesStartY: 410,
  notesSpacing: 22,
};

export const GRIMOIRE_PANEL_WARLOCK = {
  line1X: 448,
  line1Y: 248,
  line2X: 448,
  line2Y: 272,
  line3X: 448,
  line3Y: 296,
  invocationsX: 448,
  invocationsStartY: 378,
  invocationsSpacing: 18,
};

export const GRIMOIRE_PANEL_SORCERER = {
  line1X: 450,
  line1Y: 245,
  line2X: 435,
  line2Y: 280,
  pointsLabelX: 440,
  pointsValueX: 530,
  pointsY: 350,
  metamagicX: 440,
  metamagicStartY: 395,
  metamagicSpacing: 22,
};

export const GRIMOIRE_IMAGES: Record<SpellcastingKind, string> = {
  wizard: '/images/sheets/grimoires/grimoire-mage.jpg',
  sorcerer: '/images/sheets/grimoires/grimoire-ensorceleur.jpg',
  warlock: '/images/sheets/grimoires/grimoire-sorcier.jpg',
  cleric: '/images/sheets/grimoires/grimoire-pretre.jpg',
  druid: '/images/sheets/grimoires/grimoire-druide.jpg',
  bard: '/images/sheets/grimoires/grimoire-barde.jpg',
  ranger: '/images/sheets/grimoires/grimoire-guerrier-rodeur-paladin.jpg',
  paladin: '/images/sheets/grimoires/grimoire-guerrier-rodeur-paladin.jpg',
  fighter_eldritch_knight: '/images/sheets/grimoires/grimoire-guerrier-rodeur-paladin.jpg',
};

export const GRIMOIRE_SUPP_IMAGE = '/images/sheets/grimoires/grimoire-supp.jpg';

export interface GrimoireCalibrationPoint {
  id: string;
  label: string;
  x: number;
  y: number;
  group: string;
}

/** Points de référence exportés sur le PDF de calibration. */
export function listGrimoireCalibrationPoints(
  kind: SpellcastingKind = 'cleric',
): GrimoireCalibrationPoint[] {
  const B = GRIMOIRE_BASE_COORDS;
  const L = GRIMOIRE_SPELL_TABLE_LEVEL;
  const points: GrimoireCalibrationPoint[] = [
    { id: 'name', label: 'Nom', x: B.nameX, y: B.nameY, group: 'En-tête' },
    { id: 'ability', label: 'Caract.', x: B.abilityX, y: B.abilityY, group: 'En-tête' },
    { id: 'save-dc', label: 'DD', x: B.saveDCX, y: B.saveDCY, group: 'En-tête' },
    { id: 'attack', label: 'Mod atk', x: B.attackModX, y: B.attackModY, group: 'En-tête' },
    { id: 'cantrip-0', label: 'Mineur 1', x: B.cantripXStart, y: B.cantripY, group: 'Mineurs' },
    {
      id: 'slot-1',
      label: 'Empl. 1',
      x: B.slotXStart,
      y: B.slotRows[0]?.y ?? 0,
      group: 'Emplacements',
    },
    { id: 'prep-0', label: 'Préparé', x: B.colPrepared, y: B.spellTableStartY, group: 'Tableau' },
    { id: 'spell-name-0', label: 'Nom sort', x: B.colName, y: B.spellTableStartY, group: 'Tableau' },
    { id: 'effect-0', label: 'Effet', x: B.colEffect, y: B.spellTableStartY, group: 'Tableau' },
    { id: 'page-0', label: 'Page', x: B.colPage, y: B.spellTableStartY, group: 'Tableau' },
  ];

  L.levelYs.forEach((y, i) => {
    points.push({
      id: `level-${i}`,
      label: i === 0 ? 'M' : String(i),
      x: L.levelX,
      y,
      group: 'Médaillons',
    });
  });

  for (let row = 1; row < 3; row++) {
    const y = B.spellTableStartY + row * B.spellTableRowH;
    points.push({
      id: `effect-${row}`,
      label: `Effet L${row + 1}`,
      x: B.colEffect,
      y,
      group: 'Tableau',
    });
  }

  if (kind === 'cleric') {
    const P = GRIMOIRE_PANEL_CLERIC;
    points.push(
      { id: 'deity', label: 'Divinité', x: P.line1X, y: P.line1Y, group: 'Panneau prêtre' },
      { id: 'focus', label: 'Focaliseur', x: P.line2X, y: P.line2Y, group: 'Panneau prêtre' },
      {
        id: 'channel-0',
        label: 'Conduit',
        x: P.channelsX,
        y: P.channelsStartY,
        group: 'Panneau prêtre',
      },
    );
  }

  return points;
}
