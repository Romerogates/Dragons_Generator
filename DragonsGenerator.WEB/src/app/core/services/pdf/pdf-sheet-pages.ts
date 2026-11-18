import type { jsPDF } from 'jspdf';
import { labelForGameId } from '@core/utils/game-id-labels';
import { resistanceLabel } from '@core/utils/equipment-display.util';
import { EQUIPMENT_CATEGORY_ALIASES } from '@core/utils/equipment.utils';
import { visibleClassResources } from '@core/utils/class-resource-labels';
import { foldFeaturesForSheet } from '@core/utils/format-sheet-feature.util';
import {
  Character,
  FeatureInstance,
  CharacterSpellcasting,
} from '@core/models/Character/character';
import { PAGE2, sheetPxToMmX as pxToMmX } from '@core/config/character-sheet-pdf-coords.config';
import { PdfSheetDraw } from './pdf-sheet-draw';

/** Pages 1–4 de la fiche personnage. */
export class PdfSheetPages extends PdfSheetDraw {
  // =========================================================================
  // PAGE 1
  // =========================================================================

  drawPage1(pdf: jsPDF, c: Character): void {
    const dark = '#2c1810';
    pdf.setTextColor(dark);
    const fmt = (n: number) => this.formatBonus(n);

    const speciesLabel = c.species.subspeciesLabel
      ? `${c.species.label} (${c.species.subspeciesLabel})`
      : c.species.label;
    const classLabel = (() => {
      // Multiclassage (RAW) : "Guerrier 5 (Champion) / Magicien 3" — le libellé complet se
      // rétrécit automatiquement (voir classFontSize ci-dessous) pour tenir sur la ligne.
      const labelFor = (cls: Character['classes'][number], withLevel: boolean) => {
        const base = cls.subclassLabel ? `${cls.classLabel} (${cls.subclassLabel})` : cls.classLabel;
        return withLevel ? `${base} ${cls.level}` : base;
      };
      if (c.classes.length <= 1) return labelFor(c.classes[0], false);
      return c.classes.map((cls) => labelFor(cls, true)).join(' / ');
    })();

    pdf.setFontSize(15);
    this.text(pdf, c.name, 140, 43);
    this.text(pdf, speciesLabel, 140, 66);
    this.text(pdf, c.civilization.label, 140, 90);

    // Nom de classe : avec la sous-classe entre parenthèses (ex. « Barde (Collège
    // des conteurs) »), le texte à taille 15 dépasse la bordure droite décorative
    // de la page. On réduit la police par paliers jusqu'à ce qu'il tienne dans
    // l'espace disponible (de x=400 à ~565, avant la bordure).
    const classLabelMaxWidthMm = pxToMmX(565 - 400);
    let classFontSize = 15;
    pdf.setFontSize(classFontSize);
    while (classFontSize > 9 && pdf.getTextWidth(classLabel) > classLabelMaxWidthMm) {
      classFontSize -= 1;
      pdf.setFontSize(classFontSize);
    }
    this.text(pdf, classLabel, 400, 43);
    pdf.setFontSize(15);
    // Emplacement « Niveau » sur la fiche (pas les XP — un perso niv. 1 a 0 XP).
    const pdfLevel = Math.max(1, c.totalLevel || c.classes[0]?.level || 1);
    this.text(pdf, String(pdfLevel), 432, 94);

    this.text(pdf, String(c.vitality.hitPointsCurrent), 230, 123);
    this.text(pdf, String(c.vitality.hitPointsTemporary), 250, 171);
    const hitDiceLabel = c.vitality.hitDice.map((hd) => `${hd.total}d${hd.dieType}`).join('+');
    this.text(pdf, hitDiceLabel || `1d${c.classes[0].hitDie}`, 438, 123);

    pdf.setFontSize(15);
    this.text(pdf, `+${c.proficiencyBonus}`, 55, 173);
    this.text(pdf, String(c.vitality.hitPointsMax), 370, 171);
    this.text(pdf, String(c.vitality.woundThreshold), 530, 171);
    this.text(pdf, fmt(c.initiative), 270, 220);
    this.text(pdf, String(c.senses.passivePerception), 520, 220);

    pdf.setFontSize(15);
    this.text(pdf, String(c.defense.armorClass), 360, 220);

    // Portrait / jeton : volontairement hors fiche PDF (pion de table uniquement).

    pdf.setFontSize(15);
    this.text(pdf, String(c.abilities.force), 118, 225);
    this.text(pdf, String(c.abilities.dexterite), 118, 291);
    this.text(pdf, String(c.abilities.constitution), 118, 388);
    this.text(pdf, String(c.abilities.intelligence), 118, 442);
    this.text(pdf, String(c.abilities.sagesse), 118, 565);
    this.text(pdf, String(c.abilities.charisme), 118, 700);

    pdf.setFontSize(10);
    // Même colonne x que les autres modificateurs (165) — l'ancien 160 décalait le
    // « +3 » de Force d'une colonne par rapport aux cercles de +2 Dex/+0 Con etc.
    this.text(pdf, fmt(c.abilityModifiers.force), 165, 228);
    this.text(pdf, fmt(c.abilityModifiers.dexterite), 165, 296);
    this.text(pdf, fmt(c.abilityModifiers.constitution), 165, 392);
    this.text(pdf, fmt(c.abilityModifiers.intelligence), 165, 445);
    this.text(pdf, fmt(c.abilityModifiers.sagesse), 165, 570);
    this.text(pdf, fmt(c.abilityModifiers.charisme), 165, 705);

    const isSaveProf = (ability: string) =>
      c.proficiencies.savingThrows.some((s) => s.toLowerCase().startsWith(ability.toLowerCase()));
    this.drawProfCircle(pdf, isSaveProf('force'), 36, 237);
    this.drawProfCircle(pdf, isSaveProf('dext'), 36, 307);
    this.drawProfCircle(pdf, isSaveProf('const'), 36, 404);
    this.drawProfCircle(pdf, isSaveProf('intel'), 36, 455);
    this.drawProfCircle(pdf, isSaveProf('sag'), 36, 580);
    this.drawProfCircle(pdf, isSaveProf('char'), 36, 716);

    const isSkillProf = (skill: string) => {
      const normalized = skill
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return c.proficiencies.skills.some((s) => {
        if (s === skill) return true;
        const sNorm = s
          .replace(/^skill-/, '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return sNorm === normalized;
      });
    };

    const isSkillExpertise = (skill: string) => {
      const list = c.proficiencies.expertiseSkills ?? [];
      const normalized = skill
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return list.some((s) => {
        if (s === skill) return true;
        const sNorm = s
          .replace(/^skill-/, '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return sNorm === normalized;
      });
    };

    const skillRow = (name: string, y: number) => {
      this.drawProfCircle(pdf, isSkillProf(name), 36, y);
      this.drawProfCircle(pdf, isSkillExpertise(name), 23, y);
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

    pdf.setFontSize(12);
    this.text(pdf, String(c.movement.walk), 232, 359);
    this.text(pdf, String(c.movement.climb), 312, 360);
    this.text(pdf, String(c.movement.swim), 365, 360);
    this.text(pdf, String(c.movement.jumpHeight), 286, 381);
    this.text(pdf, String(c.movement.jumpLength), 361, 381);

    const attackTops = [477, 501, 524, 546, 571];
    const colName = 222;
    const colBonus = 442;
    const colDamage = 517;

    if (c.attacks.length > 0) {
      pdf.setFontSize(10);
      c.attacks.slice(0, 5).forEach((atk, i) => {
        this.text(pdf, atk.name, colName, attackTops[i]);
        this.text(pdf, this.formatBonus(atk.attackBonus), colBonus, attackTops[i]);
        const dmgType = this.shortenDamageType(atk.damageType);
        this.text(pdf, `${atk.damage} ${dmgType}`, colDamage, attackTops[i]);
      });
    } else {
      pdf.setFontSize(12);
      const weapons = c.equipment.filter(
        (e) =>
          e.refId.startsWith('wp-') ||
          (e.customData as { isWeapon?: boolean })?.isWeapon === true,
      );
      weapons.slice(0, 5).forEach((item, i) => {
        this.text(pdf, item.name, colName, attackTops[i]);
      });
    }
  }

  // =========================================================================
  // PAGE 2
  // =========================================================================

  drawPage2(pdf: jsPDF, c: Character): void {
    const dark = '#2c1810';
    pdf.setTextColor(dark);

    // ── 1. Armures ──
    this.drawPage2Proficiencies(pdf, c);

    // ── 2. Résistances & immunités ──
    this.drawPage2Resistances(pdf, c);

    // ── 3. Outils & Langues ──
    this.drawPage2ToolsAndLanguages(pdf, c);

    // ── 4. Features dispatchées par rechargeType ──
    this.drawPage2Features(pdf, c);
    this.drawPage2ClassResources(pdf, c);

    // ── 5. Emplacements de sorts ──
    if (c.spellcasting) {
      this.drawPage2SpellSlots(pdf, c.spellcasting);
    }
  }

  // =========================================================================
  // PAGE 2 — Sous-méthodes
  // =========================================================================

  /**
   * Armures & Armes (haut-gauche, inchangé).
   */
  drawPage2Proficiencies(pdf: jsPDF, c: Character): void {
    const P = PAGE2;
    pdf.setFontSize(P.profFontSize);

    const packTwoLines = (ids: string[]): [string, string] => {
      const sorted = this.prioritizeCategoryTokens(ids);
      if (sorted.length === 0) return ['', ''];
      if (sorted.length === 1) return [this.prettify(sorted[0]!), ''];
      const first = this.prettify(sorted[0]!);
      const rest = sorted.slice(1).map((id) => this.prettify(id)).join(', ');
      return [first, rest];
    };

    const writeProf = (value: string, x: number, y: number): void => {
      this.textFit(pdf, value, x, y, P.profMaxWidth, P.profFontSize, P.profMinFontSize);
    };

    const [armor0, armor1] = packTwoLines(c.proficiencies.armor ?? []);
    if (armor0) writeProf(armor0, P.armorX, P.armorYs[0]);
    if (armor1) writeProf(armor1, P.armorX, P.armorYs[1]);

    // Armes : uniquement catégories / spécialisations (pas chaque wp-* — déjà en équip. / attaques).
    const [weapon0, weapon1] = packTwoLines(this.weaponSpecializationIds(c.proficiencies.weapons ?? []));
    if (weapon0) writeProf(weapon0, P.weaponX, P.weaponYs[0]);
    if (weapon1) writeProf(weapon1, P.weaponX, P.weaponYs[1]);
  }

  /**
   * Seules 2 lignes d'armure/d'arme sont imprimables ici (gabarit fixe). Sans tri, un
   * personnage avec beaucoup de maîtrises (ex. Mage de guerre niv. 6, qui gagne
   * "wp-cat-simple"/"wp-cat-martial" = toutes les armes) pouvait n'afficher que 2 armes
   * nommées individuellement et perdre complètement la mention "Armes courantes/de guerre",
   * pourtant bien plus informative. On fait donc passer les jetons de catégorie en tête
   * (tri stable : l'ordre relatif du reste est conservé).
   */
  prioritizeCategoryTokens(ids: string[]): string[] {
    const isCategory = (id: string) => this.isWeaponOrArmorCategoryId(id);
    return [...ids].sort((a, b) => Number(isCategory(b)) - Number(isCategory(a)));
  }

  /**
   * Catégories d'armes/armures (courantes / guerre…) — pas les armes nommées une à une.
   * Couvre les IDs canoniques (`wp-cat-*`, `category-*`) et les alias classes
   * (`wp-simple`, `wp-martial`, `wp-category-simple`…).
   */
  isWeaponOrArmorCategoryId(id: string): boolean {
    if (/^(wp-cat-|wp-category-|ar-cat-|category-)/.test(id)) return true;
    const aliased = EQUIPMENT_CATEGORY_ALIASES[id];
    return (
      !!aliased &&
      /^category-(simple|martial|light|medium|heavy|shield|all)-?/.test(aliased)
    );
  }

  weaponSpecializationIds(ids: string[]): string[] {
    const cats = this.prioritizeCategoryTokens(
      ids.filter((id) => this.isWeaponOrArmorCategoryId(id)),
    );
    // Dédupliquer les alias équivalents (wp-simple ≡ wp-cat-simple ≡ category-simple-weapons)
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of cats) {
      const key = EQUIPMENT_CATEGORY_ALIASES[id] ?? id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(id);
    }
    return out;
  }

  /**
   * Résistances & immunités (haut-droite).
   * Inclut la darkvision, les résistances d'espèce, et les immunités.
   */
  drawPage2Resistances(pdf: jsPDF, c: Character): void {
    const P = PAGE2;
    pdf.setFontSize(15);

    const entries: string[] = [];

    if (c.senses.hasDarkvision) {
      entries.push(`Vision dans le noir (${c.senses.darkvisionRadius}m)`);
    }
    if (c.senses.hasBlindsight) {
      entries.push(`Vision aveugle (${c.senses.blindsightRadius}m)`);
    }

    c.defense.resistances.forEach((r) => entries.push(`Rés. ${resistanceLabel(r)}`));
    c.defense.immunities.forEach((im) => entries.push(`Imm. ${resistanceLabel(im)}`));
    c.defense.conditionImmunities.forEach((ci) => entries.push(`Imm. ${labelForGameId(ci)}`));

    entries.slice(0, P.resYs.length).forEach((entry, i) => {
      this.text(pdf, entry, P.resX, P.resYs[i]);
    });
  }

  /**
   * Outils & véhicules (colonne milieu) + Langues (colonne droite).
   */
  drawPage2ToolsAndLanguages(pdf: jsPDF, c: Character): void {
    const P = PAGE2;
    pdf.setFontSize(10);

    c.proficiencies.tools.slice(0, P.middleYs.length).forEach((tool, i) => {
      this.text(pdf, this.prettify(tool), P.toolX, P.middleYs[i]);
    });

    // Dédupliquer les langues après prettify pour éviter les doublons ID/nom
    const uniqueLanguages = [...new Set(c.proficiencies.languages.map((l) => this.prettify(l)))];

    uniqueLanguages.slice(0, P.middleYs.length).forEach((lang, i) => {
      this.text(pdf, lang, P.langX, P.middleYs[i]);
    });
  }

  /**
   * Dispatcher toutes les features dans les 3 sections de la page 2 :
   * - Usage illimité (unlimited + passives)
   * - Regain en repos court (short_rest)
   * - Regain en repos long (long_rest)
   */
  drawPage2Features(pdf: jsPDF, c: Character): void {
    const P = PAGE2;

    // On exclut les features "techniques" qui n'ont pas d'intérêt sur la fiche
    const EXCLUDED_IDS = new Set([
      'feat-augmentation-de-caracteristique',
      'feat-voie-primale',
      'feat-archetype-martial',
      'feat-tradition-monastique',
      'feat-archetype-roublard',
      'feat-archetype-de-rodeur',
      'feat-college-bardique',
      'feat-cercle-druidique',
      'feat-tradition-arcanique',
      'feat-serment-sacre',
      'feat-domaine-divin',
      'feat-atavisme',
      'feat-suzerain',
      'feat-faveur-du-pacte',
      'feat-marotte',
      'feat-aptitude-darchetype',
      'feat-astuces',
      'feat-gain-astuce',
      'feat-conquete-methodique',
    ]);

    const allFeatures = foldFeaturesForSheet(
      c.features.filter((f) => !EXCLUDED_IDS.has(f.refId ?? '')),
    );

    // Trier par source : species/subspecies d'abord, puis class/subclass
    const sortBySource = (a: FeatureInstance, b: FeatureInstance) => {
      const order: Record<string, number> = {
        species: 0,
        subspecies: 1,
        class: 2,
        subclass: 3,
      };
      return (order[a.source] ?? 9) - (order[b.source] ?? 9);
    };

    const unlimited = allFeatures
      .filter((f) => !f.uses || !f.uses.recharge || f.uses.recharge === 'unlimited')
      .sort(sortBySource);

    const shortRest = allFeatures
      .filter((f) => f.uses?.recharge === 'short_rest')
      .sort(sortBySource);

    const longRest = allFeatures.filter((f) => f.uses?.recharge === 'long_rest').sort(sortBySource);

    // --- Section "Usage illimité" ---
    this.drawFeatureLines(
      pdf,
      unlimited,
      P.unlimitedNameX,
      P.unlimitedUsesX,
      P.unlimitedStartY,
      P.unlimitedLineH,
      P.unlimitedMaxLines,
      undefined,
      P.unlimitedUsesX - P.unlimitedNameX - 8,
    );

    // --- Section "Regain en repos court" ---
    this.drawFeatureLines(
      pdf,
      shortRest,
      P.shortRestNameX,
      P.shortRestUsesX,
      P.shortRestStartY,
      P.shortRestLineH,
      P.shortRestMaxLines,
      { nameX: P.shortRestCol2NameX, usesX: P.shortRestCol2UsesX },
      P.shortRestUsesX - P.shortRestNameX - 8,
    );

    // --- Section "Regain en repos long" ---
    this.drawFeatureLines(
      pdf,
      longRest,
      P.longRestNameX,
      P.longRestUsesX,
      P.longRestStartY,
      P.longRestLineH,
      P.longRestMaxLines,
      { nameX: P.longRestCol2NameX, usesX: P.longRestCol2UsesX },
      P.longRestUsesX - P.longRestNameX - 8,
    );
  }

  /** Points d'astuce, rage, ki, inspiration… (aligné sur la fiche UI). */
  drawPage2ClassResources(pdf: jsPDF, c: Character): void {
    const spellDupes = new Set([
      'cantrips_known',
      'cantrips',
      'spells_known',
      'known_spells',
      'spells_prepared',
      'prepared_spells',
      'spell_slots',
      'pact_magic',
      'pact_slots_count',
      'pact_slot_level',
    ]);
    const chips = visibleClassResources(c.classResources).filter((r) => !spellDupes.has(r.key));
    if (!chips.length) return;
    const P = PAGE2;
    pdf.setFontSize(7);
    const y = P.shortRestStartY - 18;
    const line = chips.map((r) => `${r.label} : ${r.value}`).join('  ·  ');
    this.text(pdf, line, P.shortRestNameX, y);
  }

  /**
   * Dessine une liste de features avec nom + cercles d'utilisation.
   * `col2` : débordement colonne droite (repos court / long).
   */
  drawFeatureLines(
    pdf: jsPDF,
    features: FeatureInstance[],
    nameX: number,
    usesX: number,
    startY: number,
    lineH: number,
    maxLines: number,
    col2?: { nameX: number; usesX: number },
    maxNameWidth = 150,
  ): void {
    pdf.setFontSize(10);

    const capacity = col2 ? maxLines * 2 : maxLines;
    const overflow = features.length > capacity;
    features.slice(0, capacity).forEach((feat, i) => {
      const inCol2 = !!col2 && i >= maxLines;
      const xName = inCol2 ? col2!.nameX : nameX;
      const xUses = inCol2 ? col2!.usesX : usesX;
      const row = inCol2 ? i - maxLines : i;
      const y = startY + row * lineH;

      // Nom de l'aptitude (+ portée d'aura si présente dans la desc)
      let label = feat.name;
      const auraMatch = String(feat.desc ?? '').match(/Portée d'aura\s*:\s*([\d.,]+)\s*m/i);
      if (auraMatch) {
        label += ` (${auraMatch[1]} m)`;
      }

      // Si uses avec max connu > 0, ajouter le compteur textuel
      if (feat.uses && feat.uses.max > 0 && feat.uses.max <= 20) {
        label += ` (×${feat.uses.max})`;
      }

      this.textFit(pdf, label, xName, y, maxNameWidth, 10, 7);

      // Dessiner des cercles cochables si l'aptitude a un nombre d'utilisations
      if (feat.uses && feat.uses.max > 0 && feat.uses.max <= 10) {
        const circleRadius = 2;
        const circleSpacing = 11;
        for (let u = 0; u < feat.uses.max; u++) {
          this.drawEmptyCircle(pdf, xUses + u * circleSpacing, y - 2, circleRadius);
        }
      }
    });
    if (overflow) {
      pdf.setFontSize(8);
      const lastRow = maxLines - 1;
      const y = startY + lastRow * lineH + Math.round(lineH * 0.55);
      this.text(pdf, `… +${features.length - capacity} aptitude(s)`, nameX, y);
      pdf.setFontSize(10);
    }
  }

  /**
   * Cercles d'emplacements de sorts (parchemin bas-droite de la page 2).
   */
  drawPage2SpellSlots(pdf: jsPDF, sc: CharacterSpellcasting): void {
    const P = PAGE2;
    const radius = 2.8;

    sc.spellSlots.forEach((slot) => {
      const rowIdx = slot.level - 1;
      if (rowIdx < 0 || rowIdx > 8) return;

      const y = P.spellSlotStartY + rowIdx * P.spellSlotRowH;
      const maxCircles = P.spellSlotMaxPerRow[rowIdx];
      const available = Math.min(slot.max, maxCircles);

      for (let i = 0; i < available; i++) {
        this.drawFilledCircle(pdf, P.spellSlotX + i * P.spellSlotCircleSpacing, y, radius);
      }
    });
  }

  // =========================================================================
  // PAGE 3
  // =========================================================================

  drawPage3(pdf: jsPDF, c: Character): void {
    const dark = '#2c1810';
    pdf.setTextColor(dark);
    pdf.setFontSize(10);
    const p = c.personality;

    if (p.description) {
      // 90mm de large, 4.5mm de hauteur de ligne
      this.textWrapped(pdf, p.description, 38, 72, 90, 8.5, 2);
    }

    if (p.background) {
      // 120mm de large, 8mm de hauteur de ligne
      this.textWrapped(pdf, p.background, 37, 137, 120, 8, 4);
    }

    // NOUVEAU : Application de textWrapped pour la colonne de droite (Idéal, Traits, etc.)
    // Largeur estimée ~55mm pour ne pas déborder, hauteur de ligne 4.5mm
    const rightColMaxWidth = 65;
    const rightColLineH = 8.5;

    if (p.ideal) this.textWrapped(pdf, p.ideal, 402, 127, rightColMaxWidth, rightColLineH, 2);
    if (p.traits) this.textWrapped(pdf, p.traits, 402, 199, rightColMaxWidth, rightColLineH, 2);
    if (p.alignment) this.text(pdf, p.alignment, 402, 270); // Alignement (court)
    if (p.bonds) this.textWrapped(pdf, p.bonds, 402, 316, rightColMaxWidth, rightColLineH, 2);
    if (p.flaws) this.textWrapped(pdf, p.flaws, 402, 388, rightColMaxWidth, rightColLineH, 2);
    if (p.handicap) this.textWrapped(pdf, p.handicap, 402, 459, rightColMaxWidth, rightColLineH);

    if (p.story) {
      pdf.setFontSize(8);
      const cleanedStory = p.story
        .replace(/\n\s*\n/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      this.textWrapped(pdf, cleanedStory, 72, 441, 97, 8.4);
    }

    // Bas de page 3 : éveil / folies / corruption (pas le sexe — hors gabarit « Épopée »).
    pdf.setFontSize(8);
    if (p.awakened) {
      this.text(pdf, 'Éveil : oui', 38, 560);
    }
    if (p.madness?.trim()) {
      this.textWrapped(pdf, `Folies : ${p.madness.trim()}`, 38, 570, 120, 7, 2);
    }
    const corr = p.corruption;
    if (corr) {
      const stages = [corr.stage1, corr.stage2, corr.stage3, corr.stage4]
        .map((n, i) => `P${i + 1}:${n ?? 0}`)
        .join(' ');
      this.text(pdf, `Corruption ${stages}`, 402, 560);
    }
  }

  // =========================================================================
  // PAGE 4
  // =========================================================================

  drawPage4(pdf: jsPDF, c: Character): void {
    const dark = '#2c1810';
    pdf.setTextColor(dark);
    pdf.setFontSize(10);

    const equipTops = [175, 197, 219, 242, 264, 287, 309, 333, 356, 375, 399, 421];
    const equipRightYs = [168, 188, 208, 228, 248, 268, 288, 308];
    const formatEq = (item: { name: string; qty: number }) =>
      item.qty > 1 ? `${item.name} x${item.qty}` : item.name;

    c.equipment.forEach((item, i) => {
      if (i < equipTops.length) {
        this.text(pdf, formatEq(item), 66, equipTops[i]!);
      } else {
        const ri = i - equipTops.length;
        if (ri < equipRightYs.length) {
          this.text(pdf, formatEq(item), 222, equipRightYs[ri]!);
        }
      }
    });

    this.text(pdf, `${c.currency.or} po`, 71, 486);
    this.text(pdf, `${c.currency.argent} pa`, 71, 507);
    this.text(pdf, `${c.currency.cuivre} pc`, 70, 531);
    this.text(pdf, `${c.carryCapacity.maxKg} kg`, 413, 245);
  }
}
