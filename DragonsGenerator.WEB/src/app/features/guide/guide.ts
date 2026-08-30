import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { fromEvent } from 'rxjs';

export type GuideAudience = 'all' | 'dm' | 'player';

export interface GuideNavItem {
  id: string;
  label: string;
  icon: string;
  accent: string;
  audience: GuideAudience;
}

export interface GuideBlogPost {
  date: string;
  tag: string;
  title: string;
  summary: string;
  icon: string;
  border: string;
  tagColor: string;
}

export interface GuideQuickCard {
  title: string;
  description: string;
  icon: string;
  link: string;
  accent: string;
}

export interface GuideStep {
  title: string;
  body: string;
  badge?: 'MJ' | 'Joueur' | 'Tous';
  link?: string;
  linkLabel?: string;
}

export interface GuideFaqItem {
  id: string;
  question: string;
  answer: string;
  audience: GuideAudience;
}

export interface GuideGlossaryItem {
  term: string;
  definition: string;
}

export interface GuideChecklistItem {
  id: string;
  label: string;
}

export interface GuideIndexItem {
  label: string;
  description: string;
  sectionId: string;
  audience: GuideAudience;
}

@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './guide.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class GuidePage implements AfterViewInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private observer: IntersectionObserver | null = null;

  readonly guideUpdatedAt = '30 août 2026';
  readonly guideVersion = '1.1';

  readonly audience = signal<GuideAudience>('all');
  readonly activeSection = signal('parcours');
  readonly openFaqId = signal<string | null>(null);
  readonly characterExpanded = signal(false);
  readonly checklistDone = signal<Record<string, boolean>>({});

  readonly allNav: GuideNavItem[] = [
    { id: 'parcours', label: 'Parcours', icon: 'fluent-emoji:compass', accent: 'text-amber-400', audience: 'all' },
    { id: 'journal', label: 'Journal', icon: 'fluent-emoji:newspaper', accent: 'text-violet-400', audience: 'all' },
    { id: 'demarrage', label: 'Premiers pas', icon: 'fluent-emoji:rocket', accent: 'text-amber-400', audience: 'all' },
    { id: 'checklists', label: 'Checklists', icon: 'fluent-emoji:check-mark-button', accent: 'text-emerald-400', audience: 'all' },
    { id: 'schemas', label: 'Schémas', icon: 'fluent-emoji:world-map', accent: 'text-sky-400', audience: 'all' },
    { id: 'compte', label: 'Compte', icon: 'fluent-emoji:bust-in-silhouette', accent: 'text-sky-400', audience: 'all' },
    { id: 'personnage', label: 'Personnage', icon: 'fluent-emoji:shield', accent: 'text-emerald-400', audience: 'all' },
    { id: 'scenario', label: 'Campagnes', icon: 'fluent-emoji:globe-showing-europe-africa', accent: 'text-violet-400', audience: 'all' },
    { id: 'table', label: 'Table MJ', icon: 'fluent-emoji:performing-arts', accent: 'text-amber-400', audience: 'dm' },
    { id: 'initiative', label: 'Combat', icon: 'fluent-emoji:crossed-swords', accent: 'text-red-400', audience: 'all' },
    { id: 'documents', label: 'Documents', icon: 'fluent-emoji:scroll', accent: 'text-sky-400', audience: 'all' },
    { id: 'social', label: 'Social', icon: 'fluent-emoji:speech-balloon', accent: 'text-pink-400', audience: 'all' },
    { id: 'notifications', label: 'Notifications', icon: 'fluent-emoji:bell', accent: 'text-amber-400', audience: 'all' },
    { id: 'codex', label: 'Codex', icon: 'fluent-emoji:books', accent: 'text-emerald-400', audience: 'all' },
    { id: 'pdf', label: 'PDF', icon: 'fluent-emoji:printer', accent: 'text-slate-300', audience: 'all' },
    { id: 'faq', label: 'FAQ', icon: 'fluent-emoji:red-question-mark', accent: 'text-amber-400', audience: 'all' },
    { id: 'glossaire', label: 'Glossaire', icon: 'fluent-emoji:label', accent: 'text-violet-400', audience: 'all' },
    { id: 'index', label: 'Index', icon: 'fluent-emoji:input-latin-letters', accent: 'text-slate-300', audience: 'all' },
    { id: 'support', label: 'Support', icon: 'fluent-emoji:raising-hands', accent: 'text-violet-400', audience: 'all' },
  ];

  readonly nav = computed(() => {
    const a = this.audience();
    return this.allNav.filter((item) => this.matchesAudience(item.audience, a));
  });

  readonly quickCards: GuideQuickCard[] = [
    {
      title: 'Forger un héros',
      description: 'Assistant pas-à-pas · niveaux 1–20',
      icon: 'fluent-emoji:sparkles',
      link: '/create',
      accent: 'border-amber-500/40 hover:border-amber-400 bg-amber-950/20',
    },
    {
      title: 'Mes campagnes',
      description: 'MJ ou joueur · sessions & combats',
      icon: 'fluent-emoji:world-map',
      link: '/campaigns',
      accent: 'border-violet-500/40 hover:border-violet-400 bg-violet-950/20',
    },
    {
      title: 'Codex',
      description: 'Règles, classes, bestiaire…',
      icon: 'fluent-emoji:books',
      link: '/species',
      accent: 'border-emerald-500/40 hover:border-emerald-400 bg-emerald-950/20',
    },
    {
      title: 'Support',
      description: 'Bug, question, suggestion',
      icon: 'fluent-emoji:raising-hands',
      link: '/support',
      accent: 'border-sky-500/40 hover:border-sky-400 bg-sky-950/20',
    },
  ];

  readonly blogPosts: GuideBlogPost[] = [
    {
      date: '30 août 2026',
      tag: 'Campagnes MJ',
      title: 'Fiches joueurs consultables',
      summary:
        'Voir la fiche proposée ou approuvée avant validation. Synthèse MJ et import combat basés sur les vraies stats.',
      icon: 'fluent-emoji:identification-card',
      border: 'border-violet-500/30',
      tagColor: 'text-violet-400 bg-violet-950/40',
    },
    {
      date: '30 août 2026',
      tag: 'Équipement',
      title: 'Double arme de guerre (Guerrier)',
      summary:
        'Alternative ×2 à l’Arsenal : choisissez deux armes différentes. Compteur 1/2. Export PDF corrigé pour les maîtrises de catégorie.',
      icon: 'fluent-emoji:crossed-swords',
      border: 'border-emerald-500/30',
      tagColor: 'text-emerald-400 bg-emerald-950/40',
    },
    {
      date: '30 août 2026',
      tag: 'Sessions',
      title: 'Rappels & historique combats',
      summary: 'Push 24 h et 1 h avant une session. Résumé repliable de chaque combat terminé (MJ).',
      icon: 'fluent-emoji:calendar',
      border: 'border-amber-500/30',
      tagColor: 'text-amber-400 bg-amber-950/40',
    },
    {
      date: '30 août 2026',
      tag: 'Initiative',
      title: 'Collecte côté joueurs',
      summary:
        'Bandeau + notification quand le MJ ouvre la collecte. Les joueurs saisissent leur jet depuis le lien fourni.',
      icon: 'fluent-emoji:dice',
      border: 'border-sky-500/30',
      tagColor: 'text-sky-400 bg-sky-950/40',
    },
  ];

  readonly startSteps: GuideStep[] = [
    {
      title: 'Créer un compte',
      body: 'Inscription + confirmation e-mail. Vos personnages sont synchronisés dans le cloud.',
      link: '/register',
      linkLabel: 'S’inscrire',
    },
    {
      title: 'Forger un héros',
      body: 'Parcourez le wizard jusqu’au récap et téléchargez votre fiche PDF.',
      link: '/create',
      linkLabel: 'Créer',
    },
    {
      title: 'Lancer une campagne',
      body: 'MJ : nouvelle campagne, invitez un ami, planifiez une session.',
      badge: 'MJ',
      link: '/campaigns',
      linkLabel: 'Campagnes',
    },
    {
      title: 'Rejoindre la table',
      body: 'Joueur : acceptez l’invitation, proposez un personnage, attendez l’approbation.',
      badge: 'Joueur',
      link: '/campaigns',
      linkLabel: 'Mes campagnes',
    },
    {
      title: 'Activer les notifications',
      body: 'Push PWA pour sessions, documents, initiative et messages.',
      link: '/settings',
      linkLabel: 'Paramètres',
    },
  ];

  readonly filteredStartSteps = computed(() => {
    const a = this.audience();
    return this.startSteps.filter((s) => {
      if (a === 'all') return true;
      if (!s.badge || s.badge === 'Tous') return true;
      if (a === 'dm') return s.badge !== 'Joueur';
      return s.badge !== 'MJ';
    });
  });

  readonly characterSteps: GuideStep[] = [
    { title: 'Espèce', body: 'Traits raciaux, sous-espèce, bonus de taille ou vitesse.' },
    { title: 'Civilisation', body: 'Carte d’Eana — langues et compétences bonus.' },
    { title: 'Historique', body: 'Prédéfini ou custom ; équipement automatique inclus.' },
    { title: 'Classe', body: 'Sous-classe, styles, ASI et invocations aux niveaux clés.' },
    { title: 'Caractéristiques', body: 'Point-buy — validez le total avant de continuer.' },
    { title: 'Compétences', body: 'Maîtrises + choix « au choix » (Lettré : arme ou outil).' },
    {
      title: 'Équipement',
      body: 'Alternatives par slot, grilles d’armes. Guerrier ×2 : deux armes différentes.',
    },
    { title: 'Langues', body: 'Bonus espèce, civilisation et historique.' },
    { title: 'Magie', body: 'Sorts, grimoire, domaines (lanceurs uniquement).' },
    { title: 'Identité', body: 'Nom, alignement, backstory IA optionnelle.' },
    { title: 'Récap & PDF', body: 'Sauvegarde cloud + téléchargement fiche et grimoire.' },
  ];

  readonly campaignMjFlow = [
    'Créer campagne',
    'Inviter amis',
    'Valider persos',
    'Planifier session',
    'Démarrer la table',
  ];
  readonly campaignPlayerFlow = [
    'Accepter invite',
    'Proposer perso',
    'Lire documents',
    'Saisir initiative',
  ];

  readonly proposalFlow = [
    { role: 'Joueur', label: 'Propose un perso' },
    { role: 'MJ', label: 'Voir la fiche' },
    { role: 'MJ', label: 'Accepter / Refuser' },
    { role: 'Groupe', label: 'Prêt pour la table' },
  ];

  readonly arsenalFlow = [
    { label: 'Choisir l’alternative ×2', detail: '2 armes de guerre' },
    { label: 'Sélectionner arme 1', detail: 'Compteur 1/2' },
    { label: 'Sélectionner arme 2', detail: 'Arme différente' },
    { label: 'Slot validé', detail: 'Inventaire à jour' },
  ];

  readonly combatFlow = [
    { role: 'MJ', label: 'Ouvrir le tracker' },
    { role: 'MJ', label: 'Collecter l’init' },
    { role: 'Joueurs', label: 'Saisir le jet' },
    { role: 'MJ', label: 'Importer & jouer' },
  ];

  readonly dmChecklist: GuideChecklistItem[] = [
    { id: 'dm-1', label: 'Campagne créée avec synopsis' },
    { id: 'dm-2', label: 'Amis invités (déjà dans la liste d’amis)' },
    { id: 'dm-3', label: 'Personnages joueurs validés (fiche consultée)' },
    { id: 'dm-4', label: 'Rencontres / créatures préparées' },
    { id: 'dm-5', label: 'Session planifiée (rappels push activés)' },
    { id: 'dm-6', label: 'Documents / handouts prêts si besoin' },
    { id: 'dm-7', label: 'Table démarrée le jour J' },
  ];

  readonly playerChecklist: GuideChecklistItem[] = [
    { id: 'pl-1', label: 'Compte créé et confirmé' },
    { id: 'pl-2', label: 'Personnage forgé et sauvegardé' },
    { id: 'pl-3', label: 'Ami avec le MJ + invitation acceptée' },
    { id: 'pl-4', label: 'Personnage proposé à la campagne' },
    { id: 'pl-5', label: 'Notifications push activées' },
    { id: 'pl-6', label: 'Prêt pour la collecte d’initiative' },
  ];

  readonly faqItems: GuideFaqItem[] = [
    {
      id: 'faq-pdf',
      question: 'Mon PDF affiche « Export incomplet »',
      answer:
        'Il reste des choix non résolus (arme ou outil « au choix », catégorie d’équipement). Revenez aux étapes Compétences ou Équipement, terminez chaque sélection, puis régénérez le PDF au récap.',
      audience: 'all',
    },
    {
      id: 'faq-fiche',
      question: 'Le MJ ne voit pas ma fiche / les PDF joueurs sont vides',
      answer:
        'Le personnage doit d’abord être proposé puis approuvé. Le MJ utilise « Voir la fiche » depuis le Résumé ou l’onglet Joueurs — pas besoin de posséder le personnage. Les amis déjà dans la campagne n’apparaissent plus dans les invitations.',
      audience: 'all',
    },
    {
      id: 'faq-armes',
      question: 'Le Guerrier dit « 2 armes de guerre » mais je n’en choisis qu’une',
      answer:
        'Choisissez l’alternative avec quantité ×2, puis cliquez deux armes différentes dans la grille. Un compteur « 1/2 choisi(s) » confirme la progression avant de passer au slot suivant.',
      audience: 'all',
    },
    {
      id: 'faq-retirer',
      question: 'Comment retirer un joueur de la campagne ?',
      answer:
        'MJ : onglet Joueurs (ou bloc Groupe) → Retirer → confirmer. Le joueur quitte la table ; vous pourrez le réinviter plus tard. Les pré-tirés qui lui étaient assignés sont libérés.',
      audience: 'dm',
    },
    {
      id: 'faq-push',
      question: 'Les notifications push ne marchent pas',
      answer:
        'Paramètres → activer Push PWA, accepter la permission du navigateur (Chrome / Edge recommandés). Sur mobile, ajoutez le site à l’écran d’accueil. Vérifiez aussi que vous êtes bien connecté.',
      audience: 'all',
    },
    {
      id: 'faq-init',
      question: 'Je ne trouve pas où saisir mon initiative',
      answer:
        'Quand le MJ ouvre la collecte, un bandeau apparaît sur la campagne et une notification est envoyée. Utilisez le bouton du bandeau ou le lien reçu. Le MJ importe ensuite les jets dans le tracker.',
      audience: 'player',
    },
    {
      id: 'faq-invite',
      question: 'Je ne peux pas inviter un ami déjà dans la campagne',
      answer:
        'C’est normal : les membres actuels sont filtrés de la liste d’invitation. Pour le faire revenir après un retrait, utilisez à nouveau Inviter un ami.',
      audience: 'dm',
    },
    {
      id: 'faq-pretire',
      question: 'À quoi servent les personnages pré-tirés ?',
      answer:
        'Le MJ prépare des héros prêts à jouer, les assigne, et le joueur peut les revendiquer. Utile pour une one-shot ou un remplaçant rapide.',
      audience: 'all',
    },
  ];

  readonly filteredFaq = computed(() => {
    const a = this.audience();
    return this.faqItems.filter((f) => this.matchesAudience(f.audience, a));
  });

  readonly glossary: GuideGlossaryItem[] = [
    { term: 'Table', definition: 'Espace de jeu en direct du MJ : notes, rencontres, tracker de combat.' },
    { term: 'Pré-tiré', definition: 'Personnage préparé par le MJ, assignable puis revendiquable par un joueur.' },
    { term: 'Handout', definition: 'Document publié aux joueurs (lettre, carte, résumé…) en markdown léger.' },
    {
      term: 'Collecte d’initiative',
      definition: 'Le MJ ouvre une saisie ; chaque joueur envoie son jet avant le combat.',
    },
    {
      term: 'Synthèse MJ',
      definition: 'PDF compact des joueurs approuvés (CA, PV, init, attaques) pour la table.',
    },
    {
      term: 'Proposition',
      definition: 'Un joueur soumet un personnage ; le MJ peut le consulter puis accepter ou refuser.',
    },
    { term: 'Codex', definition: 'Référence de règles du site : espèces, classes, sorts, bestiaire…' },
    { term: 'PWA', definition: 'Application installable + notifications push hors navigateur classique.' },
  ];

  readonly featureIndex: GuideIndexItem[] = [
    { label: 'Amis & chat', description: 'Demandes, messages, invitations', sectionId: 'social', audience: 'all' },
    { label: 'Arsenal de départ', description: 'Équipement et choix d’armes', sectionId: 'personnage', audience: 'all' },
    { label: 'Bestiaire / créatures', description: 'Préparation MJ et PDF', sectionId: 'scenario', audience: 'dm' },
    { label: 'Campagnes', description: 'Création, joueurs, sessions', sectionId: 'scenario', audience: 'all' },
    { label: 'Collecte d’initiative', description: 'Jets joueurs synchronisés', sectionId: 'initiative', audience: 'all' },
    { label: 'Documents / handouts', description: 'Publication markdown', sectionId: 'documents', audience: 'all' },
    { label: 'Fiche personnage PDF', description: 'Export & sauvegarde', sectionId: 'pdf', audience: 'all' },
    { label: 'Historique des combats', description: 'Résumé après combat', sectionId: 'initiative', audience: 'dm' },
    { label: 'Notifications push', description: 'Sessions, init, messages', sectionId: 'notifications', audience: 'all' },
    { label: 'Pré-tirés', description: 'Héros assignables', sectionId: 'scenario', audience: 'all' },
    { label: 'Table de jeu', description: 'Session live MJ', sectionId: 'table', audience: 'dm' },
    { label: 'Validation de personnage', description: 'Voir fiche → accepter', sectionId: 'scenario', audience: 'dm' },
  ];

  readonly filteredIndex = computed(() => {
    const a = this.audience();
    return this.featureIndex.filter((i) => this.matchesAudience(i.audience, a));
  });

  readonly showDm = computed(() => this.audience() !== 'player');
  readonly showPlayer = computed(() => this.audience() !== 'dm');

  ngAfterViewInit(): void {
    this.setupScrollSpy();
    fromEvent(window, 'hashchange')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const id = location.hash.replace('#', '');
        if (id) this.activeSection.set(id);
      });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  setAudience(value: GuideAudience): void {
    this.audience.set(value);
    queueMicrotask(() => this.setupScrollSpy());
  }

  toggleFaq(id: string): void {
    this.openFaqId.update((cur) => (cur === id ? null : id));
  }

  toggleCharacterExpanded(): void {
    this.characterExpanded.update((v) => !v);
  }

  toggleChecklist(id: string): void {
    this.checklistDone.update((m) => ({ ...m, [id]: !m[id] }));
  }

  checklistProgress(items: GuideChecklistItem[]): { done: number; total: number } {
    const done = items.filter((i) => this.checklistDone()[i.id]).length;
    return { done, total: items.length };
  }

  badgeClass(badge?: GuideStep['badge']): string {
    if (badge === 'MJ') return 'bg-violet-950/50 text-violet-300 border-violet-800/50';
    if (badge === 'Joueur') return 'bg-sky-950/50 text-sky-300 border-sky-800/50';
    return 'bg-slate-800/50 text-slate-400 border-slate-700/50';
  }

  matchesAudience(item: GuideAudience, current: GuideAudience): boolean {
    if (current === 'all' || item === 'all') return true;
    return item === current;
  }

  private setupScrollSpy(): void {
    this.observer?.disconnect();
    const ids = this.nav().map((n) => n.id);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);

    if (!elements.length) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          this.activeSection.set(visible[0].target.id);
        }
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.1, 0.25, 0.5] },
    );

    for (const el of elements) this.observer.observe(el);
  }
}
