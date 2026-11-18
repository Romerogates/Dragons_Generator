export const GUEST_AUDIENCE_KEY = 'dragons-guest-audience';

export type HomeAudiencePref = 'all' | 'dm' | 'player';

export type HomeHeroTone = 'amber' | 'violet' | 'slate';

export interface HomeHeroCta {
  label: string;
  path: string;
  queryParams?: Record<string, string>;
  tone: HomeHeroTone;
}

export function readGuestAudience(): 'dm' | 'player' | null {
  try {
    const raw = localStorage.getItem(GUEST_AUDIENCE_KEY);
    if (raw === 'dm' || raw === 'player') return raw;
  } catch {
    /* private mode */
  }
  return null;
}

export function writeGuestAudience(value: 'dm' | 'player' | 'all'): void {
  try {
    if (value === 'all') localStorage.removeItem(GUEST_AUDIENCE_KEY);
    else localStorage.setItem(GUEST_AUDIENCE_KEY, value);
  } catch {
    /* private mode */
  }
}

/** Accueil : CTA principal / secondaire selon MJ, joueur, ou pas encore choisi. */
export function homeHeroCtas(opts: {
  loggedIn: boolean;
  audience: HomeAudiencePref;
}): { primary: HomeHeroCta; secondary: HomeHeroCta } {
  const { loggedIn, audience } = opts;

  if (audience === 'dm') {
    if (loggedIn) {
      return {
        primary: { label: 'Créer une table', path: '/campaigns', tone: 'violet' },
        secondary: { label: 'Forger un héros', path: '/create', tone: 'amber' },
      };
    }
    return {
      primary: {
        label: 'Créer une table',
        path: '/login',
        queryParams: { returnUrl: '/campaigns' },
        tone: 'violet',
      },
      secondary: { label: 'Forger un héros', path: '/create', tone: 'amber' },
    };
  }

  if (audience === 'player') {
    return {
      primary: { label: 'Forger une légende', path: '/create', tone: 'amber' },
      secondary: loggedIn
        ? { label: 'Voir les campagnes', path: '/campaigns', tone: 'slate' }
        : {
            label: 'Rejoindre une table',
            path: '/login',
            queryParams: { returnUrl: '/campaigns' },
            tone: 'slate',
          },
    };
  }

  return {
    primary: { label: 'Forger une légende', path: '/create', tone: 'amber' },
    secondary: { label: 'Guide', path: '/guide', tone: 'slate' },
  };
}
