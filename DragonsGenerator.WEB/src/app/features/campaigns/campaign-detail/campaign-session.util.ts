import type {
  CampaignSessionMode,
  CampaignSessionStatus,
} from '@core/models/Campaign/campaign';

export function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function sessionStatusLabel(status: CampaignSessionStatus): string {
  const labels: Record<CampaignSessionStatus, string> = {
    planned: 'Planifiée',
    played: 'Jouée',
    cancelled: 'Annulée',
  };
  return labels[status];
}

export function sessionStatusChipClass(status: CampaignSessionStatus): string {
  switch (status) {
    case 'played':
      return 'border-emerald-800/50 text-emerald-300 bg-emerald-950/30';
    case 'cancelled':
      return 'border-red-900/40 text-red-300 bg-red-950/20';
    default:
      return 'border-amber-800/50 text-amber-300 bg-amber-950/30';
  }
}

export function normalizeSessionMode(mode?: CampaignSessionMode | null): CampaignSessionMode {
  if (mode === 'in_person' || mode === 'other' || mode === 'online') return mode;
  return 'online';
}

export function sessionModeLabel(mode?: CampaignSessionMode | null): string {
  switch (normalizeSessionMode(mode)) {
    case 'in_person':
      return 'Présentiel';
    case 'other':
      return 'Autre';
    default:
      return 'En ligne';
  }
}

export function sessionModeChipClass(mode?: CampaignSessionMode | null): string {
  switch (normalizeSessionMode(mode)) {
    case 'in_person':
      return 'border-sky-800/50 text-sky-300 bg-sky-950/30';
    case 'other':
      return 'border-violet-800/50 text-violet-300 bg-violet-950/30';
    default:
      return 'border-emerald-800/50 text-emerald-300 bg-emerald-950/30';
  }
}

export function sessionModeHint(mode?: CampaignSessionMode | null): string {
  switch (normalizeSessionMode(mode)) {
    case 'in_person':
      return 'Le MJ encode les jets (table physique).';
    case 'other':
      return 'À chaque jet : lancer le dé ou encoder.';
    default:
      return 'Jets via dés animés (joueurs & table).';
  }
}

export function sessionInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
