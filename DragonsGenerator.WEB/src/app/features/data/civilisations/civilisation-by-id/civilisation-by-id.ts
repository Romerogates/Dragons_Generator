import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataService } from '@core/services/data.service';

// N'oublie pas d'importer ton interface (le chemin peut varier selon ton dossier)
import { Civilisation } from '@core/models/Civilisations/civilisations';

@Component({
  selector: 'app-civilisation-by-id',
  standalone: true, // Pense bien à l'ajouter pour Angular 17+
  imports: [RouterLink],
  templateUrl: './civilisation-by-id.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // <-- Autorise la balise <iconify-icon>
})
export class CivilisationById implements OnInit {
  // J'ai ajouté 'Component' au nom pour les bonnes pratiques
  private route = inject(ActivatedRoute);
  private dataService = inject(DataService);

  // 1. Déclaration des Signals manquants
  // J'utilise le singulier 'civilisation' car on en affiche qu'une seule
  civilisation = signal<Civilisation | undefined>(undefined);
  isLoading = signal<boolean>(true);

  ngOnInit(): void {
    // 2. On retire l'erreur par défaut et on lit l'ID dans l'URL (ex: /civilisation/dragon-rouge)
    // 'id' doit correspondre au nom du paramètre dans ton fichier de routes (app.routes.ts)
    const idDeLUrl = this.route.snapshot.paramMap.get('id');

    if (idDeLUrl) {
      // Si on a trouvé un ID dans l'URL, on lance le chargement
      this.loadCivilisationById(idDeLUrl);
    } else {
      console.error("Aucun ID n'a été trouvé dans l'URL.");
      this.isLoading.set(false);
    }
  }

  // 3. On ajoute le paramètre 'id' à la méthode
  loadCivilisationById(id: string) {
    // 4. On passe l'ID au service
    this.dataService.getCivilisationById(id).subscribe({
      // 5. On utilise le bon modèle 'Civilisation'
      next: (donnees: Civilisation | undefined) => {
        this.civilisation.set(donnees);
        this.isLoading.set(false);
      },
      error: (erreur) => {
        console.error('Erreur lors du chargement de la civilisation', erreur);
        this.isLoading.set(false);
      },
    });
  }
}
