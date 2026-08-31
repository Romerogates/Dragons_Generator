import type {
  CampaignDungeonMap,
  DungeonMarkerKind,
  DungeonTileKind,
} from '@core/models/Campaign/dungeon-map';
import { DUNGEON_MARKER_LABELS, DUNGEON_THEME_LABELS } from '@core/models/Campaign/dungeon-map';
import type { EncounterGroup } from '@core/models/Campaign/campaign';

const TILE_COLORS: Record<DungeonTileKind, string> = {
  wall: '#1e2430',
  floor: '#3d4a5c',
  door: '#b45309',
};

const MARKER_COLORS: Record<DungeonMarkerKind, string> = {
  door: '#f59e0b',
  trap: '#ef4444',
  chest: '#eab308',
  stairs: '#8b5cf6',
  note: '#64748b',
};

const MARKER_SYMBOLS: Record<DungeonMarkerKind, string> = {
  door: 'D',
  trap: '!',
  chest: '$',
  stairs: 'S',
  note: '?',
};

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

export function drawDungeonToCanvas(
  map: CampaignDungeonMap,
  canvas: HTMLCanvasElement,
  cellSize = 12,
  options?: { showRoomNumbers?: boolean; selectedRoomId?: string | null },
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = map.gridWidth * cellSize;
  const h = map.gridHeight * cellSize;
  canvas.width = w;
  canvas.height = h;

  ctx.fillStyle = '#0f1218';
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < map.gridHeight; y++) {
    for (let x = 0; x < map.gridWidth; x++) {
      const kind = tileAt(map, x, y);
      ctx.fillStyle = TILE_COLORS[kind];
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

  if (options?.showRoomNumbers !== false) {
    ctx.font = `bold ${Math.max(8, cellSize - 2)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const room of map.rooms) {
      const cx = (room.x + room.width / 2) * cellSize;
      const cy = (room.y + room.height / 2) * cellSize;
      const num = room.label.replace(/\D/g, '') || '?';
      ctx.fillStyle = room.id === options?.selectedRoomId ? '#fde68a' : '#e2e8f0';
      ctx.fillText(num, cx, cy);
    }
  }

  for (const marker of map.markers) {
    const cx = marker.x * cellSize + cellSize / 2;
    const cy = marker.y * cellSize + cellSize / 2;
    ctx.fillStyle = MARKER_COLORS[marker.kind];
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f1218';
    ctx.font = `bold ${Math.max(7, cellSize - 4)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(MARKER_SYMBOLS[marker.kind], cx, cy);
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

export function buildHandoutBody(
  map: CampaignDungeonMap,
  encounters: EncounterGroup[],
): string {
  const lines: string[] = [
    `# ${map.name}`,
    '',
    `Thème : ${DUNGEON_THEME_LABELS[map.theme]}`,
    map.regionName ? `Région : ${map.regionName}` : '',
    '',
    '## Légende des salles',
    '',
  ].filter(Boolean);

  for (const room of map.rooms) {
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
      const label = m.label || DUNGEON_MARKER_LABELS[m.kind];
      lines.push(`- ${label} (${m.x}, ${m.y})${m.notes ? ` — ${m.notes}` : ''}`);
    }
  }

  lines.push('', '_Carte visuelle : exportez PNG/PDF depuis l’éditeur._');
  return lines.join('\n');
}

export async function exportDungeonPng(map: CampaignDungeonMap, filename: string): Promise<void> {
  const canvas = document.createElement('canvas');
  drawDungeonToCanvas(map, canvas, 14, { showRoomNumbers: true });
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
  drawDungeonToCanvas(map, canvas, 10, { showRoomNumbers: true });

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
    let text = '';
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
