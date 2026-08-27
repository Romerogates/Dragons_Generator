import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface StatItem {
  value: string;
  label: string;
}

interface FeatureItem {
  title: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // <-- Autorise la balise <iconify-icon>
})
export class Home implements OnInit {
  savedCharactersCount = 0;

  readonly stats: StatItem[] = [
    { value: '9', label: 'Peuples' },
    { value: '13', label: 'Classes' },
    { value: '18', label: 'Civilisations' },
    { value: '∞', label: 'Aventures' },
  ];

  readonly features: FeatureItem[] = [
    {
      title: 'Création Guidée',
      description:
        "Un assistant immersif pour forger votre héros, du choix de l'espèce jusqu'à l'équipement final.",
      icon: 'fluent-emoji:man-mage',
    },
    {
      title: 'Fiches de Héros',
      description:
        'Générez et visualisez vos fiches de personnages avec toutes leurs aptitudes et sorts.',
      icon: 'fluent-emoji:scroll',
    },
    {
      title: 'Sauvegarde Magique',
      description:
        'Vos héros sont stockés en sécurité dans votre grimoire local. Ne perdez jamais un destin.',
      icon: 'fluent-emoji:floppy-disk',
    },
    {
      title: 'Grimoire de Règles',
      description:
        "Accédez instantanément aux détails des sorts, de l'équipement et des langues d'Eana.",
      icon: 'fluent-emoji:books',
    },
    {
      title: 'Forge de Scénarios',
      description:
        'Composez une aventure à partir du bestiaire : nommez vos créatures, générez l\'intrigue et imprimez le pack MJ.',
      icon: 'fluent-emoji:scroll',
    },
  ];

  /** Codex tiles — keep count divisible by 3 for a balanced grid. */
  readonly grimoireLinks: { label: string; path: string; icon: string; hover: string }[] = [
    { label: 'Espèces', path: '/species', icon: 'fluent-emoji:dna', hover: 'amber' },
    { label: 'Classes', path: '/classes', icon: 'fluent-emoji:crossed-swords', hover: 'amber' },
    {
      label: 'Civilisations',
      path: '/civilisations',
      icon: 'fluent-emoji:japanese-castle',
      hover: 'amber',
    },
    { label: 'Sorts', path: '/spells', icon: 'fluent-emoji:magic-wand', hover: 'amber' },
    { label: 'Bestiaire', path: '/creatures', icon: 'fluent-emoji:dragon', hover: 'rose' },
    { label: 'Équipements', path: '/equipments', icon: 'fluent-emoji:shield', hover: 'amber' },
    { label: 'Compétences', path: '/skills', icon: 'fluent-emoji:bookmark-tabs', hover: 'sky' },
    { label: 'Dons', path: '/feats', icon: 'fluent-emoji:trophy', hover: 'amber' },
    { label: 'Combat', path: '/combat-actions', icon: 'fluent-emoji:collision', hover: 'rose' },
    { label: 'Divinités', path: '/deities', icon: 'fluent-emoji:glowing-star', hover: 'violet' },
  ];

  hoverBorder(kind: string): string {
    switch (kind) {
      case 'sky':
        return 'hover:border-sky-500/50';
      case 'rose':
        return 'hover:border-rose-500/50';
      case 'violet':
        return 'hover:border-violet-500/50';
      default:
        return 'hover:border-amber-500/50';
    }
  }

  hoverText(kind: string): string {
    switch (kind) {
      case 'sky':
        return 'group-hover:text-sky-500';
      case 'rose':
        return 'group-hover:text-rose-400';
      case 'violet':
        return 'group-hover:text-violet-400';
      default:
        return 'group-hover:text-amber-500';
    }
  }

  ngOnInit(): void {
    this.checkSavedCharacters();
  }

  private checkSavedCharacters(): void {
    const raw = localStorage.getItem('dragons-characters');
    if (raw) {
      try {
        const chars = JSON.parse(raw);
        this.savedCharactersCount = Array.isArray(chars) ? chars.length : 0;
      } catch {
        this.savedCharactersCount = 0;
      }
    }
  }

  // NOUVELLE MÉTHODE : Fait défiler la page jusqu'à la section des statistiques
  scrollToStats(): void {
    const element = document.getElementById('stats-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
