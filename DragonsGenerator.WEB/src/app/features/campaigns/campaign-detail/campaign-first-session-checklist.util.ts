export type FirstSessionStepId = 'invite' | 'heroes' | 'session' | 'table';

export type FirstSessionAction =
  | 'invite'
  | 'openPlayers'
  | 'openSessions'
  | 'openPlay'
  | 'addSession'
  | 'openPrep';

export interface FirstSessionChecklistInput {
  hasInviteActivity: boolean;
  approvedPlayerCount: number;
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

/** Checklist courte Résumé : Inviter → Héros → Session → Table. */
export function buildFirstSessionChecklist(
  input: FirstSessionChecklistInput,
): FirstSessionChecklistView {
  const inviteDone = input.hasInviteActivity || input.approvedPlayerCount > 0;
  const heroesDone = input.approvedPlayerCount > 0;
  const sessionDone = input.hasPlannedSession || input.hasActiveSession;
  const tableDone = input.hasActiveSession || input.playedSessionCount > 0;

  const steps: FirstSessionStepView[] = [
    {
      id: 'invite',
      label: 'Inviter',
      done: inviteDone,
      hint: 'Partagez le lien d’invitation pour faire rejoindre la table.',
      actionLabel: 'Inviter',
      action: 'invite',
    },
    {
      id: 'heroes',
      label: 'Héros',
      done: heroesDone,
      hint: 'Au moins un joueur avec un personnage approuvé.',
      actionLabel: 'Voir les joueurs',
      action: 'openPlayers',
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
