import type { GuideAudience, GuideNavGroup, GuideStep } from './guide.types';
import {
  GUIDE_ALL_NAV,
  GUIDE_BLOG_POSTS,
  GUIDE_CAMPAIGN_MJ_FLOW,
  GUIDE_CAMPAIGN_PLAYER_FLOW,
  GUIDE_CHARACTER_STEPS,
  GUIDE_COMBAT_FLOW,
  GUIDE_DM_CHECKLIST,
  GUIDE_DUNGEON_GEN_STEPS,
  GUIDE_FEATURE_INDEX,
  GUIDE_FAQ_ITEMS,
  GUIDE_FLASH_CARDS,
  GUIDE_GLOSSARY,
  GUIDE_NAV_GROUPS,
  GUIDE_NOTIFICATION_EVENTS,
  GUIDE_ONESHOT_STEPS,
  GUIDE_PLAYER_CHECKLIST,
  GUIDE_PROPOSAL_FLOW,
  GUIDE_QUICK_CARDS,
  GUIDE_START_STEPS,
  GUIDE_TABLE_PLAY_STEPS,
  GUIDE_TIPS,
} from './guide-content';

export interface GuideTopicLink {
  label: string;
  path: string;
  hint?: string;
}

export interface GuideTopicFlash {
  title: string;
  bullets: string[];
  icon: string;
}

export interface GuideTopic {
  id: string;
  title: string;
  summary: string;
  icon: string;
  accent: string;
  audience: GuideAudience;
  groupId: string;
  groupLabel: string;
  tags: string[];
  paragraphs: string[];
  steps: GuideStep[];
  links: GuideTopicLink[];
  flow: string[];
  flashes: GuideTopicFlash[];
  checklist: { id: string; label: string }[];
}

function groupOf(sectionId: string): GuideNavGroup | undefined {
  return GUIDE_NAV_GROUPS.find((g) => g.sectionIds.includes(sectionId));
}

function summaryFor(sectionId: string, fallback: string): string {
  const hit = GUIDE_FEATURE_INDEX.find((i) => i.sectionId === sectionId);
  return hit?.description ?? fallback;
}

function flashesFor(id: string, audience: GuideAudience): GuideTopicFlash[] {
  return GUIDE_FLASH_CARDS.filter(
    (f) =>
      f.sectionId === id &&
      (f.audience === 'all' || audience === 'all' || f.audience === audience),
  ).map((f) => ({ title: f.title, bullets: f.bullets, icon: f.icon }));
}

function contentFor(id: string): Pick<
  GuideTopic,
  'paragraphs' | 'steps' | 'links' | 'flow' | 'checklist'
> {
  switch (id) {
    case 'demarrage':
      return {
        paragraphs: [
          'Dragons Generator couvre la création de personnages Dragons, les campagnes en ligne et la table de jeu (notes, combat, documents).',
          'Commencez par un compte, forgez un héros, puis créez ou rejoignez une campagne. Le combat et la table plein écran n’existent qu’en session active.',
        ],
        steps: GUIDE_START_STEPS,
        links: [
          { label: 'S’inscrire', path: '/register', hint: 'Compte cloud' },
          { label: 'Forger un héros', path: '/create', hint: 'Wizard' },
          { label: 'Mes campagnes', path: '/campaigns', hint: 'MJ & joueurs' },
          { label: 'Paramètres / push', path: '/settings', hint: 'Notifications' },
        ],
        flow: ['Compte', 'Héros', 'Campagne', 'Session', 'Combat'],
        checklist: [],
      };
    case 'parcours':
      return {
        paragraphs: [
          'Deux parcours complémentaires : le MJ prépare et anime ; le joueur forge, propose et joue.',
          'Filtrez ce guide avec MJ / Joueur pour ne voir que votre rôle. Les fiches « tous » restent visibles.',
        ],
        steps: [
          {
            title: 'Parcours MJ',
            body: 'Campagne → inviter → valider persos → préparer (docs / donjons) → planifier → session → combat.',
            badge: 'MJ',
            link: '/campaigns',
            linkLabel: 'Campagnes',
          },
          {
            title: 'Parcours joueur',
            body: 'Héros → accepter invite → proposer fiche → lire docs → saisir initiative en combat.',
            badge: 'Joueur',
            link: '/create',
            linkLabel: 'Créer un héros',
          },
        ],
        links: [
          { label: 'Guide one-shot', path: '/guide/oneshot' },
          { label: 'Checklists', path: '/guide/checklists' },
          { label: 'Mes amis', path: '/friends' },
        ],
        flow: [...GUIDE_CAMPAIGN_MJ_FLOW.slice(0, 3), '…', ...GUIDE_CAMPAIGN_PLAYER_FLOW.slice(0, 3)],
        checklist: [],
      };
    case 'oneshot':
      return {
        paragraphs: [
          'Objectif : une table prête en une soirée, de l’invitation à la fin de session.',
          'Suivez l’ordre MJ / Joueur ci-dessous ; activez les push pour ne rien rater.',
        ],
        steps: GUIDE_ONESHOT_STEPS.map((s) => ({
          title: s.title,
          body: s.detail,
          badge: s.role === 'MJ' ? 'MJ' : s.role === 'Joueur' ? 'Joueur' : 'Tous',
        })),
        links: [
          { label: 'Campagnes', path: '/campaigns' },
          { label: 'Amis & invites', path: '/friends' },
          { label: 'Notifications', path: '/settings?tab=notifications' },
        ],
        flow: GUIDE_ONESHOT_STEPS.map((s) => s.title),
        checklist: [],
      };
    case 'actions':
      return {
        paragraphs: [
          'Raccourcis « 30 secondes » pour les gestes les plus fréquents à la table.',
          'Chaque carte pointe vers la fiche détaillée du guide.',
        ],
        steps: GUIDE_FLASH_CARDS.slice(0, 6).map((f) => ({
          title: f.title,
          body: f.bullets.join(' · '),
          badge: f.audience === 'dm' ? 'MJ' : f.audience === 'player' ? 'Joueur' : 'Tous',
          link: `/guide/${f.sectionId}`,
          linkLabel: 'Voir la fiche',
        })),
        links: [
          { label: 'Campagnes', path: '/campaigns' },
          { label: 'Création héros', path: '/create' },
        ],
        flow: [],
        checklist: [],
      };
    case 'journal':
      return {
        paragraphs: [
          'Journal des nouveautés produit — lisez les mises à jour, puis discutez en commentaires.',
          ...GUIDE_TIPS.slice(0, 2),
        ],
        steps: GUIDE_BLOG_POSTS.filter((p) => p.isNew).map((p) => ({
          title: p.title,
          body: `${p.date} · ${p.summary}`,
        })),
        links: [
          { label: 'Sommaire du guide', path: '/guide' },
          { label: 'Support', path: '/support' },
        ],
        flow: [],
        checklist: [],
      };
    case 'checklists':
      return {
        paragraphs: [
          'Listes de préparation avant une session. Cochez mentalement (ou dans vos calepins de session).',
        ],
        steps: [],
        links: [
          { label: 'Table MJ', path: '/guide/table' },
          { label: 'Campagnes', path: '/campaigns' },
        ],
        flow: [],
        checklist: [...GUIDE_DM_CHECKLIST, ...GUIDE_PLAYER_CHECKLIST],
      };
    case 'personnage':
      return {
        paragraphs: [
          'Le wizard couvre espèce → civilisation → historique → classe → caracs → compétences → équipement → langues → magie → identité → PDF.',
          'Sauvegarde cloud dès que vous êtes connecté ; la fiche PDF se télécharge à la fin.',
        ],
        steps: GUIDE_CHARACTER_STEPS.map((s) => ({
          ...s,
          link: '/create',
          linkLabel: 'Ouvrir le wizard',
        })),
        links: [
          { label: 'Forger un héros', path: '/create' },
          { label: 'Mes héros', path: '/characters' },
          { label: 'Espèces (codex)', path: '/species' },
          { label: 'Classes', path: '/classes' },
        ],
        flow: GUIDE_CHARACTER_STEPS.map((s) => s.title),
        checklist: [],
      };
    case 'scenario':
      return {
        paragraphs: [
          'Créez une campagne via l’assistant scénario ou « Campagne vide ». Invitez des amis, validez les personnages proposés.',
          'Les joueurs voient XP et sessions dans Résumé. Les MJ préparent docs, cartes et rencontres.',
        ],
        steps: [
          {
            title: 'Flux proposition de perso',
            body: GUIDE_PROPOSAL_FLOW.map((s) => `${s.role} : ${s.label}`).join(' → '),
            badge: 'Tous',
            link: '/campaigns',
            linkLabel: 'Campagnes',
          },
          {
            title: 'Flux MJ',
            body: GUIDE_CAMPAIGN_MJ_FLOW.join(' → '),
            badge: 'MJ',
          },
          {
            title: 'Flux joueur',
            body: GUIDE_CAMPAIGN_PLAYER_FLOW.join(' → '),
            badge: 'Joueur',
          },
        ],
        links: [
          { label: 'Mes campagnes', path: '/campaigns' },
          { label: 'Nouveau scénario', path: '/story/create' },
          { label: 'Amis', path: '/friends' },
        ],
        flow: GUIDE_CAMPAIGN_MJ_FLOW,
        checklist: [],
      };
    case 'table':
      return {
        paragraphs: [
          'En session active, le MJ dispose de notes live (widgets calepins), import party, tracker et fin de session.',
          'Les notes de calepins sont fusionnées dans les notes archivées à la fin.',
        ],
        steps: GUIDE_TABLE_PLAY_STEPS.map((s) => ({
          title: s.label,
          body: s.detail,
          badge: 'MJ' as const,
          link: '/campaigns',
          linkLabel: 'Ouvrir une campagne',
        })),
        links: [
          { label: 'Campagnes', path: '/campaigns' },
          { label: 'Combat', path: '/guide/initiative' },
          { label: 'Documents', path: '/guide/documents' },
        ],
        flow: GUIDE_TABLE_PLAY_STEPS.map((s) => s.label),
        checklist: GUIDE_DM_CHECKLIST,
      };
    case 'donjons':
      return {
        paragraphs: [
          'Onglet Cartes & donjons (MJ) : générer, éditer, exporter, ou publier en handout.',
          'Attribuez une carte à une session pour l’avoir sous la main à la table.',
        ],
        steps: GUIDE_DUNGEON_GEN_STEPS,
        links: [
          { label: 'Campagnes (cartes)', path: '/campaigns', hint: 'Onglet Cartes' },
          { label: 'Documents', path: '/guide/documents' },
        ],
        flow: GUIDE_DUNGEON_GEN_STEPS.map((s) => s.title),
        checklist: [],
      };
    case 'initiative':
      return {
        paragraphs: [
          'Le MJ importe la party, collecte l’initiative ; les joueurs saisissent leur jet via bandeau ou notification.',
          'Puis PV, tours, et historique de combat en fin de rencontre.',
        ],
        steps: GUIDE_COMBAT_FLOW.map((s) => ({
          title: s.label,
          body: `Rôle : ${s.role}`,
          badge: s.role === 'MJ' ? 'MJ' : s.role === 'Joueurs' ? 'Joueur' : 'Tous',
        })),
        links: [
          { label: 'Actions de combat (codex)', path: '/combat-actions' },
          { label: 'Campagnes', path: '/campaigns' },
          { label: 'Notifications', path: '/notifications' },
        ],
        flow: GUIDE_COMBAT_FLOW.map((s) => s.label),
        checklist: [],
      };
    case 'documents':
      return {
        paragraphs: [
          'Handouts markdown : créer, publier, les joueurs sont notifiés. Une carte PNG peut être jointe.',
        ],
        steps: [
          {
            title: 'Publier',
            body: 'Documents → Créer → rédiger → Publier.',
            badge: 'MJ',
            link: '/campaigns',
            linkLabel: 'Campagnes',
          },
          {
            title: 'Lire',
            body: 'Onglet Documents de la campagne, ou notification push.',
            badge: 'Joueur',
          },
        ],
        links: [{ label: 'Campagnes', path: '/campaigns' }],
        flow: ['Créer', 'Publier', 'Push', 'Lecture'],
        checklist: [],
      };
    case 'social':
      return {
        paragraphs: ['Amis, chat, invitations de campagne et suggestions de compagnons de table.'],
        steps: [
          {
            title: 'Ajouter un ami',
            body: 'Recherche par pseudo / e-mail, puis demande.',
            link: '/friends',
            linkLabel: 'Amis',
          },
        ],
        links: [
          { label: 'Amis & messages', path: '/friends' },
          { label: 'Profil', path: '/profile' },
        ],
        flow: ['Recherche', 'Demande', 'Chat', 'Invite campagne'],
        checklist: [],
      };
    case 'notifications':
      return {
        paragraphs: [
          'Activez les push PWA dans Paramètres. Événements couverts :',
          ...GUIDE_NOTIFICATION_EVENTS.map((e) => `· ${e}`),
        ],
        steps: [
          {
            title: 'Activer',
            body: 'Paramètres → Notifications → autoriser le navigateur.',
            link: '/settings?tab=notifications',
            linkLabel: 'Paramètres',
          },
        ],
        links: [
          { label: 'Centre de notifications', path: '/notifications' },
          { label: 'Paramètres', path: '/settings' },
        ],
        flow: GUIDE_NOTIFICATION_EVENTS,
        checklist: [],
      };
    case 'codex':
      return {
        paragraphs: [
          'Le grimoire d’Eana : espèces, classes, sorts, bestiaire, équipements, compétences, dons, historiques, combat, divinités.',
        ],
        steps: [],
        links: [
          { label: 'Espèces', path: '/species' },
          { label: 'Classes', path: '/classes' },
          { label: 'Sorts', path: '/spells' },
          { label: 'Bestiaire', path: '/creatures' },
          { label: 'Équipements', path: '/equipments' },
          { label: 'Compétences', path: '/skills' },
          { label: 'Dons', path: '/feats' },
          { label: 'Historiques', path: '/backgrounds' },
          { label: 'Combat', path: '/combat-actions' },
          { label: 'Divinités', path: '/deities' },
        ],
        flow: [],
        checklist: [],
      };
    case 'pdf':
      return {
        paragraphs: [
          'En fin de wizard : aperçu, sauvegarde cloud, téléchargement fiche et grimoire PDF.',
        ],
        steps: [
          {
            title: 'Exporter',
            body: 'Terminez toutes les étapes → vérifier l’aperçu → télécharger.',
            link: '/create',
            linkLabel: 'Wizard',
          },
        ],
        links: [
          { label: 'Créer un héros', path: '/create' },
          { label: 'Mes héros', path: '/characters' },
        ],
        flow: ['Aperçu', 'Sauvegarder', 'PDF'],
        checklist: [],
      };
    case 'faq':
      return {
        paragraphs: ['Questions fréquentes — ouvrez aussi le support si besoin.'],
        steps: GUIDE_FAQ_ITEMS.slice(0, 10).map((f) => ({
          title: f.question,
          body: f.answer,
          badge: f.audience === 'dm' ? 'MJ' : f.audience === 'player' ? 'Joueur' : 'Tous',
        })),
        links: [
          { label: 'Support', path: '/support' },
          { label: 'Glossaire', path: '/guide/glossaire' },
        ],
        flow: [],
        checklist: [],
      };
    case 'glossaire':
      return {
        paragraphs: GUIDE_GLOSSARY.slice(0, 14).map((g) => `${g.term} — ${g.definition}`),
        steps: [],
        links: [
          { label: 'FAQ', path: '/guide/faq' },
          { label: 'Index', path: '/guide/index' },
        ],
        flow: [],
        checklist: [],
      };
    case 'index':
      return {
        paragraphs: ['Index des fonctionnalités : chaque entrée mène à la fiche concernée.'],
        steps: GUIDE_FEATURE_INDEX.slice(0, 16).map((i) => ({
          title: i.label,
          body: i.description,
          badge: i.audience === 'dm' ? 'MJ' : i.audience === 'player' ? 'Joueur' : 'Tous',
          link: `/guide/${i.sectionId}`,
          linkLabel: 'Ouvrir',
        })),
        links: GUIDE_QUICK_CARDS.map((c) => ({ label: c.title, path: c.link, hint: c.description })),
        flow: [],
        checklist: [],
      };
    case 'support':
      return {
        paragraphs: [
          'Bug, question ou suggestion : ouvrez un ticket. Joignez éventuellement un personnage.',
        ],
        steps: [
          {
            title: 'Contacter le support',
            body: 'Décrivez le contexte (page, campagne, navigateur).',
            link: '/support',
            linkLabel: 'Ouvrir le support',
          },
        ],
        links: [
          { label: 'Support', path: '/support' },
          { label: 'Confidentialité', path: '/legal/privacy' },
          { label: 'CGU', path: '/legal/terms' },
        ],
        flow: [],
        checklist: [],
      };
    case 'compte':
      return {
        paragraphs: [
          'Compte, profil (bio, avatar emoji, accent), paramètres et préférences guide.',
        ],
        steps: [
          {
            title: 'Profil public',
            body: 'Personnalisez votre présence à la table.',
            link: '/profile',
            linkLabel: 'Profil',
          },
          {
            title: 'Paramètres',
            body: 'Sécurité, notifications, préférences.',
            link: '/settings',
            linkLabel: 'Paramètres',
          },
        ],
        links: [
          { label: 'Profil', path: '/profile' },
          { label: 'Paramètres', path: '/settings' },
          { label: 'Inscription', path: '/register' },
        ],
        flow: [],
        checklist: [],
      };
    case 'schemas':
      return {
        paragraphs: [
          'Schémas de flux utiles pour visualiser qui fait quoi (MJ vs joueur).',
        ],
        steps: [
          {
            title: 'Proposition de perso',
            body: GUIDE_PROPOSAL_FLOW.map((s) => `${s.role} → ${s.label}`).join(' · '),
          },
          {
            title: 'Combat',
            body: GUIDE_COMBAT_FLOW.map((s) => `${s.role} → ${s.label}`).join(' · '),
          },
        ],
        links: [
          { label: 'Campagnes', path: '/guide/scenario' },
          { label: 'Combat', path: '/guide/initiative' },
        ],
        flow: GUIDE_PROPOSAL_FLOW.map((s) => s.label),
        checklist: [],
      };
    case 'captures':
      return {
        paragraphs: [
          'Aperçus UI : explorez l’app directement — création, campagnes, table, codex.',
        ],
        steps: [],
        links: [
          { label: 'Création', path: '/create' },
          { label: 'Campagnes', path: '/campaigns' },
          { label: 'Codex', path: '/species' },
          { label: 'Accueil', path: '/' },
        ],
        flow: [],
        checklist: [],
      };
    default: {
      const idx = GUIDE_FEATURE_INDEX.filter((i) => i.sectionId === id);
      return {
        paragraphs: idx.length
          ? idx.map((i) => `${i.label} — ${i.description}`)
          : [
              'Cette fiche explique le sujet. Utilisez les liens pour ouvrir l’outil correspondant dans l’app.',
              'Les commentaires ci-dessous sont des widgets : redimensionnez-les (1/3, 1/2, 1/1) et réordonnez-les.',
            ],
        steps: [],
        links: GUIDE_QUICK_CARDS.map((c) => ({ label: c.title, path: c.link })),
        flow: [],
        checklist: [],
      };
    }
  }
}

export const GUIDE_TOPICS: GuideTopic[] = GUIDE_ALL_NAV.map((nav) => {
  const group = groupOf(nav.id);
  const tags = [
    nav.audience === 'dm' ? 'mj' : nav.audience === 'player' ? 'joueur' : 'tous',
    group?.label.toLowerCase() ?? 'guide',
  ];
  const content = contentFor(nav.id);
  return {
    id: nav.id,
    title: nav.label,
    summary: summaryFor(nav.id, `Fiche guide · ${nav.label}`),
    icon: nav.icon,
    accent: nav.accent,
    audience: nav.audience,
    groupId: group?.id ?? 'reference',
    groupLabel: group?.label ?? 'Référence',
    tags,
    paragraphs: content.paragraphs,
    steps: content.steps,
    links: content.links,
    flow: content.flow,
    flashes: flashesFor(nav.id, nav.audience),
    checklist: content.checklist,
  };
});

export function getGuideTopic(id: string): GuideTopic | undefined {
  return GUIDE_TOPICS.find((t) => t.id === id);
}

export function guideTopicsByGroup(
  audience: GuideAudience | 'all',
  query: string,
  groupFilter: string | 'all',
): { groupId: string; groupLabel: string; topics: GuideTopic[] }[] {
  const q = query.trim().toLowerCase();
  const filtered = GUIDE_TOPICS.filter((t) => {
    if (audience !== 'all' && t.audience !== 'all' && t.audience !== audience) return false;
    if (groupFilter !== 'all' && t.groupId !== groupFilter) return false;
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      t.summary.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.includes(q)) ||
      t.paragraphs.some((p) => p.toLowerCase().includes(q))
    );
  });

  const order = GUIDE_NAV_GROUPS.map((g) => g.id);
  const map = new Map<string, GuideTopic[]>();
  for (const t of filtered) {
    const list = map.get(t.groupId) ?? [];
    list.push(t);
    map.set(t.groupId, list);
  }

  return order
    .filter((id) => map.has(id))
    .map((id) => {
      const g = GUIDE_NAV_GROUPS.find((x) => x.id === id)!;
      return { groupId: id, groupLabel: g.label, topics: map.get(id)! };
    });
}
