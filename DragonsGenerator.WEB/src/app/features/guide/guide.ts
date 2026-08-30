import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface GuideNavItem {
  id: string;
  label: string;
  icon: string;
  accent: string;
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

export interface GuideSection {
  id: string;
  title: string;
  lead: string;
  icon: string;
  accent: string;
  border: string;
  steps?: GuideStep[];
  bullets?: string[];
  subsections?: { title: string; steps: GuideStep[] }[];
}

@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './guide.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class GuidePage {
  readonly nav: GuideNavItem[] = [
    { id: 'journal', label: 'Journal', icon: 'fluent-emoji:newspaper', accent: 'text-violet-400' },
    { id: 'demarrage', label: 'Premiers pas', icon: 'fluent-emoji:rocket', accent: 'text-amber-400' },
    { id: 'compte', label: 'Compte', icon: 'fluent-emoji:bust-in-silhouette', accent: 'text-sky-400' },
    { id: 'personnage', label: 'Personnage', icon: 'fluent-emoji:shield', accent: 'text-emerald-400' },
    { id: 'scenario', label: 'Campagnes', icon: 'fluent-emoji:world-map', accent: 'text-violet-400' },
    { id: 'table', label: 'Table MJ', icon: 'fluent-emoji:performing-arts', accent: 'text-amber-400' },
    { id: 'initiative', label: 'Combat', icon: 'fluent-emoji:crossed-swords', accent: 'text-red-400' },
    { id: 'documents', label: 'Documents', icon: 'fluent-emoji:scroll', accent: 'text-sky-400' },
    { id: 'social', label: 'Social', icon: 'fluent-emoji:speech-balloon', accent: 'text-pink-400' },
    { id: 'notifications', label: 'Notifications', icon: 'fluent-emoji:bell', accent: 'text-amber-400' },
    { id: 'codex', label: 'Codex', icon: 'fluent-emoji:books', accent: 'text-emerald-400' },
    { id: 'pdf', label: 'PDF', icon: 'fluent-emoji:printer', accent: 'text-slate-300' },
    { id: 'support', label: 'Support', icon: 'fluent-emoji:raising-hands', accent: 'text-violet-400' },
  ];

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
      summary: 'Bandeau + notification quand le MJ ouvre la collecte. Les joueurs saisissent leur jet depuis le lien fourni.',
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

  readonly campaignMjFlow = ['Créer campagne', 'Inviter amis', 'Valider persos', 'Planifier session', 'Démarrer la table'];
  readonly campaignPlayerFlow = ['Accepter invite', 'Proposer perso', 'Lire documents', 'Saisir initiative'];

  badgeClass(badge?: GuideStep['badge']): string {
    if (badge === 'MJ') return 'bg-violet-950/50 text-violet-300 border-violet-800/50';
    if (badge === 'Joueur') return 'bg-sky-950/50 text-sky-300 border-sky-800/50';
    return 'bg-slate-800/50 text-slate-400 border-slate-700/50';
  }
}
