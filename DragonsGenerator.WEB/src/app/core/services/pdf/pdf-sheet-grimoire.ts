import type { jsPDF } from 'jspdf';
import {
  GRIMOIRE_BASE_COORDS as BASE_COORDS,
  GRIMOIRE_PANEL_BARD as PANEL_BARD,
  GRIMOIRE_PANEL_CLERIC as PANEL_CLERIC,
  GRIMOIRE_PANEL_DRUID as PANEL_DRUID,
  GRIMOIRE_PANEL_SORCERER as PANEL_SORCERER,
  GRIMOIRE_PANEL_WARLOCK as PANEL_WARLOCK,
  GRIMOIRE_PANEL_WIZARD as PANEL_WIZARD,
  GRIMOIRE_SPELL_TABLE_LEVEL as SPELL_TABLE_LEVEL,
  GRIMOIRE_SUPP_COORDS as SUPP_COORDS,
} from '@core/config/grimoire-coords.config';
import { labelForGameId } from '@core/utils/game-id-labels';
import {
  paginateGrimoireOverflow,
  planGrimoireTable,
  type GrimoireEffectLayout,
  type GrimoireTablePlan,
} from '@core/utils/spell-grimoire-effect.util';
import {
  Character,
  SpellInstance,
  CharacterSpellcasting,
} from '@core/models/Character/character';
import {
  GRP_COORDS,
  sheetPxToMmX as pxToMmX,
  sheetPxToMmY as pxToMmY,
} from '@core/config/character-sheet-pdf-coords.config';
import { PdfSheetPages } from './pdf-sheet-pages';

/** Page grimoire (+ martial GRP) et overflow. */
export class PdfSheetGrimoire extends PdfSheetPages {
  drawGrimoire(pdf: jsPDF, c: Character, mainPlan: GrimoireTablePlan | null): void {
    if (!c.spellcasting) return;
    const dark = '#2c1810';
    pdf.setTextColor(dark);
    const sc = c.spellcasting;

    if (sc.kind === 'ranger' || sc.kind === 'paladin' || sc.kind === 'fighter_eldritch_knight') {
      this.drawGrimoireGRP(pdf, c);
      return;
    }

    this.drawGrimoireBase(pdf, c, mainPlan);
    this.drawGrimoirePanel(pdf, sc);
  }

  // =========================================================================
  // GRIMOIRE — Base commune (côté gauche + table de sorts)
  // =========================================================================

  drawGrimoireBase(pdf: jsPDF, c: Character, mainPlan: GrimoireTablePlan | null): void {
    if (!c.spellcasting) return;
    const sc = c.spellcasting;
    const fmt = (n: number) => this.formatBonus(n);
    const B = BASE_COORDS;

    // Nom du personnage
    pdf.setFontSize(15);
    this.text(pdf, c.name, B.nameX, B.nameY);

    // Caractéristique d'incantation (dans l'ovale)
    pdf.setFontSize(10);
    this.text(pdf, sc.ability, B.abilityX, B.abilityY);

    // DD sauvegarde (dans l'ovale)
    pdf.setFontSize(12);
    this.text(pdf, String(sc.spellSaveDC), B.saveDCX, B.saveDCY);

    // Modificateur d'attaque (dans l'ovale)
    pdf.setFontSize(12);
    this.text(pdf, fmt(sc.spellAttackBonus), B.attackModX, B.attackModY);

    // Cercles sorts mineurs
    this.drawCantripCircles(pdf, sc);

    // Cercles emplacements de sorts
    this.drawSpellSlotCircles(pdf, sc);

    if (mainPlan) {
      this.drawSpellTableFromPlan(pdf, mainPlan);
    }
  }

  // =========================================================================
  // GRIMOIRE — Cercles sorts mineurs
  // =========================================================================

  drawCantripCircles(pdf: jsPDF, sc: CharacterSpellcasting): void {
    const B = BASE_COORDS;
    const totalCircles = 5;
    const radius = 2.5;
    const known = sc.cantrips.max;

    for (let i = 0; i < totalCircles; i++) {
      if (i < known) {
        this.drawFilledCircle(pdf, B.cantripXStart + i * B.cantripSpacing, B.cantripY, radius);
      }
    }
  }

  // =========================================================================
  // GRIMOIRE — Cercles emplacements de sorts
  // =========================================================================

  drawSpellSlotCircles(pdf: jsPDF, sc: CharacterSpellcasting): void {
    const B = BASE_COORDS;
    const radius = 2.5;

    for (let lvl = 0; lvl < B.slotRows.length; lvl++) {
      const row = B.slotRows[lvl];
      const slot = sc.spellSlots.find((s) => s.level === lvl + 1);
      const available = slot ? slot.max : 0;
      for (let i = 0; i < Math.min(available, row.maxCircles); i++) {
        this.drawFilledCircle(pdf, B.slotXStart + i * B.slotSpacing, row.y, radius);
      }
    }
  }

  // =========================================================================
  // GRIMOIRE — Table des sorts
  // =========================================================================

  sortedKnownSpells(c: Character): SpellInstance[] {
    if (!c.knownSpells?.length) return [];
    return [...c.knownSpells].sort(
      (a, b) => a.level - b.level || a.name.localeCompare(b.name),
    );
  }

  grimoireEffectSplit(
    pdf: jsPDF,
    fontSize: number,
  ): (text: string, maxWidth: number) => string[] {
    pdf.setFontSize(fontSize);
    return (text: string, maxWidth: number) => pdf.splitTextToSize(text, maxWidth) as string[];
  }

  planMainGrimoireTable(pdf: jsPDF, c: Character): GrimoireTablePlan {
    const sorted = this.sortedKnownSpells(c);
    const B = BASE_COORDS;
    const effectWidthMm = pxToMmX(B.colPage - B.colEffect - 8);
    const split = this.grimoireEffectSplit(pdf, 7);
    return planGrimoireTable(sorted, split, effectWidthMm, B.spellTableMaxRows, 3);
  }

  planSuppGrimoirePages(pdf: jsPDF, spells: SpellInstance[]): GrimoireTablePlan[] {
    const S = SUPP_COORDS;
    const effectWidthMm = pxToMmX(S.effectEndX - S.effectX - 8);
    const split = this.grimoireEffectSplit(pdf, 6.5);
    return paginateGrimoireOverflow(spells, split, effectWidthMm, S.maxRows, 3);
  }

  drawGrimoireEffectLines(
    pdf: jsPDF,
    layout: GrimoireEffectLayout,
    effectX: number,
    baseYMm: number,
    lineHMm: number,
    fontSize: number,
  ): void {
    pdf.setFontSize(fontSize);
    let lineIndex = 0;

    const writeLines = (lines: string[]) => {
      for (const line of lines) {
        if (line) pdf.text(line, effectX, baseYMm + lineIndex * lineHMm);
        lineIndex++;
      }
    };

    if (layout.bodyLines.length === 0) {
      writeLines(layout.headerLines);
      return;
    }

    writeLines(layout.headerLines);
    writeLines(layout.bodyLines);
  }

  drawSpellTableFromPlan(pdf: jsPDF, plan: GrimoireTablePlan): void {
    const B = BASE_COORDS;
    const lineHMm = pxToMmY(B.spellTableRowH);

    const L = SPELL_TABLE_LEVEL;
    this.drawSpellLevelMedallions(
      pdf,
      plan.placements.map((p) => ({ row: p.startRow, level: p.spell.level })),
      L.levelX,
      L.levelYs,
      L.rowsPerBand,
      L.labelFontSize,
      L.labelBaselineFactor,
    );

    for (const { spell, startRow, layout } of plan.placements) {
      const y = B.spellTableStartY + startRow * B.spellTableRowH;

      if (spell.alwaysPrepared || spell.prepared) {
        this.drawFilledCircle(pdf, B.colPrepared, y - B.preparedMarkYOffset, 1.8);
      }

      pdf.setFontSize(10);
      this.text(pdf, spell.name, B.colName, y);

      this.drawGrimoireEffectLines(
        pdf,
        layout,
        pxToMmX(B.colEffect),
        pxToMmY(y),
        lineHMm,
        7,
      );

      if (spell.pageRef) {
        pdf.setFontSize(7);
        this.text(pdf, spell.pageRef, B.colPage, y);
      }
    }
  }

  /**
   * Écrit le niveau (M / 1–9) centré dans chaque médaillon ouroboros utilisé.
   */
  drawSpellLevelMedallions(
    pdf: jsPDF,
    rowLevels: { row: number; level: number }[],
    levelX: number,
    levelYs: readonly number[],
    rowsPerBand: number,
    fontSize = 10,
    baselineFactor = 0.14,
  ): void {
    if (!rowLevels.length || !levelYs.length) return;

    const bandLevel = new Map<number, number>();
    for (const { row, level } of rowLevels) {
      const band = Math.floor(row / rowsPerBand);
      if (band >= levelYs.length) continue;
      if (!bandLevel.has(band)) bandLevel.set(band, level);
    }

    pdf.setTextColor('#2c1810');
    pdf.setFontSize(fontSize);
    for (const [band, level] of bandLevel) {
      const label = level === 0 ? 'M' : String(level);
      const centerXMm = pxToMmX(levelX);
      const centerYMm = pxToMmY(levelYs[band]);
      const dims = pdf.getTextDimensions(label);
      pdf.text(label, centerXMm, centerYMm + dims.h * baselineFactor, { align: 'center' });
    }
  }

  /**
   * Remplit une page grimoire-supp.jpg à partir d'un plan (lignages multi-rang).
   */
  drawGrimoireSupp(pdf: jsPDF, plan: GrimoireTablePlan): void {
    if (!plan.placements.length) return;
    const dark = '#2c1810';
    pdf.setTextColor(dark);
    const S = SUPP_COORDS;
    const lineHMm = pxToMmY(S.rowH);
    const L = SPELL_TABLE_LEVEL;

    this.drawSpellLevelMedallions(
      pdf,
      plan.placements.map((p) => ({ row: p.startRow, level: p.spell.level })),
      S.levelX,
      S.levelYs,
      S.rowsPerBand,
      L.labelFontSize,
      L.labelBaselineFactor,
    );

    for (const { spell, startRow, layout } of plan.placements) {
      const y = S.tableStartY + startRow * S.rowH;

      if (spell.alwaysPrepared || spell.prepared) {
        this.drawFilledCircle(pdf, S.preparedX, y - 2, 1.8);
      }

      pdf.setFontSize(9);
      this.text(pdf, spell.name, S.nameX, y);

      this.drawGrimoireEffectLines(
        pdf,
        layout,
        pxToMmX(S.effectX),
        pxToMmY(y),
        lineHMm,
        6.5,
      );
    }
  }

  // =========================================================================
  // GRIMOIRE — Panneau droit (dispatch par kind)
  // Chaque grimoire a ses propres coordonnées.
  // =========================================================================

  drawGrimoirePanel(pdf: jsPDF, sc: CharacterSpellcasting): void {
    pdf.setFontSize(15);

    switch (sc.kind) {
      case 'bard':
        this.drawPanelBard(pdf, sc);
        break;
      case 'wizard':
        this.drawPanelWizard(pdf, sc);
        break;
      case 'cleric':
        this.drawPanelCleric(pdf, sc);
        break;
      case 'druid':
        this.drawPanelDruid(pdf, sc);
        break;
      case 'warlock':
        this.drawPanelWarlock(pdf, sc);
        break;
      case 'sorcerer':
        this.drawPanelSorcerer(pdf, sc);
        break;
    }
  }

  // --- BARDE ---
  drawPanelBard(pdf: jsPDF, sc: Extract<CharacterSpellcasting, { kind: 'bard' }>): void {
    const P = PANEL_BARD;

    // Police réduite (15 → 11 de base, avec repli auto jusqu'à 8) : le nom du collège
    // bardique (ex. « Collège des conteurs/bateleurs ») dépassait sinon le bord droit.
    if (sc.bardicCollege) {
      this.textFit(pdf, sc.bardicCollege, P.line1X, P.line1Y, 578 - P.line1X, 11);
    }
    pdf.setFontSize(15);
    if (sc.focus) {
      this.text(pdf, labelForGameId(sc.focus), P.line2X, P.line2Y);
    }
  }

  // --- MAGE ---
  drawPanelWizard(
    pdf: jsPDF,
    sc: Extract<CharacterSpellcasting, { kind: 'wizard' }>,
  ): void {
    const P = PANEL_WIZARD;

    // Même repli auto que le Barde : « École de la nécromancie/divination… » peut être long.
    if (sc.arcaneTradition) {
      this.textFit(pdf, sc.arcaneTradition, P.line1X, P.line1Y, 578 - P.line1X, 11);
    }
    pdf.setFontSize(15);
    if (sc.focus) {
      this.text(pdf, labelForGameId(sc.focus), P.line2X, P.line2Y);
    }

    pdf.setFontSize(7);
    let y = P.line2Y + 28;
    if (sc.spellMastery?.length) {
      for (const m of sc.spellMastery) {
        this.text(pdf, `Maîtrise ${m.spellLevel} : ${m.spellName}`, P.line1X, y);
        y += 12;
      }
    }
    if (sc.signatureSpells?.length) {
      for (const s of sc.signatureSpells) {
        this.text(pdf, `Attitré : ${s.spellName}`, P.line1X, y);
        y += 12;
      }
    }
  }

  // --- PRÊTRE ---
  drawPanelCleric(
    pdf: jsPDF,
    sc: Extract<CharacterSpellcasting, { kind: 'cleric' }>,
  ): void {
    const P = PANEL_CLERIC;
    pdf.setFontSize(P.valueFontSize);

    // Divinité — Domaine
    const deityDomain = [sc.deity, sc.domain].filter(Boolean).join(' — ');
    if (deityDomain) {
      this.textWrapped(pdf, deityDomain, P.line1X, P.line1Y, pxToMmX(130), 3.5, 1);
    }

    // Symbole sacré (champ « Focaliseur arcanique » sur la fiche)
    if (sc.focus) {
      pdf.setFontSize(P.focusFontSize);
      this.text(pdf, labelForGameId(sc.focus), P.line2X, P.line2Y);
    }

    // Conduits divins
    if (sc.divineChannels.length > 0) {
      pdf.setFontSize(8);
      sc.divineChannels.forEach(
        (ch: { name: string; uses: { current: number; max: number } }, i: number) => {
          if (i < 4) {
            this.text(
              pdf,
              `${ch.name} (${ch.uses.current}/${ch.uses.max})`,
              P.channelsX,
              P.channelsStartY + i * P.channelsSpacing,
            );
          }
        },
      );
    }
  }

  // --- DRUIDE ---
  drawPanelDruid(pdf: jsPDF, sc: Extract<CharacterSpellcasting, { kind: 'druid' }>): void {
    const P = PANEL_DRUID;

    // Cercle druidique (ex. « Cercle de la lune/terre… ») : même repli auto que les autres classes.
    if (sc.druidCircle) {
      this.textFit(pdf, sc.druidCircle, P.line1X, P.line1Y, 578 - P.line1X, 11);
    }

    pdf.setFontSize(10);

    // Focaliseur arcanique
    if (sc.focus) {
      this.text(pdf, labelForGameId(sc.focus), P.line2X, P.line2Y);
    }

    // Cases à cocher
    if (sc.circleSpells && sc.circleSpells.length > 0) {
      this.drawFilledCircle(pdf, P.circleSpellsCheckX, P.circleSpellsCheckY, 1.8);
    }
    if (sc.mysticTranceAvailable) {
      this.drawFilledCircle(pdf, P.mysticTranceCheckX, P.mysticTranceCheckY, 1.8);
    }

    // Sorts de cercle (lignes de notes)
    if (sc.circleSpells && sc.circleSpells.length > 0) {
      pdf.setFontSize(8);
      sc.circleSpells.forEach((sp: string, i: number) => {
        if (i < 6) {
          this.text(pdf, sp, P.notesX, P.notesStartY + i * P.notesSpacing);
        }
      });
    }
  }

  // --- SORCIER (Warlock) ---
  drawPanelWarlock(
    pdf: jsPDF,
    sc: Extract<CharacterSpellcasting, { kind: 'warlock' }>,
  ): void {
    const P = PANEL_WARLOCK;

    // Suzerain (patron) et Pacte : même repli auto (ex. « Le Grand Ancien », « Pacte de la Lame »).
    if (sc.patron) {
      this.textFit(pdf, sc.patron, P.line1X, P.line1Y, 578 - P.line1X, 11);
    }
    if (sc.pact) {
      this.textFit(pdf, sc.pact, P.line2X, P.line2Y, 578 - P.line2X, 11);
    }

    pdf.setFontSize(15);
    // Focaliseur arcanique
    if (sc.focus) {
      this.text(pdf, labelForGameId(sc.focus), P.line3X, P.line3Y);
    }

    // Manifestations occultes (invocations)
    if (sc.eldritchInvocations.length > 0) {
      pdf.setFontSize(8);
      sc.eldritchInvocations.forEach((inv: string, i: number) => {
        if (i < 8) {
          this.text(pdf, inv, P.invocationsX, P.invocationsStartY + i * P.invocationsSpacing);
        }
      });
    }

    // Arcanes (haut niveau)
    if (sc.mysticArcanum?.length) {
      pdf.setFontSize(7);
      const baseY = P.invocationsStartY + Math.min(sc.eldritchInvocations.length, 8) * P.invocationsSpacing + 8;
      sc.mysticArcanum.forEach((a, i) => {
        this.text(
          pdf,
          `Arcane ${a.spellLevel} : ${a.spellName}`,
          P.invocationsX,
          baseY + i * 14,
        );
      });
    }
  }

  // --- ENSORCELEUR ---
  drawPanelSorcerer(
    pdf: jsPDF,
    sc: Extract<CharacterSpellcasting, { kind: 'sorcerer' }>,
  ): void {
    const P = PANEL_SORCERER;

    // Atavisme (origine) : même repli auto (ex. « Lignée draconique », « Origine sauvage »).
    if (sc.atavism) {
      this.textFit(pdf, sc.atavism, P.line1X, P.line1Y, 578 - P.line1X, 11);
    }

    pdf.setFontSize(15);
    // Focaliseur arcanique
    if (sc.focus) {
      this.text(pdf, labelForGameId(sc.focus), P.line2X, P.line2Y);
    }

    // Points arcaniques
    if (sc.sorceryPoints) {
      pdf.setFontSize(12);
      this.text(
        pdf,
        `${sc.sorceryPoints.current}/${sc.sorceryPoints.max}`,
        P.pointsValueX,
        P.pointsY,
      );
    }

    // Métamagie (libellés FR, repli largeur pour les noms longs)
    if (sc.metamagic.length > 0) {
      sc.metamagic.forEach((mm: string, i: number) => {
        if (i < 5) {
          this.textFit(pdf, mm, P.metamagicX, P.metamagicStartY + i * P.metamagicSpacing, 578 - P.metamagicX, 8);
        }
      });
    }
  }

  // =========================================================================
  // GRIMOIRE GUERRIER / RÔDEUR / PALADIN
  // =========================================================================

  drawGrimoireGRP(pdf: jsPDF, c: Character): void {
    if (!c.spellcasting) return;
    const sc = c.spellcasting;
    const dark = '#2c1810';
    pdf.setTextColor(dark);
    const fmt = (n: number) => this.formatBonus(n);
    const G = GRP_COORDS;

    // Nom du personnage
    pdf.setFontSize(15);
    this.text(pdf, c.name, G.nameX, G.nameY);

    // DD / Mod commun
    pdf.setFontSize(14);
    this.text(pdf, String(sc.spellSaveDC), G.saveDCX, G.saveDCY);
    this.text(pdf, fmt(sc.spellAttackBonus), G.attackModX, G.attackModY);

    switch (sc.kind) {
      case 'ranger': {
        pdf.setFontSize(14);
        this.text(pdf, String(sc.knownSpellsCount), G.rodeurSortsConnusX, G.rodeurSortsConnusY);
        pdf.setFontSize(10);
        if (sc.focus) this.text(pdf, labelForGameId(sc.focus), G.rodeurFocaliseurX, G.rodeurFocaliseurY);
        break;
      }
      case 'paladin': {
        pdf.setFontSize(10);
        if (sc.oath) this.text(pdf, sc.oath, G.paladinSermentX, G.paladinSermentY);
        if (sc.oathSpells.length > 0) {
          pdf.setFontSize(9);
          sc.oathSpells.forEach((o, i) => {
            if (i < 5) {
              const spells = o.spells.join(', ');
              const maxLen = 28;
              this.text(
                pdf,
                spells.length > maxLen ? spells.substring(0, maxLen) + '…' : spells,
                G.paladinOathSpellsX,
                G.paladinOathSpellsYs[i],
              );
            }
          });
        }
        break;
      }
      case 'fighter_eldritch_knight': {
        pdf.setFontSize(10);
        if (sc.soulWeapon) {
          this.text(pdf, sc.soulWeapon.name, G.guerrierArmeSoeurX, G.guerrierArmeSoeurY);
          pdf.setFontSize(9);
          this.text(
            pdf,
            String(sc.soulWeapon.bondedAbilityModifiers.intelligence),
            G.guerrierIntX,
            G.guerrierIntY,
          );
          this.text(
            pdf,
            String(sc.soulWeapon.bondedAbilityModifiers.sagesse),
            G.guerrierSagX,
            G.guerrierSagY,
          );
          this.text(
            pdf,
            String(sc.soulWeapon.bondedAbilityModifiers.charisme),
            G.guerrierChaX,
            G.guerrierChaY,
          );
        }
        pdf.setFontSize(8);
        if (sc.magicAbility === 'Intelligence') {
          this.drawFilledCircle(pdf, G.guerrierMagicIntCheckX, G.guerrierMagicIntCheckY, 1.5);
        } else if (sc.magicAbility === 'Charisme') {
          this.drawFilledCircle(pdf, G.guerrierMagicChaCheckX, G.guerrierMagicChaCheckY, 1.5);
        }
        pdf.setFontSize(14);
        this.text(pdf, String(sc.spellSaveDC), G.guerrierSaveDCX, G.guerrierSaveDCY);
        this.text(pdf, fmt(sc.spellAttackBonus), G.guerrierAttackModX, G.guerrierAttackModY);
        break;
      }
    }

    // Liste compacte des sorts connus (la table GRP n’a pas de grille de sorts).
    const known = (c.knownSpells ?? [])
      .map((s) => s.name)
      .filter(Boolean)
      .slice(0, 18);
    if (known.length) {
      pdf.setFontSize(8);
      this.textWrapped(
        pdf,
        `Sorts connus : ${known.join(', ')}${(c.knownSpells?.length ?? 0) > 18 ? '…' : ''}`,
        G.nameX,
        320,
        160,
        7,
        4,
      );
    }
  }
}
