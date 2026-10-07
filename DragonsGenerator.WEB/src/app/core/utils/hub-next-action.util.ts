/** Prochaine action joueur sur le hub campagne (hors /play). */

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
  cta?: 'players' | 'play' | 'sessions' | 'create_hero' | 'rsvp';
  tone: 'sky' | 'amber' | 'emerald' | 'rose' | 'slate';
  eventId?: string;
}

export interface HubPendingRsvp {
  eventId: string;
  title: string;
  whenLabel: string;
}

export interface HubNextActionInput {
  isOwner: boolean;
  isSpectator: boolean;
  heroStatus: 'none' | 'pending' | 'rejected' | 'approved';
  hasActiveSession: boolean;
  hasPlannedSession: boolean;
  pendingRsvp?: HubPendingRsvp | null;
}

export function resolveHubNextAction(input: HubNextActionInput): HubNextAction | null {
  if (input.isOwner) return null;
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
      title: 'Étape 1 — Proposez un héros',
      detail: 'Sans personnage approuvé, vous ne pourrez pas jouer à la table.',
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
      title: 'Étape 2 — En attente du MJ',
      detail: 'Votre héros est proposé. Vous pourrez entrer en table dès validation.',
      tone: 'amber',
    };
  }

  if (input.hasActiveSession) {
    return {
      kind: 'enter_play',
      title: 'Étape 3 — La table est ouverte',
      detail: 'Rejoignez /play, marquez-vous prêt, puis suivez le bandeau « prochaine action ».',
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
      title: 'Héros prêt — en attente de session',
      detail: 'Le MJ doit entrer en session. Surveillez l’onglet Sessions.',
      ctaLabel: 'Voir les sessions',
      cta: 'sessions',
      tone: 'amber',
    };
  }

  return {
    kind: 'idle',
    title: 'Héros prêt',
    detail: 'Aucune session planifiée pour l’instant — le MJ va en créer une.',
    ctaLabel: 'Voir les sessions',
    cta: 'sessions',
    tone: 'slate',
  };
}
