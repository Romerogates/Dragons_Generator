export type CampaignSetupStepId =
  | 'scenario'
  | 'creatures'
  | 'maps'
  | 'encounters'
  | 'players'
  | 'session'
  | 'play';

export type CampaignSetupAction =
  | 'editScenario'
  | 'openCreatures'
  | 'openMaps'
  | 'openEncounters'
  | 'generateEncounters'
  | 'openPlayers'
  | 'addSession'
  | 'openSessions'
  | 'startNextSession'
  | 'openPlay'
  | 'openPlayFullscreen'
  | 'skipMaps';

export interface CampaignSetupGuideInput {
  hasAdventure: boolean;
  creatureCount: number;
  mapCount: number;
  encounterCount: number;
  approvedPlayerCount: number;
  playerCount: number;
  hasPlannedSession: boolean;
  hasActiveSession: boolean;
  nextSessionTitle: string | null;
  mapsSkipped: boolean;
}

export interface CampaignSetupStepView {
  id: CampaignSetupStepId;
  label: string;
  done: boolean;
  optional: boolean;
  skipped: boolean;
}

export interface CampaignSetupGuideView {
  steps: CampaignSetupStepView[];
  doneCount: number;
  totalCount: number;
  progressPct: number;
  allReady: boolean;
  liveSession: boolean;
  current: {
    id: CampaignSetupStepId;
    title: string;
    proposal: string;
    tip: string;
    primaryLabel: string;
    primaryAction: CampaignSetupAction;
    secondaryLabel?: string;
    secondaryAction?: CampaignSetupAction;
  } | null;
}

export function buildCampaignSetupGuide(input: CampaignSetupGuideInput): CampaignSetupGuideView {
  const scenarioDone = input.hasAdventure;
  const creaturesDone = input.creatureCount > 0;
  const mapsDone = input.mapCount > 0 || input.mapsSkipped;
  const encountersDone = input.encounterCount > 0;
  const playersDone = input.approvedPlayerCount > 0;
  const sessionDone = input.hasPlannedSession || input.hasActiveSession;

  const steps: CampaignSetupStepView[] = [
    { id: 'scenario', label: 'Scénario', done: scenarioDone, optional: false, skipped: false },
    { id: 'creatures', label: 'Créatures', done: creaturesDone, optional: false, skipped: false },
    {
      id: 'maps',
      label: 'Carte',
      done: mapsDone,
      optional: true,
      skipped: input.mapsSkipped && input.mapCount === 0,
    },
    { id: 'encounters', label: 'Rencontres', done: encountersDone, optional: false, skipped: false },
    { id: 'players', label: 'Héros', done: playersDone, optional: false, skipped: false },
    { id: 'session', label: 'Session', done: sessionDone, optional: false, skipped: false },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const totalCount = steps.length;
  const progressPct = Math.round((doneCount / totalCount) * 100);
  const allReady = steps.every((s) => s.done);
  const liveSession = input.hasActiveSession;

  if (liveSession) {
    return {
      steps,
      doneCount,
      totalCount,
      progressPct: 100,
      allReady: true,
      liveSession: true,
      current: {
        id: 'play',
        title: 'Session en cours',
        proposal:
          'Vous êtes en session. Ouvrez la table plein écran pour noter, lancer des rencontres et combattre — le combat n’existe qu’ici.',
        tip: '',
        primaryLabel: 'Ouvrir la table',
        primaryAction: 'openPlayFullscreen',
      },
    };
  }

  if (allReady) {
    return {
      steps,
      doneCount,
      totalCount,
      progressPct: 100,
      allReady: true,
      liveSession: false,
      current: {
        id: 'play',
        title: input.nextSessionTitle ?? 'Nouvelle session',
        proposal: input.nextSessionTitle
          ? `Entrez en session « ${input.nextSessionTitle} » pour ouvrir la table. Le combat n’est disponible qu’après.`
          : 'Planifiez une session : la préparation reste ici, le jeu commence seulement en session.',
        tip: '',
        primaryLabel: input.nextSessionTitle ? 'Entrer en session' : 'Planifier une session',
        primaryAction: input.nextSessionTitle ? 'startNextSession' : 'addSession',
        secondaryLabel: 'Onglet Sessions',
        secondaryAction: 'openSessions',
      },
    };
  }

  const next = steps.find((s) => !s.done);
  const current = next ? describeStep(next.id, input) : null;

  return {
    steps,
    doneCount,
    totalCount,
    progressPct,
    allReady: false,
    liveSession: false,
    current,
  };
}

function describeStep(
  id: CampaignSetupStepId,
  input: CampaignSetupGuideInput,
): NonNullable<CampaignSetupGuideView['current']> {
  switch (id) {
    case 'scenario':
      return {
        id,
        title: 'Posez le décor',
        proposal:
          'Écrivez ou régénérez le synopsis de campagne. Les joueurs comprennent mieux l’aventure, et vous gardez une boussole claire.',
        tip: 'Vous pouvez aussi affiner titre, région et ton via « Modifier le scénario ».',
        primaryLabel: 'Modifier le scénario',
        primaryAction: 'editScenario',
      };
    case 'creatures':
      return {
        id,
        title: 'Choisissez les adversaires',
        proposal:
          'Ajoutez les monstres et PNJ de cette campagne dans l’onglet Créatures. Ce bestiaire alimentera rencontres et combats.',
        tip: 'Proposez au moins un antagoniste (boss) et 2–3 sbires pour varier les scènes.',
        primaryLabel: 'Aller aux créatures',
        primaryAction: 'openCreatures',
      };
    case 'maps':
      return {
        id,
        title: 'Donnez un lieu à explorer',
        proposal:
          'Générez une carte de donjon (ou ruines) pour que la table ait un endroit concret où se déplacer et déclencher des combats.',
        tip: 'Pas obligatoire pour un one-shot social — vous pouvez passer cette étape.',
        primaryLabel: 'Créer une carte',
        primaryAction: 'openMaps',
        secondaryLabel: 'Passer pour l’instant',
        secondaryAction: 'skipMaps',
      };
    case 'encounters':
      return {
        id,
        title: 'Composez les combats',
        proposal:
          input.creatureCount > 0
            ? 'Regroupez vos créatures en rencontres (escarmouche, boss…). Vous pourrez les lancer d’un clic à la table.'
            : 'Il vous faut d’abord des créatures pour monter des rencontres.',
        tip: 'Vous pouvez générer automatiquement des groupes depuis le bestiaire.',
        primaryLabel:
          input.creatureCount > 0 && input.encounterCount === 0
            ? 'Générer les rencontres'
            : 'Ouvrir les rencontres',
        primaryAction:
          input.creatureCount > 0 && input.encounterCount === 0
            ? 'generateEncounters'
            : 'openEncounters',
        secondaryLabel:
          input.creatureCount > 0 && input.encounterCount === 0 ? 'Ouvrir les rencontres' : undefined,
        secondaryAction:
          input.creatureCount > 0 && input.encounterCount === 0 ? 'openEncounters' : undefined,
      };
    case 'players':
      return {
        id,
        title: 'Invitez la table',
        proposal:
          input.playerCount === 0
            ? 'Invitez vos amis, puis approuvez leur personnage. Sans héros approuvé, le combat n’a personne à mettre du côté allié.'
            : 'Des joueurs sont là — approuvez au moins un personnage pour pouvoir l’importer en combat.',
        tip: 'Vous pouvez aussi préparer des pré-tirés si quelqu’un n’a pas encore de fiche.',
        primaryLabel: 'Gérer les joueurs',
        primaryAction: 'openPlayers',
      };
    case 'session':
      return {
        id,
        title: 'Planifiez une session',
        proposal:
          'Cette page prépare la campagne. Pour jouer (et combattre), planifiez puis entrez dans une session.',
        tip: 'Sans session active, la table de combat reste fermée.',
        primaryLabel: 'Planifier une session',
        primaryAction: 'addSession',
        secondaryLabel: 'Voir les sessions',
        secondaryAction: 'openSessions',
      };
    default:
      return {
        id: 'play',
        title: 'Prêt',
        proposal: 'Vous pouvez continuer.',
        tip: '',
        primaryLabel: 'Continuer',
        primaryAction: 'openPlay',
      };
  }
}
