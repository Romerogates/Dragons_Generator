/** Snapshot minimal pour annuler paint / fill / salles / marqueurs. */
export interface DungeonUndoSnapshot<TTiles, TMarkers, TRooms> {
  tiles: TTiles;
  markers: TMarkers;
  rooms: TRooms;
}

/**
 * Pile undo/redo bornée — chaque stroke paint/fill pousse un snapshot
 * avant mutation ; Ctrl+Z / Ctrl+Y populent l’autre pile.
 */
export class DungeonUndoStack<TTiles, TMarkers, TRooms> {
  private undo: DungeonUndoSnapshot<TTiles, TMarkers, TRooms>[] = [];
  private redo: DungeonUndoSnapshot<TTiles, TMarkers, TRooms>[] = [];

  constructor(private readonly maxDepth: number) {}

  get undoDepth(): number {
    return this.undo.length;
  }

  get redoDepth(): number {
    return this.redo.length;
  }

  clear(): void {
    this.undo = [];
    this.redo = [];
  }

  push(snap: DungeonUndoSnapshot<TTiles, TMarkers, TRooms>): void {
    this.undo.push(snap);
    if (this.undo.length > this.maxDepth) this.undo.shift();
    this.redo = [];
  }

  /** Annule : empile l’état courant dans redo, renvoie le snapshot précédent. */
  undoOnce(
    current: DungeonUndoSnapshot<TTiles, TMarkers, TRooms>,
  ): DungeonUndoSnapshot<TTiles, TMarkers, TRooms> | null {
    const snap = this.undo.pop();
    if (!snap) return null;
    this.redo.push(current);
    if (this.redo.length > this.maxDepth) this.redo.shift();
    return snap;
  }

  /** Rétablit : empile l’état courant dans undo, renvoie le snapshot redo. */
  redoOnce(
    current: DungeonUndoSnapshot<TTiles, TMarkers, TRooms>,
  ): DungeonUndoSnapshot<TTiles, TMarkers, TRooms> | null {
    const snap = this.redo.pop();
    if (!snap) return null;
    this.undo.push(current);
    if (this.undo.length > this.maxDepth) this.undo.shift();
    return snap;
  }
}
