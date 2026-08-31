import type { CampaignActivityItem } from '@core/services/campaign-cloud.service';

export function activityLabel(kind: string): string {
  const labels: Record<string, string> = {
    invite_sent: 'Invitation envoyée',
    invite_accepted: 'Invitation acceptée',
    member_joined: 'Joueur rejoint',
    member_removed: 'Joueur retiré',
    character_proposed: 'Personnage proposé',
    character_pick_requested: 'Personnage demandé',
    character_approved: 'Personnage approuvé',
    character_rejected: 'Personnage refusé',
    xp_awarded: 'XP attribuée',
    session_scheduled: 'Session planifiée',
    session_updated: 'Session modifiée',
    pregen_assigned: 'Pré-tiré assigné',
    handout_published: 'Document publié',
    initiative_collection_opened: "Collecte d'initiative",
  };
  return labels[kind] ?? kind.replace(/_/g, ' ');
}

export function activityIcon(kind: string): string {
  const icons: Record<string, string> = {
    invite_sent: 'fluent-emoji:envelope',
    invite_accepted: 'fluent-emoji:handshake',
    member_joined: 'fluent-emoji:waving-hand',
    member_removed: 'fluent-emoji:door',
    character_proposed: 'fluent-emoji:scroll',
    character_pick_requested: 'fluent-emoji:shield',
    character_approved: 'fluent-emoji:check-mark-button',
    character_rejected: 'fluent-emoji:cross-mark',
    xp_awarded: 'fluent-emoji:sparkles',
    session_scheduled: 'fluent-emoji:calendar',
    session_updated: 'fluent-emoji:spiral-calendar',
    pregen_assigned: 'fluent-emoji:bust-in-silhouette',
    handout_published: 'fluent-emoji:scroll',
    initiative_collection_opened: 'fluent-emoji:dart',
  };
  return icons[kind] ?? 'fluent-emoji:memo';
}

export function activityDetail(item: CampaignActivityItem): string | null {
  try {
    const raw = item.payloadJson ? JSON.parse(item.payloadJson) : null;
    if (!raw || typeof raw !== 'object') return null;
    const p = raw as Record<string, unknown>;
    if (typeof p['message'] === 'string' && p['message'].trim()) return p['message'].trim();
    if (typeof p['characterName'] === 'string' && p['characterName'].trim()) {
      const who =
        typeof p['displayName'] === 'string' && p['displayName'].trim()
          ? `${p['displayName']} · `
          : '';
      return `${who}${p['characterName']}`;
    }
    if (typeof p['title'] === 'string' && p['title'].trim()) {
      const loc = typeof p['location'] === 'string' && p['location'] ? ` · ${p['location']}` : '';
      return `${p['title']}${loc}`;
    }
    if (typeof p['campaignTitle'] === 'string') return String(p['campaignTitle']);
    return null;
  } catch {
    return null;
  }
}

export function relativeActivityTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 60) return 'à l’instant';
  if (diffSec < 3600) return `il y a ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `il y a ${Math.floor(diffSec / 3600)} h`;
  if (diffSec < 86400 * 7) return `il y a ${Math.floor(diffSec / 86400)} j`;
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function handoutIdFromActivity(item: CampaignActivityItem): string | null {
  if (item.kind !== 'handout_published') return null;
  try {
    const raw = item.payloadJson ? JSON.parse(item.payloadJson) : null;
    if (raw && typeof raw === 'object' && typeof (raw as { handoutId?: unknown }).handoutId === 'string') {
      return (raw as { handoutId: string }).handoutId;
    }
  } catch {
    /* ignore */
  }
  return null;
}
