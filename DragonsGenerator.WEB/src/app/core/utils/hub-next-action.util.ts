/** Prochaine action joueur / MJ sur le hub campagne (hors /play). */

export type HubNextActionKind =
  | 'propose_hero'
  | 'wait_approval'
  | 'rejected_hero'
  | 'enter_play'
  | 'rsvp'
  | 'wait_session'
  | 'spectator'
  | 'idle';

export interface HubNextAction {
  kind: HubNextActionKind;
  title: string;
  detail: string;
  ctaLabel?: string;
  /** Navigation / action hub. */
  cta?: 'players' | 'play' | 'sessions' | 'enter_session' | 'create_hero' | 'rsvp' | 'calendar';
  tone: 'sky' | 'amber' | 'emerald' | 'rose' | 'slate';
  eventId?: string;
}

export interface HubPendingRsvp {
  eventId: string;
  title: string;
  whenLabel: string;
}

export interface HubNextActionInput {
  /** Owner ou co-MJ (`campaignIsTableDm`). */
  isTableDm: boolean;
  isSpectator: boolean;
  heroStatus: 'none' | 'pending' | 'rejected' | 'approved';
  hasActiveSession: boolean;
  hasPlannedSession: boolean;
  pendingRsvp?: HubPendingRsvp | null;
}

export function resolveHubNextAction(input: HubNextActionInput): HubNextAction | null {
  if (input.isTableDm) {
    if (input.hasActiveSession) {
      return {
        kind: 'enter_play',
        title: 'La table est ouverte',
        detail: 'Rejoignez la scène — les joueurs vous y attendent.',
        ctaLabel: 'Ouvrir la table',
        cta: 'play',
        tone: 'emerald',
      };
    }
    if (input.hasPlannedSession) {
      return {
        kind: 'wait_session',
        title: 'Ouvrez la table',
        detail: 'La soirée est planifiée. Entrez en session pour que tout le monde voie la scène.',
        ctaLabel: 'Entrer en session',
        cta: 'enter_session',
        tone: 'amber',
      };
    }
    return {
      kind: 'idle',
      title: 'Préparez la soirée',
      detail: 'Planifiez une session, puis ouvrez la table quand le groupe est là.',
      ctaLabel: 'Planifier',
      cta: 'sessions',
      tone: 'slate',
    };
  }
  if (input.isSpectator) {
    return {
      kind: 'spectator',
      title: 'Mode spectateur',
      detail: 'Vous regardez la table — pas d’attaque ni de proposition de héros.',
      tone: 'sky',
    };
  }

  if (input.heroStatus === 'none') {
    return {
      kind: 'propose_hero',
      title: 'Ce soir — Proposez un héros',
      detail: 'Sans personnage validé par le MJ, vous ne pourrez pas rejoindre la table.',
      ctaLabel: 'Proposer un héros',
      cta: 'players',
      tone: 'sky',
    };
  }
  if (input.heroStatus === 'rejected') {
    return {
      kind: 'rejected_hero',
      title: 'Proposition refusée',
      detail: 'Choisissez un autre personnage et renvoyez-le au MJ.',
      ctaLabel: 'Autre héros',
      cta: 'players',
      tone: 'rose',
    };
  }
  if (input.heroStatus === 'pending') {
    return {
      kind: 'wait_approval',
      title: 'Ce soir — En attente du MJ',
      detail: 'Votre héros est proposé. Dès qu’il est validé, vous pourrez rejoindre la table.',
      tone: 'amber',
    };
  }

  if (input.hasActiveSession) {
    return {
      kind: 'enter_play',
      title: 'Ce soir — La table est ouverte',
      detail: 'Rejoignez la scène, marquez-vous prêt, puis suivez le bandeau.',
      ctaLabel: 'Entrer à la table',
      cta: 'play',
      tone: 'emerald',
    };
  }

  if (input.pendingRsvp) {
    return {
      kind: 'rsvp',
      title: `Vous venez ? ${input.pendingRsvp.title}`,
      detail: `${input.pendingRsvp.whenLabel} — répondez pour que le MJ sache qui sera à table.`,
      ctaLabel: 'Répondre',
      cta: 'rsvp',
      tone: 'amber',
      eventId: input.pendingRsvp.eventId,
    };
  }

  if (input.hasPlannedSession) {
    return {
      kind: 'wait_session',
      title: 'Héros prêt — en attente de soirée',
      detail: 'Le MJ ouvrira la table. Restez sur « Ce soir » pour la rejoindre.',
      ctaLabel: 'Voir les soirées',
      cta: 'sessions',
      tone: 'amber',
    };
  }

  return {
    kind: 'idle',
    title: 'Héros prêt',
    detail: 'Aucune soirée planifiée pour l’instant — le MJ va en ouvrir une.',
    ctaLabel: 'Voir les soirées',
    cta: 'sessions',
    tone: 'slate',
  };
}
