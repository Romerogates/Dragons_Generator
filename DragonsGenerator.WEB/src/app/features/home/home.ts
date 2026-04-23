import { Component, OnInit } from '@angular/core';
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
      icon: '🧙‍♂️',
    },
    {
      title: 'Fiches de Héros',
      description:
        'Générez et visualisez vos fiches de personnages avec toutes leurs aptitudes et sorts.',
      icon: '📜',
    },
    {
      title: 'Sauvegarde Magique',
      description:
        'Vos héros sont stockés en sécurité dans votre grimoire local. Ne perdez jamais un destin.',
      icon: '💾',
    },
    {
      title: 'Grimoire de Règles',
      description:
        "Accédez instantanément aux détails des sorts, de l'équipement et des langues d'Eana.",
      icon: '📚',
    },
  ];

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
