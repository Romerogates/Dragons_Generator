// features/character-sheet/services/pdf-generator.service.ts
import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
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
  spellTableStartY: 491,
  spellTableRowH: 45,
  spellTableMaxRows: 15,
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
const PANEL_CLERIC = {
  line1X: 450, // Divinité — Domaine (valeur)
  line1Y: 250,
  line2X: 450, // Focaliseur arcanique (valeur)
  line2Y: 305,
  channelsStartY: 370, // Conduits divins : première ligne
  channelsSpacing: 22,
  channelsX: 450,
};

// Druide : "Magie druidique" → Cercle, Focaliseur, cases à cocher, notes
const PANEL_DRUID = {
  line1X: 450, // Cercle druidique (valeur)
  line1Y: 245,
  line2X: 450, // Focaliseur arcanique (valeur)
  line2Y: 300,
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
  line2X: 450, // Focaliseur arcanique (valeur)
  line2Y: 300,
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
  ): void {
    if (!text) return;
    const lines = pdf.splitTextToSize(text, maxWidthMm);
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
   * "lg-commun" → "Commun"
   * "wp-arbalete-de-poing" → "Arbalète de poing"
   * "ar-armure-matelassee" → "Armure matelassée"
   * "category-simple-weapons" → "Armes courantes"
   */
  private prettify(id: string): string {
    const CATEGORY_LABELS: Record<string, string> = {
      'category-simple-weapons': 'Armes courantes',
      'category-simple-melee-weapons': 'Armes courantes CàC',
      'category-simple-ranged-weapons': 'Armes courantes à distance',
      'category-martial-weapons': 'Armes de guerre',
      'category-martial-melee-weapons': 'Armes de guerre CàC',
      'category-martial-ranged-weapons': 'Armes de guerre à distance',
      'category-light-armor': 'Armures légères',
      'category-medium-armor': 'Armures intermédiaires',
      'category-heavy-armor': 'Armures lourdes',
      'category-shield': 'Boucliers',
      'category-all-armor': 'Toutes armures',
      'category-tools': 'Outils',
    };

    if (CATEGORY_LABELS[id]) return CATEGORY_LABELS[id];

    return id
      .replace(/^(lg|wp|ar|gr|tl|it|mnt|vhc)-/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\bepee\b/gi, 'Épée')
      .replace(/\barbalete\b/gi, 'Arbalète')
      .replace(/\bflechette\b/gi, 'Fléchette')
      .replace(/\bmatelassee\b/gi, 'Matelassée')
      .replace(/\bcloutee\b/gi, 'Cloutée')
      .replace(/\becailles\b/gi, 'Écailles')
      .replace(/\bderudit\b/gi, "d'Érudit")
      .replace(/\bdaventurier\b/gi, "d'Aventurier");
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
    const classLabel =
      c.totalLevel > 1 ? `${c.classes[0].classLabel} ${c.totalLevel}` : c.classes[0].classLabel;

    pdf.setFontSize(15);
    this.text(pdf, c.name, 140, 43);
    this.text(pdf, speciesLabel, 140, 66);
    this.text(pdf, c.civilization.label, 140, 90);
    this.text(pdf, classLabel, 400, 43);
    this.text(pdf, String(c.experience), 400, 90);

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

    this.drawProfCircle(pdf, isSkillProf('Athlétisme'), 36, 255);
    this.drawEmptyCircle(pdf, 23, 255);
    this.drawProfCircle(pdf, isSkillProf('Acrobaties'), 36, 323);
    this.drawEmptyCircle(pdf, 23, 323);
    this.drawProfCircle(pdf, isSkillProf('Escamotage'), 36, 338);
    this.drawEmptyCircle(pdf, 23, 338);
    this.drawProfCircle(pdf, isSkillProf('Discrétion'), 36, 355);
    this.drawEmptyCircle(pdf, 23, 355);
    this.drawProfCircle(pdf, isSkillProf('Arcanes'), 36, 472);
    this.drawEmptyCircle(pdf, 23, 472);
    this.drawProfCircle(pdf, isSkillProf('Histoire'), 36, 487);
    this.drawEmptyCircle(pdf, 23, 487);
    this.drawProfCircle(pdf, isSkillProf('Investigation'), 36, 503);
    this.drawEmptyCircle(pdf, 23, 503);
    this.drawProfCircle(pdf, isSkillProf('Nature'), 36, 519);
    this.drawEmptyCircle(pdf, 23, 519);
    this.drawProfCircle(pdf, isSkillProf('Religion'), 36, 535);
    this.drawEmptyCircle(pdf, 23, 535);
    this.drawProfCircle(pdf, isSkillProf('Dressage'), 36, 596);
    this.drawEmptyCircle(pdf, 23, 596);
    this.drawProfCircle(pdf, isSkillProf('Intuition'), 36, 612);
    this.drawEmptyCircle(pdf, 23, 612);
    this.drawProfCircle(pdf, isSkillProf('Médecine'), 36, 628);
    this.drawEmptyCircle(pdf, 23, 628);
    this.drawProfCircle(pdf, isSkillProf('Perception'), 36, 644);
    this.drawEmptyCircle(pdf, 23, 644);
    this.drawProfCircle(pdf, isSkillProf('Survie'), 36, 660);
    this.drawEmptyCircle(pdf, 23, 660);
    this.drawProfCircle(pdf, isSkillProf('Intimidation'), 36, 731);
    this.drawEmptyCircle(pdf, 23, 731);
    this.drawProfCircle(pdf, isSkillProf('Persuasion'), 36, 747);
    this.drawEmptyCircle(pdf, 23, 747);
    this.drawProfCircle(pdf, isSkillProf('Représentation'), 36, 763);
    this.drawEmptyCircle(pdf, 23, 763);
    this.drawProfCircle(pdf, isSkillProf('Tromperie'), 36, 779);
    this.drawEmptyCircle(pdf, 23, 779);

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
    pdf.setFontSize(15);

    const armors = c.proficiencies.armor;
    if (armors[0]) this.text(pdf, this.prettify(armors[0]), 125, 100);
    if (armors[1]) this.text(pdf, this.prettify(armors[1]), 125, 124);

    const weapons = c.proficiencies.weapons;
    if (weapons[0]) this.text(pdf, this.prettify(weapons[0]), 125, 148);
    if (weapons[1]) this.text(pdf, this.prettify(weapons[1]), 125, 172);

    const resTops = [100, 124, 148, 172, 194];
    let resIndex = 0;
    if (c.senses.hasDarkvision) {
      this.text(pdf, `Vision dans le noir (${c.senses.darkvisionRadius}m)`, 380, resTops[resIndex]);
      resIndex++;
    }
    c.defense.resistances.forEach((res, i) => {
      if (resIndex + i < 5) this.text(pdf, res, 375, resTops[resIndex + i]);
    });

    pdf.setFontSize(10);
    const traitTops = [255, 277, 299, 320, 342, 364, 386, 408, 430, 452];
    const racialFeatures = c.features.filter(
      (f) => f.source === 'species' || f.source === 'subspecies',
    );
    racialFeatures.forEach((feat, i) => {
      if (i < 10) this.text(pdf, feat.name, 15, traitTops[i]);
    });

    const toolTops = [255, 277, 299, 320, 342, 364, 386, 408, 430, 452];
    c.proficiencies.tools.forEach((tool, i) => {
      if (i < 10) this.text(pdf, this.prettify(tool), 204, toolTops[i]);
    });

    const langTops = [255, 277, 299, 320, 342, 364, 386, 408, 430, 452];
    c.proficiencies.languages.forEach((lang, i) => {
      if (i < 10) this.text(pdf, this.prettify(lang), 396, langTops[i]);
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

    if (p.description) this.text(pdf, p.description, 38, 72);
    if (p.background) this.text(pdf, p.background, 37, 137);
    if (p.ideal) this.text(pdf, p.ideal, 402, 127);
    if (p.traits) this.text(pdf, p.traits, 402, 199);
    if (p.alignment) this.text(pdf, p.alignment, 402, 270);
    if (p.bonds) this.text(pdf, p.bonds, 402, 316);
    if (p.flaws) this.text(pdf, p.flaws, 402, 388);
    if (p.handicap) this.text(pdf, p.handicap, 402, 459);

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

  private drawSpellTable(pdf: jsPDF, c: Character): void {
    if (!c.knownSpells || c.knownSpells.length === 0) return;
    const B = BASE_COORDS;

    const effectWidthMm = pxToMmX(B.colPage - B.colEffect - 15);

    const sorted = [...c.knownSpells].sort(
      (a, b) => a.level - b.level || a.name.localeCompare(b.name),
    );

    sorted.slice(0, B.spellTableMaxRows).forEach((spell, i) => {
      const y = B.spellTableStartY + i * B.spellTableRowH;

      if (spell.alwaysPrepared || spell.prepared) {
        this.drawFilledCircle(pdf, B.colPrepared, y - 2, 1.8);
      }

      pdf.setFontSize(10);
      this.text(pdf, spell.name, B.colName, y);

      if (spell.effectSummary) {
        pdf.setFontSize(7);
        const lines = pdf.splitTextToSize(spell.effectSummary, effectWidthMm);
        const lineH = 8;
        const effectX = pxToMmX(B.colEffect);
        const effectY = pxToMmY(y) - 1;
        lines.slice(0, 2).forEach((line: string, li: number) => {
          pdf.text(line, effectX, effectY + li * lineH + 1);
        });
      }

      if (spell.pageRef) {
        pdf.setFontSize(7);
        this.text(pdf, spell.pageRef, B.colPage, y);
      }
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
  }

  // --- PRÊTRE ---
  private drawPanelCleric(
    pdf: jsPDF,
    sc: Extract<CharacterSpellcasting, { kind: 'cleric' }>,
  ): void {
    const P = PANEL_CLERIC;
    pdf.setFontSize(15);

    // Divinité — Domaine
    if (sc.deity && sc.domain) {
      this.text(pdf, `${sc.deity} — ${sc.domain}`, P.line1X, P.line1Y);
    } else {
      if (sc.deity) this.text(pdf, sc.deity, P.line1X, P.line1Y);
      if (sc.domain) this.text(pdf, sc.domain, P.line1X, P.line1Y);
    }

    // Focaliseur arcanique
    if (sc.focus) {
      this.text(pdf, sc.focus, P.line2X, P.line2Y);
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
    pdf.setFontSize(15);

    // Cercle druidique
    if (sc.druidCircle) {
      this.text(pdf, sc.druidCircle, P.line1X, P.line1Y);
    }

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
        if (i < 6) {
          this.text(pdf, inv, P.invocationsX, P.invocationsStartY + i * P.invocationsSpacing);
        }
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
