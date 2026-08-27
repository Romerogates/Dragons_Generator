// features/character-sheet/services/pdf-generator.service.ts
import { Injectable } from '@angular/core';
import type { jsPDF } from 'jspdf';
import { labelForGameId } from '@core/utils/game-id-labels';
import {
  Character,
  Attack,
  AbilityScores,
  Ability,
  SpellInstance,
  CharacterSpellcasting,
  SpellcastingKind,
} from '@core/models/Character/character';

// ---------------------------------------------------------------------------
// Coordonnées : les images de fond mesurent 595 × 842 px.
// Le PDF A4 mesure 210 × 297 mm.
// ---------------------------------------------------------------------------
const SCALE_X = 210 / 595;
const SCALE_Y = 297 / 842;

function pxToMmX(px: number): number {
  return px * SCALE_X;
}
function pxToMmY(px: number): number {
  return px * SCALE_Y;
}

// ---------------------------------------------------------------------------
// Correspondance kind → image de grimoire
// ---------------------------------------------------------------------------
const GRIMOIRE_IMAGES: Record<SpellcastingKind, string> = {
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

/** Page de continuation — sorts qui ne tiennent pas sur le grimoire principal. */
const GRIMOIRE_SUPP_IMAGE = '/images/sheets/grimoires/grimoire-supp.jpg';

// ---------------------------------------------------------------------------
// Coordonnées BASE (côté gauche) — partagées par tous les casters standards
// ⚠️ ESTIMATIONS — à calibrer avec le PDF réel
// ---------------------------------------------------------------------------
interface GrimoireBaseCoords {
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
  colName: number;
  colEffect: number;
  colPage: number;
}

/**
 * Coordonnées page supplémentaire (image native 1241×1754 → espace 595×842).
 * 25 lignes, 6 médaillons « Niveau » à gauche.
 */
/**
 * Coordonnées page supplémentaire (image native 1241×1754 → espace 595×842).
 * 6 médaillons ouroboros × ~5 lignes.
 */
const SUPP_COORDS = {
  /** Centre X des médaillons ouroboros (niveau). */
  levelX: 46,
  /** Centres Y des 6 médaillons (alignés sur la 1re ligne de chaque bande). */
  levelYs: [172, 284, 396, 508, 620, 732],
  /** Lignes par bande de niveau. */
  rowsPerBand: 5,
  preparedX: 76,
  nameX: 101,
  effectX: 288,
  effectEndX: 537,
  /** Baseline texte de la 1re ligne imprimée. */
  tableStartY: 168,
  rowH: 22.5,
  maxRows: 30,
};

/** Médaillons « Niveau » du tableau de sorts (grimoires classes standards). */
const SPELL_TABLE_LEVEL = {
  levelX: 42,
  levelYs: [500, 613, 724],
  rowsPerBand: 5,
};

const BASE_COORDS: GrimoireBaseCoords = {
  nameX: 130,
  nameY: 160,
  abilityX: 94,
  abilityY: 241,
  saveDCX: 110,
  saveDCY: 325,
  attackModX: 110,
  attackModY: 405,
  cantripY: 220,
  cantripXStart: 260,
  cantripSpacing: 15,
  slotXStart: 261,
  slotSpacing: 15,
  slotRows: [
    { y: 255, maxCircles: 4 }, // 1er
    { y: 250, maxCircles: 3 }, // 2e  ← vérifier, semble inversé avec le 1er
    { y: 274, maxCircles: 3 }, // 3e
    { y: 296, maxCircles: 3 }, // 4e
    { y: 318, maxCircles: 3 }, // 5e
    { y: 340, maxCircles: 2 }, // 6e
    { y: 362, maxCircles: 2 }, // 7e
    { y: 384, maxCircles: 1 }, // 8e
    { y: 406, maxCircles: 1 }, // 9e
  ],
  /** 1re ligne du tableau (juste au-dessus du lignage ~492). */
  spellTableStartY: 490,
  spellTableRowH: 22.5,
  spellTableMaxRows: 12,
  colPrepared: 82,
  colName: 95,
  colEffect: 276,
  colPage: 530,
};

// ---------------------------------------------------------------------------
// Coordonnées PANNEAU DROIT — une config par grimoire
// Chaque grimoire a ses propres positions pour l'encart de classe.
// ⚠️ ESTIMATIONS — à calibrer avec le PDF réel
// ---------------------------------------------------------------------------

// Barde : "Magie Bardique" → Collège bardique, Focaliseur arcanique
const PANEL_BARD = {
  line1X: 450, // Collège bardique (valeur)
  line1Y: 255,
  line2X: 450, // Focaliseur arcanique (valeur)
  line2Y: 310,
};

// Mage : "Magie Arcanique" → Tradition arcanique, Focaliseur arcanique
const PANEL_WIZARD = {
  line1X: 450, // Tradition arcanique (valeur)
  line1Y: 250,
  line2X: 450, // Focaliseur arcanique (valeur)
  line2Y: 305,
};

// Prêtre : "Magie Divine" → Divinité–Domaine, Focaliseur arcanique, Conduits divins
// Lignes mesurées sur grimoire-pretre.jpg (espace 595×842)
const PANEL_CLERIC = {
  line1X: 448, // Divinité — Domaine (valeur sur la ligne sous le label)
  line1Y: 258,
  line2X: 448, // Focaliseur arcanique
  line2Y: 285,
  channelsStartY: 365,
  channelsSpacing: 22,
  channelsX: 448,
  valueFontSize: 10,
};

// Druide : "Magie druidique" → Cercle, Focaliseur, cases à cocher, notes
const PANEL_DRUID = {
  line1X: 450, // Cercle druidique (valeur)
  line1Y: 245,
  line2X: 435, // Focaliseur arcanique (valeur)
  line2Y: 268,
  circleSpellsCheckX: 443, // case "Sorts de cercle"
  circleSpellsCheckY: 345,
  mysticTranceCheckX: 443, // case "Transe mystique"
  mysticTranceCheckY: 368,
  notesX: 440,
  notesStartY: 410,
  notesSpacing: 22,
};

// Sorcier : "Sorcellerie" → Suzerain, Pacte, Focaliseur, Manifestations occultes
const PANEL_WARLOCK = {
  line1X: 450, // Suzerain (valeur)
  line1Y: 248,
  line2X: 450, // Pacte (valeur)
  line2Y: 295,
  line3X: 450, // Focaliseur arcanique (valeur)
  line3Y: 345,
  invocationsX: 450, // Manifestations occultes (titre)
  invocationsStartY: 400,
  invocationsSpacing: 18,
};

// Ensorceleur : "Ensorcellement" → Atavisme, Focaliseur, Points arcaniques, Métamagie
const PANEL_SORCERER = {
  line1X: 450, // Atavisme (valeur)
  line1Y: 245,
  line2X: 435, // Focaliseur arcanique (valeur)
  line2Y: 280,
  pointsLabelX: 440, // Points arcaniques (valeur dans l'ovale)
  pointsValueX: 530,
  pointsY: 350,
  metamagicX: 440,
  metamagicStartY: 395,
  metamagicSpacing: 22,
};

// ---------------------------------------------------------------------------
// Coordonnées GRIMOIRE MARTIAL (Guerrier / Rôdeur / Paladin)
// Layout complètement différent
// ⚠️ ESTIMATIONS — à calibrer avec le PDF réel
// ---------------------------------------------------------------------------
const GRP_COORDS = {
  nameX: 150,
  nameY: 300,
  // Aptitudes magiques — cases à cocher (haut-droite)
  rodeurCheckX: 665,
  rodeurCheckY: 300,
  paladinCheckX: 665,
  paladinCheckY: 330,
  guerrierCheckX: 665,
  guerrierCheckY: 360,
  // DD / Mod commun Rôdeur+Paladin
  saveDCX: 470,
  saveDCY: 340,
  attackModX: 545,
  attackModY: 340,
  // Rôdeur
  rodeurSortsConnusX: 100,
  rodeurSortsConnusY: 205,
  rodeurFocaliseurX: 70,
  rodeurFocaliseurY: 420,
  // Paladin
  paladinSermentX: 310,
  paladinSermentY: 185,
  paladinOathSpellsX: 310,
  paladinOathSpellsYs: [432, 457, 482, 507, 532],
  // Guerrier Élu arcanique
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

// ---------------------------------------------------------------------------
// Coordonnées PAGE 2 — Aptitudes
// ⚠️ ESTIMATIONS — à calibrer avec le PDF réel
// ---------------------------------------------------------------------------
const PAGE2 = {
  // --- Armures & Armes (haut-gauche) ---
  armorX: 125,
  armorYs: [100, 124],
  weaponX: 125,
  weaponYs: [148, 172],

  // --- Résistances & immunités (haut-droite) ---
  resX: 380,
  resYs: [100, 124, 148, 172, 194],

  // --- Outils & véhicules (colonne milieu) ---
  toolX: 210,
  // --- Langues (colonne droite) ---
  langX: 396,
  // Lignes partagées outils/langues (zone "Usage illimité")
  middleYs: [255, 277, 299, 320, 342, 364, 386, 408, 430, 452],

  // --- Features "Usage illimité" (colonne gauche) ---
  unlimitedNameX: 15,
  unlimitedUsesX: 170,
  unlimitedStartY: 255,
  unlimitedLineH: 22,
  unlimitedMaxLines: 10,

  // --- Features "Regain en repos court" (sous la zone illimitée) ---
  shortRestNameX: 20,
  shortRestUsesX: 210,
  shortRestStartY: 525,
  shortRestLineH: 22,
  shortRestMaxLines: 4,
  // Colonne droite repos court (pour débordement)
  shortRestCol2NameX: 205,
  shortRestCol2UsesX: 360,

  // --- Features "Regain en repos long" ---
  longRestNameX: 20,
  longRestUsesX: 210,
  longRestStartY: 670,
  longRestLineH: 22,
  longRestMaxLines: 6,
  // Colonne droite repos long
  longRestCol2NameX: 204,
  longRestCol2UsesX: 360,

  // --- Emplacements de sorts (parchemin bas-droite) ---
  spellSlotX: 474,
  spellSlotStartY: 546,
  spellSlotRowH: 22,
  spellSlotCircleSpacing: 15,
  spellSlotMaxPerRow: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};

@Injectable({
  providedIn: 'root',
})
export class PdfGeneratorService {
  // =========================================================================
  // API PUBLIQUE
  // =========================================================================

  async generatePdf(character: Character): Promise<void> {
    const pdf = await this.buildPdf(character);
    pdf.save(`${character.name || 'personnage'}.pdf`);
  }

  /**
   * Génère le PDF et retourne une blob URL pour l'aperçu in-page.
   * Penser à appeler URL.revokeObjectURL() quand l'URL n'est plus nécessaire.
   */
  async generatePdfBlob(character: Character): Promise<string> {
    const pdf = await this.buildPdf(character);
    const blob = pdf.output('blob');
    return URL.createObjectURL(blob);
  }

  // =========================================================================
  // CONSTRUCTION DU PDF (logique commune)
  // =========================================================================

  private async buildPdf(character: Character): Promise<jsPDF> {
    // Lazy-load jspdf (+ deps) only when exporting — keeps wizard/navigation snappy
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const images = await this.loadBackgroundImages();

    // === PAGE 1 ===
    pdf.addImage(images[0], 'JPEG', 0, 0, 210, 297);
    this.drawPage1(pdf, character);

    // === PAGE 2 ===
    pdf.addPage();
    pdf.addImage(images[1], 'JPEG', 0, 0, 210, 297);
    this.drawPage2(pdf, character);

    // === PAGE 3 ===
    pdf.addPage();
    pdf.addImage(images[2], 'JPEG', 0, 0, 210, 297);
    this.drawPage3(pdf, character);

    // === PAGE 4 ===
    pdf.addPage();
    pdf.addImage(images[3], 'JPEG', 0, 0, 210, 297);
    this.drawPage4(pdf, character);

    // === PAGE 5 — Grimoire (optionnel) ===
    if (character.spellcasting) {
      const grimoireUrl = GRIMOIRE_IMAGES[character.spellcasting.kind];
      const grimoireImg = await this.loadImage(grimoireUrl);
      pdf.addPage();
      pdf.addImage(grimoireImg, 'JPEG', 0, 0, 210, 297);
      this.drawGrimoire(pdf, character);

      // Pages supplémentaires si trop de sorts (ou table absente sur GRP)
      const overflow = this.getGrimoireOverflowSpells(character);
      if (overflow.length > 0) {
        const suppImg = await this.loadImage(GRIMOIRE_SUPP_IMAGE);
        const pages = this.chunkSpellsForSuppPages(overflow);
        for (const pageSpells of pages) {
          pdf.addPage();
          pdf.addImage(suppImg, 'JPEG', 0, 0, 210, 297);
          this.drawGrimoireSupp(pdf, pageSpells);
        }
      }
    }

    return pdf;
  }

  // =========================================================================
  // CHARGEMENT DES IMAGES
  // =========================================================================

  private async loadBackgroundImages(): Promise<string[]> {
    const urls = [
      '/images/sheets/sheet-page1.jpg',
      '/images/sheets/sheet-page2.jpg',
      '/images/sheets/sheet-page3.jpg',
      '/images/sheets/sheet-page4.jpg',
    ];
    return Promise.all(urls.map((u) => this.loadImage(u)));
  }

  private loadImage(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  // =========================================================================
  // HELPERS TEXTE
  // =========================================================================

  private text(pdf: jsPDF, text: string, xPx: number, yPx: number): void {
    if (!text && text !== '0') return;
    pdf.text(String(text), pxToMmX(xPx), pxToMmY(yPx));
  }

  private textWrapped(
    pdf: jsPDF,
    text: string,
    xPx: number,
    yPx: number,
    maxWidthMm: number,
    lineHeightMm: number = 4,
    maxLines?: number, // <-- Ajout du paramètre optionnel
  ): void {
    if (!text) return;
    let lines = pdf.splitTextToSize(text, maxWidthMm);

    // Si une limite de lignes est définie, on coupe le tableau
    if (maxLines && maxLines > 0) {
      lines = lines.slice(0, maxLines);
    }

    let currentY = pxToMmY(yPx);
    lines.forEach((line: string) => {
      pdf.text(line, pxToMmX(xPx), currentY);
      currentY += lineHeightMm;
    });
  }

  // =========================================================================
  // HELPERS CERCLES
  // =========================================================================

  private drawFilledCircle(pdf: jsPDF, xPx: number, yPx: number, radiusMm: number = 2.1): void {
    pdf.setFillColor('#2c1810');
    pdf.circle(pxToMmX(xPx), pxToMmY(yPx), radiusMm, 'F');
  }

  private drawEmptyCircle(pdf: jsPDF, xPx: number, yPx: number, radiusMm: number = 0): void {
    pdf.setDrawColor('#2c1810');
    pdf.setLineWidth(0.3);
    pdf.circle(pxToMmX(xPx), pxToMmY(yPx), radiusMm, 'S');
  }

  private drawProfCircle(pdf: jsPDF, isProficient: boolean, xPx: number, yPx: number): void {
    if (isProficient) {
      this.drawFilledCircle(pdf, xPx, yPx);
    } else {
      this.drawEmptyCircle(pdf, xPx, yPx);
    }
  }

  // =========================================================================
  // HELPERS FORMAT
  // =========================================================================

  private formatBonus(value: number): string {
    return value >= 0 ? `+${value}` : `${value}`;
  }

  private shortenDamageType(dt: string): string {
    const map: Record<string, string> = {
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
    return map[dt.toLowerCase()] || dt;
  }

  /**
   * Nettoie un ID technique pour affichage lisible.
   * Délègue au dictionnaire central (game-id-labels).
   */
  private prettify(id: string): string {
    return labelForGameId(id);
  }

  // =========================================================================
  // PAGE 1
  // =========================================================================

  private drawPage1(pdf: jsPDF, c: Character): void {
    const dark = '#2c1810';
    pdf.setTextColor(dark);
    const fmt = (n: number) => this.formatBonus(n);

    const speciesLabel = c.species.subspeciesLabel
      ? `${c.species.label} (${c.species.subspeciesLabel})`
      : c.species.label;
    const classLabel = (() => {
      const cls = c.classes[0];
      return cls.subclassLabel
        ? `${cls.classLabel} (${cls.subclassLabel})`
        : cls.classLabel;
    })();

    pdf.setFontSize(15);
    this.text(pdf, c.name, 140, 43);
    this.text(pdf, speciesLabel, 140, 66);
    this.text(pdf, c.civilization.label, 140, 90);
    this.text(pdf, classLabel, 400, 43);
    // Emplacement « Niveau » sur la fiche (pas les XP — un perso niv. 1 a 0 XP).
    const pdfLevel = Math.max(1, c.totalLevel || c.classes[0]?.level || 1);
    this.text(pdf, String(pdfLevel), 400, 90);

    this.text(pdf, String(c.vitality.hitPointsCurrent), 230, 123);
    this.text(pdf, String(c.vitality.hitPointsTemporary), 250, 171);
    this.text(pdf, `1d${c.classes[0].hitDie}`, 438, 123);

    pdf.setFontSize(15);
    this.text(pdf, `+${c.proficiencyBonus}`, 55, 173);
    this.text(pdf, String(c.vitality.hitPointsMax), 370, 171);
    this.text(pdf, String(c.vitality.woundThreshold), 530, 171);
    this.text(pdf, fmt(c.initiative), 270, 220);
    this.text(pdf, String(c.senses.passivePerception), 520, 220);

    pdf.setFontSize(15);
    this.text(pdf, String(c.defense.armorClass), 360, 220);

    pdf.setFontSize(15);
    this.text(pdf, String(c.abilities.force), 118, 221);
    this.text(pdf, String(c.abilities.dexterite), 118, 291);
    this.text(pdf, String(c.abilities.constitution), 118, 388);
    this.text(pdf, String(c.abilities.intelligence), 118, 442);
    this.text(pdf, String(c.abilities.sagesse), 118, 565);
    this.text(pdf, String(c.abilities.charisme), 118, 700);

    pdf.setFontSize(10);
    this.text(pdf, fmt(c.abilityModifiers.force), 165, 225);
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
    this.text(pdf, String(c.movement.walk), 238, 360);
    this.text(pdf, String(c.movement.climb), 312, 360);
    this.text(pdf, String(c.movement.swim), 365, 360);
    this.text(pdf, String(c.movement.jumpHeight), 286, 381);
    this.text(pdf, String(c.movement.jumpLength), 361, 381);

    const attackTops = [476, 500, 523, 545, 570];
    const colName = 210;
    const colBonus = 450;
    const colDamage = 515;

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
        (e) => e.refId.startsWith('wp-') || (e.customData as any)?.isWeapon === true,
      );
      weapons.slice(0, 5).forEach((item, i) => {
        this.text(pdf, item.name, colName, attackTops[i]);
      });
    }
  }

  // =========================================================================
  // PAGE 2
  // =========================================================================

  private drawPage2(pdf: jsPDF, c: Character): void {
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
  private drawPage2Proficiencies(pdf: jsPDF, c: Character): void {
    const P = PAGE2;
    pdf.setFontSize(15);

    c.proficiencies.armor.slice(0, 2).forEach((a, i) => {
      this.text(pdf, this.prettify(a), P.armorX, P.armorYs[i]);
    });

    c.proficiencies.weapons.slice(0, 2).forEach((w, i) => {
      this.text(pdf, this.prettify(w), P.weaponX, P.weaponYs[i]);
    });
  }

  /**
   * Résistances & immunités (haut-droite).
   * Inclut la darkvision, les résistances d'espèce, et les immunités.
   */
  private drawPage2Resistances(pdf: jsPDF, c: Character): void {
    const P = PAGE2;
    pdf.setFontSize(15);

    const entries: string[] = [];

    if (c.senses.hasDarkvision) {
      entries.push(`Vision dans le noir (${c.senses.darkvisionRadius}m)`);
    }

    c.defense.resistances.forEach((r) => entries.push(`Rés. ${r}`));
    c.defense.immunities.forEach((im) => entries.push(`Imm. ${im}`));
    c.defense.conditionImmunities.forEach((ci) => entries.push(`Imm. ${ci}`));

    entries.slice(0, P.resYs.length).forEach((entry, i) => {
      this.text(pdf, entry, P.resX, P.resYs[i]);
    });
  }

  /**
   * Outils & véhicules (colonne milieu) + Langues (colonne droite).
   */
  private drawPage2ToolsAndLanguages(pdf: jsPDF, c: Character): void {
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
  private drawPage2Features(pdf: jsPDF, c: Character): void {
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
    ]);

    const allFeatures = c.features.filter((f) => !EXCLUDED_IDS.has(f.refId ?? ''));

    // Trier par source : species/subspecies d'abord, puis class/subclass
    const sortBySource = (a: any, b: any) => {
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
    );
  }

  /**
   * Dessine une liste de features avec nom + cercles d'utilisation.
   */
  private drawFeatureLines(
    pdf: jsPDF,
    features: any[],
    nameX: number,
    usesX: number,
    startY: number,
    lineH: number,
    maxLines: number,
  ): void {
    pdf.setFontSize(10);

    features.slice(0, maxLines).forEach((feat, i) => {
      const y = startY + i * lineH;

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

      this.text(pdf, label, nameX, y);

      // Dessiner des cercles cochables si l'aptitude a un nombre d'utilisations
      if (feat.uses && feat.uses.max > 0 && feat.uses.max <= 10) {
        const circleRadius = 2;
        const circleSpacing = 11;
        for (let u = 0; u < feat.uses.max; u++) {
          this.drawEmptyCircle(pdf, usesX + u * circleSpacing, y - 2, circleRadius);
        }
      }
    });
  }

  /**
   * Cercles d'emplacements de sorts (parchemin bas-droite de la page 2).
   */
  private drawPage2SpellSlots(pdf: jsPDF, sc: CharacterSpellcasting): void {
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

  private drawPage3(pdf: jsPDF, c: Character): void {
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
  }

  // =========================================================================
  // PAGE 4
  // =========================================================================

  private drawPage4(pdf: jsPDF, c: Character): void {
    const dark = '#2c1810';
    pdf.setTextColor(dark);
    pdf.setFontSize(10);

    const equipTops = [175, 197, 219, 242, 264, 287, 309, 333, 356, 375, 399, 421];
    c.equipment.forEach((item, i) => {
      if (i < 12) {
        const label = item.qty > 1 ? `${item.name} x${item.qty}` : item.name;
        this.text(pdf, label, 66, equipTops[i]);
      }
    });
    if (c.equipment[12]) this.text(pdf, c.equipment[12].name, 222, 168);
    if (c.equipment[13]) this.text(pdf, c.equipment[13].name, 223, 188);

    this.text(pdf, `${c.currency.or} po`, 71, 486);
    this.text(pdf, `${c.currency.argent} pa`, 71, 507);
    this.text(pdf, `${c.currency.cuivre} pc`, 70, 531);
    this.text(pdf, `${c.carryCapacity.maxKg} kg`, 413, 245);
  }

  // =========================================================================
  // PAGE 5 — GRIMOIRE (dispatcher)
  // =========================================================================

  private drawGrimoire(pdf: jsPDF, c: Character): void {
    if (!c.spellcasting) return;
    const dark = '#2c1810';
    pdf.setTextColor(dark);
    const sc = c.spellcasting;

    // Les martiaux ont un layout complètement différent
    if (sc.kind === 'ranger' || sc.kind === 'paladin' || sc.kind === 'fighter_eldritch_knight') {
      this.drawGrimoireGRP(pdf, c);
      return;
    }

    // === PARTIE GAUCHE : commune à tous les casters standards ===
    this.drawGrimoireBase(pdf, c);

    // === PARTIE DROITE : spécifique à chaque classe ===
    this.drawGrimoirePanel(pdf, sc);
  }

  // =========================================================================
  // GRIMOIRE — Base commune (côté gauche + table de sorts)
  // =========================================================================

  private drawGrimoireBase(pdf: jsPDF, c: Character): void {
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

    // Table des sorts
    this.drawSpellTable(pdf, c);
  }

  // =========================================================================
  // GRIMOIRE — Cercles sorts mineurs
  // =========================================================================

  private drawCantripCircles(pdf: jsPDF, sc: CharacterSpellcasting): void {
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

  private drawSpellSlotCircles(pdf: jsPDF, sc: CharacterSpellcasting): void {
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

  private sortedKnownSpells(c: Character): SpellInstance[] {
    if (!c.knownSpells?.length) return [];
    return [...c.knownSpells].sort(
      (a, b) => a.level - b.level || a.name.localeCompare(b.name),
    );
  }

  /**
   * Sorts qui ne tiennent pas sur le grimoire principal.
   * GRP n'a pas de table → tous les sorts partent en page(s) supp.
   * Les sorts à effet 2 lignes consomment 2 lignages imprimés.
   */
  private getGrimoireOverflowSpells(c: Character): SpellInstance[] {
    if (!c.spellcasting) return [];
    const sorted = this.sortedKnownSpells(c);
    if (!sorted.length) return [];

    const kind = c.spellcasting.kind;
    const isGrp =
      kind === 'ranger' || kind === 'paladin' || kind === 'fighter_eldritch_knight';
    if (isGrp) return sorted;

    return this.layoutSpellsOnMainTable(sorted).overflow;
  }

  /**
   * Place les sorts sur les lignages du tableau principal.
   * Un sort tient sur 1 ligne, ou 2 si l'effet wrap (2e ligne alignée sur le lignage suivant).
   */
  private layoutSpellsOnMainTable(sorted: SpellInstance[]): {
    entries: { spell: SpellInstance; row: number; effectLines: string[] }[];
    overflow: SpellInstance[];
  } {
    const B = BASE_COORDS;
    const effectWidthMm = pxToMmX(B.colPage - B.colEffect - 8);
    // jsPDF n'est pas dispo ici → estimation largeur caractères (~2.1 mm à 7pt)
    const approxCharW = 1.85;
    const maxChars = Math.max(20, Math.floor(effectWidthMm / approxCharW));

    const entries: { spell: SpellInstance; row: number; effectLines: string[] }[] = [];
    const overflow: SpellInstance[] = [];
    let row = 0;

    for (const spell of sorted) {
      const effectLines = this.wrapEffectPreview(spell.effectSummary ?? '', maxChars, 2);
      const rowsNeeded = Math.max(1, effectLines.length);
      if (row + rowsNeeded > B.spellTableMaxRows) {
        overflow.push(spell);
        // Tous les suivants débordent aussi (ordre conservé)
        const idx = sorted.indexOf(spell);
        overflow.push(...sorted.slice(idx + 1));
        break;
      }
      entries.push({ spell, row, effectLines });
      row += rowsNeeded;
    }

    return { entries, overflow };
  }

  /** Découpe un effet en 1–2 lignes (approx. largeur colonne), sans jsPDF. */
  private wrapEffectPreview(text: string, maxChars: number, maxLines: number): string[] {
    if (!text) return [''];
    if (text.length <= maxChars) return [text];
    const lines: string[] = [];
    let rest = text;
    while (rest.length > 0 && lines.length < maxLines) {
      if (rest.length <= maxChars) {
        lines.push(rest);
        break;
      }
      let breakAt = rest.lastIndexOf(' ', maxChars);
      if (breakAt < maxChars * 0.4) breakAt = maxChars;
      lines.push(rest.slice(0, breakAt).trimEnd());
      rest = rest.slice(breakAt).trimStart();
    }
    if (lines.length === maxLines && rest.length > 0) {
      const last = lines[maxLines - 1];
      lines[maxLines - 1] =
        last.length > 3 ? last.slice(0, Math.max(0, last.length - 1)) + '…' : last + '…';
    }
    return lines.length ? lines : [''];
  }

  private drawSpellTable(pdf: jsPDF, c: Character): void {
    const B = BASE_COORDS;
    const sorted = this.sortedKnownSpells(c);
    if (!sorted.length) return;

    const effectWidthMm = pxToMmX(B.colPage - B.colEffect - 8);
    const lineHMm = pxToMmY(B.spellTableRowH);
    const { entries } = this.layoutSpellsOnMainTable(sorted);

    // Niveaux dans les médaillons ouroboros (1re ligne de chaque bande)
    this.drawSpellLevelMedallions(
      pdf,
      entries.map((e) => ({ row: e.row, level: e.spell.level })),
      SPELL_TABLE_LEVEL.levelX,
      SPELL_TABLE_LEVEL.levelYs,
      SPELL_TABLE_LEVEL.rowsPerBand,
    );

    for (const { spell, row, effectLines } of entries) {
      const y = B.spellTableStartY + row * B.spellTableRowH;

      if (spell.alwaysPrepared || spell.prepared) {
        this.drawFilledCircle(pdf, B.colPrepared, y - 2, 1.8);
      }

      pdf.setFontSize(10);
      this.text(pdf, spell.name, B.colName, y);

      // Effet : chaque ligne sur un lignage imprimé (même X → alignement colonne Effet)
      pdf.setFontSize(7);
      let linesToDraw = effectLines;
      if (spell.effectSummary) {
        const precise = (pdf.splitTextToSize(spell.effectSummary, effectWidthMm) as string[]).slice(
          0,
          Math.max(1, effectLines.length),
        );
        if (precise.length) linesToDraw = precise;
      }
      const effectX = pxToMmX(B.colEffect);
      const baseY = pxToMmY(y);
      linesToDraw.forEach((line: string, li: number) => {
        if (line) pdf.text(line, effectX, baseY + li * lineHMm);
      });

      if (spell.pageRef) {
        pdf.setFontSize(7);
        this.text(pdf, spell.pageRef, B.colPage, y);
      }
    }
  }

  /**
   * Écrit le niveau (M / 1–9) centré dans chaque médaillon ouroboros utilisé.
   */
  private drawSpellLevelMedallions(
    pdf: jsPDF,
    rowLevels: { row: number; level: number }[],
    levelX: number,
    levelYs: number[],
    rowsPerBand: number,
  ): void {
    if (!rowLevels.length || !levelYs.length) return;

    const bandLevel = new Map<number, number>();
    for (const { row, level } of rowLevels) {
      const band = Math.floor(row / rowsPerBand);
      if (band >= levelYs.length) continue;
      if (!bandLevel.has(band)) bandLevel.set(band, level);
    }

    pdf.setFontSize(12);
    pdf.setTextColor('#2c1810');
    for (const [band, level] of bandLevel) {
      const label = level === 0 ? 'M' : String(level);
      const y = levelYs[band];
      // Baseline légèrement sous le centre pour centrage optique dans le rond
      pdf.text(label, pxToMmX(levelX), pxToMmY(y + 4), { align: 'center' });
    }
  }

  private drawSpellTableRow(
    pdf: jsPDF,
    spell: SpellInstance,
    y: number,
    cols: {
      preparedX: number;
      nameX: number;
      effectX: number;
      pageX?: number;
      effectWidthMm: number;
      nameSize: number;
      effectSize: number;
      effectMaxLines: number;
      /** Hauteur d'une ligne d'effet en mm (doit matcher le lignage imprimé). */
      effectLineHMm?: number;
    },
  ): void {
    if (spell.alwaysPrepared || spell.prepared) {
      this.drawFilledCircle(pdf, cols.preparedX, y - 2, 1.8);
    }

    pdf.setFontSize(cols.nameSize);
    this.text(pdf, spell.name, cols.nameX, y);

    if (spell.effectSummary) {
      pdf.setFontSize(cols.effectSize);
      const lines = pdf.splitTextToSize(spell.effectSummary, cols.effectWidthMm);
      const lineHMm = cols.effectLineHMm ?? pxToMmY(BASE_COORDS.spellTableRowH);
      const effectX = pxToMmX(cols.effectX);
      const effectY = pxToMmY(y);
      lines.slice(0, cols.effectMaxLines).forEach((line: string, li: number) => {
        pdf.text(line, effectX, effectY + li * lineHMm);
      });
    }

    if (cols.pageX != null && spell.pageRef) {
      pdf.setFontSize(7);
      this.text(pdf, spell.pageRef, cols.pageX, y);
    }
  }

  /**
   * Remplit une page grimoire-supp.jpg : médaillons de niveau + lignes Nom / Effet.
   */
  private chunkSpellsForSuppPages(spells: SpellInstance[]): SpellInstance[][] {
    const S = SUPP_COORDS;
    const pages: SpellInstance[][] = [];
    let i = 0;

    while (i < spells.length) {
      const page: SpellInstance[] = [];
      let bands = 0;
      let rowsInBand = 0;
      let lastLevel: number | null = null;

      while (i < spells.length && page.length < S.maxRows) {
        const spell = spells[i];
        const levelChanged = lastLevel === null || spell.level !== lastLevel;
        if (levelChanged || rowsInBand >= S.rowsPerBand) {
          if (bands >= S.levelYs.length) break;
          bands++;
          rowsInBand = 0;
          lastLevel = spell.level;
        }
        page.push(spell);
        rowsInBand++;
        i++;
      }

      if (!page.length) break;
      pages.push(page);
    }

    return pages;
  }

  /**
   * Remplit une page grimoire-supp.jpg : médaillons de niveau + lignes Nom / Effet.
   */
  private drawGrimoireSupp(pdf: jsPDF, spells: SpellInstance[]): void {
    if (!spells.length) return;
    const dark = '#2c1810';
    pdf.setTextColor(dark);
    const S = SUPP_COORDS;
    const effectWidthMm = pxToMmX(S.effectEndX - S.effectX - 8);

    // Niveaux : une entrée par bande (1re ligne de la bande)
    this.drawSpellLevelMedallions(
      pdf,
      spells.slice(0, S.maxRows).map((spell, i) => ({ row: i, level: spell.level })),
      S.levelX,
      S.levelYs,
      S.rowsPerBand,
    );

    spells.slice(0, S.maxRows).forEach((spell, i) => {
      const y = S.tableStartY + i * S.rowH;
      this.drawSpellTableRow(pdf, spell, y, {
        preparedX: S.preparedX,
        nameX: S.nameX,
        effectX: S.effectX,
        effectWidthMm,
        nameSize: 9,
        effectSize: 6.5,
        effectMaxLines: 1,
        effectLineHMm: pxToMmY(S.rowH),
      });
    });
  }

  // =========================================================================
  // GRIMOIRE — Panneau droit (dispatch par kind)
  // Chaque grimoire a ses propres coordonnées.
  // =========================================================================

  private drawGrimoirePanel(pdf: jsPDF, sc: CharacterSpellcasting): void {
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
  private drawPanelBard(pdf: jsPDF, sc: Extract<CharacterSpellcasting, { kind: 'bard' }>): void {
    const P = PANEL_BARD;
    pdf.setFontSize(15);

    if (sc.bardicCollege) {
      this.text(pdf, sc.bardicCollege, P.line1X, P.line1Y);
    }
    if (sc.focus) {
      this.text(pdf, sc.focus, P.line2X, P.line2Y);
    }
  }

  // --- MAGE ---
  private drawPanelWizard(
    pdf: jsPDF,
    sc: Extract<CharacterSpellcasting, { kind: 'wizard' }>,
  ): void {
    const P = PANEL_WIZARD;
    pdf.setFontSize(15);

    if (sc.arcaneTradition) {
      this.text(pdf, sc.arcaneTradition, P.line1X, P.line1Y);
    }
    if (sc.focus) {
      this.text(pdf, sc.focus, P.line2X, P.line2Y);
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
  private drawPanelCleric(
    pdf: jsPDF,
    sc: Extract<CharacterSpellcasting, { kind: 'cleric' }>,
  ): void {
    const P = PANEL_CLERIC;
    pdf.setFontSize(P.valueFontSize);

    // Divinité — Domaine (sur la ligne sous le label, pas sur le titre)
    const deityDomain = [sc.deity, sc.domain].filter(Boolean).join(' — ');
    if (deityDomain) {
      this.textWrapped(pdf, deityDomain, P.line1X, P.line1Y, pxToMmX(140), 3.5, 1);
    }

    // Focaliseur arcanique
    if (sc.focus) {
      this.textWrapped(pdf, sc.focus, P.line2X, P.line2Y, pxToMmX(140), 3.5, 1);
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
  private drawPanelDruid(pdf: jsPDF, sc: Extract<CharacterSpellcasting, { kind: 'druid' }>): void {
    const P = PANEL_DRUID;
    pdf.setFontSize(12);

    // Cercle druidique
    if (sc.druidCircle) {
      this.text(pdf, sc.druidCircle, P.line1X, P.line1Y);
    }

    pdf.setFontSize(10);

    // Focaliseur arcanique
    if (sc.focus) {
      this.text(pdf, sc.focus, P.line2X, P.line2Y);
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
  private drawPanelWarlock(
    pdf: jsPDF,
    sc: Extract<CharacterSpellcasting, { kind: 'warlock' }>,
  ): void {
    const P = PANEL_WARLOCK;
    pdf.setFontSize(15);

    // Suzerain (patron)
    if (sc.patron) {
      this.text(pdf, sc.patron, P.line1X, P.line1Y);
    }

    // Pacte
    if (sc.pact) {
      this.text(pdf, sc.pact, P.line2X, P.line2Y);
    }

    // Focaliseur arcanique
    if (sc.focus) {
      this.text(pdf, sc.focus, P.line3X, P.line3Y);
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
  private drawPanelSorcerer(
    pdf: jsPDF,
    sc: Extract<CharacterSpellcasting, { kind: 'sorcerer' }>,
  ): void {
    const P = PANEL_SORCERER;
    pdf.setFontSize(15);

    // Atavisme (origine)
    if (sc.atavism) {
      this.text(pdf, sc.atavism, P.line1X, P.line1Y);
    }

    // Focaliseur arcanique
    if (sc.focus) {
      this.text(pdf, sc.focus, P.line2X, P.line2Y);
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

    // Métamagie
    if (sc.metamagic.length > 0) {
      pdf.setFontSize(8);
      sc.metamagic.forEach((mm: string, i: number) => {
        if (i < 5) {
          this.text(pdf, mm, P.metamagicX, P.metamagicStartY + i * P.metamagicSpacing);
        }
      });
    }
  }

  // =========================================================================
  // GRIMOIRE GUERRIER / RÔDEUR / PALADIN
  // =========================================================================

  private drawGrimoireGRP(pdf: jsPDF, c: Character): void {
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
        if (sc.focus) this.text(pdf, sc.focus, G.rodeurFocaliseurX, G.rodeurFocaliseurY);
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
  }
}
