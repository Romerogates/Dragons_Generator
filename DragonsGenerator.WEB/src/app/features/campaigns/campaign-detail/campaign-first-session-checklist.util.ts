export type FirstSessionStepId = 'heroes' | 'invite' | 'session' | 'table';

export type FirstSessionAction =
  | 'invite'
  | 'openPlayers'
  | 'openPregens'
  | 'openSessions'
  | 'openPlay'
  | 'addSession'
  | 'openPrep';

export interface FirstSessionChecklistInput {
  hasInviteActivity: boolean;
  approvedPlayerCount: number;
  /** Pré-tirés marqués prêts — suffisent pour préparer sans joueurs. */
  readyPregenCount: number;
  hasPlannedSession: boolean;
  hasActiveSession: boolean;
  playedSessionCount: number;
}

export interface FirstSessionStepView {
  id: FirstSessionStepId;
  label: string;
  done: boolean;
  hint: string;
  actionLabel: string;
  action: FirstSessionAction;
}

export interface FirstSessionChecklistView {
  steps: FirstSessionStepView[];
  doneCount: number;
  progressPct: number;
  allDone: boolean;
  current: FirstSessionStepView | null;
}

/** Checklist courte Résumé : Héros → Inviter → Session → Table. */
export function buildFirstSessionChecklist(
  input: FirstSessionChecklistInput,
): FirstSessionChecklistView {
  const inviteDone = input.hasInviteActivity || input.approvedPlayerCount > 0;
  const heroesDone = input.approvedPlayerCount > 0 || input.readyPregenCount > 0;
  const sessionDone = input.hasPlannedSession || input.hasActiveSession;
  const tableDone = input.hasActiveSession || input.playedSessionCount > 0;

  const steps: FirstSessionStepView[] = [
    {
      id: 'heroes',
      label: 'Héros',
      done: heroesDone,
      hint:
        input.readyPregenCount > 0 && input.approvedPlayerCount === 0
          ? 'Pré-tirés prêts — les joueurs pourront les prendre à l’arrivée.'
          : input.approvedPlayerCount > 0
            ? 'Au moins un héros approuvé à la table.'
            : 'Préparez des pré-tirés tout de suite, même sans joueurs sur l’app.',
      actionLabel:
        input.approvedPlayerCount > 0 ? 'Voir les joueurs' : 'Préparer des pré-tirés',
      action: input.approvedPlayerCount > 0 ? 'openPlayers' : 'openPregens',
    },
    {
      id: 'invite',
      label: 'Inviter',
      done: inviteDone,
      hint: 'Partagez le lien d’invitation quand vous êtes prêt — les pré-tirés seront déjà là.',
      actionLabel: 'Inviter',
      action: 'invite',
    },
    {
      id: 'session',
      label: 'Session',
      done: sessionDone,
      hint: 'Planifiez une session pour ce soir (ou entrez si elle est déjà prête).',
      actionLabel: input.hasPlannedSession ? 'Sessions' : 'Planifier ce soir',
      action: input.hasPlannedSession ? 'openSessions' : 'addSession',
    },
    {
      id: 'table',
      label: 'Table',
      done: tableDone,
      hint: 'Entrez en session puis ouvrez la table live pour combattre.',
      actionLabel: input.hasActiveSession ? 'Ouvrir la table' : 'Entrer en session',
      action: 'openPlay',
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const current = steps.find((s) => !s.done) ?? null;

  return {
    steps,
    doneCount,
    progressPct: Math.round((doneCount / steps.length) * 100),
    allDone: doneCount === steps.length,
    current,
  };
}
