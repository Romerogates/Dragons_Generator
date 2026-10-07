export function supportStatusLabel(status: string, audience: 'player' | 'staff' = 'staff'): string {
  switch (status) {
    case 'in_progress':
      return audience === 'player' ? 'Le support consulte' : 'En cours';
    case 'closed':
      return 'Fermé';
    default:
      return 'Ouvert';
  }
}
