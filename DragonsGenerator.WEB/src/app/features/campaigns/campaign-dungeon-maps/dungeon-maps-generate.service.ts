import { inject, Injectable, signal } from '@angular/core';
import {
  normalizeDungeonTheme,
  type CampaignDungeonMap,
  type DungeonGenParams,
  type DungeonTheme,
} from '@core/models/Campaign/dungeon-map';
import {
  DUNGEON_SIZE_PRESETS,
  dungeonLegendTileColor,
  type DungeonSizePresetId,
} from '@core/utils/dungeon-editor-ui.util';
import { generateDungeonMap } from '@core/utils/dungeon-generator.util';
import { stampDungeonMapIdentity } from '@core/utils/dungeon-map-edit.util';
import { themePalette } from '@core/utils/dungeon-render.util';
import { suggestThemeFromRegion } from '@core/utils/dungeon-theme-pools';
import { DungeonMapsCore } from './dungeon-maps-core.service';
import { DungeonMapsEditorSession } from './dungeon-maps-editor-session.service';

type SizePresetId = DungeonSizePresetId;

const PREVIEW_DEBOUNCE_MS = 480;

/** Paramètres + aperçu + gravure. Persist via le core / store. */
@Injectable()
export class DungeonMapsGenerateService {
  private readonly core = inject(DungeonMapsCore);
  private readonly editor = inject(DungeonMapsEditorSession);

  readonly showGenerator = signal(false);
  readonly generating = signal(false);
  readonly previewMap = signal<CampaignDungeonMap | null>(null);
  readonly sizePreset = signal<SizePresetId>('compact');
  readonly showAdvanced = signal(false);
  readonly previewSeed = signal(1);
  readonly genName = signal('Donjon');
  readonly genGridW = signal(32);
  readonly genGridH = signal(32);
  readonly genRoomCount = signal(6);
  readonly genCorridorDensity = signal(45);
  readonly genTheme = signal<DungeonTheme>('generic');

  readonly sizePresets = DUNGEON_SIZE_PRESETS;
  readonly themes: DungeonTheme[] = ['crypt', 'cave', 'ruins', 'temple', 'sewer', 'forest', 'generic'];
  readonly genParamHints: { label: string; desc: string }[] = [
    { label: 'Grille', desc: 'Taille de la carte en cases' },
    { label: 'Salles', desc: 'Nombre de pièces avec rencontre possible' },
    { label: 'Couloirs', desc: 'Plus c’est haut, plus les salles sont reliées' },
  ];

  private previewTimer: ReturnType<typeof setTimeout> | null = null;

  openGenerator(): void {
    const c = this.core.campaign();
    this.genName.set(`Donjon — ${c.title}`);
    this.genTheme.set(suggestThemeFromRegion(c.data.regionName));
    this.applySizePreset('compact', false);
    this.showAdvanced.set(false);
    this.previewSeed.set((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0 || 1);
    this.showGenerator.set(true);
    this.scheduleLivePreview(true);
  }

  closeGenerator(): void {
    this.showGenerator.set(false);
    this.previewMap.set(null);
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
  }

  applySizePreset(id: Exclude<SizePresetId, 'custom'>, refreshPreview = true): void {
    const preset = DUNGEON_SIZE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    this.sizePreset.set(id);
    this.genGridW.set(preset.gridWidth);
    this.genGridH.set(preset.gridHeight);
    this.genRoomCount.set(preset.roomCount);
    this.genCorridorDensity.set(preset.corridorDensity);
    if (refreshPreview) this.scheduleLivePreview();
  }

  toggleAdvanced(): void {
    this.showAdvanced.update((v) => !v);
  }

  onAdvancedParamInput(kind: 'w' | 'h' | 'rooms' | 'corridors', value: number): void {
    this.sizePreset.set('custom');
    if (kind === 'w') this.genGridW.set(value);
    else if (kind === 'h') this.genGridH.set(value);
    else if (kind === 'rooms') this.genRoomCount.set(value);
    else this.genCorridorDensity.set(value);
  }

  onAdvancedParamCommit(): void {
    this.scheduleLivePreview();
  }

  reshufflePreview(): void {
    this.previewSeed.set((this.previewSeed() + 0x9e3779b9) >>> 0 || 1);
    this.scheduleLivePreview(true);
  }

  generateMap(): void {
    if (this.generating()) return;
    this.generating.set(true);
    this.editor.view.revealMap.set(false);

    const c = this.core.campaign();
    const map =
      this.previewMap() ??
      generateDungeonMap(this.buildGenParams(), {
        name: this.genName().trim() || 'Donjon',
        regionId: c.data.regionId,
        regionName: c.data.regionName,
      });
    const named = stampDungeonMapIdentity(
      map,
      this.genName().trim() || map.name,
      new Date().toISOString(),
    );

    this.core.mapsStore.publishGeneratedMap(
      named,
      (published) => this.finishGenerateUi(published),
      () => {
        this.generating.set(false);
        this.core.setEditorMessage(this.core.mapsStore.quotaMessage('generate'));
      },
    );
  }

  onThemeChange(raw: string): void {
    this.genTheme.set(normalizeDungeonTheme(raw));
    this.scheduleLivePreview();
  }

  themeSwatch(theme: DungeonTheme): string {
    return themePalette(theme).floor;
  }

  legendTileColor(kind: 'wall' | 'floor' | 'door', theme?: DungeonTheme): string {
    return dungeonLegendTileColor(kind, theme ?? this.genTheme());
  }

  destroy(): void {
    if (this.previewTimer) clearTimeout(this.previewTimer);
  }

  private finishGenerateUi(named: CampaignDungeonMap): void {
    this.showGenerator.set(false);
    this.previewMap.set(null);
    this.core.editingMapId.set(named.id);
    this.editor.afterGenerate(named);
    this.generating.set(false);
    this.editor.view.revealMap.set(true);
    this.core.setEditorMessage('Donjon gravé — peignez, zoomez, exportez.', { coaching: true });
    setTimeout(() => this.editor.view.revealMap.set(false), 900);
  }

  private buildGenParams(): DungeonGenParams {
    return {
      gridWidth: this.genGridW(),
      gridHeight: this.genGridH(),
      roomCount: this.genRoomCount(),
      corridorDensity: this.genCorridorDensity(),
      theme: this.genTheme(),
      seed: this.previewSeed(),
    };
  }

  private scheduleLivePreview(immediate = false): void {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    const run = () => {
      this.previewTimer = null;
      if (!this.showGenerator()) return;
      const c = this.core.campaign();
      const map = generateDungeonMap(this.buildGenParams(), {
        name: this.genName().trim() || 'Aperçu',
        regionId: c.data.regionId,
        regionName: c.data.regionName,
      });
      this.previewMap.set(map);
    };
    if (immediate) run();
    else this.previewTimer = setTimeout(run, PREVIEW_DEBOUNCE_MS);
  }
}
