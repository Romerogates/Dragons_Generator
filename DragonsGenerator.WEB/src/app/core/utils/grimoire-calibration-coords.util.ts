import type { SheetCalibrationAnchor } from '@core/config/sheet-calibration.config';
import type { GrimoireRuntimeCoords } from '@core/services/grimoire-calibration-context.service';
import {
  GRIMOIRE_BASE_COORDS,
  GRIMOIRE_PANEL_CLERIC,
  GRIMOIRE_SPELL_TABLE_LEVEL,
} from '@core/config/grimoire-coords.config';

function anchorMap(anchors: SheetCalibrationAnchor[]): Map<string, SheetCalibrationAnchor> {
  return new Map(anchors.map((a) => [a.id, a]));
}

/** Applique les ancres glissées sur une copie des coords grimoire (aperçu = générateur). */
export function grimoireCoordsFromAnchors(anchors: SheetCalibrationAnchor[]): GrimoireRuntimeCoords {
  const m = anchorMap(anchors);
  const base = { ...GRIMOIRE_BASE_COORDS, slotRows: GRIMOIRE_BASE_COORDS.slotRows.map((r) => ({ ...r })) };
  const spellTableLevel = { ...GRIMOIRE_SPELL_TABLE_LEVEL, levelYs: [...GRIMOIRE_SPELL_TABLE_LEVEL.levelYs] };
  const panelCleric = { ...GRIMOIRE_PANEL_CLERIC };

  const ability = m.get('ability');
  if (ability) {
    base.abilityX = ability.x;
    base.abilityY = ability.y;
  }

  const cantrip = m.get('cantrip-1');
  if (cantrip) {
    base.cantripXStart = cantrip.x;
    base.cantripY = cantrip.y;
  }

  const slot = m.get('slot-1');
  if (slot) {
    base.slotXStart = slot.x;
    if (base.slotRows[0]) base.slotRows[0] = { ...base.slotRows[0], y: slot.y };
  }

  const prep = m.get('prep-1');
  const spellName = m.get('spell-name');
  if (prep) {
    base.colPrepared = prep.x;
    if (!spellName) base.spellTableStartY = prep.y + base.preparedMarkYOffset;
  }
  if (spellName) {
    base.colName = spellName.x;
    base.spellTableStartY = spellName.y;
  }

  const effect = m.get('effect');
  if (effect) base.colEffect = effect.x;

  const pageRef = m.get('page-ref');
  if (pageRef) base.colPage = pageRef.x;

  const saveDc = m.get('save-dc');
  if (saveDc) {
    base.saveDCX = saveDc.x;
    base.saveDCY = saveDc.y;
  }

  const attackMod = m.get('attack-mod');
  if (attackMod) {
    base.attackModX = attackMod.x;
    base.attackModY = attackMod.y;
  }

  const name = m.get('name');
  if (name) {
    base.nameX = name.x;
    base.nameY = name.y;
  }

  for (let i = 0; i < spellTableLevel.levelYs.length; i++) {
    const level = m.get(`level-${i}`);
    if (level) {
      spellTableLevel.levelYs[i] = level.y;
      spellTableLevel.levelX = level.x;
    }
  }

  const deity = m.get('deity');
  if (deity) {
    panelCleric.line1X = deity.x;
    panelCleric.line1Y = deity.y;
  }

  const focus = m.get('focus');
  if (focus) {
    panelCleric.line2X = focus.x;
    panelCleric.line2Y = focus.y;
  }

  const channel = m.get('channel');
  if (channel) {
    panelCleric.channelsX = channel.x;
    panelCleric.channelsStartY = channel.y;
  }

  return { base, spellTableLevel, panelCleric };
}
