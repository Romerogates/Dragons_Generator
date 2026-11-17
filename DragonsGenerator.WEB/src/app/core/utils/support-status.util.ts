export type SupportAudience = 'player' | 'staff';
export type SupportWaitingOn = 'support' | 'player' | 'closed';

export function supportStatusLabel(status: string, _audience: SupportAudience = 'staff'): string {
  switch (status) {
    case 'in_progress':
      return 'En cours';
    case 'closed':
      return 'Fermé';
    default:
      return 'Ouvert';
  }
}

/** Pastille unique (liste tickets joueur + desk). */
export function supportStatusBadgeClass(status: string): string {
  const base =
    'shrink-0 self-start rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide leading-none whitespace-nowrap';
  if (status === 'in_progress') return `${base} border-sky-500/45 bg-sky-500/15 text-sky-200`;
  if (status === 'closed') return `${base} border-slate-500/45 bg-slate-500/15 text-slate-300`;
  return `${base} border-amber-400/45 bg-amber-400/15 text-amber-200`;
}

/** Qui doit répondre, d’après le statut et le dernier message (hors ouverture). */
export function supportWaitingOn(
  status: string,
  lastFromStaff: boolean | null,
): SupportWaitingOn {
  if (status === 'closed') return 'closed';
  if (lastFromStaff === true) return 'player';
  return 'support';
}

export function supportWaitingLabel(
  waiting: SupportWaitingOn,
  audience: SupportAudience,
): string {
  if (waiting === 'closed') return 'Fermé';
  if (waiting === 'player') {
    return audience === 'staff' ? 'En attente du joueur' : 'À toi de répondre';
  }
  return audience === 'staff' ? 'À traiter' : 'En attente du support';
}
