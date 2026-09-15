import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Character } from '@core/models/Character/character';

/** Repère des fonds officiels : 595 × 842 px (voir pdf-generator.service). */
export const SHEET_W = 595;
export const SHEET_H = 842;

/** Décalage écran vs coords PDF (légèrement à droite pour caler les cases). */
const SHEET_X_NUDGE = 3;

const ATTACK_TOPS = [477, 501, 524, 546, 571] as const;
const COL_ATK_NAME = 222;
const COL_ATK_BONUS = 442;
const COL_ATK_DMG = 517;

const DMG_SHORT: Record<string, string> = {
  tranchant: 'tr.',
  perforant: 'perf.',
  contondant: 'cont.',
  feu: 'feu',
  froid: 'froid',
  foudre: 'foudr.',
  acide: 'acide',
  poison: 'pois.',
  nécrotique: 'nécr.',
  radiant: 'rad.',
  psychique: 'psy.',
  force: 'force',
};

export function sheetPct(xPx: number, yPx: number): { left: string; top: string } {
  return {
    left: `${((xPx + SHEET_X_NUDGE) / SHEET_W) * 100}%`,
    top: `${(yPx / SHEET_H) * 100}%`,
  };
}

function fmtBonus(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

function stripAccents(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function shortenDamageType(dt: string): string {
  return DMG_SHORT[dt.toLowerCase()] || dt;
}

export type IlluMark = { x: number; y: number };
export type IlluAttackRow = { name: string; bonus: string; damage: string; y: number };

@Component({
  selector: 'app-illustrated-character-sheet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './illustrated-character-sheet.html',
  styleUrl: './illustrated-character-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IllustratedCharacterSheet {
  readonly character = input.required<Character>();

  readonly page = input(1);

  readonly pageCount = 4;

  readonly bgUrl = computed(() => {
    const p = Math.min(this.pageCount, Math.max(1, this.page()));
    return `/images/sheets/sheet-page${p}.jpg`;
  });

  /** Même contenu que `PdfGeneratorService.drawPage1`. */
  readonly overlay = computed(() => {
    const c = this.character();
    const speciesLabel = c.species.subspeciesLabel
      ? `${c.species.label} (${c.species.subspeciesLabel})`
      : c.species.label;
    const classLabel = (() => {
      const labelFor = (cls: Character['classes'][number], withLevel: boolean) => {
        const base = cls.subclassLabel ? `${cls.classLabel} (${cls.subclassLabel})` : cls.classLabel;
        return withLevel ? `${base} ${cls.level}` : base;
      };
      if (c.classes.length <= 1) return labelFor(c.classes[0], false);
      return c.classes.map((cls) => labelFor(cls, true)).join(' / ');
    })();
    const level = Math.max(1, c.totalLevel || c.classes[0]?.level || 1);
    const hitDice =
      c.vitality.hitDice.map((hd) => `${hd.total}d${hd.dieType}`).join('+') ||
      `1d${c.classes[0]?.hitDie ?? 8}`;

    const isSaveProf = (ability: string) =>
      c.proficiencies.savingThrows.some((s) => s.toLowerCase().startsWith(ability.toLowerCase()));

    const matchProf = (list: string[], skill: string) => {
      const normalized = stripAccents(skill);
      return list.some((s) => {
        if (s === skill) return true;
        return stripAccents(s.replace(/^skill-/, '')) === normalized;
      });
    };
    const isSkillProf = (skill: string) => matchProf(c.proficiencies.skills, skill);
    const isSkillExpertise = (skill: string) =>
      matchProf(c.proficiencies.expertiseSkills ?? [], skill);

    const marks: IlluMark[] = [];
    const addMark = (on: boolean, x: number, y: number) => {
      if (on) marks.push({ x, y });
    };

    addMark(isSaveProf('force'), 36, 237);
    addMark(isSaveProf('dext'), 36, 307);
    addMark(isSaveProf('const'), 36, 404);
    addMark(isSaveProf('intel'), 36, 455);
    addMark(isSaveProf('sag'), 36, 580);
    addMark(isSaveProf('char'), 36, 716);

    const skillRow = (name: string, y: number) => {
      addMark(isSkillProf(name), 36, y);
      addMark(isSkillExpertise(name), 23, y);
    };
    skillRow('Athlétisme', 255);
    skillRow('Acrobaties', 323);
    skillRow('Escamotage', 338);
    skillRow('Discrétion', 355);
    skillRow('Arcanes', 472);
    skillRow('Histoire', 487);
    skillRow('Investigation', 503);
    skillRow('Nature', 519);
    skillRow('Religion', 535);
    skillRow('Dressage', 596);
    skillRow('Intuition', 612);
    skillRow('Médecine', 628);
    skillRow('Perception', 644);
    skillRow('Survie', 660);
    skillRow('Intimidation', 731);
    skillRow('Persuasion', 747);
    skillRow('Représentation', 763);
    skillRow('Tromperie', 779);

    const attacks: IlluAttackRow[] = [];
    if (c.attacks.length > 0) {
      c.attacks.slice(0, 5).forEach((atk, i) => {
        attacks.push({
          name: atk.name,
          bonus: fmtBonus(atk.attackBonus),
          damage: `${atk.damage} ${shortenDamageType(atk.damageType)}`,
          y: ATTACK_TOPS[i],
        });
      });
    } else {
      const weapons = c.equipment.filter(
        (e) =>
          e.refId.startsWith('wp-') ||
          (e.customData as { isWeapon?: boolean })?.isWeapon === true,
      );
      weapons.slice(0, 5).forEach((item, i) => {
        attacks.push({ name: item.name, bonus: '', damage: '', y: ATTACK_TOPS[i] });
      });
    }

    return {
      name: c.name,
      speciesLabel,
      civilization: c.civilization.label,
      classLabel,
      level: String(level),
      hpCurrent: String(c.vitality.hitPointsCurrent),
      hpTemp: String(c.vitality.hitPointsTemporary),
      hpMax: String(c.vitality.hitPointsMax),
      hitDice,
      proficiency: `+${c.proficiencyBonus}`,
      wound: String(c.vitality.woundThreshold),
      initiative: fmtBonus(c.initiative),
      passivePerception: String(c.senses.passivePerception),
      ac: String(c.defense.armorClass),
      str: String(c.abilities.force),
      dex: String(c.abilities.dexterite),
      con: String(c.abilities.constitution),
      int: String(c.abilities.intelligence),
      wis: String(c.abilities.sagesse),
      cha: String(c.abilities.charisme),
      strMod: fmtBonus(c.abilityModifiers.force),
      dexMod: fmtBonus(c.abilityModifiers.dexterite),
      conMod: fmtBonus(c.abilityModifiers.constitution),
      intMod: fmtBonus(c.abilityModifiers.intelligence),
      wisMod: fmtBonus(c.abilityModifiers.sagesse),
      chaMod: fmtBonus(c.abilityModifiers.charisme),
      walk: String(c.movement.walk),
      climb: String(c.movement.climb),
      swim: String(c.movement.swim),
      jumpHeight: String(c.movement.jumpHeight),
      jumpLength: String(c.movement.jumpLength),
      marks,
      attacks,
      colAtkName: COL_ATK_NAME,
      colAtkBonus: COL_ATK_BONUS,
      colAtkDmg: COL_ATK_DMG,
    };
  });

  pos(x: number, y: number): { left: string; top: string } {
    return sheetPct(x, y);
  }
}
