import type { SheetCalibrationAnchor } from '@core/config/sheet-calibration.config';

const STORAGE_KEY = 'dragons-pdf-calibration-v1';

export function loadCalibrationOverrides(): Record<string, SheetCalibrationAnchor[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, SheetCalibrationAnchor[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCalibrationOverrides(data: Record<string, SheetCalibrationAnchor[]>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function mergeAnchors(
  defaults: SheetCalibrationAnchor[],
  saved: SheetCalibrationAnchor[] | undefined,
): SheetCalibrationAnchor[] {
  if (!saved?.length) return defaults.map((a) => ({ ...a }));
  const byId = new Map(saved.map((a) => [a.id, a]));
  return defaults.map((d) => ({ ...d, ...byId.get(d.id) }));
}

export function clearCalibrationOverrides(): void {
  localStorage.removeItem(STORAGE_KEY);
}
