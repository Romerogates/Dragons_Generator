import { inject, Injectable, signal } from '@angular/core';
import {
  buildHandoutBody,
  dungeonMapToPngDataUrl,
  exportDungeonPdf,
  exportDungeonPng,
  playerExportDrawOptions,
} from '@core/utils/dungeon-render.util';
import {
  campaignDungeonMemberMapUrl,
  upsertDungeonMapHandout,
} from '@core/utils/dungeon-map-edit.util';
import { DungeonMapsCore } from './dungeon-maps-core.service';

/** Export PNG/PDF/JSON, handout, lien membre. Persist via le core / store. */
@Injectable()
export class DungeonMapsEditorFiles {
  private readonly core = inject(DungeonMapsCore);

  readonly exportBusy = signal(false);
  readonly exportMenuOpen = signal(false);
  readonly docMenuOpen = signal(false);

  toggleExportMenu(): void {
    this.docMenuOpen.set(false);
    this.exportMenuOpen.update((v) => !v);
  }

  toggleDocMenu(): void {
    this.exportMenuOpen.set(false);
    this.docMenuOpen.update((v) => !v);
  }

  closeActionMenus(): void {
    this.exportMenuOpen.set(false);
    this.docMenuOpen.set(false);
  }

  async copyMemberMapLink(mapId?: string): Promise<void> {
    if (this.core.libraryMode()) return;
    const c = this.core.campaign();
    const id = mapId ?? this.core.editingMap()?.id;
    if (!c || !id) return;
    const url = campaignDungeonMemberMapUrl(window.location.origin, c.id, id);
    try {
      await navigator.clipboard.writeText(url);
      this.core.setEditorMessage('Lien copié — accessible aux membres de la campagne.');
    } catch {
      this.core.setEditorMessage('Impossible de copier le lien (presse-papiers bloqué).');
    }
  }

  async exportPng(): Promise<void> {
    this.closeActionMenus();
    const map = this.core.editingMap();
    if (!map || this.exportBusy()) return;
    this.exportBusy.set(true);
    try {
      await exportDungeonPng(map, `${map.name.replace(/\s+/g, '-')}.png`);
      this.core.setEditorMessage('PNG exporté.');
    } finally {
      this.exportBusy.set(false);
    }
  }

  async sharePng(): Promise<void> {
    this.closeActionMenus();
    const map = this.core.editingMap();
    if (!map || this.exportBusy()) return;
    this.exportBusy.set(true);
    try {
      const dataUrl = dungeonMapToPngDataUrl(map, 10, playerExportDrawOptions(map));
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${map.name.replace(/\s+/g, '-')}.png`, { type: 'image/png' });
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: map.name });
        this.core.setEditorMessage('Carte partagée.');
      } else {
        await exportDungeonPng(map, `${map.name.replace(/\s+/g, '-')}.png`);
        this.core.setEditorMessage('PNG téléchargé (partage natif indisponible).');
      }
    } finally {
      this.exportBusy.set(false);
    }
  }

  async exportPdf(): Promise<void> {
    this.closeActionMenus();
    const map = this.core.editingMap();
    if (!map || this.exportBusy()) return;
    this.exportBusy.set(true);
    try {
      await exportDungeonPdf(map, this.core.encounters(), `${map.name.replace(/\s+/g, '-')}.pdf`);
      this.core.setEditorMessage('PDF exporté.');
    } finally {
      this.exportBusy.set(false);
    }
  }

  createOrUpdateHandout(opts?: { publish?: boolean }): void {
    this.closeActionMenus();
    const map = this.core.editingMap();
    if (!map) return;
    const c = this.core.campaign();
    const publish = opts?.publish === true;
    const next = upsertDungeonMapHandout({
      map,
      maps: c.data.dungeonMaps ?? [],
      handouts: c.data.handouts ?? [],
      body: buildHandoutBody(map, this.core.encounters()),
      publish,
      nowIso: new Date().toISOString(),
    });
    this.core.emitData({ dungeonMaps: next.maps, handouts: next.handouts });
    this.core.lastHandoutNav.set({ handoutId: next.handoutId });
    this.core.setEditorMessage(
      publish
        ? 'Document publié aux joueurs.'
        : 'Document brouillon enregistré — publiez pour les joueurs.',
    );
  }

  exportJson(): void {
    this.closeActionMenus();
    const map = this.core.editingMap();
    if (!map) return;
    const blob = new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${map.name.replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.core.setEditorMessage('JSON exporté.');
  }
}
