import { StoryRegionChoice } from '@core/models/Story/story';
import { UNKNOWN_REGION_LABEL } from './eana-map';

export function storyRegionLabel(region: StoryRegionChoice | null): string {
  if (!region) return '';
  return region.kind === 'unknown' ? UNKNOWN_REGION_LABEL : region.name;
}

export function storyLocationContext(
  region: StoryRegionChoice | null,
  setting: string,
): string | null {
  const parts: string[] = [];
  const label = storyRegionLabel(region);
  if (label) parts.push(label);
  const detail = setting.trim();
  if (detail) parts.push(detail);
  return parts.length ? parts.join(' — ') : null;
}

export function campaignRegionFromData(
  regionId?: string | null,
  regionName?: string | null,
): StoryRegionChoice | null {
  if (!regionName?.trim()) return null;
  if (regionName === UNKNOWN_REGION_LABEL || !regionId) {
    return { kind: 'unknown' };
  }
  return { kind: 'civilization', id: regionId, name: regionName };
}

export function campaignRegionFields(region: StoryRegionChoice | null): {
  regionId: string | null;
  regionName: string;
} {
  if (!region) return { regionId: null, regionName: '' };
  if (region.kind === 'unknown') {
    return { regionId: null, regionName: UNKNOWN_REGION_LABEL };
  }
  return { regionId: region.id, regionName: region.name };
}
