/** Fonds fiche : 595 × 842 px → A4 210 × 297 mm. */
export const SHEET_SCALE_X = 210 / 595;
export const SHEET_SCALE_Y = 297 / 842;

export function sheetPxToMmX(px: number): number {
  return px * SHEET_SCALE_X;
}
export function sheetPxToMmY(px: number): number {
  return px * SHEET_SCALE_Y;
}

/** Grimoire martial (Guerrier / Rôdeur / Paladin). */
export const GRP_COORDS = {
  nameX: 150,
  nameY: 300,
  rodeurCheckX: 665,
  rodeurCheckY: 300,
  paladinCheckX: 665,
  paladinCheckY: 330,
  guerrierCheckX: 665,
  guerrierCheckY: 360,
  saveDCX: 470,
  saveDCY: 340,
  attackModX: 545,
  attackModY: 340,
  rodeurSortsConnusX: 100,
  rodeurSortsConnusY: 205,
  rodeurFocaliseurX: 70,
  rodeurFocaliseurY: 420,
  paladinSermentX: 310,
  paladinSermentY: 185,
  paladinOathSpellsX: 310,
  paladinOathSpellsYs: [432, 457, 482, 507, 532],
  guerrierArmeSoeurX: 195,
  guerrierArmeSoeurY: 575,
  guerrierIntX: 175,
  guerrierIntY: 610,
  guerrierSagX: 175,
  guerrierSagY: 635,
  guerrierChaX: 175,
  guerrierChaY: 660,
  guerrierMagicIntCheckX: 180,
  guerrierMagicIntCheckY: 718,
  guerrierMagicChaCheckX: 180,
  guerrierMagicChaCheckY: 738,
  guerrierSaveDCX: 520,
  guerrierSaveDCY: 725,
  guerrierAttackModX: 520,
  guerrierAttackModY: 785,
};

/** Page 2 — aptitudes. */
export const PAGE2 = {
  armorX: 125,
  armorYs: [100, 124],
  weaponX: 125,
  weaponYs: [148, 172],
  profMaxWidth: 230,
  profFontSize: 11,
  profMinFontSize: 7,
  resX: 380,
  resYs: [100, 124, 148, 172, 194],
  toolX: 210,
  langX: 396,
  middleYs: [255, 277, 299, 320, 342, 364, 386, 408, 430, 452],
  unlimitedNameX: 15,
  unlimitedUsesX: 170,
  unlimitedStartY: 255,
  unlimitedLineH: 22,
  unlimitedMaxLines: 10,
  shortRestNameX: 20,
  shortRestUsesX: 210,
  shortRestStartY: 525,
  shortRestLineH: 22,
  shortRestMaxLines: 4,
  shortRestCol2NameX: 205,
  shortRestCol2UsesX: 360,
  longRestNameX: 20,
  longRestUsesX: 210,
  longRestStartY: 670,
  longRestLineH: 22,
  longRestMaxLines: 6,
  longRestCol2NameX: 204,
  longRestCol2UsesX: 360,
  spellSlotX: 473,
  spellSlotStartY: 550,
  spellSlotRowH: 22,
  spellSlotCircleSpacing: 15,
  spellSlotMaxPerRow: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};
