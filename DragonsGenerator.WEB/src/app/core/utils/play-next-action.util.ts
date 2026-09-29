/** Bandeau « prochaine action » sur /play — une consigne claire à la fois. */

export type PlayNextActionKind =
  | 'propose_hero'
  | 'wait_approval'
  | 'rejected_hero'
  | 'mark_ready'
  | 'wait_table'
  | 'roll_initiative'
  | 'wait_initiative'
  | 'your_turn'
  | 'wait_turn'
  | 'open_combat'
  | 'continue_initiative'
  | 'add_sides'
  | 'start_combat'
  | 'invite_players'
  | 'spectator'
  | 'idle';

export type PlayNextActionTone = 'sky' | 'amber' | 'emerald' | 'rose' | 'slate';

export interface PlayNextAction {
  kind: PlayNextActionKind;
  title: string;
  detail: string;
  ctaLabel?: string;
  /** Action interne du panneau. */
  cta?: 'propose' | 'ready' | 'init' | 'handouts' | 'combat' | 'secrets' | 'notes';
  tone: PlayNextActionTone;
}

export interface PlayNextActionInput {
  isDm: boolean;
  isSpectator: boolean;
  hasActiveSession: boolean;
  heroStatus: 'none' | 'pending' | 'rejected' | 'approved';
  tableReady: boolean;
  approvedPlayerCount: number;
  tableReadyCount: number;
  combatPhase: 'setup' | 'initiative' | 'fight' | null;
  collectingInitiative: boolean;
  missingInitCount: number;
  hasAlly: boolean;
  hasEnemy: boolean;
  canOpenFight: boolean;
  isMyTurn: boolean;
  myCombatantInFight: boolean;
  /** Joueur encore sans jet alors que la collecte est ouverte. */
  playerNeedsInit: boolean;
  currentTurnName: string | null;
  publishedHandoutCount: number;
}

export function resolvePlayNextAction(input: PlayNextActionInput): PlayNextAction | null {
  if (!input.hasActiveSession) return null;

  if (input.isSpectator) {
    return {
      kind: 'spectator',
      title: 'Mode spectateur',
      detail: 'Lecture seule — pas d’attaque ni d’initiative.',
      tone: 'sky',
    };
  }

  if (!input.isDm) {
    return resolvePlayerNextAction(input);
  }
  return resolveDmNextAction(input);
}

function resolvePlayerNextAction(input: PlayNextActionInput): PlayNextAction {
  if (input.heroStatus === 'none') {
    return {
      kind: 'propose_hero',
      title: 'Étape 1 — Envoyez votre héros',
      detail: 'Choisissez un personnage pour que le MJ vous accepte à la table.',
      ctaLabel: 'Envoyer un héros',
      cta: 'propose',
      tone: 'sky',
    };
  }
  if (input.heroStatus === 'rejected') {
    return {
      kind: 'rejected_hero',
      title: 'Proposition refusée',
      detail: 'Choisissez un autre personnage et renvoyez-le au MJ.',
      ctaLabel: 'Autre héros',
      cta: 'propose',
      tone: 'rose',
    };
  }
  if (input.heroStatus === 'pending') {
    return {
      kind: 'wait_approval',
      title: 'Étape 2 — En attente du MJ',
      detail: 'Votre héros est proposé. Préparez-vous, le MJ va l’approuver.',
      tone: 'amber',
    };
  }

  if (!input.tableReady) {
    return {
      kind: 'mark_ready',
      title: 'Étape 3 — Signalez que vous êtes prêt',
      detail: 'Le MJ voit qui est à table. Un tap suffit.',
      ctaLabel: 'Je suis prêt',
      cta: 'ready',
      tone: 'emerald',
    };
  }

  if (input.combatPhase === 'initiative' || input.collectingInitiative) {
    if (input.collectingInitiative && input.myCombatantInFight && input.playerNeedsInit) {
      return {
        kind: 'roll_initiative',
        title: 'Lancez votre initiative',
        detail: 'Le MJ attend votre jet pour fixer l’ordre des tours.',
        ctaLabel: 'Saisir mon initiative',
        cta: 'init',
        tone: 'sky',
      };
    }
    return {
      kind: 'wait_initiative',
      title: 'Initiative en cours',
      detail:
        input.missingInitCount > 0
          ? `Encore ${input.missingInitCount} jet(s) manquant(s) — patientez.`
          : 'Le MJ va ouvrir le combat.',
      tone: 'amber',
    };
  }

  if (input.combatPhase === 'fight') {
    if (input.isMyTurn) {
      return {
        kind: 'your_turn',
        title: 'C’est votre tour',
        detail: 'Attaquez, passez, ou consultez votre fiche.',
        tone: 'amber',
      };
    }
    return {
      kind: 'wait_turn',
      title: input.currentTurnName ? `Tour de ${input.currentTurnName}` : 'En attente',
      detail:
        input.publishedHandoutCount > 0
          ? 'Documents disponibles si besoin.'
          : 'Préparez votre prochain tour.',
      ctaLabel: input.publishedHandoutCount > 0 ? 'Documents' : undefined,
      cta: input.publishedHandoutCount > 0 ? 'handouts' : undefined,
      tone: 'slate',
    };
  }

  return {
    kind: 'wait_table',
    title: 'Table prête',
    detail: 'Le MJ lance la scène ou le combat. Restez à l’écoute.',
    ctaLabel: input.publishedHandoutCount > 0 ? 'Documents' : undefined,
    cta: input.publishedHandoutCount > 0 ? 'handouts' : undefined,
    tone: 'emerald',
  };
}

function resolveDmNextAction(input: PlayNextActionInput): PlayNextAction {
  if (input.approvedPlayerCount === 0) {
    return {
      kind: 'invite_players',
      title: 'Invitez ou approuvez un héros',
      detail: 'Sans joueur approuvé, la table reste vide. Lien d’invite dans le hub.',
      tone: 'amber',
    };
  }

  if (input.combatPhase === 'setup') {
    if (!input.hasAlly || !input.hasEnemy) {
      return {
        kind: 'add_sides',
        title: 'Ajoutez alliés et adversaires',
        detail: !input.hasAlly
          ? 'Il manque encore un allié (PJ ou PNJ).'
          : 'Il manque encore un adversaire.',
        ctaLabel: 'Voir le combat',
        cta: 'combat',
        tone: 'amber',
      };
    }
    return {
      kind: 'continue_initiative',
      title: 'Passez à l’initiative',
      detail: 'Les deux camps sont là — fixez l’ordre des tours.',
      ctaLabel: 'Continuer → Initiative',
      cta: 'combat',
      tone: 'sky',
    };
  }

  if (input.combatPhase === 'initiative') {
    if (!input.canOpenFight || input.missingInitCount > 0) {
      return {
        kind: 'wait_initiative',
        title: 'Collectez les initiatives',
        detail:
          input.missingInitCount > 0
            ? `Encore ${input.missingInitCount} sans jet — partagez le QR ou encodez.`
            : 'Tous les jets sont là — ouvrez le combat.',
        ctaLabel: 'Voir l’initiative',
        cta: 'combat',
        tone: 'sky',
      };
    }
    return {
      kind: 'open_combat',
      title: 'Ouvrez le combat',
      detail: 'Ordre des tours prêt — lancez le premier tour.',
      ctaLabel: 'Ouvrir le combat',
      cta: 'combat',
      tone: 'emerald',
    };
  }

  if (input.combatPhase === 'fight') {
    return {
      kind: 'your_turn',
      title: input.currentTurnName ? `Tour de ${input.currentTurnName}` : 'Combat en cours',
      detail: 'Espace = tour suivant · S = secrets · N = notes.',
      ctaLabel: 'Secrets',
      cta: 'secrets',
      tone: 'amber',
    };
  }

  if (input.tableReadyCount < input.approvedPlayerCount) {
    return {
      kind: 'wait_table',
      title: `${input.tableReadyCount}/${input.approvedPlayerCount} prêt(s)`,
      detail: 'Attendez les joueurs, ou lancez un combat / une scène.',
      ctaLabel: 'Combattre',
      cta: 'combat',
      tone: 'amber',
    };
  }

  return {
    kind: 'start_combat',
    title: 'Table prête — lancez la scène',
    detail: 'Combat, notes ou secrets : choisissez dans le menu.',
    ctaLabel: 'Combattre',
    cta: 'combat',
    tone: 'emerald',
  };
}
