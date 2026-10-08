export type SupportAudience = 'player' | 'staff';
export type SupportWaitingOn = 'support' | 'player' | 'closed';

export function supportStatusLabel(status: string, audience: SupportAudience = 'staff'): string {
  switch (status) {
    case 'in_progress':
      return audience === 'player' ? 'Le support consulte' : 'En cours';
    case 'closed':
      return 'Fermé';
    default:
      return 'Ouvert';
  }
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
