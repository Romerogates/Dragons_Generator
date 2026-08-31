import type {
  CampaignDungeonMap,
  DungeonMarkerKind,
  DungeonTheme,
  DungeonTileKind,
} from '@core/models/Campaign/dungeon-map';
import { DUNGEON_MARKER_LABELS, DUNGEON_THEME_LABELS } from '@core/models/Campaign/dungeon-map';
import type { EncounterGroup } from '@core/models/Campaign/campaign';

export interface DungeonThemePalette {
  bg: string;
  wall: string;
  wallEdge: string;
  floor: string;
  floorAlt: string;
  door: string;
  doorEdge: string;
  grid: string;
  roomText: string;
  roomTextSelected: string;
  roomHighlight: string;
  accent: string;
}

export const DUNGEON_THEME_PALETTES: Record<DungeonTheme, DungeonThemePalette> = {
  crypt: {
    bg: '#0c0e12',
    wall: '#1a1f2a',
    wallEdge: '#0d1016',
    floor: '#3a4252',
    floorAlt: '#343c4a',
    door: '#a16207',
    doorEdge: '#854d0e',
    grid: 'rgba(226,232,240,0.06)',
    roomText: '#e2e8f0',
    roomTextSelected: '#fde68a',
    roomHighlight: 'rgba(253,230,138,0.18)',
    accent: '#94a3b8',
  },
  cave: {
    bg: '#0f0c0a',
    wall: '#2a211c',
    wallEdge: '#1a1410',
    floor: '#5c4638',
    floorAlt: '#524032',
    door: '#b45309',
    doorEdge: '#92400e',
    grid: 'rgba(251,191,36,0.05)',
    roomText: '#f5e6d3',
    roomTextSelected: '#fcd34d',
    roomHighlight: 'rgba(251,191,36,0.16)',
    accent: '#d6a77a',
  },
  ruins: {
    bg: '#0c100e',
    wall: '#243028',
    wallEdge: '#151c18',
    floor: '#4a5c4e',
    floorAlt: '#425446',
    door: '#a16207',
    doorEdge: '#854d0e',
    grid: 'rgba(167,243,208,0.06)',
    roomText: '#e2e8f0',
    roomTextSelected: '#a7f3d0',
    roomHighlight: 'rgba(52,211,153,0.15)',
    accent: '#86efac',
  },
  temple: {
    bg: '#120e0a',
    wall: '#3d3226',
    wallEdge: '#2a221a',
    floor: '#8b7355',
    floorAlt: '#7e684c',
    door: '#ca8a04',
    doorEdge: '#a16207',
    grid: 'rgba(253,224,71,0.07)',
    roomText: '#fef3c7',
    roomTextSelected: '#fde68a',
    roomHighlight: 'rgba(250,204,21,0.18)',
    accent: '#f0c674',
  },
  sewer: {
    bg: '#0a100e',
    wall: '#1c2a24',
    wallEdge: '#101a16',
    floor: '#3d5448',
    floorAlt: '#364c42',
    door: '#78716c',
    doorEdge: '#57534e',
    grid: 'rgba(134,239,172,0.05)',
    roomText: '#d1fae5',
    roomTextSelected: '#6ee7b7',
    roomHighlight: 'rgba(16,185,129,0.16)',
    accent: '#5eead4',
  },
  forest: {
    bg: '#08110c',
    wall: '#1a2e22',
    wallEdge: '#0f1c15',
    floor: '#2f4a38',
    floorAlt: '#294232',
    door: '#92400e',
    doorEdge: '#78350f',
    grid: 'rgba(134,239,172,0.06)',
    roomText: '#dcfce7',
    roomTextSelected: '#bbf7d0',
    roomHighlight: 'rgba(74,222,128,0.15)',
    accent: '#4ade80',
  },
  generic: {
    bg: '#0f1218',
    wall: '#1e2430',
    wallEdge: '#141820',
    floor: '#3d4a5c',
    floorAlt: '#364254',
    door: '#b45309',
    doorEdge: '#92400e',
    grid: 'rgba(226,232,240,0.06)',
    roomText: '#e2e8f0',
    roomTextSelected: '#fde68a',
    roomHighlight: 'rgba(253,230,138,0.16)',
    accent: '#a78bfa',
  },
};

const MARKER_COLORS: Record<DungeonMarkerKind, string> = {
  door: '#f59e0b',
  trap: '#ef4444',
  chest: '#eab308',
  stairs: '#8b5cf6',
  note: '#94a3b8',
};

const MARKER_SYMBOLS: Record<DungeonMarkerKind, string> = {
  door: 'D',
  trap: '!',
  chest: '$',
  stairs: 'S',
  note: '?',
};

export function themePalette(theme: DungeonTheme | string | undefined): DungeonThemePalette {
  const key = (theme ?? 'generic') as DungeonTheme;
  return DUNGEON_THEME_PALETTES[key] ?? DUNGEON_THEME_PALETTES.generic;
}

export function tileAt(map: CampaignDungeonMap, x: number, y: number): DungeonTileKind {
  return map.tiles[y]?.[x] ?? 'wall';
}

export function roomAt(map: CampaignDungeonMap, x: number, y: number): string | null {
  for (const room of map.rooms) {
    if (x >= room.x && x < room.x + room.width && y >= room.y && y < room.y + room.height) {
      return room.id;
    }
  }
  return null;
}

export function roomLabelAt(map: CampaignDungeonMap, roomId: string): string {
  return map.rooms.find((r) => r.id === roomId)?.label ?? '';
}

export interface DrawDungeonOptions {
  showRoomNumbers?: boolean;
  selectedRoomId?: string | null;
  showGrid?: boolean;
  vignette?: boolean;
  /** Si défini, masque les salles non révélées (fog of war joueur). */
  revealedRoomIds?: Set<string> | null;
}

export function fogRevealSet(map: CampaignDungeonMap): Set<string> | null {
  if (!map.fogOfWarEnabled) return null;
  return new Set(map.revealedRoomIds ?? []);
}

function isCellRevealed(
  map: CampaignDungeonMap,
  x: number,
  y: number,
  revealed: Set<string> | null,
): boolean {
  if (!revealed) return true;
  const roomId = roomAt(map, x, y);
  if (roomId) return revealed.has(roomId);
  const kind = tileAt(map, x, y);
  if (kind === 'wall') return false;
  const neighbors: [number, number][] = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];
  for (const [dx, dy] of neighbors) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= map.gridWidth || ny >= map.gridHeight) continue;
    const nRoom = roomAt(map, nx, ny);
    if (nRoom && revealed.has(nRoom)) return true;
  }
  return false;
}

export function drawDungeonToCanvas(
  map: CampaignDungeonMap,
  canvas: HTMLCanvasElement,
  cellSize = 12,
  options?: DrawDungeonOptions,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const palette = themePalette(map.theme);
  const revealed = options?.revealedRoomIds ?? null;
  const w = map.gridWidth * cellSize;
  const h = map.gridHeight * cellSize;
  canvas.width = w;
  canvas.height = h;

  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < map.gridHeight; y++) {
    for (let x = 0; x < map.gridWidth; x++) {
      const kind = tileAt(map, x, y);
      const px = x * cellSize;
      const py = y * cellSize;

      if (kind === 'wall') {
        ctx.fillStyle = palette.wall;
        ctx.fillRect(px, py, cellSize, cellSize);
        ctx.fillStyle = palette.wallEdge;
        ctx.fillRect(px, py + cellSize - 1, cellSize, 1);
        ctx.fillRect(px + cellSize - 1, py, 1, cellSize);
      } else if (kind === 'door') {
        ctx.fillStyle = palette.door;
        ctx.fillRect(px, py, cellSize, cellSize);
        ctx.strokeStyle = palette.doorEdge;
        ctx.lineWidth = Math.max(1, cellSize * 0.12);
        ctx.strokeRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
      } else {
        ctx.fillStyle = (x + y) % 2 === 0 ? palette.floor : palette.floorAlt;
        ctx.fillRect(px, py, cellSize, cellSize);
        if (options?.showGrid !== false && cellSize >= 8) {
          ctx.strokeStyle = palette.grid;
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
        }
      }
    }
  }

  if (options?.selectedRoomId) {
    const room = map.rooms.find((r) => r.id === options.selectedRoomId);
    if (room) {
      ctx.fillStyle = palette.roomHighlight;
      ctx.fillRect(
        room.x * cellSize,
        room.y * cellSize,
        room.width * cellSize,
        room.height * cellSize,
      );
      ctx.strokeStyle = palette.roomTextSelected;
      ctx.lineWidth = Math.max(1, cellSize * 0.15);
      ctx.strokeRect(
        room.x * cellSize + 1,
        room.y * cellSize + 1,
        room.width * cellSize - 2,
        room.height * cellSize - 2,
      );
    }
  }

  if (options?.showRoomNumbers !== false) {
    ctx.font = `bold ${Math.max(8, cellSize - 2)}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const room of map.rooms) {
      const cx = (room.x + room.width / 2) * cellSize;
      const cy = (room.y + room.height / 2) * cellSize;
      const num = room.label.replace(/\D/g, '') || '?';
      if (revealed && !revealed.has(room.id)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillText(num, cx + 1, cy + 1);
      ctx.fillStyle =
        room.id === options?.selectedRoomId ? palette.roomTextSelected : palette.roomText;
      ctx.fillText(num, cx, cy);
    }
  }

  for (const marker of map.markers) {
    if (revealed && !isCellRevealed(map, marker.x, marker.y, revealed)) continue;
    const cx = marker.x * cellSize + cellSize / 2;
    const cy = marker.y * cellSize + cellSize / 2;
    const r = cellSize * 0.38;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = MARKER_COLORS[marker.kind];
    ctx.fill();
    ctx.fillStyle = '#0f1218';
    ctx.font = `bold ${Math.max(7, cellSize - 4)}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(MARKER_SYMBOLS[marker.kind], cx, cy + 0.5);
  }

  if (revealed) {
    for (let y = 0; y < map.gridHeight; y++) {
      for (let x = 0; x < map.gridWidth; x++) {
        if (!isCellRevealed(map, x, y, revealed)) {
          ctx.fillStyle = '#06080c';
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }
  }

  if (options?.vignette !== false && cellSize >= 6) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

export function dungeonMapToAscii(map: CampaignDungeonMap): string {
  const lines: string[] = [];
  for (let y = 0; y < map.gridHeight; y++) {
    let line = '';
    for (let x = 0; x < map.gridWidth; x++) {
      const marker = map.markers.find((m) => m.x === x && m.y === y);
      if (marker) {
        line += MARKER_SYMBOLS[marker.kind];
        continue;
      }
      const kind = tileAt(map, x, y);
      line += kind === 'wall' ? '#' : kind === 'door' ? '+' : '.';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

export function dungeonMapToPngDataUrl(
  map: CampaignDungeonMap,
  cellSize = 10,
  options?: DrawDungeonOptions,
): string {
  const canvas = document.createElement('canvas');
  drawDungeonToCanvas(map, canvas, cellSize, {
    showRoomNumbers: true,
    vignette: true,
    ...options,
  });
  return canvas.toDataURL('image/png');
}

export interface HandoutBuildOptions {
  /** Applique le fog of war pour la vue joueur (salles révélées uniquement). */
  playerFog?: boolean;
}

export function buildHandoutBody(
  map: CampaignDungeonMap,
  encounters: EncounterGroup[],
  options?: HandoutBuildOptions,
): string {
  const revealed =
    options?.playerFog && map.fogOfWarEnabled ? fogRevealSet(map) : null;
  const imageUrl = dungeonMapToPngDataUrl(map, 10, {
    showRoomNumbers: true,
    vignette: true,
    revealedRoomIds: revealed,
  });
  const lines: string[] = [
    `# ${map.name}`,
    '',
    `Thème : ${DUNGEON_THEME_LABELS[map.theme]}`,
    map.regionName ? `Région : ${map.regionName}` : '',
    '',
    `![${map.name}](${imageUrl})`,
    '',
    '## Légende des salles',
    '',
  ].filter(Boolean);

  for (const room of map.rooms) {
    if (revealed && !revealed.has(room.id)) continue;
    let encounterText = '';
    if (room.encounterId) {
      const enc = encounters.find((e) => e.id === room.encounterId);
      if (enc) {
        encounterText = enc.creatures
          .map((c) => `${c.quantity}× ${c.customName || c.creatureName}`)
          .join(', ');
      }
    } else if (room.randomEncounter?.creatures.length) {
      encounterText = room.randomEncounter.creatures
        .map((c) => `${c.quantity}× ${c.name}${c.cr ? ` (FP ${c.cr})` : ''}`)
        .join(', ');
    } else {
      encounterText = '—';
    }
    lines.push(`- **${room.label}** : ${encounterText}`);
    if (room.notes?.trim()) lines.push(`  - _${room.notes.trim()}_`);
  }

  if (map.markers.length) {
    lines.push('', '## Points d’intérêt', '');
    for (const m of map.markers) {
      if (revealed && !isCellRevealed(map, m.x, m.y, revealed)) continue;
      const label = m.label || DUNGEON_MARKER_LABELS[m.kind];
      lines.push(`- ${label} (${m.x}, ${m.y})${m.notes ? ` — ${m.notes}` : ''}`);
    }
  }

  return lines.join('\n');
}

export async function exportDungeonPng(map: CampaignDungeonMap, filename: string): Promise<void> {
  const canvas = document.createElement('canvas');
  drawDungeonToCanvas(map, canvas, 14, { showRoomNumbers: true, vignette: true });
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

export async function exportDungeonPdf(
  map: CampaignDungeonMap,
  encounters: EncounterGroup[],
  filename: string,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const canvas = document.createElement('canvas');
  drawDungeonToCanvas(map, canvas, 10, { showRoomNumbers: true, vignette: true });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const title = map.name;

  pdf.setFontSize(14);
  pdf.text(title, margin, margin + 4);
  pdf.setFontSize(9);
  pdf.text(
    `${DUNGEON_THEME_LABELS[map.theme]}${map.regionName ? ` · ${map.regionName}` : ''}`,
    margin,
    margin + 10,
  );

  const imgMaxW = pageW - margin * 2;
  const imgMaxH = pageH * 0.55;
  const ratio = canvas.width / canvas.height;
  let drawW = imgMaxW;
  let drawH = drawW / ratio;
  if (drawH > imgMaxH) {
    drawH = imgMaxH;
    drawW = drawH * ratio;
  }
  pdf.addImage(imgData, 'PNG', margin, margin + 14, drawW, drawH);

  let y = margin + 14 + drawH + 6;
  pdf.setFontSize(10);
  pdf.text('Légende des salles', margin, y);
  y += 5;
  pdf.setFontSize(8);

  for (const room of map.rooms) {
    if (y > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
    let text: string;
    if (room.encounterId) {
      const enc = encounters.find((e) => e.id === room.encounterId);
      text = enc
        ? enc.creatures.map((c) => `${c.quantity}× ${c.customName || c.creatureName}`).join(', ')
        : '—';
    } else if (room.randomEncounter?.creatures.length) {
      text = room.randomEncounter.creatures.map((c) => `${c.quantity}× ${c.name}`).join(', ');
    } else {
      text = '—';
    }
    pdf.text(`${room.label}: ${text}`, margin, y);
    y += 4;
  }

  pdf.save(filename);
}
