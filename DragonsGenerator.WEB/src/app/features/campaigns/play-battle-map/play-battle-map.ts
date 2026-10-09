import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
  untracked,
  viewChild,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { ConnectivityService } from '@core/services/connectivity.service';
import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';
import { isCombatantDefeated } from '@core/utils/combat-tracker.util';
import {
  drawDungeonToCanvas,
  fogRevealSet,
  isCellRevealed,
  roomAt,
  tileAt,
} from '@core/utils/dungeon-render.util';
import {
  clampTokenToFloor,
  combatantsToTokens,
  findCombatantAtTile,
  isTileOccupied,
  pixelToTile,
} from '@core/utils/dungeon-battle.util';
import {
  isCorridorCellRevealedOnMap,
  isRoomRevealedOnMap,
  withAllRoomsRevealed,
  withCorridorCellRevealed,
  withNoRoomsRevealed,
  withRoomRevealed,
} from '@core/utils/dungeon-fog.util';
import { CampaignPlaySessionStore } from '../campaign-play-session-store/campaign-play-session.store';

export type PlayBattleSessionView =
  | 'resume'
  | 'notes'
  | 'combat'
  | 'encounters'
  | 'dungeon'
  | 'history';

@Component({
  selector: 'app-play-battle-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './play-battle-map.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PlayBattleMap implements OnDestroy {
  readonly store = inject(CampaignPlaySessionStore);
  private readonly auth = inject(AuthService);
  private readonly connectivity = inject(ConnectivityService);

  /** Vue table du shell (combat / autres) — pour afficher la carte MJ. */
  readonly sessionView = input<PlayBattleSessionView>('resume');

  readonly isDm = this.store.isDm;
  readonly activeCombat = this.store.activeCombat;
  readonly activeSessionMap = this.store.activeSessionMap;
  readonly combatTurnOrder = this.store.combatTurnOrder;
  readonly currentTurn = this.store.currentTurn;

  readonly showBattleMap = computed(() => {
    if (!this.activeSessionMap()) return false;
    if (!this.isDm()) return true;
    return this.sessionView() === 'combat' || !!this.activeCombat();
  });

  readonly myCombatant = computed(() => {
    const userId = this.auth.user()?.id;
    if (!userId) return null;
    return this.combatTurnOrder().find((c) => c.memberUserId === userId) ?? null;
  });

  readonly selectedTokenCombatantId = signal<string | null>(null);
  readonly tokenImageError = signal<string | null>(null);
  readonly selectedTokenCombatant = computed(() => {
    const id = this.selectedTokenCombatantId();
    if (!id) return null;
    return this.activeCombat()?.combatants.find((c) => c.id === id) ?? null;
  });

  readonly battleMapTokens = computed(() =>
    combatantsToTokens(this.combatTurnOrder(), {
      currentId: this.currentTurn()?.id ?? null,
      myId: this.myCombatant()?.id ?? null,
      selectedId: this.selectedTokenCombatantId(),
    }),
  );

  /** Légende joueur : masque les jetons hors FoW. */
  readonly playerVisibleTokens = computed(() => {
    const tokens = this.battleMapTokens();
    if (this.isDm()) return tokens;
    const map = this.activeSessionMap();
    if (!map?.fogOfWarEnabled) return tokens;
    const revealed = fogRevealSet(map);
    return tokens.filter((t) => isCellRevealed(map, t.x, t.y, revealed));
  });

  private readonly liveDungeonCanvas = viewChild<ElementRef<HTMLCanvasElement>>('liveDungeonCanvas');
  private mapResizeObserver: ResizeObserver | null = null;
  private liveMapCellSize = 10;
  private tokenDrag:
    | { combatantId: string; pointerId: number; moved: boolean }
    | null = null;

  protected readonly isCombatantDefeated = isCombatantDefeated;

  constructor() {
    effect(() => {
      const map = this.activeSessionMap();
      const canvasRef = this.liveDungeonCanvas();
      const isDm = this.isDm();
      const tokens = this.battleMapTokens();
      const show = this.showBattleMap();
      untracked(() =>
        this.bindLiveDungeonCanvas(map, canvasRef?.nativeElement ?? null, isDm, tokens, show),
      );
    });
  }

  ngOnDestroy(): void {
    this.teardownMapResize();
  }

  /** Raccourci MJ F. */
  toggleSessionFog(): void {
    if (!this.store.toggleSessionFog()) {
      this.store.setFeedback('err', 'Aucune carte de session pour le fog.');
    }
  }

  selectTokenForPlacement(combatantId: string): void {
    if (!this.isDm()) return;
    this.tokenImageError.set(null);
    this.selectedTokenCombatantId.update((id) => (id === combatantId ? null : combatantId));
  }

  async onTokenImageFile(event: Event, combatantId: string): Promise<void> {
    if (!this.isDm()) return;
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (input) input.value = '';
    if (!file) return;
    this.tokenImageError.set(null);
    try {
      const { fileToSquareJpegDataUrl, sanitizeTokenImageUrl } = await import(
        '@core/utils/image-data-url.util'
      );
      const raw = await fileToSquareJpegDataUrl(file, 192);
      const dataUrl = await sanitizeTokenImageUrl(raw, 192);
      if (!dataUrl) {
        this.tokenImageError.set('Image trop lourde — essayez un PNG/JPEG plus léger.');
        return;
      }
      this.store.updateCombatant(combatantId, { tokenImageUrl: dataUrl }, { immediate: true });
    } catch {
      this.tokenImageError.set('Image illisible — essayez un PNG/JPEG plus léger.');
    }
  }

  async updateTokenImageUrl(combatantId: string, url: string | null): Promise<void> {
    if (!url) {
      this.store.updateCombatant(combatantId, { tokenImageUrl: null }, { immediate: true });
      return;
    }
    this.tokenImageError.set(null);
    const { sanitizeTokenImageUrl } = await import('@core/utils/image-data-url.util');
    const safe = await sanitizeTokenImageUrl(url);
    if (!safe) {
      this.tokenImageError.set('URL rejetée — http(s) ou image compressée uniquement.');
      return;
    }
    this.store.updateCombatant(combatantId, { tokenImageUrl: safe }, { immediate: true });
  }

  onBattleMapPointerDown(event: PointerEvent): void {
    if (!this.isDm()) return;
    const map = this.activeSessionMap();
    const canvas = this.liveDungeonCanvas()?.nativeElement;
    if (!map || !canvas) return;

    const tile = this.tileFromCanvasEvent(event, canvas);
    if (!tile) return;

    const combat = this.activeCombat();
    if (combat) {
      const occupant = findCombatantAtTile(combat.combatants, tile.x, tile.y);
      if (occupant) {
        this.selectedTokenCombatantId.set(occupant.id);
        this.tokenDrag = { combatantId: occupant.id, pointerId: event.pointerId, moved: false };
        canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }

      const placeId = this.selectedTokenCombatantId() ?? this.currentTurn()?.id ?? null;
      if (placeId) {
        const clamped = clampTokenToFloor(map, tile.x, tile.y);
        if (!clamped) return;
        this.placeCombatantOnMap(placeId, clamped.x, clamped.y);
        return;
      }
    }

    this.tryToggleCorridorFog(map, tile.x, tile.y);
  }

  onBattleMapPointerMove(event: PointerEvent): void {
    if (!this.isDm() || !this.tokenDrag || this.tokenDrag.pointerId !== event.pointerId) return;
    const map = this.activeSessionMap();
    const canvas = this.liveDungeonCanvas()?.nativeElement;
    if (!map || !canvas) return;
    const tile = this.tileFromCanvasEvent(event, canvas);
    if (!tile) return;
    const clamped = clampTokenToFloor(map, tile.x, tile.y);
    if (!clamped) return;
    this.tokenDrag = { ...this.tokenDrag, moved: true };
    this.placeCombatantOnMap(this.tokenDrag.combatantId, clamped.x, clamped.y, {
      immediate: false,
      silentOccupancy: true,
    });
  }

  onBattleMapPointerUp(event: PointerEvent): void {
    if (!this.tokenDrag || this.tokenDrag.pointerId !== event.pointerId) return;
    const drag = this.tokenDrag;
    this.tokenDrag = null;
    if (drag.moved) {
      const combat = this.activeCombat();
      const c = combat?.combatants.find((x) => x.id === drag.combatantId);
      if (c && typeof c.mapX === 'number' && typeof c.mapY === 'number') {
        this.placeCombatantOnMap(drag.combatantId, c.mapX, c.mapY, { immediate: true });
      }
    }
  }

  isSessionRoomRevealed(roomId: string): boolean {
    const map = this.activeSessionMap();
    return map ? isRoomRevealedOnMap(map, roomId) : true;
  }

  toggleSessionRoomReveal(roomId: string): void {
    if (!this.connectivity.isOnline()) {
      this.store.setFeedback('err', 'Échec fog — vérifiez la connexion.');
      return;
    }
    const map = this.activeSessionMap();
    if (!map?.fogOfWarEnabled) return;
    const prevIds = [...(map.revealedRoomIds ?? [])];
    const revealed = isRoomRevealedOnMap(map, roomId);
    this.store.patchSessionDungeonMap(withRoomRevealed(map, roomId, !revealed));
    this.store.setFeedback('ok', revealed ? 'Salle masquée.' : 'Salle révélée.', {
      undo: () => this.store.patchSessionDungeonMap({ revealedRoomIds: prevIds }),
    });
  }

  revealAllSessionRooms(): void {
    if (!this.connectivity.isOnline()) {
      this.store.setFeedback('err', 'Échec fog — vérifiez la connexion.');
      return;
    }
    const map = this.activeSessionMap();
    if (!map) return;
    const prevIds = [...(map.revealedRoomIds ?? [])];
    this.store.patchSessionDungeonMap(withAllRoomsRevealed(map));
    this.store.setFeedback('ok', 'Toutes les salles révélées.', {
      undo: () => this.store.patchSessionDungeonMap({ revealedRoomIds: prevIds }),
    });
  }

  hideAllSessionRooms(): void {
    if (!this.connectivity.isOnline()) {
      this.store.setFeedback('err', 'Échec fog — vérifiez la connexion.');
      return;
    }
    const map = this.activeSessionMap();
    const prev = {
      revealedRoomIds: [...(map?.revealedRoomIds ?? [])],
      revealedCorridorCells: [...(map?.revealedCorridorCells ?? [])],
    };
    this.store.patchSessionDungeonMap(withNoRoomsRevealed());
    this.store.setFeedback('ok', 'Fog tout masqué.', {
      undo: () => this.store.patchSessionDungeonMap(prev),
    });
  }

  private tryToggleCorridorFog(map: CampaignDungeonMap, x: number, y: number): void {
    if (!this.connectivity.isOnline()) {
      this.store.setFeedback('err', 'Échec fog — vérifiez la connexion.');
      return;
    }
    if (!map.fogOfWarEnabled) return;
    if (roomAt(map, x, y)) return;
    const kind = tileAt(map, x, y);
    if (kind !== 'floor' && kind !== 'door') return;
    const revealed = isCorridorCellRevealedOnMap(map, x, y);
    const prev = [...(map.revealedCorridorCells ?? [])];
    this.store.patchSessionDungeonMap(withCorridorCellRevealed(map, x, y, !revealed));
    this.store.setFeedback('ok', revealed ? 'Couloir masqué.' : 'Couloir révélé.', {
      undo: () => this.store.patchSessionDungeonMap({ revealedCorridorCells: prev }),
    });
  }

  private placeCombatantOnMap(
    combatantId: string,
    x: number,
    y: number,
    options?: { immediate?: boolean; silentOccupancy?: boolean },
  ): void {
    const combat = this.activeCombat();
    if (!combat || !this.isDm()) return;
    if (isTileOccupied(combat.combatants, x, y, combatantId)) {
      if (!options?.silentOccupancy) {
        this.store.setFeedback('err', 'Case déjà occupée.');
      }
      return;
    }
    const combatants = combat.combatants.map((c) =>
      c.id === combatantId ? { ...c, mapX: x, mapY: y } : c,
    );
    this.store.patchCombat({ ...combat, combatants }, { immediate: options?.immediate !== false });
  }

  private bindLiveDungeonCanvas(
    map: CampaignDungeonMap | null,
    canvas: HTMLCanvasElement | null,
    isDm: boolean,
    tokens: ReturnType<typeof combatantsToTokens>,
    show: boolean,
  ): void {
    this.teardownMapResize();
    if (!show || !map || !canvas) return;
    this.paintLiveDungeon(map, canvas, isDm, tokens);
    const host = canvas.parentElement;
    if (!host || typeof ResizeObserver === 'undefined') return;
    this.mapResizeObserver = new ResizeObserver(() => {
      this.paintLiveDungeon(this.activeSessionMap(), canvas, this.isDm(), this.battleMapTokens());
    });
    this.mapResizeObserver.observe(host);
  }

  private teardownMapResize(): void {
    this.mapResizeObserver?.disconnect();
    this.mapResizeObserver = null;
  }

  private paintLiveDungeon(
    map: CampaignDungeonMap | null,
    canvas: HTMLCanvasElement | null,
    isDm: boolean,
    tokens: ReturnType<typeof combatantsToTokens>,
  ): void {
    if (!map || !canvas) return;
    const hostW = canvas.parentElement?.clientWidth ?? 0;
    const width = Math.max(280, hostW || 360);
    const gridW = map.gridWidth ?? 1;
    const cell = Math.max(6, Math.min(20, Math.floor(width / Math.max(1, gridW))));
    this.liveMapCellSize = cell;
    drawDungeonToCanvas(map, canvas, cell, {
      showRoomNumbers: true,
      vignette: true,
      revealedRoomIds: isDm ? null : fogRevealSet(map),
      combatTokens: tokens,
    });
  }

  private tileFromCanvasEvent(
    event: PointerEvent,
    canvas: HTMLCanvasElement,
  ): { x: number; y: number } | null {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const ox = (event.clientX - rect.left) * scaleX;
    const oy = (event.clientY - rect.top) * scaleY;
    return pixelToTile(ox, oy, this.liveMapCellSize, 0);
  }
}
