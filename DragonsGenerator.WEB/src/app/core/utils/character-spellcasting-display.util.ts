import type { CharacterSpellcasting } from '@core/models/Character/character';
import { labelForGameId } from './game-id-labels';

/** Lignes affichables pour la fiche web / résumé (alignées sur le panneau PDF). */
export function spellcastingDisplayLines(sc: CharacterSpellcasting | null | undefined): string[] {
  if (!sc) return [];
  const lines: string[] = [];
  switch (sc.kind) {
    case 'sorcerer':
      if (sc.atavism) lines.push(`Atavisme : ${sc.atavism}`);
      if (sc.metamagic?.length) lines.push(`Métamagie : ${sc.metamagic.join(', ')}`);
      if (sc.sorceryPoints?.max) lines.push(`Points arcaniques : ${sc.sorceryPoints.max}`);
      break;
    case 'warlock':
      if (sc.patron) lines.push(`Suzerain : ${sc.patron}`);
      if (sc.pact) lines.push(`Pacte : ${sc.pact}`);
      if (sc.eldritchInvocations?.length)
        lines.push(`Invocations : ${sc.eldritchInvocations.join(', ')}`);
      if (sc.mysticArcanum?.length)
        lines.push(
          `Arcanes : ${sc.mysticArcanum.map((a) => `${a.spellName} (niv.${a.spellLevel})`).join(', ')}`,
        );
      break;
    case 'wizard':
      if (sc.arcaneTradition) lines.push(`Tradition : ${sc.arcaneTradition}`);
      if (sc.spellMastery?.length)
        lines.push(
          `Maîtrise des sorts : ${sc.spellMastery.map((m) => `${m.spellName} (niv.${m.spellLevel})`).join(', ')}`,
        );
      if (sc.signatureSpells?.length)
        lines.push(`Sorts attitrés : ${sc.signatureSpells.map((s) => s.spellName).join(', ')}`);
      break;
    case 'cleric':
      if (sc.deity || sc.domain) lines.push([sc.deity, sc.domain].filter(Boolean).join(' — '));
      if (sc.divineChannels?.length)
        lines.push(`Conduits : ${sc.divineChannels.map((ch) => ch.name).join(', ')}`);
      break;
    case 'paladin':
      if (sc.oath) lines.push(`Serment : ${sc.oath}`);
      if (sc.oathSpells?.length)
        lines.push(`Sorts de serment : ${sc.oathSpells.flatMap((o) => o.spells).join(', ')}`);
      break;
    case 'druid':
      if (sc.druidCircle) lines.push(`Cercle : ${sc.druidCircle}`);
      if (sc.circleSpells?.length) lines.push(`Sorts de cercle : ${sc.circleSpells.join(', ')}`);
      if (sc.mysticTranceAvailable) lines.push('Transe mystique disponible');
      break;
    case 'bard':
      if (sc.bardicCollege) lines.push(`Collège : ${sc.bardicCollege}`);
      break;
    case 'ranger':
      if (sc.knownSpellsCount) lines.push(`Sorts connus : ${sc.knownSpellsCount}`);
      break;
    case 'fighter_eldritch_knight':
      if (sc.soulWeapon?.name) lines.push(`Arme liée : ${sc.soulWeapon.name}`);
      break;
    default:
      break;
  }
  return lines;
}

export function spellcastingFocusLabel(focus: string | null | undefined): string {
  if (!focus) return '';
  return labelForGameId(focus);
}
