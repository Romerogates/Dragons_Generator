import type { CampaignSession } from '@core/models/Campaign/campaign';

/** Brouillon de récap joueurs à partir de la timeline / combats (sans IA). */
export function buildPlayerRecapTemplate(session: CampaignSession): string {
  const lines: string[] = [];
  const title = session.title?.trim() || 'Session';
  lines.push(`## ${title}`);
  if (session.scheduledAt) {
    try {
      const d = new Date(session.scheduledAt);
      if (!Number.isNaN(d.getTime())) {
        lines.push(
          `*${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}*`,
        );
      }
    } catch {
      /* ignore */
    }
  }
  lines.push('');

  const timeline = session.timeline ?? [];
  if (timeline.length) {
    lines.push('### Déroulement');
    for (const item of timeline) {
      const label = item.label?.trim();
      if (label) lines.push(`- ${label}`);
    }
    lines.push('');
  }

  const history = session.combatHistory ?? [];
  if (history.length) {
    lines.push('### Combats');
    for (const h of history) {
      const summary = h.summary?.trim() || `Manche ${h.round}`;
      lines.push(`- ${summary}`);
    }
    lines.push('');
  }

  const log = (session.combatLog ?? []).slice(-8);
  if (log.length) {
    lines.push('### Moments marquants');
    for (const line of log) {
      const t = line.trim();
      if (t) lines.push(`- ${t}`);
    }
    lines.push('');
  }

  if (session.objectives?.trim()) {
    lines.push('### Objectifs (rappel MJ)');
    lines.push(session.objectives.trim());
    lines.push('');
  }

  lines.push('### Suite');
  lines.push('- ');
  return lines.join('\n').trimEnd() + '\n';
}
