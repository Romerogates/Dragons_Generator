/** Livrets de règles — 4 PDF distincts : MJ/Joueur × Table/En ligne. */

export type GuideRulebookId =
  | 'mj-table'
  | 'mj-en-ligne'
  | 'joueur-table'
  | 'joueur-en-ligne'
  | 'oneshot';

export interface GuideRulebookSection {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  numbered?: string[];
  /** Schéma monospacé (écran + PDF). */
  diagram?: string[];
}

export interface GuideRulebookChapter {
  id: string;
  title: string;
  sections: GuideRulebookSection[];
}

export interface GuideRulebook {
  id: GuideRulebookId;
  role: 'mj' | 'joueur' | 'all';
  mode: 'table' | 'en-ligne' | 'oneshot';
  title: string;
  subtitle: string;
  pdfFilename: string;
  related: { label: string; path: string }[];
  chapters: GuideRulebookChapter[];
}

const STATS_CHAPTER: GuideRulebookChapter = {
  id: 'stats',
  title: 'Caractéristiques et calcul des jets',
  sections: [
    {
      id: 'six-stats',
      title: 'Les six scores',
      paragraphs: [
        'Chaque héros a six caractéristiques. Le score (ex. 16) n’est pas ce qu’on ajoute au dé : on utilise le modificateur (ex. +3), déjà écrit sur la fiche à côté du score.',
      ],
      bullets: [
        'Force (FOR) — corps à corps, soulever, briser.',
        'Dextérité (DEX) — distance, esquive, discrétion, souvent l’initiative.',
        'Constitution (CON) — points de vie, endurance.',
        'Intelligence (INT) — savoirs, enquêtes, certains sorts.',
        'Sagesse (SAG) — perception, intuition, volonté.',
        'Charisme (CHA) — persuasion, intimidation, présence.',
      ],
    },
    {
      id: 'modificateur',
      title: 'Score → modificateur',
      paragraphs: [
        'Le modificateur vient du score (environ (score − 10) ÷ 2, arrondi vers le bas). Exemples : 8 → −1, 10 → +0, 12 → +1, 14 → +2, 16 → +3, 18 → +4. Sur la fiche, ce chiffre est déjà calculé : ne recalculez pas à chaque jet.',
      ],
    },
    {
      id: 'maitrise',
      title: 'Qu’est-ce que la maîtrise ?',
      paragraphs: [
        'Le bonus de maîtrise est un bonus de niveau (souvent +2 aux premiers niveaux, puis +3, +4…). Il veut dire : « votre héros est entraîné à ça ».',
        'Vous l’ajoutez seulement si la fiche indique que la compétence, l’arme ou l’outil est maîtrisé (case cochée, point, liste « maîtrises »). Sans maîtrise, vous lancez quand même : 1d20 + modificateur seulement.',
      ],
      bullets: [
        'Compétence maîtrisée (ex. Discrétion) → + bonus de maîtrise.',
        'Attaque avec une arme maîtrisée → le bonus d’attaque inclut déjà souvent le bonus de maîtrise.',
        'Jet de sauvegarde maîtrisé → + bonus de maîtrise sur ce jet.',
        'Ce n’est pas un dé séparé : c’est un nombre fixe à ajouter au total.',
      ],
    },
    {
      id: 'formule',
      title: 'La formule à retenir',
      paragraphs: [
        'Total = résultat du d20 + modificateur de caractéristique + bonus de maîtrise (si maîtrisé).',
        'Exemple : vous lancez un 15 au d20, DEX +3, Discrétion maîtrisée avec bonus de maîtrise +2 → total 15 + 3 + 2 = 20. Le MJ compare ce 20 au DD (seuil de difficulté). Si 20 ≥ DD, c’est réussi.',
      ],
      numbered: [
        'Lancez 1d20 (le dé à 20 faces).',
        'Ajoutez le modificateur de la caractéristique demandée (FOR, DEX…).',
        'Si c’est maîtrisé, ajoutez le bonus de maîtrise indiqué sur la fiche.',
        'Annoncez le total au MJ (pas seulement le 15 du dé).',
      ],
    },
    {
      id: 'dd',
      title: 'DD (difficulté)',
      paragraphs: [
        'Le MJ fixe un DD (seuil). Facile ≈ 10, moyen ≈ 15, dur ≈ 20, héroïque ≈ 25. Le joueur calcule son total ; le MJ compare et décrit.',
      ],
      bullets: [
        'DD 10 — escalader un mur bas de donjon, sauter un fossé étroit, se rappeler une rumeur de village.',
        'DD 12–13 — convaincre un garde de laisser passer « juste un regard », crocheter une serrure ordinaire.',
        'DD 15 — pister une bête dans la neige d’Eana, mentir à un seigneur méfiant, forcer une porte barrée.',
        'DD 18–20 — désamorcer un piège de temple ancien, persuader un esprit lié, grimper une falaise sous la pluie.',
        'Pas de jet si c’est trivial (ouvrir une porte non verrouillée) ou impossible (soulever un château).',
      ],
    },
  ],
};

/** Où lire les chiffres — libellés alignés sur la fiche PDF officielle. */
const FICHE_ANNOTATED: GuideRulebookChapter = {
  id: 'fiche',
  title: 'Votre fiche annotée',
  sections: [
    {
      id: 'zones',
      title: 'Où regarder (débutant absolu)',
      paragraphs: [
        'La fiche PDF regroupe les mêmes infos. Avant de lancer un dé, pointez la bonne case — ne recalculez pas de tête si le chiffre est déjà écrit.',
      ],
      numbered: [
        'Score (ex. 16) → gros chiffre de caractéristique. On ne l’ajoute pas au dé.',
        'Modificateur de caractéristique (ex. +3) → petit chiffre à côté du score. C’est celui qu’on ajoute au d20.',
        'Bonus de maîtrise (souvent +2 aux premiers niveaux) → case en haut de fiche. À ajouter seulement si la ligne est maîtrisée.',
        'Ligne de compétence (ex. Discrétion) → pastille maîtrise ? + le mod de carac liée. Total = d20 + mod (+ bonus de maîtrise).',
        'Colonne Bonus d’attaque (tableau d’armes) → déjà calculé = mod FOR/DEX + bonus de maîtrise si l’arme est maîtrisée. Jet pour toucher = 1d20 + ce bonus.',
        'CA → seuil que l’ennemi doit battre ou égaler pour vous toucher (classe d’armure). Ce n’est pas un jet que vous lancez.',
        'Pv (actuels) et Pv max → votre jauge. Pv Temporaires = bonus en plus des Pv. À 0 Pv, vous tombez.',
        'Dés de vie → ex. 2d8 ; sert aux repos et à la montée de niveau.',
        'Seuil de blessure → un coup ≥ ce chiffre peut infliger une blessure (selon la table).',
        'Initiative → 1d20 + modificateur de DEX (pas le Bonus d’attaque).',
        'Perception passive → score fixe (souvent 10 + mod SAG + bonus de maîtrise si Perception maîtrisée). Pas un jet sauf si le MJ le demande.',
        'VD (Vitesse) → distance en mètres par round. Peuple = ligne « Peuple » en haut de fiche (espèce).',
      ],
    },
    {
      id: 'exemples-fiche',
      title: 'Trois lectures concrètes',
      bullets: [
        'Jet de Discrétion maîtrisée : pastille Discrétion → 1d20 + mod DEX + Bonus de maîtrise.',
        'Attaque : lisez la colonne Bonus d’attaque (ex. +5) → 1d20 + 5 pour toucher ; si ça touche, colonne Dégâts/type (+ FOR) sans rajouter le Bonus de maîtrise.',
        'Initiative : uniquement 1d20 + mod DEX — ignorez Bonus d’attaque et maîtrises d’armes.',
      ],
    },
  ],
};

/** Glossaire — mêmes libellés que la fiche PDF. */
const GLOSSAIRE: GuideRulebookChapter = {
  id: 'glossaire',
  title: 'Glossaire express',
  sections: [
    {
      id: 'termes',
      title: 'Mots qu’on entend à la table',
      bullets: [
        'CA — Classe d’armure : seuil pour vous toucher (plus haut = plus dur).',
        'Pv — Points de vie (fiche : Pv / Pv max). Baissent avec les dégâts ; remontent avec soins / repos.',
        'Pv Temporaires — Bonus temporaire en plus des Pv.',
        'DD — Difficulté : seuil fixé par le MJ pour un jet ou une sauvegarde.',
        'DD de sauvegarde des sorts — Seuil que la cible doit égaler ou battre contre vos sorts.',
        'Modificateur de caractéristique — Petit bonus/malus tiré du score (ex. 16 → +3). On l’ajoute au d20.',
        'Bonus de maîtrise — Bonus de niveau si entraîné (compétence, arme, JS…). Pas un 2ᵉ dé.',
        'Bonus d’attaque — Colonne fiche pour toucher (arme ou sort d’attaque).',
        'Modificateur d’attaque des sorts — 1d20 + ce chiffre pour un sort d’attaque.',
        'Initiative — Jet qui range l’ordre des tours. Ce n’est pas le jet pour toucher.',
        'JS (jet de sauvegarde) — d20 + mod (+ Bonus de maîtrise si pastille JS cochée) pour résister.',
        'Perception passive — Score fixe ; le MJ l’utilise sans vous demander un jet.',
        'VD — Vitesse (case Vitesse (VD) sur la fiche).',
        'Concentration — Un seul sort concentré à la fois ; un coup peut la casser.',
        'Emplacements de sort — Pastilles dépensées pour lancer un sort (hors tours de magie).',
        'Avantage / désavantage — 2d20, on garde le meilleur / le pire.',
        'Repos court / long — Pause pour récupérer ressources (Regain en repos court / long sur la fiche).',
        'Seuil de blessure — Dégâts d’un coup ≥ ce chiffre = blessure possible.',
      ],
    },
  ],
};

/** Schéma d’ordre d’initiative — traits noirs, lisible écran + PDF. */
const SCHEMA_INITIATIVE: GuideRulebookSection = {
  id: 'schema-initiative',
  title: 'Schéma — ordre du combat',
  paragraphs: [
    'Un seul flux. Ne mélangez pas les cases.',
  ],
  diagram: [
    '┌──────────────┐     ┌──────────────┐     ┌────────────────┐',
    '│ 1. Initiative│ ──► │ 2. Tour (qui)│ ──► │ 3. Action      │',
    '│ 1d20 + DEX   │     │ ordre décrois.│     │ attaque / sort │',
    '│ = ordre seul │     └──────────────┘     └────────┬───────┘',
    '└──────────────┘                                   │',
    '                                                   ▼',
    '                                    ┌──────────────────────────┐',
    '                                    │ 4. Toucher ?             │',
    '                                    │ 1d20 + Bonus d’attaque   │',
    '                                    │ ≥ CA → touché            │',
    '                                    └────────────┬─────────────┘',
    '                                                 │ oui',
    '                                                 ▼',
    '                                    ┌──────────────────────────┐',
    '                                    │ 5. Dégâts / type         │',
    '                                    │ dés + mod (pas maîtrise) │',
    '                                    └──────────────────────────┘',
  ],
};

/** Rappel anti-confusion combat — débutant absolu. */
const INIT_VS_TOUCH_MJ: GuideRulebookSection = {
  id: 'init-vs-toucher',
  title: 'Deux jets différents (ne pas mélanger)',
  paragraphs: [
    'Les débutants confondent souvent initiative et jet pour toucher. Ce sont deux dés, deux moments, deux sens.',
  ],
  bullets: [
    'Initiative (début du combat) → 1d20 + DEX → range qui joue en 1er, 2ᵉ… Aucun dégât.',
    'Jet pour toucher (à votre tour) → 1d20 + bonus d’attaque → compare à la CA. Si ça passe, alors jet de dégâts.',
    'Dégâts → dés de l’arme (ou du sort) + mod de caractéristique. On ne rajoute pas le bonus de maîtrise sur les dégâts.',
    'Exemple : initiative 14 (ordre) ; plus tard « j’attaque » → 18 pour toucher la CA 15 → touché → 1d8+3 dégâts.',
  ],
};

const INIT_VS_TOUCH_JOUEUR: GuideRulebookSection = {
  id: 'init-vs-toucher',
  title: 'Deux jets différents (ne pas mélanger)',
  paragraphs: [
    'Initiative ≠ toucher. Si on vous demande « ton initiative », annoncez seulement d20 + DEX. Si on vous demande « tu touches ? », utilisez le bonus d’attaque.',
  ],
  bullets: [
    'Initiative → ordre des tours seulement.',
    'Toucher → battre ou égaler la CA avec 1d20 + bonus d’attaque.',
    'Dégâts → seulement après un toucher réussi (sans rajouter la maîtrise).',
  ],
};

const SKILLS_MJ: GuideRulebookChapter = {
  id: 'competences',
  title: 'Compétences',
  sections: [
    {
      id: 'arbitrer',
      title: 'Arbitrer (ex. ouvrir une porte)',
      numbered: [
        'Le joueur annonce l’intention (« j’ouvre sans bruit », « je force »).',
        'Vous choisissez compétence / caractéristique et un DD.',
        'Le joueur calcule : 1d20 + mod + maîtrise (si la fiche le montre).',
        'Il annonce le total ; vous comparez au DD et décrivez le résultat.',
      ],
      bullets: [
        'Pas de jet si c’est trivial ou impossible.',
        'Rappel : « maîtrise » = bonus de niveau, seulement si entraîné.',
        'Exemple annoncé par le joueur : « 15 + 3 + 2 = 20 ».',
      ],
    },
  ],
};

const SKILLS_JOUEUR: GuideRulebookChapter = {
  id: 'competences',
  title: 'Compétences',
  sections: [
    {
      id: 'quand',
      title: 'Comment compter (ex. ouvrir une porte)',
      paragraphs: [
        'Vous dites l’intention. Le MJ demande souvent une compétence (Discrétion, Athlétisme…) ou une caractéristique pure (FOR).',
      ],
      numbered: [
        'Annoncez clairement ce que vous tentez.',
        'Sur la fiche : la compétence est-elle maîtrisée ?',
        'Lancez 1d20.',
        'Ajoutez le modificateur (ex. +3).',
        'Si maîtrisée, ajoutez aussi le bonus de maîtrise (ex. +2).',
        'Dites le total : « 15 + 3 + 2 = 20 » — pas seulement le 15.',
      ],
      bullets: [
        'Sans maîtrise : 1d20 + mod seulement (ex. 15 + 3 = 18).',
        'La maîtrise n’est pas un 2e dé : c’est un bonus fixe de votre niveau.',
      ],
    },
  ],
};

const COMBAT_MJ: GuideRulebookChapter = {
  id: 'combat',
  title: 'Combat à la table',
  sections: [
    INIT_VS_TOUCH_MJ,
    SCHEMA_INITIATIVE,
    {
      id: 'avant',
      title: 'Avant — initiative (ordre seulement)',
      paragraphs: [
        'Chacun lance 1d20 + modificateur de DEX (pas de maîtrise ici en général). Ce total sert seulement à ranger l’ordre des tours — ce n’est pas le jet pour toucher.',
      ],
      numbered: [
        'Annoncez le combat et demandez une intention courte.',
        'Chacun lance l’initiative et annonce le total (ex. 12 + 2 = 14).',
        'Notez l’ordre du plus haut au plus bas.',
      ],
    },
    {
      id: 'attaque',
      title: 'Pendant — attaque d’arme',
      paragraphs: [
        'Le bonus d’attaque sur la fiche vaut en général : modificateur (FOR ou DEX) + bonus de maîtrise (si l’arme est maîtrisée). Le joueur lance 1d20 + ce bonus.',
      ],
      numbered: [
        'Le joueur choisit cible et arme.',
        'Jet pour toucher : 1d20 + bonus d’attaque (ex. 15 + 5 = 20).',
        'Si total ≥ CA de la cible → touché.',
        'Alors jet de dégâts (dés de l’arme + mod de caractéristique) — pas le bonus de maîtrise sur les dégâts.',
        'Décrivez, puis passez au suivant dans l’ordre.',
      ],
    },
    {
      id: 'sort',
      title: 'Pendant — sort',
      paragraphs: [
        'Le lanceur choisit un sort connu/préparé et dépense un emplacement si besoin. Les classes sans sorts (barbare, guerrier…) ignorent cette partie.',
      ],
      bullets: [
        'Attaque magique : 1d20 + Modificateur d’attaque des sorts, puis dégâts si touché.',
        'Sauvegarde : la cible lance un JS contre votre DD de sauvegarde des sorts.',
        'Soin / buff : appliquez l’effet, pas toujours de jet.',
      ],
    },
    {
      id: 'apres',
      title: 'Après',
      bullets: ['Soins et Pv', 'Butin', 'Conséquences', 'Retour hors combat'],
    },
  ],
};

const COMBAT_JOUEUR: GuideRulebookChapter = {
  id: 'combat',
  title: 'Combat à la table',
  sections: [
    INIT_VS_TOUCH_JOUEUR,
    SCHEMA_INITIATIVE,
    {
      id: 'avant',
      title: 'Avant — initiative',
      paragraphs: [
        'Lancez 1d20 + modificateur de DEX. Annoncez le total (ex. 12 + 2 = 14). Ce jet fixe seulement quand vous jouez — pas si vous touchez.',
      ],
    },
    {
      id: 'attaque',
      title: 'À votre tour — attaquer',
      paragraphs: [
        'Le « bonus d’attaque » de la fiche = en général mod (FOR/DEX) + maîtrise si l’arme est maîtrisée. Vous n’avez pas à le recomposer : utilisez le chiffre écrit, ou calculez d20 + mod + maîtrise.',
      ],
      numbered: [
        'Choisissez action (attaquer, bouger, objet, sort…).',
        'Pour toucher : 1d20 + bonus d’attaque → annoncez le total.',
        'Si total ≥ CA ennemi → touché.',
        'Puis dés de dégâts de l’arme (+ modificateur) — sans rajouter la maîtrise.',
        'Annoncez les totaux au MJ.',
      ],
    },
    {
      id: 'sort',
      title: 'À votre tour — sort (si vous en avez)',
      paragraphs: [
        'Barbare, guerrier, moine « purs » : en général pas de sorts — sautez cette section. Sinon :',
      ],
      bullets: [
        'Vérifiez portée, cible, Emplacements de sort.',
        'Attaque magique : 1d20 + Modificateur d’attaque des sorts.',
        'Notez les emplacements dépensés.',
      ],
    },
    {
      id: 'apres',
      title: 'Après',
      bullets: ['Pv restants', 'Munitions / emplacements', 'Reprise du rôleplay'],
    },
  ],
};

export const GUIDE_RULEBOOK_MJ_TABLE: GuideRulebook = {
  id: 'mj-table',
  role: 'mj',
  mode: 'table',
  title: 'MJ — À la table',
  subtitle: 'Guide débutant présentiel : score, modificateur, maîtrise, combat et sorts.',
  pdfFilename: 'dragons-mj-a-la-table.pdf',
  related: [
    { label: 'MJ en ligne', path: '/guide/mj-en-ligne' },
    { label: 'Joueur à la table', path: '/guide/joueur-table' },
    { label: 'One-shot 1 feuille', path: '/guide/oneshot' },
  ],
  chapters: [
    {
      id: 'objectif',
      title: '1. Objectif',
      sections: [
        {
          id: 'but',
          title: 'But du jeu',
          paragraphs: [
            'Vous animez le monde ; les joueurs incarnent un héros. On ne gagne pas vraiment : on réussit des scènes et on raconte une aventure.',
          ],
          bullets: [
            'One-shot = une soirée. Campagne = plusieurs sessions.',
          ],
        },
        {
          id: 'arbitrage',
          title: 'Quand dire oui, demander un jet, ou non',
          paragraphs: [
            'Quand un joueur annonce une action, ne lancez pas les dés par réflexe. Choisissez vite parmi ces trois réponses :',
          ],
          bullets: [
            'Oui, sans jet — l’action est cool, crédible, et un échec n’apporterait rien d’intéressant. Ex. : discuter avec un PNJ déjà amical, fouiller une pièce sans danger.',
            'Jet — il y a un vrai risque, et réussite comme échec changent la scène. Ex. : grimper un mur glissant, bluffer un garde, désamorcer un piège.',
            'Non (expliquez et proposez autre chose) — l’action casse l’équilibre, le ton ou le plaisir de la table. Ex. : « je tue le roi d’un claquement de doigts » dès le début d’un one-shot.',
          ],
        },
      ],
    },
    STATS_CHAPTER,
    SKILLS_MJ,
    {
      id: 'session',
      title: 'Session',
      sections: [
        {
          id: 'flow',
          title: 'Avant / pendant / après',
          numbered: [
            'Avant : scénario court, fiches, dés.',
            'Pendant : résumé → exploration → combat éventuel → butin.',
            'Après : notes, XP, cliffhanger.',
          ],
        },
      ],
    },
    COMBAT_MJ,
    FICHE_ANNOTATED,
    GLOSSAIRE,
    {
      id: 'materiel',
      title: 'Matériel',
      sections: [
        {
          id: 'liste',
          title: 'Sur la table',
          bullets: ['Dés', 'Fiches papier', 'Notes MJ', 'Ce livret imprimé'],
        },
      ],
    },
  ],
};

export const GUIDE_RULEBOOK_MJ_ONLINE: GuideRulebook = {
  id: 'mj-en-ligne',
  role: 'mj',
  mode: 'en-ligne',
  title: 'MJ — En ligne',
  subtitle: 'Animer avec le site + vocal. Les jets (initiative, toucher, dégâts) restent les mêmes.',
  pdfFilename: 'dragons-mj-en-ligne.pdf',
  related: [
    { label: 'MJ à la table (règles dés)', path: '/guide/mj-table' },
    { label: 'Joueur en ligne', path: '/guide/joueur-en-ligne' },
  ],
  chapters: [
    {
      id: 'setup',
      title: '1. Campagne sur le site',
      sections: [
        {
          id: 'etapes',
          title: 'Étapes',
          numbered: [
            'Compte → créer une campagne.',
            'Inviter les joueurs.',
            'Valider les personnages proposés.',
            'Publier documents (brief, carte).',
            'Démarrer une session → Table MJ.',
          ],
        },
      ],
    },
    {
      id: 'session',
      title: '2. Session & combat',
      sections: [
        {
          id: 'vocal',
          title: 'Vocal',
          bullets: ['Un canal pour tous', 'Relancer les absents', 'Signaler AFK'],
        },
        {
          id: 'combat',
          title: 'Combat',
          numbered: [
            'Collecter les initiatives dans l’outil (ordre des tours).',
            'Tracker : chaque tour, action → jet pour toucher → dégâts si succès.',
            'Vous jouez les PNJ à leur tour.',
            'Terminer le combat / archiver le résumé.',
          ],
        },
      ],
    },
    {
      id: 'rappel',
      title: '3. Rappel — comment on compte',
      sections: [
        {
          id: 'jets',
          title: 'Toujours vrai (même en ligne)',
          paragraphs: [
            'Total = d20 + modificateur (+ bonus de maîtrise si entraîné). Exemple : 15 + 3 + 2 = 20. La maîtrise = bonus de niveau, pas un 2e dé. Initiative = ordre ; attaque = toucher ; dégâts = après une réussite (sans rajouter la maîtrise).',
            'Détail stats, exemples de DD Eana, fiche annotée et glossaire : livret MJ à la table (à imprimer).',
          ],
        },
      ],
    },
  ],
};

export const GUIDE_RULEBOOK_JOUEUR_TABLE: GuideRulebook = {
  id: 'joueur-table',
  role: 'joueur',
  mode: 'table',
  title: 'Joueur — À la table',
  subtitle: 'Ce que vous dites et lancez en présentiel : d20 + mod + maîtrise, combat, sorts.',
  pdfFilename: 'dragons-joueur-a-la-table.pdf',
  related: [
    { label: 'Joueur en ligne', path: '/guide/joueur-en-ligne' },
    { label: 'MJ à la table', path: '/guide/mj-table' },
    { label: 'One-shot 1 feuille', path: '/guide/oneshot' },
  ],
  chapters: [
    {
      id: 'objectif',
      title: '1. Votre rôle',
      sections: [
        {
          id: 'but',
          title: 'But',
          paragraphs: [
            'Vous incarnez un héros. Vous décrivez ce qu’il tente ; le MJ dit ce qui se passe. On ne gagne pas vraiment — on réussit des scènes.',
          ],
          bullets: [
            'One-shot ou campagne selon la table.',
            'Vous ne contrôlez pas les PNJ, le décor, ni le résultat des dés.',
          ],
        },
      ],
    },
    STATS_CHAPTER,
    SKILLS_JOUEUR,
    {
      id: 'session',
      title: 'Session',
      sections: [
        {
          id: 'flow',
          title: 'Avant / pendant / après',
          bullets: [
            'Avant : fiche + dés.',
            'Pendant : actions claires, écoute, place aux autres.',
            'Après : noter PV, butin, emplacements.',
          ],
        },
      ],
    },
    COMBAT_JOUEUR,
    FICHE_ANNOTATED,
    GLOSSAIRE,
  ],
};

export const GUIDE_RULEBOOK_JOUEUR_ONLINE: GuideRulebook = {
  id: 'joueur-en-ligne',
  role: 'joueur',
  mode: 'en-ligne',
  title: 'Joueur — En ligne',
  subtitle: 'Rejoindre une campagne sur le site et jouer en vocal.',
  pdfFilename: 'dragons-joueur-en-ligne.pdf',
  related: [
    { label: 'Joueur à la table (règles dés)', path: '/guide/joueur-table' },
    { label: 'MJ en ligne', path: '/guide/mj-en-ligne' },
  ],
  chapters: [
    {
      id: 'setup',
      title: '1. Premiers pas',
      sections: [
        {
          id: 'etapes',
          title: 'Sur le site',
          numbered: [
            'Créer un compte et forger un héros.',
            'Accepter l’invitation à la campagne.',
            'Proposer la fiche ; attendre la validation MJ.',
            'Lire les documents publiés.',
            'Rejoindre la session quand elle démarre.',
          ],
        },
      ],
    },
    {
      id: 'jouer',
      title: '2. Pendant la session',
      sections: [
        {
          id: 'tips',
          title: 'Réflexes',
          bullets: [
            'Vocal ouvert ; signaler AFK.',
            'Répondre vite à l’initiative (d20 + DEX) — ce n’est pas le jet pour toucher.',
            'À votre tour : action → d20 + bonus d’attaque (mod + maîtrise) → dégâts si touché.',
            'Compétences : annoncer « 15 + 3 + 2 = 20 » (d20 + mod + maîtrise si entraîné).',
            'Détail complet + fiche annotée + glossaire : livret Joueur à la table.',
          ],
        },
      ],
    },
  ],
};


export const GUIDE_RULEBOOK_ONESHOT: GuideRulebook = {
  id: 'oneshot',
  role: 'all',
  mode: 'oneshot',
  title: 'One-shot — 1 feuille',
  subtitle: 'Version ultra courte à lire à l’écran avant une soirée.',
  pdfFilename: 'dragons-oneshot-1-feuille.pdf',
  related: [
    { label: 'MJ à la table', path: '/guide/mj-table' },
    { label: 'Joueur à la table', path: '/guide/joueur-table' },
  ],
  chapters: [
    {
      id: 'essentiel',
      title: 'Essentiel',
      sections: [
        {
          id: 'jet',
          title: 'Un jet = total annoncé',
          paragraphs: [
            'Total = 1d20 + modificateur de caractéristique + Bonus de maîtrise (seulement si maîtrisé). Exemple : 15 + 3 + 2 = 20.',
          ],
          bullets: [
            'Compétence : d20 + mod (+ Bonus de maîtrise si pastille).',
            'Initiative : d20 + DEX seulement (ordre des tours).',
            'Toucher : d20 + Bonus d’attaque ≥ CA.',
            'Dégâts : après un toucher — dés + mod, sans Bonus de maîtrise.',
          ],
        },
        SCHEMA_INITIATIVE,
        {
          id: 'soirée',
          title: 'Soirée one-shot',
          numbered: [
            'MJ : une scène claire, 1–2 rencontres, un climax.',
            'Joueurs : fiche prête — savoir où sont CA, Pv, Bonus d’attaque, Bonus de maîtrise.',
            'Pendant : annoncer les totaux (« 15 + 5 = 20 »), pas seulement le dé.',
            'Après : 5 min de récap, XP si vous en donnez.',
          ],
        },
      ],
    },
  ],
};

export const GUIDE_RULEBOOKS: GuideRulebook[] = [
  GUIDE_RULEBOOK_MJ_TABLE,
  GUIDE_RULEBOOK_MJ_ONLINE,
  GUIDE_RULEBOOK_JOUEUR_TABLE,
  GUIDE_RULEBOOK_JOUEUR_ONLINE,
  GUIDE_RULEBOOK_ONESHOT,
];

export function getGuideRulebook(id: string | null | undefined): GuideRulebook | null {
  return GUIDE_RULEBOOKS.find((b) => b.id === id) ?? null;
}
