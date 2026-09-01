import { Injectable, inject } from '@angular/core';
import type {
  GrimoireBaseCoords,
} from '@core/config/grimoire-coords.config';
import {
  GRIMOIRE_BASE_COORDS,
  GRIMOIRE_PANEL_CLERIC,
  GRIMOIRE_SPELL_TABLE_LEVEL,
} from '@core/config/grimoire-coords.config';

export interface GrimoireRuntimeCoords {
  base: GrimoireBaseCoords;
  spellTableLevel: typeof GRIMOIRE_SPELL_TABLE_LEVEL;
  panelCleric: typeof GRIMOIRE_PANEL_CLERIC;
}

/** Coordonnées temporaires pour l'aperçu calibration (même rendu que le générateur). */
@Injectable({ providedIn: 'root' })
export class GrimoireCalibrationContext {
  private override: GrimoireRuntimeCoords | null = null;

  setOverride(coords: GrimoireRuntimeCoords | null): void {
    this.override = coords;
  }

  getBaseCoords(): GrimoireBaseCoords {
    return this.override?.base ?? GRIMOIRE_BASE_COORDS;
  }

  getSpellTableLevel(): typeof GRIMOIRE_SPELL_TABLE_LEVEL {
    return this.override?.spellTableLevel ?? GRIMOIRE_SPELL_TABLE_LEVEL;
  }

  getPanelCleric(): typeof GRIMOIRE_PANEL_CLERIC {
    return this.override?.panelCleric ?? GRIMOIRE_PANEL_CLERIC;
  }
}
