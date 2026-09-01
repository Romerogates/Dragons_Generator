import type { SpellcastingKind } from '@core/models/Character/character';
import {
  GRIMOIRE_BASE_COORDS,
  GRIMOIRE_IMAGES,
  GRIMOIRE_PANEL_CLERIC,
  GRIMOIRE_SPELL_TABLE_LEVEL,
  GRIMOIRE_SHEET,
} from './grimoire-coords.config';

export const PDF_SHEET_SIZE = GRIMOIRE_SHEET;

export type SheetAnchorRender = 'text' | 'circle' | 'circle-row';

export interface SheetCalibrationAnchor {
  id: string;
  label: string;
  group: string;
  x: number;
  y: number;
  sampleText: string;
  fontSize: number;
  render?: SheetAnchorRender;
  /** Pour circle-row : nombre de cercles (ex. sorts mineurs = 5). */
  circleCount?: number;
  /** Espacement horizontal entre cercles (px). */
  circleSpacing?: number;
}

export interface SheetCalibrationTemplate {
  id: string;
  title: string;
  imageUrl: string;
  anchors: SheetCalibrationAnchor[];
}

function anchor(
  id: string,
  label: string,
  group: string,
  x: number,
  y: number,
  sampleText: string,
  fontSize = 10,
  render: SheetAnchorRender = 'text',
  circleCount?: number,
  circleSpacing?: number,
): SheetCalibrationAnchor {
  return { id, label, group, x, y, sampleText, fontSize, render, circleCount, circleSpacing };
}

function grimoireClericAnchors(): SheetCalibrationAnchor[] {
  const B = GRIMOIRE_BASE_COORDS;
  const L = GRIMOIRE_SPELL_TABLE_LEVEL;
  const P = GRIMOIRE_PANEL_CLERIC;
  return [
    anchor('name', 'Nom', 'En-tête', B.nameX, B.nameY, 'Test', 15),
    anchor('ability', 'Caractéristique', 'En-tête', B.abilityX, B.abilityY, 'Sagesse', 10),
    anchor('save-dc', 'DD sauvegarde', 'En-tête', B.saveDCX, B.saveDCY, '12', 12),
    anchor('attack-mod', 'Mod. attaque', 'En-tête', B.attackModX, B.attackModY, '+4', 12),
    anchor('cantrip-1', 'Sort mineur 1', 'Mineurs', B.cantripXStart, B.cantripY, '', 10, 'circle-row', 5, B.cantripSpacing),
    anchor('slot-1', 'Emplacement 1', 'Emplacements', B.slotXStart, B.slotRows[0]?.y ?? 255, '', 10, 'circle'),
    anchor('prep-1', 'Préparé', 'Tableau', B.colPrepared, B.spellTableStartY - B.preparedMarkYOffset, '', 8, 'circle'),
    anchor('spell-name', 'Nom sort', 'Tableau', B.colName, B.spellTableStartY, 'Imprécation', 10),
    anchor(
      'effect',
      'Effet',
      'Tableau',
      B.colEffect,
      B.spellTableStartY,
      "V,S · 1 min · Jusqu'à trois créatures…",
      7,
    ),
    anchor('page-ref', 'Page', 'Tableau', B.colPage, B.spellTableStartY, 'p.123', 7),
    ...L.levelYs.map((y, i) =>
      anchor(
        `level-${i}`,
        i === 0 ? 'M' : String(i),
        'Médaillons',
        L.levelX,
        y,
        i === 0 ? 'M' : String(i),
        L.labelFontSize,
      ),
    ),
    anchor('deity', 'Divinité — Domaine', 'Panneau prêtre', P.line1X, P.line1Y, 'Mort — Indicible', 10),
    anchor('focus', 'Focaliseur', 'Panneau prêtre', P.line2X, P.line2Y, 'Amulette (symbole sacré)', 9),
    anchor('channel', 'Conduit divin', 'Panneau prêtre', P.channelsX, P.channelsStartY, 'Renvoi des morts-vivants (1/1)', 8),
  ];
}

const SHEET_PAGE1_ANCHORS: SheetCalibrationAnchor[] = [
  anchor('name', 'Nom', 'Identité', 140, 43, 'Test', 15),
  anchor('species', 'Espèce', 'Identité', 140, 66, 'Gnome (des roches)', 15),
  anchor('civilization', 'Civilisation', 'Identité', 140, 90, 'Cité Franche', 15),
  anchor('class', 'Classe', 'Identité', 400, 43, 'Prêtre (Indicible)', 15),
  anchor('level', 'Niveau', 'Identité', 432, 94, '1', 15),
  anchor('hp-current', 'PV actuels', 'Combat', 230, 123, '8', 15),
  anchor('hp-max', 'PV max', 'Combat', 370, 171, '8', 15),
  anchor('proficiency', 'Maîtrise', 'Combat', 55, 173, '+2', 15),
  anchor('ac', 'CA', 'Combat', 360, 220, '16', 15),
  anchor('initiative', 'Initiative', 'Combat', 270, 220, '+1', 15),
  anchor('passive-perception', 'Perception passive', 'Combat', 520, 220, '14', 15),
  anchor('ability-for', 'FOR', 'Caractéristiques', 118, 225, '10', 15),
  anchor('mod-for', 'Mod FOR', 'Caractéristiques', 160, 228, '+0', 10),
  anchor('ability-sag', 'SAG', 'Caractéristiques', 118, 565, '16', 15),
  anchor('mod-sag', 'Mod SAG', 'Caractéristiques', 165, 570, '+3', 10),
  anchor('attack-name', 'Attaque nom', 'Attaques', 222, 477, "Masse d'armes", 10),
  anchor('attack-bonus', 'Attaque bonus', 'Attaques', 442, 478, '+4', 10),
  anchor('attack-damage', 'Attaque dégâts', 'Attaques', 517, 477, '1d6+2 cont.', 10),
  anchor('walk', 'Marche', 'Déplacements', 232, 359, '7,5', 10),
];

const SHEET_PAGE2_ANCHORS: SheetCalibrationAnchor[] = [
  anchor('armor-1', 'Armure 1', 'Maîtrises', 125, 100, 'Armures légères', 10),
  anchor('weapon-1', 'Arme 1', 'Maîtrises', 125, 148, 'Armes courantes', 10),
  anchor('resistance-1', 'Résistance 1', 'Résistances', 380, 100, 'Vision dans le noir', 10),
  anchor('tool-1', 'Outil 1', 'Outils', 210, 255, "Nécessaire d'alchimiste", 10),
  anchor('language-1', 'Langue 1', 'Langues', 396, 255, 'Cyrillan', 10),
  anchor('feature-name', 'Aptitude nom', 'Aptitudes', 15, 255, 'Artificier', 9),
  anchor('feature-uses', 'Aptitude uses', 'Aptitudes', 170, 255, '∞', 9),
  anchor('spell-slot-1', 'Emplacement sort', 'Magie', 469, 552, '●', 10),
];

const SHEET_PAGE3_ANCHORS: SheetCalibrationAnchor[] = [
  anchor('description', 'Description', 'Personnalité', 38, 72, 'Acolyte du temple…', 10),
  anchor('background-text', 'Historique', 'Personnalité', 37, 137, 'Vous avez passé votre vie…', 10),
  anchor('ideal', 'Idéal', 'Personnalité', 402, 127, 'Charité.', 10),
  anchor('traits', 'Traits', 'Personnalité', 402, 199, 'Je sais trouver un terrain…', 10),
  anchor('alignment', 'Alignement', 'Personnalité', 402, 270, 'Chaotique Bon', 10),
  anchor('bonds', 'Liens', 'Personnalité', 402, 316, 'Je suis prêt à tout…', 10),
  anchor('flaws', 'Défauts', 'Personnalité', 402, 388, "J'accorde trop de confiance…", 10),
  anchor('story', 'Histoire', 'Personnalité', 72, 441, 'Mon histoire commence…', 8),
];

const SHEET_PAGE4_ANCHORS: SheetCalibrationAnchor[] = [
  anchor('equip-1', 'Équipement 1', 'Équipement', 66, 175, 'Amulette (symbole sacré)', 10),
  anchor('equip-2', 'Équipement 2', 'Équipement', 66, 197, "Masse d'armes", 10),
  anchor('equip-extra', 'Équipement extra', 'Équipement', 222, 168, 'Sac de religieux', 10),
  anchor('gold', 'Or', 'Monnaie', 71, 486, '15 po', 10),
  anchor('silver', 'Argent', 'Monnaie', 71, 507, '0 pa', 10),
  anchor('copper', 'Cuivre', 'Monnaie', 70, 531, '0 pc', 10),
  anchor('weight', 'Poids', 'Charge', 413, 245, '112,5 kg', 10),
];

export const SHEET_CALIBRATION_TEMPLATES: SheetCalibrationTemplate[] = [
  {
    id: 'sheet-page1',
    title: 'Fiche — Page 1 (Stats & combat)',
    imageUrl: '/images/sheets/sheet-page1.jpg',
    anchors: SHEET_PAGE1_ANCHORS,
  },
  {
    id: 'sheet-page2',
    title: 'Fiche — Page 2 (Aptitudes)',
    imageUrl: '/images/sheets/sheet-page2.jpg',
    anchors: SHEET_PAGE2_ANCHORS,
  },
  {
    id: 'sheet-page3',
    title: 'Fiche — Page 3 (Personnalité)',
    imageUrl: '/images/sheets/sheet-page3.jpg',
    anchors: SHEET_PAGE3_ANCHORS,
  },
  {
    id: 'sheet-page4',
    title: 'Fiche — Page 4 (Équipement)',
    imageUrl: '/images/sheets/sheet-page4.jpg',
    anchors: SHEET_PAGE4_ANCHORS,
  },
  {
    id: 'grimoire-cleric',
    title: 'Grimoire — Prêtre',
    imageUrl: GRIMOIRE_IMAGES.cleric,
    anchors: grimoireClericAnchors(),
  },
];

export function getSheetCalibrationTemplate(sheetId: string): SheetCalibrationTemplate | undefined {
  return SHEET_CALIBRATION_TEMPLATES.find((t) => t.id === sheetId);
}

export function resolveSheetCalibrationId(raw: string): string {
  if (raw === 'cleric') return 'grimoire-cleric';
  return raw;
}

export function grimoireKindFromSheetId(sheetId: string): SpellcastingKind | null {
  const kind = sheetId.replace(/^grimoire-/, '') as SpellcastingKind;
  return kind in GRIMOIRE_IMAGES ? kind : null;
}

export interface SheetCalibrationExport {
  version: 1;
  exportedAt: string;
  sheets: Record<string, { anchors: SheetCalibrationAnchor[] }>;
}

export function buildCalibrationExport(
  overrides: Record<string, SheetCalibrationAnchor[]>,
): SheetCalibrationExport {
  const sheets: Record<string, { anchors: SheetCalibrationAnchor[] }> = {};
  for (const template of SHEET_CALIBRATION_TEMPLATES) {
    sheets[template.id] = {
      anchors: overrides[template.id] ?? template.anchors.map((a) => ({ ...a })),
    };
  }
  return { version: 1, exportedAt: new Date().toISOString(), sheets };
}
