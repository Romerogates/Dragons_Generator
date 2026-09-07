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
          'Tu es en session. Ouvre la table pour noter, lancer des rencontres et combattre — le combat n’existe qu’ici.',
        tip: '',
        primaryLabel: 'Ouvrir la table',
        primaryAction: 'openPlay',
        secondaryLabel: 'Plein écran',
        secondaryAction: 'openPlayFullscreen',
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
          ? `Entre en session « ${input.nextSessionTitle} » pour ouvrir la table. Le combat n’est disponible qu’après.`
          : 'Planifie une session : la préparation reste ici, le jeu commence seulement en session.',
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
        title: 'Pose le décor',
        proposal:
          'Écris ou régénère le synopsis de campagne. Les joueurs comprennent mieux l’aventure, et toi tu gardes une boussole claire.',
        tip: 'Tu peux aussi affiner titre, région et ton via « Modifier le scénario ».',
        primaryLabel: 'Modifier le scénario',
        primaryAction: 'editScenario',
      };
    case 'creatures':
      return {
        id,
        title: 'Choisis les adversaires',
        proposal:
          'Ajoute les monstres et PNJ de cette campagne dans l’onglet Créatures. Ce bestiaire alimentera rencontres et combats.',
        tip: 'Propose au moins un antagoniste (boss) et 2–3 sbires pour varier les scènes.',
        primaryLabel: 'Aller aux créatures',
        primaryAction: 'openCreatures',
      };
    case 'maps':
      return {
        id,
        title: 'Donne un lieu à explorer',
        proposal:
          'Génère une carte de donjon (ou ruines) pour que la table ait un endroit concret où se déplacer et déclencher des combats.',
        tip: 'Pas obligatoire pour un one-shot social — tu peux passer cette étape.',
        primaryLabel: 'Créer une carte',
        primaryAction: 'openMaps',
        secondaryLabel: 'Passer pour l’instant',
        secondaryAction: 'skipMaps',
      };
    case 'encounters':
      return {
        id,
        title: 'Compose les combats',
        proposal:
          input.creatureCount > 0
            ? 'Regroupe tes créatures en rencontres (escarmouche, boss…). Tu pourras les lancer d’un clic à la table.'
            : 'Il te faut d’abord des créatures pour monter des rencontres.',
        tip: 'Tu peux générer automatiquement des groupes depuis le bestiaire.',
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
        title: 'Invite la table',
        proposal:
          input.playerCount === 0
            ? 'Invite tes amis, puis approuve leur personnage. Sans héros approuvé, le combat n’a personne à mettre du côté allié.'
            : 'Des joueurs sont là — approuve au moins un personnage pour pouvoir l’importer en combat.',
        tip: 'Tu peux aussi préparer des pré-tirés si quelqu’un n’a pas encore de fiche.',
        primaryLabel: 'Gérer les joueurs',
        primaryAction: 'openPlayers',
      };
    case 'session':
      return {
        id,
        title: 'Planifie une session',
        proposal:
          'Cette page prépare la campagne. Pour jouer (et combattre), planifie puis entre dans une session.',
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
        proposal: 'Tu peux démarrer.',
        tip: '',
        primaryLabel: 'Continuer',
        primaryAction: 'openPlay',
      };
  }
}
